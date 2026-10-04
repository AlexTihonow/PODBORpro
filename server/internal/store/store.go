// Package store — все SQL-запросы к базе. Других мест с SQL в программе нет.
//
// # ПРАВИЛО ДОСТУПА К ЛИЧНЫМ ДАННЫМ
//
// Каждая функция, которая читает или меняет личные данные (профиль, портфолио,
// письма, отклики), обязательно принимает userID первым параметром после ctx
// и добавляет в SQL-запрос условие `AND user_id = $N`. Если запись не нашлась —
// возвращает ErrNotFound, а обработчик отвечает 404.
//
//   - Проверку невозможно забыть: без userID функцию не вызвать, код не соберётся.
//   - Чужая запись и несуществующая выглядят одинаково (404). Ответ 403 выдал бы,
//     что запись с таким номером существует.
//   - Обработчик не проверяет права сам, он просто передаёт httpapi.UserID(ctx).
//
// Образец:
//
//	func (s *Store) GetLetter(ctx context.Context, userID, letterID int64) (Letter, error) {
//	    err := s.db.QueryRow(ctx,
//	        `SELECT l.id, l.content, l.version
//	           FROM letters l JOIN applications a ON a.id = l.application_id
//	          WHERE l.id = $1 AND a.user_id = $2`,
//	        letterID, userID).Scan(&l.ID, &l.Content, &l.Version)
//	    if errors.Is(err, pgx.ErrNoRows) {
//	        return Letter{}, ErrNotFound
//	    }
//	    ...
//	}
//
// Единственное исключение — поиск пользователя по почте при входе: в этот момент
// userID ещё неизвестен.
package store

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	// ErrNotFound — записи нет или она принадлежит другому пользователю.
	ErrNotFound = errors.New("store: not found")
	// ErrEmailTaken — пользователь с такой почтой уже есть.
	ErrEmailTaken = errors.New("store: email taken")
)

// Код ошибки PostgreSQL «нарушение уникальности».
const pgUniqueViolation = "23505"

type Store struct {
	db *pgxpool.Pool
}

func New(db *pgxpool.Pool) *Store {
	return &Store{db: db}
}

// Ping проверяет, что база отвечает.
func (s *Store) Ping(ctx context.Context) error {
	return s.db.Ping(ctx)
}
