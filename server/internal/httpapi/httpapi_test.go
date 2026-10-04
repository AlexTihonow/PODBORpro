package httpapi

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"

	"github.com/AlexTihonow/PODBORpro/server/api"
	"github.com/AlexTihonow/PODBORpro/server/internal/auth"
)

const testSecret = "test-secret-test-secret-test-secret!"

type okDB struct{}

func (okDB) Ping(context.Context) error { return nil }

// newTestServer — сервер без базы: годится для всего, кроме регистрации и входа.
func newTestServer(t *testing.T) (*httptest.Server, *auth.Tokens) {
	t.Helper()
	tokens, err := auth.NewTokens(testSecret)
	if err != nil {
		t.Fatal(err)
	}
	h, err := New(Config{Tokens: tokens, DB: okDB{}, WebDir: t.TempDir(), Log: discardLog()})
	if err != nil {
		t.Fatal(err)
	}
	srv := httptest.NewServer(h)
	t.Cleanup(srv.Close)
	return srv, tokens
}

func do(t *testing.T, srv *httptest.Server, method, path, token, body string) (*http.Response, []byte) {
	t.Helper()
	req, _ := http.NewRequest(method, srv.URL+path, strings.NewReader(body))
	if body != "" {
		req.Header.Set("Content-Type", "application/json")
	}
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	b, _ := io.ReadAll(resp.Body)
	return resp, b
}

func errorCode(t *testing.T, body []byte) string {
	t.Helper()
	var e apiError
	if err := json.Unmarshal(body, &e); err != nil || e.Error.Code == "" {
		t.Fatalf("ответ не в едином виде ошибки: %s", body)
	}
	return e.Error.Code
}

func TestHealth(t *testing.T) {
	srv, _ := newTestServer(t)
	resp, body := do(t, srv, "GET", "/api/v1/health", "", "")
	if resp.StatusCode != 200 || strings.TrimSpace(string(body)) != `{"status":"ok"}` {
		t.Fatalf("%d %s", resp.StatusCode, body)
	}
}

// Отсутствующий, просроченный и подделанный токен — всегда 401 в едином виде.
func TestRequireAuth(t *testing.T) {
	srv, tokens := newTestServer(t)
	good, _, _ := tokens.Issue(auth.Claims{UserID: 7})

	expired := signed(t, testSecret, jwt.MapClaims{"sub": "7", "exp": time.Now().Add(-time.Minute).Unix()})
	forged := signed(t, "another-secret-another-secret-another!", jwt.MapClaims{"sub": "7", "exp": time.Now().Add(time.Hour).Unix()})

	cases := []struct {
		name, header string
		want         int
	}{
		{"нет токена", "", 401},
		{"просроченный", expired, 401},
		{"подделанная подпись", forged, 401},
		{"мусор", "not-a-token", 401},
		{"действующий", good, 200},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			resp, body := do(t, srv, "GET", "/api/v1/me", c.header, "")
			if resp.StatusCode != c.want {
				t.Fatalf("код %d, ожидали %d: %s", resp.StatusCode, c.want, body)
			}
			if c.want == 401 && errorCode(t, body) != "unauthorized" {
				t.Fatalf("код ошибки не unauthorized: %s", body)
			}
		})
	}

	// Заголовок без «Bearer » — тоже 401.
	req, _ := http.NewRequest("GET", srv.URL+"/api/v1/me", nil)
	req.Header.Set("Authorization", good)
	resp, _ := http.DefaultClient.Do(req)
	resp.Body.Close()
	if resp.StatusCode != 401 {
		t.Fatalf("токен без Bearer: код %d", resp.StatusCode)
	}
}

func TestUserIDInHandler(t *testing.T) {
	tokens, _ := auth.NewTokens(testSecret)
	a := &API{tokens: tokens}
	var got int64
	h := a.requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		got = UserID(r.Context())
	}))
	raw, _, _ := tokens.Issue(auth.Claims{UserID: 99})
	req := httptest.NewRequest("GET", "/", nil)
	req.Header.Set("Authorization", "Bearer "+raw)
	h.ServeHTTP(httptest.NewRecorder(), req)
	if got != 99 {
		t.Fatalf("UserID = %d, ожидали 99", got)
	}
}

