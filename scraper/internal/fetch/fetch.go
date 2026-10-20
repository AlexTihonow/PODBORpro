// Package fetch — этап 2: скачивает страницы вакансий и разбирает их в data/vacancies.json.
//
// Порядок для каждой вакансии:
//  1. скачать страницу в data/html/<source>-<external_id>.html;
//  2. разобрать её;
//  3. записать вакансию в vacancies.json (атомарно);
//  4. только после этого удалить HTML-файл и поставить fetched_at в links.json.
//
// Если программа упала между шагами 1 и 4, файл остаётся, и следующий запуск разберёт его
// с диска, не скачивая заново. Неразобранная страница переносится в data/html/failed/.
package fetch

import (
	"context"
	"errors"
	"fmt"
	"io/fs"
	"log/slog"
	"net/http"
	"os"
	"sync/atomic"
	"time"

	"github.com/AlexTihonow/PODBORpro/scraper/internal/data"
	"github.com/AlexTihonow/PODBORpro/scraper/internal/httpx"
	"github.com/AlexTihonow/PODBORpro/scraper/internal/sources"
)

// FailedMaxAge — сколько хранятся неразобранные страницы в data/html/failed/.
const FailedMaxAge = 7 * 24 * time.Hour

type Options struct {
	// Limit — общий на все сайты счётчик скачанных страниц; nil — без ограничения.
	Limit *Limit
	// RetryFailed — заново разобрать страницы из data/html/failed/.
	RetryFailed bool
	// Refetch — скачать заново вакансии, скачанные после этого времени.
	Refetch *time.Time
	// Every и OnEvery — при первом сборе после каждых Every разобранных вакансий вызывается OnEvery
	// (разметка и отправка), чтобы лента наполнялась по ходу.
	Every   int
	OnEvery func(ctx context.Context) error
}

// Limit — «не больше N страниц» на весь запуск.
type Limit struct{ left atomic.Int64 }

func NewLimit(n int) *Limit {
	if n <= 0 {
		return nil
	}
	l := &Limit{}
	l.left.Store(int64(n))
	return l
}

func (l *Limit) take() bool { return l == nil || l.left.Add(-1) >= 0 }

type Stats struct {
	Downloaded int
	FromDisk   int
	Created    int
	Updated    int
	Unchanged  int
	Gone       int
	Failed     int
	Errors     int
}

// Run скачивает и разбирает вакансии одного источника. Ошибка — только та, что останавливает
// сбор сайта (проверка «не робот», 403, 429) или запись на диск; уже скачанное сохраняется.
func Run(ctx context.Context, st *data.Store, src sources.Source, get sources.Getter, opt Options, log *slog.Logger) (Stats, error) {
	f := &fetcher{st: st, src: src, get: get, opt: opt}
	err := f.run(ctx)
	s := f.stats
	log.Info("страницы", "source", src.Code(), "downloaded", s.Downloaded, "from_disk", s.FromDisk,
		"created", s.Created, "updated", s.Updated, "unchanged", s.Unchanged, "gone", s.Gone,
		"failed", s.Failed, "errors", s.Errors)
	return s, err
}

type fetcher struct {
	st     *data.Store
	src    sources.Source
	get    sources.Getter
	opt    Options
	stats  Stats
	parsed int
}

func (f *fetcher) run(ctx context.Context) error {
	if _, err := f.st.CleanFailed(FailedMaxAge); err != nil {
		return err
	}
	if f.opt.Refetch != nil {
		if _, err := f.st.Refetch(f.src.Code(), *f.opt.Refetch); err != nil {
			return err
		}
	}
	if f.opt.RetryFailed {
		if err := f.retryFailed(ctx); err != nil {
			return err
		}
	}
	for _, l := range f.st.Pending(f.src.Code()) {
		if ctx.Err() != nil {
			return ctx.Err()
		}
		if err := f.one(ctx, l); err != nil {
			return err
		}
	}
	return nil
}

