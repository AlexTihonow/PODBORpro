package handler

import (
	"errors"
	"server/internal/model"
)

func validatePatchProfile(req model.PatchProfileRequest) error {
	if req.TargetTitle != nil && len(*req.TargetTitle) > 100 {
		return errors.New("Должность — не длиннее 100 символов")
	}
	
	if req.TargetGrade != nil {
		validGrades := map[string]bool{"junior": true, "middle": true, "senior": true}
		if !validGrades[*req.TargetGrade] {
			return errors.New("Уровень: junior, middle или senior")
		}
	}
	
	if req.Cities != nil {
		if len(*req.Cities) > 10 {
			return errors.New("Можно указать не больше 10 городов")
		}
		for _, city := range *req.Cities {
			if len(city) > 100 {
				return errors.New("Можно указать не больше 10 городов") // Or a specific city length error
			}
		}
	}
	
	if req.WorkFormats != nil {
		validFormats := map[string]bool{"office": true, "remote": true, "hybrid": true}
		for _, format := range *req.WorkFormats {
			if !validFormats[format] {
				return errors.New("Формат работы: office, remote или hybrid")
			}
		}
	}
	
	if req.SalaryFrom != nil {
		if *req.SalaryFrom < 0 || *req.SalaryFrom > 10000000 {
			return errors.New("Зарплата — от 0 до 10 000 000")
		}
	}
	
	if req.Tone != nil {
		validTones := map[string]bool{"formal": true, "neutral": true, "friendly": true}
		if !validTones[*req.Tone] {
			return errors.New("Тон: formal, neutral или friendly")
		}
	}

	return nil
}