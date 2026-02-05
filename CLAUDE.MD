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
6. **Modular Commands**: Commands organized by domain (notes, windows, backup, etc.)

### Key Services

#### Database Layer (`src-tauri/src/database/`)
- **Tables**: notes, attachments, reminders, backups, settings
- **WAL Mode**: Enabled for concurrent reads/writes
- **FTS5**: Full-text search with BM25 ranking
- **Migrations**: Auto-applied on startup
- **Repository Pattern**: Clean separation from business logic

#### Blob Store (`src-tauri/src/storage/blob_store.rs`)
- Content-addressed storage (SHA-256)
- Automatic deduplication
- Atomic writes with temp files
- Reference counting for cleanup

#### Services (`src-tauri/src/services/`)
- **Notes**: CRUD, autosave (1000ms debounce), full-text search
- **Attachments**: File and image handling
- **Backup**: Encrypted backups with manifest and checksums
- **Reminders**: Background scheduler (checks every 5 seconds) with notifications
- **Settings**: Hotkeys, auto-backup, reminder preferences
- **Scheduler**: Automatic backup scheduling with retention policy
- **Credentials**: Secure credential storage using OS keyring

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
│   │   ├── noteEditor.ts          # Quill editor wrapper
│   │   ├── noteEditor.test.ts     # Editor tests
│   │   ├── notesList.ts           # Notes list rendering
│   │   └── notesList.test.ts      # List tests
│   ├── events/                    # Event handlers
│   ├── state/                     # State management
│   │   ├── appState.ts            # Centralized state with pub-sub
│   │   └── appState.test.ts
│   ├── styles/                    # CSS/Tailwind
│   ├── ui/                        # UI helpers (theme, backup)
│   ├── utils/                     # API wrappers
│   │   ├── notesApi.ts            # Note CRUD
│   │   ├── attachmentsApi.ts      # Attachment operations
│   │   ├── backupApi.ts           # Backup operations
│   │   ├── remindersApi.ts        # Reminder operations
│   │   ├── formatters.ts          # Date/text formatting
│   │   ├── logger.ts              # Frontend logging
│   │   └── modal.ts               # Dialog utilities
│   ├── main.ts                    # Main app entry
│   ├── settings.ts                # Settings page
│   ├── sticky-note.ts             # Quick note window
│   └── types.ts                   # TypeScript types
│
├── src-tauri/                     # Rust backend
│   ├── src/
│   │   ├── app.rs                 # AppState, tray, hotkeys setup
│   │   ├── commands/              # Modular command handlers
│   │   │   ├── mod.rs             # Exports all commands
│   │   │   ├── notes.rs           # Note CRUD and search
│   │   │   ├── windows.rs         # Window management
│   │   │   ├── attachments.rs     # Attachment operations
│   │   │   ├── backup.rs          # Backup/restore
│   │   │   ├── reminders.rs       # Reminder operations
│   │   │   ├── collections.rs     # Collections/folders management
│   │   │   ├── settings.rs        # All settings commands
│   │   │   └── updater.rs         # Auto-update functionality
│   │   ├── config.rs              # App configuration constants
│   │   ├── crypto.rs              # Encryption utilities
│   │   ├── error.rs               # Custom error types
│   │   ├── main.rs                # Entry point
│   │   ├── database/
│   │   │   ├── mod.rs
│   │   │   ├── models.rs          # DB entity structs
│   │   │   ├── repository.rs      # DB operations
│   │   │   ├── schema.rs          # Table definitions
│   │   │   └── migrations/        # SQL migrations
│   │   ├── services/
│   │   │   ├── mod.rs
│   │   │   ├── attachments.rs     # File/image handling
│   │   │   ├── backup.rs          # Backup creation/restore
│   │   │   ├── notes.rs           # Note operations
│   │   │   ├── reminders.rs       # Reminder scheduler
│   │   │   ├── settings.rs        # Settings persistence
│   │   │   ├── scheduler.rs       # Auto-backup scheduler
│   │   │   └── credentials.rs     # OS credential storage
│   │   └── storage/
│   │       └── blob_store.rs      # Content-addressed storage
│   ├── Cargo.toml
│   └── tauri.conf.json
│
├── ARCHITECTURE.md                # Detailed architecture docs
├── CLAUDE.MD                      # This file
├── docs/
│   ├── TESTING.md                 # Testing guide
│   └── API.md                     # API documentation
└── README.md                      # User documentation
```

## Development Guidelines

### Code Style
- **Rust**: Run `cargo fmt && cargo clippy` before committing
- **TypeScript**: Follow existing patterns, use strict types
- **No Unwrap**: Use proper error handling with `?` operator
- **Async**: All I/O operations should be async
- **Modular**: Keep files focused, split large modules

### Testing
```bash
# Rust tests
cd src-tauri
cargo test

