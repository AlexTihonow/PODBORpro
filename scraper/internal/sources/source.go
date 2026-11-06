package sources

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"strings"
	"time"
)

type Source interface {
	Code() string

	ListLinks(ctx context.Context, query Query, known map[string]bool) ([]Link, error)

	Parse(html []byte, link Link) (Vacancy, error)

	IsGone(status int, html []byte) bool
}

type Query struct {
	URL      string
	MaxPages int
	Match    []string
}

type Link struct {
	Source     string     `json:"source"`
	ExternalID string     `json:"external_id"`
	URL        string     `json:"url"`
	FoundAt    time.Time  `json:"found_at"`
	FetchedAt  *time.Time `json:"fetched_at"`
	FailedAt   *time.Time `json:"failed_at,omitempty"`
}

func (l Link) Key() string { return l.Source + ":" + l.ExternalID }

type Tag struct {
	Path       string  `json:"path"`
	Label      string  `json:"label,omitempty"`
	Confidence float64 `json:"confidence"`
	Stopped    string  `json:"stopped,omitempty"`
	Source     string  `json:"source,omitempty"`
}

type Label struct {
	Value      any     `json:"value"`
	Confidence float64 `json:"confidence"`
	Source     string  `json:"source,omitempty"`
}

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
	TaggedHash  string           `json:"tagged_hash,omitempty"`

	PushedHash       *string `json:"pushed_hash"`
	PushedTaggedWith *string `json:"pushed_tagged_with,omitempty"`
}

func (v Vacancy) Key() string { return v.Source + ":" + v.ExternalID }

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

func (v Vacancy) NeedsTagging() bool {
	return v.TaggedWith == nil || v.TaggedHash != v.ContentHash
}

func (v Vacancy) NeedsPush() bool {
	if v.PushedHash == nil || *v.PushedHash != v.ContentHash {
		return true
	}
	return v.TaggedWith != nil && (v.PushedTaggedWith == nil || *v.PushedTaggedWith != *v.TaggedWith)
}
