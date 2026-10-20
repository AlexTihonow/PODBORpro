package httpx

import (
	"bufio"
	"context"
	"fmt"
	"io"
	"os"
	"slices"
	"sync"
	"time"

	"github.com/chromedp/chromedp"
)

// Browser открывает страницы в Chrome через chromedp.
//
// Без окна — для сайтов, которые собирают страницу через JavaScript (render: browser в sources.yaml).
// С окном (флаг -browser при первом сборе) сборщик при проверке «не робот» ждёт,
// пока человек пройдёт её сам и нажмёт Enter. Сами проверки сборщик не проходит.
type Browser struct {
	ctx    context.Context
	cancel context.CancelFunc
	window bool
	prompt *Prompt
}

// BrowserOptions — настройки браузера.
type BrowserOptions struct {
	UserAgent  string
	ProfileDir string // постоянный профиль: cookies после пройденной проверки сохраняются
	Window     bool
	Prompt     *Prompt
}

// NewBrowser запускает Chrome. Close закрывает его.
func NewBrowser(opt BrowserOptions) (*Browser, error) {
	allocOpts := append(slices.Clone(chromedp.DefaultExecAllocatorOptions[:]),
		chromedp.UserAgent(opt.UserAgent),
		chromedp.Flag("lang", "ru-RU"),
	)
	if opt.ProfileDir != "" {
		if err := os.MkdirAll(opt.ProfileDir, 0o700); err != nil {
			return nil, err
		}
		allocOpts = append(allocOpts, chromedp.UserDataDir(opt.ProfileDir))
	}
	if opt.Window {
		allocOpts = append(allocOpts, chromedp.VisibleWindow)
	}
	actx, acancel := chromedp.NewExecAllocator(context.Background(), allocOpts...)
	ctx, cancel := chromedp.NewContext(actx)
	if err := chromedp.Do(ctx); err != nil { // запускает браузер
		cancel()
		acancel()
		return nil, fmt.Errorf("запуск Chrome: %w", err)
	}
	prompt := opt.Prompt
	if prompt == nil {
		prompt = NewPrompt(os.Stdin, os.Stderr)
	}
	return &Browser{ctx: ctx, cancel: func() { cancel(); acancel() }, window: opt.Window, prompt: prompt}, nil
}

func (b *Browser) Close() { b.cancel() }

// Tab — отдельная вкладка для одного сайта: при параллельном сборе сайты друг другу не мешают.
type Tab struct {
	b   *Browser
	ctx context.Context
}

// Tab открывает новую вкладку. Она закрывается вместе с браузером.
func (b *Browser) Tab() *Tab {
	ctx, _ := chromedp.NewContext(b.ctx) //nolint:govet // вкладку закрывает Close браузера
	return &Tab{b: b, ctx: ctx}
}

// Render открывает страницу и возвращает её HTML после выполнения JavaScript.
func (t *Tab) Render(ctx context.Context, url string) (Response, error) {
	resp, err := t.open(ctx, url)
	if err != nil || !IsCaptcha(resp.Body) || !t.b.window {
		return resp, err
	}
	if err := t.b.prompt.Wait("Сайт показал проверку «не робот». Пройдите её в окне Chrome и нажмите Enter"); err != nil {
		return resp, err
	}
	return t.open(ctx, url)
}

func (t *Tab) open(ctx context.Context, url string) (Response, error) {
	tctx, cancel := context.WithTimeout(t.ctx, 45*time.Second)
	defer cancel()
	stop := context.AfterFunc(ctx, cancel)
	defer stop()

	resp, err := chromedp.Run(tctx, chromedp.NavigateResponse(url))
	if err != nil {
		return Response{}, err
	}
	if err := chromedp.Do(tctx,
		chromedp.WaitReady(chromedp.CSS("body")),
		chromedp.Sleep(time.Second), // дать странице дорисоваться
	); err != nil {
		return Response{}, err
	}
	html, err := chromedp.Run(tctx, chromedp.OuterHTML(chromedp.CSS("html")))
	if err != nil {
		return Response{}, err
	}
	final, err := chromedp.Run(tctx, chromedp.Location())
	if err != nil {
		return Response{}, err
	}
	status := 200
	if resp != nil {
		status = int(resp.Status)
	}
	return Response{Status: status, Body: []byte(html), URL: final}, nil
}

// Prompt — ожидание Enter в терминале. Общий на все сайты: при параллельном сборе
// вопросы не перемешиваются.
type Prompt struct {
	mu  sync.Mutex
	in  *bufio.Reader
	out io.Writer
}

func NewPrompt(in io.Reader, out io.Writer) *Prompt {
	return &Prompt{in: bufio.NewReader(in), out: out}
}

func (p *Prompt) Wait(msg string) error {
	p.mu.Lock()
	defer p.mu.Unlock()
	fmt.Fprint(p.out, msg+"... ")
	_, err := p.in.ReadString('\n')
	return err
}
