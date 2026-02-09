# Tauri Commands API Reference

This document describes all Tauri commands exposed to the frontend. Commands are invoked using `invoke()` from `@tauri-apps/api/core`.

## Table of Contents

- [General Commands](#general-commands)
- [Note Commands](#note-commands)
- [Window Commands](#window-commands)
- [Attachment Commands](#attachment-commands)
- [Backup Commands](#backup-commands)
- [Reminder Commands](#reminder-commands)
- [Settings Commands](#settings-commands)
- [Auto-Backup Commands](#auto-backup-commands)
- [Import Commands](#import-commands)

---

## General Commands

### `get_app_info`

Get application information including version and data directory.

**Parameters:** None

**Returns:**
```typescript
interface AppInfo {
  version: string;      // Semantic version (e.g., "0.1.0")
  app_data_dir: string; // Path to application data directory
}
```

**Example:**
```typescript
const info = await invoke<AppInfo>('get_app_info');
console.log(`Version: ${info.version}`);
```

---

## Note Commands

### `create_note`

Create a new note with the specified title and content.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `title` | `string` | Note title |
| `content_json` | `string` | Quill Delta JSON content |

**Returns:** `Note` object

**Example:**
```typescript
const note = await invoke<Note>('create_note', {
  title: 'My Note',
  content_json: '{"ops":[{"insert":"Hello world\\n"}]}'
});
```

### `get_note`

Retrieve a single note by ID.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `id` | `string` | UUID of the note |

**Returns:** `Note` object

**Errors:** Throws if note not found or soft-deleted.

### `list_notes`

List all non-deleted notes, sorted by most recently updated.

**Parameters:** None

**Returns:** `Note[]`

### `update_note`

Update an existing note's title, content, or title_modified flag.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `id` | `string` | UUID of the note |
| `title` | `string?` | New title (optional) |
| `content_json` | `string?` | New content (optional) |
| `title_modified` | `boolean?` | Whether title was manually edited (optional) |

**Returns:** Updated `Note` object

### `delete_note`

Soft-delete a note (moves to trash).

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `id` | `string` | UUID of the note |

**Returns:** `void`

### `delete_note_and_close_window`

Delete a note and close its floating window if open.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `id` | `string` | UUID of the note |

**Returns:** `void`

### `search_notes`

Search notes by title, content (using FTS5), and attachment filenames.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `query` | `string` | Search query |

**Returns:** `Note[]` - Matching notes

### `count_deleted_notes`

Get count of soft-deleted notes (in trash).

**Parameters:** None

**Returns:** `number`

### `prune_deleted_notes`

Permanently delete all soft-deleted notes.

**Parameters:** None

**Returns:** `number` - Count of permanently deleted notes

---

## Window Commands

### `open_note_window`

Open a note in a floating sticky note window.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `note_id` | `string` | UUID of the note |

**Returns:** `void`

### `create_new_sticky_note`

Create a new note and open it in a floating window.

**Parameters:** None

**Returns:** `void`

### `set_last_focused_note_window`

Track the last focused note window for hotkey toggle.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `window_label` | `string` | Tauri window label |

**Returns:** `void`

### `toggle_last_focused_note_window`

Toggle visibility of the last focused note window.

**Parameters:** None

**Returns:** `void`

### `open_settings_window`

Open the application settings window.

**Parameters:** None

**Returns:** `void`

### `open_main_window_and_focus_search`

Show main window and focus the search input.

**Parameters:** None

**Returns:** `void`

---

## Attachment Commands

### `create_attachment`

Upload a file attachment to a note.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `note_id` | `string` | UUID of the parent note |
| `filename` | `string` | Original filename |
| `mime_type` | `string` | MIME type (e.g., "image/png") |
| `data` | `number[]` | File bytes as array |

**Returns:** `Attachment` object

**Example:**
```typescript
const data = Array.from(new Uint8Array(fileBuffer));
const attachment = await invoke<Attachment>('create_attachment', {
  noteId: note.id,
  filename: 'image.png',
  mimeType: 'image/png',
  data
});
```

### `list_attachments`

List all attachments for a note.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `note_id` | `string` | UUID of the note |

**Returns:** `Attachment[]`

### `get_attachment_data`

Retrieve the binary data of an attachment by its content hash.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `blob_hash` | `string` | SHA-256 hash of the blob |

**Returns:** `number[]` - File bytes as array

### `delete_attachment`

Delete an attachment.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `attachment_id` | `string` | UUID of the attachment |

**Returns:** `void`

---

## Backup Commands

### `create_backup`

Create an encrypted backup of all data.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `password` | `string` | Encryption password |

**Returns:** `string` - Path to created backup file

### `list_backups`

List all available backups.

**Parameters:** None

**Returns:** `Backup[]`

### `restore_backup`

Restore from an encrypted backup.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `backup_path` | `string` | Path to backup file |
| `password` | `string` | Decryption password |

**Returns:** `void`

**Note:** Requires application restart after restore.

### `delete_backup`

Delete a backup file and its database record.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `backup_id` | `string` | UUID of the backup |
| `backup_path` | `string` | Path to backup file |

**Returns:** `void`

---

## Reminder Commands

### `create_reminder`

Create a reminder for a note.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `note_id` | `string` | UUID of the note |
| `trigger_time` | `string` | ISO 8601 datetime string |

**Returns:** `Reminder` object

**Example:**
```typescript
const reminder = await invoke<Reminder>('create_reminder', {
  noteId: note.id,
  triggerTime: new Date(Date.now() + 3600000).toISOString() // 1 hour from now
});
```

### `list_active_reminders`

List all non-triggered reminders.

**Parameters:** None

**Returns:** `Reminder[]`

### `delete_reminder`

Delete a reminder.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `id` | `string` | UUID of the reminder |

**Returns:** `void`

---

## Settings Commands

### `get_hotkey_settings`

Get global hotkey configuration.

**Parameters:** None

**Returns:**
```typescript
interface HotkeySettings {
  new_note: string;      // Hotkey for new note (e.g., "CmdOrCtrl+Shift+N")
  toggle_window: string; // Hotkey for toggle window
  search: string;        // Hotkey for search focus
}
```

### `update_hotkey_settings`

Update global hotkey configuration.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `hotkeys` | `HotkeySettings` | New hotkey settings |

**Returns:** `void`

**Note:** Requires application restart for changes to take effect.

### `set_autostart`

Enable or disable launch at system startup.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `enabled` | `boolean` | Whether to enable autostart |

**Returns:** `void`

**Note:** Currently only supported on Windows.

### `get_reminder_settings`

Get reminder notification settings.

**Parameters:** None

**Returns:**
```typescript
interface ReminderSettings {
  sound_enabled: boolean;
  sound_frequency: number;  // Hz
  sound_duration: number;   // ms
  shake_enabled: boolean;
  shake_duration: number;   // ms
  glow_enabled: boolean;
}
```

### `update_reminder_settings`

Update reminder notification settings.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `settings` | `ReminderSettings` | New settings |

**Returns:** `void`

---

## Auto-Backup Commands

### `store_auto_backup_password`

Store auto-backup password in OS credential manager.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `password` | `string` | Password to store |

**Returns:** `void`

### `has_auto_backup_password`

Check if auto-backup password is stored.

**Parameters:** None

**Returns:** `boolean`

### `delete_auto_backup_password`

Delete auto-backup password from credential manager.

**Parameters:** None

**Returns:** `void`

### `get_auto_backup_settings`

Get auto-backup configuration.

**Parameters:** None

**Returns:**
```typescript
interface AutoBackupSettings {
  enabled: boolean;
  frequency: string;         // e.g., "1d", "7d", "30d"
  backup_location: string?;  // Custom path or null for default
  retention_count: number;   // Number of backups to keep
}
```

### `update_auto_backup_settings`

Update auto-backup configuration and reschedule.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `settings` | `AutoBackupSettings` | New settings |

**Returns:** `void`

### `get_backup_directory`

Get the current backup directory path.

**Parameters:** None

**Returns:** `string`

---

## Import Commands

### `import_from_onenote`

Import all notes from Microsoft OneNote. OneNote sections are mapped to SwatNotes collections, and pages become notes within those collections.

**Parameters:** None

**Returns:**
```typescript
interface ImportResult {
  notes_imported: number;        // Total notes imported
  collections_created: number;   // Total collections created
  sections_mapped: {             // Section ID to Collection ID mapping
    [section_id: string]: string;
  };
  errors: string[];              // Any errors encountered
}
```

**Example:**
```typescript
const result = await invoke<ImportResult>('import_from_onenote');
console.log(`Imported ${result.notes_imported} notes into ${result.collections_created} collections`);
if (result.errors.length > 0) {
  console.warn('Import errors:', result.errors);
}
```

**Notes:**
- Requires OneNote to be installed (Windows only)
- Sections become Collections with matching names
- Pages are converted to notes with Quill Delta format
- Import is additive - existing notes are not affected
- Large imports may take several minutes

---

## Data Types

### Note

```typescript
interface Note {
  id: string;
  title: string;
  content_json: string;    // Quill Delta JSON
  created_at: string;      // ISO 8601
  updated_at: string;      // ISO 8601
  deleted_at: string | null;
  title_modified: boolean; // True if title was manually edited
}
```

### Attachment

```typescript
interface Attachment {
  id: string;
  note_id: string;
  filename: string;
  mime_type: string;
  blob_hash: string;       // SHA-256 content hash
  size_bytes: number;
  size: number;            // Alias for size_bytes
  created_at: string;
}
```

### Backup

```typescript
interface Backup {
  id: string;
  path: string;
  timestamp: string;       // ISO 8601
  size: number;            // Bytes
  manifest_hash: string;   // SHA-256 of manifest
}
```

### Reminder

```typescript
interface Reminder {
  id: string;
  note_id: string;
  trigger_time: string;    // ISO 8601
  triggered: boolean;
  created_at: string;
}
```

### ImportResult

```typescript
interface ImportResult {
  notes_imported: number;
  collections_created: number;
  sections_mapped: {
    [section_id: string]: string;  // Section ID → Collection ID
  };
  errors: string[];                // Import errors
}
```

---

## Events

The backend emits these events that can be listened to with `listen()`:

| Event | Payload | Description |
|-------|---------|-------------|
| `reminder-triggered` | `{ note_id: string, note_title: string }` | Reminder has triggered |
| `notes-list-changed` | `void` | Notes list should be refreshed |
| `focus-search` | `void` | Focus the search input |
| `toggle-note-window` | `void` | Toggle visibility of a note window |
