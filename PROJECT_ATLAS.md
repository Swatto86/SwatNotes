# Project Atlas — SwatNotes

> **Single authoritative navigation document for the SwatNotes codebase.**
> Any change that affects structure, APIs, boundaries, build, or configuration
> **MUST** update this Atlas in the same increment.
> Contradictions between this Atlas, code, and tests are **defects**.

---

## 1. System Purpose

SwatNotes is a **production-grade desktop notes application** for Windows,
built with Rust + Tauri v2. It provides rich-text editing, encrypted backups,
file attachments, reminders, system-tray integration, and auto-updates.

### Core Domain Concepts

| Concept | Description |
|---------|-------------|
| **Note** | A rich-text document stored as Quill Delta JSON with title, timestamps, and optional collection membership. |
| **Collection** | A user-defined colour-coded folder for grouping notes. |
| **Attachment** | A file or image linked to a note, stored as a content-addressed blob. Inline images are pasted from the clipboard directly into the Quill editor. |
| **Inline Image** | An image pasted from clipboard (Ctrl+V) into a note. Stored as an attachment blob with a reference embedded in the Quill Delta content. |
| **Reminder** | A time-based trigger linked to a note that fires a notification. |
| **Backup** | An AES-256-GCM encrypted ZIP snapshot of the database and blob store with SHA-256 manifest checksums. |
| **Blob** | A content-addressed (SHA-256) deduplicated file stored under `blobs/`. |
| **Setting** | Configuration persisted in `settings.json` (hotkeys, auto-backup prefs, reminder prefs, behavior settings). Autostart stored in Windows Registry. |

---

## 2. Architectural Boundaries

```
┌─────────────────────────────────────────────────────────────┐
│  Frontend (TypeScript + Vite + Tailwind/DaisyUI + Quill)    │
│  • UI rendering, user interaction, state management         │
│  • Communicates ONLY via Tauri invoke() / events            │
│  • NEVER accesses DB, filesystem, or network directly       │
└───────────────────────────┬─────────────────────────────────┘
                            │ Tauri Commands / Events
┌───────────────────────────▼─────────────────────────────────┐
│  Command Layer  (src-tauri/src/commands/)                    │
│  • Thin handlers that delegate to services                  │
│  • Converts AppError → serialized String for frontend       │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│  Service Layer  (src-tauri/src/services/)                    │
│  • Business logic, scheduling, coordination                 │
│  • Depends on Repository + BlobStore abstractions           │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│  Data Layer                                                 │
│  • Repository (database/repository.rs) — CRUD via SQLx      │
│  • BlobStore (storage/blob_store.rs) — content-addressed I/O │
│  • Schema (database/schema.rs) — migrations                 │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  Platform Adapters  (src-tauri/src/platform/)               │
│  • System tray (tray.rs), global hotkeys (hotkey.rs)        │
│  • Behind PlatformIntegration trait                         │
│  • Windows impl only; Linux/macOS stubs                     │
└─────────────────────────────────────────────────────────────┘
```

### Key Boundary Rules

- **Core logic** (services, repository, blob store, crypto) **MUST NOT** depend on Tauri, UI, or platform.
- Platform behaviour (tray, hotkeys, notifications) **MUST** be isolated behind traits/adapters.
- The frontend **MUST NOT** directly access filesystem or database — all access goes through Tauri commands.
- Cross-cutting concerns (logging via `tracing`, errors via `thiserror`/`anyhow`) **MUST NOT** leak into business logic signatures.

---

## 3. Repository Structure with Responsibilities

