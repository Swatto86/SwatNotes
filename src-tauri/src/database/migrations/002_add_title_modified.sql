-- Add title_modified column to notes table
-- This tracks whether the title was manually set or auto-generated from content
ALTER TABLE notes ADD COLUMN title_modified INTEGER NOT NULL DEFAULT 0;
