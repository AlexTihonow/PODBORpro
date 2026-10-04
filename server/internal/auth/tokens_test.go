package auth

import (
	"strings"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

const testSecret = "test-secret-test-secret-test-secret!"

func TestTokenRoundTrip(t *testing.T) {
	tok, _ := NewTokens(testSecret)
	raw, exp, err := tok.Issue(Claims{UserID: 42, IsAdmin: true})
	if err != nil {
		t.Fatal(err)
	}
	if d := time.Until(exp); d < TokenTTL-time.Minute || d > TokenTTL {
		t.Errorf("срок действия %v, ожидали около %v", d, TokenTTL)
	}
	c, err := tok.Parse(raw)
	if err != nil {
		t.Fatal(err)
	}
	if c != (Claims{UserID: 42, IsAdmin: true}) {
		t.Errorf("получили %+v", c)
	}
}

func TestTokenRejected(t *testing.T) {
	tok, _ := NewTokens(testSecret)
	good, _, _ := tok.Issue(Claims{UserID: 1})

	past, _ := NewTokens(testSecret)
	past.now = func() time.Time { return time.Now().Add(-TokenTTL - time.Minute) }
	expired, _, _ := past.Issue(Claims{UserID: 1})

	other, _ := NewTokens(strings.Repeat("x", 40))
	foreign, _, _ := other.Issue(Claims{UserID: 1})

	parts := strings.Split(good, ".")
	tampered := parts[0] + "." + parts[1] + "x." + parts[2] // поменяли содержимое, подпись прежняя

	none, _ := jwt.NewWithClaims(jwt.SigningMethodNone, jwt.MapClaims{
		"sub": "1", "exp": time.Now().Add(time.Hour).Unix(),
	}).SignedString(jwt.UnsafeAllowNoneSignatureType)

	cases := map[string]string{
		"просроченный":       expired,
		"чужая подпись":      foreign,
		"изменённый":         tampered,
		"без подписи (none)": none,
		"мусор":              "abc",
		"пустой":             "",
	}
	for name, raw := range cases {
		if _, err := tok.Parse(raw); err == nil {
			t.Errorf("%s: токен принят, а должен быть отклонён", name)
		}
	}
}

func TestShortSecretRejected(t *testing.T) {
	if _, err := NewTokens("short"); err == nil {
		t.Error("короткий секрет принят")
	}
}

func TestValidateEmail(t *testing.T) {
	for _, ok := range []string{"ivan@mail.ru", "a.b+c@sub.example.com"} {
		if err := validateEmail(ok); err != nil {
			t.Errorf("%q отклонена: %v", ok, err)
		}
	}
	for _, bad := range []string{"", "ivan", "ivan@", "@mail.ru", "ivan@mail", "Иван <ivan@mail.ru>", "a b@mail.ru"} {
		if err := validateEmail(bad); err == nil {
			t.Errorf("%q принята", bad)
		}
	}
}
