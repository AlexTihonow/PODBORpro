package links

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"testing"
	"time"

	"github.com/AlexTihonow/PODBORpro/scraper/internal/data"
	"github.com/AlexTihonow/PODBORpro/scraper/internal/httpx"
	"github.com/AlexTihonow/PODBORpro/scraper/internal/sources"
)

var quiet = slog.New(slog.NewTextHandler(io.Discard, nil))

type fakeSource struct {
	byQuery map[string][]string
	errs    map[string]error
	known   []map[string]bool
}

func (f *fakeSource) Code() string { return "fake" }
func (f *fakeSource) ListLinks(_ context.Context, q sources.Query, known map[string]bool) ([]sources.Link, error) {
	f.known = append(f.known, known)
	var out []sources.Link
	for _, id := range f.byQuery[q.URL] {
		out = append(out, sources.Link{Source: "fake", ExternalID: id, URL: "https://fake/" + id})
	}
	return out, f.errs[q.URL]
}
func (f *fakeSource) Parse([]byte, sources.Link) (sources.Vacancy, error) {
	return sources.Vacancy{}, nil
}
func (f *fakeSource) IsGone(int, []byte) bool { return false }

func TestLinksAppendAndPrune(t *testing.T) {
	st, err := data.Open(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	old := time.Now().Add(-31 * 24 * time.Hour)
	if _, err := st.AddLinks([]sources.Link{{Source: "fake", ExternalID: "old", URL: "https://fake/old", FoundAt: old}}); err != nil {
		t.Fatal(err)
	}
	src := &fakeSource{byQuery: map[string][]string{"q1": {"1", "2"}, "q2": {"2", "3"}}}
	qs := []sources.Query{{URL: "q1"}, {URL: "q2"}}
	s, err := Run(context.Background(), st, src, qs, false, quiet)
	if err != nil {
		t.Fatal(err)
	}
	if s.Added != 3 || s.Pruned != 1 {
		t.Errorf("итог %+v: ждали 3 новых и 1 удалённую старую", s)
	}
	if _, ok := st.Link("fake:old"); ok {
		t.Error("ссылка старше 30 дней без fetched_at не удалена")
	}
	if !src.known[1]["https://fake/2"] {
		t.Error("второму запросу не передали ссылки, найденные первым")
	}

	// Первый сбор: известные ссылки обход не останавливают.
	src.known = nil
	if _, err := Run(context.Background(), st, src, qs, true, quiet); err != nil {
		t.Fatal(err)
	}
	if src.known[0] != nil {
		t.Error("при bootstrap known должен быть nil")
	}
}

func TestLinksStopsOnBlockKeepsFound(t *testing.T) {
	st, _ := data.Open(t.TempDir())
	src := &fakeSource{
		byQuery: map[string][]string{"q1": {"1"}, "q2": {"2"}},
		errs:    map[string]error{"q1": httpx.ErrDisallowed, "q2": httpx.ErrBlocked},
	}
	s, err := Run(context.Background(), st, src, []sources.Query{{URL: "q1"}, {URL: "q2"}, {URL: "q3"}}, false, quiet)
	if !errors.Is(err, httpx.ErrBlocked) {
		t.Fatalf("ждали ErrBlocked, получили %v", err)
	}
	if s.Added != 2 || s.Disallowed != 1 || len(src.known) != 2 {
		t.Errorf("итог %+v, запросов %d", s, len(src.known))
	}
}

func TestSiteSuspendedAfterThreeBlocks(t *testing.T) {
	st, _ := data.Open(t.TempDir())
	for i := range data.BlocksToSuspend {
		if _, ok := st.Suspended("fake"); ok {
			t.Fatalf("сайт приостановлен уже после %d блокировок", i)
		}
		if err := st.SiteResult("fake", true, "blocked"); err != nil {
			t.Fatal(err)
		}
	}
	if _, ok := st.Suspended("fake"); !ok {
		t.Fatal("после трёх блокировок подряд сайт должен пропускаться сутки")
	}
	st.Now = func() time.Time { return time.Now().Add(25 * time.Hour) }
	if _, ok := st.Suspended("fake"); ok {
		t.Error("через сутки сайт снова собираем")
	}
}