```
SwatNotes/
├── PROJECT_ATLAS.md          ← THIS FILE — navigation index
├── ARCHITECTURE.md           ← Detailed architecture & data-flow docs
├── CLAUDE.MD                 ← AI assistant context & coding patterns
├── CHANGELOG.md              ← Release history
├── README.md                 ← User-facing documentation
│
├── pages/                    ← HTML entry points (multi-page Vite app)
│   ├── index.html            ← Main application window
│   ├── about.html            ← About dialog
│   ├── settings.html         ← Settings window
│   ├── sticky-note.html      ← Popup note window
│   └── update-required.html  ← Forced update prompt
│
├── src/                      ← Frontend TypeScript source
│   ├── main.ts               ← Main window entry point
│   ├── settings.ts           ← Settings window entry point
│   ├── sticky-note.ts        ← Sticky note window entry point
│   ├── about.ts              ← About window entry point
│   ├── config.ts             ← Frontend configuration
│   ├── types.ts              ← Shared TypeScript types
│   ├── components/           ← UI components (noteEditor, notesList)
│   ├── events/               ← Event handlers (Tauri event listeners)
│   ├── state/                ← Centralized pub-sub state (appState.ts)
│   ├── styles/               ← Tailwind CSS entry (main.css)
│   ├── ui/                   ← UI helpers (theme, backup dialogs)
│   └── utils/                ← API wrappers (*Api.ts) + formatters, logger, modal
│
├── src-tauri/                ← Rust backend
│   ├── Cargo.toml            ← Rust dependencies
│   ├── tauri.conf.json       ← Tauri configuration (app metadata, plugins, windows)
│   ├── build.rs              ← Tauri build script
│   └── src/
│       ├── main.rs           ← Entry point — plugin registration, command handler
│       ├── app.rs            ← AppState — service init, tray, hotkeys, lifecycle
│       ├── config.rs         ← Application constants
│       ├── crypto.rs         ← AES-256-GCM encryption, Argon2id key derivation
│       ├── error.rs          ← AppError (thiserror) + Result<T> alias
│       ├── lib.rs            ← Library root (for test targets)
│       ├── commands/         ← Tauri command handlers (thin, delegate to services)
│       │   ├── mod.rs        ← Re-exports all commands
│       │   ├── notes.rs      ← CRUD, search, soft-delete, prune
│       │   ├── windows.rs    ← Window management (sticky notes, settings, main)
│       │   ├── attachments.rs← Attachment CRUD
│       │   ├── backup.rs     ← Backup create/restore/delete
│       │   ├── reminders.rs  ← Reminder CRUD + scheduler
│       │   ├── settings.rs   ← Hotkeys, autostart, auto-backup, behavior, reminder prefs
│       │   ├── collections.rs← Collection CRUD + note assignment
│       │   ├── updater.rs    ← Auto-update check/install
│       │   └── onenote.rs    ← OneNote import
│       ├── database/
│       │   ├── mod.rs        ← Pool initialization (WAL mode, foreign keys)
│       │   ├── schema.rs     ← Migration runner + migration list
│       │   ├── repository.rs ← All SQL CRUD operations
│       │   ├── models.rs     ← Rust entity structs
│       │   └── migrations/   ← Numbered SQL migration files
│       ├── services/
│       │   ├── mod.rs        ← Service module exports
│       │   ├── notes.rs      ← Note lifecycle, autosave
│       │   ├── attachments.rs← Attachment operations
│       │   ├── backup.rs     ← Backup creation, restore, retention
│       │   ├── reminders.rs  ← Background reminder scheduler
│       │   ├── settings.rs   ← Settings persistence
│       │   ├── scheduler.rs  ← Auto-backup cron scheduler
│       │   └── credentials.rs← OS keyring credential storage
│       ├── storage/
│       │   └── blob_store.rs ← Content-addressed SHA-256 blob storage
│       └── platform/         ← Platform-specific adapters
│           ├── mod.rs
│           ├── tray.rs       ← System tray setup
│           └── hotkey.rs     ← Global hotkey registration
│
├── e2e/                      ← WebDriverIO end-to-end tests
│   ├── app.spec.ts           ← Launch & basic UI
│   ├── notes.spec.ts         ← Note CRUD flows
│   ├── collections.spec.ts   ← Collection management
│   ├── reminders.spec.ts     ← Reminder flows
│   ├── settings.spec.ts      ← Settings flows
│   └── windows.spec.ts       ← Window management
│
├── scripts/
│   └── verify.ps1            ← THE single source of truth for "repo is healthy"
│
├── docs/                     ← Extended documentation
│   ├── TESTING.md            ← Testing guide & test policy
│   ├── API.md                ← API documentation
│   ├── RELEASING.md          ← Release process
│   ├── BRANCHING.md          ← Branching strategy & merge rules
│   └── chapters/             ← Tutorial-style build guide
│
├── .github/
│   ├── copilot-instructions.md   ← AI assistant rules
│   ├── pull_request_template.md  ← PR template
│   └── workflows/
│       ├── ci.yml            ← CI pipeline (runs verify.ps1 on PRs and main)
│       └── release.yml       ← Release pipeline (builds + publishes on tags)
│
├── public/                   ← Static assets served by Vite
├── wdio.conf.cjs             ← WebDriverIO E2E configuration
├── vite.config.js            ← Vite build configuration
├── vitest.config.ts          ← Vitest test configuration
├── tsconfig.json             ← TypeScript configuration
├── tailwind.config.js        ← Tailwind CSS configuration
├── eslint.config.js          ← ESLint configuration
└── postcss.config.js         ← PostCSS configuration
```

