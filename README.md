# PODBORpro

Поиск работы по-умному: лента подходящих вакансий, отклики и сопроводительные письма.

**Демо (клиент на заглушках, без сервера):** https://alextihonow.github.io/PODBORpro/

## Из чего состоит

| Папка | Что внутри | Стек |
|---|---|---|
| `web/` | Клиентская часть | HTML, CSS, JavaScript — без фреймворков и сборки |
| `server/` | REST-интерфейс `/api/v1`, раздаёт и клиента | Go, PostgreSQL + pgvector |
| `ml/` | Сервис моделей (доступен только серверу) | Python |
| `Сквозные тесты Playwright/` | Сквозные (e2e) тесты | Playwright |
| `docs/` | План тестирования, шаблон приёмки | — |

## Что нужно установить

- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- Go 1.26+ — только если запускать сервер без Docker

Для разработки клиента достаточно любого статического сервера (например, встроенного в Python).

## Запуск всей системы

```bash
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
node dev-server.mjs
```

Клиент откроется на http://localhost:5173. По умолчанию он работает на **заглушках** — сервер не нужен.
`dev-server.mjs` — крошечный сервер на встроенных модулях Node без зависимостей: он умеет отдавать
`index.html` для клиентских маршрутов вроде `/feed` и `/letters/15`.

Клиент — обычные ES-модули, поэтому сборка не требуется: правьте файлы в `web/` и обновляйте страницу.
Чтобы обратиться к настоящему серверу, откройте приложение с сервера на `http://localhost:8080`
или добавьте `?stubs=0` к адресу. Обратное поведение — `?stubs=1`.

Полезные адреса для проверки состояний: `/dev/components`, `/feed?preview=loading`,
`/feed?preview=empty`, `/feed?preview=error`, `/applications?preview=empty`.

Демо-триггеры заглушек: вход с почтой `wrong@mail.ru` даёт ошибку, регистрация с `taken@mail.ru` — «почта занята».

## Разработка сервера без Docker

```bash
docker compose up -d db   # нужна только база
cd server
make generate             # типы Go из openapi.yaml (в git не хранятся; make run/test создают их сами)
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
Сборка не нужна: workflow подставляет базовый путь и выкладывает папку `web/`.
Демо работает **на заглушках**: сервера на Pages нет, данные ненастоящие.

Первый раз нужно включить Pages в репозитории: **Settings → Pages → Source: GitHub Actions**.
