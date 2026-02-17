-- Collections/Folders table for organizing notes
CREATE TABLE IF NOT EXISTS collections (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    color TEXT NOT NULL DEFAULT '#6B7280',
    icon TEXT DEFAULT 'folder',
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Add collection_id to notes table
-- Note: FK constraint omitted from ALTER TABLE ADD COLUMN for broad SQLite
-- version compatibility. FK is enforced by application logic and PRAGMA foreign_keys.
ALTER TABLE notes ADD COLUMN collection_id TEXT;

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_notes_collection_id ON notes(collection_id);
CREATE INDEX IF NOT EXISTS idx_collections_sort_order ON collections(sort_order);
