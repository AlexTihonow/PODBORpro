package resume

import (
	"os"
	"slices"
	"strings"
	"testing"
)

func TestExtractAndParseFiles(t *testing.T) {
	for _, name := range []string{"testdata/resume.pdf", "testdata/resume.docx"} {
		t.Run(name, func(t *testing.T) {
			data, err := os.ReadFile(name)
			if err != nil {
				t.Fatal(err)
			}
			text, err := ExtractText(data)
			if err != nil {
				t.Fatal(err)
			}
			p := Parse(text, []string{"Kafka", "GitLab CI", "API", "Backend"})
			if p.FullName != "Смирнова Анна Сергеевна" {
				t.Errorf("имя %q", p.FullName)
			}
			if p.TargetTitle != "Backend-разработчик (Go)" {
				t.Errorf("должность %q", p.TargetTitle)
			}
			if p.City != "Санкт-Петербург" {
				t.Errorf("город %q", p.City)
			}
			if p.SalaryFrom != 250000 {
				t.Errorf("зарплата %d", p.SalaryFrom)
			}
			if p.Grade != "middle" {
				t.Errorf("уровень %q (опыт 4 года)", p.Grade)
			}
			if !slices.Equal(p.WorkFormats, []string{"remote"}) {
				t.Errorf("формат %v", p.WorkFormats)
			}
			for _, want := range []string{"Go", "gRPC", "REST API", "Linux", "Git", "Python", "PostgreSQL", "Redis", "Kafka", "Docker", "GitLab CI"} {
				if !slices.Contains(p.Skills, want) {
					t.Errorf("нет навыка %s в %v", want, p.Skills)
				}
			}
			for _, generic := range []string{"API", "Backend"} {
				if slices.Contains(p.Skills, generic) {
					t.Errorf("общее слово %s попало в навыки: %v", generic, p.Skills)
				}
			}
			// Golang — тот же навык, что Go: второй раз не добавляется.
			if slices.Contains(p.Skills, "Golang") {
				t.Errorf("повтор Go/Golang: %v", p.Skills)
			}
		})
	}
}

func TestParseEdgeCases(t *testing.T) {
	p := Parse("РЕЗЮМЕ\nIvan Petrov\nГородская больница №1\nОпыт работы 1 год\nGoogle, годовой отчёт", nil)
	if p.FullName != "Ivan Petrov" {
		t.Errorf("имя %q", p.FullName)
	}
	if p.City != "" {
		t.Errorf("«Городская» — не город: %q", p.City)
	}
	if slices.Contains(p.Skills, "Go") {
		t.Errorf("Go найден внутри Google/годовой: %v", p.Skills)
	}
	if p.Grade != "junior" {
		t.Errorf("уровень %q", p.Grade)
	}

	p = Parse("Петров Пётр\nДолжность: Senior Python Developer\nЗарплата от 300000 руб.", nil)
	if p.Grade != "senior" || p.SalaryFrom != 300000 || p.TargetTitle != "Senior Python Developer" {
		t.Errorf("%+v", p)
	}
}

func TestExtractRejectsOtherFiles(t *testing.T) {
	if _, err := ExtractText([]byte("просто текст")); err != ErrUnsupported {
		t.Fatalf("ожидалась ErrUnsupported, получено %v", err)
	}
	if _, err := ExtractText([]byte("%PDF-1.4 broken")); err == nil || strings.Contains(err.Error(), "panic") {
		t.Fatalf("битый PDF: %v", err)
	}
}
