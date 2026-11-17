package store

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"

	"github.com/AlexTihonow/PODBORpro/server/api"
)

// ErrApplicationExists — отклик на эту вакансию у пользователя уже есть.
var ErrApplicationExists = errors.New("store: application exists")

// Позиции внутри колонки всегда плотные: 0, 1, 2, … — каждая запись
// (создание, перенос, удаление) перенумеровывает затронутые колонки.

const applicationCols = `id, vacancy, status, position, letter_id, created_at, updated_at`

func scanApplication(row pgx.Row) (api.Application, error) {
	var a api.Application
	err := row.Scan(&a.Id, &a.Vacancy, &a.Status, &a.Position, &a.LetterId, &a.CreatedAt, &a.UpdatedAt)
	return a, err
}

// ListApplications — карточки доски пользователя; status == "" значит все колонки.
func (s *Store) ListApplications(ctx context.Context, userID int64, status api.ApplicationStatus) ([]api.Application, error) {
	rows, err := s.db.Query(ctx,
		`SELECT `+applicationCols+` FROM applications
		  WHERE user_id = $1 AND ($2 = '' OR status = $2)
		  ORDER BY array_position(ARRAY['draft','sent','interview','offer','rejected'], status), position, id`,
		userID, string(status))
	if err != nil {
		return nil, fmt.Errorf("list applications: %w", err)
	}
	items, err := pgx.CollectRows(rows, func(row pgx.CollectableRow) (api.Application, error) {
		return scanApplication(row)
	})
	if err != nil {
		return nil, fmt.Errorf("list applications: %w", err)
	}
	return items, nil
}

// CreateApplication кладёт вакансию в «Черновик» первой карточкой.
func (s *Store) CreateApplication(ctx context.Context, userID int64, vacancy api.Vacancy) (api.Application, error) {
	var a api.Application
	err := pgx.BeginFunc(ctx, s.db, func(tx pgx.Tx) (err error) {
		if err = lockBoard(ctx, tx, userID); err != nil {
			return err
		}
		a, err = scanApplication(tx.QueryRow(ctx,
			`INSERT INTO applications (user_id, vacancy_id, vacancy, status, position)
			 VALUES ($1, $2, $3, 'draft', 0)
			 RETURNING `+applicationCols,
			userID, vacancy.Id, vacancy))
		if err != nil {
			return err
		}
		_, err = tx.Exec(ctx,
			`UPDATE applications SET position = position + 1
			  WHERE user_id = $1 AND status = 'draft' AND id <> $2`, userID, a.Id)
		return err
	})
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == pgUniqueViolation {
		return api.Application{}, ErrApplicationExists
	}
	if err != nil {
		return api.Application{}, fmt.Errorf("create application: %w", err)
	}
	return a, nil
}

// MoveApplication переносит отклик в колонку status на место position
// (nil или больше числа карточек — в конец колонки).
func (s *Store) MoveApplication(ctx context.Context, userID, id int64, status api.ApplicationStatus, position *int) (api.Application, error) {
	var a api.Application
	err := pgx.BeginFunc(ctx, s.db, func(tx pgx.Tx) error {
		if err := lockBoard(ctx, tx, userID); err != nil {
			return err
		}
		var from api.ApplicationStatus
		err := tx.QueryRow(ctx, `SELECT status FROM applications WHERE id = $1 AND user_id = $2`, id, userID).Scan(&from)
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrNotFound
		}
		if err != nil {
			return err
		}

		rows, err := tx.Query(ctx,
			`SELECT id FROM applications WHERE user_id = $1 AND status = $2 AND id <> $3 ORDER BY position, id`,
			userID, status, id)
		if err != nil {
			return err
		}
		ids, err := pgx.CollectRows(rows, pgx.RowTo[int64])
		if err != nil {
			return err
		}
		at := len(ids)
		if position != nil && *position < at {
			at = max(*position, 0)
		}
		ids = append(ids[:at], append([]int64{id}, ids[at:]...)...)

		if _, err = tx.Exec(ctx,
			`UPDATE applications SET status = $2,
			        updated_at = CASE WHEN status <> $2 THEN now() ELSE updated_at END
			  WHERE id = $1`, id, status); err != nil {
			return err
		}
		if err = renumber(ctx, tx, ids); err != nil {
			return err
		}
		if from != status {
			if err = renumberColumn(ctx, tx, userID, from); err != nil {
				return err
			}
		}
		a, err = scanApplication(tx.QueryRow(ctx, `SELECT `+applicationCols+` FROM applications WHERE id = $1`, id))
		return err
	})
	if errors.Is(err, ErrNotFound) {
		return api.Application{}, err
	}
	if err != nil {
		return api.Application{}, fmt.Errorf("move application: %w", err)
	}
	return a, nil
}

// DeleteApplication убирает отклик с доски.
func (s *Store) DeleteApplication(ctx context.Context, userID, id int64) error {
	err := pgx.BeginFunc(ctx, s.db, func(tx pgx.Tx) error {
		if err := lockBoard(ctx, tx, userID); err != nil {
			return err
		}
		var status api.ApplicationStatus
		err := tx.QueryRow(ctx,
			`DELETE FROM applications WHERE id = $1 AND user_id = $2 RETURNING status`, id, userID).Scan(&status)
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrNotFound
		}
		if err != nil {
			return err
		}
		return renumberColumn(ctx, tx, userID, status)
	})
	if errors.Is(err, ErrNotFound) {
		return err
	}
	if err != nil {
		return fmt.Errorf("delete application: %w", err)
	}
	return nil
}

// DeleteApplicationsByStatus очищает колонку доски целиком.
func (s *Store) DeleteApplicationsByStatus(ctx context.Context, userID int64, status api.ApplicationStatus) error {
	_, err := s.db.Exec(ctx, `DELETE FROM applications WHERE user_id = $1 AND status = $2`, userID, status)
	if err != nil {
		return fmt.Errorf("delete applications: %w", err)
	}
	return nil
}

// lockBoard не даёт двум одновременным запросам одного пользователя
// перемешать позиции (например, два быстрых перетаскивания подряд).
func lockBoard(ctx context.Context, tx pgx.Tx, userID int64) error {
	_, err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock(hashtext('applications'), $1::int)`, int32(userID))
	return err
}

func renumber(ctx context.Context, tx pgx.Tx, ids []int64) error {
	_, err := tx.Exec(ctx,
		`UPDATE applications a SET position = o.n - 1
		   FROM unnest($1::bigint[]) WITH ORDINALITY AS o(id, n)
		  WHERE a.id = o.id AND a.position <> o.n - 1`, ids)
	return err
}

func renumberColumn(ctx context.Context, tx pgx.Tx, userID int64, status api.ApplicationStatus) error {
	_, err := tx.Exec(ctx,
		`UPDATE applications a SET position = o.n - 1
		   FROM (SELECT id, row_number() OVER (ORDER BY position, id) AS n
		           FROM applications WHERE user_id = $1 AND status = $2) o
		  WHERE a.id = o.id AND a.position <> o.n - 1`, userID, status)
	return err
}
