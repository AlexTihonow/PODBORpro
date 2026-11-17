-- +goose Up
-- Навыки, которые пользователь сам отметил в профиле (чипы в онбординге).
-- Пока нет справочника навыков, храним названия как есть.
ALTER TABLE profiles ADD COLUMN skill_names text[] NOT NULL DEFAULT '{}';

-- +goose Down
ALTER TABLE profiles DROP COLUMN skill_names;