# Frontend unit tests
npm run test
npm run test:coverage

# E2E tests (requires built app)
npm run tauri build
npm run test:e2e

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
1. Add function in appropriate module under `src-tauri/src/commands/`
2. Mark with `#[tauri::command]`
3. Export from `commands/mod.rs`
4. Register in `main.rs` invoke handler
5. Call from frontend using `invoke('command_name', { args })`

### Key Features

#### Autosave
- Debounced at 1000ms after last edit
- Force save on blur, window close, app quit
- Uses SQLite transactions for atomicity

#### Backups
- Encrypted ZIP with AES-256-GCM
- Contains: manifest.json, db.sqlite, blobs/
- Retention: Last 10 backups (configurable)
- Checksums verified on restore
- Auto-restart offered after restore

#### Collections
- Organize notes into color-coded collections/folders
- Optional descriptions and custom colors
- Notes can exist without a collection (uncategorized)
- Deleting a collection sets notes to uncategorized (preserves data)

#### Reminders
- Background scheduler checks every 5 seconds
- System notifications on trigger with customizable settings
- Per-reminder notification preferences (sound, visual effects)
- Handles missed reminders on app restart

#### System Tray Integration
- **Left-click**: Opens main application window
- **Double-click**: Opens main application window
- **Right-click**: Shows context menu
- Menu items: Show, New Note, Toggle Note, Settings, Quit
- Configurable global hotkeys displayed in menu

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

### Cross-Platform Code
```rust
// Use cfg attributes for platform-specific code
#[cfg(target_os = "windows")]
fn platform_specific_impl() -> Result<()> {
    // Windows implementation
}

#[cfg(not(target_os = "windows"))]
fn platform_specific_impl() -> Result<()> {
    Err(AppError::Generic("Not supported on this platform".into()))
}
```

### Window Creation Pattern (Prevent White Flash)

**CRITICAL**: All new windows MUST follow this rigorous pattern to prevent white flash on launch:

#### The Pattern
1. **Rust**: Create window with `visible(false)`
2. **Rust**: Do NOT call `window.show()` immediately
3. **TypeScript**: Apply theme on page load
4. **TypeScript**: Load content
5. **TypeScript**: Call `window.show()` and `window.setFocus()`
6. **Result**: No white flash, smooth dark theme appearance

#### Example Implementation

**Rust (commands/windows.rs):**
```rust
#[tauri::command]
pub fn open_my_window(app: tauri::AppHandle) -> Result<()> {
    let _window = WebviewWindowBuilder::new(
        &app,
        "my-window",
        WebviewUrl::App("my-page.html".into()),
    )
    .title("My Window")
    .inner_size(700.0, 900.0)
    .visible(false)  // Hidden until content loads to prevent flash
    .build()?;

    // Window will be shown by TypeScript after theme is applied
    Ok(())
}
```

