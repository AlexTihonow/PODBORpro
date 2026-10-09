// Package migrations — изменения схемы базы для goose.
//
// Файлы нумеруются по порядку (00001_init.sql, 00002_...) и встраиваются в программу,
// поэтому сервер применяет их сам при запуске — отдельный шаг не нужен.
package migrations

import (
	"context"
	"database/sql"
	"embed"
	"fmt"

	"github.com/pressly/goose/v3"
)

//go:embed *.sql
var files embed.FS

// Up применяет все ещё не применённые изменения схемы.
func Up(ctx context.Context, db *sql.DB) error {
	provider, err := goose.NewProvider(goose.DialectPostgres, db, files)
	if err != nil {
		return fmt.Errorf("goose: %w", err)
	}
	if _, err := provider.Up(ctx); err != nil {
		return fmt.Errorf("применение изменений схемы: %w", err)
	}
	return nil
}
