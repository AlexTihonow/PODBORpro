// Сборщик вакансий: links → fetch → tag → push. Каждый этап читает JSON-файл предыдущего
// и пишет свой, поэтому любой этап можно перезапустить отдельно.
//
//	go run ./cmd/scraper all                       # все четыре этапа подряд
//	go run ./cmd/scraper links                     # только этап 1
//	go run ./cmd/scraper fetch -limit 200          # только этап 2, не больше 200 страниц
//	go run ./cmd/scraper fetch -retry-failed       # заново разобрать data/html/failed/
//	go run ./cmd/scraper fetch -refetch -since 7d  # скачать заново вакансии за 7 дней
//	go run ./cmd/scraper all -profile bootstrap -browser   # первый сбор на своей машине
package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"log/slog"
	"os"
	"os/signal"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/AlexTihonow/PODBORpro/scraper/internal/config"
	"github.com/AlexTihonow/PODBORpro/scraper/internal/data"
	"github.com/AlexTihonow/PODBORpro/scraper/internal/fetch"
	"github.com/AlexTihonow/PODBORpro/scraper/internal/httpx"
	"github.com/AlexTihonow/PODBORpro/scraper/internal/links"
	"github.com/AlexTihonow/PODBORpro/scraper/internal/push"
	"github.com/AlexTihonow/PODBORpro/scraper/internal/sources"
	"github.com/AlexTihonow/PODBORpro/scraper/internal/sources/habr"
	"github.com/AlexTihonow/PODBORpro/scraper/internal/sources/hh"
	"github.com/AlexTihonow/PODBORpro/scraper/internal/tag"
)

// registry — все источники. Новый сайт: файл в internal/sources/<код>/, строка здесь,
// запись в sources.yaml и строка в таблице sources (миграцией).
var registry = map[string]func(sources.Getter) sources.Source{
	hh.Code:   func(g sources.Getter) sources.Source { return hh.New(g) },
	habr.Code: func(g sources.Getter) sources.Source { return habr.New(g) },
}

const usage = `использование: scraper <links|fetch|tag|push|all> [флаги]

флаги:
`

type flags struct {
	config      string
	dataDir     string
	profile     string
	browser     bool
	limit       int
	retryFailed bool
	refetch     bool
	since       string
}

func main() {
	if len(os.Args) < 2 || strings.HasPrefix(os.Args[1], "-") {
		fmt.Fprint(os.Stderr, usage)
		newFlagSet(&flags{}).PrintDefaults()
		os.Exit(2)
	}
	cmd := os.Args[1]
	var f flags
	fs := newFlagSet(&f)
	if err := fs.Parse(os.Args[2:]); err != nil {
		os.Exit(2)
	}
	log := slog.New(slog.NewTextHandler(os.Stderr, nil))
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	if err := run(ctx, cmd, f, log); err != nil {
		if errors.Is(err, context.Canceled) {
			log.Info("остановлено; повторный запуск той же командой продолжит с места остановки")
			os.Exit(130)
		}
		log.Error("сбор завершился с ошибкой", "err", err)
		os.Exit(1)
	}
}

func newFlagSet(f *flags) *flag.FlagSet {
	fs := flag.NewFlagSet("scraper", flag.ContinueOnError)
	fs.StringVar(&f.config, "config", "sources.yaml", "файл настроек")
	fs.StringVar(&f.dataDir, "data", "data", "папка с результатами этапов")
	fs.StringVar(&f.profile, "profile", "normal", "normal — обычный запуск; bootstrap — первый сбор: вся выдача, bootstrap_queries, сайты параллельно")
	fs.BoolVar(&f.browser, "browser", false, "открывать страницы в Chrome с окном; при проверке «не робот» ждать, пока вы её пройдёте")
	fs.IntVar(&f.limit, "limit", 0, "fetch: не больше стольких страниц за запуск (0 — без ограничения)")
	fs.BoolVar(&f.retryFailed, "retry-failed", false, "fetch: заново разобрать страницы из data/html/failed/")
	fs.BoolVar(&f.refetch, "refetch", false, "fetch: скачать заново вакансии, скачанные за -since")
	fs.StringVar(&f.since, "since", "7d", "fetch -refetch: за какой срок (7d, 36h)")
	return fs
}

// site — источник в текущем запуске.
type site struct {
	code string
	cfg  config.Source
	src  sources.Source
	get  *httpx.Client

	attempted bool
	stopErr   error // сбор сайта остановлен в этом запуске
	fetched   int
	errors    int
}

func (s *site) blocked() bool { return errors.Is(s.stopErr, httpx.ErrBlocked) }

