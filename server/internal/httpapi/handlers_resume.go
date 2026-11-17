package httpapi

import (
	"context"
	"errors"
	"io"
	"mime"
	"net/http"
	"path/filepath"
	"strings"

	"github.com/AlexTihonow/PODBORpro/server/api"
	"github.com/AlexTihonow/PODBORpro/server/internal/auth"
	"github.com/AlexTihonow/PODBORpro/server/internal/resume"
	"github.com/AlexTihonow/PODBORpro/server/internal/store"
)

// ResumeStore сохраняет файл резюме; реализует *store.Store.
type ResumeStore interface {
	SaveResume(ctx context.Context, userID int64, r store.ResumeUpload) error
}

// ResumeConfig — разбор резюме правилами. Skills — дополнительный словарь
// навыков (из каталога вакансий), может быть nil.
type ResumeConfig struct {
	Store  ResumeStore
	Skills func(ctx context.Context) []string
}

func (a *API) uploadResume(w http.ResponseWriter, r *http.Request) {
	if a.Resume.Store == nil {
		writeError(w, http.StatusServiceUnavailable, "resume_unavailable", "Загрузка резюме временно недоступна")
		return
	}
	name, data, ok := readResumeFile(w, r)
	if !ok {
		return
	}
	kind := resume.Kind(data)
	if kind == "" {
		writeError(w, http.StatusBadRequest, "unsupported_file", "Нужен файл PDF или DOCX")
		return
	}

	upload := store.ResumeUpload{
		FileName:    name,
		ContentType: map[string]string{"pdf": "application/pdf", "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document"}[kind],
		Data:        data,
		Status:      string(api.ResumeStatusReady),
		DefaultName: auth.DefaultFullName,
		Parsed:      map[string]any{},
	}
	resp := api.ResumeUploadResponse{ResumeStatus: api.ResumeStatusReady}

	text, err := resume.ExtractText(data)
	if err != nil {
		// Скан без текстового слоя или битый файл: сам файл сохраняем.
		a.Log.Warn("uploadResume: текст не извлечён", "kind", kind, "err", err)
		upload.Status = string(api.ResumeStatusFailed)
		resp.ResumeStatus = api.ResumeStatusFailed
	} else {
		var dict []string
		if a.Resume.Skills != nil {
			dict = a.Resume.Skills(r.Context())
		}
		parsed := toAPIParsed(resume.Parse(text, dict))
		upload.Text, upload.Parsed, resp.Parsed = text, parsed, &parsed
		if parsed.FullName != nil {
			upload.FullName = *parsed.FullName
		}
	}

	if err := a.Resume.Store.SaveResume(r.Context(), UserID(r.Context()), upload); err != nil {
		a.storeError(w, "uploadResume", err)
		return
	}
	writeJSON(w, http.StatusOK, resp)
}

// readResumeFile читает поле file из multipart-формы, не больше resume.MaxSize.
func readResumeFile(w http.ResponseWriter, r *http.Request) (string, []byte, bool) {
	mediaType, _, _ := mime.ParseMediaType(r.Header.Get("Content-Type"))
	if mediaType != "multipart/form-data" {
		writeError(w, http.StatusBadRequest, "invalid_request", "Нужна форма multipart/form-data с полем file")
		return "", nil, false
	}
	r.Body = http.MaxBytesReader(w, r.Body, resume.MaxSize+1<<20)
	mr, err := r.MultipartReader()
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request", "Нужна форма multipart/form-data с полем file")
		return "", nil, false
	}
	for {
		part, err := mr.NextPart()
		var tooLarge *http.MaxBytesError
		switch {
		case errors.As(err, &tooLarge):
			writeError(w, http.StatusRequestEntityTooLarge, "file_too_large", "Файл больше 10 МБ")
			return "", nil, false
		case errors.Is(err, io.EOF):
			writeError(w, http.StatusBadRequest, "invalid_request", "В форме нет поля file")
			return "", nil, false
		case err != nil:
			writeError(w, http.StatusBadRequest, "invalid_request", "Не удалось прочитать форму")
			return "", nil, false
		}
		if part.FormName() != "file" {
			continue
		}
		data, err := io.ReadAll(io.LimitReader(part, resume.MaxSize+1))
		if errors.As(err, &tooLarge) || len(data) > resume.MaxSize {
			writeError(w, http.StatusRequestEntityTooLarge, "file_too_large", "Файл больше 10 МБ")
			return "", nil, false
		}
		if err != nil {
			writeError(w, http.StatusBadRequest, "invalid_request", "Не удалось прочитать файл")
			return "", nil, false
		}
		name := strings.TrimSpace(filepath.Base(part.FileName()))
		if name == "" || name == "." {
			name = "resume"
		}
		return name, data, true
	}
}

func toAPIParsed(p resume.Parsed) api.ResumeParsed {
	out := api.ResumeParsed{Skills: p.Skills, WorkFormats: []api.WorkFormat{}}
	if out.Skills == nil {
		out.Skills = []string{}
	}
	str := func(s string) *string {
		if s == "" {
			return nil
		}
		return &s
	}
	out.FullName, out.TargetTitle, out.City = str(p.FullName), str(p.TargetTitle), str(p.City)
	if p.Grade != "" {
		g := api.ResumeParsedTargetGrade(p.Grade)
		out.TargetGrade = &g
	}
	if p.SalaryFrom > 0 {
		out.SalaryFrom = &p.SalaryFrom
	}
	for _, f := range p.WorkFormats {
		out.WorkFormats = append(out.WorkFormats, api.WorkFormat(f))
	}
	return out
}
