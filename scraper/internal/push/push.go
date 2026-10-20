// Package push — этап 4: отправляет на сервер новые и изменённые вакансии пакетами по 100.
//
//	POST /api/v1/internal/vacancies/import
//	Authorization: Bearer <IMPORT_TOKEN>
//	{ "items": [ ...записи vacancies.json целиком... ], "run": { ...итог сбора по сайтам... } }
//
// Ответ: { "created": 12, "updated": 3, "skipped": 85, "rejected": [ { "external_id": "...", "error": "..." } ] }.
// Пакет всегда из одного источника, поэтому external_id в rejected однозначен.
package push

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/AlexTihonow/PODBORpro/scraper/internal/data"
	"github.com/AlexTihonow/PODBORpro/scraper/internal/sources"
)

const BatchSize = 100

const importPath = "/api/v1/internal/vacancies/import"

// Run — итог сбора, его сервер пишет в collection_runs: какой сайт не собрался и почему.
type Run struct {
	StartedAt time.Time   `json:"started_at"`
	Sources   []SourceRun `json:"sources"`
}

type SourceRun struct {
	Source string `json:"source"`
	// Status — success, partial (сайт остановил сбор на середине) или failed.
	Status  string `json:"status"`
	Fetched int    `json:"fetched"`
	Errors  int    `json:"errors"`
	Error   string `json:"error,omitempty"`
}

type request struct {
	Items []sources.Vacancy `json:"items"`
	Run   *Run              `json:"run,omitempty"`
}

type Response struct {
	Created  int `json:"created"`
	Updated  int `json:"updated"`
	Skipped  int `json:"skipped"`
	Rejected []struct {
		ExternalID string `json:"external_id"`
		Error      string `json:"error"`
	} `json:"rejected"`
}

type Client struct {
	URL   string
	Token string
	HTTP  *http.Client
	// Sleep — пауза между повторами, для тестов.
	Sleep func(time.Duration)
}

func NewClient(url, token string) *Client {
	return &Client{URL: strings.TrimRight(url, "/"), Token: token,
		HTTP: &http.Client{Timeout: time.Minute}, Sleep: time.Sleep}
}

// send отправляет пакет; при обрыве сети и 5xx повторяет до трёх раз.
func (c *Client) send(ctx context.Context, r request) (*Response, error) {
	body, err := json.Marshal(r)
	if err != nil {
		return nil, err
	}
	var lastErr error
	for attempt := range 3 {
		if attempt > 0 {
			c.Sleep(time.Duration(attempt) * 5 * time.Second)
		}
		req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.URL+importPath, bytes.NewReader(body))
		if err != nil {
			return nil, err
		}
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+c.Token)
		resp, err := c.HTTP.Do(req)
		if err != nil {
			if ctx.Err() != nil {
				return nil, ctx.Err()
			}
			lastErr = err
			continue
		}
		b, err := io.ReadAll(io.LimitReader(resp.Body, 4<<20))
		resp.Body.Close()
		if err != nil {
			lastErr = err
			continue
		}
		if resp.StatusCode >= 500 {
			lastErr = fmt.Errorf("сервер: ответ %d", resp.StatusCode)
			continue
		}
		if resp.StatusCode != http.StatusOK {
			return nil, fmt.Errorf("сервер: ответ %d", resp.StatusCode) // 401, 413... повтор не поможет
		}
		var out Response
		if err := json.Unmarshal(b, &out); err != nil {
			return nil, fmt.Errorf("сервер: %w", err)
		}
		return &out, nil
	}
	return nil, lastErr
}

type Stats struct {
	Pending  int
	Created  int
	Updated  int
	Skipped  int
	Rejected int
}

// Push отправляет вакансии, у которых pushed_hash не совпадает с content_hash или теги изменились.
// После успешного ответа у принятых ставит pushed_hash = content_hash.
func Push(ctx context.Context, st *data.Store, c *Client, run *Run, log *slog.Logger) (Stats, error) {
	if c.URL == "" || c.Token == "" {
		return Stats{}, errors.New("не заданы PODBOR_URL и IMPORT_TOKEN")
	}
	pending := st.Vacancies(sources.Vacancy.NeedsPush)
	s := Stats{Pending: len(pending)}
	defer func() {
		log.Info("отправка", "pending", s.Pending, "created", s.Created, "updated", s.Updated,
			"skipped", s.Skipped, "rejected", s.Rejected)
	}()
	bySource := map[string][]sources.Vacancy{}
	var order []string
	for _, v := range pending {
		if _, ok := bySource[v.Source]; !ok {
			order = append(order, v.Source)
		}
		bySource[v.Source] = append(bySource[v.Source], v)
	}
	sentRun := false
	for _, src := range order {
		vs := bySource[src]
		for start := 0; start < len(vs); start += BatchSize {
			batch := vs[start:min(start+BatchSize, len(vs))]
			req := request{Items: batch}
			if !sentRun {
				req.Run, sentRun = run, true
			}
			resp, err := c.send(ctx, req)
			if err != nil {
				return s, err
			}
			s.Created += resp.Created
			s.Updated += resp.Updated
			s.Skipped += resp.Skipped
			rejected := map[string]bool{}
			for _, r := range resp.Rejected {
				rejected[r.ExternalID] = true
				st.AddError("push", src, "", fmt.Errorf("%s: %s", r.ExternalID, r.Error))
			}
			s.Rejected += len(rejected)
			var keys []string
			for _, v := range batch {
				if !rejected[v.ExternalID] {
					keys = append(keys, v.Key())
				}
			}
			err = st.UpdateVacancies(keys, func(v *sources.Vacancy) {
				h := v.ContentHash
				v.PushedHash = &h
				if v.TaggedWith != nil {
					tw := *v.TaggedWith
					v.PushedTaggedWith = &tw
				}
			})
			if err != nil {
				return s, err
			}
		}
	}
	if !sentRun && run != nil { // отправлять нечего, но итог сбора серверу нужен
		if _, err := c.send(ctx, request{Items: []sources.Vacancy{}, Run: run}); err != nil {
			return s, err
		}
	}
	return s, nil
}
