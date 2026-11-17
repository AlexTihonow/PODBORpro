-- +goose Up
-- Доска откликов: какая вакансия в какой колонке и на каком месте лежит у пользователя.
-- Таблицы вакансий пока нет (каталог в файле), поэтому vacancy_id без внешнего ключа,
-- а карточка вакансии хранится снимком на момент добавления.
CREATE TABLE applications (
    id         bigserial PRIMARY KEY,
    user_id    bigint      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    vacancy_id bigint      NOT NULL,
    vacancy    jsonb       NOT NULL,
    status     text        NOT NULL DEFAULT 'draft'
               CHECK (status IN ('draft', 'sent', 'interview', 'offer', 'rejected')),
    position   integer     NOT NULL DEFAULT 0 CHECK (position >= 0),
    letter_id  bigint,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, vacancy_id)
);
CREATE INDEX applications_board_idx ON applications (user_id, status, position);

-- +goose Down
DROP TABLE applications;
