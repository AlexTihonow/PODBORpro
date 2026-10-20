// Package httpx — общий HTTP-клиент сборщика: паузы, повторы, robots.txt, свой User-Agent.
//
// Один Client — один сайт: запросы к нему идут строго по одному, со случайной паузой между ними.
package httpx

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"math/rand/v2"
	"net/http"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"
)

var (
	// ErrBlocked — 403 или проверка «не робот». Сбор этого сайта в текущем запуске останавливается.
	ErrBlocked = errors.New("сайт заблокировал запрос (403 или проверка «не робот»)")
	// ErrRateLimited — 429 или 503: подождали Retry-After, сбор сайта останавливается.
	ErrRateLimited = errors.New("сайт просит снизить частоту запросов (429/503)")
	// ErrDisallowed — адрес запрещён в robots.txt, туда не ходим.
	ErrDisallowed = errors.New("адрес запрещён в robots.txt")
)

// Response — ответ сайта. URL — адрес после всех перенаправлений.
type Response struct {
	Status int
	Body   []byte
	URL    string
}

// Renderer открывает страницу в браузере (render: browser в sources.yaml).
type Renderer interface {
	Render(ctx context.Context, url string) (Response, error)
}

// Options — настройки клиента для одного сайта.
type Options struct {
	UserAgent string
	// Agent — имя бота для robots.txt; по умолчанию первое слово User-Agent до «/».
	Agent    string
	PauseMin time.Duration
	PauseMax time.Duration
	// Timeout — сколько ждать один ответ.
	Timeout time.Duration
	// RetryAfter — сколько ждать при 429/503 без заголовка Retry-After.
	RetryAfter time.Duration
	// Retries — сколько раз повторять запрос при обрыве сети и 5xx.
	Retries int
	// Render — если задан, страницы (кроме robots.txt) открываются через него.
	Render Renderer
	// HTTP — свой транспорт, для тестов.
	HTTP *http.Client
	// Sleep — своя пауза, для тестов.
	Sleep func(ctx context.Context, d time.Duration) error
}

const maxBody = 15 << 20

type Client struct {
	opt  Options
	http *http.Client

	mu     sync.Mutex
	last   time.Time
	robots map[string]*Robots
}

func New(opt Options) *Client {
	if opt.Agent == "" {
		opt.Agent, _, _ = strings.Cut(opt.UserAgent, "/")
	}
	if opt.Timeout == 0 {
		opt.Timeout = 30 * time.Second
	}
	if opt.RetryAfter == 0 {
		opt.RetryAfter = 10 * time.Minute
	}
	if opt.Retries == 0 {
		opt.Retries = 3
	}
	if opt.Sleep == nil {
		opt.Sleep = sleep
	}
	c := &Client{opt: opt, robots: map[string]*Robots{}}
	hc := http.Client{Timeout: opt.Timeout}
	if opt.HTTP != nil {
		hc = *opt.HTTP
	}
	hc.CheckRedirect = func(req *http.Request, via []*http.Request) error {
		if len(via) >= 10 {
			return errors.New("слишком много перенаправлений")
		}
		if isCaptchaURL(req.URL) {
			return ErrBlocked
		}
		if !c.allowed(req.Context(), req.URL) {
			return fmt.Errorf("%w: перенаправление", ErrDisallowed)
		}
		return nil
	}
	c.http = &hc
	return c
}

func sleep(ctx context.Context, d time.Duration) error {
	t := time.NewTimer(d)
	defer t.Stop()
	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-t.C:
		return nil
	}
}

