# SwatNotes Architecture

> See also [PROJECT_ATLAS.md](PROJECT_ATLAS.md) — the authoritative navigation index for this repository.

## Overview
SwatNotes is a production-grade desktop notes application built with Rust + Tauri v2, featuring a DaisyUI-themed UI with comprehensive backup, reminder, and system integration capabilities.

## Module Architecture

### 1. Frontend (Tauri Webview)
**Technology**: HTML/CSS/JS with Tailwind CSS + DaisyUI
**Responsibilities**:
- Rich text editor (using Quill.js)
- Note list and detail views
- Settings UI
- Backup/restore UI
- Theme management (DaisyUI themes)

**Boundaries**:
- HTML entry points live in `pages/`
- TypeScript/CSS source code lives in `src/`
- Communicates with Rust backend via Tauri commands
- Never directly accesses filesystem or database

### 2. Rust Core Services

#### 2.1 Application Core (`src-tauri/src/app.rs`)
- Central AppState holding all services
- Service initialization and lifecycle management
- Event bus for inter-service communication

#### 2.2 Database Layer (`src-tauri/src/database/`)
- **Schema** (`schema.rs`): SQLite table definitions and migrations
- **Repository** (`repository.rs`): CRUD operations with transaction support
- **Models** (`models.rs`): Rust structs representing DB entities

**Tables**:
- `notes`: id, title, content_json, created_at, updated_at, deleted_at
- `attachments`: id, note_id, blob_hash, filename, mime_type, size, created_at
- `reminders`: id, note_id, trigger_time, triggered, created_at
- `backups`: id, timestamp, path, size, manifest_hash
- `settings`: key, value

**Configuration**:
- WAL mode enabled
- Foreign keys enforced
- Auto-vacuum enabled

#### 2.3 Blob Store (`src-tauri/src/storage/blob_store.rs`)
- Content-addressed storage (SHA-256 hash as key)
- Operations: `write(data) -> hash`, `read(hash) -> data`, `delete(hash)`, `exists(hash)`
- Atomic writes with temp files
- Reference counting to prevent orphaned blobs

**Directory Structure**:
```
<app_data>/
├── blobs/
│   ├── ab/
│   │   └── cd/
│   │       └── abcd1234...
├── db.sqlite
├── db.sqlite-wal
├── db.sqlite-shm
├── backups/
│   ├── backup_2026-01-17_143022.zip
│   └── backup_2026-01-17_150000.zip
└── logs/
    └── swatnotes.log
```

#### 2.4 Notes Service (`src-tauri/src/services/notes.rs`)
- High-level note operations
- Handles autosave debouncing
- Coordinates between repository and blob store
- Manages note lifecycle (create, update, delete, soft-delete)

**Autosave Strategy**:
- Debounce writes: 1000ms after last edit
- Force save on: blur, window close, app quit
- Use SQLite transactions for atomicity

#### 2.5 Backup Service (`src-tauri/src/services/backup.rs`)
- Creates consistent snapshots (DB + blobs + settings)
- Manifest format: JSON with file list, checksums, timestamp
- Backup artifact: ZIP file with structure:
  ```
  manifest.json
  db.sqlite
  blobs/
    ab/cd/abcd1234...
  ```
- Scheduled backups using tokio interval timer
- Retention policy: keeps last N backups (configurable)

**Backup Flow**:
1. Acquire write lock on database
2. Checkpoint WAL to consolidate DB file
3. Create manifest with checksums (SHA-256)
4. Package DB + blobs into ZIP
5. Move to backups directory with timestamp
6. Clean old backups per retention policy
7. Record backup in database

#### 2.6 Restore Service (`src-tauri/src/services/restore.rs`)
- Validates backup integrity (checksums)
- Staged restore: extract to temp -> verify -> swap
- Atomic replacement: rename current to .old, rename temp to current
- Rollback on failure

**Restore Flow**:
1. User selects backup file
2. Extract to temp directory
3. Verify manifest checksums
4. Close all database connections
5. Atomic swap: current -> .old, backup -> current
6. Restart services
7. Delete .old on success

#### 2.7 Reminder Service (`src-tauri/src/services/reminder.rs`)
- Background scheduler using tokio
- On startup: load all active reminders from DB
- Timer checks every 10 seconds for due reminders
- Handles missed reminders: trigger immediately with "missed" flag

**Reminder Flow**:
1. User creates reminder for note
2. Stored in DB with trigger_time
3. Background scheduler checks every 5 seconds for due reminders
4. At trigger time: emit event to frontend
5. Frontend shows popup window with note
6. Play notification sound (if enabled)
7. Apply visual effects (shake, glow if enabled)
8. Mark as triggered in DB

#### 2.8 Platform Abstraction (`src-tauri/src/platform/`)
- **Trait**: `PlatformIntegration`
  - `setup_tray(&self) -> Result<()>`
  - `register_hotkey(&self, key: String) -> Result<()>`
  - `show_notification(&self, msg: String) -> Result<()>`
- **Implementations**:
  - `WindowsPlatform` (full implementation)
  - `LinuxPlatform` (stub for future)

#### 2.9 System Tray (`src-tauri/src/platform/tray.rs`)
- Menu items: New Note, Open, Backup Now, Restore, Settings, Quit
- Minimize-to-tray behavior (configurable)
- Platform-specific using tauri-plugin-tray

