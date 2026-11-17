-- +goose Up
-- Файл резюме пользователя и результат разбора правилами (последний загруженный).
CREATE TABLE resumes (
    user_id      bigint PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    file_name    text        NOT NULL,
    content_type text        NOT NULL,
    data         bytea       NOT NULL,
    text         text        NOT NULL DEFAULT '',
    parsed       jsonb       NOT NULL DEFAULT '{}',
    uploaded_at  timestamptz NOT NULL DEFAULT now()
);

-- +goose Down
DROP TABLE resumes;
