package httpx

import (
	"bufio"
	"bytes"
	"regexp"
	"strings"
)

// Robots — правила robots.txt для одного бота (RFC 9309): берётся группа с нашим именем, иначе группа «*».
// Из подходящих правил побеждает самое длинное; при равной длине — Allow.
type Robots struct {
	rules []rule
}

type rule struct {
	allow   bool
	pattern string
	re      *regexp.Regexp
}

// AllowAll — robots.txt нет (4xx): можно всё.
var AllowAll = &Robots{}

// DisallowAll — robots.txt не получили (5xx, обрыв): по RFC 9309 считаем, что нельзя ничего.
var DisallowAll = &Robots{rules: []rule{{allow: false, pattern: "/", re: regexp.MustCompile("^/")}}}

// ParseRobots разбирает robots.txt. agent — имя бота из User-Agent, например "PODBORpro-bot".
func ParseRobots(body []byte, agent string) *Robots {
	agent = strings.ToLower(agent)
	var (
		mine, star  []rule
		haveMine    bool
		groupAgents []string
		inRules     bool
		groupIsMine bool
		groupIsStar bool
	)
	sc := bufio.NewScanner(bytes.NewReader(body))
	for sc.Scan() {
		line := sc.Text()
		if i := strings.IndexByte(line, '#'); i >= 0 {
			line = line[:i]
		}
		key, val, ok := strings.Cut(line, ":")
		if !ok {
			continue
		}
		key = strings.ToLower(strings.TrimSpace(key))
		val = strings.TrimSpace(val)
		switch key {
		case "user-agent":
			if inRules { // новая группа
				groupAgents, inRules = nil, false
			}
			groupAgents = append(groupAgents, strings.ToLower(val))
			groupIsMine, groupIsStar = false, false
			for _, a := range groupAgents {
				if a == "*" {
					groupIsStar = true
				} else if a != "" && strings.Contains(agent, a) {
					groupIsMine = true
				}
			}
			if groupIsMine {
				haveMine = true
			}
		case "allow", "disallow":
			inRules = true
			if val == "" { // пустой Disallow — ничего не запрещает
				continue
			}
			r := rule{allow: key == "allow", pattern: val, re: compile(val)}
			if groupIsMine {
				mine = append(mine, r)
			} else if groupIsStar {
				star = append(star, r)
			}
		default:
			// Sitemap, Host, Crawl-delay и прочее группу не прерывают
		}
	}
	if haveMine {
		return &Robots{rules: mine}
	}
	return &Robots{rules: star}
}

func compile(pattern string) *regexp.Regexp {
	anchored := strings.HasSuffix(pattern, "$")
	pattern = strings.TrimSuffix(pattern, "$")
	var b strings.Builder
	b.WriteString("^")
	for i, part := range strings.Split(pattern, "*") {
		if i > 0 {
			b.WriteString(".*")
		}
		b.WriteString(regexp.QuoteMeta(part))
	}
	if anchored {
		b.WriteString("$")
	}
	return regexp.MustCompile(b.String())
}

// Allowed отвечает, можно ли ходить по пути с параметрами (например "/search/vacancy?text=go").
func (r *Robots) Allowed(pathAndQuery string) bool {
	if pathAndQuery == "" {
		pathAndQuery = "/"
	}
	if pathAndQuery == "/robots.txt" {
		return true
	}
	best, allow := -1, true
	for _, rl := range r.rules {
		if !rl.re.MatchString(pathAndQuery) {
			continue
		}
		n := len(rl.pattern)
		if n > best || (n == best && rl.allow) {
			best, allow = n, rl.allow
		}
	}
	return allow
}
