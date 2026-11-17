package httpapi

import (
	"context"
	"errors"
	"net/http"
	"strconv"
	"time"

	"github.com/AlexTihonow/PODBORpro/server/api"
	"github.com/AlexTihonow/PODBORpro/server/internal/catalog"
	"github.com/AlexTihonow/PODBORpro/server/internal/store"
)

// ApplicationStore хранит доску откликов; реализует *store.Store.
type ApplicationStore interface {
	ListApplications(ctx context.Context, userID int64, status api.ApplicationStatus) ([]api.Application, error)
	CreateApplication(ctx context.Context, userID int64, vacancy api.Vacancy) (api.Application, error)
	MoveApplication(ctx context.Context, userID, id int64, status api.ApplicationStatus, position *int) (api.Application, error)
	DeleteApplication(ctx context.Context, userID, id int64) error
	DeleteApplicationsByStatus(ctx context.Context, userID int64, status api.ApplicationStatus) error
}

// ApplicationsConfig — доска откликов. Vacancies нужен, чтобы по vacancy_id
// взять карточку вакансии из каталога и сохранить её снимок.
type ApplicationsConfig struct {
	Store     ApplicationStore
	Vacancies VacancyFinder
}

func (a *API) applicationsReady(w http.ResponseWriter) bool {
	if a.Applications.Store == nil {
		writeError(w, http.StatusServiceUnavailable, "applications_unavailable", "Доска откликов временно недоступна")
		return false
	}
	return true
}

func (a *API) listApplications(w http.ResponseWriter, r *http.Request) {
	if !a.applicationsReady(w) {
		return
	}
	status, ok := parseStatusQuery(w, r, false)
	if !ok {
		return
	}
	items, err := a.Applications.Store.ListApplications(r.Context(), UserID(r.Context()), status)
	if err != nil {
		a.storeError(w, "listApplications", err)
		return
	}
	writeJSON(w, http.StatusOK, api.ApplicationPage{Items: items, Total: len(items)})
}

func (a *API) createApplication(w http.ResponseWriter, r *http.Request) {
	if !a.applicationsReady(w) {
		return
	}
	var req api.ApplicationCreate
	if !readJSON(w, r, &req) {
		return
	}
	if req.VacancyId < 1 {
		writeValidation(w, "vacancy_id — целое число больше 0")
		return
	}
	if a.Applications.Vacancies == nil {
		writeError(w, http.StatusServiceUnavailable, "applications_unavailable", "Каталог вакансий недоступен")
		return
	}
	v, err := a.Applications.Vacancies.Find(r.Context(), req.VacancyId)
	if errors.Is(err, catalog.ErrNotFound) {
		writeError(w, http.StatusNotFound, "not_found", "Вакансия не найдена")
		return
	}
	if err != nil {
		a.Log.Error("createApplication: каталог", "err", err)
		writeInternal(w)
		return
	}

	app, err := a.Applications.Store.CreateApplication(r.Context(), UserID(r.Context()), vacancyCard(v))
	if errors.Is(err, store.ErrApplicationExists) {
		writeError(w, http.StatusConflict, "application_exists", "Отклик на эту вакансию уже создан")
		return
	}
	if err != nil {
		a.storeError(w, "createApplication", err)
		return
	}
	writeJSON(w, http.StatusCreated, app)
}

func (a *API) patchApplication(w http.ResponseWriter, r *http.Request) {
	if !a.applicationsReady(w) {
		return
	}
	id, ok := parseID(w, r, "Номер отклика — целое число больше 0")
	if !ok {
		return
	}
	var req api.ApplicationPatch
	if !readJSON(w, r, &req) {
		return
	}
	if !req.Status.Valid() {
		writeValidation(w, "status — одно из: draft, sent, interview, offer, rejected")
		return
	}
	if req.Position != nil && *req.Position < 0 {
		writeValidation(w, "position — целое число от 0")
		return
	}
	app, err := a.Applications.Store.MoveApplication(r.Context(), UserID(r.Context()), id, req.Status, req.Position)
	if err != nil {
		a.storeError(w, "patchApplication", err)
		return
	}
	writeJSON(w, http.StatusOK, app)
}

func (a *API) deleteApplication(w http.ResponseWriter, r *http.Request) {
	if !a.applicationsReady(w) {
		return
	}
	id, ok := parseID(w, r, "Номер отклика — целое число больше 0")
	if !ok {
		return
	}
	if err := a.Applications.Store.DeleteApplication(r.Context(), UserID(r.Context()), id); err != nil {
		a.storeError(w, "deleteApplication", err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (a *API) deleteApplications(w http.ResponseWriter, r *http.Request) {
	if !a.applicationsReady(w) {
		return
	}
	status, ok := parseStatusQuery(w, r, true)
	if !ok {
		return
	}
	if err := a.Applications.Store.DeleteApplicationsByStatus(r.Context(), UserID(r.Context()), status); err != nil {
		a.storeError(w, "deleteApplications", err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func parseID(w http.ResponseWriter, r *http.Request, message string) (int64, bool) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil || id < 1 {
		writeValidation(w, message)
		return 0, false
	}
	return id, true
}

func parseStatusQuery(w http.ResponseWriter, r *http.Request, required bool) (api.ApplicationStatus, bool) {
	raw := r.URL.Query().Get("status")
	if raw == "" && !required {
		return "", true
	}
	status := api.ApplicationStatus(raw)
	if !status.Valid() {
		writeValidation(w, "status — одно из: draft, sent, interview, offer, rejected")
		return "", false
	}
	return status, true
}

// vacancyCard — карточка вакансии для доски (без описания).
func vacancyCard(v catalog.Vacancy) api.Vacancy {
	card := api.Vacancy{
		Id:         v.ID,
		Title:      v.Title,
		Company:    v.Company,
		City:       v.City,
		SalaryFrom: v.SalaryFrom,
		SalaryTo:   v.SalaryTo,
		Currency:   v.Currency,
		Source:     v.Source,
		Url:        v.URL,
		Skills:     make([]api.Skill, 0, len(v.Skills)),
	}
	if v.Grade != nil {
		if g := api.VacancyGrade(*v.Grade); g.Valid() {
			card.Grade = &g
		}
	}
	if v.WorkFormat != nil {
		if f := api.VacancyWorkFormat(*v.WorkFormat); f.Valid() {
			card.WorkFormat = &f
		}
	}
	if t, err := time.Parse(time.RFC3339, v.PublishedAt); err == nil {
		card.PublishedAt = t
	}
	for _, s := range v.Skills {
		card.Skills = append(card.Skills, api.Skill{Id: s.ID, Name: s.Name})
	}
	return card
}
