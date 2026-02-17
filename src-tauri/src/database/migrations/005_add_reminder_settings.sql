-- Add per-reminder notification settings
-- These override global settings when set (NULL means use global default)

ALTER TABLE reminders ADD COLUMN sound_enabled INTEGER DEFAULT NULL;
ALTER TABLE reminders ADD COLUMN sound_type TEXT DEFAULT NULL;
ALTER TABLE reminders ADD COLUMN shake_enabled INTEGER DEFAULT NULL;
ALTER TABLE reminders ADD COLUMN glow_enabled INTEGER DEFAULT NULL;
