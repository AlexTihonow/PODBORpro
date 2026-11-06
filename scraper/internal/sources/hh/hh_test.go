package hh

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/AlexTihonow/PODBORpro/scraper/internal/httpx"
	"github.com/AlexTihonow/PODBORpro/scraper/internal/sources"
	st "github.com/AlexTihonow/PODBORpro/scraper/internal/sources/sourcetest"
)

func newHH(get sources.Getter) *HH {
	h := New(get)
	h.now = func() time.Time { return st.Fixed }
	return h
}

func TestParseSavedPages(t *testing.T) {
	for _, id := range []string{"137568898", "138669157"} {
		t.Run(id, func(t *testing.T) {
			_, url, _ := Canonical("https://hh.ru/vacancy/" + id)
			v, err := newHH(nil).Parse(st.Page(t, "vacancy_"+id+".html.gz"),
				sources.Link{Source: Code, ExternalID: id, URL: url})
			st.Must(t, err)
			st.Golden(t, "vacancy_"+id+".json", v)
		})
	}
}

func TestParseFields(t *testing.T) {
	v, err := newHH(nil).Parse(st.Page(t, "vacancy_138669157.html.gz"),
		sources.Link{Source: Code, ExternalID: "138669157", URL: "https://hh.ru/vacancy/138669157"})
	st.Must(t, err)
	if v.SalaryFrom == nil || *v.SalaryFrom != 250000 || v.SalaryTo == nil || *v.SalaryTo != 350000 {
		t.Errorf("зарплата: %v–%v", v.SalaryFrom, v.SalaryTo)
	}
	if v.Currency == nil || *v.Currency != "RUB" {
		t.Errorf("валюта: %v", v.Currency)
	}
	if strings.Contains(v.Description, "<") {
		t.Errorf("в описании остались теги: %.200s", v.Description)
	}

	noSalary, err := newHH(nil).Parse(st.Page(t, "vacancy_137568898.html.gz"),
		sources.Link{Source: Code, ExternalID: "137568898", URL: "https://hh.ru/vacancy/137568898"})
	st.Must(t, err)
	if noSalary.SalaryFrom != nil || noSalary.SalaryTo != nil || noSalary.Currency != nil {
		t.Errorf("зарплата не указана — должно быть null, а не %v–%v", noSalary.SalaryFrom, noSalary.SalaryTo)
	}
	if len(noSalary.SkillsRaw) != 7 || noSalary.SkillsRaw[0] != "Git" {
		t.Errorf("навыки: %v", noSalary.SkillsRaw)
	}
}

func TestParseBrokenLayout(t *testing.T) {
	_, err := newHH(nil).Parse([]byte(`<html><body><h1>Другая вёрстка</h1></body></html>`),
		sources.Link{Source: Code, ExternalID: "1", URL: "https://hh.ru/vacancy/1"})
	if err == nil {
		t.Fatal("страница без вакансии разобралась без ошибки")
	}
}

func TestCanonical(t *testing.T) {
	for in, want := range map[string]string{
		"https://hh.ru/vacancy/137568898?query=go&hhtmFrom=vacancy_search_list": "https://hh.ru/vacancy/137568898",
		"https://spb.hh.ru/vacancy/137568898/":                                  "https://hh.ru/vacancy/137568898",
		"/vacancy/137568898":                                                    "https://hh.ru/vacancy/137568898",
	} {
		if _, got, ok := Canonical(in); !ok || got != want {
			t.Errorf("Canonical(%q) = %q", in, got)
		}
	}
	if _, _, ok := Canonical("https://hh.ru/vacancies/go-razrabotchik"); ok {
		t.Error("тематическая страница — не вакансия")
	}
}

func TestListLinksLandingPage(t *testing.T) {
	const land = "https://hh.ru/vacancies/go-razrabotchik"
	site := &st.Site{T: t, Pages: map[string]string{land: "vacancies_go-razrabotchik.html.gz"},
		Disallow: func(u string) bool { return strings.Contains(u, "?") }}
	links, err := newHH(site).ListLinks(context.Background(), sources.Query{URL: land, MaxPages: 20}, map[string]bool{})
	st.Must(t, err)
	if len(links) != 50 {
		t.Fatalf("ссылок %d, ждали 50", len(links))
	}
	for _, l := range links {
		if l.Source != Code || l.URL != "https://hh.ru/vacancy/"+l.ExternalID || !l.FoundAt.Equal(st.Fixed) {
			t.Fatalf("ссылка %+v", l)
		}
	}
	if len(site.Got) != 1 {
		t.Errorf("листать ?page=1 robots.txt запрещает, а сборщик ходил: %v", site.Got)
	}
}

func TestListLinksStopsOnKnown(t *testing.T) {
	const search = "https://hh.ru/search/vacancy?text=golang&area=1&order_by=publication_time"
	site := &st.Site{T: t, Pages: map[string]string{search: "search_golang.html.gz"}}
	h := newHH(site)
	first, err := h.ListLinks(context.Background(), sources.Query{URL: search, MaxPages: 1}, map[string]bool{})
	st.Must(t, err)
	if len(first) != 20 {
		t.Fatalf("ссылок %d, ждали 20", len(first))
	}
	known := map[string]bool{}
	for _, l := range first {
		known[l.URL] = true
	}
	site.Got = nil
	again, err := h.ListLinks(context.Background(), sources.Query{URL: search, MaxPages: 3}, known)
	st.Must(t, err)
	if len(again) != 0 || len(site.Got) != 1 {
		t.Errorf("страница целиком из известных ссылок, а обход продолжился: %d новых, запросы %v", len(again), site.Got)
	}
}

func TestListLinksDisallowed(t *testing.T) {
	site := &st.Site{T: t, Disallow: func(string) bool { return true }}
	_, err := newHH(site).ListLinks(context.Background(), sources.Query{URL: "https://hh.ru/search/vacancy?text=go"}, nil)
	if err != httpx.ErrDisallowed {
		t.Fatalf("ждали ErrDisallowed, получили %v", err)
	}
}

func TestIsGone(t *testing.T) {
	h := newHH(nil)
	live := st.Page(t, "vacancy_137568898.html.gz")
	if h.IsGone(200, live) {
		t.Error("живая вакансия признана снятой")
	}
	archived := []byte(strings.Replace(string(live), "&#34;archived&#34;:false,&#34;disabled", "&#34;archived&#34;:true,&#34;disabled", 1))
	if !h.IsGone(200, archived) {
		t.Error("страница архивной вакансии (200) не признана снятой")
	}
	if !h.IsGone(404, nil) || !h.IsGone(410, nil) {
		t.Error("404/410 — вакансии нет")
	}
	for _, code := range []int{403, 429, 500, 503} {
		if h.IsGone(code, nil) {
			t.Errorf("%d — это проблема доступа, а не снятая вакансия", code)
		}
	}
	if h.IsGone(200, []byte("<html><title>Подтвердите, что вы не робот</title></html>")) {
		t.Error("страница проверки — не повод удалять вакансию")
	}
}
