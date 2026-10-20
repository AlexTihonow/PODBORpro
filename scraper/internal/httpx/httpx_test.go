package httpx

import (
	"compress/gzip"
	"context"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"sync"
	"testing"
	"time"
)

func readGz(t *testing.T, path string) []byte {
	t.Helper()
	f, err := os.Open(path)
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close()
	zr, err := gzip.NewReader(f)
	if err != nil {
		t.Fatal(err)
	}
	b, err := io.ReadAll(zr)
	if err != nil {
		t.Fatal(err)
	}
	return b
}

func TestRobotsHH(t *testing.T) {
	r := ParseRobots(readGz(t, "../sources/hh/testdata/robots.txt.gz"), "PODBORpro-bot")
	for path, want := range map[string]bool{
		"/vacancy/137568898":                     true,
		"/vacancies/go-razrabotchik":             true,
		"/sitemap/vacancies0.xml":                true,
		"/search/vacancy?text=golang&area=1":     false, // Disallow: *?*
		"/vacancies/go-razrabotchik?page=1":      false,
		"/account/login":                         false,
		"/robots.txt":                            true,
		"/vacancy/137568898?vacancyId=137568898": true, // Allow: *?vacancyId* длиннее, чем *?*
	} {
		if got := r.Allowed(path); got != want {
			t.Errorf("Allowed(%q) = %v, ждали %v", path, got, want)
		}
	}
}

func TestRobotsHabr(t *testing.T) {
	r := ParseRobots(readGz(t, "../sources/habr/testdata/robots.txt.gz"), "PODBORpro-bot")
	for path, want := range map[string]bool{
		"/vacancies?type=all&sort=date&q=backend": true,
		"/vacancies/1000166753":                   true,
		"/vacancies/1000166753/responses":         false,
		"/users/someone":                          false,
	} {
		if got := r.Allowed(path); got != want {
			t.Errorf("Allowed(%q) = %v, ждали %v", path, got, want)
		}
	}
}

func TestRobotsGroups(t *testing.T) {
	body := []byte(`
User-agent: Googlebot
Disallow: /

User-agent: podborpro-bot
User-agent: other
Disallow: /private
Allow: /private/ok$

User-agent: *
Disallow: /
`)
	r := ParseRobots(body, "PODBORpro-bot")
	if !r.Allowed("/public") || r.Allowed("/private/x") || !r.Allowed("/private/ok") || r.Allowed("/private/ok/more") {
		t.Error("своя группа должна заменять «*», а $ — закреплять конец")
	}
	if ParseRobots([]byte("User-agent: *\nDisallow:\n"), "x").Allowed("/any") != true {
		t.Error("пустой Disallow ничего не запрещает")
	}
}

type fakeSleep struct {
	mu    sync.Mutex
	slept []time.Duration
}

func (f *fakeSleep) sleep(_ context.Context, d time.Duration) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.slept = append(f.slept, d)
	return nil
}

func newTestClient(t *testing.T, h http.HandlerFunc) (*Client, *httptest.Server, *fakeSleep) {
	t.Helper()
	srv := httptest.NewServer(h)
	t.Cleanup(srv.Close)
	fs := &fakeSleep{}
	c := New(Options{UserAgent: "PODBORpro-bot/1.0 (+test)", PauseMin: 3 * time.Second, PauseMax: 6 * time.Second,
		Sleep: fs.sleep, HTTP: srv.Client()})
	return c, srv, fs
}