**TypeScript (my-page.ts):**
```typescript
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';

async function init(): Promise<void> {
  // Apply theme first
  applyTheme();

  // Load content
  await loadContent();

  // Show window after content is loaded to prevent white flash
  const currentWindow = getCurrentWebviewWindow();
  try {
    await currentWindow.show();
    await currentWindow.setFocus();
  } catch (e) {
    console.error('Failed to show window:', e);
  }
}

// Initialize on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
```

### System Tray Setup
```rust
let _tray = TrayIconBuilder::new()
    .icon(icon)
    .menu(&menu)
    .menu_on_left_click(false) // Only show menu on right-click
    .tooltip("AppName")
    .on_tray_icon_event(|tray, event| {
        use tauri::tray::{MouseButton, MouseButtonState, TrayIconEvent};
        match event {
            TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } => {
                // Left click opens main window
            }
            _ => {}
        }
    })
    .on_menu_event(|app, event| {
        // Handle menu item clicks
    })
    .build(app)?;
```

## Security Considerations

1. **XSS Prevention**: Note content stored as Quill Delta JSON, not raw HTML; use `escapeHtml()` for display
2. **SQL Injection**: Parameterized queries via SQLx
3. **Path Traversal**: Validate all paths against allowed directories using `canonicalize()`
4. **Content Validation**: Sanitize attachment filenames
5. **Backup Integrity**: SHA-256 checksums verified on restore
6. **Encryption**: AES-256-GCM with Argon2id key derivation
7. **Credential Storage**: Use OS keyring for sensitive data (not plaintext files)

## Performance Targets

- App startup: < 1 second
- Note load: < 100ms
- Autosave latency: < 50ms after debounce
- Backup creation: < 5 seconds for 1000 notes

## Troubleshooting

### Build Issues
- **Linux**: Install dependencies: `libwebkit2gtk-4.1-dev`, `libgtk-3-dev`, `libsoup-3.0-dev`
- **Rust version**: Update with `rustup update`

### Runtime Issues
- **Database locked**: Close other instances, check for zombie processes
- **Reminders not working**: Check system notification permissions
- **Tray icon missing**: Verify platform support for system tray

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

## Tauri Plugins in Use

| Plugin | Purpose |
|--------|---------|
| `tauri-plugin-dialog` | File dialogs, alerts, confirmations |
| `tauri-plugin-fs` | Filesystem access |
| `tauri-plugin-global-shortcut` | Global hotkeys |
| `tauri-plugin-notification` | System notifications |
| `tauri-plugin-shell` | Shell commands |
| `tauri-plugin-process` | App restart/exit |
| `tauri-plugin-updater` | Auto-updates from GitHub Releases |
| `tauri-plugin-clipboard-manager` | Clipboard operations |

## Key Rust Crates

| Crate | Purpose |
|-------|---------|
| `sqlx` | Database with compile-time SQL checking |
| `tokio` | Async runtime |
| `serde`/`serde_json` | Serialization |
| `anyhow`/`thiserror` | Error handling |
| `tracing` | Structured logging |
| `sha2` | Hashing for content-addressed storage |
| `zip` | Backup archives |
| `chrono` | Date/time |
| `aes-gcm` | Encryption |
| `argon2` | Key derivation |
| `keyring` | OS credential storage |
| `tokio-cron-scheduler` | Cron-based scheduling for auto-backups |

## Notes

- This is a **production-grade** application - code quality matters
- All database operations should be **async**
- Use **transactions** for multi-step operations
- **Never panic** in production code paths
- **Log errors** with context using tracing
- Frontend should **never directly access** filesystem or database
- All file I/O goes through **Tauri commands**
- Keep commands **modular** - split by domain not by size
- Tests should **mock Tauri APIs** properly

---

# General Rust + Tauri Application Guidelines

This section provides reusable guidelines for building high-quality Rust + Tauri applications. Copy and adapt these patterns for new projects.

## Project Setup Checklist

