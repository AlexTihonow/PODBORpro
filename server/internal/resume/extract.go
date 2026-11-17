// Package resume достаёт текст из файла резюме (PDF, DOCX) и разбирает его
// правилами — без нейросети: имя, желаемая должность, город, зарплата, навыки.
package resume

import (
	"archive/zip"
	"bytes"
	"encoding/xml"
	"errors"
	"fmt"
	"io"
	"strings"

	"github.com/ledongthuc/pdf"
)

// MaxSize — предел размера файла резюме.
const MaxSize = 10 << 20

var (
	ErrUnsupported = errors.New("resume: нужен файл PDF или DOCX")
	ErrNoText      = errors.New("resume: в файле нет текста")
)

// Kind определяет формат по содержимому, а не по имени файла.
func Kind(data []byte) string {
	switch {
	case bytes.HasPrefix(data, []byte("%PDF-")):
		return "pdf"
	case bytes.HasPrefix(data, []byte("PK\x03\x04")):
		return "docx"
	}
	return ""
}

// ExtractText возвращает текст резюме построчно.
func ExtractText(data []byte) (string, error) {
	var (
		text string
		err  error
	)
	switch Kind(data) {
	case "pdf":
		text, err = pdfText(data)
	case "docx":
		text, err = docxText(data)
	default:
		return "", ErrUnsupported
	}
	if err != nil {
		return "", err
	}
	if strings.TrimSpace(text) == "" {
		return "", ErrNoText
	}
	return text, nil
}

func pdfText(data []byte) (text string, err error) {
	// Библиотека может паниковать на повреждённых файлах.
	defer func() {
		if r := recover(); r != nil {
			text, err = "", fmt.Errorf("resume: не удалось прочитать PDF: %v", r)
		}
	}()
	r, err := pdf.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		return "", fmt.Errorf("resume: не удалось прочитать PDF: %w", err)
	}
	var b strings.Builder
	for i := 1; i <= r.NumPage(); i++ {
		page := r.Page(i)
		if page.V.IsNull() {
			continue
		}
		rows, err := page.GetTextByRow()
		if err != nil {
			return "", fmt.Errorf("resume: страница %d PDF: %w", i, err)
		}
		for _, row := range rows {
			for j, word := range row.Content {
				if j > 0 && needsSpace(row.Content[j-1], word) {
					b.WriteByte(' ')
				}
				b.WriteString(word.S)
			}
			b.WriteByte('\n')
		}
	}
	return b.String(), nil
}

// needsSpace: куски текста в строке PDF идут без пробелов, если между ними
// заметный зазор — это граница слов.
func needsSpace(prev, cur pdf.Text) bool {
	if strings.HasSuffix(prev.S, " ") || strings.HasPrefix(cur.S, " ") {
		return false
	}
	gap := cur.X - (prev.X + prev.W)
	return gap > prev.FontSize*0.15
}

func docxText(data []byte) (string, error) {
	zr, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		return "", fmt.Errorf("resume: не удалось прочитать DOCX: %w", err)
	}
	for _, f := range zr.File {
		if f.Name != "word/document.xml" {
			continue
		}
		rc, err := f.Open()
		if err != nil {
			return "", fmt.Errorf("resume: DOCX: %w", err)
		}
		defer rc.Close()
		return wordXMLText(io.LimitReader(rc, 50<<20))
	}
	return "", ErrUnsupported
}

// wordXMLText собирает текст из <w:t>, абзацы <w:p> — отдельные строки,
// табуляции и переносы <w:tab>, <w:br> — пробел и перевод строки.
func wordXMLText(r io.Reader) (string, error) {
	dec := xml.NewDecoder(r)
	var b strings.Builder
	inText := false
	for {
		tok, err := dec.Token()
		if errors.Is(err, io.EOF) {
			return b.String(), nil
		}
		if err != nil {
			return "", fmt.Errorf("resume: DOCX: %w", err)
		}
		switch t := tok.(type) {
		case xml.StartElement:
			switch t.Name.Local {
			case "t":
				inText = true
			case "tab":
				b.WriteByte('\t')
			case "br", "cr":
				b.WriteByte('\n')
			}
		case xml.EndElement:
			switch t.Name.Local {
			case "t":
				inText = false
			case "p":
				b.WriteByte('\n')
			}
		case xml.CharData:
			if inText {
				b.Write(t)
			}
		}
	}
}
