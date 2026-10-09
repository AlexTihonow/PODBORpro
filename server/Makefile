.PHONY: generate test test-db vet run lint-spec

# Типы Go из api/openapi.yaml. Запускать после каждого изменения описания.
generate:
	go generate ./api/...

vet:
	go vet ./...

# Тесты без базы: тесты регистрации и входа будут пропущены.
test:
	go test ./...

# Все тесты, включая регистрацию и вход. Нужна запущенная база:
#   docker compose up -d db
test-db:
	TEST_DATABASE_URL=postgres://podbor:podbor@localhost:5432/podbor?sslmode=disable go test ./...

run:
	DATABASE_URL=postgres://podbor:podbor@localhost:5432/podbor?sslmode=disable \
	JWT_SECRET=dev-secret-dev-secret-dev-secret-dev \
	WEB_DIR=../web/dist \
	go run ./cmd/server