// Allowed проверяет адрес по robots.txt его сайта.
func (c *Client) Allowed(ctx context.Context, rawURL string) bool {
	u, err := url.Parse(rawURL)
	if err != nil {
		return false
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.allowed(ctx, u)
}

// allowed вызывается под c.mu.
func (c *Client) allowed(ctx context.Context, u *url.URL) bool {
	host := u.Scheme + "://" + u.Host
	r, ok := c.robots[host]
	if !ok {
		r = c.fetchRobots(ctx, host)
		c.robots[host] = r
	}
	return r.Allowed(u.RequestURI())
}

func (c *Client) fetchRobots(ctx context.Context, host string) *Robots {
	if err := c.pause(ctx); err != nil {
		return DisallowAll
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, host+"/robots.txt", nil)
	if err != nil {
		return DisallowAll
	}
	req.Header.Set("User-Agent", c.opt.UserAgent)
	plain := http.Client{Timeout: c.http.Timeout, Transport: c.http.Transport}
	resp, err := plain.Do(req)
	c.last = time.Now()
	if err != nil {
		return DisallowAll
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	switch {
	case resp.StatusCode >= 500:
		return DisallowAll
	case resp.StatusCode >= 400:
		return AllowAll
	case resp.StatusCode == 200:
		return ParseRobots(body, c.opt.Agent)
	}
	return AllowAll
}

// pause выдерживает случайную паузу с прошлого запроса. Вызывается под c.mu.
func (c *Client) pause(ctx context.Context) error {
	if c.last.IsZero() || c.opt.PauseMax <= 0 {
		return ctx.Err()
	}
	d := c.opt.PauseMin
	if c.opt.PauseMax > c.opt.PauseMin {
		d += rand.N(c.opt.PauseMax - c.opt.PauseMin)
	}
	if wait := d - time.Since(c.last); wait > 0 {
		return c.opt.Sleep(ctx, wait)
	}
	return ctx.Err()
}

// Get скачивает страницу. 404 и прочие коды возвращаются в Response без ошибки;
// 403 и проверка «не робот» — ErrBlocked, 429/503 — ErrRateLimited, запрет robots.txt — ErrDisallowed.
func (c *Client) Get(ctx context.Context, rawURL string) (Response, error) {
	u, err := url.Parse(rawURL)
	if err != nil {
		return Response{}, err
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	if !c.allowed(ctx, u) {
		return Response{}, ErrDisallowed
	}

	var lastErr error
	for attempt := range c.opt.Retries {
		if attempt > 0 {
			if err := c.opt.Sleep(ctx, time.Duration(attempt)*10*time.Second); err != nil {
				return Response{}, err
			}
		}
		if err := c.pause(ctx); err != nil {
			return Response{}, err
		}
		resp, retryAfter, err := c.do(ctx, rawURL)
		c.last = time.Now()
		switch {
		case errors.Is(err, ErrBlocked), errors.Is(err, ErrDisallowed), ctx.Err() != nil:
			return Response{}, err
		case err != nil:
			lastErr = err
			continue
		}
		switch {
		case resp.Status == http.StatusTooManyRequests || resp.Status == http.StatusServiceUnavailable:
			if retryAfter == 0 {
				retryAfter = c.opt.RetryAfter
			}
			if err := c.opt.Sleep(ctx, retryAfter); err != nil {
				return Response{}, err
			}
			c.last = time.Now()
			return Response{}, ErrRateLimited
		case resp.Status == http.StatusForbidden:
			return Response{}, ErrBlocked
		case resp.Status >= 500:
			lastErr = fmt.Errorf("ответ %d", resp.Status)
			continue
		case IsCaptcha(resp.Body):
			return Response{}, ErrBlocked
		}
		return resp, nil
	}
	return Response{}, lastErr
}

func (c *Client) do(ctx context.Context, rawURL string) (Response, time.Duration, error) {
	if c.opt.Render != nil {
		r, err := c.opt.Render.Render(ctx, rawURL)
		return r, 0, err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, rawURL, nil)
	if err != nil {
		return Response{}, 0, err
	}
	req.Header.Set("User-Agent", c.opt.UserAgent)
	req.Header.Set("Accept-Language", "ru-RU,ru;q=0.9")
	resp, err := c.http.Do(req)
	if err != nil {
		var uerr *url.Error
		if errors.As(err, &uerr) && (errors.Is(uerr.Err, ErrBlocked) || errors.Is(uerr.Err, ErrDisallowed)) {
			return Response{}, 0, uerr.Err
		}
		return Response{}, 0, err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(io.LimitReader(resp.Body, maxBody))
	if err != nil {
		return Response{}, 0, err
	}
	return Response{Status: resp.StatusCode, Body: body, URL: resp.Request.URL.String()},
		parseRetryAfter(resp.Header.Get("Retry-After")), nil
}

func parseRetryAfter(v string) time.Duration {
	if v == "" {
		return 0
	}
	if s, err := strconv.Atoi(v); err == nil && s >= 0 {
		return time.Duration(s) * time.Second
	}
	if t, err := http.ParseTime(v); err == nil {
		return max(time.Until(t), 0)
	}
	return 0
}

var titleRe = regexp.MustCompile(`(?is)<title[^>]*>(.*?)</title>`)

// IsCaptcha узнаёт страницу проверки «не робот» по заголовку.
func IsCaptcha(body []byte) bool {
	m := titleRe.FindSubmatch(body)
	if m == nil {
		return false
	}
	t := bytes.ToLower(m[1])
	return bytes.Contains(t, []byte("не робот")) || bytes.Contains(t, []byte("captcha")) ||
		bytes.Contains(t, []byte("капча"))
}

func isCaptchaURL(u *url.URL) bool {
	return strings.Contains(strings.ToLower(u.Path), "captcha")
}
