package auth

import (
	"errors"
	"fmt"
	"strconv"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// TokenTTL — срок действия токена. Продления нет: по истечении нужно войти заново.
const TokenTTL = 24 * time.Hour

// minSecretLen — секрет короче 32 байт для HS256 слишком легко подобрать.
const minSecretLen = 32

// Claims — содержимое токена. Токен легко прочитать без секрета,
// поэтому здесь только номер пользователя и признак администратора.
type Claims struct {
	UserID  int64
	IsAdmin bool
}

type tokenClaims struct {
	Admin bool `json:"adm"`
	jwt.RegisteredClaims
}

// Tokens выдаёт и проверяет подписанные токены доступа (HS256).
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

// Issue выдаёт токен и возвращает момент, когда он перестанет действовать.
func (t *Tokens) Issue(c Claims) (string, time.Time, error) {
	now := t.now()
	exp := now.Add(TokenTTL).UTC().Truncate(time.Second)
	tok := jwt.NewWithClaims(jwt.SigningMethodHS256, tokenClaims{
		Admin: c.IsAdmin,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   strconv.FormatInt(c.UserID, 10),
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(exp),
		},
	})
	signed, err := tok.SignedString(t.secret)
	if err != nil {
		return "", time.Time{}, err
	}
	return signed, exp, nil
}

// Parse проверяет подпись и срок действия токена.
func (t *Tokens) Parse(raw string) (Claims, error) {
	var tc tokenClaims
	_, err := jwt.ParseWithClaims(raw, &tc,
		func(*jwt.Token) (any, error) { return t.secret, nil },
		// Только HS256: иначе токен с alg=none или чужим алгоритмом мог бы пройти проверку.
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
