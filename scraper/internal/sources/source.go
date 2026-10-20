// Package sources — общий интерфейс сайта с вакансиями и общие типы этапов.
package sources

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"strings"
	"time"
)

// Source — один сайт с вакансиями.
type Source interface {
	// Code — код источника, совпадает с sources.code в базе: "headhunter", "habr".
	Code() string

	// ListLinks обходит страницы выдачи по запросу и возвращает ссылки на вакансии.
	// known — уже известные ссылки: как только страница выдачи целиком из них, обход останавливается.
	ListLinks(ctx context.Context, query Query, known map[string]bool) ([]Link, error)

	// Parse разбирает страницу одной вакансии.
	Parse(html []byte, link Link) (Vacancy, error)

	// IsGone отвечает, снята ли вакансия, по коду ответа и странице.
	IsGone(status int, html []byte) bool
}

// Query — один поисковый запрос из sources.yaml.
type Query struct {
	URL string
	// MaxPages — сколько страниц выдачи листать; 0 — до конца.
	MaxPages int
	// Match — для карты сайта: брать только тематические страницы, в адресе которых есть одно из слов.
	Match []string
}

// Link — запись data/links.json.
type Link struct {
	Source     string     `json:"source"`
	ExternalID string     `json:"external_id"`
	URL        string     `json:"url"`
	FoundAt    time.Time  `json:"found_at"`
	FetchedAt  *time.Time `json:"fetched_at"`
	// FailedAt — страница не разобралась и лежит в data/html/failed/; заново её не скачиваем.
	FailedAt *time.Time `json:"failed_at,omitempty"`
}

// Key — ключ вакансии, по нему же сервер не создаёт дубли.
func (l Link) Key() string { return l.Source + ":" + l.ExternalID }

// Tag — ответ Laya по дереву тегов.
type Tag struct {
	Path       string  `json:"path"`
	Confidence float64 `json:"confidence"`
	Stopped    string  `json:"stopped,omitempty"`
}

// Label — ответ Laya на один вопрос: грейд, формат работы, английский...
type Label struct {
	Value      any     `json:"value"`
	Confidence float64 `json:"confidence"`
}

// Vacancy — запись data/vacancies.json.
type Vacancy struct {
	Source        string    `json:"source"`
	ExternalID    string    `json:"external_id"`
	URL           string    `json:"url"`
	Title         string    `json:"title"`
	Company       string    `json:"company"`
	City          string    `json:"city"`
	SalaryFrom    *int64    `json:"salary_from"`
	SalaryTo      *int64    `json:"salary_to"`
	Currency      *string   `json:"currency"`
	Experience    string    `json:"experience"`
	Employment    string    `json:"employment"`
	WorkFormatRaw string    `json:"work_format_raw"`
	SkillsRaw     []string  `json:"skills_raw"`
	Description   string    `json:"description"`
	PublishedAt   time.Time `json:"published_at"`
	FetchedAt     time.Time `json:"fetched_at"`
	ContentHash   string    `json:"content_hash"`

	Tags        []Tag            `json:"tags"`
	Labels      map[string]Label `json:"labels"`
	NeedsReview *bool            `json:"needs_review,omitempty"`
	TaggedWith  *string          `json:"tagged_with"`
	// TaggedHash — content_hash на момент разметки: если он поменялся, вакансию размечаем заново.
	TaggedHash string `json:"tagged_hash,omitempty"`

	PushedHash *string `json:"pushed_hash"`
	// PushedTaggedWith — tagged_with на момент отправки: теги появились или сменились — отправляем снова.
	PushedTaggedWith *string `json:"pushed_tagged_with,omitempty"`
}

// Key — ключ вакансии: источник и номер на сайте.
func (v Vacancy) Key() string { return v.Source + ":" + v.ExternalID }

// Hash считает content_hash от заголовка, описания, зарплаты и навыков.
func (v Vacancy) Hash() string {
	h := sha256.New()
	fmt.Fprintf(h, "%s\x00%s\x00%s\x00%s\x00%s\x00%s",
		v.Title, v.Description, ptrStr(v.SalaryFrom), ptrStr(v.SalaryTo), ptrStr(v.Currency),
		strings.Join(v.SkillsRaw, "\x01"))
	return hex.EncodeToString(h.Sum(nil))
}

func ptrStr[T any](p *T) string {
	if p == nil {
		return "-"
	}
	return fmt.Sprint(*p)
}

// NeedsTagging — вакансию ещё не размечали или она изменилась после разметки.
func (v Vacancy) NeedsTagging() bool {
	return v.TaggedWith == nil || v.TaggedHash != v.ContentHash
}

// NeedsPush — вакансия новая, изменилась или получила теги после прошлой отправки.
func (v Vacancy) NeedsPush() bool {
	if v.PushedHash == nil || *v.PushedHash != v.ContentHash {
		return true
	}
	return v.TaggedWith != nil && (v.PushedTaggedWith == nil || *v.PushedTaggedWith != *v.TaggedWith)
}
