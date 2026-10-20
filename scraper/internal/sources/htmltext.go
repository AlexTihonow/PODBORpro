package sources

import (
	"context"
	"net/url"
	"regexp"
	"strings"

	"github.com/PuerkitoBio/goquery"
	"golang.org/x/net/html"

	"github.com/AlexTihonow/PODBORpro/scraper/internal/httpx"
)

// Getter скачивает страницы сайта; это httpx.Client одного сайта.
type Getter interface {
	Get(ctx context.Context, url string) (httpx.Response, error)
	Allowed(ctx context.Context, url string) bool
}

var blockTags = map[string]bool{
	"p": true, "div": true, "br": true, "li": true, "ul": true, "ol": true, "tr": true,
	"h1": true, "h2": true, "h3": true, "h4": true, "h5": true, "h6": true, "section": true,
	"article": true, "blockquote": true, "pre": true, "table": true,
}

var (
	spaces     = regexp.MustCompile(`[ \t\r\f\v\x{00a0}\x{200b}]+`)
	emptyLines = regexp.MustCompile(`\n{2,}`)
)

// Text — текст выбранных узлов без HTML-тегов: абзацы и пункты списков через перевод строки.
func Text(sel *goquery.Selection) string {
	var b strings.Builder
	var walk func(n *html.Node)
	walk = func(n *html.Node) {
		switch n.Type {
		case html.TextNode:
			b.WriteString(n.Data)
			return
		case html.ElementNode:
			switch n.Data {
			case "script", "style", "noscript", "template":
				return
			}
		}
		block := n.Type == html.ElementNode && blockTags[n.Data]
		if block {
			b.WriteString("\n")
			if n.Data == "li" {
				b.WriteString("- ")
			}
		}
		for c := n.FirstChild; c != nil; c = c.NextSibling {
			walk(c)
		}
		if block {
			b.WriteString("\n")
		}
	}
	for _, n := range sel.Nodes {
		walk(n)
	}
	return Clean(b.String())
}

// Clean схлопывает пробелы в строках и пустые строки.
func Clean(s string) string {
	lines := strings.Split(spaces.ReplaceAllString(s, " "), "\n")
	for i, l := range lines {
		lines[i] = strings.TrimSpace(l)
	}
	return strings.TrimSpace(emptyLines.ReplaceAllString(strings.Join(lines, "\n"), "\n"))
}

// Line — текст в одну строку.
func Line(sel *goquery.Selection) string {
	return strings.Join(strings.Fields(strings.ReplaceAll(sel.Text(), " ", " ")), " ")
}

// Resolve превращает ссылку со страницы в полный адрес.
func Resolve(base, ref string) string {
	b, err := url.Parse(base)
	if err != nil {
		return ""
	}
	r, err := b.Parse(ref)
	if err != nil {
		return ""
	}
	return r.String()
}

// Dedup убирает пустые строки и повторы, сохраняя порядок.
func Dedup(xs []string) []string {
	seen := map[string]bool{}
	out := []string{}
	for _, x := range xs {
		x = strings.TrimSpace(x)
		if x == "" || seen[strings.ToLower(x)] {
			continue
		}
		seen[strings.ToLower(x)] = true
		out = append(out, x)
	}
	return out
}
