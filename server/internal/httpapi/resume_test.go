package httpapi

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"slices"
	"testing"

	"github.com/AlexTihonow/PODBORpro/server/api"
	"github.com/AlexTihonow/PODBORpro/server/internal/auth"
	"github.com/AlexTihonow/PODBORpro/server/internal/store"
)

type fakeResumeStore struct{ saved *store.ResumeUpload }

func (f *fakeResumeStore) SaveResume(_ context.Context, _ int64, r store.ResumeUpload) error {
	*f.saved = r
	return nil
}

func newResumeServer(t *testing.T) (*httptest.Server, string, *store.ResumeUpload) {
	t.Helper()
	tokens, err := auth.NewTokens(testSecret)
	must(t, err)
	saved := &store.ResumeUpload{}
	h, err := New(Config{
		Tokens: tokens, Store: fakeStore{}, WebDir: t.TempDir(), Log: discardLog(),
		Resume: ResumeConfig{Store: &fakeResumeStore{saved: saved}},
	})
	must(t, err)
	srv := httptest.NewServer(h)
	t.Cleanup(srv.Close)
	tok, _, _ := tokens.Issue(auth.Claims{UserID: 7})
	return srv, tok, saved
}

func uploadFile(t *testing.T, srv *httptest.Server, token, name string, data []byte) (*http.Response, []byte) {
	t.Helper()
	var buf bytes.Buffer
	mw := multipart.NewWriter(&buf)
	fw, _ := mw.CreateFormFile("file", name)
	_, _ = fw.Write(data)
	_ = mw.Close()
	req, _ := http.NewRequest("POST", srv.URL+"/api/v1/portfolio/resume", &buf)
	req.Header.Set("Content-Type", mw.FormDataContentType())
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	b, _ := io.ReadAll(resp.Body)
	return resp, b
}

func TestUploadResumeParses(t *testing.T) {
	srv, tok, saved := newResumeServer(t)
	data, err := os.ReadFile("../resume/testdata/resume.docx")
	must(t, err)

	resp, body := uploadFile(t, srv, tok, "Резюме.docx", data)
	if resp.StatusCode != 200 {
		t.Fatalf("%d %s", resp.StatusCode, body)
	}
	var r api.ResumeUploadResponse
	must(t, json.Unmarshal(body, &r))
	if r.ResumeStatus != api.ResumeStatusReady || r.Parsed == nil {
		t.Fatalf("%s", body)
	}
	if r.Parsed.FullName == nil || *r.Parsed.FullName != "Смирнова Анна Сергеевна" || !slices.Contains(r.Parsed.Skills, "PostgreSQL") {
		t.Fatalf("разбор: %s", body)
	}
	if saved.FileName != "Резюме.docx" || saved.Status != "ready" || saved.FullName != "Смирнова Анна Сергеевна" ||
		saved.DefaultName != auth.DefaultFullName || !bytes.Equal(saved.Data, data) {
		t.Fatalf("сохранено: %+v", saved.FileName)
	}
}

func TestUploadResumeRejects(t *testing.T) {
	srv, tok, _ := newResumeServer(t)
	resp, body := uploadFile(t, srv, tok, "photo.png", []byte("\x89PNG\r\n"))
	if resp.StatusCode != 400 || errorCode(t, body) != "unsupported_file" {
		t.Fatalf("не тот формат: %d %s", resp.StatusCode, body)
	}
	resp, body = uploadFile(t, srv, tok, "big.pdf", append([]byte("%PDF-"), make([]byte, 10<<20)...))
	if resp.StatusCode != 413 || errorCode(t, body) != "file_too_large" {
		t.Fatalf("большой файл: %d %s", resp.StatusCode, body)
	}
	resp, _ = uploadFile(t, srv, "", "a.pdf", []byte("%PDF-"))
	if resp.StatusCode != 401 {
		t.Fatalf("без входа: %d", resp.StatusCode)
	}
}

func TestUploadResumeWithoutText(t *testing.T) {
	srv, tok, saved := newResumeServer(t)
	resp, body := uploadFile(t, srv, tok, "scan.pdf", []byte("%PDF-1.4 broken"))
	if resp.StatusCode != 200 {
		t.Fatalf("%d %s", resp.StatusCode, body)
	}
	var r api.ResumeUploadResponse
	must(t, json.Unmarshal(body, &r))
	if r.ResumeStatus != api.ResumeStatusFailed || r.Parsed != nil || saved.Status != "failed" {
		t.Fatalf("%s", body)
	}
}