func TestAdminOnly(t *testing.T) {
	srv, tokens := newTestServer(t)
	userTok, _, _ := tokens.Issue(auth.Claims{UserID: 1})
	adminTok, _, _ := tokens.Issue(auth.Claims{UserID: 2, IsAdmin: true})

	resp, body := do(t, srv, "GET", "/api/v1/admin/data-quality", userTok, "")
	if resp.StatusCode != 403 || errorCode(t, body) != "forbidden" {
		t.Fatalf("обычный пользователь: %d %s", resp.StatusCode, body)
	}
	resp, _ = do(t, srv, "GET", "/api/v1/admin/data-quality", adminTok, "")
	if resp.StatusCode != 200 {
		t.Fatalf("администратор: %d", resp.StatusCode)
	}
}

// Каждый адрес из описания отвечает: настоящим обработчиком или заглушкой из примера.
func TestEveryOperationResponds(t *testing.T) {
	srv, tokens := newTestServer(t)
	adminTok, _, _ := tokens.Issue(auth.Claims{UserID: 1, IsAdmin: true})
	doc, err := api.Load()
	if err != nil {
		t.Fatal(err)
	}
	for path, item := range doc.Paths.Map() {
		for method := range item.Operations() {
			if method == "POST" && strings.HasPrefix(path, "/auth/") {
				continue // настоящие обработчики, нужна база — см. auth_db_test.go
			}
			url := api.BasePath + strings.ReplaceAll(path, "{id}", "1")
			resp, body := do(t, srv, method, url, adminTok, "")
			if resp.StatusCode < 200 || resp.StatusCode >= 300 {
				t.Errorf("%s %s: код %d: %s", method, path, resp.StatusCode, body)
				continue
			}
			if resp.StatusCode != http.StatusNoContent && !json.Valid(body) {
				t.Errorf("%s %s: ответ не JSON: %s", method, path, body)
			}
		}
	}
}

func TestStubReturnsExample(t *testing.T) {
	srv, tokens := newTestServer(t)
	tok, _, _ := tokens.Issue(auth.Claims{UserID: 1})
	resp, body := do(t, srv, "GET", "/api/v1/vacancies/4821", tok, "")
	if resp.StatusCode != 200 || resp.Header.Get("X-Stub") != "true" {
		t.Fatalf("%d %s", resp.StatusCode, body)
	}
	var v api.VacancyDetails
	if err := json.Unmarshal(body, &v); err != nil {
		t.Fatal(err)
	}
	if v.Id != 4821 || v.SalaryFrom == nil || v.SalaryTo != nil || len(v.AlsoOn) == 0 {
		t.Fatalf("пример собран неверно: %+v", v)
	}
	// Пустое значение — null, а не отсутствующее поле.
	if !strings.Contains(string(body), `"salary_to":null`) {
		t.Fatalf("нет salary_to: null в %s", body)
	}
}

func TestUnknownAPIPathIsJSON404(t *testing.T) {
	srv, _ := newTestServer(t)
	resp, body := do(t, srv, "GET", "/api/v1/no-such-thing", "", "")
	if resp.StatusCode != 404 || errorCode(t, body) != "not_found" {
		t.Fatalf("%d %s", resp.StatusCode, body)
	}
}

func TestSPAFallback(t *testing.T) {
	dir := t.TempDir()
	must(t, os.WriteFile(filepath.Join(dir, "index.html"), []byte("<html>app</html>"), 0o644))
	must(t, os.MkdirAll(filepath.Join(dir, "assets"), 0o755))
	must(t, os.WriteFile(filepath.Join(dir, "assets", "app.js"), []byte("console.log(1)"), 0o644))

	tokens, _ := auth.NewTokens(testSecret)
	h, err := New(Config{Tokens: tokens, DB: okDB{}, WebDir: dir, Log: discardLog()})
	must(t, err)
	srv := httptest.NewServer(h)
	defer srv.Close()

	for path, want := range map[string]string{
		"/":              "<html>app</html>",
		"/feed":          "<html>app</html>",
		"/letters/15":    "<html>app</html>",
		"/assets/app.js": "console.log(1)",
	} {
		resp, body := do(t, srv, "GET", path, "", "")
		if resp.StatusCode != 200 || string(body) != want {
			t.Errorf("%s: %d %q", path, resp.StatusCode, body)
		}
	}
}

func signed(t *testing.T, secret string, c jwt.MapClaims) string {
	t.Helper()
	s, err := jwt.NewWithClaims(jwt.SigningMethodHS256, c).SignedString([]byte(secret))
	must(t, err)
	return s
}

func must(t *testing.T, err error) {
	t.Helper()
	if err != nil {
		t.Fatal(err)
	}
}
