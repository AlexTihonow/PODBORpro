# PODBORpro

Поиск работы по-умному: лента подходящих вакансий, отклики и сопроводительные письма.

**Демо:** https://alextihonow.github.io/PODBORpro/

В демо собраны настоящие вакансии с hh.ru, размеченные моделью Laya multilingual. Сервера на GitHub Pages нет: вход, профиль, письма и отклики работают в браузере, а вакансии берутся из файла `web/data/vacancies.json`.

## Из чего состоит

| Папка | Что внутри | Стек |
|---|---|---|
| `web/` | Клиент: HTML, CSS, ES-модули без сборки | JavaScript |
| `scraper/` | Сборщик вакансий: links → fetch → tag → push → export | Go |
| `ml/` | Сервис разметки `/classify` на Laya multilingual | Node.js, TypeScript, ONNX Runtime |
| `server/` | REST-интерфейс `/api/v1`, раздаёт и клиента | Go, PostgreSQL |
| `e2e/` | Сквозные тесты | Playwright |
| `docs/` | Документация по разделам | — |

### Клиент `web/`

```
web/
  index.html
  css/                стили по разделам: base, controls, feedback, layout, feed, vacancy, …
  data/               vacancies.json — каталог для демо, создаётся сборщиком
  js/
    app.js            маршруты
    core/             router.js, session.js
    ui/               components.js, shell.js
    api/              HTTP-клиент и выбор режима
    demo/             демо-режим: каталог, расчёт ленты, вход, письма, отклики
    pages/<страница>/ applications, auth, dev, feed, letter, not-found, onboarding, vacancy
```

### Документация `docs/`

```
docs/
  architecture/       схема базы, вопросы по модели данных
  ml/                 переход на Laya, отчёт по модели
  scraper/            устройство сборщика, заметки по hh.ru, инструкция
  testing/            план тестирования, шаблон приёмки
  plan/               план завершения, диаграммы и исходники PDF
```

### Исследовательские данные `ml/research/datasets/`

Выборки вакансий hh.ru, на которых сравнивались модели.

Демо-режим включается сам на `github.io`, при открытии файла и на любом порту, кроме 8080. Принудительно: `?stubs=1` или `?stubs=0`.

## Модель: Laya multilingual

Английская контрольная точка Laya дробит русский текст на мелкие токены и плохо его понимает (см. отчёт ML). Поэтому сервис `ml` использует многоязычную контрольную точку на mmBERT-base, экспортированную в ONNX:

- репозиторий весов `duration465/laya-onnx`, папка `multilingual`;
- ревизия закреплена в `ml/laya.revision`;
- лимит состояния 1024 токена, словарь 256k токенов;
- веса около 1,3 ГБ, кэшируются в `~/.cache/receptron-laya` (папку можно сменить через `LAYA_CACHE`).

Это сторонний экспорт: официальная многоязычная сборка в `receptron/laya-onnx` не опубликована. Вероятности у этой контрольной точки не откалиброваны, поэтому порог «нужна проверка» (`0.5`) нужно уточнить на размеченной выборке.

Разметка устроена каскадом «правила → Laya»:

| Ответ | Откуда |
|---|---|
| Формат работы | поле сайта `work_format_raw`; модель, только если поля нет |
| Английский | правила по тексту и навыкам; модель, если упоминание есть, но уровень не указан |
| Грейд | название вакансии, если в нём ровно один уровень; иначе модель выбирает из двух уровней, подходящих под опыт с сайта |
| Направление | правила по названию и навыкам (`ml/src/tag-rules.ts`); модель спускается по дереву `ml/src/tags.ts` там, где правило не дошло до листа, и видит только название и навыки |

На 100 вакансиях с hh.ru направление определили правила в 87 случаях, модель в 9, без тега остались 4; одна вакансия размечается примерно за 2 секунды.

## Обновить данные демо

Сборщик запускается локально: в GitHub Actions его пока не запускаем.

```bash
cd ml
npm ci
npm run download
npm start
```

В другом терминале:

```bash
cd scraper
go run ./cmd/scraper all -limit 200
```

Команда собирает ссылки, скачивает страницы, размечает их через `ml` на `localhost:8000` и пишет каталог в `web/data/vacancies.json`. Если `PODBOR_URL` не задан, отправка на сервер пропускается. Отдельные этапы:

```bash
go run ./cmd/scraper tag
```

```bash
go run ./cmd/scraper export
```

После этого закоммитьте `web/data/vacancies.json`: при пуше в `main` демо на Pages обновится само.

## Запуск клиента

```bash
node web/dev-server.mjs
```

Клиент откроется на http://localhost:5173 в демо-режиме.

## Запуск всей системы

Нужен [Docker Desktop](https://www.docker.com/products/docker-desktop/).

```bash
docker compose up -d --build --wait
```

Открыть http://localhost:8080. Проверить сервер:

```bash
curl http://localhost:8080/api/v1/health
```

Остановить: `docker compose down`, вместе с базой: `docker compose down -v`. На общем сервере задайте `JWT_SECRET` в файле `.env`.

## Тесты

```bash
cd ml && npm test
```

```bash
cd scraper && go test ./...
```

```bash
cd server && make test
```

Сквозные тесты сами поднимают демо на порту 5173:

```bash
cd e2e && npm ci && npx playwright install chromium && npx playwright test
```

Чтобы прогнать их на настоящем сервере, задайте `BASE_URL=http://localhost:8080`.

## GitHub Pages

Каждый пуш в `main` публикует папку `web/` (`.github/workflows/pages.yml`). Один раз включите Pages в репозитории: **Settings → Pages → Source: GitHub Actions**.
