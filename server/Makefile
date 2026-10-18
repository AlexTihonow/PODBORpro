.PHONY: generate test test-db vet run

generate:
	go generate ./api/...

api/types.gen.go: api/openapi.yaml
	go generate ./api/...

vet: api/types.gen.go
	go vet ./...

test: api/types.gen.go
	go test ./...

test-db: api/types.gen.go
	TEST_DATABASE_URL=postgres://podbor:podbor@localhost:5432/podbor?sslmode=disable go test ./...

run: api/types.gen.go
	DATABASE_URL=postgres://podbor:podbor@localhost:5432/podbor?sslmode=disable \
	JWT_SECRET=dev-secret-dev-secret-dev-secret-dev \
	WEB_DIR=../web/dist \
	go run ./cmd/server
