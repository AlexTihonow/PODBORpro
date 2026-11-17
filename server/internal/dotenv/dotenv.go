// Package dotenv подхватывает локальные секреты из файла .env (например,
// ZAI_API_KEY), чтобы не вписывать их в код и не передавать в командной строке.
package dotenv

import (
	"bufio"
	"errors"
	"fmt"
	"os"
	"strings"
)

// Load читает первый существующий файл из paths и задаёт переменные окружения.
// Уже заданные переменные не перезаписываются, пустые значения пропускаются.
// Возвращает путь прочитанного файла ("" — файла нет). Значения нигде не логируются.
func Load(paths ...string) (string, error) {
	for _, path := range paths {
		f, err := os.Open(path)
		if errors.Is(err, os.ErrNotExist) {
			continue
		}
		if err != nil {
			return "", fmt.Errorf("%s: %w", path, err)
		}
		defer f.Close()
		sc := bufio.NewScanner(f)
		for n := 1; sc.Scan(); n++ {
			line := strings.TrimSpace(sc.Text())
			if line == "" || strings.HasPrefix(line, "#") {
				continue
			}
			key, value, ok := strings.Cut(strings.TrimPrefix(line, "export "), "=")
			key = strings.TrimSpace(key)
			if !ok || key == "" || strings.ContainsAny(key, " \t") {
				return "", fmt.Errorf("%s:%d: нужна строка вида ИМЯ=значение", path, n)
			}
			value = unquote(strings.TrimSpace(value))
			if _, set := os.LookupEnv(key); set || value == "" {
				continue
			}
			if err := os.Setenv(key, value); err != nil {
				return "", fmt.Errorf("%s:%d: %w", path, n, err)
			}
		}
		if err := sc.Err(); err != nil {
			return "", fmt.Errorf("%s: %w", path, err)
		}
		return path, nil
	}
	return "", nil
}

func unquote(v string) string {
	if len(v) >= 2 && (v[0] == '"' && v[len(v)-1] == '"' || v[0] == '\'' && v[len(v)-1] == '\'') {
		return v[1 : len(v)-1]
	}
	return v
}
