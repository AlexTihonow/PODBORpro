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

type Config struct {
	UserAgent        string               `yaml:"user_agent"`
	Pause            Pause                `yaml:"pause"`
	MaxPagesPerQuery int                  `yaml:"max_pages_per_query"`
	Sources          []Source             `yaml:"sources"`
	BootstrapQueries map[string]Bootstrap `yaml:"bootstrap_queries"`

	LayaURL     string `yaml:"-"`
	PodborURL   string `yaml:"-"`
	ImportToken string `yaml:"-"`
}

type Source struct {
	Code    string  `yaml:"code"`
	Render  string  `yaml:"render"`
	Enabled *bool   `yaml:"enabled"`
	Queries []Query `yaml:"queries"`
}

func (s Source) IsEnabled() bool { return s.Enabled == nil || *s.Enabled }

type Query struct {
	URL   string   `yaml:"url"`
	Match []string `yaml:"match"`
}

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

func (c Config) Queries(s Source, bootstrap bool) []sources.Query {
	maxPages := c.MaxPagesPerQuery
	if bootstrap {
		maxPages = 0
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
				continue
			}
			for _, u := range split(q.URL, b) {
				out = append(out, sources.Query{URL: u, MaxPages: maxPages, Match: q.Match})
			}
		}
	}
	return append(out, conv(b.Queries)...)
}

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
