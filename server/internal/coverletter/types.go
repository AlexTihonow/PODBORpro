// Package coverletter составляет сопроводительное письмо к вакансии через Z.AI
// (модель GLM). Сервер сам достаёт профиль и вакансию из своих источников,
// пакет только собирает ограниченный контекст, вызывает модель и чистит ответ.
// Письмо нигде не сохраняется.
package coverletter

import (
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"
)

// Candidate — поля профиля, которые разрешено передавать внешней модели.
// Имя, почта, контакты и внутренние идентификаторы сюда не попадают намеренно.
type Candidate struct {
	TargetTitle string
	TargetGrade string
	Cities      []string
	WorkFormats []string
	Skills      []string
	Tone        string // formal | neutral | friendly
}

// Vacancy — данные вакансии из доверенного серверного источника.
// Текст считается недоверенным: модель видит его только как данные.
type Vacancy struct {
	Title       string
	Company     string
	City        string
	Grade       string
	WorkFormat  string
	Skills      []string
	Description string
}

// Ошибки сервиса. Обработчик HTTP превращает их в коды ответа.
var (
	ErrNotConfigured   = errors.New("coverletter: ZAI_API_KEY не задан")
	ErrProviderTimeout = errors.New("coverletter: модель не ответила вовремя")
	ErrProviderLimited = errors.New("coverletter: провайдер ограничил частоту запросов")
	ErrProviderFailed  = errors.New("coverletter: провайдер вернул ошибку или пустой ответ")
)

// Config — настройки клиента Z.AI из окружения.
type Config struct {
	APIKey  string
	BaseURL string
	Model   string
	Timeout time.Duration
}

const (
	DefaultBaseURL = "https://api.z.ai/api/paas/v4"
	DefaultModel   = "glm-4.7-flash"
	DefaultTimeout = 60 * time.Second
	maxTimeout     = 5 * time.Minute
)

// Enabled — функция включена, только если задан ключ.
func (c Config) Enabled() bool { return c.APIKey != "" }

// ConfigFromEnv читает ZAI_API_KEY, ZAI_BASE_URL, ZAI_MODEL, ZAI_TIMEOUT_SECONDS.
// Пустой ключ не ошибка: сервер стартует, а генерация отвечает 503.
// Ошибка — только для явно неверных значений, чтобы опечатка не прошла молча.
func ConfigFromEnv(getenv func(string) string) (Config, error) {
	cfg := Config{
		APIKey:  strings.TrimSpace(getenv("ZAI_API_KEY")),
		BaseURL: strings.TrimRight(strings.TrimSpace(getenv("ZAI_BASE_URL")), "/"),
		Model:   strings.TrimSpace(getenv("ZAI_MODEL")),
		Timeout: DefaultTimeout,
	}
	if cfg.BaseURL == "" {
		cfg.BaseURL = DefaultBaseURL
	}
	if !strings.HasPrefix(cfg.BaseURL, "https://") && !strings.HasPrefix(cfg.BaseURL, "http://") {
		return Config{}, fmt.Errorf("ZAI_BASE_URL должен начинаться с https://")
	}
	if cfg.Model == "" {
		cfg.Model = DefaultModel
	}
	if raw := strings.TrimSpace(getenv("ZAI_TIMEOUT_SECONDS")); raw != "" {
		sec, err := strconv.Atoi(raw)
		if err != nil || sec <= 0 || time.Duration(sec)*time.Second > maxTimeout {
			return Config{}, fmt.Errorf("ZAI_TIMEOUT_SECONDS: целое число секунд от 1 до %d", int(maxTimeout.Seconds()))
		}
		cfg.Timeout = time.Duration(sec) * time.Second
	}
	return cfg, nil
}
