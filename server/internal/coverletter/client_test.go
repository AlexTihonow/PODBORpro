package coverletter

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

const okBody = `{"choices":[{"finish_reason":"stop","message":{"role":"assistant","content":"Здравствуйте!","reasoning_content":"секрет"}}]}`

func newClient(t *testing.T, h http.HandlerFunc, timeout time.Duration) (*Client, *int32) {
	t.Helper()
	var calls int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt32(&calls, 1)
		h(w, r)
	}))
	t.Cleanup(srv.Close)
	return NewClient(Config{APIKey: "test-key", BaseURL: srv.URL, Model: "glm-4.7-flash", Timeout: timeout}), &calls
}

func complete(c *Client) (Completion, error) {
	return c.Complete(context.Background(), []Message{{Role: "user", Content: "привет"}}, 0.7, 100)
}

func TestClientSendsRequestAndReadsContent(t *testing.T) {
	c, calls := newClient(t, func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost || r.URL.Path != "/chat/completions" {
			t.Errorf("запрос %s %s", r.Method, r.URL.Path)
		}
		if got := r.Header.Get("Authorization"); got != "Bearer test-key" {
			t.Errorf("Authorization = %q", got)
		}
		if ct := r.Header.Get("Content-Type"); ct != "application/json" {
			t.Errorf("Content-Type = %q", ct)
		}
		var req chatRequest
		raw, _ := io.ReadAll(r.Body)
		if err := json.Unmarshal(raw, &req); err != nil {
			t.Fatal(err)
		}
		if req.Model != "glm-4.7-flash" || req.MaxTokens != 100 || req.Stream || req.Thinking.Type != "disabled" {
			t.Errorf("тело запроса: %s", raw)
		}
		w.Write([]byte(okBody))
	}, time.Second)

	res, err := complete(c)
	if err != nil {
		t.Fatal(err)
	}
	if res.Content != "Здравствуйте!" || res.FinishReason != "stop" || *calls != 1 {
		t.Fatalf("%+v, вызовов %d", res, *calls)
	}
}

func TestClientRetriesOnceOn5xx(t *testing.T) {
	var n int32
	c, calls := newClient(t, func(w http.ResponseWriter, r *http.Request) {
		if atomic.AddInt32(&n, 1) == 1 {
			w.WriteHeader(http.StatusBadGateway)
			return
		}
		w.Write([]byte(okBody))
	}, 5*time.Second)
	if _, err := complete(c); err != nil {
		t.Fatal(err)
	}
	if *calls != 2 {
		t.Fatalf("вызовов %d, ждали 2", *calls)
	}
}

func TestClientGivesUpAfterSecond5xx(t *testing.T) {
	c, calls := newClient(t, func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
		w.Write([]byte(`{"error":{"code":"500","message":"internal"}}`))
	}, 5*time.Second)
	_, err := complete(c)
	if !errors.Is(err, ErrProviderFailed) || *calls != 2 {
		t.Fatalf("err=%v, вызовов %d", err, *calls)
	}
}

func TestClientDoesNotRetryClientErrors(t *testing.T) {
	for _, tc := range []struct {
		status int
		want   error
	}{
		{http.StatusUnauthorized, ErrProviderFailed},
		{http.StatusBadRequest, ErrProviderFailed},
		{http.StatusTooManyRequests, ErrProviderLimited},
	} {
		c, calls := newClient(t, func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(tc.status)
			w.Write([]byte(`{"error":{"code":"1001","message":"bad"}}`))
		}, time.Second)
		_, err := complete(c)
		if !errors.Is(err, tc.want) || *calls != 1 {
			t.Errorf("%d: err=%v, вызовов %d", tc.status, err, *calls)
		}
		if err != nil && strings.Contains(err.Error(), "test-key") {
			t.Errorf("ключ попал в текст ошибки: %v", err)
		}
	}
}

