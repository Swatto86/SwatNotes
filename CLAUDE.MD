# SwatNotes - Claude Context

## Project Overview
SwatNotes is a production-grade desktop notes application built with Rust and Tauri v2. It combines powerful features with a clean, intuitive interface for seamless note-taking with rich text editing, attachments, encrypted backups, reminders, and system tray integration.

## Tech Stack

### Backend (Rust)
- **Framework**: Tauri v2 (desktop app framework)
- **Database**: SQLx with SQLite (compile-time checked SQL, WAL mode)
- **Async Runtime**: Tokio
- **Encryption**: AES-256-GCM for backups, Argon2id for key derivation
- **Serialization**: Serde
- **Error Handling**: anyhow + thiserror
- **Logging**: tracing
- **Storage**: SHA-256 content-addressed blob store

### Frontend
- **Build Tool**: Vite (multi-page app configuration)
- **Language**: TypeScript
- **Rich Text Editor**: Quill.js (WYSIWYG)
- **Styling**: Tailwind CSS + DaisyUI (20+ themes)
- **Testing**: Vitest with happy-dom

## Architecture

### Core Principles
1. **Clean Architecture**: Repository pattern, service layer separation
2. **No Panics**: No `unwrap()`/`expect()` in production code
3. **Async Everything**: Non-blocking I/O throughout
4. **Type Safety**: Compile-time SQL checks via SQLx
5. **Error Handling**: Proper Result types with context

### Key Services

#### Database Layer (`src-tauri/src/database/`)
- **Tables**: notes, attachments, reminders, backups, settings
- **WAL Mode**: Enabled for concurrent reads/writes
- **Migrations**: Auto-applied on startup
- **Repository Pattern**: Clean separation from business logic

#### Blob Store (`src-tauri/src/storage/blob_store.rs`)
- Content-addressed storage (SHA-256)
- Automatic deduplication
- Atomic writes with temp files
- Reference counting for cleanup

#### Services (`src-tauri/src/services/`)
- **Notes**: CRUD, autosave (500ms debounce)
- **Attachments**: File and image handling
- **Backup**: Encrypted backups with manifest and checksums
- **Reminders**: Background scheduler with notifications

### Data Locations
- **Windows**: `%APPDATA%\com.swatnotes.app\`
- **macOS**: `~/Library/Application Support/com.swatnotes.app/`
- **Linux**: `~/.local/share/com.swatnotes.app/`

Directory structure:
```
<app_data>/
├── db.sqlite (+ WAL/SHM files)
├── blobs/[hash-prefix]/[hash]
├── backups/backup_[timestamp].zip
└── logs/swatnotes.log
```

## Project Structure

```
SwatNotes/
├── src/                           # Frontend TypeScript/JS
│   ├── components/                # UI components
│   ├── events/                    # Event handlers
│   ├── styles/                    # CSS/Tailwind
│   ├── ui/                        # UI helpers
│   ├── utils/                     # API wrappers
│   ├── main.ts                    # Main app entry
│   ├── settings.ts                # Settings page
│   ├── sticky-note.ts             # Quick note window
│   └── types.ts                   # TypeScript types
│
├── src-tauri/                     # Rust backend
│   ├── src/
│   │   ├── app.rs                 # AppState, service initialization
│   │   ├── commands.rs            # Tauri command handlers
│   │   ├── config.rs              # App configuration
│   │   ├── crypto.rs              # Encryption utilities
│   │   ├── error.rs               # Custom error types
│   │   ├── main.rs                # Entry point
│   │   ├── database/
│   │   │   ├── mod.rs
│   │   │   ├── models.rs          # DB entity structs
│   │   │   ├── repository.rs     # DB operations
│   │   │   ├── schema.rs         # Table definitions
│   │   │   └── migrations/       # SQL migrations
│   │   ├── services/
│   │   │   ├── attachments.rs    # File/image handling
│   │   │   ├── backup.rs         # Backup creation
│   │   │   ├── notes.rs          # Note operations
│   │   │   └── reminders.rs      # Reminder scheduler
│   │   └── storage/
│   │       └── blob_store.rs     # Content-addressed storage
│   ├── Cargo.toml
│   └── tauri.conf.json
│
├── ARCHITECTURE.md                # Detailed architecture docs
├── CLAUDE.MD                      # This file
└── README.md                      # User documentation
```

## Development Guidelines

### Code Style
- **Rust**: Run `cargo fmt && cargo clippy` before committing
- **TypeScript**: Follow existing patterns
- **No Unwrap**: Use proper error handling with `?` operator
- **Async**: All I/O operations should be async

### Testing
```bash
# Rust tests
cd src-tauri
cargo test

# Frontend tests
npm run test
npm run test:coverage

