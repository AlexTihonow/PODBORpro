package habr

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/AlexTihonow/PODBORpro/scraper/internal/sources"
	st "github.com/AlexTihonow/PODBORpro/scraper/internal/sources/sourcetest"
)

func newHabr(get sources.Getter) *Habr {
	h := New(get)
	h.now = func() time.Time { return st.Fixed }
	return h
}

func TestParseSavedPage(t *testing.T) {
	v, err := newHabr(nil).Parse(st.Page(t, "vacancy_1000166753.html.gz"),
		sources.Link{Source: Code, ExternalID: "1000166753", URL: "https://career.habr.com/vacancies/1000166753"})
	st.Must(t, err)
	st.Golden(t, "vacancy_1000166753.json", v)
	if v.SalaryFrom != nil || v.Currency != nil {
		t.Errorf("зарплата не указана — должно быть null")
	}
	if strings.Contains(v.Description, "<") {
		t.Errorf("в описании остались теги")
	}
}

func TestListLinks(t *testing.T) {
	const search = "https://career.habr.com/vacancies?type=all&sort=date&q=backend"
	site := &st.Site{T: t, Pages: map[string]string{search: "search_backend.html.gz"}}
	links, err := newHabr(site).ListLinks(context.Background(), sources.Query{URL: search, MaxPages: 1}, map[string]bool{})
	st.Must(t, err)
	if len(links) != 25 {
		t.Fatalf("ссылок %d, ждали 25", len(links))
	}
	if links[0].URL != "https://career.habr.com/vacancies/"+links[0].ExternalID {
		t.Errorf("ссылка %+v", links[0])
	}
}

func TestIsGone(t *testing.T) {
	h := newHabr(nil)
	live := st.Page(t, "vacancy_1000166753.html.gz")
	if h.IsGone(200, live) {
		t.Error("живая вакансия признана снятой")
	}
	archived := []byte(strings.Replace(string(live), `"archived":false`, `"archived":true`, 1))
	if string(archived) == string(live) {
		archived = []byte(strings.Replace(string(live), "&quot;archived&quot;:false", "&quot;archived&quot;:true", 1))
	}
	if !h.IsGone(200, archived) {
		t.Error("архивная вакансия не признана снятой")
	}
	if !h.IsGone(404, nil) || h.IsGone(503, nil) {
		t.Error("404 — снята, 503 — нет")
	}
}
