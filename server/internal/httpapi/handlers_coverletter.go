package httpapi

import (
	"context"
	"errors"
	"math"
	"net/http"
	"strconv"
	"time"

	"github.com/AlexTihonow/PODBORpro/server/api"
	"github.com/AlexTihonow/PODBORpro/server/internal/catalog"
	"github.com/AlexTihonow/PODBORpro/server/internal/coverletter"
)

// VacancyFinder — серверный источник вакансий (сейчас каталог из файла).
type VacancyFinder interface {
	Find(ctx context.Context, id int64) (catalog.Vacancy, error)
}

// CoverLetterGenerator — сервис из пакета coverletter.
type CoverLetterGenerator interface {
	Generate(ctx context.Context, c coverletter.Candidate, v coverletter.Vacancy) (string, error)
}

// CoverLetterConfig — зависимости генерации писем. Generator == nil значит,
// что ZAI_API_KEY не задан: адрес отвечает 503, остальной сервер работает.
type CoverLetterConfig struct {
	Generator CoverLetterGenerator
	Vacancies VacancyFinder
	Limiter   *coverletter.Limiter
	Timeout   time.Duration // сколько ждать модель; на столько же продлевается запись ответа
}

func (a *API) createCoverLetter(w http.ResponseWriter, r *http.Request) {
	cl := a.CoverLetter
	if cl.Generator == nil || cl.Vacancies == nil {
		if _, ok := parseVacancyID(w, r); ok {
			writeError(w, http.StatusServiceUnavailable, "letter_service_unavailable", "Составление писем временно недоступно")
		}
		return
	}
	id, candidate, vacancy, ok := a.coverLetterInput(w, r)
	if !ok {
		return
	}
	ctx := r.Context()
	userID := UserID(ctx)

	refund := false
	if cl.Limiter != nil {
		release, ok, retryAfter := cl.Limiter.Acquire(userID)
		if !ok {
			w.Header().Set("Retry-After", strconv.Itoa(int(math.Ceil(retryAfter.Seconds()))))
			writeError(w, http.StatusTooManyRequests, "rate_limited", "Слишком много писем подряд, попробуйте позже")
			return
		}
		defer func() { release(refund) }()
	}

	// Общий WriteTimeout сервера короче, чем ожидание модели (до двух вызовов:
	// второй — если письмо пришлось переписать), — продлеваем только здесь.
	if cl.Timeout > 0 {
		_ = http.NewResponseController(w).SetWriteDeadline(time.Now().Add(2*cl.Timeout + 15*time.Second))
	}

	start := time.Now()
	letter, err := cl.Generator.Generate(ctx, candidate, vacancy)
	// В лог — только идентификаторы, длительность и текст ошибки (без ключа и профиля).
	logArgs := []any{"user_id", userID, "vacancy_id", id, "duration_ms", time.Since(start).Milliseconds()}
	if err != nil {
		// Провайдер отказал по частоте — модель не работала, попытку не засчитываем.
		refund = errors.Is(err, coverletter.ErrProviderLimited)
		a.Log.Warn("coverLetter: генерация не удалась", append(logArgs, "err", err)...)
		writeCoverLetterError(w, err)
		return
	}
	a.Log.Info("coverLetter: письмо составлено", append(logArgs, "runes", len([]rune(letter)))...)
	writeJSON(w, http.StatusOK, api.CoverLetter{CoverLetter: letter})
}

// getCoverLetterPrompt отдаёт готовый промт (правила + профиль + вакансия) для
// внешней нейросети, если сервер сам письмо составить не смог. Модель не
// вызывается, поэтому лимит не расходуется и ключ Z.AI не нужен.
func (a *API) getCoverLetterPrompt(w http.ResponseWriter, r *http.Request) {
	if a.CoverLetter.Vacancies == nil {
		if _, ok := parseVacancyID(w, r); ok {
			writeError(w, http.StatusServiceUnavailable, "letter_service_unavailable", "Составление писем временно недоступно")
		}
		return
	}
	_, candidate, vacancy, ok := a.coverLetterInput(w, r)
	if !ok {
		return
	}
	writeJSON(w, http.StatusOK, api.CoverLetterPrompt{Prompt: coverletter.ExternalPrompt(candidate, vacancy)})
}

