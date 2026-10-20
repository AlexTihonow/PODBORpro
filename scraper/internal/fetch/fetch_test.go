package fetch

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/AlexTihonow/PODBORpro/scraper/internal/data"
	"github.com/AlexTihonow/PODBORpro/scraper/internal/httpx"
	"github.com/AlexTihonow/PODBORpro/scraper/internal/sources"
)

var quiet = slog.New(slog.NewTextHandler(io.Discard, nil))

// fakeSource разбирает страницы вида "title|description"; "broken" не разбирается, "gone" — снятая.
type fakeSource struct{}

func (fakeSource) Code() string { return "fake" }
func (fakeSource) ListLinks(context.Context, sources.Query, map[string]bool) ([]sources.Link, error) {
	return nil, nil
}
func (fakeSource) Parse(b []byte, l sources.Link) (sources.Vacancy, error) {
	title, desc, ok := strings.Cut(string(b), "|")
	if !ok {
		return sources.Vacancy{}, errors.New("другая вёрстка")
	}
	v := sources.Vacancy{Source: "fake", ExternalID: l.ExternalID, URL: l.URL, Title: title, Description: desc}
	v.ContentHash = v.Hash()
	return v, nil
}
func (fakeSource) IsGone(status int, b []byte) bool { return status == 404 || string(b) == "gone" }

// fakeSite отдаёт страницы по адресу; err — ошибка на этом адресе.
type fakeSite struct {
	pages map[string]string
	errs  map[string]error
	got   []string
}

func (f *fakeSite) Get(_ context.Context, url string) (httpx.Response, error) {
	f.got = append(f.got, url)
	if err := f.errs[url]; err != nil {
		return httpx.Response{}, err
	}
	p, ok := f.pages[url]
	if !ok {
		return httpx.Response{Status: 404}, nil
	}
	return httpx.Response{Status: 200, Body: []byte(p), URL: url}, nil
}
func (f *fakeSite) Allowed(context.Context, string) bool { return true }

func link(id string) sources.Link {
	return sources.Link{Source: "fake", ExternalID: id, URL: "https://fake/" + id, FoundAt: time.Now().UTC()}
}

