package httpapi

import (
	"errors"
	"net/http"
	"slices"
	"strings"
	"unicode/utf8"

	"github.com/AlexTihonow/PODBORpro/server/api"
	"github.com/AlexTihonow/PODBORpro/server/internal/store"
)

func (a *API) getMe(w http.ResponseWriter, r *http.Request) {
	a.writeMe(w, r)
}

func (a *API) patchMe(w http.ResponseWriter, r *http.Request) {
	var req api.PatchMeRequest
	if !readJSON(w, r, &req) {
		return
	}
	if msg := validatePatchMe(&req); msg != "" {
		writeValidation(w, msg)
		return
	}
	if err := a.Store.UpdateMe(r.Context(), UserID(r.Context()), req); err != nil {
		a.storeError(w, "patchMe", err)
		return
	}
	a.writeMe(w, r)
}

func (a *API) writeMe(w http.ResponseWriter, r *http.Request) {
	me, err := a.Store.GetMe(r.Context(), UserID(r.Context()))
	if err != nil {
		a.storeError(w, "getMe", err)
		return
	}
	writeJSON(w, http.StatusOK, me)
}

func (a *API) storeError(w http.ResponseWriter, op string, err error) {
	if errors.Is(err, store.ErrNotFound) {
		writeNotFound(w)
		return
	}
	a.Log.Error(op, "err", err)
	writeInternal(w)
}

const (
	maxTitleLen  = 100
	maxCities    = 10
	maxCityLen   = 100
	maxSalaryRub = 10_000_000
)

func validatePatchMe(req *api.PatchMeRequest) string {
	if req.FullName != nil {
		*req.FullName = strings.TrimSpace(*req.FullName)
	}
	invalidFormat := req.WorkFormats != nil && slices.ContainsFunc(*req.WorkFormats, func(f api.WorkFormat) bool {
		return !slices.Contains([]api.WorkFormat{api.WorkFormatOffice, api.WorkFormatRemote, api.WorkFormatHybrid}, f)
	})
	rules := []struct {
		bad bool
		msg string
	}{
		{req.FullName != nil && *req.FullName == "", "Укажите имя"},
		{req.TargetTitle != nil && utf8.RuneCountInString(*req.TargetTitle) > maxTitleLen, "Должность — не длиннее 100 символов"},
		{req.TargetGrade != nil && !slices.Contains([]api.Grade{api.GradeJunior, api.GradeMiddle, api.GradeSenior}, *req.TargetGrade), "Уровень: junior, middle или senior"},
		{req.Cities != nil && len(*req.Cities) > maxCities, "Можно указать не больше 10 городов"},
		{req.Cities != nil && slices.ContainsFunc(*req.Cities, func(c string) bool { return utf8.RuneCountInString(c) > maxCityLen }), "Название города — не длиннее 100 символов"},
		{invalidFormat, "Формат работы: office, remote или hybrid"},
		{req.SalaryFrom != nil && (*req.SalaryFrom < 0 || *req.SalaryFrom > maxSalaryRub), "Зарплата — от 0 до 10 000 000"},
		{req.Tone != nil && !slices.Contains([]api.Tone{api.Formal, api.Neutral, api.Friendly}, *req.Tone), "Тон: formal, neutral или friendly"},
	}
	for _, rule := range rules {
		if rule.bad {
			return rule.msg
		}
	}
	return ""
}
