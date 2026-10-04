// Package httpapi — обработчики REST-интерфейса /api/v1, проверка токена и единый вид ошибок.
//
// Договор описан в server/api/openapi.yaml. Адреса без настоящего обработчика
// отвечают заглушками из примеров этого описания (stubs.go).
package httpapi

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"

	"github.com/AlexTihonow/PODBORpro/server/api"
	"github.com/AlexTihonow/PODBORpro/server/internal/auth"
)

type pinger interface {
	Ping(ctx context.Context) error
}

type Config struct {
	Auth   *auth.Service
	Tokens *auth.Tokens
	DB     pinger
	// WebDir — папка с готовой сборкой клиентской части (index.html и assets/).
	WebDir string
	Log    *slog.Logger
}

type API struct {
	auth   *auth.Service
	tokens *auth.Tokens
	db     pinger
	log    *slog.Logger

	mux *http.ServeMux
	// real — адреса с настоящим обработчиком, вида "GET /me" (без /api/v1).
	real map[string]bool
}

// New собирает все маршруты: настоящие обработчики, заглушки для остальных
// адресов из описания и раздачу клиентской части.
func New(cfg Config) (http.Handler, error) {
	a := &API{
		auth:   cfg.Auth,
		tokens: cfg.Tokens,
		db:     cfg.DB,
		log:    cfg.Log,
		mux:    http.NewServeMux(),
		real:   map[string]bool{},
	}
	if a.log == nil {
		a.log = slog.Default()
	}

	a.routes()

	if err := a.registerStubs(); err != nil {
		return nil, fmt.Errorf("заглушки из описания: %w", err)
	}

	// Неизвестный адрес под /api/ — JSON-ошибка, а не index.html клиентской части.
	a.mux.HandleFunc(api.BasePath+"/", func(w http.ResponseWriter, r *http.Request) {
		writeNotFound(w)
	})
	a.mux.Handle("/", spaHandler(cfg.WebDir))

	return logRequests(a.log, a.mux), nil
}

// Доступ к адресу.
type access int

const (
	public access = iota
	user
	admin
)

// routes — настоящие обработчики. Новый адрес добавляется сюда одной строкой,
// и его заглушка пропадает сама.
func (a *API) routes() {
	a.handle("GET", "/health", public, a.health)
	a.handle("POST", "/auth/register", public, a.register)
	a.handle("POST", "/auth/login", public, a.login)
}

// handle регистрирует обработчик. path — как в openapi.yaml, без /api/v1.
func (a *API) handle(method, path string, acc access, h http.HandlerFunc) {
	a.real[method+" "+path] = true
	a.mux.Handle(method+" "+api.BasePath+path, a.wrap(acc, h))
}

func (a *API) wrap(acc access, h http.Handler) http.Handler {
	switch acc {
	case user:
		return a.requireAuth(h)
	case admin:
		return a.requireAdmin(h)
	default:
		return h
	}
}
