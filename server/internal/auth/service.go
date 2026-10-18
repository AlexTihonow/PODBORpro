package auth

import (
	"context"
	"errors"
	"net/mail"
	"strings"
	"sync"
	"time"
	"unicode/utf8"

	"golang.org/x/crypto/bcrypt"

	"github.com/AlexTihonow/PODBORpro/server/internal/store"
)

const (
	bcryptCost     = 10
	minPasswordLen = 8

	maxPasswordBytes = 72
)

var (
	ErrEmailTaken         = errors.New("auth: email taken")
	ErrInvalidCredentials = errors.New("auth: invalid credentials")
)

type ValidationError struct{ Message string }

func (e *ValidationError) Error() string { return e.Message }

type Session struct {
	User      store.User
	Token     string
	ExpiresAt time.Time
}

type Service struct {
	store  *store.Store
	tokens *Tokens
}

func NewService(s *store.Store, t *Tokens) *Service {
	return &Service{store: s, tokens: t}
}

func (s *Service) Register(ctx context.Context, email, password, fullName string) (Session, error) {
	email, fullName = normalizeEmail(email), strings.TrimSpace(fullName)
	if err := validateEmail(email); err != nil {
		return Session{}, err
	}
	if err := validatePassword(password); err != nil {
		return Session{}, err
	}
	if fullName == "" {
		return Session{}, &ValidationError{"Укажите имя"}
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcryptCost)
	if err != nil {
		return Session{}, err
	}
	u, err := s.store.CreateUser(ctx, email, string(hash), fullName)
	if errors.Is(err, store.ErrEmailTaken) {
		return Session{}, ErrEmailTaken
	}
	if err != nil {
		return Session{}, err
	}
	return s.session(u)
}

func (s *Service) Login(ctx context.Context, email, password string) (Session, error) {
	u, err := s.store.GetUserByEmail(ctx, normalizeEmail(email))
	if errors.Is(err, store.ErrNotFound) {

		_ = bcrypt.CompareHashAndPassword(dummyHash(), []byte(password))
		return Session{}, ErrInvalidCredentials
	}
	if err != nil {
		return Session{}, err
	}
	if bcrypt.CompareHashAndPassword([]byte(u.PasswordHash), []byte(password)) != nil {
		return Session{}, ErrInvalidCredentials
	}
	return s.session(u)
}

func (s *Service) session(u store.User) (Session, error) {
	tok, exp, err := s.tokens.Issue(Claims{UserID: u.ID, IsAdmin: u.IsAdmin})
	return Session{User: u, Token: tok, ExpiresAt: exp}, err
}

var dummyHash = sync.OnceValue(func() []byte {
	h, _ := bcrypt.GenerateFromPassword([]byte("dummy-password"), bcryptCost)
	return h
})

func normalizeEmail(email string) string {
	return strings.ToLower(strings.TrimSpace(email))
}

func validateEmail(email string) error {
	addr, err := mail.ParseAddress(email)

	if err != nil || addr.Address != email || !strings.Contains(email[strings.LastIndex(email, "@")+1:], ".") {
		return &ValidationError{"Неверный формат почты"}
	}
	return nil
}

func validatePassword(password string) error {
	if utf8.RuneCountInString(password) < minPasswordLen {
		return &ValidationError{"Пароль должен быть не короче 8 символов"}
	}
	if len(password) > maxPasswordBytes {
		return &ValidationError{"Пароль слишком длинный"}
	}
	return nil
}
