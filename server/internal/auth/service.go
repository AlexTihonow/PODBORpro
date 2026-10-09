// Package auth — регистрация, вход и выдача токенов.
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

// bcryptCost — стоимость bcrypt. Медленная функция: подобрать пароль
// по украденному значению из базы долго.
const bcryptCost = 10

const minPasswordLen = 8

// bcrypt учитывает только первые 72 байта пароля; длиннее не принимаем,
// чтобы не создавать ложного ощущения надёжности.
const maxPasswordBytes = 72

var (
	ErrEmailTaken         = errors.New("auth: email taken")
	ErrInvalidCredentials = errors.New("auth: invalid credentials")
)

// ValidationError — поле запроса заполнено неверно. Message показывается человеку.
type ValidationError struct{ Message string }

func (e *ValidationError) Error() string { return e.Message }

// Session — результат регистрации или входа.
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
	email = normalizeEmail(email)
	fullName = strings.TrimSpace(fullName)
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

// Login возвращает ErrInvalidCredentials и для неизвестной почты, и для неверного пароля:
// по ответу нельзя узнать, кто зарегистрирован.
func (s *Service) Login(ctx context.Context, email, password string) (Session, error) {
	u, err := s.store.GetUserByEmail(ctx, normalizeEmail(email))
	if errors.Is(err, store.ErrNotFound) {
		// Сравниваем с заглушкой, чтобы неизвестная почта отвечала так же долго,
		// как известная, — иначе зарегистрированных можно вычислить по времени ответа.
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
	if err != nil {
		return Session{}, err
	}
	return Session{User: u, Token: tok, ExpiresAt: exp}, nil
}

var dummyHash = sync.OnceValue(func() []byte {
	h, _ := bcrypt.GenerateFromPassword([]byte("dummy-password"), bcryptCost)
	return h
})

// normalizeEmail приводит почту к одному виду перед записью и поиском,
// иначе Ivan@mail.ru и ivan@mail.ru зарегистрируются дважды.
func normalizeEmail(email string) string {
	return strings.ToLower(strings.TrimSpace(email))
}

func validateEmail(email string) error {
	addr, err := mail.ParseAddress(email)
	// ParseAddress принимает и «Иван <ivan@mail.ru>» — нам нужна только сама почта.
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
