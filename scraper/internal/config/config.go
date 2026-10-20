// Package config читает sources.yaml и переменные окружения.
package config

import (
	"cmp"
	"fmt"
	"net/url"
	"os"
	"strings"
	"time"

	"go.yaml.in/yaml/v3"

	"github.com/AlexTihonow/PODBORpro/scraper/internal/sources"
)

// Config — содержимое sources.yaml и переменные окружения.
type Config struct {
	UserAgent        string   `yaml:"user_agent"`
	Pause            Pause    `yaml:"pause"`
	MaxPagesPerQuery int      `yaml:"max_pages_per_query"`
	Sources          []Source `yaml:"sources"`
	// BootstrapQueries — дополнительные запросы для первого сбора (-profile bootstrap), по коду источника.
	BootstrapQueries map[string]Bootstrap `yaml:"bootstrap_queries"`

	LayaURL     string `yaml:"-"`
	PodborURL   string `yaml:"-"`
	ImportToken string `yaml:"-"`
}

// Source — один сайт в sources.yaml.
type Source struct {
	Code    string  `yaml:"code"`
	Render  string  `yaml:"render"`  // http (по умолчанию) или browser
	Enabled *bool   `yaml:"enabled"` // false — источник отключён
	Queries []Query `yaml:"queries"`
}

func (s Source) IsEnabled() bool { return s.Enabled == nil || *s.Enabled }

// Query — поисковый запрос: ссылка на выдачу, отсортированную по дате, или на карту сайта.
type Query struct {
	URL   string   `yaml:"url"`
	Match []string `yaml:"match"` // для карты сайта: слова в адресе тематической страницы
}

// Bootstrap — как дробить запросы при первом сборе.
//
//	split_by: [area, professional_role]
//	areas: [1, 2, 113]
//	professional_roles: [96, 104]
//
// Значения параметра X берутся из ключа Xs. Каждый запрос из queries источника размножается
// на все сочетания значений. queries — ещё запросы, которые обходятся только при первом сборе.
type Bootstrap struct {
	SplitBy []string
	Values  map[string][]string
	Queries []Query
}

func (b *Bootstrap) UnmarshalYAML(n *yaml.Node) error {
	var raw map[string]yaml.Node
	if err := n.Decode(&raw); err != nil {
		return err
	}
	b.Values = map[string][]string{}
	for k, v := range raw {
		var err error
		switch k {
		case "split_by":
			err = v.Decode(&b.SplitBy)
		case "queries":
			err = v.Decode(&b.Queries)
		default:
			var vals []string
			err = v.Decode(&vals)
			b.Values[k] = vals
		}
		if err != nil {
			return fmt.Errorf("bootstrap_queries.%s: %w", k, err)
		}
	}
	for _, p := range b.SplitBy {
		if len(b.Values[p+"s"]) == 0 {
			return fmt.Errorf("bootstrap_queries: split_by %q, но нет списка %ss", p, p)
		}
	}
	return nil
}

// Pause — «3s-6s»: случайная пауза между запросами к одному сайту.
type Pause struct{ Min, Max time.Duration }

func (p *Pause) UnmarshalYAML(n *yaml.Node) error {
	lo, hi, ok := strings.Cut(n.Value, "-")
	if !ok {
		hi = lo
	}
	var err error
	if p.Min, err = time.ParseDuration(strings.TrimSpace(lo)); err != nil {
		return fmt.Errorf("pause: %w", err)
	}
	if p.Max, err = time.ParseDuration(strings.TrimSpace(hi)); err != nil {
		return fmt.Errorf("pause: %w", err)
	}
	if p.Max < p.Min {
		return fmt.Errorf("pause: %s больше %s", lo, hi)
	}
	return nil
}

// Load читает sources.yaml и переменные окружения.
func Load(path string) (Config, error) {
	b, err := os.ReadFile(path)
	if err != nil {
		return Config{}, err
	}
	c := Config{Pause: Pause{3 * time.Second, 6 * time.Second}, MaxPagesPerQuery: 20}
	if err := yaml.Unmarshal(b, &c); err != nil {
		return Config{}, fmt.Errorf("%s: %w", path, err)
	}
	if c.UserAgent == "" {
		return Config{}, fmt.Errorf("%s: не задан user_agent", path)
	}
	for _, s := range c.Sources {
		if s.Render != "" && s.Render != "http" && s.Render != "browser" {
			return Config{}, fmt.Errorf("%s: источник %s: render должен быть http или browser", path, s.Code)
		}
	}
	c.LayaURL = strings.TrimRight(cmp.Or(os.Getenv("LAYA_URL"), "http://localhost:8000"), "/")
	c.PodborURL = strings.TrimRight(os.Getenv("PODBOR_URL"), "/")
	c.ImportToken = os.Getenv("IMPORT_TOKEN")
	return c, nil
}

// Queries — запросы источника для обычного запуска или для первого сбора.
func (c Config) Queries(s Source, bootstrap bool) []sources.Query {
	maxPages := c.MaxPagesPerQuery
	if bootstrap {
		maxPages = 0 // вся выдача до конца
	}
	conv := func(qs []Query) []sources.Query {
		out := make([]sources.Query, 0, len(qs))
		for _, q := range qs {
			out = append(out, sources.Query{URL: q.URL, MaxPages: maxPages, Match: q.Match})
		}
		return out
	}
	qs := conv(s.Queries)
	b, ok := c.BootstrapQueries[s.Code]
	if !bootstrap || !ok {
		return qs
	}
	out := qs
	if len(b.SplitBy) > 0 {
		for _, q := range qs {
			if strings.HasSuffix(q.URL, ".xml") {
				continue // карту сайта не дробим
			}
			for _, u := range split(q.URL, b) {
				out = append(out, sources.Query{URL: u, MaxPages: maxPages, Match: q.Match})
			}
		}
	}
	return append(out, conv(b.Queries)...)
}

// split размножает адрес на все сочетания значений параметров split_by.
func split(raw string, b Bootstrap) []string {
	urls := []string{raw}
	for _, p := range b.SplitBy {
		var next []string
		for _, u := range urls {
			for _, v := range b.Values[p+"s"] {
				pu, err := url.Parse(u)
				if err != nil {
					continue
				}
				q := pu.Query()
				q.Set(p, v)
				pu.RawQuery = q.Encode()
				next = append(next, pu.String())
			}
		}
		urls = next
	}
	return urls
}
