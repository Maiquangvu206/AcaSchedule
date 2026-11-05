-- 004_documents.sql — per-user votes and upload metadata for the document hub

ALTER TABLE subject_documents
    ADD COLUMN original_name varchar(255),
    ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();

CREATE TRIGGER subject_documents_set_updated_at
    BEFORE UPDATE ON subject_documents
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- One row per user/document. value = 1 (upvote) or -1 (downvote).
-- Counters on subject_documents are recalculated from this table inside the vote transaction.
CREATE TABLE document_votes (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id uuid NOT NULL REFERENCES subject_documents (id) ON DELETE CASCADE,
    user_id     uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    value       smallint NOT NULL CHECK (value IN (-1, 1)),
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now(),
    UNIQUE (document_id, user_id)
);

CREATE TRIGGER document_votes_set_updated_at
    BEFORE UPDATE ON document_votes
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_document_votes_user
    ON document_votes (user_id, value);

COMMENT ON TABLE document_votes IS '1 user 1 vote per document; counters are derived from this table';
