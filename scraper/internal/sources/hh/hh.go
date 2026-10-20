// Package hh — источник HeadHunter: ссылки из выдачи и разбор HTML-страницы вакансии.
//
// API не используется. robots.txt hh.ru запрещает ботам адреса с параметрами (Disallow: *?*),
// поэтому обычная выдача /search/vacancy?text=... недоступна, как и листание ?page=1.
// Доступны тематические страницы без параметров (https://hh.ru/vacancies/go-razrabotchik,
// 50 вакансий на странице) и карты сайта (https://hh.ru/sitemap/vacancies0.xml) со списком таких страниц.
//
// Видимые поля берутся по data-qa. Зарплата, дата публикации и признак архива — из состояния
// страницы (<template id="HH-Lux-InitialState">): там они уже разложены по полям.
package hh

import (
	"bytes"
	"context"
	"encoding/json"
	"encoding/xml"
	"errors"
	"fmt"
	"html"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/PuerkitoBio/goquery"

	"github.com/AlexTihonow/PODBORpro/scraper/internal/sources"
)

const Code = "headhunter"

type HH struct {
	get sources.Getter
	now func() time.Time
}

func New(get sources.Getter) *HH { return &HH{get: get, now: time.Now} }

func (*HH) Code() string { return Code }

var vacancyIDRe = regexp.MustCompile(`/vacancy/(\d+)`)

// Canonical приводит ссылку на вакансию к виду https://hh.ru/vacancy/<номер>:
// без параметров отслеживания, поддомена города и «/» в конце.
func Canonical(href string) (id, url string, ok bool) {
	m := vacancyIDRe.FindStringSubmatch(href)
	if m == nil {
		return "", "", false
	}
	return m[1], "https://hh.ru/vacancy/" + m[1], true
}

func (h *HH) ListLinks(ctx context.Context, q sources.Query, known map[string]bool) ([]sources.Link, error) {
	if strings.HasSuffix(q.URL, ".xml") {
		return h.fromSitemap(ctx, q, known, 0)
	}
	return h.fromPages(ctx, q.URL, q.MaxPages, known)
}

// fromPages листает выдачу, пока есть следующая страница, разрешённая robots.txt.
func (h *HH) fromPages(ctx context.Context, url string, maxPages int, known map[string]bool) ([]sources.Link, error) {
	var out []sources.Link
	seen := map[string]bool{}
	for page := 0; url != "" && (maxPages == 0 || page < maxPages); page++ {
		resp, err := h.get.Get(ctx, url)
		if err != nil {
			return out, err
		}
		if resp.Status != http.StatusOK {
			return out, fmt.Errorf("выдача: ответ %d", resp.Status)
		}
		links, next, err := parseSerp(resp.Body, resp.URL)
		if err != nil {
			return out, err
		}
		allKnown := true
		for _, l := range links {
			if seen[l.ExternalID] {
				continue
			}
			seen[l.ExternalID] = true
			if !known[l.URL] {
				allKnown = false
				l.FoundAt = h.now().UTC()
				out = append(out, l)
			}
		}
		if len(links) == 0 || (allKnown && known != nil) {
			break
		}
		url = ""
		if next != "" && h.get.Allowed(ctx, next) {
			url = next
		}
	}
	return out, nil
}

func parseSerp(body []byte, base string) (links []sources.Link, next string, err error) {
	doc, err := goquery.NewDocumentFromReader(bytes.NewReader(body))
	if err != nil {
		return nil, "", err
	}
	sel := doc.Find(`[data-qa="serp-item__title"]`)
	if sel.Length() == 0 {
		sel = doc.Find(`[data-qa="vacancy-serp__vacancy"] a[href*="/vacancy/"]`)
	}
	sel.Each(func(_ int, s *goquery.Selection) {
		a := s
		if goquery.NodeName(s) != "a" {
			a = s.Find("a[href]").First()
		}
		href, _ := a.Attr("href")
		if id, u, ok := Canonical(href); ok {
			links = append(links, sources.Link{Source: Code, ExternalID: id, URL: u})
		}
	})
	if href, ok := doc.Find(`a[data-qa="pager-next"]`).Attr("href"); ok {
		next = sources.Resolve(base, href)
	}
	return links, next, nil
}

type sitemapDoc struct {
	XMLName  xml.Name
	Sitemaps []struct {
		Loc string `xml:"loc"`
	} `xml:"sitemap"`
	URLs []struct {
		Loc string `xml:"loc"`
	} `xml:"url"`
}

