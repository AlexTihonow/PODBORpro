# PODBORpro

Поиск работы по-умному: лента подходящих вакансий, отклики и сопроводительные письма.

**Демо (клиент на заглушках, без сервера):** https://alextihonow.github.io/PODBORpro/

## Из чего состоит

| Папка | Что внутри | Стек |
|---|---|---|
| `web/` | Клиентская часть | React, Vite, TypeScript |
| `server/` | REST-интерфейс `/api/v1`, раздаёт и клиента | Go, PostgreSQL + pgvector |
| `ml/` | Сервис моделей (доступен только серверу) | Python |
| `Сквозные тесты Playwright/` | Сквозные (e2e) тесты | Playwright |
| `docs/` | План тестирования, шаблон приёмки | — |

## Что нужно установить

- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- Node.js 20+ и pnpm (`npm i -g pnpm`)
- Go 1.22+ — только если запускать сервер без Docker

## Запуск всей системы

```bash
# 1. Собрать клиента (сервер раздаёт готовую сборку из web/dist)
cd web
pnpm install
VITE_USE_STUBS=false pnpm run build
cd ..

# 2. Поднять базу, сервис моделей и сервер
docker compose up -d --build --wait
```

Открыть http://localhost:8080. Проверка, что сервер жив:

```bash
curl http://localhost:8080/api/v1/health
```

Остановить: `docker compose down` (с удалением базы — `docker compose down -v`).

`JWT_SECRET` для своей машины задан по умолчанию; на общем сервере его нужно указать в файле `.env`.

## Разработка клиента

```bash
cd web
pnpm install
pnpm run dev
```

Клиент откроется на http://localhost:5173. По умолчанию он работает на **заглушках** — сервер не нужен.
Чтобы ходить в настоящий сервер (запросы `/api` проксируются на `localhost:8080`):

```bash
VITE_USE_STUBS=false pnpm run dev
```

После изменения `server/api/openapi.yaml` пересоздать типы и заглушки: `pnpm run generate`.

## Разработка сервера без Docker

```bash
docker compose up -d db   # нужна только база
cd server
make run                  # http://localhost:8080
make test                 # тесты без базы
make test-db              # все тесты, с базой
```

## Сквозные тесты

Нужна запущенная система (см. «Запуск всей системы»).

```bash
cd "Сквозные тесты Playwright/e2e"
npm ci
npx playwright install chromium
BASE_URL=http://localhost:8080 npx playwright test --config e2e/playwright.config.ts
```

Отчёт: `npx playwright show-report`.

## GitHub Pages

Каждый пуш в `main` публикует клиента на GitHub Pages (`.github/workflows/pages.yml`).
Демо собирается **на заглушках**: сервера на Pages нет, данные ненастоящие.

Первый раз нужно включить Pages в репозитории: **Settings → Pages → Source: GitHub Actions**.