# Type checking
npm run type-check
```

### Common Tasks

#### Running Development Build
```bash
npm run tauri dev
```

#### Building for Production
```bash
npm run tauri build
# Output: src-tauri/target/release/bundle/
```

#### Adding Database Migrations
1. Create new SQL file in `src-tauri/src/database/migrations/`
2. Migrations run automatically on app startup
3. Use transactions for multi-step migrations

#### Adding New Tauri Command
1. Add function in `src-tauri/src/commands.rs`
2. Mark with `#[tauri::command]`
3. Register in `main.rs` invoke handler
4. Call from frontend using `invoke('command_name', { args })`

### Key Features

#### Autosave
- Debounced at 500ms after last edit
- Force save on blur, window close, app quit
- Uses SQLite transactions for atomicity

#### Backups
- Encrypted ZIP with AES-256-GCM
- Contains: manifest.json, db.sqlite, blobs/
- Retention: Last 10 backups (configurable)
- Checksums verified on restore

#### Reminders
- Background scheduler checks every 60 seconds
- System notifications on trigger
- Handles missed reminders on app restart

#### System Integration
- Global hotkey: `Ctrl+Shift+N` for quick notes
- System tray with menu (New Note, Settings, Quit)
- Minimize to tray option

## Important Patterns

### Frontend → Backend Communication
```typescript
// Frontend (TypeScript)
import { invoke } from '@tauri-apps/api/core';

const result = await invoke('save_note', {
  noteId: 123,
  content: '...'
});
```

```rust
// Backend (Rust)
#[tauri::command]
async fn save_note(
    state: State<'_, AppState>,
    note_id: i64,
    content: String,
) -> Result<(), String> {
    // Implementation
}
```

### Error Handling
```rust
// Service layer returns Result
pub async fn save_note(&self, id: i64, content: &str) -> Result<Note> {
    self.repository.update_note(id, content)
        .await
        .context("Failed to save note")?;
    Ok(note)
}

// Commands convert to String error for Tauri
#[tauri::command]
async fn save_note(...) -> Result<Note, String> {
    state.notes_service.save_note(id, content)
        .await
        .map_err(|e| e.to_string())
}
```

### Database Transactions
```rust
let mut tx = self.pool.begin().await?;
// Multiple operations
tx.commit().await?;
```

## Security Considerations

1. **XSS Prevention**: Note content stored as Quill Delta JSON, not raw HTML
2. **SQL Injection**: Parameterized queries via SQLx
3. **Path Traversal**: Use Tauri's path APIs, validate all paths
4. **Content Validation**: Sanitize attachment filenames
5. **Backup Integrity**: SHA-256 checksums verified on restore
6. **Encryption**: AES-256-GCM with Argon2id key derivation

## Performance Targets

- App startup: < 1 second
- Note load: < 100ms
- Autosave latency: < 50ms after debounce
- Backup creation: < 5 seconds for 1000 notes

## Troubleshooting

### Build Issues
- **Linux**: Install dependencies: `libwebkit2gtk-4.1-dev`, `libgtk-3-dev`
- **Rust version**: Update with `rustup update`

### Runtime Issues
- **Database locked**: Close other instances, check for zombie processes
- **Reminders not working**: Check system notification permissions
- **Tray icon missing**: Verify platform support for system tray

## Future Enhancements (Roadmap)

- Cloud sync
- Mobile apps (iOS/Android)
- Markdown import/export
- Tags and categories
- Plugin system
- Voice notes
- OCR for images
- Full-text search with FTS5

## Working with Claude

### When Adding Features
1. Read relevant existing code first
2. Follow established patterns (repository → service → command)
3. Add proper error handling
4. Update tests if applicable
5. Run `cargo clippy` and fix warnings

### When Fixing Bugs
1. Reproduce the issue
2. Check logs (`<app_data>/logs/swatnotes.log`)
3. Add test case if missing
4. Fix and verify
5. Ensure no regressions

### When Refactoring
1. Ensure tests pass before starting
2. Make incremental changes
3. Keep commits focused
4. Verify builds and tests after each change

## Dependencies to Know

### Tauri Plugins
- `@tauri-apps/plugin-dialog`: File dialogs
- `@tauri-apps/plugin-fs`: Filesystem access
- `@tauri-apps/plugin-global-shortcut`: Hotkeys
- `@tauri-apps/plugin-notification`: System notifications
- `@tauri-apps/plugin-shell`: Shell commands

### Rust Crates
- `sqlx`: Database with compile-time SQL checking
- `tokio`: Async runtime
- `serde`/`serde_json`: Serialization
- `anyhow`/`thiserror`: Error handling
- `tracing`: Structured logging
- `sha2`: Hashing for content-addressed storage
- `zip`: Backup archives
- `chrono`: Date/time

## Notes

- This is a **production-grade** application - code quality matters
- All database operations should be **async**
- Use **transactions** for multi-step operations
- **Never panic** in production code paths
- **Log errors** with context using tracing
- Frontend should **never directly access** filesystem or database
- All file I/O goes through **Tauri commands**