### Rust Backend Structure
```
src-tauri/src/
├── main.rs              # Entry point, plugin registration
├── app.rs               # AppState, initialization, tray setup
├── config.rs            # Constants and configuration
├── error.rs             # Custom error types with thiserror
├── commands/            # Modular Tauri commands
│   ├── mod.rs           # Re-exports all commands
│   └── [domain].rs      # Domain-specific commands
├── services/            # Business logic layer
│   ├── mod.rs
│   └── [service].rs
├── database/            # Data access layer
│   ├── mod.rs
│   ├── models.rs        # Entity structs
│   ├── repository.rs    # CRUD operations
│   └── migrations/      # SQL files
└── storage/             # File storage (if needed)
```

### Frontend Structure
```
src/
├── components/          # UI components with colocated tests
├── state/               # State management
├── utils/               # API wrappers for Tauri commands
├── ui/                  # UI helpers (theme, modals)
├── events/              # Event handlers
├── types.ts             # Shared TypeScript types
└── [page].ts            # Page entry points
```

## Code Quality Standards

### Rust

1. **Error Handling**
   ```rust
   // Define custom errors with thiserror
   #[derive(Error, Debug)]
   pub enum AppError {
       #[error("Database error: {0}")]
       Database(#[from] sqlx::Error),
       #[error("IO error: {0}")]
       Io(#[from] std::io::Error),
       #[error("{0}")]
       Generic(String),
   }

   pub type Result<T> = std::result::Result<T, AppError>;
   ```

2. **No Unwrap/Expect**
   ```rust
   // Bad
   let value = some_option.unwrap();

   // Good
   let value = some_option.ok_or_else(|| AppError::Generic("Value not found".into()))?;
   ```

3. **Structured Logging**
   ```rust
   tracing::info!("Operation completed: id={}, status={}", id, status);
   tracing::error!("Failed to save: {}", error);
   ```

4. **Async Consistency**
   ```rust
   // All I/O operations should be async
   pub async fn load_data(&self) -> Result<Data> {
       // ...
   }
   ```

### TypeScript

1. **Type Safety**
   ```typescript
   // Define types for all Tauri command responses
   interface Note {
     id: string;
     title: string;
     content_json: string;
     created_at: string;
     updated_at: string;
   }

   // Type invoke calls
   const note = await invoke<Note>('get_note', { id });
   ```

2. **API Wrapper Pattern**
   ```typescript
   // utils/notesApi.ts
   import { invoke } from '@tauri-apps/api/core';
   import type { Note } from '../types';

   export async function getNote(id: string): Promise<Note> {
     return invoke('get_note', { id });
   }
   ```

3. **Test Mocking**
   ```typescript
   vi.mock('@tauri-apps/api/core', () => ({
     invoke: vi.fn(),
   }));
   ```

## Architecture Patterns

### Service Layer Pattern
```rust
// services/notes.rs
pub struct NotesService {
    repository: Repository,
}

impl NotesService {
    pub fn new(repository: Repository) -> Self {
        Self { repository }
    }

    pub async fn create_note(&self, title: String, content: String) -> Result<Note> {
        // Business logic here
        self.repository.insert_note(&title, &content).await
    }
}
```

### Repository Pattern
```rust
// database/repository.rs
pub struct Repository {
    pool: SqlitePool,
}

impl Repository {
    pub async fn insert_note(&self, title: &str, content: &str) -> Result<Note> {
        let note = sqlx::query_as!(
            Note,
            "INSERT INTO notes (title, content) VALUES (?, ?) RETURNING *",
            title,
            content
        )
        .fetch_one(&self.pool)
        .await?;

        Ok(note)
    }
}
```

### Command Module Pattern
```rust
// commands/mod.rs
pub mod notes;
pub mod backup;
pub mod settings;

pub use notes::*;
pub use backup::*;
pub use settings::*;

// commands/notes.rs
use crate::app::AppState;
use crate::error::Result;
use tauri::State;

#[tauri::command]
pub async fn create_note(
    state: State<'_, AppState>,
    title: String,
    content: String,
) -> Result<Note> {
    state.notes_service.create_note(title, content).await
}
```