func TestClientRejectsBadPayloads(t *testing.T) {
	for name, body := range map[string]string{
		"не JSON":       `<html>oops</html>`,
		"нет choices":   `{"choices":[]}`,
		"пустой текст":  `{"choices":[{"finish_reason":"length","message":{"content":"  "}}]}`,
		"только думает": `{"choices":[{"message":{"content":"","reasoning_content":"..."}}]}`,
		"слишком много": `{"choices":[{"message":{"content":"` + strings.Repeat("я", maxResponseBytes) + `"}}]}`,
	} {
		c, calls := newClient(t, func(w http.ResponseWriter, r *http.Request) { w.Write([]byte(body)) }, time.Second)
		_, err := complete(c)
		if !errors.Is(err, ErrProviderFailed) || *calls != 1 {
			t.Errorf("%s: err=%v, вызовов %d", name, err, *calls)
		}
	}
}

func TestClientTimeout(t *testing.T) {
	c, calls := newClient(t, func(w http.ResponseWriter, r *http.Request) {
		select {
		case <-r.Context().Done():
		case <-time.After(time.Second):
		}
	}, 100*time.Millisecond)
	start := time.Now()
	_, err := complete(c)
	if !errors.Is(err, ErrProviderTimeout) {
		t.Fatalf("err=%v", err)
	}
	if time.Since(start) > time.Second || *calls != 1 {
		t.Fatalf("ждали %v, вызовов %d", time.Since(start), *calls)
	}
}

func TestClientWithoutKey(t *testing.T) {
	c := NewClient(Config{BaseURL: "http://127.0.0.1:1", Timeout: time.Second})
	if _, err := complete(c); !errors.Is(err, ErrNotConfigured) {
		t.Fatalf("err=%v", err)
	}
}

func TestConfigFromEnv(t *testing.T) {
	env := func(m map[string]string) func(string) string { return func(k string) string { return m[k] } }

	cfg, err := ConfigFromEnv(env(nil))
	if err != nil || cfg.Enabled() || cfg.BaseURL != DefaultBaseURL || cfg.Model != DefaultModel || cfg.Timeout != DefaultTimeout {
		t.Fatalf("по умолчанию: %+v %v", cfg, err)
	}
	cfg, err = ConfigFromEnv(env(map[string]string{
		"ZAI_API_KEY": " k ", "ZAI_BASE_URL": "https://example.test/v4/", "ZAI_MODEL": "glm-x", "ZAI_TIMEOUT_SECONDS": "15",
	}))
	if err != nil || !cfg.Enabled() || cfg.APIKey != "k" || cfg.BaseURL != "https://example.test/v4" ||
		cfg.Model != "glm-x" || cfg.Timeout != 15*time.Second {
		t.Fatalf("из окружения: %+v %v", cfg, err)
	}
	for _, bad := range []map[string]string{
		{"ZAI_TIMEOUT_SECONDS": "abc"},
		{"ZAI_TIMEOUT_SECONDS": "0"},
		{"ZAI_TIMEOUT_SECONDS": "100000"},
		{"ZAI_BASE_URL": "api.z.ai"},
	} {
		if _, err := ConfigFromEnv(env(bad)); err == nil {
			t.Errorf("%v: ждали ошибку", bad)
		}
	}
}

func TestClientRetriesOnceWhenZAIOverloaded(t *testing.T) {
	var n int32
	c, calls := newClient(t, func(w http.ResponseWriter, r *http.Request) {
		if atomic.AddInt32(&n, 1) == 1 {
			w.WriteHeader(http.StatusTooManyRequests)
			w.Write([]byte(`{"error":{"code":"1305","message":"The service may be temporarily overloaded"}}`))
			return
		}
		w.Write([]byte(okBody))
	}, 10*time.Second)
	if _, err := complete(c); err != nil {
		t.Fatal(err)
	}
	if *calls != 2 {
		t.Fatalf("вызовов %d, ждали 2", *calls)
	}
}
