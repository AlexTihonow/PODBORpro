package push

import (
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strconv"
	"sync"
	"testing"
	"time"

	"github.com/AlexTihonow/PODBORpro/scraper/internal/data"
	"github.com/AlexTihonow/PODBORpro/scraper/internal/sources"
)

var quiet = slog.New(slog.NewTextHandler(io.Discard, nil))

// fakeServer ведёт себя как адрес импорта: не дублирует по (source, external_id),
// пустой заголовок отклоняет.
type fakeServer struct {
	mu       sync.Mutex
	stored   map[string]string // ключ → content_hash
	batches  []int
	runs     int
	failNext int
}

func (f *fakeServer) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if r.URL.Path != importPath || r.Header.Get("Authorization") != "Bearer secret" {
		w.WriteHeader(http.StatusUnauthorized)
		return
	}
	if f.failNext > 0 {
		f.failNext--
		w.WriteHeader(http.StatusBadGateway)
		return
	}
	var req request
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		return
	}
	if req.Run != nil {
		f.runs++
	}
	f.batches = append(f.batches, len(req.Items))
	var resp Response
	for _, v := range req.Items {
		switch old, ok := f.stored[v.Key()]; {
		case v.Title == "":
			resp.Rejected = append(resp.Rejected, struct {
				ExternalID string `json:"external_id"`
				Error      string `json:"error"`
			}{v.ExternalID, "пустой заголовок"})
		case !ok:
			resp.Created++
			f.stored[v.Key()] = v.ContentHash
		case old != v.ContentHash:
			resp.Updated++
			f.stored[v.Key()] = v.ContentHash
		default:
			resp.Skipped++
		}
	}
	json.NewEncoder(w).Encode(resp)
}

func put(t *testing.T, st *data.Store, n int, title string) {
	t.Helper()
	for i := range n {
		v := sources.Vacancy{Source: "fake", ExternalID: strconv.Itoa(i), URL: "u", Title: title, Description: "d"}
		v.ContentHash = v.Hash()
		if _, err := st.PutVacancy(v); err != nil {
			t.Fatal(err)
		}
	}
}

func TestPushBatchesAndNoDuplicates(t *testing.T) {
	st, _ := data.Open(t.TempDir())
	put(t, st, 250, "Go")
	bad := sources.Vacancy{Source: "fake", ExternalID: "bad", URL: "u", Description: "d"}
	bad.ContentHash = bad.Hash()
	st.PutVacancy(bad)

	fs := &fakeServer{stored: map[string]string{}, failNext: 1}
	srv := httptest.NewServer(fs)
	defer srv.Close()
	c := NewClient(srv.URL, "secret")
	c.Sleep = func(time.Duration) {}

	s, err := Push(context.Background(), st, c, &Run{}, quiet)
	if err != nil {
		t.Fatal(err)
	}
	if s.Created != 250 || s.Rejected != 1 || fs.runs != 1 {
		t.Errorf("итог %+v, итог сбора отправлен %d раз", s, fs.runs)
	}
	if len(fs.batches) != 3 || fs.batches[0] != 100 {
		t.Errorf("пакеты %v, ждали по 100", fs.batches)
	}

	// Повторная отправка: все принятые уже отмечены, остаётся только отклонённая.
	s, err = Push(context.Background(), st, c, nil, quiet)
	if err != nil {
		t.Fatal(err)
	}
	if s.Pending != 1 || s.Created != 0 {
		t.Errorf("повторная отправка: %+v, ждали created: 0", s)
	}

	// Изменилась вакансия или появились теги — отправляем снова.
	model := "laya@test"
	st.UpdateVacancies([]string{"fake:0"}, func(v *sources.Vacancy) { v.TaggedWith = &model })
	if p := st.Vacancies(sources.Vacancy.NeedsPush); len(p) != 2 {
		t.Errorf("после разметки к отправке %d, ждали 2", len(p))
	}
}

func TestPushNeedsConfig(t *testing.T) {
	st, _ := data.Open(t.TempDir())
	if _, err := Push(context.Background(), st, NewClient("", ""), nil, quiet); err == nil {
		t.Fatal("без PODBOR_URL и IMPORT_TOKEN отправка должна падать")
	}
}
