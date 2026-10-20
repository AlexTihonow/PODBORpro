// Package sourcetest — помощники для тестов разбора на сохранённых страницах.
package sourcetest

import (
	"bytes"
	"compress/gzip"
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/AlexTihonow/PODBORpro/scraper/internal/httpx"
	"github.com/AlexTihonow/PODBORpro/scraper/internal/sources"
)

// Update — go test ./... -update перезаписывает эталонные JSON по текущему разбору.
var Update = flag.Bool("update", false, "перезаписать эталонные JSON в testdata")

// Fixed — время «сейчас» в тестах.
var Fixed = time.Date(2026, 10, 20, 12, 0, 0, 0, time.UTC)

// Page читает сохранённую страницу testdata/<name> (.gz распаковывается).
func Page(t *testing.T, name string) []byte {
	t.Helper()
	b, err := os.ReadFile(filepath.Join("testdata", name))
	if err != nil {
		t.Fatal(err)
	}
	if strings.HasSuffix(name, ".gz") {
		zr, err := gzip.NewReader(bytes.NewReader(b))
		if err != nil {
			t.Fatal(err)
		}
		if b, err = io.ReadAll(zr); err != nil {
			t.Fatal(err)
		}
	}
	return b
}

// Golden сравнивает v с testdata/<name>.
func Golden(t *testing.T, name string, v any) {
	t.Helper()
	got, err := json.MarshalIndent(v, "", "  ")
	if err != nil {
		t.Fatal(err)
	}
	got = append(got, '\n')
	path := filepath.Join("testdata", name)
	if *Update {
		if err := os.WriteFile(path, got, 0o644); err != nil {
			t.Fatal(err)
		}
		return
	}
	want, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("%v (go test -update создаст эталон)", err)
	}
	if !bytes.Equal(got, want) {
		t.Errorf("%s не совпадает с разбором.\nПолучено:\n%s", path, got)
	}
}

// Site — сайт из сохранённых страниц: адрес → файл в testdata. Чего нет — 404.
type Site struct {
	T     *testing.T
	Pages map[string]string
	// Disallow — адреса, которые запрещены как в robots.txt.
	Disallow func(url string) bool
	Got      []string
}

func (s *Site) Get(_ context.Context, url string) (httpx.Response, error) {
	s.Got = append(s.Got, url)
	if s.Disallow != nil && s.Disallow(url) {
		return httpx.Response{}, httpx.ErrDisallowed
	}
	name, ok := s.Pages[url]
	if !ok {
		return httpx.Response{Status: 404, URL: url}, nil
	}
	return httpx.Response{Status: 200, Body: Page(s.T, name), URL: url}, nil
}

func (s *Site) Allowed(_ context.Context, url string) bool {
	return s.Disallow == nil || !s.Disallow(url)
}

var _ sources.Getter = (*Site)(nil)

// Must — короткая проверка ошибки.
func Must(t *testing.T, err error) {
	t.Helper()
	if err != nil {
		t.Fatal(fmt.Sprint(err))
	}
}
