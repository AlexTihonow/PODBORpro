package httpapi

import (
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http/httptest"
	"os"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/jackc/pgx/v5/stdlib"

	"github.com/AlexTihonow/PODBORpro/server/api"
	"github.com/AlexTihonow/PODBORpro/server/internal/auth"
	"github.com/AlexTihonow/PODBORpro/server/internal/store"
	"github.com/AlexTihonow/PODBORpro/server/migrations"
)

func newDBServer(t *testing.T) *httptest.Server {
	t.Helper()
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("TEST_DATABASE_URL не задан — тест с базой пропущен")
	}
	ctx := context.Background()
	pool, err := pgxpool.New(ctx, url)
	must(t, err)
	t.Cleanup(pool.Close)

	must(t, migrations.Up(ctx, stdlib.OpenDBFromPool(pool)))
	_, err = pool.Exec(ctx, `TRUNCATE users CASCADE`)
	must(t, err)

	st := store.New(pool)
	tokens, err := auth.NewTokens(testSecret)
	must(t, err)
	h, err := New(Config{Auth: auth.NewService(st, tokens), Tokens: tokens, Store: st, WebDir: t.TempDir(), Log: discardLog()})
	must(t, err)
	srv := httptest.NewServer(h)
	t.Cleanup(srv.Close)
	return srv
}

func register(t *testing.T, srv *httptest.Server, body string) string {
	t.Helper()
	resp, b := do(t, srv, "POST", "/api/v1/auth/register", "", body)
	if resp.StatusCode != 201 {
		t.Fatalf("регистрация: %d %s", resp.StatusCode, b)
	}
	var tr api.TokenResponse
	must(t, json.Unmarshal(b, &tr))
	return tr.AccessToken
}

const ivan = `{"email": "Ivan@Mail.ru", "password": "s3cret-pass", "full_name": "Иван Петров"}`

func TestRegisterAndLogin(t *testing.T) {
	srv := newDBServer(t)

	resp, body := do(t, srv, "POST", "/api/v1/auth/register", "", ivan)
	if resp.StatusCode != 201 {
		t.Fatalf("регистрация: %d %s", resp.StatusCode, body)
	}
	var reg api.TokenResponse
	must(t, json.Unmarshal(body, &reg))
	if reg.AccessToken == "" || reg.User.Email != "ivan@mail.ru" || reg.User.FullName != "Иван Петров" {
		t.Fatalf("регистрация: %s", body)
	}

	resp, body = do(t, srv, "GET", "/api/v1/me", reg.AccessToken, "")
	if resp.StatusCode != 200 {
		t.Fatalf("токен из регистрации не принят: %d", resp.StatusCode)
	}
	for _, want := range []string{`"target_title":null`, `"target_grade":null`, `"salary_from":null`,
		`"cities":[]`, `"skills":[]`, `"tone":"neutral"`, `"resume_status":"none"`} {
		if !strings.Contains(string(body), want) {
			t.Errorf("GET /me: нет %s в %s", want, body)
		}
	}

	t.Run("повторная почта → 409", func(t *testing.T) {
		resp, body := do(t, srv, "POST", "/api/v1/auth/register", "", ivan)
		if resp.StatusCode != 409 || errorCode(t, body) != "email_taken" {
			t.Fatalf("%d %s", resp.StatusCode, body)
		}
	})
	t.Run("почта в другом регистре → 409", func(t *testing.T) {
		resp, body := do(t, srv, "POST", "/api/v1/auth/register", "",
			`{"email": "IVAN@MAIL.RU", "password": "other-pass", "full_name": "Двойник"}`)
		if resp.StatusCode != 409 || errorCode(t, body) != "email_taken" {
			t.Fatalf("%d %s", resp.StatusCode, body)
		}
	})
	t.Run("вход с верным паролем", func(t *testing.T) {
		resp, body := do(t, srv, "POST", "/api/v1/auth/login", "", `{"email": "IVAN@mail.ru", "password": "s3cret-pass"}`)
		if resp.StatusCode != 200 {
			t.Fatalf("%d %s", resp.StatusCode, body)
		}
		var tr api.TokenResponse
		must(t, json.Unmarshal(body, &tr))
		if tr.User.Id != reg.User.Id || tr.TokenType != api.Bearer {
			t.Fatalf("%s", body)
		}
	})

	var wrongPass, unknownEmail []byte
	t.Run("вход с неверным паролем → 401", func(t *testing.T) {
		resp, body := do(t, srv, "POST", "/api/v1/auth/login", "", `{"email": "ivan@mail.ru", "password": "wrong-pass"}`)
		if resp.StatusCode != 401 || errorCode(t, body) != "invalid_credentials" {
			t.Fatalf("%d %s", resp.StatusCode, body)
		}
		wrongPass = body
	})
	t.Run("вход с неизвестной почтой → тот же ответ", func(t *testing.T) {
		resp, body := do(t, srv, "POST", "/api/v1/auth/login", "", `{"email": "nobody@mail.ru", "password": "wrong-pass"}`)
		if resp.StatusCode != 401 {
			t.Fatalf("%d %s", resp.StatusCode, body)
		}
		unknownEmail = body
	})
	if string(wrongPass) != string(unknownEmail) {
		t.Errorf("ответы различаются — по ним можно узнать, кто зарегистрирован:\n%s\n%s", wrongPass, unknownEmail)
	}
}

