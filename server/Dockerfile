FROM golang:1.26-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/server ./cmd/server

FROM alpine:3.22
RUN adduser -D -H app
WORKDIR /app
COPY --from=build /out/server /app/server
# Сюда монтируется готовая сборка клиентской части (web/dist).
RUN mkdir -p /app/web && chown app /app/web
USER app
ENV HTTP_ADDR=:8080 WEB_DIR=/app/web
EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=3s --retries=5 \
  CMD wget -qO- http://localhost:8080/api/v1/health || exit 1
ENTRYPOINT ["/app/server"]
