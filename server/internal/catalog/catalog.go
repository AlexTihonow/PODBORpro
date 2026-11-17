// Package catalog читает каталог вакансий, который собирает скрепер и размечает
// ML-сервис (web/data/vacancies.json). Пока в базе нет таблицы вакансий, это
// единственный серверный источник их полного текста. Когда таблица появится,
// её хранилище должно реализовать тот же метод Find.
package catalog

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"regexp"
	"sort"
	"strings"
	"sync"
	"time"
)

var ErrNotFound = errors.New("catalog: вакансия не найдена")

type Skill struct {
	ID   int64  `json:"id"`
	Name string `json:"name"`
}

type Vacancy struct {
	ID          int64   `json:"id"`
	Title       string  `json:"title"`
	Company     string  `json:"company"`
	City        *string `json:"city"`
	Grade       *string `json:"grade"`
	WorkFormat  *string `json:"work_format"`
	Skills      []Skill `json:"skills"`
	Description string  `json:"description"`

	SalaryFrom  *int    `json:"salary_from"`
	SalaryTo    *int    `json:"salary_to"`
	Currency    *string `json:"currency"`
	Source      string  `json:"source"`
	URL         string  `json:"url"`
	PublishedAt string  `json:"published_at"`
}

// SkillNames — названия навыков; скрепер иногда кладёт целый список
// («• Go • PostgreSQL») в один навык, такие разбиваем.
func (v Vacancy) SkillNames() []string {
	var out []string
	for _, s := range v.Skills {
		for _, part := range listSeparators.Split(s.Name, -1) {
			if part = strings.TrimSpace(part); part != "" && len([]rune(part)) <= 40 {
				out = append(out, part)
			}
		}
	}
	return out
}

var listSeparators = regexp.MustCompile(`\s*[•·▪●;\n]\s*`)

type file struct {
	Items []Vacancy `json:"items"`
}

// Catalog держит каталог в памяти и перечитывает файл, если он изменился.
type Catalog struct {
	path string

	mu      sync.Mutex
	modTime time.Time
	size    int64
	byID    map[int64]Vacancy
}

func New(path string) *Catalog { return &Catalog{path: path} }

func (c *Catalog) Find(_ context.Context, id int64) (Vacancy, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if err := c.refresh(); err != nil {
		return Vacancy{}, err
	}
	v, ok := c.byID[id]
	if !ok {
		return Vacancy{}, ErrNotFound
	}
	return v, nil
}

// SkillNames — навыки, которые встречаются хотя бы в двух вакансиях каталога
// (словарь для разбора резюме). Ошибку чтения каталога не считаем сбоем: словаря просто нет.
func (c *Catalog) SkillNames(_ context.Context) []string {
	c.mu.Lock()
	defer c.mu.Unlock()
	if err := c.refresh(); err != nil {
		return nil
	}
	count := map[string]int{}
	spelling := map[string]string{}
	for _, v := range c.byID {
		seen := map[string]bool{}
		for _, name := range v.SkillNames() {
			k := strings.ToLower(name)
			if seen[k] {
				continue
			}
			seen[k] = true
			count[k]++
			if _, ok := spelling[k]; !ok {
				spelling[k] = name
			}
		}
	}
	var out []string
	for k, n := range count {
		if n >= 2 {
			out = append(out, spelling[k])
		}
	}
	sort.Strings(out)
	return out
}

func (c *Catalog) refresh() error {
	st, err := os.Stat(c.path)
	if errors.Is(err, os.ErrNotExist) {
		c.byID = nil
		return nil // нет каталога — нет вакансий, это не сбой сервера
	}
	if err != nil {
		return fmt.Errorf("catalog: %w", err)
	}
	if c.byID != nil && st.ModTime().Equal(c.modTime) && st.Size() == c.size {
		return nil
	}
	raw, err := os.ReadFile(c.path)
	if err != nil {
		return fmt.Errorf("catalog: %w", err)
	}
	var f file
	if err := json.Unmarshal(raw, &f); err != nil {
		return fmt.Errorf("catalog: %s не JSON каталога: %w", c.path, err)
	}
	byID := make(map[int64]Vacancy, len(f.Items))
	for _, v := range f.Items {
		byID[v.ID] = v
	}
	c.byID, c.modTime, c.size = byID, st.ModTime(), st.Size()
	return nil
}
