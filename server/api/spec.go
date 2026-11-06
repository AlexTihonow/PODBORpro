package api

import (
	_ "embed"

	"github.com/getkin/kin-openapi/openapi3"
)

//go:generate go tool oapi-codegen -config oapi-codegen.yaml openapi.yaml

//go:embed openapi.yaml
var Spec []byte

const BasePath = "/api/v1"

func Load() (*openapi3.T, error) {
	loader := openapi3.NewLoader()
	doc, err := loader.LoadFromData(Spec)
	if err != nil {
		return nil, err
	}
	return doc, doc.Validate(loader.Context)
}