// fromSitemap берёт из карты сайта ссылки на вакансии и тематические страницы, в адресе
// которых есть слово из q.Match, и с каждой тематической страницы — её вакансии.
func (h *HH) fromSitemap(ctx context.Context, q sources.Query, known map[string]bool, depth int) ([]sources.Link, error) {
	resp, err := h.get.Get(ctx, q.URL)
	if err != nil {
		return nil, err
	}
	if resp.Status != http.StatusOK {
		return nil, fmt.Errorf("карта сайта: ответ %d", resp.Status)
	}
	var sm sitemapDoc
	if err := xml.Unmarshal(resp.Body, &sm); err != nil {
		return nil, fmt.Errorf("карта сайта: %w", err)
	}
	var out []sources.Link
	if depth == 0 {
		for _, s := range sm.Sitemaps {
			want := "vacanc" // без Match — карты со ссылками на сами вакансии
			if len(q.Match) > 0 {
				want = "/vacancies" // с Match — только карты тематических страниц
			}
			if !strings.Contains(s.Loc, want) {
				continue
			}
			links, err := h.fromSitemap(ctx, sources.Query{URL: s.Loc, MaxPages: q.MaxPages, Match: q.Match}, known, 1)
			out = append(out, links...)
			if err != nil {
				return out, err
			}
		}
	}
	for _, u := range sm.URLs {
		if id, cu, ok := Canonical(u.Loc); ok {
			if len(q.Match) == 0 && !known[cu] {
				out = append(out, sources.Link{Source: Code, ExternalID: id, URL: cu, FoundAt: h.now().UTC()})
			}
			continue
		}
		if len(q.Match) == 0 || !matches(u.Loc, q.Match) || !strings.Contains(u.Loc, "/vacancies/") {
			continue
		}
		links, err := h.fromPages(ctx, u.Loc, q.MaxPages, known)
		out = append(out, links...)
		if err != nil {
			return out, err
		}
	}
	return out, nil
}

func matches(s string, words []string) bool {
	s = strings.ToLower(s)
	for _, w := range words {
		if strings.Contains(s, strings.ToLower(w)) {
			return true
		}
	}
	return false
}

// state — нужная часть <template id="HH-Lux-InitialState">.
type state struct {
	ErrorCode   any `json:"errorCode"`
	VacancyView struct {
		VacancyFull struct {
			Vacancy *stateVacancy `json:"vacancy"`
		} `json:"vacancyFull"`
	} `json:"vacancyView"`
}

type stateVacancy struct {
	VacancyID int64  `json:"vacancyId"`
	Name      string `json:"name"`
	Status    struct {
		Archived bool `json:"archived"`
		Disabled bool `json:"disabled"`
	} `json:"status"`
	Company struct {
		Name string `json:"name"`
	} `json:"company"`
	Area struct {
		Name string `json:"name"`
	} `json:"area"`
	Compensation struct {
		From         *int64 `json:"from"`
		To           *int64 `json:"to"`
		CurrencyCode string `json:"currencyCode"`
	} `json:"compensation"`
	PublicationTimeIso string   `json:"publicationTimeIso"`
	KeySkills          []string `json:"keySkills"`
	Description        string   `json:"description"`
}

var stateRe = regexp.MustCompile(`(?s)<template[^>]*id="HH-Lux-InitialState"[^>]*>(.*?)</template>`)

func parseState(body []byte) (*state, error) {
	m := stateRe.FindSubmatch(body)
	if m == nil {
		return nil, errors.New("нет HH-Lux-InitialState")
	}
	var st state
	if err := json.Unmarshal([]byte(html.UnescapeString(string(m[1]))), &st); err != nil {
		return nil, fmt.Errorf("HH-Lux-InitialState: %w", err)
	}
	return &st, nil
}

