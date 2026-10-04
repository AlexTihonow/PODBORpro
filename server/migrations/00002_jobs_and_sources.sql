-- server/migrations/00002_jobs_and_sources.sql
-- +goose Up
CREATE TABLE jobs (
    id          bigserial PRIMARY KEY,
    kind        text        NOT NULL,                 -- 'collect', 'normalize', 'embed', 'parse_resume'
    payload     jsonb       NOT NULL DEFAULT '{}',
    status      text        NOT NULL DEFAULT 'queued'
                CHECK (status IN ('queued', 'running', 'done', 'failed')),
    attempts    integer     NOT NULL DEFAULT 0,
    run_after   timestamptz NOT NULL DEFAULT now(),
    last_error  text,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX jobs_ready_idx ON jobs (run_after) WHERE status = 'queued';

CREATE TABLE sources (
    id        smallserial PRIMARY KEY,
    code      text    NOT NULL UNIQUE,
    title     text    NOT NULL,
    is_active boolean NOT NULL DEFAULT true
);
INSERT INTO sources (code, title) VALUES ('headhunter', 'HeadHunter');

CREATE TABLE collection_runs (
    id            bigserial PRIMARY KEY,
    source_id     smallint    NOT NULL REFERENCES sources(id),
    started_at    timestamptz NOT NULL DEFAULT now(),
    finished_at   timestamptz,
    status        text        NOT NULL DEFAULT 'running'
                  CHECK (status IN ('running', 'success', 'partial', 'failed')),
    fetched       integer     NOT NULL DEFAULT 0,
    created       integer     NOT NULL DEFAULT 0,
    updated       integer     NOT NULL DEFAULT 0,
    errors        integer     NOT NULL DEFAULT 0,
    error_message text
);

CREATE TABLE vacancy_raw (
    id           bigserial PRIMARY KEY,
    source_id    smallint    NOT NULL REFERENCES sources(id),
    external_id  text        NOT NULL,
    payload      jsonb       NOT NULL,
    run_id       bigint      REFERENCES collection_runs(id),
    fetched_at   timestamptz NOT NULL DEFAULT now(),
    processed_at timestamptz,
    UNIQUE (source_id, external_id)
);
CREATE INDEX vacancy_raw_unprocessed_idx ON vacancy_raw (fetched_at) WHERE processed_at IS NULL;

-- +goose Down
DROP TABLE vacancy_raw;
DROP TABLE collection_runs;
DROP TABLE sources;
DROP TABLE jobs;