package httpapi

import (
	"context"
	"errors"
	"net/http"
	"time"

	"github.com/AlexTihonow/PODBORpro/server/api"
	"github.com/AlexTihonow/PODBORpro/server/internal/auth"
)

func (a *API) health(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
	defer cancel()
	if err := a.db.Ping(ctx); err != nil {
		a.log.Warn("health: база недоступна", "err", err)
		writeJSON(w, http.StatusServiceUnavailable, api.Health{Status: api.HealthStatusUnavailable})
		return
	}
	writeJSON(w, http.StatusOK, api.Health{Status: api.HealthStatusOk})
}

func (a *API) register(w http.ResponseWriter, r *http.Request) {
	var req api.RegisterRequest
	if !readJSON(w, r, &req) {
		return
	}
	s, err := a.auth.Register(r.Context(), req.Email, req.Password, req.FullName)
	var verr *auth.ValidationError
	switch {
	case errors.As(err, &verr):
		writeValidation(w, verr.Message)
	case errors.Is(err, auth.ErrEmailTaken):
		writeError(w, http.StatusConflict, "email_taken", "Эта почта уже зарегистрирована")
	case err != nil:
		a.log.Error("register", "err", err)
		writeInternal(w)
	default:
		writeJSON(w, http.StatusCreated, tokenResponse(s))
	}
}

func (a *API) login(w http.ResponseWriter, r *http.Request) {
	var req api.LoginRequest
	if !readJSON(w, r, &req) {
		return
	}
	if req.Email == "" || req.Password == "" {
		writeValidation(w, "Укажите почту и пароль")
		return
	}
	s, err := a.auth.Login(r.Context(), req.Email, req.Password)
	switch {
	case errors.Is(err, auth.ErrInvalidCredentials):
		// Одно сообщение и для неверной почты, и для неверного пароля.
		writeError(w, http.StatusUnauthorized, "invalid_credentials", "Неверная почта или пароль")
	case err != nil:
		a.log.Error("login", "err", err)
		writeInternal(w)
	default:
		writeJSON(w, http.StatusOK, tokenResponse(s))
	}
}

func tokenResponse(s auth.Session) api.TokenResponse {
	return api.TokenResponse{
		AccessToken: s.Token,
		TokenType:   api.Bearer,
		ExpiresAt:   s.ExpiresAt,
		User: api.User{
			Id:       s.User.ID,
			Email:    s.User.Email,
			FullName: s.User.FullName,
			IsAdmin:  s.User.IsAdmin,
		},
	}
}
