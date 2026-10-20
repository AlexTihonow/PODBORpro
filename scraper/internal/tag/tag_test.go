package tag

import (
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"

	"github.com/AlexTihonow/PODBORpro/scraper/internal/data"
	"github.com/AlexTihonow/PODBORpro/scraper/internal/sources"
)

var quiet = slog.New(slog.NewTextHandler(io.Discard, nil))

func TestTagBatchesAndStoresAnswers(t *testing.T) {
	st, _ := data.Open(t.TempDir())
	for i := range 40 {
		v := sources.Vacancy{Source: "fake", ExternalID: strconv.Itoa(i), Title: "Go", Description: "d"}
		v.ContentHash = v.Hash()
		st.PutVacancy(v)
	}
	var batches []int
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/classify" {
			http.NotFound(w, r)
			return
		}
		var req request
		json.NewDecoder(r.Body).Decode(&req)
		batches = append(batches, len(req.Items))
		var items []string
		for _, it := range req.Items {
			items = append(items, `{"id":"`+it.ID+`","answers":{
				"tags":[{"path":"it/backend/go","confidence":0.93,"stopped":"leaf"}],
				"grade":{"value":"junior","confidence":0.88},
				"english":{"value":false,"confidence":0.91}}}`)
		}
		io.WriteString(w, `{"model":"receptron/laya-onnx@rev/multilingual","items":[`+strings.Join(items, ",")+`]}`)
	}))
	defer srv.Close()

	s, err := Run(context.Background(), st, NewClient(srv.URL), quiet)
	if err != nil {
		t.Fatal(err)
	}
	if s.Tagged != 40 || len(batches) != 2 || batches[0] != 32 {
		t.Errorf("итог %+v, пакеты %v", s, batches)
	}
	v := st.Vacancies(nil)[0]
	if v.TaggedWith == nil || *v.TaggedWith != "receptron/laya-onnx@rev/multilingual" ||
		len(v.Tags) != 1 || v.Tags[0].Path != "it/backend/go" || v.Labels["grade"].Value != "junior" {
		t.Errorf("ответ не сохранён: %+v", v)
	}

	// Повторный запуск ничего не размечает, пока вакансия не изменилась.
	s, _ = Run(context.Background(), st, NewClient(srv.URL), quiet)
	if s.Pending != 0 {
		t.Errorf("повторная разметка %d вакансий", s.Pending)
	}
}

func TestTagMLDown(t *testing.T) {
	st, _ := data.Open(t.TempDir())
	v := sources.Vacancy{Source: "fake", ExternalID: "1", Title: "Go", Description: "d"}
	v.ContentHash = v.Hash()
	st.PutVacancy(v)
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusServiceUnavailable)
	}))
	defer srv.Close()
	if _, err := Run(context.Background(), st, NewClient(srv.URL), quiet); err == nil {
		t.Fatal("ml недоступен — этап должен завершиться с ошибкой")
	}
	if st.Vacancies(nil)[0].TaggedWith != nil {
		t.Error("вакансия должна остаться без тегов")
	}
}

func TestText(t *testing.T) {
	v := sources.Vacancy{
		Title:      "Junior+ Golang разработчик",
		Experience: "1–3 года",
		SkillsRaw:  []string{"Go", "PostgreSQL"},
		Description: "Ищем разработчика в команду платёжного шлюза.\nТребования:\n- Go от года\n- SQL\n" +
			"Условия:\n- ДМС и печеньки\n" + strings.Repeat("хвост ", 1000),
	}
	got := Text(v)
	if !strings.HasPrefix(got, "Опыт: 1–3 года. Требования: Go от года SQL Навыки: Go, PostgreSQL. Ищем") {
		t.Errorf("порядок частей: %.200s", got)
	}
	if n := len([]rune(got)); n > MaxText {
		t.Errorf("длина %d > %d", n, MaxText)
	}
}
