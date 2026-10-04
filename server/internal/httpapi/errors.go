package httpapi

import (
	"encoding/json"
	"errors"
	"net/http"
)

// Ограничение на размер JSON в теле запроса. Файлы резюме идут отдельно, через multipart.
const maxJSONBody = 1 << 20

type apiError struct {
	Error struct {
		Code    string `json:"code"`
		Message string `json:"message"`
	} `json:"error"`
}

// writeError пишет ошибку в едином виде: {"error": {"code": "...", "message": "..."}}.
// code — для программы (по нему клиентская часть решает, что делать),
// message — для человека, показывается как есть.
func writeError(w http.ResponseWriter, status int, code, message string) {
	var e apiError
	e.Error.Code, e.Error.Message = code, message
	writeJSON(w, status, e)
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

// Частые ответы — чтобы текст и код были одинаковыми во всех обработчиках.

func writeNotFound(w http.ResponseWriter) {
	writeError(w, http.StatusNotFound, "not_found", "Не найдено")
}

func writeValidation(w http.ResponseWriter, message string) {
	writeError(w, http.StatusBadRequest, "validation_error", message)
}

func writeInternal(w http.ResponseWriter) {
	writeError(w, http.StatusInternalServerError, "internal_error", "Ошибка на сервере, попробуйте позже")
}

// readJSON разбирает тело запроса в v. Если не получилось — сам отвечает 400
// и возвращает false; обработчику остаётся только выйти.
func readJSON(w http.ResponseWriter, r *http.Request, v any) bool {
	dec := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxJSONBody))
	if err := dec.Decode(v); err != nil {
		var tooLarge *http.MaxBytesError
		if errors.As(err, &tooLarge) {
			writeError(w, http.StatusRequestEntityTooLarge, "body_too_large", "Слишком большой запрос")
			return false
		}
		writeError(w, http.StatusBadRequest, "invalid_json", "Тело запроса — не JSON нужного вида")
		return false
	}
	return true
}