---

## 4. Entry Points, Public APIs, Commands & Extension Points

### Application Entry Points

| Entry Point | File | Purpose |
|-------------|------|---------|
| Rust main | `src-tauri/src/main.rs` | App bootstrap, plugin registration, command handler registration |
| App setup | `src-tauri/src/app.rs` | Service initialisation, tray/hotkey setup, lifecycle events |
| Frontend main | `src/main.ts` → `pages/index.html` | Main window UI |
| Settings | `src/settings.ts` → `pages/settings.html` | Settings window |
| Sticky note | `src/sticky-note.ts` → `pages/sticky-note.html` | Pop-out note window |
| About | `src/about.ts` → `pages/about.html` | About dialog |

### Tauri Commands (Full List)

Commands are registered in `main.rs` via `tauri::generate_handler![]`.

| Domain | Commands |
|--------|----------|
| **General** | `greet`, `get_app_info`, `restart_app` |
| **Notes** | `create_note`, `get_note`, `list_notes`, `update_note`, `delete_note`, `delete_note_and_close_window`, `search_notes`, `count_deleted_notes`, `prune_deleted_notes` |
| **Windows** | `open_note_window`, `create_new_sticky_note`, `set_last_focused_note_window`, `toggle_last_focused_note_window`, `open_settings_window`, `open_main_window_and_focus_search`, `toggle_main_window`, `toggle_settings_window`, `toggle_all_note_windows`, `quick_capture_from_clipboard` |
| **Attachments** | `create_attachment`, `list_attachments`, `get_attachment_data`, `delete_attachment` |
| **Backup** | `create_backup`, `list_backups`, `restore_backup`, `delete_backup`, `pick_backup_directory`, `get_backup_directory` |
| **Reminders** | `create_reminder`, `list_active_reminders`, `delete_reminder`, `get_reminder_settings`, `update_reminder_settings` |
| **Settings** | `get_hotkey_settings`, `update_hotkey_settings`, `get_autostart_state`, `set_autostart`, `toggle_autostart`, `store_auto_backup_password`, `has_auto_backup_password`, `delete_auto_backup_password`, `get_auto_backup_settings`, `update_auto_backup_settings`, `get_behavior_settings`, `update_behavior_settings` |
| **Collections** | `create_collection`, `get_collection`, `list_collections`, `update_collection`, `delete_collection`, `update_note_collection`, `list_notes_in_collection`, `list_uncategorized_notes`, `count_notes_in_collection` |
| **Update** | `check_for_update`, `download_and_install_update` |
| **Import** | `import_from_onenote` |

### Extension Points

To add a new feature, follow this pattern:

