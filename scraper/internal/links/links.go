// Package links — этап 1: обходит страницы выдачи и собирает в data/links.json только ссылки.
package links

import (
	"context"
	"errors"
	"log/slog"
	"time"

	"github.com/AlexTihonow/PODBORpro/scraper/internal/data"
	"github.com/AlexTihonow/PODBORpro/scraper/internal/httpx"
	"github.com/AlexTihonow/PODBORpro/scraper/internal/sources"
)

// MaxAge — ссылки старше этого без fetched_at удаляются: вакансию, скорее всего, сняли.
const MaxAge = 30 * 24 * time.Hour

type Stats struct {
	Queries    int
	Found      int
	Added      int
	Pruned     int
	Disallowed int
	Errors     int
}

// Run обходит запросы одного источника. Ошибка — только та, что останавливает сбор сайта
// (проверка «не робот», 403, 429); остальные пишутся в errors.json, и обход идёт дальше.
// bootstrap — первый сбор: уже известные ссылки обход не останавливают.
func Run(ctx context.Context, st *data.Store, src sources.Source, queries []sources.Query, bootstrap bool, log *slog.Logger) (Stats, error) {
	var s Stats
	n, err := st.PruneLinks(MaxAge)
	if err != nil {
		return s, err
	}
	s.Pruned = n
	for _, q := range queries {
		if ctx.Err() != nil {
			return s, ctx.Err()
		}
		var known map[string]bool
		if !bootstrap {
			known = st.KnownLinks(src.Code())
		}
		found, err := src.ListLinks(ctx, q, known)
		s.Queries++
		s.Found += len(found)
		added, serr := st.AddLinks(found) // что успели найти до ошибки — сохраняем
		s.Added += added
		if serr != nil {
			return s, serr
		}
		switch {
		case err == nil:
		case errors.Is(err, httpx.ErrBlocked), errors.Is(err, httpx.ErrRateLimited), ctx.Err() != nil:
			st.AddError("links", src.Code(), q.URL, err)
			return s, err
		case errors.Is(err, httpx.ErrDisallowed):
			s.Disallowed++
			st.AddError("links", src.Code(), q.URL, err)
		default:
			s.Errors++
			st.AddError("links", src.Code(), q.URL, err)
		}
	}
	log.Info("ссылки", "source", src.Code(), "queries", s.Queries, "found", s.Found, "added", s.Added,
		"pruned", s.Pruned, "disallowed", s.Disallowed, "errors", s.Errors)
	return s, nil
}