func parseVacancyID(w http.ResponseWriter, r *http.Request) (int64, bool) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil || id < 1 {
		writeValidation(w, "Номер вакансии — целое число больше 0")
		return 0, false
	}
	return id, true
}

// coverLetterInput достаёт вакансию из каталога и профиль вошедшего пользователя.
// При ошибке сам пишет ответ и возвращает ok=false.
func (a *API) coverLetterInput(w http.ResponseWriter, r *http.Request) (int64, coverletter.Candidate, coverletter.Vacancy, bool) {
	id, ok := parseVacancyID(w, r)
	if !ok {
		return 0, coverletter.Candidate{}, coverletter.Vacancy{}, false
	}
	ctx := r.Context()
	vacancy, err := a.CoverLetter.Vacancies.Find(ctx, id)
	if errors.Is(err, catalog.ErrNotFound) {
		writeError(w, http.StatusNotFound, "not_found", "Вакансия не найдена")
		return 0, coverletter.Candidate{}, coverletter.Vacancy{}, false
	}
	if err != nil {
		a.Log.Error("coverLetter: вакансия", "vacancy_id", id, "err", err)
		writeInternal(w)
		return 0, coverletter.Candidate{}, coverletter.Vacancy{}, false
	}
	me, err := a.Store.GetMe(ctx, UserID(ctx))
	if err != nil {
		a.storeError(w, "coverLetter: профиль", err)
		return 0, coverletter.Candidate{}, coverletter.Vacancy{}, false
	}
	return id, toCandidate(me.Profile), toVacancy(vacancy), true
}

func writeCoverLetterError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, coverletter.ErrNotConfigured):
		writeError(w, http.StatusServiceUnavailable, "letter_service_unavailable", "Составление писем временно недоступно")
	case errors.Is(err, coverletter.ErrProviderTimeout), errors.Is(err, context.DeadlineExceeded):
		writeError(w, http.StatusGatewayTimeout, "letter_provider_timeout", "Модель не успела ответить, попробуйте ещё раз")
	case errors.Is(err, coverletter.ErrProviderLimited):
		writeError(w, http.StatusTooManyRequests, "letter_provider_limited", "Сервис писем перегружен, попробуйте через минуту")
	case errors.Is(err, context.Canceled):
		// Клиент ушёл — ответ уже никто не прочитает.
		writeError(w, 499, "client_closed", "Запрос отменён")
	default:
		writeError(w, http.StatusBadGateway, "letter_provider_error", "Не удалось составить письмо, попробуйте ещё раз")
	}
}

func toCandidate(p api.Profile) coverletter.Candidate {
	c := coverletter.Candidate{Cities: p.Cities, Tone: string(p.Tone)}
	if p.TargetTitle != nil {
		c.TargetTitle = *p.TargetTitle
	}
	if p.TargetGrade != nil {
		c.TargetGrade = string(*p.TargetGrade)
	}
	for _, f := range p.WorkFormats {
		c.WorkFormats = append(c.WorkFormats, workFormatRu[string(f)])
	}
	for _, s := range p.Skills {
		c.Skills = append(c.Skills, s.Name)
	}
	return c
}

func toVacancy(v catalog.Vacancy) coverletter.Vacancy {
	out := coverletter.Vacancy{
		Title: v.Title, Company: v.Company, Skills: v.SkillNames(), Description: v.Description,
	}
	if v.City != nil {
		out.City = *v.City
	}
	if v.Grade != nil {
		out.Grade = *v.Grade
	}
	if v.WorkFormat != nil {
		out.WorkFormat = workFormatRu[*v.WorkFormat]
	}
	return out
}

var workFormatRu = map[string]string{"office": "офис", "remote": "удалённо", "hybrid": "гибрид"}
