package coverletter

import (
	"regexp"
	"strings"
	"unicode"
	"unicode/utf8"
)

// Синонимы навыков: «Golang» и «Go» — один навык. Ключ и значение в нижнем регистре.
var skillAliases = map[string]string{
	"golang":       "go",
	"postgres":     "postgresql",
	"postgre sql":  "postgresql",
	"js":           "javascript",
	"ts":           "typescript",
	"k8s":          "kubernetes",
	"node.js":      "nodejs",
	"node":         "nodejs",
	"apache kafka": "kafka",
	"rabbit mq":    "rabbitmq",
	"ci/cd":        "ci/cd",
}

func skillKey(name string) string {
	k := strings.ToLower(strings.Join(strings.Fields(name), " "))
	if a, ok := skillAliases[k]; ok {
		return a
	}
	return k
}

// splitSkills делит навыки вакансии на те, что есть у кандидата, и те, которых нет.
func splitSkills(c Candidate, v Vacancy) (matched, missing []string) {
	own := map[string]bool{}
	for _, s := range c.Skills {
		own[skillKey(s)] = true
	}
	seen := map[string]bool{}
	for _, s := range v.Skills {
		k := skillKey(s)
		if k == "" || seen[k] {
			continue
		}
		seen[k] = true
		if own[k] {
			matched = append(matched, s)
		} else {
			missing = append(missing, s)
		}
	}
	return matched, missing
}

// spellings — как навык может быть написан в письме (имя и его синонимы).
func spellings(skill string) []string {
	key := skillKey(skill)
	out := []string{skill}
	if key != strings.ToLower(skill) {
		out = append(out, key)
	}
	for alias, canon := range skillAliases {
		if canon == key && alias != strings.ToLower(skill) {
			out = append(out, alias)
		}
	}
	return out
}

func mentions(text, skill string) bool {
	low := strings.ToLower(text)
	for _, sp := range spellings(skill) {
		sp = strings.ToLower(strings.TrimSpace(sp))
		if sp == "" {
			continue
		}
		for from := 0; from < len(low); {
			i := strings.Index(low[from:], sp)
			if i < 0 {
				break
			}
			i += from
			j := i + len(sp)
			if !wordRuneBefore(low, i) && !wordRuneAt(low, j) {
				return true
			}
			from = j
		}
	}
	return false
}

// Границы слова: «Go» не должно находиться внутри «Google» или «года».
func wordRuneBefore(s string, i int) bool {
	if i <= 0 {
		return false
	}
	r, _ := utf8.DecodeLastRuneInString(s[:i])
	return isWordRune(r)
}

func wordRuneAt(s string, i int) bool {
	if i >= len(s) {
		return false
	}
	r, _ := utf8.DecodeRuneInString(s[i:])
	return isWordRune(r)
}

func isWordRune(r rune) bool { return unicode.IsLetter(r) || unicode.IsDigit(r) }

// Признаки того, что кандидат говорит о навыке как о своём.
var claimMarkers = []string{
	"опыт", "владе", "знаю", "знани", "знаком", "работал", "работаю", "работы с", "использовал",
	"использую", "умею", "навык", "писал", "пишу", "разрабатывал", "применял", "применяю",
	"уверенн", "освоил", "компетенц", "специализир", "экспертиз",
}

// Признаки того, что навык упомянут как требование или цель обучения, а не как опыт.
var learnMarkers = []string{
	"изуч", "освоить", "научиться", "хочу", "интерес", "готов разобраться", "готов погрузиться",
	"вы используете", "используете", "в вашем стеке", "ваш стек", "требовани",
}

var sentenceEnd = regexp.MustCompile(`[^.!?\n]+[.!?]*`)

// unsupportedClaims возвращает навыки вакансии, которых нет у кандидата, но
// которые письмо подаёт как опыт кандидата, и предложения с ними.
func unsupportedClaims(letter string, c Candidate, v Vacancy) (skills []string, sentences []string) {
	_, missing := splitSkills(c, v)
	if len(missing) == 0 {
		return nil, nil
	}
	seenSkill := map[string]bool{}
	for _, sent := range sentenceEnd.FindAllString(letter, -1) {
		low := strings.ToLower(sent)
		if !containsAny(low, claimMarkers) || containsAny(low, learnMarkers) {
			continue
		}
		bad := false
		for _, s := range missing {
			if mentions(sent, s) {
				bad = true
				if k := skillKey(s); !seenSkill[k] {
					seenSkill[k] = true
					skills = append(skills, s)
				}
			}
		}
		if bad {
			sentences = append(sentences, sent)
		}
	}
	return skills, sentences
}

func containsAny(s string, subs []string) bool {
	for _, sub := range subs {
		if strings.Contains(s, sub) {
			return true
		}
	}
	return false
}

// dropSentences вырезает предложения из письма и убирает опустевшие абзацы.
func dropSentences(letter string, sentences []string) string {
	for _, s := range sentences {
		letter = strings.Replace(letter, s, "", 1)
	}
	lines := strings.Split(letter, "\n")
	for i, l := range lines {
		lines[i] = strings.TrimSpace(l)
	}
	return normalizeSpace(strings.Join(lines, "\n"))
}
