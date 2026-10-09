package model

type UserResponse struct {
	ID       int     `json:"id"`
	Email    string  `json:"email"`
	FullName string  `json:"full_name"`
	IsAdmin  bool    `json:"is_admin"`
	Profile  Profile `json:"profile"`
}

type Profile struct {
	TargetTitle  string   `json:"target_title"`
	TargetGrade  string   `json:"target_grade"`
	Cities       []string `json:"cities"`
	WorkFormats  []string `json:"work_formats"`
	SalaryFrom   int      `json:"salary_from"`
	Tone         string   `json:"tone"`
	ResumeStatus string   `json:"resume_status"`
}

type PatchProfileRequest struct {
	TargetTitle *string   `json:"target_title"`
	TargetGrade *string   `json:"target_grade"`
	Cities      *[]string `json:"cities"`
	WorkFormats *[]string `json:"work_formats"`
	SalaryFrom  *int      `json:"salary_from"`
	Tone        *string   `json:"tone"`
}
