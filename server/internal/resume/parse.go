package resume

import (
	"regexp"
	"slices"
	"strconv"
	"strings"
	"unicode"
	"unicode/utf8"
)

// Parsed — то, что удалось найти в резюме. Пустое поле — не нашлось.
type Parsed struct {
	FullName    string
	TargetTitle string
	Grade       string // junior, middle, senior
	City        string
	SalaryFrom  int
	WorkFormats []string // office, remote, hybrid
	Skills      []string
}

const maxSkills = 50

// Parse разбирает текст резюме правилами. dictionary — известные навыки
// (встроенный список дополняется навыками из каталога вакансий).
func Parse(text string, dictionary []string) Parsed {
	lines := cleanLines(text)
	low := strings.ToLower(strings.Join(lines, "\n"))
	p := Parsed{
		FullName:    findName(lines),
		TargetTitle: findTitle(lines),
		City:        findCity(lines),
		SalaryFrom:  findSalary(lines),
		WorkFormats: findWorkFormats(low),
		Skills:      findSkills(lines, low, dictionary),
	}
	p.Grade = findGrade(p.TargetTitle, low)
	return p
}

var spaces = regexp.MustCompile(`[ \t\x{00a0}]+`)

func cleanLines(text string) []string {
	var out []string
	for _, l := range strings.Split(text, "\n") {
		if l = strings.TrimSpace(spaces.ReplaceAllString(l, " ")); l != "" {
			out = append(out, l)
		}
	}
	return out
}

// valueAfter: «Проживает: Москва» → «Москва» для любой из меток.
func valueAfter(line string, labels ...string) (string, bool) {
	low := strings.ToLower(line)
	for _, label := range labels {
		if rest, ok := strings.CutPrefix(low, label); ok {
			// После метки — разделитель или конец строки: «Городская» — не «Город».
			if rest != "" && !strings.ContainsAny(rest[:1], " :-") && !strings.HasPrefix(rest, "—") && !strings.HasPrefix(rest, "–") {
				continue
			}
			rest = strings.TrimLeft(rest, " :—-–")
			if rest == "" {
				return "", true
			}
			return strings.TrimSpace(line[len(line)-len(rest):]), true
		}
	}
	return "", false
}

// --- Имя ---

var nameStopWords = []string{
	"резюме", "resume", "cv", "curriculum", "должность", "разработчик", "developer", "engineer",
	"инженер", "программист", "менеджер", "аналитик", "опыт", "контакт", "телефон", "почта",
	"email", "проживает", "город", "навыки", "образование", "мужчина", "женщина", "лет",
}

// findName ищет ФИО в начале резюме: 2–3 слова с заглавной буквы, только буквы и дефис.
func findName(lines []string) string {
	for i, line := range lines {
		if i >= 12 {
			break
		}
		if v, ok := valueAfter(line, "фио", "имя", "name"); ok && v != "" && looksLikeName(v) {
			return v
		}
		if looksLikeName(line) {
			return line
		}
	}
	return ""
}

func looksLikeName(s string) bool {
	words := strings.Fields(s)
	if len(words) < 2 || len(words) > 3 || utf8.RuneCountInString(s) > 60 {
		return false
	}
	low := strings.ToLower(s)
	for _, stop := range nameStopWords {
		if strings.Contains(low, stop) {
			return false
		}
	}
	cyrillic := 0
	for _, w := range words {
		first, _ := utf8.DecodeRuneInString(w)
		if !unicode.IsUpper(first) || utf8.RuneCountInString(w) < 2 {
			return false
		}
		for _, r := range w {
			if !unicode.IsLetter(r) && r != '-' {
				return false
			}
			if unicode.Is(unicode.Cyrillic, r) {
				cyrillic++
			}
		}
		// «ИВАНОВ» ещё имя, «IT» или «QA» — нет.
		if isAllUpper(w) && utf8.RuneCountInString(w) < 4 {
			return false
		}
	}
	return cyrillic > 0 || len(words) == 2
}

func isAllUpper(w string) bool {
	for _, r := range w {
		if unicode.IsLetter(r) && !unicode.IsUpper(r) {
			return false
		}
	}
	return true
}