func (s *site) status() string {
	switch {
	case s.stopErr == nil:
		return "success"
	case s.fetched > 0:
		return "partial"
	}
	return "failed"
}

type app struct {
	f     flags
	cfg   config.Config
	st    *data.Store
	sites []*site
	log   *slog.Logger
	start time.Time

	bootstrap bool
	browser   *httpx.Browser
	tagPushMu sync.Mutex
	siteMu    sync.Mutex // поля site при параллельном сборе
}

func run(ctx context.Context, cmd string, f flags, log *slog.Logger) error {
	switch cmd {
	case "links", "fetch", "tag", "push", "all":
	default:
		return fmt.Errorf("неизвестная команда %q, нужна links, fetch, tag, push или all", cmd)
	}
	if f.profile != "normal" && f.profile != "bootstrap" {
		return fmt.Errorf("-profile: normal или bootstrap, а не %q", f.profile)
	}
	cfg, err := config.Load(f.config)
	if err != nil {
		return err
	}
	st, err := data.Open(f.dataDir)
	if err != nil {
		return err
	}
	a := &app{f: f, cfg: cfg, st: st, log: log, start: time.Now().UTC(), bootstrap: f.profile == "bootstrap"}
	if cmd == "links" || cmd == "fetch" || cmd == "all" {
		if err := a.openSites(); err != nil {
			return err
		}
		defer a.closeBrowser()
	}

	switch cmd {
	case "links":
		a.stageLinks(ctx)
		return a.collected(ctx)
	case "fetch":
		a.stageFetch(ctx)
		return a.collected(ctx)
	case "tag":
		_, err := tag.Run(ctx, st, tag.NewClient(cfg.LayaURL), log)
		return err
	case "push":
		_, err := push.Push(ctx, st, push.NewClient(cfg.PodborURL, cfg.ImportToken), nil, log)
		return err
	}

	// all
	a.stageLinks(ctx)
	a.stageFetch(ctx)
	if ctx.Err() != nil {
		return ctx.Err()
	}
	pushErr := a.tagAndPush(ctx)
	collectErr := a.collected(ctx)
	return errors.Join(collectErr, pushErr)
}

func (a *app) openSites() error {
	needBrowser := a.f.browser
	for _, sc := range a.cfg.Sources {
		if sc.IsEnabled() && sc.Render == "browser" {
			needBrowser = true
		}
	}
	if needBrowser {
		b, err := httpx.NewBrowser(httpx.BrowserOptions{
			UserAgent:  a.cfg.UserAgent,
			ProfileDir: filepath.Join(a.f.dataDir, "browser_profile"),
			Window:     a.f.browser,
		})
		if err != nil {
			return err
		}
		a.browser = b
	}
	for _, sc := range a.cfg.Sources {
		if !sc.IsEnabled() {
			continue
		}
		mk, ok := registry[sc.Code]
		if !ok {
			return fmt.Errorf("sources.yaml: неизвестный источник %q", sc.Code)
		}
		opt := httpx.Options{UserAgent: a.cfg.UserAgent, PauseMin: a.cfg.Pause.Min, PauseMax: a.cfg.Pause.Max}
		if a.browser != nil && (a.f.browser || sc.Render == "browser") {
			opt.Render = a.browser.Tab()
		}
		get := httpx.New(opt)
		a.sites = append(a.sites, &site{code: sc.Code, cfg: sc, src: mk(get), get: get})
	}
	if len(a.sites) == 0 {
		return errors.New("sources.yaml: нет включённых источников")
	}
	return nil
}

func (a *app) closeBrowser() {
	if a.browser != nil {
		a.browser.Close()
	}
}

// eachSite выполняет этап для каждого сайта, который ещё не остановлен в этом запуске.
// Обычный запуск — сайты по очереди; первый сбор — параллельно, по одному потоку на сайт.
func (a *app) eachSite(ctx context.Context, fn func(*site) error) {
	var wg sync.WaitGroup
	for _, s := range a.sites {
		if s.stopErr != nil || ctx.Err() != nil {
			continue
		}
		if until, ok := a.st.Suspended(s.code); ok {
			s.stopErr = fmt.Errorf("сайт блокировал сбор %d запуска подряд, пропускаем до %s",
				data.BlocksToSuspend, until.Format(time.RFC3339))
			a.log.Warn("сайт пропущен", "source", s.code, "until", until.Format(time.RFC3339))
			continue
		}
		s.attempted = true
		do := func() {
			if err := fn(s); err != nil && ctx.Err() == nil {
				a.siteMu.Lock()
				s.stopErr = err
				a.siteMu.Unlock()
				a.log.Warn("сбор сайта остановлен", "source", s.code, "reason", reason(err))
			}
		}
		if a.bootstrap {
			wg.Go(do)
		} else {
			do()
		}
	}
	wg.Wait()
}

