package store

import (
	"context"
	"errors"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"server/internal/model"
)

type Store struct {
	db *pgxpool.Pool
}

func NewStore(db *pgxpool.Pool) *Store {
	return &Store{db: db}
}

// GetUserProfile takes userID as the first parameter (after ctx) to prevent data leaks.
func (s *Store) GetUserProfile(ctx context.Context, userID int) (*model.UserResponse, error) {
	var resp model.UserResponse
	
	// pgx automatically maps Postgres text[] arrays to Go []string
	query := `
		SELECT u.id, u.email, u.full_name, u.is_admin,
			   COALESCE(p.target_title, ''), COALESCE(p.target_grade, ''), 
			   COALESCE(p.cities, '{}'), COALESCE(p.work_formats, '{}'),
			   COALESCE(p.salary_from, 0), COALESCE(p.tone, 'neutral'), 
			   COALESCE(p.resume_status, 'none')
		FROM users u
		LEFT JOIN profiles p ON p.user_id = u.id
		WHERE u.id = $1
	`
	
	err := s.db.QueryRow(ctx, query, userID).Scan(
		&resp.ID, &resp.Email, &resp.FullName, &resp.IsAdmin,
		&resp.Profile.TargetTitle, &resp.Profile.TargetGrade,
		&resp.Profile.Cities, &resp.Profile.WorkFormats,
		&resp.Profile.SalaryFrom, &resp.Profile.Tone, &resp.Profile.ResumeStatus,
	)
	
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, errors.New("user not found")
	}
	if err != nil {
		return nil, err
	}
	
	return &resp, nil
}

// UpdateUserProfile uses pointers. If a pointer is nil, pgx sends SQL NULL, 
// and COALESCE keeps the existing database value.
func (s *Store) UpdateUserProfile(ctx context.Context, userID int, req model.PatchProfileRequest) error {
	query := `
		UPDATE profiles SET
			target_title = COALESCE($2, target_title),
			target_grade = COALESCE($3, target_grade),
			cities       = COALESCE($4, cities),
			work_formats = COALESCE($5, work_formats),
			salary_from  = COALESCE($6, salary_from),
			tone         = COALESCE($7, tone),
			updated_at   = now()
		WHERE user_id = $1
	`
	
	_, err := s.db.Exec(ctx, query, 
		userID, 
		req.TargetTitle, 
		req.TargetGrade, 
		req.Cities, 
		req.WorkFormats, 
		req.SalaryFrom, 
		req.Tone,
	)
	
	return err
}