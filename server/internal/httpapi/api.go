package httpapi

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"strings"

	"github.com/AlexTihonow/PODBORpro/server/api"
	"github.com/AlexTihonow/PODBORpro/server/internal/auth"
)

type Store interface {
	Ping(ctx context.Context) error
	GetMe(ctx context.Context, userID int64) (api.Me, error)
	UpdateMe(ctx context.Context, userID int64, req api.PatchMeRequest) error
}

type Config struct {
	Auth   *auth.Service
	Tokens *auth.Tokens
	Store  Store
	WebDir string
	Log    *slog.Logger
}

type API struct {
	Config
	mux  *http.ServeMux
	real map[string]bool
}

func New(cfg Config) (http.Handler, error) {
	if cfg.Log == nil {
		cfg.Log = slog.Default()
	}
	a := &API{Config: cfg, mux: http.NewServeMux(), real: map[string]bool{}}

	a.handle("GET", "/health", public, a.health)
	a.handle("POST", "/auth/register", public, a.register)
	a.handle("POST", "/auth/login", public, a.login)
	a.handle("GET", "/me", user, a.getMe)
	a.handle("PATCH", "/me", user, a.patchMe)

	if err := a.registerStubs(); err != nil {
		return nil, fmt.Errorf("заглушки из описания: %w", err)
	}

	a.mux.HandleFunc(api.BasePath+"/", func(w http.ResponseWriter, r *http.Request) { writeNotFound(w) })
	a.mux.Handle("/", spaHandler(cfg.WebDir))
	return logRequests(a.Log, a.mux), nil
}

type access int

const (
	public access = iota
	user
	admin
)

func (a *API) handle(method, path string, acc access, h http.HandlerFunc) {
	a.real[method+" "+path] = true
	a.mux.Handle(method+" "+api.BasePath+path, a.wrap(acc, h))
}

func (a *API) wrap(acc access, h http.Handler) http.Handler {
	if acc == public {
		return h
	}
	return a.requireAuth(acc == admin, h)
}

type ctxKey struct{}

func (a *API) requireAuth(onlyAdmin bool, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		raw, ok := strings.CutPrefix(r.Header.Get("Authorization"), "Bearer ")
		if !ok || raw == "" {
			writeError(w, http.StatusUnauthorized, "unauthorized", "Нужно войти")
			return
		}
		claims, err := a.Tokens.Parse(raw)
		if err != nil {
			writeError(w, http.StatusUnauthorized, "unauthorized", "Нужно войти заново")
			return
		}
		if onlyAdmin && !claims.IsAdmin {
			writeError(w, http.StatusForbidden, "forbidden", "Недостаточно прав")
			return
		}
		next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), ctxKey{}, claims)))
	})
}

func UserID(ctx context.Context) int64 {
	return ctx.Value(ctxKey{}).(auth.Claims).UserID
}
