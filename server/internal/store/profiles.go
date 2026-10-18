package store

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"

	"github.com/AlexTihonow/PODBORpro/server/api"
)

func (s *Store) GetMe(ctx context.Context, userID int64) (api.Me, error) {
	var m api.Me
	p := &m.Profile
	err := s.db.QueryRow(ctx,
		`SELECT u.id, u.email, u.full_name, u.is_admin,
		        p.target_title, p.target_grade, p.cities, p.work_formats, p.salary_from, p.tone, p.resume_status
		   FROM users u JOIN profiles p ON p.user_id = u.id
		  WHERE u.id = $1`, userID,
	).Scan(&m.Id, &m.Email, &m.FullName, &m.IsAdmin,
		&p.TargetTitle, &p.TargetGrade, &p.Cities, &p.WorkFormats, &p.SalaryFrom, &p.Tone, &p.ResumeStatus)
	if errors.Is(err, pgx.ErrNoRows) {
		return api.Me{}, ErrNotFound
	}
	if err != nil {
		return api.Me{}, fmt.Errorf("get me: %w", err)
	}
	p.Skills = []api.Skill{}
	return m, nil
}

func (s *Store) UpdateMe(ctx context.Context, userID int64, req api.PatchMeRequest) error {
	return pgx.BeginFunc(ctx, s.db, func(tx pgx.Tx) error {
		tag, err := tx.Exec(ctx,
			`UPDATE users SET full_name = COALESCE($2, full_name) WHERE id = $1`, userID, req.FullName)
		if err != nil {
			return fmt.Errorf("update user: %w", err)
		}
		if tag.RowsAffected() == 0 {
			return ErrNotFound
		}
		_, err = tx.Exec(ctx,
			`UPDATE profiles SET
			        target_title = COALESCE($2, target_title),
			        target_grade = COALESCE($3, target_grade),
			        cities       = COALESCE($4, cities),
			        work_formats = COALESCE($5, work_formats),
			        salary_from  = COALESCE($6, salary_from),
			        tone         = COALESCE($7, tone),
			        updated_at   = now()
			  WHERE user_id = $1`,
			userID, req.TargetTitle, req.TargetGrade, req.Cities, req.WorkFormats, req.SalaryFrom, req.Tone)
		if err != nil {
			return fmt.Errorf("update profile: %w", err)
		}
		return nil
	})
}
