package coverletter

import (
	"context"
	"reflect"
	"strings"
	"testing"
)

// seqLLM отвечает по очереди заготовленными текстами.
type seqLLM struct {
	answers []string
	calls   [][]Message
}

func (f *seqLLM) Complete(_ context.Context, m []Message, _ float64, _ int) (Completion, error) {
	f.calls = append(f.calls, m)
	a := f.answers[min(len(f.calls)-1, len(f.answers)-1)]
	return Completion{Content: a, FinishReason: "stop"}, nil
}

var backend = Vacancy{Title: "Backend-разработчик", Company: "Консорт", Skills: []string{"Golang", "PostgreSQL", "Docker", "Apache Kafka"}}

const (
	intro = "Добрый день!\n\nМеня заинтересовала вакансия Backend-разработчика в вашей компании. Мне близки задачи по поддержке надёжной платформы и развитию сервисов. "
	outro = "\n\nБуду рад обсудить задачи команды на собеседовании и рассказать о себе подробнее. Спасибо за внимание!"
)

func TestUnsupportedClaims(t *testing.T) {
	c := Candidate{Skills: []string{"Go"}}
	for letter, want := range map[string][]string{
		"Я обладаю базовыми знаниями PostgreSQL и Docker.":         {"PostgreSQL", "Docker"},
		"У меня есть опыт работы с Kafka.":                         {"Apache Kafka"},
		"Я пишу на Go уже два года.":                               nil, // Go есть в профиле (Golang = Go)
		"Готов изучать Apache Kafka и Docker.":                     nil,
		"Вижу, что вы используете PostgreSQL, и хочу его освоить.": nil,
		"Мне интересна платформа компании.":                        nil,
		"Опыт с Google Cloud у меня небольшой.":                    nil, // «Go» внутри «Google» не считается
	} {
		got, _ := unsupportedClaims(letter, c, backend)
		if !reflect.DeepEqual(got, want) {
			t.Errorf("%q: %v, ждали %v", letter, got, want)
		}
	}
}

func TestGenerateRewritesInventedSkills(t *testing.T) {
	bad := intro + "Я обладаю базовыми знаниями PostgreSQL и опытом работы с Docker." + outro
	good := intro + "Готов быстро изучить PostgreSQL и Docker, которые используются в команде." + outro
	llm := &seqLLM{answers: []string{bad, good}}
	letter, err := NewService(llm).Generate(context.Background(), Candidate{}, backend)
	if err != nil {
		t.Fatal(err)
	}
	if letter != Clean(good) || len(llm.calls) != 2 {
		t.Fatalf("вызовов %d, письмо:\n%s", len(llm.calls), letter)
	}
	fix := llm.calls[1]
	if len(fix) != 4 || fix[2].Role != "assistant" || !strings.Contains(fix[3].Content, "PostgreSQL, Docker") {
		t.Fatalf("просьба переписать собрана неверно: %+v", fix)
	}
}

func TestGenerateDropsClaimsIfModelInsists(t *testing.T) {
	bad := intro + "Я уверенно владею Docker и Kafka." + outro
	llm := &seqLLM{answers: []string{bad, bad}}
	letter, err := NewService(llm).Generate(context.Background(), Candidate{}, backend)
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(letter, "Docker") || !strings.Contains(letter, "Добрый день!") || !strings.Contains(letter, "Спасибо за внимание!") {
		t.Fatalf("выдумка не вырезана:\n%s", letter)
	}
	if strings.Contains(letter, "\n\n\n") || strings.Contains(letter, "  ") {
		t.Fatalf("после вырезания остались пустоты:\n%q", letter)
	}
}

func TestGenerateNoRetryForHonestLetter(t *testing.T) {
	llm := &seqLLM{answers: []string{intro + "Пишу на Go, работал с PostgreSQL." + outro}}
	_, err := NewService(llm).Generate(context.Background(), Candidate{Skills: []string{"Go", "Postgres"}}, backend)
	if err != nil || len(llm.calls) != 1 {
		t.Fatalf("err=%v, вызовов %d", err, len(llm.calls))
	}
}
