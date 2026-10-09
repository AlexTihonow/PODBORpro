-- Черновик из документа архитектора (А-4, первая очередь). Владелец — архитектор.
-- +goose Up
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE users (
    id            bigserial PRIMARY KEY,
    email         text        NOT NULL,
    password_hash text        NOT NULL,
    full_name     text        NOT NULL,
    is_admin      boolean     NOT NULL DEFAULT false,
    created_at    timestamptz NOT NULL DEFAULT now()
);
-- одна почта — один пользователь, без учёта регистра букв
CREATE UNIQUE INDEX users_email_idx ON users (lower(email));

CREATE TABLE profiles (
    user_id       bigint PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    target_title  text,
    target_grade  text CHECK (target_grade IN ('junior', 'middle', 'senior')),
    cities        text[]  NOT NULL DEFAULT '{}',
    work_formats  text[]  NOT NULL DEFAULT '{}',
    salary_from   integer CHECK (salary_from >= 0),
    tone          text    NOT NULL DEFAULT 'neutral' CHECK (tone IN ('formal', 'neutral', 'friendly')),
    resume_status text    NOT NULL DEFAULT 'none'
                  CHECK (resume_status IN ('none', 'processing', 'ready', 'failed')),
    updated_at    timestamptz NOT NULL DEFAULT now()
);

-- +goose Down
DROP TABLE profiles;
DROP TABLE users;
