CREATE TABLE IF NOT EXISTS collections (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name            VARCHAR(255) NOT NULL,
    description     TEXT,
    cover_image_url TEXT,
    is_public       BOOLEAN NOT NULL DEFAULT false,
    sort_order      INTEGER NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS collection_notes (
    collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
    note_id       UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    sort_order    INTEGER NOT NULL DEFAULT 0,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (collection_id, note_id)
);

CREATE INDEX idx_collections_user_id               ON collections(user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_collection_notes_collection_id     ON collection_notes(collection_id);
CREATE INDEX idx_collection_notes_note_id            ON collection_notes(note_id);
