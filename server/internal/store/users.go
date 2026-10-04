package store

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

type User struct {
	ID           int64
	Email        string
	PasswordHash string
	FullName     string
	IsAdmin      bool
	CreatedAt    time.Time
}

// CreateUser создаёт пользователя и пустой профиль в одной транзакции:
// профиль существует всегда, обрабатывать «профиля нет» не нужно.
// Почта должна быть уже приведена к нижнему регистру.
func (s *Store) CreateUser(ctx context.Context, email, passwordHash, fullName string) (User, error) {
	var u User
	err := pgx.BeginFunc(ctx, s.db, func(tx pgx.Tx) error {
		err := tx.QueryRow(ctx,
			`INSERT INTO users (email, password_hash, full_name)
			 VALUES ($1, $2, $3)
			 RETURNING id, email, password_hash, full_name, is_admin, created_at`,
			email, passwordHash, fullName,
		).Scan(&u.ID, &u.Email, &u.PasswordHash, &u.FullName, &u.IsAdmin, &u.CreatedAt)
		if err != nil {
			return err
		}
		_, err = tx.Exec(ctx, `INSERT INTO profiles (user_id) VALUES ($1)`, u.ID)
		return err
	})
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == pgUniqueViolation {
		return User{}, ErrEmailTaken
	}
	if err != nil {
		return User{}, fmt.Errorf("create user: %w", err)
	}
	return u, nil
}

// GetUserByEmail ищет пользователя для входа. Исключение из правила userID:
// при входе номер пользователя ещё неизвестен.
func (s *Store) GetUserByEmail(ctx context.Context, email string) (User, error) {
	var u User
	err := s.db.QueryRow(ctx,
		`SELECT id, email, password_hash, full_name, is_admin, created_at
		   FROM users
		  WHERE lower(email) = lower($1)`,
		email,
	).Scan(&u.ID, &u.Email, &u.PasswordHash, &u.FullName, &u.IsAdmin, &u.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return User{}, ErrNotFound
	}
	if err != nil {
		return User{}, fmt.Errorf("get user by email: %w", err)
	}
	return u, nil
}
