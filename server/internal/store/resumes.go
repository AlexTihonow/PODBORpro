package store

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5"
)

// ResumeUpload — файл резюме и итог его разбора.
type ResumeUpload struct {
	FileName    string
	ContentType string
	Data        []byte
	Text        string
	Parsed      any    // сохраняется как JSON
	Status      string // ready или failed
	// FullName из резюме записывается в профиль вместо DefaultName.
	FullName    string
	DefaultName string
}

// SaveResume заменяет файл резюме пользователя и обновляет статус в профиле.
func (s *Store) SaveResume(ctx context.Context, userID int64, r ResumeUpload) error {
	return pgx.BeginFunc(ctx, s.db, func(tx pgx.Tx) error {
		_, err := tx.Exec(ctx,
			`INSERT INTO resumes (user_id, file_name, content_type, data, text, parsed, uploaded_at)
			 VALUES ($1, $2, $3, $4, $5, $6, now())
			 ON CONFLICT (user_id) DO UPDATE SET
			        file_name = EXCLUDED.file_name, content_type = EXCLUDED.content_type,
			        data = EXCLUDED.data, text = EXCLUDED.text, parsed = EXCLUDED.parsed,
			        uploaded_at = now()`,
			userID, r.FileName, r.ContentType, r.Data, r.Text, r.Parsed)
		if err != nil {
			return fmt.Errorf("save resume: %w", err)
		}
		tag, err := tx.Exec(ctx,
			`UPDATE profiles SET resume_status = $2, updated_at = now() WHERE user_id = $1`, userID, r.Status)
		if err != nil {
			return fmt.Errorf("resume status: %w", err)
		}
		if tag.RowsAffected() == 0 {
			return ErrNotFound
		}
		if r.FullName != "" {
			_, err = tx.Exec(ctx,
				`UPDATE users SET full_name = $2 WHERE id = $1 AND (full_name = $3 OR full_name = '')`,
				userID, r.FullName, r.DefaultName)
			if err != nil {
				return fmt.Errorf("name from resume: %w", err)
			}
		}
		return nil
	})
}