func (f *fetcher) one(ctx context.Context, l sources.Link) error {
	path := f.st.HTMLPath(l)
	body, err := os.ReadFile(path)
	switch {
	case err == nil:
		f.stats.FromDisk++ // осталось с прошлого запуска, который упал до удаления
	case errors.Is(err, fs.ErrNotExist):
		if !f.opt.Limit.take() {
			return nil
		}
		var done bool
		if body, done, err = f.download(ctx, l); err != nil || done {
			return err
		}
		if err := os.MkdirAll(f.st.HTMLDir(), 0o755); err != nil {
			return err
		}
		if err := os.WriteFile(path, body, 0o644); err != nil {
			return err
		}
	default:
		return err
	}
	return f.parse(ctx, l, path, body)
}

// download скачивает страницу. done — со ссылкой всё решено (снята, ошибка записана), разбирать нечего.
func (f *fetcher) download(ctx context.Context, l sources.Link) (body []byte, done bool, err error) {
	resp, err := f.get.Get(ctx, l.URL)
	switch {
	case err == nil:
	case errors.Is(err, httpx.ErrBlocked), errors.Is(err, httpx.ErrRateLimited), ctx.Err() != nil:
		f.st.AddError("fetch", l.Source, l.URL, err)
		return nil, true, err
	case errors.Is(err, httpx.ErrDisallowed):
		f.stats.Errors++
		f.st.AddError("fetch", l.Source, l.URL, err)
		return nil, true, f.st.RemoveLink(l.Key())
	default:
		f.stats.Errors++
		f.st.AddError("fetch", l.Source, l.URL, err)
		return nil, true, nil // сеть: попробуем в следующий запуск
	}
	f.stats.Downloaded++
	if f.src.IsGone(resp.Status, resp.Body) {
		f.stats.Gone++
		return nil, true, f.st.RemoveLink(l.Key()) // сняли, не успев скачать
	}
	if resp.Status != http.StatusOK {
		f.stats.Errors++
		f.st.AddError("fetch", l.Source, l.URL, fmt.Errorf("ответ %d", resp.Status))
		return nil, true, nil
	}
	return resp.Body, false, nil
}

func (f *fetcher) parse(ctx context.Context, l sources.Link, path string, body []byte) error {
	v, err := f.src.Parse(body, l)
	if err != nil {
		f.stats.Failed++
		f.st.AddError("fetch", l.Source, l.URL, fmt.Errorf("разбор: %w", err))
		if path != f.st.FailedPath(l) {
			if err := os.Rename(path, f.st.FailedPath(l)); err != nil {
				return err
			}
		}
		return f.st.MarkFailed(l.Key())
	}
	res, err := f.st.PutVacancy(v)
	if err != nil {
		return err
	}
	switch res {
	case data.Created:
		f.stats.Created++
	case data.Updated:
		f.stats.Updated++
	default:
		f.stats.Unchanged++
	}
	if err := os.Remove(path); err != nil && !errors.Is(err, fs.ErrNotExist) {
		return err
	}
	if err := f.st.MarkFetched(l.Key()); err != nil {
		return err
	}
	f.parsed++
	if f.opt.OnEvery != nil && f.opt.Every > 0 && f.parsed%f.opt.Every == 0 {
		return f.opt.OnEvery(ctx)
	}
	return nil
}

// retryFailed разбирает заново страницы из data/html/failed/ и удаляет удачные.
func (f *fetcher) retryFailed(ctx context.Context) error {
	links, err := f.st.FailedLinks(f.src.Code())
	if err != nil {
		return err
	}
	for _, l := range links {
		path := f.st.FailedPath(l)
		body, err := os.ReadFile(path)
		if err != nil {
			return err
		}
		f.stats.FromDisk++
		if err := f.parse(ctx, l, path, body); err != nil {
			return err
		}
	}
	return nil
}
