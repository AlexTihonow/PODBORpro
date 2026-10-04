package httpapi

import (
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/jackc/pgx/v5/stdlib"

	"github.com/AlexTihonow/PODBORpro/server/api"
	"github.com/AlexTihonow/PODBORpro/server/internal/auth"
	"github.com/AlexTihonow/PODBORpro/server/internal/store"
	"github.com/AlexTihonow/PODBORpro/server/migrations"
)

// Тесты регистрации и входа идут через настоящую базу.
// Нужна переменная TEST_DATABASE_URL; без неё тесты пропускаются
// (в автоматической проверке на GitHub она задана всегда).
// ВНИМАНИЕ: тест очищает таблицу users.
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
	h, err := New(Config{Auth: auth.NewService(st, tokens), Tokens: tokens, DB: st, WebDir: t.TempDir(), Log: discardLog()})
	must(t, err)
	srv := httptest.NewServer(h)
	t.Cleanup(srv.Close)
	return srv
}

const ivan = `{"email": "Ivan@Mail.ru", "password": "s3cret-pass", "full_name": "Иван Петров"}`

func TestRegisterAndLogin(t *testing.T) {
	srv := newDBServer(t)

	// Успешная регистрация: 201, токен, почта в нижнем регистре.
	resp, body := do(t, srv, "POST", "/api/v1/auth/register", "", ivan)
	if resp.StatusCode != 201 {
		t.Fatalf("регистрация: %d %s", resp.StatusCode, body)
	}
	var reg api.TokenResponse
	must(t, json.Unmarshal(body, &reg))
	if reg.AccessToken == "" || reg.User.Email != "ivan@mail.ru" || reg.User.FullName != "Иван Петров" {
		t.Fatalf("регистрация: %s", body)
	}
	// Токен из регистрации сразу работает.
	if resp, _ := do(t, srv, "GET", "/api/v1/me", reg.AccessToken, ""); resp.StatusCode != 200 {
		t.Fatalf("токен из регистрации не принят: %d", resp.StatusCode)
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
