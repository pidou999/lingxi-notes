CREATE TABLE IF NOT EXISTS tags (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name       VARCHAR(100) NOT NULL,
    color      VARCHAR(7) DEFAULT '#6366f1',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    UNIQUE(user_id, name)
);

CREATE TABLE IF NOT EXISTS note_tags (
    note_id    UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    tag_id     UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (note_id, tag_id)
);

CREATE INDEX idx_tags_user_id            ON tags(user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_note_tags_note_id        ON note_tags(note_id);
CREATE INDEX idx_note_tags_tag_id         ON note_tags(tag_id);
