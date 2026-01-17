-- Initial schema for QuickNotes
-- Creates all core tables with proper indexes and constraints

-- Notes table
CREATE TABLE IF NOT EXISTS notes (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    content_json TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_notes_created_at ON notes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notes_updated_at ON notes(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_notes_deleted_at ON notes(deleted_at);

-- Attachments table
CREATE TABLE IF NOT EXISTS attachments (
    id TEXT PRIMARY KEY,
    note_id TEXT NOT NULL,
    blob_hash TEXT NOT NULL,
    filename TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_attachments_note_id ON attachments(note_id);
CREATE INDEX IF NOT EXISTS idx_attachments_blob_hash ON attachments(blob_hash);

-- Reminders table
CREATE TABLE IF NOT EXISTS reminders (
    id TEXT PRIMARY KEY,
    note_id TEXT NOT NULL,
    trigger_time TEXT NOT NULL,
    triggered INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_reminders_note_id ON reminders(note_id);
CREATE INDEX IF NOT EXISTS idx_reminders_trigger_time ON reminders(trigger_time);
CREATE INDEX IF NOT EXISTS idx_reminders_triggered ON reminders(triggered);

-- Backups table
CREATE TABLE IF NOT EXISTS backups (
    id TEXT PRIMARY KEY,
    timestamp TEXT NOT NULL,
    path TEXT NOT NULL,
    size INTEGER NOT NULL,
    manifest_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_backups_timestamp ON backups(timestamp DESC);

-- Settings table
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
