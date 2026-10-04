package httpapi

import (
	"encoding/json"
	"fmt"
	"net/http"
	"slices"
	"strconv"

	"github.com/getkin/kin-openapi/openapi3"

	"github.com/AlexTihonow/PODBORpro/server/api"
)

// registerStubs проходит по всем адресам из openapi.yaml и для каждого, у которого
// ещё нет настоящего обработчика, регистрирует заглушку: она отвечает примером
// из первого успешного ответа (200, 201, 202 или 204). Проверка входа у заглушки
// такая же, как будет у настоящего обработчика, — по полю security и x-admin.
//
// Так «все адреса отвечают» выполняется само и никогда не расходится с описанием.
func (a *API) registerStubs() error {
	doc, err := api.Load()
	if err != nil {
		return err
	}
	for path, item := range doc.Paths.Map() {
		for method, op := range item.Operations() {
			if a.real[method+" "+path] {
				continue
			}
			h, err := stubHandler(op)
			if err != nil {
				return fmt.Errorf("%s %s: %w", method, path, err)
			}
			a.mux.Handle(method+" "+api.BasePath+path, a.wrap(stubAccess(doc, op), h))
		}
	}
	return nil
}

func stubHandler(op *openapi3.Operation) (http.Handler, error) {
	status, resp := firstSuccess(op)
	if resp == nil {
		return nil, fmt.Errorf("нет успешного ответа")
	}
	if status == http.StatusNoContent {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("X-Stub", "true")
			w.WriteHeader(status)
		}), nil
	}
	mt := resp.Content.Get("application/json")
	if mt == nil || mt.Example == nil {
		return nil, fmt.Errorf("у ответа %d нет примера", status)
	}
	// Пример кодируем один раз при запуске: ошибка в нём видна сразу, а не на запросе.
	body, err := json.Marshal(mt.Example)
	if err != nil {
		return nil, fmt.Errorf("пример ответа %d: %w", status, err)
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		w.Header().Set("X-Stub", "true")
		w.WriteHeader(status)
		_, _ = w.Write(body)
		_, _ = w.Write([]byte("\n"))
	}), nil
}

func firstSuccess(op *openapi3.Operation) (int, *openapi3.Response) {
	codes := []int{}
	for code := range op.Responses.Map() {
		if c, err := strconv.Atoi(code); err == nil && c >= 200 && c < 300 {
			codes = append(codes, c)
		}
	}
	if len(codes) == 0 {
		return 0, nil
	}
	c := slices.Min(codes)
	return c, op.Responses.Value(strconv.Itoa(c)).Value
}

// stubAccess: у операции свой security, иначе общий; пустой список — вход не нужен.
func stubAccess(doc *openapi3.T, op *openapi3.Operation) access {
	sec := doc.Security
	if op.Security != nil {
		sec = *op.Security
	}
	if len(sec) == 0 {
		return public
	}
	if isAdmin, _ := op.Extensions["x-admin"].(bool); isAdmin {
		return admin
	}
	return user
}
