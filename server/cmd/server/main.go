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
	"syscall"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/jackc/pgx/v5/stdlib"

	"github.com/AlexTihonow/PODBORpro/server/internal/auth"
	"github.com/AlexTihonow/PODBORpro/server/internal/httpapi"
	"github.com/AlexTihonow/PODBORpro/server/internal/store"
	"github.com/AlexTihonow/PODBORpro/server/migrations"
)

func main() {
	migrateOnly := flag.Bool("migrate-only", false, "применить изменения схемы и выйти")
	flag.Parse()
	log := slog.New(slog.NewJSONHandler(os.Stdout, nil))
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
	handler, err := httpapi.New(httpapi.Config{
		Auth:   auth.NewService(st, tokens),
		Tokens: tokens,
		Store:  st,
		WebDir: cmp.Or(os.Getenv("WEB_DIR"), "./web/dist"),
		Log:    log,
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
