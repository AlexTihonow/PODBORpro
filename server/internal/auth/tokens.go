package auth

import (
	"errors"
	"fmt"
	"strconv"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

const (
	TokenTTL = 24 * time.Hour

	minSecretLen = 32
)

type Claims struct {
	UserID  int64
	IsAdmin bool
}

type tokenClaims struct {
	Admin bool `json:"adm"`
	jwt.RegisteredClaims
}

type Tokens struct {
	secret []byte
	now    func() time.Time
}

func NewTokens(secret string) (*Tokens, error) {
	if len(secret) < minSecretLen {
		return nil, fmt.Errorf("секрет токенов короче %d символов", minSecretLen)
	}
	return &Tokens{secret: []byte(secret), now: time.Now}, nil
}

func (t *Tokens) Issue(c Claims) (string, time.Time, error) {
	now := t.now()
	exp := now.Add(TokenTTL).UTC().Truncate(time.Second)
	signed, err := jwt.NewWithClaims(jwt.SigningMethodHS256, tokenClaims{
		Admin: c.IsAdmin,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   strconv.FormatInt(c.UserID, 10),
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(exp),
		},
	}).SignedString(t.secret)
	if err != nil {
		return "", time.Time{}, err
	}
	return signed, exp, nil
}

func (t *Tokens) Parse(raw string) (Claims, error) {
	var tc tokenClaims
	_, err := jwt.ParseWithClaims(raw, &tc,
		func(*jwt.Token) (any, error) { return t.secret, nil },

		jwt.WithValidMethods([]string{jwt.SigningMethodHS256.Alg()}),
		jwt.WithExpirationRequired(),
		jwt.WithTimeFunc(t.now),
	)
	if err != nil {
		return Claims{}, err
	}
	id, err := strconv.ParseInt(tc.Subject, 10, 64)
	if err != nil || id <= 0 {
		return Claims{}, errors.New("токен без номера пользователя")
	}
	return Claims{UserID: id, IsAdmin: tc.Admin}, nil
}
