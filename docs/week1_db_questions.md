# Вопросы по базе данных

1. Повторный сбор вакансии обновляет запись в vacancy_raw (UNIQUE source_id + external_id), старая версия теряется. Принято для учебного проекта.
2. В 00002 заведён только источник HeadHunter. Остальные добавим отдельным файлом (задача Т-4).
3. Размер вектора: пока закладываем vector(768). Уточнить у ML-инженера до 08.10.
4. letter_id в Application: в БД храним только letters.application_id, letter_id отдаём через join (иначе циклическая связь).
5. Файл резюме (POST /portfolio/resume): хранить на диске или в БД? Решить до 14.10.
6. Для разбора резюме в очереди будет kind='parse_resume'.
7. sources.code приведён к API: headhunter (было hh). collection_runs приведён к полям API: created, updated, errors, error_message, статус partial.
8. Образ Postgres в docker compose и CI: с pgvector (например pgvector/pgvector:pg16)? 00001 включает расширение vector, на обычном postgres упадёт.
9. Откуда сервер берёт миграции (путь server/migrations, встроены в бинарник или читаются с диска)? Мои файлы лежат в server/migrations.
10. Кто и когда сливает ветку DataBase в main? 00001 нужен старшему и младшему.
11. Каркас сервера: совпадает ли он со схемами уровней 1 и 2 из общего документа? Пришлите схему или описание, если есть расхождения.
12. ML-инженеру: какой размер вектора (768 или 384)? Пока закладываем vector(768).
13. Тестировщику: когда будут образцы ответов HH в server/internal/sources/testdata/hh/?
14. Формат справочника навыков: CSV canonical,category,aliases (алиасы через |). Подходит? Кто пишет загрузку в базу при запуске?
15. Добавлю в profiles проверку work_formats (только office, remote, hybrid), как в API. Возражений нет?