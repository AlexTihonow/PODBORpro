// Package tag — этап 3: размечает вакансии в сервисе ml (Laya, POST /classify) пакетами по 32.
//
// Пороги уверенности и решение «на проверку» принимает сервис ml; сборщик ответ не меняет, только сохраняет.
package tag

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/AlexTihonow/PODBORpro/scraper/internal/data"
	"github.com/AlexTihonow/PODBORpro/scraper/internal/sources"
)

const (
	BatchSize = 32
	// MaxText — лимит модели 512 токенов; хвост описания всё равно отрежется, поэтому режем сами.
	MaxText = 1800
)

type Item struct {
	ID    string `json:"id"`
	Title string `json:"title"`
	Text  string `json:"text"`
}

type request struct {
	Items []Item `json:"items"`
}

type response struct {
	Model string `json:"model"`
	Items []struct {
		ID          string                     `json:"id"`
		Answers     map[string]json.RawMessage `json:"answers"`
		NeedsReview *bool                      `json:"needs_review"`
	} `json:"items"`
}

// Client — клиент сервиса ml.
type Client struct {
	URL  string
	HTTP *http.Client
}

func NewClient(url string) *Client {
	return &Client{URL: strings.TrimRight(url, "/"), HTTP: &http.Client{Timeout: 2 * time.Minute}}
}

func (c *Client) classify(ctx context.Context, items []Item) (*response, error) {
	body, err := json.Marshal(request{Items: items})
	if err != nil {
		return nil, err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.URL+"/classify", bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := c.HTTP.Do(req)
	if err != nil {
		return nil, fmt.Errorf("ml недоступен: %w", err)
	}
	defer resp.Body.Close()
	b, err := io.ReadAll(io.LimitReader(resp.Body, 16<<20))
	if err != nil {
		return nil, err
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("ml: ответ %d", resp.StatusCode)
	}
	var r response
	if err := json.Unmarshal(b, &r); err != nil {
		return nil, fmt.Errorf("ml: %w", err)
	}
	if r.Model == "" {
		return nil, fmt.Errorf("ml: в ответе нет model")
	}
	return &r, nil
}

type Stats struct {
	Pending int
	Tagged  int
	Missing int
}

// Run размечает все вакансии без тегов или изменившиеся после разметки. Если ml недоступен,
// этап завершается с ошибкой; уже размеченное сохранено, остальное разметится в следующий запуск.
func Run(ctx context.Context, st *data.Store, c *Client, log *slog.Logger) (Stats, error) {
	pending := st.Vacancies(sources.Vacancy.NeedsTagging)
	s := Stats{Pending: len(pending)}
	defer func() {
		log.Info("разметка", "pending", s.Pending, "tagged", s.Tagged, "missing", s.Missing)
	}()
	for start := 0; start < len(pending); start += BatchSize {
		batch := pending[start:min(start+BatchSize, len(pending))]
		items := make([]Item, len(batch))
		byID := make(map[string]sources.Vacancy, len(batch))
		for i, v := range batch {
			items[i] = Item{ID: v.Key(), Title: v.Title, Text: Text(v)}
			byID[v.Key()] = v
		}
		r, err := c.classify(ctx, items)
		if err != nil {
			return s, err
		}
		answers := map[string]int{}
		for i, it := range r.Items {
			answers[it.ID] = i
		}
		var keys []string
		for _, it := range items {
			if _, ok := answers[it.ID]; ok {
				keys = append(keys, it.ID)
			} else {
				s.Missing++
			}
		}
		err = st.UpdateVacancies(keys, func(v *sources.Vacancy) {
			it := r.Items[answers[v.Key()]]
			v.Tags, v.Labels = decode(it.Answers)
			v.NeedsReview = it.NeedsReview
			model := r.Model
			v.TaggedWith, v.TaggedHash = &model, v.ContentHash
		})
		if err != nil {
			return s, err
		}
		s.Tagged += len(keys)
	}
	return s, nil
}

// decode раскладывает ответы: "tags" — теги дерева, остальное — метки (грейд, формат работы...).
func decode(answers map[string]json.RawMessage) ([]sources.Tag, map[string]sources.Label) {
	var tags []sources.Tag
	labels := map[string]sources.Label{}
	for k, raw := range answers {
		if k == "tags" {
			_ = json.Unmarshal(raw, &tags)
			continue
		}
		var l sources.Label
		if json.Unmarshal(raw, &l) == nil {
			labels[k] = l
		}
	}
	return tags, labels
}

var (
	reqWords  = []string{"требован", "ожидаем", "ждём", "ждем", "нам важно", "необходим", "важно уметь", "requirements", "you have"}
	stopWords = []string{"условия", "предлагаем", "обязанност", "задачи", "чем предстоит", "будет плюсом", "плюсом", "о компании", "что мы даём", "что мы даем", "бонус"}
)

// Text собирает текст для Laya в порядке важности: заголовок → опыт → требования и навыки → начало описания.
func Text(v sources.Vacancy) string {
	var parts []string
	if v.Experience != "" {
		parts = append(parts, "Опыт: "+v.Experience+".")
	}
	if v.WorkFormatRaw != "" {
		parts = append(parts, "Формат работы: "+v.WorkFormatRaw+".")
	}
	req := Requirements(v.Description)
	if len(v.SkillsRaw) > 0 {
		req = strings.TrimSpace(req + " Навыки: " + strings.Join(v.SkillsRaw, ", ") + ".")
	}
	if req != "" {
		parts = append(parts, "Требования: "+req)
	}
	parts = append(parts, strings.ReplaceAll(v.Description, "\n", " "))
	return truncate(strings.Join(parts, " "), MaxText)
}

// Requirements — блок требований из описания: от заголовка «Требования:» до следующего раздела.
func Requirements(desc string) string {
	var out []string
	collecting := false
	for _, line := range strings.Split(desc, "\n") {
		low := strings.ToLower(line)
		heading := !strings.HasPrefix(line, "- ") && utf8.RuneCountInString(line) < 60
		switch {
		case heading && hasAny(low, reqWords):
			collecting = true
		case collecting && heading && hasAny(low, stopWords):
			return strings.Join(out, " ")
		case collecting:
			out = append(out, strings.TrimPrefix(line, "- "))
		}
	}
	return strings.Join(out, " ")
}

func hasAny(s string, words []string) bool {
	for _, w := range words {
		if strings.Contains(s, w) {
			return true
		}
	}
	return false
}

func truncate(s string, n int) string {
	if utf8.RuneCountInString(s) <= n {
		return s
	}
	r := []rune(s)
	return string(r[:n])
}
