/**
 * TypeScript Type Definitions for SwatNotes
 */

/** Note database model */
export interface Note {
  id: string;
  title: string;
  content_json: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  /** Whether the title was manually modified (vs auto-generated from content) */
  title_modified: boolean;
  /** Optional collection/folder this note belongs to */
  collection_id: string | null;
}

/** Collection/Folder for organizing notes */
export interface Collection {
  id: string;
  name: string;
  description: string | null;
  color: string;
  icon: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

/** Attachment database model */
export interface Attachment {
  id: string;
  note_id: string;
  filename: string;
  mime_type: string;
  blob_hash: string;
  size_bytes: number;
  size: number; // Alias for size_bytes
  created_at: string;
}

/** Backup metadata */
export interface Backup {
  id: string;
  path: string;
  timestamp: string;
  size: number;
  manifest_hash: string;
}

/** Reminder database model */
export interface Reminder {
  id: string;
  note_id: string;
  trigger_time: string;
  triggered: boolean;
  created_at: string;
  /** Per-reminder sound setting (null = use global default) */
  sound_enabled: boolean | null;
  /** Per-reminder sound type (null = use global default) */
  sound_type: string | null;
  /** Per-reminder shake animation setting (null = use global default) */
  shake_enabled: boolean | null;
  /** Per-reminder glow effect setting (null = use global default) */
  glow_enabled: boolean | null;
}

/** Settings for creating a new reminder */
export interface ReminderCreateSettings {
  sound_enabled?: boolean;
  sound_type?: string;
  shake_enabled?: boolean;
  glow_enabled?: boolean;
}

/** Reminder notification settings */
export interface ReminderSettings {
  /** Whether to play sound when reminder triggers */
  sound_enabled: boolean;
  /** Sound frequency in Hz (default 880 = A5 note) */
  sound_frequency: number;
  /** Sound duration in milliseconds */
  sound_duration: number;
  /** Whether to show the shake animation */
  shake_enabled: boolean;
  /** Shake animation duration in milliseconds */
  shake_duration: number;
  /** Whether to show the glow border effect */
  glow_enabled: boolean;
  /** Sound preset type: 'whoosh' | 'chime' | 'bell' | 'gentle' | 'alert' */
  sound_type: string;
}

/** App info from backend */
export interface AppInfo {
  version: string;
  app_data_dir: string;
}

/** Quill Delta format */
export interface QuillDelta {
  ops: Array<{
    insert: string | object;
    attributes?: Record<string, any>;
  }>;
}

/** Update information from the backend */
export interface UpdateInfo {
  /** Whether an update is available */
  available: boolean;
  /** The version of the available update (if any) */
  version: string | null;
  /** Release notes/changelog for the update */
  body: string | null;
  /** Current application version */
  current_version: string;
  /** URL to the release page */
  release_url: string | null;
  /** URL to the installer asset (if available) */
  installer_url: string | null;
}
