package logx

import (
	"bytes"
	"log/slog"
	"strings"
	"testing"
)

func TestParseLevel(t *testing.T) {
	cases := map[string]slog.Level{
		"":        slog.LevelInfo,
		"DEBUG":   slog.LevelDebug,
		"warning": slog.LevelWarn,
		"error":   slog.LevelError,
		"what":    slog.LevelInfo,
	}
	for in, want := range cases {
		if got := ParseLevel(in); got != want {
			t.Errorf("ParseLevel(%q) = %v, want %v", in, got, want)
		}
	}
}

func TestActionsAnnotations(t *testing.T) {
	var buf bytes.Buffer
	log := New(Options{Level: "debug", Actions: true, Out: &buf}).With("source", "hh")
	defer func() { active = nil }()

	end := Group("fetch")
	log.Debug("страница", "url", "https://x")
	log.Warn("сбор остановлен", "reason", "blocked")
	log.Error("ошибка\nв две строки")
	end()

	out := buf.String()
	for _, want := range []string{
		"::group::fetch\n",
		"level=DEBUG msg=страница source=hh url=https://x",
		"::warning title=scraper::сбор остановлен source=hh reason=blocked\n",
		"::error title=scraper::ошибка%0Aв две строки source=hh\n",
		"::endgroup::\n",
	} {
		if !strings.Contains(out, want) {
			t.Errorf("нет %q в\n%s", want, out)
		}
	}
	if strings.Contains(out, "::notice") || strings.Count(out, "::warning") != 1 {
		t.Errorf("лишние аннотации:\n%s", out)
	}
}

func TestPlainHasNoCommands(t *testing.T) {
	var buf bytes.Buffer
	log := New(Options{Out: &buf, Format: "json"})
	Group("x")()
	log.Debug("скрыто")
	log.Warn("видно")
	out := buf.String()
	if strings.Contains(out, "::") || strings.Contains(out, "скрыто") || !strings.Contains(out, `"msg":"видно"`) {
		t.Errorf("неожиданный вывод:\n%s", out)
	}
}