1. **Service** → `src-tauri/src/services/{feature}.rs` (business logic)
2. **Commands** → `src-tauri/src/commands/{feature}.rs` (thin Tauri handlers)
3. **Register** → Export from `commands/mod.rs`, add to `generate_handler![]` in `main.rs`
4. **Frontend API** → `src/utils/{feature}Api.ts` (invoke wrappers)
5. **UI** → Wire into components/state/events as needed

### Inline Image Paste Flow

```
User pastes image (Ctrl+V) in Quill editor
  ↓
noteEditor.ts: pasteHandler detects image/* clipboard item
  ↓
handleImagePaste → handleFileUpload (reads blob, derives MIME-based extension)
  ↓
attachmentsApi.ts: createAttachment(noteId, filename, mimeType, data)
  ↓ Tauri invoke
commands/attachments.rs: create_attachment
  ↓
services/attachments.rs: validates MIME format + file size + sanitises filename
  ↓
blobStore.write(data) → SHA-256 hash (atomic temp+rename)
  ↓
repository.create_attachment(note_id, hash, filename, mime_type, size)
  ↓
Frontend: insertInlineAttachment → Quill attachment-image blot at cursor
  ↓
Autosave: note content_json includes blot reference with blobHash
```

On reload, `AttachmentImageBlot.loadImage` fetches blob data via `get_attachment_data` and renders `<img>`.

---

## 5. Build, Test, CI & Release Locations

### Build

| What | Command | Config File |
|------|---------|-------------|
| Frontend dev server | `npm run dev` / `npm run tauri dev` | `vite.config.js` |
| Frontend production build | `npm run build` (Vite) | `vite.config.js` |
| Rust debug build | `cargo build --manifest-path src-tauri/Cargo.toml` | `src-tauri/Cargo.toml` |
| Rust release build | `cargo build --release --manifest-path src-tauri/Cargo.toml` | `src-tauri/Cargo.toml` |
| Full Tauri build | `npm run tauri build` | `src-tauri/tauri.conf.json` |
| Full verification | `pwsh -File scripts/verify.ps1` | `scripts/verify.ps1` |

### Test

| What | Command | Location |
|------|---------|----------|
| Frontend unit tests | `npx vitest run` | `src/**/*.test.ts` (colocated) |
| Rust integration tests | `cargo test --manifest-path src-tauri/Cargo.toml --test integration_test` | `src-tauri/tests/integration_test.rs` |
| E2E tests | `npm run test:e2e` (requires built app) | `e2e/*.spec.ts` |
| E2E inline images | `npm run test:e2e` (requires built app) | `e2e/inline-images.spec.ts` |
| Type check | `npx tsc --noEmit` | `tsconfig.json` |
| Lint (TS) | `npx eslint src/` | `eslint.config.js` |
| Lint (Rust) | `cargo clippy ... -D warnings` | Clippy defaults |
| Format (TS) | `npx prettier --check src/**/*.{ts,tsx,js,json,css}` | `.prettierrc` (defaults) |
| Format (Rust) | `cargo fmt -- --check` | `rustfmt.toml` (defaults) |

> **Note**: `cargo test --lib` is **excluded** because it links against Tauri/WebView2 DLL, which requires the full runtime. Integration tests cover core logic.

### CI/CD

| Pipeline | Trigger | File | Runs |
|----------|---------|------|------|
| **CI** | push/PR to `main` | `.github/workflows/ci.yml` | `scripts/verify.ps1` (all 9 steps) |
| **Release** | push tag `v*` / manual dispatch | `.github/workflows/release.yml` | Tauri build + GitHub Release |

### Verify Pipeline (9 Steps)

`scripts/verify.ps1` is the **single source of truth** for repository health:

1. Prettier format check
2. ESLint lint
3. TypeScript type check
4. Vitest unit tests
5. Vite production build (must precede Rust — `tauri::generate_context!` needs `dist/`)
6. Cargo fmt check
7. Cargo clippy (deny warnings)
8. Cargo integration tests
9. Cargo release build

**A failing CI MUST block merge.**

---

## 6. Configuration Ownership & Schemas

