package coverletter

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// Message — одно сообщение чата в формате Z.AI (совместим с OpenAI).
type Message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type thinking struct {
	Type string `json:"type"`
}

type chatRequest struct {
	Model       string    `json:"model"`
	Messages    []Message `json:"messages"`
	Temperature float64   `json:"temperature"`
	MaxTokens   int       `json:"max_tokens"`
	Stream      bool      `json:"stream"`
	// GLM-4.5+ по умолчанию сначала «думает»; рассуждения письму не нужны,
	// а с ограниченным max_tokens могут съесть весь ответ.
	Thinking thinking `json:"thinking"`
}

type chatResponse struct {
	Choices []struct {
		FinishReason string `json:"finish_reason"`
		Message      struct {
			Content string `json:"content"`
			// reasoning_content и прочие поля намеренно не читаются.
		} `json:"message"`
	} `json:"choices"`
}

type providerError struct {
	Error struct {
		Code    string `json:"code"`
		Message string `json:"message"`
	} `json:"error"`
}

// Completion — разобранный ответ модели.
type Completion struct {
	Content      string
	FinishReason string
}

// Completer — то, что нужно сервису от клиента; в тестах подменяется.
type Completer interface {
	Complete(ctx context.Context, messages []Message, temperature float64, maxTokens int) (Completion, error)
}

const (
	maxResponseBytes = 1 << 20 // ответ модели на письмо — единицы килобайт
	retryPause       = 500 * time.Millisecond
	overloadPause    = 2 * time.Second
	maxAttempts      = 2 // одна повторная попытка: сетевые сбои, 5xx и «сервис перегружен»

	// Z.AI отвечает 429 с этим кодом, когда перегружен сам сервис, — это
	// временно, в отличие от исчерпанной квоты (1302, 1303 и др.).
	zaiOverloadedCode = "1305"
)

// Client вызывает POST {BaseURL}/chat/completions.
type Client struct {
	cfg  Config
	http *http.Client
}

// NewClient создаёт клиента. Время ожидания задаётся через context в Complete,
// у http.Client оно — страховка на случай, если context не ограничен.
func NewClient(cfg Config) *Client {
	return &Client{cfg: cfg, http: &http.Client{Timeout: cfg.Timeout + 5*time.Second}}
}

// Complete отправляет сообщения и возвращает текст первого варианта.
// Весь вызов, включая повтор, укладывается в cfg.Timeout.
func (c *Client) Complete(ctx context.Context, messages []Message, temperature float64, maxTokens int) (Completion, error) {
	if !c.cfg.Enabled() {
		return Completion{}, ErrNotConfigured
	}
	body, err := json.Marshal(chatRequest{
		Model:       c.cfg.Model,
		Messages:    messages,
		Temperature: temperature,
		MaxTokens:   maxTokens,
		Thinking:    thinking{Type: "disabled"},
	})
	if err != nil {
		return Completion{}, fmt.Errorf("coverletter: сборка запроса: %w", err)
	}

	ctx, cancel := context.WithTimeout(ctx, c.cfg.Timeout)
	defer cancel()

	var lastErr error
	var pause time.Duration
	for attempt := 1; attempt <= maxAttempts; attempt++ {
		if attempt > 1 {
			select {
			case <-ctx.Done():
				return Completion{}, timeoutOr(ctx, lastErr)
			case <-time.After(pause):
			}
		}
		res, wait, err := c.once(ctx, body)
		if err == nil {
			return res, nil
		}
		lastErr, pause = err, wait
		if pause == 0 || ctx.Err() != nil {
			break
		}
		// Повтор без запаса времени всё равно кончится таймаутом — честнее
		// отдать исходную ошибку провайдера.
		if deadline, ok := ctx.Deadline(); ok && time.Until(deadline) < pause+time.Second {
			break
		}
	}
	return Completion{}, timeoutOr(ctx, lastErr)
}

func timeoutOr(ctx context.Context, err error) error {
	if errors.Is(ctx.Err(), context.DeadlineExceeded) {
		return fmt.Errorf("%w: %v", ErrProviderTimeout, err)
	}
	return err
}

// once — одна попытка. retry > 0 — ошибка временная, повторить через retry.
func (c *Client) once(ctx context.Context, body []byte) (res Completion, retry time.Duration, err error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.cfg.BaseURL+"/chat/completions", bytes.NewReader(body))
	if err != nil {
		return Completion{}, 0, fmt.Errorf("%w: адрес запроса: %v", ErrProviderFailed, err)
	}
	req.Header.Set("Authorization", "Bearer "+c.cfg.APIKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	resp, err := c.http.Do(req)
	if err != nil {
		if ctx.Err() != nil {
			return Completion{}, 0, ctx.Err()
		}
		// Сообщение *url.Error содержит только адрес, ключ в нём не бывает.
		return Completion{}, retryPause, fmt.Errorf("%w: сеть: %v", ErrProviderFailed, err)
	}
	defer resp.Body.Close()

	raw, err := io.ReadAll(io.LimitReader(resp.Body, maxResponseBytes+1))
	if err != nil {
		if ctx.Err() != nil {
			return Completion{}, 0, ctx.Err()
		}
		return Completion{}, retryPause, fmt.Errorf("%w: чтение ответа: %v", ErrProviderFailed, err)
	}
	if len(raw) > maxResponseBytes {
		return Completion{}, 0, fmt.Errorf("%w: ответ больше %d байт", ErrProviderFailed, maxResponseBytes)
	}

	switch {
	case resp.StatusCode == http.StatusTooManyRequests:
		var wait time.Duration
		if providerCode(raw) == zaiOverloadedCode {
			wait = overloadPause
		}
		return Completion{}, wait, fmt.Errorf("%w: %s", ErrProviderLimited, describe(resp.StatusCode, raw))
	case resp.StatusCode >= 500:
		return Completion{}, retryPause, fmt.Errorf("%w: %s", ErrProviderFailed, describe(resp.StatusCode, raw))
	case resp.StatusCode != http.StatusOK:
		// 400/401/403 и прочее не повторяем: повтор ничего не изменит.
		return Completion{}, 0, fmt.Errorf("%w: %s", ErrProviderFailed, describe(resp.StatusCode, raw))
	}

	var parsed chatResponse
	if err := json.Unmarshal(raw, &parsed); err != nil {
		return Completion{}, 0, fmt.Errorf("%w: ответ не JSON: %v", ErrProviderFailed, err)
	}
	if len(parsed.Choices) == 0 {
		return Completion{}, 0, fmt.Errorf("%w: в ответе нет choices", ErrProviderFailed)
	}
	choice := parsed.Choices[0]
	if strings.TrimSpace(choice.Message.Content) == "" {
		return Completion{}, 0, fmt.Errorf("%w: пустой choices[0].message.content (finish_reason=%q)",
			ErrProviderFailed, choice.FinishReason)
	}
	return Completion{Content: choice.Message.Content, FinishReason: choice.FinishReason}, 0, nil
}

func providerCode(raw []byte) string {
	var pe providerError
	_ = json.Unmarshal(raw, &pe)
	return pe.Error.Code
}

// describe — код и сообщение провайдера для серверного лога, без тела целиком.
func describe(status int, raw []byte) string {
	var pe providerError
	if json.Unmarshal(raw, &pe) == nil && (pe.Error.Code != "" || pe.Error.Message != "") {
		return fmt.Sprintf("HTTP %d, код %q: %s", status, pe.Error.Code, truncateRunes(pe.Error.Message, 200))
	}
	return fmt.Sprintf("HTTP %d", status)
}