func TestRegisterValidation(t *testing.T) {
	srv := newDBServer(t)
	cases := map[string]string{
		"неверная почта":  `{"email": "ivan", "password": "s3cret-pass", "full_name": "Иван"}`,
		"короткий пароль": `{"email": "a@mail.ru", "password": "1234567", "full_name": "Иван"}`,
		"пустое имя":      `{"email": "a@mail.ru", "password": "s3cret-pass", "full_name": "   "}`,
		"не JSON":         `{"email":`,
		"пустое тело":     ``,
	}
	for name, body := range cases {
		t.Run(name, func(t *testing.T) {
			resp, b := do(t, srv, "POST", "/api/v1/auth/register", "", body)
			if resp.StatusCode != 400 {
				t.Fatalf("%d %s", resp.StatusCode, b)
			}
			if code := errorCode(t, b); code != "validation_error" && code != "invalid_json" {
				t.Fatalf("код %s", code)
			}
		})
	}
}

func discardLog() *slog.Logger {
	return slog.New(slog.NewTextHandler(io.Discard, nil))
}

func TestPatchMe(t *testing.T) {
	srv := newDBServer(t)
	ivanTok := register(t, srv, ivan)
	petrTok := register(t, srv, `{"email": "petr@mail.ru", "password": "s3cret-pass", "full_name": "Пётр"}`)

	resp, body := do(t, srv, "PATCH", "/api/v1/me", ivanTok,
		`{"full_name": "  Иван Сидоров ", "target_grade": "middle", "cities": ["Москва"], "work_formats": ["remote"], "salary_from": 150000}`)
	if resp.StatusCode != 200 {
		t.Fatalf("%d %s", resp.StatusCode, body)
	}

	resp, body = do(t, srv, "PATCH", "/api/v1/me", ivanTok, `{"tone": "friendly"}`)
	var me api.Me
	must(t, json.Unmarshal(body, &me))
	p := me.Profile
	if resp.StatusCode != 200 || me.FullName != "Иван Сидоров" || p.Tone != api.Friendly || *p.TargetGrade != "middle" ||
		*p.SalaryFrom != 150000 || len(p.Cities) != 1 || p.WorkFormats[0] != api.WorkFormatRemote || p.TargetTitle != nil {
		t.Fatalf("%d %s", resp.StatusCode, body)
	}

	_, body = do(t, srv, "GET", "/api/v1/me", petrTok, "")
	if !strings.Contains(string(body), `"salary_from":null`) || !strings.Contains(string(body), `"tone":"neutral"`) {
		t.Fatalf("чужой профиль изменился: %s", body)
	}

	long := `"` + strings.Repeat("Я", 101) + `"`
	for name, c := range map[string]struct {
		body, code string
	}{
		"неверный уровень":       {`{"target_grade": "lead"}`, "validation_error"},
		"11 городов":             {`{"cities": ["1","2","3","4","5","6","7","8","9","10","11"]}`, "validation_error"},
		"длинный город":          {`{"cities": [` + long + `]}`, "validation_error"},
		"длинная должность":      {`{"target_title": ` + long + `}`, "validation_error"},
		"неверный формат":        {`{"work_formats": ["moon"]}`, "validation_error"},
		"отрицательная зарплата": {`{"salary_from": -1}`, "validation_error"},
		"неверный тон":           {`{"tone": "rude"}`, "validation_error"},
		"пустое имя":             {`{"full_name": "  "}`, "validation_error"},
		"не JSON":                {`{"tone":`, "invalid_json"},
	} {
		t.Run(name, func(t *testing.T) {
			resp, b := do(t, srv, "PATCH", "/api/v1/me", ivanTok, c.body)
			if resp.StatusCode != 400 || errorCode(t, b) != c.code {
				t.Fatalf("%d %s", resp.StatusCode, b)
			}
		})
	}

	city := `"` + strings.Repeat("Я", 60) + `"`
	if resp, b := do(t, srv, "PATCH", "/api/v1/me", ivanTok, `{"cities": [`+city+`]}`); resp.StatusCode != 200 {
		t.Fatalf("город в 60 букв: %d %s", resp.StatusCode, b)
	}
}

func TestMeDeletedUser(t *testing.T) {
	srv := newDBServer(t)
	tokens, _ := auth.NewTokens(testSecret)
	tok, _, _ := tokens.Issue(auth.Claims{UserID: 999999})
	for _, m := range []string{"GET", "PATCH"} {
		if resp, b := do(t, srv, m, "/api/v1/me", tok, "{}"); resp.StatusCode != 404 || errorCode(t, b) != "not_found" {
			t.Errorf("%s: %d %s", m, resp.StatusCode, b)
		}
	}
}