| Config File | Owner | Purpose | Validated At |
|-------------|-------|---------|--------------|
| `src-tauri/tauri.conf.json` | Tauri framework | App metadata, windows, plugins, capabilities | Build time |
| `src-tauri/Cargo.toml` | Cargo | Rust dependencies, build metadata | Build time |
| `src-tauri/src/config.rs` | Backend | Application constants (window sizes, validation limits) | Compile time |
| `package.json` | npm | Frontend deps, scripts | `npm ci` |
| `vite.config.js` | Vite | Build config, multi-page setup | Build time |
| `vitest.config.ts` | Vitest | Test config, happy-dom environment | Test time |
| `tsconfig.json` | TypeScript | Compiler options, path resolution | Type-check time |
| `tailwind.config.js` | Tailwind | CSS utility config, DaisyUI themes | Build time |
| `eslint.config.js` | ESLint | Lint rules | Lint time |
| `wdio.conf.cjs` | WebDriverIO | E2E test config | E2E test time |

### Runtime Configuration

- **Settings file** (`settings.json`): hotkeys, auto-backup prefs, reminder prefs, behavior settings (minimize/close to tray, auto-save delay) — validated by command layer against `config.rs` limits before persistence.
- **Windows Registry** (`HKCU\Software\Microsoft\Windows\CurrentVersion\Run`): autostart enabled/disabled — read directly from registry for accurate state.
- **Credentials**: OS keyring via `keyring` crate — auto-backup password stored securely.
- **Theme**: Stored in browser `localStorage` (per-window, frontend-only).
- **Data directory**: `%APPDATA%\com.swatnotes.app\` on Windows — resolved at app startup by Tauri.

---

## 7. Critical Invariants — "Do Not Break" Rules

1. **No `unwrap()` or `expect()` in production Rust code.** Use `?` with proper error types.
2. **Frontend NEVER touches filesystem or database directly.** All access via Tauri commands.
3. **`scripts/verify.ps1` is the single source of truth for repo health.** All 9 steps must pass. Never weaken checks to make things pass.
4. **WAL mode + foreign keys are always enabled** on every SQLite connection (`database/mod.rs` sets via `SqliteConnectOptions`).
5. **Backups are always encrypted** (AES-256-GCM) with checksums verified on restore.
6. **Content-addressed blob storage uses SHA-256.** Changing the hash algorithm breaks all existing blobs.
7. **Migrations are append-only.** Never modify an existing migration file; always add a new numbered migration.
8. **Windows created with `visible(false)`** — shown by TypeScript after theme application to prevent white flash.
9. **E2E tests live in `e2e/`, not `src/`.** They use WebDriverIO, not Vitest.
10. **`cargo test --lib` is forbidden.** It crashes with STATUS_ENTRYPOINT_NOT_FOUND due to WebView2 DLL dependency.
11. **Conventional Commits format** is required for all commit messages (`feat:`, `fix:`, `ci:`, etc.).

---

## 8. Database Schema (Current: Migration v5)

| Table | Key Columns | Purpose |
|-------|-------------|---------|
| `migrations` | `version`, `applied_at` | Schema version tracking |
| `notes` | `id`, `title`, `content_json`, `created_at`, `updated_at`, `deleted_at`, `collection_id` | Note storage (soft-delete via `deleted_at`) |
| `attachments` | `id`, `note_id`, `blob_hash`, `filename`, `mime_type`, `size` | File/image attachments linked to notes |
| `reminders` | `id`, `note_id`, `trigger_time`, `triggered` | Time-based reminders |
| `backups` | `id`, `timestamp`, `path`, `size`, `manifest_hash` | Backup metadata |
| `settings` | `key`, `value` | Application settings (key-value) |
| `collections` | `id`, `name`, `color`, `description` | Note collections/folders |
| `notes_fts` | (FTS5 virtual table) | Full-text search index |

---

## 9. Tauri Plugins

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

---

*This document is maintained under Part B of the DevWorkflow AI Operating Contract.
Any structural, API, boundary, build, or config change MUST update this Atlas in the same increment.*
