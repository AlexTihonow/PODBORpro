# Вопросы по базе данных

1. Повторный сбор вакансии обновляет запись в vacancy_raw (UNIQUE source_id + external_id), старая версия теряется. Принято для учебного проекта.
2. В 00002 заведён только источник HeadHunter. Остальные добавим отдельным файлом (задача Т-4).
3. Размер вектора: пока закладываем vector(768). Уточнить у ML-инженера до 08.10.
4. letter_id в Application: в БД храним только letters.application_id, letter_id отдаём через join (иначе циклическая связь).
5. Файл резюме (POST /portfolio/resume): хранить на диске или в БД? Решить до 14.10.
6. Для разбора резюме в очереди будет kind='parse_resume'.
7. sources.code приведён к API: headhunter (было hh). collection_runs приведён к полям API: created, updated, errors, error_message, статус partial.