func reason(err error) string {
	switch {
	case errors.Is(err, httpx.ErrBlocked):
		return "blocked"
	case errors.Is(err, httpx.ErrRateLimited):
		return "rate_limited"
	case errors.Is(err, httpx.ErrDisallowed):
		return "robots"
	}
	return "error"
}

func (a *app) stageLinks(ctx context.Context) {
	a.eachSite(ctx, func(s *site) error {
		stats, err := links.Run(ctx, a.st, s.src, a.cfg.Queries(s.cfg, a.bootstrap), a.bootstrap, a.log)
		a.siteMu.Lock()
		s.errors += stats.Errors + stats.Disallowed
		a.siteMu.Unlock()
		return err
	})
}

func (a *app) stageFetch(ctx context.Context) {
	opt := fetch.Options{Limit: fetch.NewLimit(a.f.limit), RetryFailed: a.f.retryFailed}
	if a.f.refetch {
		d, err := parseSince(a.f.since)
		if err != nil {
			a.log.Error("-since", "err", err)
			return
		}
		t := time.Now().Add(-d)
		opt.Refetch = &t
	}
	if a.bootstrap {
		opt.Every = 500 // при первом сборе лента наполняется по ходу
		opt.OnEvery = func(ctx context.Context) error {
			if err := a.tagAndPush(ctx); err != nil {
				a.log.Warn("промежуточная отправка не удалась, повторим в конце", "err", err)
			}
			return nil
		}
	}
	a.eachSite(ctx, func(s *site) error {
		stats, err := fetch.Run(ctx, a.st, s.src, s.get, opt, a.log)
		a.siteMu.Lock()
		s.fetched += stats.Created + stats.Updated + stats.Unchanged
		s.errors += stats.Errors + stats.Failed
		a.siteMu.Unlock()
		return err
	})
}

// tagAndPush размечает и отправляет. Если ml недоступен, вакансии уходят без тегов,
// а теги появятся при следующем запуске. Ошибка — только ошибка отправки.
func (a *app) tagAndPush(ctx context.Context) error {
	a.tagPushMu.Lock()
	defer a.tagPushMu.Unlock()
	if _, err := tag.Run(ctx, a.st, tag.NewClient(a.cfg.LayaURL), a.log); err != nil {
		a.log.Warn("разметка не удалась, вакансии уйдут без тегов", "err", err)
	}
	_, err := push.Push(ctx, a.st, push.NewClient(a.cfg.PodborURL, a.cfg.ImportToken), a.runReport(), a.log)
	if err != nil {
		return fmt.Errorf("отправка: %w", err)
	}
	return nil
}

func (a *app) runReport() *push.Run {
	a.siteMu.Lock()
	defer a.siteMu.Unlock()
	r := &push.Run{StartedAt: a.start}
	for _, s := range a.sites {
		sr := push.SourceRun{Source: s.code, Status: s.status(), Fetched: s.fetched, Errors: s.errors}
		if s.stopErr != nil {
			sr.Error = reason(s.stopErr)
		}
		r.Sources = append(r.Sources, sr)
	}
	return r
}

// collected записывает итог по сайтам и решает код выхода: ошибка, только если не собрался ни один сайт.
func (a *app) collected(ctx context.Context) error {
	if ctx.Err() != nil {
		return ctx.Err()
	}
	ok := 0
	for _, s := range a.sites {
		if s.attempted {
			r := ""
			if s.stopErr != nil {
				r = reason(s.stopErr)
			}
			if err := a.st.SiteResult(s.code, s.blocked(), r); err != nil {
				return err
			}
		}
		if s.status() != "failed" {
			ok++
		}
		a.log.Info("итог сайта", "source", s.code, "status", s.status(), "fetched", s.fetched, "errors", s.errors)
	}
	if ok == 0 {
		return errors.New("не собрался ни один сайт")
	}
	return nil
}

// parseSince понимает 7d и обычные длительности Go (36h).
func parseSince(s string) (time.Duration, error) {
	if n, ok := strings.CutSuffix(s, "d"); ok {
		d, err := strconv.Atoi(n)
		if err != nil || d < 0 {
			return 0, fmt.Errorf("не понял срок %q", s)
		}
		return time.Duration(d) * 24 * time.Hour, nil
	}
	return time.ParseDuration(s)
}