// --- Должность ---

var titleHeaders = []string{"желаемая должность и зарплата", "желаемая должность", "должность", "позиция", "position", "desired position"}

func findTitle(lines []string) string {
	for i, line := range lines {
		v, ok := valueAfter(line, titleHeaders...)
		if !ok {
			continue
		}
		if v == "" || strings.EqualFold(v, "и зарплата") {
			if i+1 < len(lines) {
				v = lines[i+1]
			}
		}
		if v = trimTitle(v); v != "" {
			return v
		}
	}
	return ""
}

func trimTitle(v string) string {
	v = strings.TrimSpace(v)
	if v == "" || utf8.RuneCountInString(v) > 100 || strings.HasSuffix(v, ":") || salaryRe.MatchString(v) {
		return ""
	}
	return v
}

// --- Город ---

func findCity(lines []string) string {
	for _, line := range lines {
		v, ok := valueAfter(line, "проживает", "город проживания", "город", "местоположение", "location", "city")
		if !ok || v == "" {
			continue
		}
		city := strings.TrimSpace(strings.SplitN(v, ",", 2)[0])
		if city != "" && utf8.RuneCountInString(city) <= 100 {
			return city
		}
	}
	return ""
}

// --- Зарплата ---

var salaryRe = regexp.MustCompile(`(?i)(?:от\s*)?(\d[\d\s]{2,})\s*[^\d\s]?\s*(?:₽|руб|р\.|rub|на руки)`)

func findSalary(lines []string) int {
	for _, line := range lines {
		m := salaryRe.FindStringSubmatch(line)
		if m == nil {
			continue
		}
		n, err := strconv.Atoi(strings.Join(strings.Fields(m[1]), ""))
		if err == nil && n >= 10_000 && n <= 10_000_000 {
			return n
		}
	}
	return 0
}

// --- Формат работы и уровень ---

func findWorkFormats(low string) []string {
	var out []string
	add := func(format string, markers ...string) {
		for _, m := range markers {
			if strings.Contains(low, m) {
				out = append(out, format)
				return
			}
		}
	}
	add("office", "полный день", "в офисе", "офисная работа")
	add("remote", "удаленная работа", "удалённая работа", "удаленно", "удалённо", "remote")
	add("hybrid", "гибрид", "hybrid")
	return out
}

var gradeWords = []struct{ grade, word string }{
	{"senior", "senior"}, {"senior", "сеньор"}, {"senior", "синьор"}, {"senior", "ведущий"}, {"senior", "lead"},
	{"middle", "middle"}, {"middle", "мидл"},
	{"junior", "junior"}, {"junior", "джун"}, {"junior", "стажер"}, {"junior", "стажёр"}, {"junior", "intern"},
}

var experienceRe = regexp.MustCompile(`опыт работы\s*[—–-]?\s*(\d+)\s*(год|лет)`)

func findGrade(title, low string) string {
	t := strings.ToLower(title)
	for _, g := range gradeWords {
		if strings.Contains(t, g.word) {
			return g.grade
		}
	}
	if m := experienceRe.FindStringSubmatch(low); m != nil {
		years, _ := strconv.Atoi(m[1])
		switch {
		case years < 2:
			return "junior"
		case years < 5:
			return "middle"
		default:
			return "senior"
		}
	}
	return ""
}

// --- Навыки ---

// BaseSkills — навыки, которые ищем всегда, даже без каталога вакансий.
var BaseSkills = []string{
	"Go", "Python", "Java", "Kotlin", "JavaScript", "TypeScript", "PHP", "C++", "C#", "Rust", "Ruby", "Swift",
	"Scala", "SQL", "PostgreSQL", "MySQL", "MongoDB", "Redis", "ClickHouse", "Elasticsearch", "Kafka",
	"RabbitMQ", "Docker", "Kubernetes", "Linux", "Git", "GitLab", "GitHub", "CI/CD", "Terraform", "Ansible",
	"Nginx", "gRPC", "REST API", "GraphQL", "Microservices", "React", "Vue.js", "Angular", "Node.js",
	"HTML", "CSS", "Django", "FastAPI", "Flask", "Spring", "Laravel", "AWS", "Prometheus", "Grafana",
	"Jira", "Figma", "Pandas", "NumPy", "PyTorch", "TensorFlow", "Machine Learning", "1С", "Selenium",
	"Playwright", "Bash", "Hadoop", "Spark", "Airflow", "Tableau", "Power BI", "Excel",
}

