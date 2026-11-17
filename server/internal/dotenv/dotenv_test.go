package dotenv

import (
	"os"
	"path/filepath"
	"testing"
)

func TestLoad(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, ".env")
	content := "# комментарий\nDOTENV_A=один\nexport DOTENV_B=\"два\"\nDOTENV_EMPTY=\nDOTENV_SET=из файла\n"
	if err := os.WriteFile(path, []byte(content), 0o600); err != nil {
		t.Fatal(err)
	}
	t.Setenv("DOTENV_SET", "из окружения")
	for _, k := range []string{"DOTENV_A", "DOTENV_B", "DOTENV_EMPTY"} {
		os.Unsetenv(k)
		t.Cleanup(func() { os.Unsetenv(k) })
	}

	got, err := Load(filepath.Join(dir, "нет"), path)
	if err != nil || got != path {
		t.Fatalf("%q %v", got, err)
	}
	for k, want := range map[string]string{"DOTENV_A": "один", "DOTENV_B": "два", "DOTENV_SET": "из окружения"} {
		if v := os.Getenv(k); v != want {
			t.Errorf("%s = %q, ждали %q", k, v, want)
		}
	}
	if _, set := os.LookupEnv("DOTENV_EMPTY"); set {
		t.Error("пустое значение задано")
	}

	if got, err := Load(filepath.Join(dir, "нет")); got != "" || err != nil {
		t.Fatalf("без файла: %q %v", got, err)
	}
	if err := os.WriteFile(path, []byte("просто строка\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	if _, err := Load(path); err == nil {
		t.Fatal("битая строка принята")
	}
}
