package handler

import (
	"encoding/json"
	"net/http"
	"server/internal/store"
)


type MeHandler struct {
	store *store.Store
}

func NewMeHandler(store *store.Store) *MeHandler {
	return &MeHandler{store: store}
}

func (h *MeHandler) GetMe(w http.ResponseWriter, r *http.Request) {
	// UserID extracts the authenticated user's ID from the context (set by requireAuth middleware)
	userID := UserID(r.Context()) 

	user, err := h.store.GetUserProfile(r.Context(), userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal_error", "не удалось получить профиль")
		return
	}

	writeJSON(w, http.StatusOK, user)
}

func (h *MeHandler) PatchMe(w http.ResponseWriter, r *http.Request) {
	userID := UserID(r.Context())

	var req model.PatchProfileRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "validation_error", "испорченный JSON")
		return
	}

	if err := validatePatchProfile(req); err != nil {
		writeError(w, http.StatusBadRequest, "validation_error", err.Error())
		return
	}

	if err := h.store.UpdateUserProfile(r.Context(), userID, req); err != nil {
		writeError(w, http.StatusInternalServerError, "internal_error", "не удалось обновить профиль")
		return
	}

	updatedUser, err := h.store.GetUserProfile(r.Context(), userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal_error", "не удалось получить обновленный профиль")
		return
	}

	writeJSON(w, http.StatusOK, updatedUser)
}