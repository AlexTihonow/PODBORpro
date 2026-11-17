// Package logx настраивает slog для скрепера.
//
// Уровень и формат берутся из окружения:
//
//	LOG_LEVEL  debug | info | warn | error (по умолчанию info)
//	LOG_FORMAT text | json (по умолчанию text)
//
// В GitHub Actions (GITHUB_ACTIONS=true) логи пишутся в stdout, предупреждения
// и ошибки дополнительно выводятся командами ::warning:: и ::error::, чтобы
// попасть в аннотации запуска, а этапы сворачиваются в группы ::group::.
package logx

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"os"
	"strings"
	"sync"
)

// Options описывает, куда и как писать логи. Пустые поля берутся из окружения.
type Options struct {
	Level   string
	Format  string
	Actions bool
	Out     io.Writer
}

// FromEnv собирает Options из переменных окружения.
func FromEnv() Options {
	o := Options{
		Level:   os.Getenv("LOG_LEVEL"),
		Format:  os.Getenv("LOG_FORMAT"),
		Actions: os.Getenv("GITHUB_ACTIONS") == "true",
		Out:     os.Stderr,
	}
	if o.Actions {
		o.Out = os.Stdout
	}
	return o
}

// New создаёт логгер.
func New(o Options) *slog.Logger {
	if o.Out == nil {
		o.Out = os.Stderr
	}
	w := &lockedWriter{w: o.Out}
	opts := &slog.HandlerOptions{Level: ParseLevel(o.Level)}
	var h slog.Handler
	if strings.EqualFold(o.Format, "json") {
		h = slog.NewJSONHandler(w, opts)
	} else {
		h = slog.NewTextHandler(w, opts)
	}
	if o.Actions {
		h = &actionsHandler{Handler: h, w: w}
		active = w
	}
	return slog.New(h)
}

// ParseLevel переводит строку в уровень; неизвестные значения дают info.
func ParseLevel(s string) slog.Level {
	switch strings.ToLower(strings.TrimSpace(s)) {
	case "debug":
		return slog.LevelDebug
	case "warn", "warning":
		return slog.LevelWarn
	case "error":
		return slog.LevelError
	}
	return slog.LevelInfo
}

// active — вывод GitHub Actions; nil вне Actions.
var active *lockedWriter

// Group открывает сворачиваемую группу в логе GitHub Actions и возвращает
// функцию, которая её закрывает. Вне Actions ничего не делает.
func Group(title string) func() {
	w := active
	if w == nil {
		return func() {}
	}
	w.printf("::group::%s\n", escapeData(title))
	return func() { w.printf("::endgroup::\n") }
}

type lockedWriter struct {
	mu sync.Mutex
	w  io.Writer
}

func (l *lockedWriter) Write(p []byte) (int, error) {
	l.mu.Lock()
	defer l.mu.Unlock()
	return l.w.Write(p)
}

func (l *lockedWriter) printf(format string, args ...any) {
	l.mu.Lock()
	defer l.mu.Unlock()
	fmt.Fprintf(l.w, format, args...)
}

// actionsHandler пишет обычную строку лога и, для warn и error, аннотацию.
type actionsHandler struct {
	slog.Handler
	w     *lockedWriter
	attrs []slog.Attr
}

func (h *actionsHandler) Handle(ctx context.Context, r slog.Record) error {
	if err := h.Handler.Handle(ctx, r); err != nil {
		return err
	}
	cmd := ""
	switch {
	case r.Level >= slog.LevelError:
		cmd = "error"
	case r.Level >= slog.LevelWarn:
		cmd = "warning"
	default:
		return nil
	}
	var b strings.Builder
	b.WriteString(r.Message)
	write := func(a slog.Attr) bool {
		if a.Value.Kind() == slog.KindGroup {
			return true
		}
		fmt.Fprintf(&b, " %s=%v", a.Key, a.Value.Resolve())
		return true
	}
	for _, a := range h.attrs {
		write(a)
	}
	r.Attrs(write)
	h.w.printf("::%s title=scraper::%s\n", cmd, escapeData(b.String()))
	return nil
}

func (h *actionsHandler) WithAttrs(attrs []slog.Attr) slog.Handler {
	return &actionsHandler{
		Handler: h.Handler.WithAttrs(attrs),
		w:       h.w,
		attrs:   append(append([]slog.Attr{}, h.attrs...), attrs...),
	}
}

func (h *actionsHandler) WithGroup(name string) slog.Handler {
	return &actionsHandler{Handler: h.Handler.WithGroup(name), w: h.w, attrs: h.attrs}
}

// escapeData экранирует текст команды GitHub Actions.
func escapeData(s string) string {
	return strings.NewReplacer("%", "%25", "\r", "%0D", "\n", "%0A").Replace(s)
}