var skillAliases = map[string]string{
	"golang": "go", "postgres": "postgresql", "postgre sql": "postgresql", "js": "javascript",
	"ts": "typescript", "k8s": "kubernetes", "node.js": "nodejs", "node": "nodejs", "nodejs": "nodejs",
	"apache kafka": "kafka", "rabbit mq": "rabbitmq", "vue": "vue.js", "vuejs": "vue.js",
	"reactjs": "react", "react.js": "react", "микросервисы": "microservices", "rest": "rest api",
	"ci / cd": "ci/cd",
}

// SkillKey — ключ сравнения: «Golang» и «Go» — один навык.
func SkillKey(name string) string {
	k := strings.ToLower(strings.Join(strings.Fields(name), " "))
	if a, ok := skillAliases[k]; ok {
		return a
	}
	return k
}

// genericSkills — слишком общие «навыки» из каталога: в тексте резюме они
// встречаются в названиях должностей и других навыков («Backend-разработчик», «REST API»).
var genericSkills = map[string]bool{
	"api": true, "backend": true, "frontend": true, "fullstack": true, "full stack": true,
	"разработка": true, "программирование": true, "development": true, "it": true,
	"английский язык": true, "русский язык": true, "аналитика": true,
}

var skillListSep = regexp.MustCompile(`\s{2,}|\t|[,;•·▪●|]`)

func findSkills(lines []string, low string, dictionary []string) []string {
	var out []string
	seen := map[string]bool{}
	add := func(name string) {
		name = strings.Trim(strings.TrimSpace(name), ".:—-–")
		k := SkillKey(name)
		if k == "" || seen[k] || len(out) >= maxSkills {
			return
		}
		seen[k] = true
		out = append(out, name)
	}

	// Явный список: «Навыки: Go  gRPC  REST API» (так выгружает hh.ru).
	for _, line := range lines {
		v, ok := valueAfter(line, "навыки", "ключевые навыки", "skills", "технологии", "стек")
		if !ok || v == "" {
			continue
		}
		for _, part := range skillListSep.Split(v, -1) {
			if part = strings.TrimSpace(part); part != "" && utf8.RuneCountInString(part) <= 40 && len(strings.Fields(part)) <= 4 {
				add(canonical(part, dictionary))
			}
		}
	}

	// Упоминания известных навыков в тексте, по границам слова.
	known := append(slices.Clone(BaseSkills), dictionary...)
	for _, skill := range known {
		if utf8.RuneCountInString(skill) < 2 || seen[SkillKey(skill)] || genericSkills[SkillKey(skill)] {
			continue
		}
		if mentioned(low, skill) {
			add(skill)
		}
	}
	return out
}

// canonical возвращает написание навыка из словаря, если он там есть.
func canonical(name string, dictionary []string) string {
	k := SkillKey(name)
	for _, d := range append(slices.Clone(BaseSkills), dictionary...) {
		if SkillKey(d) == k {
			return d
		}
	}
	return name
}

func mentioned(low, skill string) bool {
	key := SkillKey(skill)
	spellings := []string{strings.ToLower(skill), key}
	for alias, canon := range skillAliases {
		if canon == key {
			spellings = append(spellings, alias)
		}
	}
	for _, sp := range spellings {
		if sp != "" && containsWord(low, sp) {
			return true
		}
	}
	return false
}

// containsWord: «go» не должно находиться внутри «google» или «года».
func containsWord(s, word string) bool {
	for from := 0; from < len(s); {
		i := strings.Index(s[from:], word)
		if i < 0 {
			return false
		}
		i += from
		j := i + len(word)
		if !wordRuneBefore(s, i) && !wordRuneAt(s, j) {
			return true
		}
		from = i + 1
	}
	return false
}

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

func isWordRune(r rune) bool {
	return unicode.IsLetter(r) || unicode.IsDigit(r) || r == '+' || r == '#'
}