func setup(t *testing.T, ids ...string) *data.Store {
	t.Helper()
	st, err := data.Open(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	var ls []sources.Link
	for _, id := range ids {
		ls = append(ls, link(id))
	}
	if _, err := st.AddLinks(ls); err != nil {
		t.Fatal(err)
	}
	return st
}

func htmlFiles(t *testing.T, dir string) []string {
	t.Helper()
	var out []string
	entries, _ := os.ReadDir(dir)
	for _, e := range entries {
		if !e.IsDir() {
			out = append(out, e.Name())
		}
	}
	return out
}

func TestFetchParsesAndDeletesHTML(t *testing.T) {
	st := setup(t, "1", "2", "3", "4")
	site := &fakeSite{pages: map[string]string{
		"https://fake/1": "Go-разработчик|Пишем на Go",
		"https://fake/2": "broken",
		"https://fake/3": "gone",
		// 4 — 404
	}}
	s, err := Run(context.Background(), st, fakeSource{}, site, Options{}, quiet)
	if err != nil {
		t.Fatal(err)
	}
	if s.Created != 1 || s.Failed != 1 || s.Gone != 2 {
		t.Errorf("итог %+v", s)
	}
	if left := htmlFiles(t, st.HTMLDir()); len(left) != 0 {
		t.Errorf("в data/html/ остались файлы: %v", left)
	}
	if failed := htmlFiles(t, st.FailedDir()); len(failed) != 1 || failed[0] != "fake-2.html" {
		t.Errorf("в failed/ ждали fake-2.html, а там %v", failed)
	}
	if _, ok := st.Link("fake:3"); ok {
		t.Error("снятая вакансия (200 со страницей архива) осталась в links.json")
	}
	if _, ok := st.Link("fake:4"); ok {
		t.Error("404 при скачивании — ссылка должна удалиться")
	}
	if l, _ := st.Link("fake:1"); l.FetchedAt == nil {
		t.Error("fetched_at не поставлен")
	}

	// Повторный запуск не скачивает уже скачанное и неразобранное.
	site.got = nil
	if _, err := Run(context.Background(), st, fakeSource{}, site, Options{}, quiet); err != nil {
		t.Fatal(err)
	}
	if len(site.got) != 0 {
		t.Errorf("повторный запуск снова скачал %v", site.got)
	}

	// После исправления селекторов -retry-failed разбирает failed/ и удаляет удачные.
	if err := os.WriteFile(st.FailedPath(link("2")), []byte("QA|Тестируем"), 0o644); err != nil {
		t.Fatal(err)
	}
	s, err = Run(context.Background(), st, fakeSource{}, site, Options{RetryFailed: true}, quiet)
	if err != nil || s.Created != 1 {
		t.Fatalf("retry-failed: %+v %v", s, err)
	}
	if failed := htmlFiles(t, st.FailedDir()); len(failed) != 0 {
		t.Errorf("удачно разобранная страница осталась в failed/: %v", failed)
	}
}

func TestFetchResumesFromDisk(t *testing.T) {
	st := setup(t, "1")
	// Прошлый запуск упал после скачивания, до разбора.
	if err := os.MkdirAll(st.HTMLDir(), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(st.HTMLPath(link("1")), []byte("С диска|Описание"), 0o644); err != nil {
		t.Fatal(err)
	}
	site := &fakeSite{}
	s, err := Run(context.Background(), st, fakeSource{}, site, Options{}, quiet)
	if err != nil || s.FromDisk != 1 || s.Created != 1 || len(site.got) != 0 {
		t.Fatalf("итог %+v, запросы %v, ошибка %v", s, site.got, err)
	}
	if _, err := os.Stat(st.HTMLPath(link("1"))); !errors.Is(err, os.ErrNotExist) {
		t.Error("разобранный HTML не удалён")
	}
}

func TestFetchStopsOnBlock(t *testing.T) {
	st := setup(t, "1", "2", "3")
	site := &fakeSite{
		pages: map[string]string{"https://fake/1": "A|a", "https://fake/3": "C|c"},
		errs:  map[string]error{"https://fake/2": httpx.ErrBlocked},
	}
	s, err := Run(context.Background(), st, fakeSource{}, site, Options{}, quiet)
	if !errors.Is(err, httpx.ErrBlocked) {
		t.Fatalf("ждали ErrBlocked, получили %v", err)
	}
	if s.Created != 1 || len(site.got) != 2 {
		t.Errorf("после блокировки обход должен остановиться: %+v, запросы %v", s, site.got)
	}
	if vs := st.Vacancies(nil); len(vs) != 1 {
		t.Errorf("уже скачанное должно сохраниться: %d", len(vs))
	}
}

func TestFetchLimitAndRefetch(t *testing.T) {
	st := setup(t, "1", "2", "3")
	site := &fakeSite{pages: map[string]string{"https://fake/1": "A|a", "https://fake/2": "B|b", "https://fake/3": "C|c"}}
	s, err := Run(context.Background(), st, fakeSource{}, site, Options{Limit: NewLimit(2)}, quiet)
	if err != nil || s.Downloaded != 2 {
		t.Fatalf("-limit 2: %+v %v", s, err)
	}
	if _, err := Run(context.Background(), st, fakeSource{}, site, Options{}, quiet); err != nil {
		t.Fatal(err)
	}
	site.pages["https://fake/1"] = "A|новое описание"
	since := time.Now().Add(-time.Hour)
	s, err = Run(context.Background(), st, fakeSource{}, site, Options{Refetch: &since}, quiet)
	if err != nil || s.Downloaded != 3 || s.Updated != 1 || s.Unchanged != 2 {
		t.Fatalf("-refetch: %+v %v", s, err)
	}
}

func TestCleanFailedOlderThanWeek(t *testing.T) {
	st := setup(t)
	old := filepath.Join(st.FailedDir(), "fake-old.html")
	fresh := filepath.Join(st.FailedDir(), "fake-new.html")
	for _, p := range []string{old, fresh} {
		if err := os.WriteFile(p, []byte("x"), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	week := time.Now().Add(-8 * 24 * time.Hour)
	if err := os.Chtimes(old, week, week); err != nil {
		t.Fatal(err)
	}
	if _, err := Run(context.Background(), st, fakeSource{}, &fakeSite{}, Options{}, quiet); err != nil {
		t.Fatal(err)
	}
	if left := htmlFiles(t, st.FailedDir()); len(left) != 1 || left[0] != "fake-new.html" {
		t.Errorf("в failed/ осталось %v", left)
	}
}
