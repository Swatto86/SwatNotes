-- Add Full-Text Search using FTS5
-- This provides fast server-side search that scales to thousands of notes

-- Create FTS5 virtual table for full-text search
-- The id column is UNINDEXED as we only need it for joining back to notes table
CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
    note_id UNINDEXED,
    title,
    content_text,
    tokenize='porter unicode61'
);

-- Populate FTS table with existing notes
-- For the initial migration, index titles and use empty content_text
-- The Rust code will properly extract text when notes are updated
-- This avoids JSON parsing issues with potentially malformed content
INSERT INTO notes_fts (note_id, title, content_text)
SELECT
    id,
    title,
    ''
FROM notes
WHERE deleted_at IS NULL;
