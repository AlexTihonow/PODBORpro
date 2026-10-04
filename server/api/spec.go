// Package api — описание REST-интерфейса (openapi.yaml) и созданные из него типы Go.
//
// types.gen.go не правится руками: после изменения openapi.yaml выполните `make generate`.
package api

import (
	_ "embed"

	"github.com/getkin/kin-openapi/openapi3"
)

//go:generate go tool oapi-codegen -config oapi-codegen.yaml openapi.yaml

// Spec — содержимое openapi.yaml, встроенное в программу при сборке.
//
//go:embed openapi.yaml
var Spec []byte

// BasePath — общее начало всех адресов, из раздела servers описания.
const BasePath = "/api/v1"

// Load разбирает описание и проверяет его на соответствие формату OpenAPI.
func Load() (*openapi3.T, error) {
	loader := openapi3.NewLoader()
	doc, err := loader.LoadFromData(Spec)
	if err != nil {
		return nil, err
	}
	if err := doc.Validate(loader.Context); err != nil {
		return nil, err
	}
	return doc, nil
}
