package export

import (
	"io"
	"log/slog"
	"path/filepath"
	"testing"
	"time"

	"github.com/AlexTihonow/PODBORpro/scraper/internal/data"
	"github.com/AlexTihonow/PODBORpro/scraper/internal/jsonfile"
	"github.com/AlexTihonow/PODBORpro/scraper/internal/sources"
)

func TestExportBuildsCatalog(t *testing.T) {
	st, _ := data.Open(t.TempDir())
	model := "laya"
	older := sources.Vacancy{
		Source: "headhunter", ExternalID: "101", Title: "Go", PublishedAt: time.Unix(100, 0),
		SkillsRaw:   []string{"Go", "Английский — B1 — Средний", "Английский язык"},
		Description: "Описание&nbsp;вакансии",
		Labels:      map[string]sources.Label{"grade": {Value: "senior", Confidence: 0.9, Source: "rule"}},
		Tags:        []sources.Tag{{Path: "it/backend/go", Label: "Backend / Go", Confidence: 0.8}},
		TaggedWith:  &model,
	}
	newer := sources.Vacancy{Source: "habr", ExternalID: "7", Title: "QA", PublishedAt: time.Unix(200, 0), SkillsRaw: []string{"go"}}
	st.PutVacancy(older)
	st.PutVacancy(newer)

	out := filepath.Join(t.TempDir(), "catalog.json")
	if err := Run(st, out, slog.New(slog.NewTextHandler(io.Discard, nil))); err != nil {
		t.Fatal(err)
	}
	var c Catalog
	if err := jsonfile.Read(out, &c); err != nil {
		t.Fatal(err)
	}
	if len(c.Items) != 2 || c.Items[0].ID != 7 || c.Model == nil || *c.Model != "laya" {
		t.Fatalf("каталог: %+v", c)
	}
	go101 := c.Items[1]
	if go101.Grade != "senior" || go101.Description != "Описание вакансии" || len(go101.Skills) != 1 {
		t.Errorf("вакансия: %+v", go101)
	}
	if go101.Skills[0].ID != c.Items[0].Skills[0].ID {
		t.Error("один навык в разном регистре должен получить один id")
	}
	if c.Items[0].Tags == nil || c.Items[0].Labels == nil {
		t.Error("пустые теги и метки должны быть [] и {}, а не null")
	}
}
