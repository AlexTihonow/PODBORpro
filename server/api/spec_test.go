package api

import (
	"net/http"
	"strconv"
	"testing"
)

func TestSpecIsValid(t *testing.T) {
	if _, err := Load(); err != nil {
		t.Fatalf("openapi.yaml не проходит проверку формата: %v", err)
	}
}

// Адреса из раздела 4.5 общего документа плюс /skills и /health.
// Убрать адрес из описания можно только вместе со строкой здесь — это изменение договора.
var requiredOperations = []string{
	"GET /health",
	"POST /auth/register",
	"POST /auth/login",
	"GET /me",
	"PATCH /me",
	"GET /skills",
	"POST /portfolio/resume",
	"POST /portfolio/github",
	"GET /portfolio/items",
	"POST /portfolio/items",
	"PATCH /portfolio/items/{id}",
	"DELETE /portfolio/items/{id}",
	"GET /vacancies",
	"GET /vacancies/{id}",
	"GET /feed",
	"POST /vacancies/{id}/letters",
	"GET /letters/{id}",
	"PATCH /letters/{id}",
	"GET /letters/{id}/versions",
	"GET /applications",
	"POST /applications",
	"PATCH /applications/{id}",
	"GET /admin/collection-runs",
	"GET /admin/data-quality",
}

func TestSpecHasAllOperations(t *testing.T) {
	doc, err := Load()
	if err != nil {
		t.Fatal(err)
	}
	have := map[string]bool{}
	for path, item := range doc.Paths.Map() {
		for method := range item.Operations() {
			have[method+" "+path] = true
		}
	}
	for _, op := range requiredOperations {
		if !have[op] {
			t.Errorf("в описании нет адреса %s", op)
		}
	}
}

// У каждого ответа с телом должен быть пример: из него сервер отвечает заглушкой,
// а клиентская часть строит свои. Каждый адрес перечисляет хотя бы одну ошибку.
func TestSpecResponsesHaveExamples(t *testing.T) {
	doc, err := Load()
	if err != nil {
		t.Fatal(err)
	}
	for path, item := range doc.Paths.Map() {
		for method, op := range item.Operations() {
			name := method + " " + path
			hasError := false
			for code, resp := range op.Responses.Map() {
				status, err := strconv.Atoi(code)
				if err != nil {
					t.Errorf("%s: код ответа %q должен быть числом", name, code)
					continue
				}
				if status >= 400 {
					hasError = true
				}
				if status == http.StatusNoContent {
					continue
				}
				mt := resp.Value.Content.Get("application/json")
				if mt == nil {
					t.Errorf("%s %s: нет тела application/json", name, code)
					continue
				}
				if mt.Example == nil && len(mt.Examples) == 0 {
					t.Errorf("%s %s: нет примера (example)", name, code)
				}
			}
			if !hasError {
				t.Errorf("%s: не перечислены коды ошибок", name)
			}
		}
	}
}