func TestGetUserAgentPauseAndRobots(t *testing.T) {
	var uas []string
	c, srv, fs := newTestClient(t, func(w http.ResponseWriter, r *http.Request) {
		uas = append(uas, r.UserAgent())
		if r.URL.Path == "/robots.txt" {
			io.WriteString(w, "User-agent: *\nDisallow: /secret\n")
			return
		}
		io.WriteString(w, "<html><title>ok</title></html>")
	})
	ctx := context.Background()
	for range 2 {
		resp, err := c.Get(ctx, srv.URL+"/page")
		if err != nil || resp.Status != 200 {
			t.Fatalf("%v %v", resp.Status, err)
		}
	}
	if _, err := c.Get(ctx, srv.URL+"/secret/1"); !errors.Is(err, ErrDisallowed) {
		t.Fatalf("ждали ErrDisallowed, получили %v", err)
	}
	for _, ua := range uas {
		if ua != "PODBORpro-bot/1.0 (+test)" {
			t.Errorf("User-Agent %q", ua)
		}
	}
	if len(uas) != 3 { // robots.txt и две страницы; запрещённую не запрашивали
		t.Errorf("запросов %d, ждали 3", len(uas))
	}
	if len(fs.slept) < 2 {
		t.Fatalf("паузы между запросами не было: %v", fs.slept)
	}
	for _, d := range fs.slept {
		if d > 6*time.Second || d <= 0 {
			t.Errorf("пауза %v вне 3–6 с", d)
		}
	}
}

func TestGetRateLimited(t *testing.T) {
	c, srv, fs := newTestClient(t, func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/robots.txt" {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Retry-After", "120")
		w.WriteHeader(http.StatusTooManyRequests)
	})
	_, err := c.Get(context.Background(), srv.URL+"/p")
	if !errors.Is(err, ErrRateLimited) {
		t.Fatalf("ждали ErrRateLimited, получили %v", err)
	}
	found := false
	for _, d := range fs.slept {
		found = found || d == 2*time.Minute
	}
	if !found {
		t.Errorf("не подождали Retry-After: %v", fs.slept)
	}
}

func TestGetBlocked(t *testing.T) {
	for name, h := range map[string]http.HandlerFunc{
		"403": func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusForbidden) },
		"captcha": func(w http.ResponseWriter, r *http.Request) {
			io.WriteString(w, "<html><head><title>Подтвердите, что вы не робот</title></head></html>")
		},
		"redirect to captcha": func(w http.ResponseWriter, r *http.Request) {
			if strings.Contains(r.URL.Path, "captcha") {
				io.WriteString(w, "captcha")
				return
			}
			http.Redirect(w, r, "/account/captcha?backurl=/p", http.StatusFound)
		},
	} {
		t.Run(name, func(t *testing.T) {
			c, srv, _ := newTestClient(t, func(w http.ResponseWriter, r *http.Request) {
				if r.URL.Path == "/robots.txt" {
					http.NotFound(w, r)
					return
				}
				h(w, r)
			})
			if _, err := c.Get(context.Background(), srv.URL+"/p"); !errors.Is(err, ErrBlocked) {
				t.Fatalf("ждали ErrBlocked, получили %v", err)
			}
		})
	}
}

func TestGetRetries5xxAndReturns404(t *testing.T) {
	calls := 0
	c, srv, _ := newTestClient(t, func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/robots.txt", "/missing":
			http.NotFound(w, r)
		default:
			calls++
			if calls < 3 {
				w.WriteHeader(http.StatusBadGateway)
				return
			}
			io.WriteString(w, "ok")
		}
	})
	resp, err := c.Get(context.Background(), srv.URL+"/flaky")
	if err != nil || string(resp.Body) != "ok" || calls != 3 {
		t.Fatalf("повтор при 502: %v %q, запросов %d", err, resp.Body, calls)
	}
	resp, err = c.Get(context.Background(), srv.URL+"/missing")
	if err != nil || resp.Status != 404 {
		t.Fatalf("404 должен вернуться без ошибки: %v %v", resp.Status, err)
	}
}

func TestRobotsUnavailableDisallowsAll(t *testing.T) {
	c, srv, _ := newTestClient(t, func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/robots.txt" {
			w.WriteHeader(http.StatusInternalServerError)
			return
		}
		t.Error("при недоступном robots.txt сайт не трогаем")
	})
	if _, err := c.Get(context.Background(), srv.URL+"/p"); !errors.Is(err, ErrDisallowed) {
		t.Fatalf("ждали ErrDisallowed, получили %v", err)
	}
}
