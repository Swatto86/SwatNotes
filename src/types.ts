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
  path: string;
  timestamp: string;
  size: number;
}

/** Reminder database model */
export interface Reminder {
  id: string;
  note_id: string;
  trigger_time: string;
  triggered: boolean;
  created_at: string;
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
