package catalog

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"reflect"
	"testing"
	"time"
)

func TestFindAndReload(t *testing.T) {
	path := filepath.Join(t.TempDir(), "vacancies.json")
	c := New(path)
	if _, err := c.Find(context.Background(), 1); !errors.Is(err, ErrNotFound) {
		t.Fatalf("нет файла: %v", err)
	}

	if err := os.WriteFile(path, []byte(`{"items":[{"id":1,"title":"A","skills":[{"name":"• Go • SQL"},{"name":"Docker"}]}]}`), 0o644); err != nil {
		t.Fatal(err)
	}
	v, err := c.Find(context.Background(), 1)
	if err != nil || v.Title != "A" {
		t.Fatalf("%+v %v", v, err)
	}
	if got := v.SkillNames(); !reflect.DeepEqual(got, []string{"Go", "SQL", "Docker"}) {
		t.Fatalf("навыки: %q", got)
	}

	if err := os.WriteFile(path, []byte(`{"items":[{"id":2,"title":"B","skills":[]}]}`), 0o644); err != nil {
		t.Fatal(err)
	}
	later := time.Now().Add(time.Minute)
	_ = os.Chtimes(path, later, later)
	if _, err := c.Find(context.Background(), 1); !errors.Is(err, ErrNotFound) {
		t.Fatalf("каталог не перечитан: %v", err)
	}
	if v, err := c.Find(context.Background(), 2); err != nil || v.Title != "B" {
		t.Fatalf("%+v %v", v, err)
	}

	if err := os.WriteFile(path, []byte(`oops`), 0o644); err != nil {
		t.Fatal(err)
	}
	_ = os.Chtimes(path, later.Add(time.Minute), later.Add(time.Minute))
	if _, err := c.Find(context.Background(), 2); err == nil || errors.Is(err, ErrNotFound) {
		t.Fatalf("битый файл: %v", err)
	}
}