### State Management (Frontend)
```typescript
// state/appState.ts
type Subscriber<T> = (value: T) => void;

class AppState {
  private _selectedNoteId: string | null = null;
  private subscribers: Map<string, Set<Subscriber<any>>> = new Map();

  get selectedNoteId() { return this._selectedNoteId; }

  setSelectedNoteId(id: string | null) {
    this._selectedNoteId = id;
    this.notify('selectedNoteId', id);
  }

  subscribe<T>(key: string, callback: Subscriber<T>): () => void {
    if (!this.subscribers.has(key)) {
      this.subscribers.set(key, new Set());
    }
    this.subscribers.get(key)!.add(callback);
    return () => this.subscribers.get(key)!.delete(callback);
  }

  private notify<T>(key: string, value: T) {
    this.subscribers.get(key)?.forEach(cb => cb(value));
  }
}

export const appState = new AppState();
```

## Security Checklist

- [ ] Use parameterized queries (SQLx handles this)
- [ ] Validate file paths with `canonicalize()` against allowed directories
- [ ] Escape HTML in user-generated content
- [ ] Use proper encryption (AES-256-GCM) with secure key derivation (Argon2id)
- [ ] Store credentials in OS keyring, not plaintext
- [ ] Validate all inputs at system boundaries
- [ ] Use Tauri's capability system for fine-grained permissions
- [ ] Never expose internal paths to frontend

## Testing Strategy

### Unit Tests
- Test services and repositories with in-memory SQLite
- Mock external dependencies
- Test error cases explicitly

### Frontend Tests
- Mock Tauri invoke calls
- Test component behavior
- Test state management

### Integration Tests
- Test full command flow
- Verify database state after operations

### E2E Tests (Tauri/WebView2)

End-to-end testing for Tauri apps uses **WebdriverIO v7** with **msedgedriver** connecting to the WebView2 component via remote debugging.

#### Prerequisites
1. Build the app: `npm run tauri build`
2. Install msedgedriver matching your Edge version from https://developer.microsoft.com/en-us/microsoft-edge/tools/webdriver/
3. Add msedgedriver to PATH

#### npm Dependencies
```json
{
  "devDependencies": {
    "@wdio/cli": "^7.36.0",
    "@wdio/local-runner": "^7.36.0",
    "@wdio/mocha-framework": "^7.33.0",
    "@wdio/spec-reporter": "^7.33.0",
    "webdriverio": "^7.36.0"
  }
}
```

