package export

import (
	"hash/fnv"
	"log/slog"
	"slices"
	"strconv"
	"strings"
	"time"

	"github.com/AlexTihonow/PODBORpro/scraper/internal/data"
	"github.com/AlexTihonow/PODBORpro/scraper/internal/jsonfile"
	"github.com/AlexTihonow/PODBORpro/scraper/internal/sources"
)

type Catalog struct {
	GeneratedAt time.Time `json:"generated_at"`
	Model       *string   `json:"model"`
	Items       []Vacancy `json:"items"`
}

type Skill struct {
	ID   int    `json:"id"`
	Name string `json:"name"`
}

type Vacancy struct {
	ID          int64                    `json:"id"`
	Title       string                   `json:"title"`
	Company     string                   `json:"company"`
	City        string                   `json:"city"`
	Grade       any                      `json:"grade"`
	WorkFormat  any                      `json:"work_format"`
	SalaryFrom  *int64                   `json:"salary_from"`
	SalaryTo    *int64                   `json:"salary_to"`
	Currency    *string                  `json:"currency"`
	Skills      []Skill                  `json:"skills"`
	Source      string                   `json:"source"`
	URL         string                   `json:"url"`
	PublishedAt time.Time                `json:"published_at"`
	Description string                   `json:"description"`
	Tags        []sources.Tag            `json:"tags"`
	Labels      map[string]sources.Label `json:"labels"`
	NeedsReview bool                     `json:"needs_review"`
}

func Run(st *data.Store, out string, log *slog.Logger) error {
	vacancies := st.Vacancies(nil)
	slices.SortFunc(vacancies, func(a, b sources.Vacancy) int { return b.PublishedAt.Compare(a.PublishedAt) })

	skillIDs := skillIndex(vacancies)
	seen := map[int64]bool{}
	c := Catalog{GeneratedAt: time.Now().UTC(), Items: []Vacancy{}}
	tagged := 0

	for _, v := range vacancies {
		id := numericID(v)
		if seen[id] {
			continue
		}
		seen[id] = true
		if v.TaggedWith != nil {
			tagged++
			c.Model = v.TaggedWith
		}
		c.Items = append(c.Items, convert(v, id, skillIDs))
	}

	log.Info("экспорт", "vacancies", len(c.Items), "tagged", tagged, "out", out)
	return jsonfile.Write(out, c)
}

func convert(v sources.Vacancy, id int64, skillIDs map[string]int) Vacancy {
	out := Vacancy{
		ID:          id,
		Title:       v.Title,
		Company:     v.Company,
		City:        v.City,
		Grade:       v.Labels["grade"].Value,
		WorkFormat:  v.Labels["work_format"].Value,
		SalaryFrom:  v.SalaryFrom,
		SalaryTo:    v.SalaryTo,
		Currency:    v.Currency,
		Skills:      []Skill{},
		Source:      v.Source,
		URL:         v.URL,
		PublishedAt: v.PublishedAt,
		Description: clean(v.Description),
		Tags:        orEmpty(v.Tags),
		Labels:      v.Labels,
		NeedsReview: v.NeedsReview != nil && *v.NeedsReview,
	}
	if out.Labels == nil {
		out.Labels = map[string]sources.Label{}
	}
	for _, name := range skills(v) {
		out.Skills = append(out.Skills, Skill{ID: skillIDs[strings.ToLower(name)], Name: name})
	}
	return out
}

func skills(v sources.Vacancy) []string {
	var out []string
	for _, s := range v.SkillsRaw {
		low := strings.ToLower(s)
		if !strings.Contains(s, " — ") && !strings.HasPrefix(low, "английск") && !strings.HasPrefix(low, "english") {
			out = append(out, s)
		}
	}
	return out
}

func skillIndex(vacancies []sources.Vacancy) map[string]int {
	var names []string
	for _, v := range vacancies {
		for _, s := range skills(v) {
			names = append(names, strings.ToLower(s))
		}
	}
	slices.Sort(names)
	ids := map[string]int{}
	for _, n := range slices.Compact(names) {
		ids[n] = len(ids) + 1
	}
	return ids
}

func numericID(v sources.Vacancy) int64 {
	if n, err := strconv.ParseInt(v.ExternalID, 10, 64); err == nil {
		return n
	}
	h := fnv.New32a()
	h.Write([]byte(v.Key()))
	return int64(h.Sum32())
}

var cleaner = strings.NewReplacer("&nbsp;", " ", " ", " ")

func clean(s string) string {
	return strings.TrimSpace(cleaner.Replace(s))
}

func orEmpty(tags []sources.Tag) []sources.Tag {
	if tags == nil {
		return []sources.Tag{}
	}
	return tags
}
