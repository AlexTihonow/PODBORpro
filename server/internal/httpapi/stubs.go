package httpapi

import (
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/getkin/kin-openapi/openapi3"

	"github.com/AlexTihonow/PODBORpro/server/api"
)

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
	for _, code := range []int{200, 201, 202, 204} {
		resp := op.Responses.Status(code)
		if resp == nil {
			continue
		}
		var body []byte
		if code != http.StatusNoContent {
			mt := resp.Value.Content.Get("application/json")
			if mt == nil || mt.Example == nil {
				return nil, fmt.Errorf("у ответа %d нет примера", code)
			}

			b, err := json.Marshal(mt.Example)
			if err != nil {
				return nil, fmt.Errorf("пример ответа %d: %w", code, err)
			}
			body = append(b, '\n')
		}
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("X-Stub", "true")
			if body != nil {
				w.Header().Set("Content-Type", "application/json; charset=utf-8")
			}
			w.WriteHeader(code)
			_, _ = w.Write(body)
		}), nil
	}
	return nil, fmt.Errorf("нет успешного ответа")
}

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
