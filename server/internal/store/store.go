package store

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrNotFound = errors.New("store: not found")

	ErrEmailTaken = errors.New("store: email taken")
)

const pgUniqueViolation = "23505"

type Store struct {
	db *pgxpool.Pool
}

func New(db *pgxpool.Pool) *Store { return &Store{db: db} }

func (s *Store) Ping(ctx context.Context) error { return s.db.Ping(ctx) }

type User struct {
	ID           int64
	Email        string
	PasswordHash string
	FullName     string
	IsAdmin      bool
	CreatedAt    time.Time
}

const userCols = `id, email, password_hash, full_name, is_admin, created_at`

func scanUser(row pgx.Row) (User, error) {
	var u User
	err := row.Scan(&u.ID, &u.Email, &u.PasswordHash, &u.FullName, &u.IsAdmin, &u.CreatedAt)
	return u, err
}

func (s *Store) CreateUser(ctx context.Context, email, passwordHash, fullName string) (User, error) {
	var u User
	err := pgx.BeginFunc(ctx, s.db, func(tx pgx.Tx) (err error) {
		u, err = scanUser(tx.QueryRow(ctx,
			`INSERT INTO users (email, password_hash, full_name) VALUES ($1, $2, $3) RETURNING `+userCols,
			email, passwordHash, fullName))
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

func (s *Store) GetUserByEmail(ctx context.Context, email string) (User, error) {
	u, err := scanUser(s.db.QueryRow(ctx,
		`SELECT `+userCols+` FROM users WHERE lower(email) = lower($1)`, email))
	if errors.Is(err, pgx.ErrNoRows) {
		return User{}, ErrNotFound
	}
	if err != nil {
		return User{}, fmt.Errorf("get user by email: %w", err)
	}
	return u, nil
}
