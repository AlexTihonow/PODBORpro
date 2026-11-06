package config

import (
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestLoadRepoConfig(t *testing.T) {
	c, err := Load("../../sources.yaml")
	if err != nil {
		t.Fatal(err)
	}
	if c.Pause.Min != 3*time.Second || c.Pause.Max != 6*time.Second || c.MaxPagesPerQuery != 20 {
		t.Errorf("настройки: %+v", c)
	}
	if len(c.Sources) < 2 || c.Sources[0].Code != "headhunter" {
		t.Errorf("источники: %+v", c.Sources)
	}
}

func TestBootstrapSplit(t *testing.T) {
	path := filepath.Join(t.TempDir(), "sources.yaml")
	os.WriteFile(path, []byte(`
user_agent: "bot/1.0"
sources:
  - code: headhunter
    queries:
      - url: "https://hh.ru/search/vacancy?text=go"
bootstrap_queries:
  headhunter:
    split_by: [area, professional_role]
    areas: [1, 2]
    professional_roles: [96, 104, 107]
    queries:
      - url: "https://hh.ru/sitemap/main.xml"
        match: [razrabotchik]
`), 0o644)
	c, err := Load(path)
	if err != nil {
		t.Fatal(err)
	}
	normal := c.Queries(c.Sources[0], false)
	if len(normal) != 1 || normal[0].MaxPages != 20 {
		t.Errorf("обычный запуск: %+v", normal)
	}
	boot := c.Queries(c.Sources[0], true)
	if len(boot) != 1+2*3+1 {
		t.Fatalf("первый сбор: %d запросов, ждали 8", len(boot))
	}
	if boot[1].URL != "https://hh.ru/search/vacancy?area=1&professional_role=96&text=go" || boot[1].MaxPages != 0 {
		t.Errorf("дробление: %+v", boot[1])
	}
	if last := boot[len(boot)-1]; last.URL != "https://hh.ru/sitemap/main.xml" || last.Match[0] != "razrabotchik" {
		t.Errorf("доп. запрос: %+v", last)
	}
}

func TestBadConfig(t *testing.T) {
	for name, body := range map[string]string{
		"no user agent": "sources: []",
		"bad pause":     "user_agent: x\npause: 6s-3s",
		"bad render":    "user_agent: x\nsources:\n  - code: a\n    render: curl",
		"split no vals": "user_agent: x\nbootstrap_queries:\n  a:\n    split_by: [area]",
	} {
		path := filepath.Join(t.TempDir(), "s.yaml")
		os.WriteFile(path, []byte(body), 0o644)
		if _, err := Load(path); err == nil {
			t.Errorf("%s: ждали ошибку", name)
		}
	}
}
