package coverletter

import (
	"context"
	"os"
	"testing"
)

// TestSmokeRealZAI обращается к настоящему Z.AI. Запускается только вручную:
//
//	ZAI_SMOKE=1 ZAI_API_KEY=... go test -run TestSmokeRealZAI -v ./internal/coverletter/
func TestSmokeRealZAI(t *testing.T) {
	if os.Getenv("ZAI_SMOKE") != "1" {
		t.Skip("ручная проверка: задайте ZAI_SMOKE=1 и ZAI_API_KEY")
	}
	cfg, err := ConfigFromEnv(os.Getenv)
	if err != nil {
		t.Fatal(err)
	}
	if !cfg.Enabled() {
		t.Fatal("ZAI_API_KEY не задан")
	}
	c, v := sampleInput()
	letter, err := NewService(NewClient(cfg)).Generate(context.Background(), c, v)
	if err != nil {
		t.Fatal(err)
	}
	t.Logf("письмо (%d символов):\n%s", len([]rune(letter)), letter)
}
