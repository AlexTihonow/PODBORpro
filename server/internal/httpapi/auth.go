package httpapi

import (
	"context"
	"net/http"
	"strings"

	"github.com/AlexTihonow/PODBORpro/server/internal/auth"
)

type ctxKey struct{}

// requireAuth пропускает запрос дальше, только если в заголовке Authorization
// есть действующий токен. Внутри next всегда можно вызвать UserID(ctx).
//
// «Закрыто при сбое»: любая ошибка проверки — это 401, а не пропуск запроса.
func (a *API) requireAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		raw, ok := strings.CutPrefix(r.Header.Get("Authorization"), "Bearer ")
		if !ok || raw == "" {
			writeError(w, http.StatusUnauthorized, "unauthorized", "Нужно войти")
			return
		}
		claims, err := a.tokens.Parse(raw) // проверяет подпись и срок действия
		if err != nil {
			writeError(w, http.StatusUnauthorized, "unauthorized", "Нужно войти заново")
			return
		}
		ctx := context.WithValue(r.Context(), ctxKey{}, claims)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// requireAdmin — то же, что requireAuth, плюс проверка признака администратора.
// Здесь 403 допустим: адрес общий, его существование не секрет.
func (a *API) requireAdmin(next http.Handler) http.Handler {
	return a.requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !claimsFrom(r.Context()).IsAdmin {
			writeError(w, http.StatusForbidden, "forbidden", "Недостаточно прав")
			return
		}
		next.ServeHTTP(w, r)
	}))
}

// UserID — номер вошедшего пользователя. Вызывается только внутри requireAuth;
// вне его — паника, это ошибка в коде, а не в запросе.
func UserID(ctx context.Context) int64 {
	return claimsFrom(ctx).UserID
}

func claimsFrom(ctx context.Context) auth.Claims {
	return ctx.Value(ctxKey{}).(auth.Claims)
}
