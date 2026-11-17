package httpapi

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"testing"

	"github.com/AlexTihonow/PODBORpro/server/api"
	"github.com/AlexTihonow/PODBORpro/server/internal/catalog"
)

// testCatalog — каталог из вакансий с номерами 1..99.
type testCatalog struct{}

func (testCatalog) Find(_ context.Context, id int64) (catalog.Vacancy, error) {
	if id >= 100 {
		return catalog.Vacancy{}, catalog.ErrNotFound
	}
	salary, grade := 200000, "middle"
	return catalog.Vacancy{ID: id, Title: fmt.Sprintf("Go-разработчик %d", id), Company: "Яндекс",
		Grade: &grade, SalaryFrom: &salary, Source: "headhunter", URL: "https://hh.ru/vacancy/1",
		PublishedAt: "2026-11-06T11:56:56.648Z", Skills: []catalog.Skill{{ID: 1, Name: "Go"}}}, nil
}

// boardOf — колонки доски в виде "draft:3,1 sent:2" (номера вакансий по порядку position).
func boardOf(t *testing.T, items []api.Application) string {
	t.Helper()
	cols := map[api.ApplicationStatus][]string{}
	for i, it := range items {
		if want := len(cols[it.Status]); it.Position != want {
			t.Errorf("карточка %d: position %d, ожидалась %d (позиции должны быть плотными)", i, it.Position, want)
		}
		cols[it.Status] = append(cols[it.Status], fmt.Sprint(it.Vacancy.Id))
	}
	var parts []string
	for _, s := range []api.ApplicationStatus{api.Draft, api.Sent, api.Interview, api.Offer, api.Rejected} {
		if len(cols[s]) > 0 {
			parts = append(parts, string(s)+":"+strings.Join(cols[s], ","))
		}
	}
	return strings.Join(parts, " ")
}

func TestApplicationsBoard(t *testing.T) {
	srv := newDBServer(t)
	token := register(t, srv, ivan)
	other := register(t, srv, `{"email": "olga@mail.ru", "password": "s3cret-pass", "full_name": "Ольга"}`)

	list := func(t *testing.T, tok string) []api.Application {
		t.Helper()
		resp, body := do(t, srv, "GET", "/api/v1/applications", tok, "")
		if resp.StatusCode != 200 {
			t.Fatalf("GET /applications: %d %s", resp.StatusCode, body)
		}
		var page api.ApplicationPage
		must(t, json.Unmarshal(body, &page))
		if page.Total != len(page.Items) {
			t.Errorf("total %d, карточек %d", page.Total, len(page.Items))
		}
		return page.Items
	}
	ids := map[int64]int64{} // вакансия → отклик
	create := func(t *testing.T, vacancyID int64) {
		t.Helper()
		resp, body := do(t, srv, "POST", "/api/v1/applications", token, fmt.Sprintf(`{"vacancy_id": %d}`, vacancyID))
		if resp.StatusCode != 201 {
			t.Fatalf("POST /applications %d: %d %s", vacancyID, resp.StatusCode, body)
		}
		var app api.Application
		must(t, json.Unmarshal(body, &app))
		if app.Status != api.Draft || app.Position != 0 || app.Vacancy.Title == "" || app.Vacancy.SalaryFrom == nil {
			t.Fatalf("новый отклик: %s", body)
		}
		ids[vacancyID] = app.Id
	}
	move := func(t *testing.T, vacancyID int64, body string) int {
		t.Helper()
		resp, b := do(t, srv, "PATCH", fmt.Sprintf("/api/v1/applications/%d", ids[vacancyID]), token, body)
		if resp.StatusCode != 200 && resp.StatusCode < 400 {
			t.Fatalf("PATCH: %d %s", resp.StatusCode, b)
		}
		return resp.StatusCode
	}
	expect := func(t *testing.T, want string) {
		t.Helper()
		if got := boardOf(t, list(t, token)); got != want {
			t.Fatalf("доска %q, ожидалась %q", got, want)
		}
	}

	if got := list(t, token); len(got) != 0 {
		t.Fatalf("у нового пользователя доска не пуста: %v", got)
	}
	for _, v := range []int64{1, 2, 3, 4} {
		create(t, v)
	}
	expect(t, "draft:4,3,2,1")

	t.Run("повторный отклик → 409", func(t *testing.T) {
		resp, body := do(t, srv, "POST", "/api/v1/applications", token, `{"vacancy_id": 2}`)
		if resp.StatusCode != 409 || errorCode(t, body) != "application_exists" {
			t.Fatalf("%d %s", resp.StatusCode, body)
		}
	})
	t.Run("нет вакансии → 404", func(t *testing.T) {
		resp, body := do(t, srv, "POST", "/api/v1/applications", token, `{"vacancy_id": 500}`)
		if resp.StatusCode != 404 {
			t.Fatalf("%d %s", resp.StatusCode, body)
		}
	})

	move(t, 3, `{"status": "sent"}`)
	move(t, 1, `{"status": "sent", "position": 0}`)
	expect(t, "draft:4,2 sent:1,3")
	move(t, 4, `{"status": "sent", "position": 1}`)
	expect(t, "draft:2 sent:1,4,3")
	move(t, 3, `{"status": "sent", "position": 0}`) // внутри колонки
	expect(t, "draft:2 sent:3,1,4")
	move(t, 1, `{"status": "rejected", "position": 99}`)
	move(t, 2, `{"status": "rejected"}`)
	expect(t, "sent:3,4 rejected:1,2")

	t.Run("неверный статус → 400", func(t *testing.T) {
		if code := move(t, 3, `{"status": "archived"}`); code != 400 {
			t.Fatalf("%d", code)
		}
	})

	t.Run("чужой отклик не виден и не меняется", func(t *testing.T) {
		if got := list(t, other); len(got) != 0 {
			t.Fatalf("чужая доска: %v", got)
		}
		resp, _ := do(t, srv, "PATCH", fmt.Sprintf("/api/v1/applications/%d", ids[3]), other, `{"status": "offer"}`)
		if resp.StatusCode != 404 {
			t.Fatalf("PATCH чужого: %d", resp.StatusCode)
		}
		resp, _ = do(t, srv, "DELETE", fmt.Sprintf("/api/v1/applications/%d", ids[3]), other, "")
		if resp.StatusCode != 404 {
			t.Fatalf("DELETE чужого: %d", resp.StatusCode)
		}
	})

	resp, body := do(t, srv, "DELETE", fmt.Sprintf("/api/v1/applications/%d", ids[1]), token, "")
	if resp.StatusCode != 204 {
		t.Fatalf("DELETE: %d %s", resp.StatusCode, body)
	}
	expect(t, "sent:3,4 rejected:2")

	resp, body = do(t, srv, "DELETE", "/api/v1/applications?status=rejected", token, "")
	if resp.StatusCode != 204 {
		t.Fatalf("DELETE ?status: %d %s", resp.StatusCode, body)
	}
	expect(t, "sent:3,4")

	resp, _ = do(t, srv, "DELETE", "/api/v1/applications", token, "")
	if resp.StatusCode != 400 {
		t.Fatalf("DELETE без status: %d", resp.StatusCode)
	}

	t.Run("после удаления вакансию можно добавить снова", func(t *testing.T) {
		create(t, 1)
		expect(t, "draft:1 sent:3,4")
	})
}