func (h *HH) Parse(body []byte, link sources.Link) (sources.Vacancy, error) {
	doc, err := goquery.NewDocumentFromReader(bytes.NewReader(body))
	if err != nil {
		return sources.Vacancy{}, err
	}
	var sv stateVacancy
	if st, err := parseState(body); err == nil && st.VacancyView.VacancyFull.Vacancy != nil {
		sv = *st.VacancyView.VacancyFull.Vacancy
	}

	v := sources.Vacancy{
		Source:     Code,
		ExternalID: link.ExternalID,
		URL:        link.URL,
		Title:      first(sources.Line(doc.Find(`[data-qa="vacancy-title"]`).First()), sv.Name),
		Company:    first(sources.Line(doc.Find(`[data-qa="vacancy-company-name"]`).First()), sv.Company.Name),
		City:       first(sv.Area.Name, city(doc)),
		Experience: first(
			strip(sources.Line(doc.Find(`[data-qa="work-experience-text"]`).First()), "Опыт работы:"),
			sources.Line(doc.Find(`[data-qa="vacancy-experience"]`).First())),
		Employment: strings.ToLower(sources.Line(doc.Find(`[data-qa="common-employment-text"]`).First())),
		WorkFormatRaw: strip(sources.Line(doc.Find(`[data-qa="work-formats-text"]`).First()),
			"Формат работы:"),
		Description: sources.Text(doc.Find(`[data-qa="vacancy-description"]`).First()),
		FetchedAt:   h.now().UTC(),
	}
	if v.Description == "" && sv.Description != "" {
		d, err := goquery.NewDocumentFromReader(strings.NewReader(sv.Description))
		if err == nil {
			v.Description = sources.Text(d.Selection)
		}
	}
	var skills []string
	doc.Find(`[data-qa="skills-element"]`).Each(func(_ int, s *goquery.Selection) {
		skills = append(skills, sources.Line(s))
	})
	if len(skills) == 0 {
		skills = sv.KeySkills
	}
	v.SkillsRaw = sources.Dedup(skills)

	c := sv.Compensation
	if c.From != nil || c.To != nil {
		v.SalaryFrom, v.SalaryTo = c.From, c.To
		cur := c.CurrencyCode
		if cur == "RUR" {
			cur = "RUB"
		}
		if cur != "" {
			v.Currency = &cur
		}
	}
	v.PublishedAt = published(sv.PublicationTimeIso, body)

	switch {
	case v.ExternalID == "":
		return v, errors.New("нет номера вакансии")
	case v.Title == "":
		return v, errors.New(`не нашёл заголовок ([data-qa="vacancy-title"])`)
	case v.Description == "":
		return v, errors.New(`не нашёл описание ([data-qa="vacancy-description"])`)
	}
	v.ContentHash = v.Hash()
	return v, nil
}

// IsGone: 404 и 410 — вакансии нет; 200 со страницей архивной или скрытой вакансии — тоже.
func (h *HH) IsGone(status int, body []byte) bool {
	if status == http.StatusNotFound || status == http.StatusGone {
		return true
	}
	if status != http.StatusOK {
		return false
	}
	st, err := parseState(body)
	if err != nil {
		return false // неизвестная страница — не повод удалять вакансию
	}
	if code, ok := st.ErrorCode.(float64); ok && (code == 404 || code == 410) {
		return true
	}
	if sv := st.VacancyView.VacancyFull.Vacancy; sv != nil {
		return sv.Status.Archived || sv.Status.Disabled
	}
	return false
}

func city(doc *goquery.Document) string {
	for _, q := range []string{`[data-qa="vacancy-view-location"]`, `[data-qa="vacancy-view-raw-address"]`} {
		if s := sources.Line(doc.Find(q).First()); s != "" {
			c, _, _ := strings.Cut(s, ",")
			return strings.TrimSpace(c)
		}
	}
	return ""
}

var ldRe = regexp.MustCompile(`(?s)<script[^>]*application/ld\+json[^>]*>(.*?)</script>`)

func published(iso string, body []byte) time.Time {
	if t, ok := parseTime(iso); ok {
		return t
	}
	for _, m := range ldRe.FindAllSubmatch(body, -1) {
		var ld struct {
			Type       string `json:"@type"`
			DatePosted string `json:"datePosted"`
		}
		if json.Unmarshal(m[1], &ld) == nil && ld.Type == "JobPosting" {
			if t, ok := parseTime(ld.DatePosted); ok {
				return t
			}
		}
	}
	return time.Time{}
}

func parseTime(s string) (time.Time, bool) {
	for _, layout := range []string{time.RFC3339Nano, "2006-01-02T15:04:05.999-0700", time.DateOnly} {
		if t, err := time.Parse(layout, s); err == nil {
			return t.UTC(), true
		}
	}
	return time.Time{}, false
}

func strip(s, prefix string) string {
	return strings.TrimSpace(strings.TrimPrefix(s, prefix))
}

func first(xs ...string) string {
	for _, x := range xs {
		if x != "" {
			return x
		}
	}
	return ""
}
