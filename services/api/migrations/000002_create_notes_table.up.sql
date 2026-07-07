CREATE TABLE IF NOT EXISTS notes (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title       VARCHAR(500) NOT NULL DEFAULT '',
    content     TEXT NOT NULL DEFAULT '',
    content_json JSONB,
    is_markdown BOOLEAN NOT NULL DEFAULT true,
    is_public   BOOLEAN NOT NULL DEFAULT false,
    embedding   vector(1536),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at  TIMESTAMPTZ
);

CREATE INDEX idx_notes_user_id     ON notes(user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_notes_created_at  ON notes(created_at);
CREATE INDEX idx_notes_updated_at  ON notes(updated_at DESC);
CREATE INDEX idx_notes_deleted_at  ON notes(deleted_at);
