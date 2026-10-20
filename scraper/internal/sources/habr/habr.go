// Package habr — источник Хабр Карьера (career.habr.com).
//
// Ссылки — из выдачи по классу ссылки карточки, следующая страница — a.next_page.
// Поля вакансии — из состояния страницы <script type="application/json" data-ssr-state="true">:
// это данные, из которых сайт сам рисует страницу, они устойчивее CSS-классов.
package habr

import (
	"bytes"
	"context"
	"encoding/json"
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

const Code = "habr"

type Habr struct {
	get sources.Getter
	now func() time.Time
}

func New(get sources.Getter) *Habr { return &Habr{get: get, now: time.Now} }

func (*Habr) Code() string { return Code }

var idRe = regexp.MustCompile(`^(?:https://career\.habr\.com)?/vacancies/(\d+)/?(?:[?#].*)?$`)

// Canonical приводит ссылку к виду https://career.habr.com/vacancies/<номер>.
func Canonical(href string) (id, url string, ok bool) {
	m := idRe.FindStringSubmatch(href)
	if m == nil {
		return "", "", false
	}
	return m[1], "https://career.habr.com/vacancies/" + m[1], true
}

func (h *Habr) ListLinks(ctx context.Context, q sources.Query, known map[string]bool) ([]sources.Link, error) {
	var out []sources.Link
	seen := map[string]bool{}
	url := q.URL
	for page := 0; url != "" && (q.MaxPages == 0 || page < q.MaxPages); page++ {
		resp, err := h.get.Get(ctx, url)
		if err != nil {
			return out, err
		}
		if resp.Status != http.StatusOK {
			return out, fmt.Errorf("выдача: ответ %d", resp.Status)
		}
		doc, err := goquery.NewDocumentFromReader(bytes.NewReader(resp.Body))
		if err != nil {
			return out, err
		}
		found, allKnown := 0, true
		doc.Find(`a.vacancy-card__title-link[href]`).Each(func(_ int, s *goquery.Selection) {
			href, _ := s.Attr("href")
			id, cu, ok := Canonical(href)
			if !ok || seen[id] {
				return
			}
			seen[id] = true
			found++
			if !known[cu] {
				allKnown = false
				out = append(out, sources.Link{Source: Code, ExternalID: id, URL: cu, FoundAt: h.now().UTC()})
			}
		})
		if found == 0 || (allKnown && known != nil) {
			break
		}
		url = ""
		if href, ok := doc.Find(`a.next_page[href]`).Attr("href"); ok {
			if next := sources.Resolve(resp.URL, href); h.get.Allowed(ctx, next) {
				url = next
			}
		}
	}
	return out, nil
}

type ssrState struct {
	Vacancy *struct {
		ID                  int64  `json:"id"`
		Title               string `json:"title"`
		RemoteWork          bool   `json:"remoteWork"`
		Archived            bool   `json:"archived"`
		Hidden              bool   `json:"hidden"`
		Qualification       string `json:"qualification"`
		EmploymentType      string `json:"employmentType"`
		HumanCityNames      string `json:"humanCityNames"`
		Description         string `json:"description"`
		SalaryQualification *struct {
			Title string `json:"title"`
		} `json:"salaryQualification"`
		PublishedDate struct {
			Date string `json:"date"`
		} `json:"publishedDate"`
		Company struct {
			Title string `json:"title"`
		} `json:"company"`
		Salary struct {
			From     *int64  `json:"from"`
			To       *int64  `json:"to"`
			Currency *string `json:"currency"`
		} `json:"salary"`
		Skills []struct {
			Title string `json:"title"`
		} `json:"skills"`
		Locations []struct {
			Title string `json:"title"`
		} `json:"locations"`
	} `json:"vacancy"`
}

var ssrRe = regexp.MustCompile(`(?s)<script[^>]*data-ssr-state="true"[^>]*>(.*?)</script>`)

func parseState(body []byte) (*ssrState, error) {
	m := ssrRe.FindSubmatch(body)
	if m == nil {
		return nil, errors.New("нет data-ssr-state")
	}
	var st ssrState
	if err := json.Unmarshal([]byte(html.UnescapeString(string(m[1]))), &st); err != nil {
		return nil, fmt.Errorf("data-ssr-state: %w", err)
	}
	return &st, nil
}

func (h *Habr) Parse(body []byte, link sources.Link) (sources.Vacancy, error) {
	st, err := parseState(body)
	if err != nil {
		return sources.Vacancy{}, err
	}
	sv := st.Vacancy
	if sv == nil {
		return sources.Vacancy{}, errors.New("в data-ssr-state нет вакансии")
	}
	v := sources.Vacancy{
		Source:     Code,
		ExternalID: link.ExternalID,
		URL:        link.URL,
		Title:      strings.TrimSpace(sv.Title),
		Company:    strings.TrimSpace(sv.Company.Title),
		Employment: strings.ToLower(sv.EmploymentType),
		FetchedAt:  h.now().UTC(),
	}
	if len(sv.Locations) > 0 {
		v.City = sv.Locations[0].Title
	} else {
		v.City, _, _ = strings.Cut(sv.HumanCityNames, ",")
	}
	if sv.SalaryQualification != nil {
		v.Experience = sv.SalaryQualification.Title
	} else {
		v.Experience = sv.Qualification
	}
	if sv.RemoteWork {
		v.WorkFormatRaw = "можно удалённо"
	}
	var skills []string
	for _, s := range sv.Skills {
		skills = append(skills, s.Title)
	}
	v.SkillsRaw = sources.Dedup(skills)
	if d, err := goquery.NewDocumentFromReader(strings.NewReader(sv.Description)); err == nil {
		v.Description = sources.Text(d.Selection)
	}
	if sv.Salary.From != nil || sv.Salary.To != nil {
		v.SalaryFrom, v.SalaryTo = sv.Salary.From, sv.Salary.To
		if sv.Salary.Currency != nil && *sv.Salary.Currency != "" {
			cur := strings.ToUpper(*sv.Salary.Currency)
			if cur == "RUR" {
				cur = "RUB"
			}
			v.Currency = &cur
		}
	}
	if t, err := time.Parse(time.RFC3339, sv.PublishedDate.Date); err == nil {
		v.PublishedAt = t.UTC()
	}
	switch {
	case v.Title == "":
		return v, errors.New("нет заголовка")
	case v.Description == "":
		return v, errors.New("нет описания")
	}
	v.ContentHash = v.Hash()
	return v, nil
}

func (h *Habr) IsGone(status int, body []byte) bool {
	if status == http.StatusNotFound || status == http.StatusGone {
		return true
	}
	if status != http.StatusOK {
		return false
	}
	st, err := parseState(body)
	if err != nil || st.Vacancy == nil {
		return false
	}
	return st.Vacancy.Archived || st.Vacancy.Hidden
}