#### 2.10 Global Hotkey (`src-tauri/src/platform/hotkey.rs`)
- Default: Ctrl+Alt+N
- Configurable via settings
- Platform-specific using tauri-plugin-global-hotkey

## Data Flow

### Note Creation/Edit Flow
```
User types in editor
  ↓
Frontend debounces (500ms)
  ↓
Calls Tauri command: save_note(id, content)
  ↓
NotesService::save()
  ↓
Repository::update_note() in transaction
  ↓
SQLite WAL mode ensures durability
```

### Image Paste Flow
```
User pastes image (Ctrl+V) in Quill editor
  ↓
noteEditor.ts: pasteHandler detects image/* clipboard items
  ↓
handleImagePaste → handleFileUpload (reads Blob, derives extension from MIME)
  ↓
attachmentsApi.ts: createAttachment(noteId, filename, mimeType, data)
  ↓ Tauri invoke
commands/attachments.rs: create_attachment
  ↓
services/attachments.rs: AttachmentsService::create_attachment
  - Validates MIME format (must contain '/')
  - Validates file size (≤ 100 MB)
  - Sanitises filename (path traversal prevention)
  ↓
BlobStore::write(image_data) → SHA-256 hash (atomic: temp file + rename)
  ↓
Repository::create_attachment(note_id, hash, filename, mime_type, size)
  ↓
Return Attachment record to frontend
  ↓
insertInlineAttachment → Quill attachment-image blot at cursor position
  ↓
Autosave persists note with embedded blot reference (blobHash in Delta JSON)
```

**On reload**: `AttachmentImageBlot.loadImage` fetches blob data via `get_attachment_data(blobHash)` and renders `<img>`.

**Supported image types**: PNG, JPEG, GIF, WebP, BMP, SVG+XML (allowlist in `ALLOWED_IMAGE_MIMES`).

**Deduplication**: Content-addressed storage means identical images share a single blob file.

### Backup Flow
```
Scheduled timer fires OR user clicks "Backup Now"
  ↓
BackupService::create_backup()
  ↓
Lock database, checkpoint WAL
  ↓
Build manifest with file list + checksums
  ↓
Create ZIP: manifest + db.sqlite + blobs/*
  ↓
Save to backups/ with timestamp
  ↓
Apply retention policy (delete old backups)
  ↓
Record in backups table
```

### Reminder Flow
```
App startup
  ↓
ReminderService::load_active_reminders()
  ↓
Schedule in-memory timers
  ↓
Timer fires
  ↓
Emit event: reminder_triggered(note_id)
  ↓
Frontend receives event
  ↓
Show popup window with note
  ↓
Play notification sound
  ↓
Shake window (CSS animation)
  ↓
Mark reminder as triggered in DB
```

## Technology Choices

### Rust Dependencies
- **tauri** (v2): Desktop app framework
- **sqlx**: Compile-time checked SQL queries with async support
- **tokio**: Async runtime for schedulers and background tasks
- **serde**: Serialization for settings and manifests
- **anyhow**: Error handling with context
- **thiserror**: Custom error types
- **tracing**: Structured logging
- **sha2**: Content-addressed blob storage
- **zip**: Backup archives
- **chrono**: Date/time handling

### Frontend Dependencies
- **Tailwind CSS**: Utility-first styling
- **DaisyUI**: Component library with theme system
- **Quill.js**: Rich text editor (WYSIWYG)
- **Vanilla TypeScript**: Lightweight interactivity (no framework)

## Security Considerations

1. **XSS Prevention**: Store note content as Quill Delta JSON (structured), not raw HTML
2. **SQL Injection**: Use parameterized queries (sqlx prevents this)
3. **Path Traversal**: Validate all file paths, use Tauri's path APIs
4. **Content Validation**: Sanitize filenames in attachments, validate MIME type format
5. **Backup Integrity**: Verify checksums on restore
6. **Attachment Safety**: MIME type format validated (type/subtype), file size capped at 100 MB, atomic blob writes prevent partial/corrupt files

## Error Handling

- All public functions return `Result<T, AppError>`
- Custom error types using thiserror
- Errors logged with full context using tracing
- User-facing errors shown via Tauri dialogs
- No unwrap/expect in production code paths

## Testing Strategy

1. **Frontend Unit Tests** (Vitest + happy-dom): API wrappers, state management, components — colocated `*.test.ts` files
2. **Rust Integration Tests** (`src-tauri/tests/integration_test.rs`): Repository, services, backup/restore cycles
3. **E2E Tests** (WebDriverIO + msedgedriver in `e2e/`): Full application flows through the real built app
4. **Manual Tests**: System tray interactions, platform-specific behaviours

See [docs/TESTING.md](docs/TESTING.md) for the full testing policy including regression, failure-mode, and test-evidence requirements.

## Extensibility

To add a new feature:
1. Create service module in `src-tauri/src/services/`
2. Define public API as trait if cross-platform
3. Register service in AppState
4. Add Tauri commands in `src-tauri/src/commands/`
5. Wire up frontend UI

## Performance Targets

- App startup: < 1 second
- Note load: < 100ms for any note
- Autosave latency: < 50ms after debounce
- Backup creation: < 5 seconds for 1000 notes
- Reminder check interval: 5 seconds

## Future Enhancements

- Mobile apps
- Collaborative editing
- Export to PDF/Markdown
- Plugin system for custom note types
- OCR for images
- Voice notes
