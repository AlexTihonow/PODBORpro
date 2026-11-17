package main

import (
	"cmp"
	"context"
	"errors"
	"flag"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"strconv"
	"syscall"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/jackc/pgx/v5/stdlib"

	"github.com/AlexTihonow/PODBORpro/server/internal/auth"
	"github.com/AlexTihonow/PODBORpro/server/internal/catalog"
	"github.com/AlexTihonow/PODBORpro/server/internal/coverletter"
	"github.com/AlexTihonow/PODBORpro/server/internal/dotenv"
	"github.com/AlexTihonow/PODBORpro/server/internal/httpapi"
	"github.com/AlexTihonow/PODBORpro/server/internal/store"
	"github.com/AlexTihonow/PODBORpro/server/migrations"
)

func main() {
	migrateOnly := flag.Bool("migrate-only", false, "применить изменения схемы и выйти")
	flag.Parse()
	log := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	// Локальные секреты (ZAI_API_KEY) — из .env в корне репозитория или рядом
	// с сервером; явно заданные переменные окружения важнее файла.
	envFile, err := dotenv.Load(cmp.Or(os.Getenv("ENV_FILE"), ".env"), "../.env")
	if err != nil {
		log.Error("не удалось прочитать .env", "err", err)
		os.Exit(1)
	}
	if envFile != "" {
		log.Info("настройки прочитаны из файла", "file", envFile)
	}
	if err := run(log, *migrateOnly); err != nil {
		log.Error("сервер остановлен с ошибкой", "err", err)
		os.Exit(1)
	}
}

func run(log *slog.Logger, migrateOnly bool) error {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		return errors.New("не задан DATABASE_URL")
	}
	pool, err := pgxpool.New(ctx, dbURL)
	if err != nil {
		return fmt.Errorf("подключение к базе: %w", err)
	}
	defer pool.Close()

	sqlDB := stdlib.OpenDBFromPool(pool)
	err = migrations.Up(ctx, sqlDB)
	_ = sqlDB.Close()
	if err != nil {
		return err
	}
	log.Info("изменения схемы применены")
	if migrateOnly {
		return nil
	}

	tokens, err := auth.NewTokens(os.Getenv("JWT_SECRET"))
	if err != nil {
		return fmt.Errorf("JWT_SECRET: %w", err)
	}
	st := store.New(pool)
	webDir := cmp.Or(os.Getenv("WEB_DIR"), "./web")
	letters, err := coverLetterConfig(log, webDir)
	if err != nil {
		return err
	}
	handler, err := httpapi.New(httpapi.Config{
		Auth:        auth.NewService(st, tokens),
		Tokens:      tokens,
		Store:       st,
		WebDir:      webDir,
		Log:         log,
		CoverLetter: letters,
	})
	if err != nil {
		return err
	}

	srv := &http.Server{
		Addr:              cmp.Or(os.Getenv("HTTP_ADDR"), ":8080"),
		Handler:           handler,
		ReadHeaderTimeout: 5 * time.Second,
		WriteTimeout:      45 * time.Second,
		IdleTimeout:       2 * time.Minute,
	}
	errCh := make(chan error, 1)
	go func() {
		log.Info("сервер запущен", "addr", srv.Addr)
		errCh <- srv.ListenAndServe()
	}()
	select {
	case err := <-errCh:
		return err
	case <-ctx.Done():
	}

	log.Info("останавливаюсь")
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	return srv.Shutdown(shutdownCtx)
}

// coverLetterConfig собирает генерацию писем из окружения. Без ZAI_API_KEY
// сервер стартует, а POST /vacancies/{id}/cover-letter отвечает 503.
func coverLetterConfig(log *slog.Logger, webDir string) (httpapi.CoverLetterConfig, error) {
	cfg, err := coverletter.ConfigFromEnv(os.Getenv)
	if err != nil {
		return httpapi.CoverLetterConfig{}, err
	}
	limit := 10
	if raw := os.Getenv("COVER_LETTER_LIMIT_PER_HOUR"); raw != "" {
		if limit, err = strconv.Atoi(raw); err != nil || limit < 1 {
			return httpapi.CoverLetterConfig{}, errors.New("COVER_LETTER_LIMIT_PER_HOUR: целое число больше 0")
		}
	}
	out := httpapi.CoverLetterConfig{
		Vacancies: catalog.New(cmp.Or(os.Getenv("VACANCIES_FILE"), filepath.Join(webDir, "data", "vacancies.json"))),
		Limiter:   coverletter.NewLimiter(limit, time.Hour),
		Timeout:   cfg.Timeout,
	}
	if !cfg.Enabled() {
		log.Warn("ZAI_API_KEY не задан — составление писем отключено (ответ 503)")
		return out, nil
	}
	out.Generator = coverletter.NewService(coverletter.NewClient(cfg))
	// Ключ в лог не пишем — только модель, адрес и таймаут.
	log.Info("составление писем включено", "model", cfg.Model, "base_url", cfg.BaseURL,
		"timeout_s", cfg.Timeout.Seconds(), "limit_per_hour", limit)
	return out, nil
}