#### wdio.conf.cjs Configuration
```javascript
/**
 * WebdriverIO Configuration for Tauri E2E Testing
 *
 * Strategy: Start the Tauri app with WebView2 remote debugging enabled,
 * then connect msedgedriver to it via debuggerAddress.
 */

const { spawn, spawnSync } = require('child_process');
const path = require('path');

// Remote debugging port for WebView2
const DEBUG_PORT = 9222;

// Determine the application binary path based on platform
function getAppBinaryPath() {
  const platform = process.platform;
  const basePath = path.resolve(__dirname, 'target', 'release');

  if (platform === 'win32') {
    return path.join(basePath, 'appname.exe');
  } else if (platform === 'darwin') {
    return path.join(basePath, 'bundle', 'macos', 'AppName.app', 'Contents', 'MacOS', 'appname');
  } else {
    return path.join(basePath, 'appname');
  }
}

let edgeDriver = null;
let tauriApp = null;

exports.config = {
  hostname: '127.0.0.1',
  port: 4444,
  specs: ['./e2e/**/*.spec.ts'],
  maxInstances: 1,

  // Connect to already-running app via debuggerAddress
  capabilities: [{
    maxInstances: 1,
    browserName: 'webview2',
    'ms:edgeOptions': {
      debuggerAddress: `localhost:${DEBUG_PORT}`,
    },
  }],

  framework: 'mocha',
  mochaOpts: { ui: 'bdd', timeout: 60000 },
  reporters: ['spec'],
  logLevel: 'warn',
  waitforTimeout: 10000,
  connectionRetryTimeout: 90000,
  connectionRetryCount: 5,
  runner: 'local',

  onPrepare: async function () {
    const appPath = getAppBinaryPath();

    // Kill any existing processes on ports
    if (process.platform === 'win32') {
      try {
        spawnSync('cmd', ['/c', 'for /f "tokens=5" %a in (\'netstat -ano ^| findstr :4444\') do taskkill /F /PID %a'], { shell: true, stdio: 'ignore' });
        spawnSync('cmd', ['/c', 'for /f "tokens=5" %a in (\'netstat -ano ^| findstr :9222\') do taskkill /F /PID %a'], { shell: true, stdio: 'ignore' });
      } catch (e) {}
    }

    // Start app with WebView2 remote debugging
    tauriApp = spawn(appPath, [], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${DEBUG_PORT}`,
      },
    });

    // Wait for app to start
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Start msedgedriver
    const driverName = process.platform === 'win32' ? 'msedgedriver.exe' : 'msedgedriver';
    edgeDriver = spawn(driverName, ['--port=4444', '--verbose'], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    await new Promise(resolve => setTimeout(resolve, 2000));
  },

  onComplete: async function () {
    if (edgeDriver) {
      if (process.platform === 'win32') {
        spawnSync('taskkill', ['/F', '/T', '/PID', String(edgeDriver.pid)], { stdio: 'ignore' });
      } else {
        edgeDriver.kill();
      }
    }
    if (tauriApp) {
      if (process.platform === 'win32') {
        spawnSync('taskkill', ['/F', '/T', '/PID', String(tauriApp.pid)], { stdio: 'ignore' });
      } else {
        tauriApp.kill();
      }
    }
  },
};
```

#### E2E Test Example
```typescript
// e2e/app.spec.ts
describe('Application', () => {
  it('should launch and display main UI', async () => {
    const title = await browser.getTitle();
    expect(title).toContain('AppName');
  });

  it('should display main button', async () => {
    const button = await $('#main-button');
    await expect(button).toBeDisplayed();
  });

  it('should create item when clicking button', async () => {
    const button = await $('#new-item-btn');
    await button.click();
    await browser.pause(500);

    const items = await $$('.item-card');
    expect(items.length).toBeGreaterThan(0);
  });
});
```

#### Key Points
- **WebdriverIO v7** is required (v9 has compatibility issues with tauri-driver)
- **browserName: 'webview2'** tells msedgedriver to use WebView2 mode
- **debuggerAddress** connects to already-running app instead of launching browser
- **WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS** enables remote debugging in Tauri
- Each test file runs in its own session but tests within a file share state
- Use `browser.pause()` for timing-sensitive operations
- Selectors: `$('#id')`, `$('.class')`, `$('*=text')` for partial text match

#### Troubleshooting

**"no msedge binary" error**: msedgedriver can't find the app. Use the debuggerAddress approach (start app first, then connect).

**Tests fail intermittently**: Increase wait times or use `waitForDisplayed()` instead of `pause()`.

**Connection refused**: Ensure msedgedriver version matches Edge version, and ports 4444/9222 are free.

## Performance Guidelines

- Enable SQLite WAL mode for concurrent access
- Use connection pooling
- Debounce frequent operations (autosave: 500ms)
- Lazy load expensive data
- Use content-addressed storage for deduplication

## Deployment Checklist

- [ ] Run `cargo clippy` with no warnings
- [ ] Run `cargo fmt`
- [ ] All tests pass
- [ ] Type check passes (`npm run type-check`)
- [ ] Build succeeds in release mode
- [ ] Test on target platforms
- [ ] Update version numbers
- [ ] Update changelog

---

This document serves as both project-specific context and reusable guidelines for building production-quality Rust + Tauri applications.
