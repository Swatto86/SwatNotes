# Book Writing Progress

**Book Title**: *Building Desktop Apps with Rust, Tauri & DaisyUI: A Complete Beginner's Guide from Zero to Production*

**Premise**: Take a complete beginner from zero knowledge to building a full production-ready desktop notes application using Rust + Tauri v2 + DaisyUI, grounded entirely in the actual SwatNotes codebase.

**Teaching Philosophy**:
- Explain from first principles with real-life analogies
- Every code reference must be verifiable in the repo
- Mental models + Mermaid diagrams + data journey for every concept
- Build practical understanding through real production code

---

## Current Status

**Last Updated**: January 29, 2026

**Book Status**: 20/25 chapters complete (80% complete)

### Chapters Completed

#### ✅ Part 0: The Map (`chapters/00-the-map.md`)
- System architecture with comprehensive Mermaid diagrams
- End-to-end data flow (creating a note)
- Technology stack explanation with comparisons
- Directory structure and storage layout
- Communication patterns (commands + events)
- Error flow and concurrency model
- Security boundaries
- Build and runtime flow
- **Status**: Complete, ready for reader use

#### ✅ Chapter 1: First Principles (`chapters/01-first-principles.md`)
- Rust fundamentals using real-life analogies:
  - Ownership = single key to a room
  - Borrowing = visitor passes (immutable/mutable)
  - Lifetimes = rental agreements
  - Option/Result = honest error handling
  - Async = ordering food with a buzzer
  - Borrow checker = strict teacher
- Comparison with JavaScript, Python, C++
- Practical examples from SwatNotes codebase
- Common beginner mistakes with fixes
- **Status**: Complete, ready for reader use

#### ✅ Chapter 2: Setting Up Your Environment (`chapters/02-setting-up-your-environment.md`)
- Complete installation guide for Rust, Node.js, and Windows dependencies
- Step-by-step instructions for Windows
- VS Code configuration with rust-analyzer
- Creating and running first Tauri project
- Build artifacts explanation and workflow overview
- Troubleshooting common setup issues
- Performance optimization tips
- Environment verification checklist
- **Status**: Complete, ready for reader use

#### ✅ Chapter 3: Hello Tauri (`chapters/03-hello-tauri.md`)
- Writing first Tauri command with #[tauri::command]
- Calling Rust from JavaScript with invoke()
- Understanding the IPC bridge and serialization
- Parameter mapping between JavaScript and Rust types
- Result pattern for error handling
- Accessing shared AppState in commands
- Command registration in main.rs
- Real-world examples from SwatNotes (greet, get_app_info, create_note)
- Frontend best practices: API wrappers, type definitions
- Debugging techniques for both Rust and JavaScript
- Common mistakes and fixes
- Complete data flow visualization with sequence diagram
- **Status**: Complete, ready for reader use

#### ✅ Chapter 4: Understanding the Stack (`chapters/04-understanding-the-stack.md`)
- SQLite fundamentals: embedded database, zero configuration, ACID transactions
- WAL mode for concurrent reads, FTS5 for full-text search
- SQLx compile-time query checking with real examples
- Avoiding N+1 queries with QueryBuilder batch operations
- Tauri v2 plugins: dialog, notifications, global shortcuts, tray icon
- Managed state pattern for sharing resources across commands
- DaisyUI component library: buttons, cards, modals with 32 themes
- Theming system with CSS variables and instant theme switching
- Vite frontend build: multi-page setup, HMR, tree shaking
- Cargo backend build: incremental compilation, feature flags
- Build coordination: dev mode (port 5173) vs production bundling
- Full stack data flow: user click → TypeScript → IPC → Rust → SQLite → back
- Complete sequence diagram showing all layers working together
- **Status**: Complete, ready for reader use

#### ✅ Chapter 5: Project Architecture (`chapters/05-project-architecture.md`)
- Rust module system: organizing code into logical units
- Module visibility: pub vs private, nested modules with mod.rs
- AppState pattern: central state holding services and resources
- AppState initialization and dependency injection
- Service layer: business logic between commands and repository
- NotesService example: coordinating DB + FTS + logging
- Configuration: static constants (config.rs) vs dynamic settings (SettingsService)
- Logging with tracing: levels (ERROR/WARN/INFO/DEBUG), filtering, structured output
- Complete startup sequence: tracing → plugins → setup → AppState → schedulers
- Architecture patterns: Repository, dependency injection, Arc for shared state
- Error propagation with ? operator
- Real code examples from app.rs, lib.rs, services/notes.rs, main.rs
- **Status**: Complete, ready for reader use

#### ✅ Chapter 6: Database Foundations (`chapters/06-database-foundations.md`)
- Schema design: tables, columns, types, constraints with real examples
- UUID primary keys vs auto-increment integers
- Soft delete pattern with deleted_at timestamp
- Foreign keys with CASCADE and SET NULL behaviors
- Indexes: when to use, performance impact, real query examples
- Migrations: versioned schema evolution, transactional safety
- Migration examples: 001_initial_schema, 002_add_title_modified, 003_add_fts, 004_add_collections
- Repository pattern: abstracting SQL from business logic
- Request/Response DTOs for type safety
- Dynamic query building with SQLx QueryBuilder
- Transactions for atomicity: all-or-nothing operations
- ACID properties in practice (Atomicity, Consistency, Isolation, Durability)
- Complete data flow: Command → Service → Repository → SQLx → SQLite
- Real code from schema.rs, repository.rs, models.rs, migration SQL files
- **Status**: Complete, ready for reader use

#### ✅ Chapter 7: Creating Notes (`chapters/07-creating-notes.md`)
- Note data model in Rust and TypeScript: struct fields, type alignment
- UUID generation for client-side IDs
- Quill Delta format for rich text: ops array, insert/attributes structure
- Extracting plain text from Delta for indexing
- Complete data flow: Frontend invoke() → Command handler → Service orchestration → Repository SQL
- Service layer responsibilities: logging, DTO creation, FTS synchronization, error handling
- Repository create_note: UUID generation, timestamp, RETURNING clause
- FTS synchronization: insert_note_fts, graceful degradation on failures
- Clipboard capture feature: global shortcuts, AppHandle, Delta conversion
- Error handling with Result<T>: ? operator, error propagation, automatic serialization
- Sequence diagram showing all layers and graceful FTS error handling
- Manual test walkthrough with real data examples
- Architecture rationale: separation of concerns, testability, security
- Real code from models.rs, notesApi.ts, commands/notes.rs, services/notes.rs, repository.rs
- **Status**: Complete, ready for reader use

#### ✅ Chapter 8: Rich Text Editing (`chapters/08-rich-text-editing.md`)
- Quill.js fundamentals: Delta format deep dive, ops array structure, advantages over HTML
- Editor setup: theme configuration, toolbar modules, placeholder, loading content
- Autosave with debouncing: 500ms delay pattern, state management, prevent concurrent saves
- Save status UI: "Saving...", "Saved at...", "Save failed" feedback
- Automatic title generation: extracting first line, 50-character truncation, title_modified flag
- Manual title modification detection: comparing auto-generated vs user input
- Custom Quill blots: AttachmentImageBlot and AttachmentFileBlot for blob hash references
- Blot lifecycle: create(), loadImage(), value() methods, async image loading with placeholders
- Clipboard paste handling: detecting images in paste events, preventing base64 insertion
- Drag-and-drop file uploads: dragover/dragleave/drop events, visual feedback
- File upload flow: readFileAsBytes, createAttachment backend call, insertInlineAttachment
- Editor lifecycle: creation, reactive usage, cleanup with destroy() to prevent memory leaks
- Complete sequence diagram: typing → debounced save → paste image → blob storage → FTS sync
- Common mistakes: base64 bloat, no debouncing, listener leaks, corrupt Delta handling
- Real code from noteEditor.ts, quillAttachmentBlots.ts, types.ts
- **Status**: Complete, ready for reader use

#### ✅ Chapter 9: Listing and Searching Notes (`chapters/09-listing-and-searching.md`)
- List notes query: SELECT with soft delete filtering, ORDER BY updated_at DESC
- SQLx query_as for type-safe struct mapping
- Service layer delegation pattern: thin handlers, composition over complexity
- Frontend filter support: all, uncategorized, collection-specific
- Note card rendering: title truncation, content preview, selection highlighting, relative dates
- FTS5 full-text search fundamentals: inverted index mental model, virtual tables
- BM25 ranking algorithm: term frequency, inverse document frequency, document length normalization
- Prefix wildcard search: query* for autocomplete-style matching
- Special character escaping: preventing FTS5 syntax errors with replace('"', "\"\"")
- Two-phase search strategy: FTS5 for title/content + LIKE for attachment filenames
- Deduplication with HashSet: O(1) lookups to prevent duplicate results
- Batch fetching with get_notes_by_ids: avoiding N+1 queries for attachment matches
- Graceful degradation: attachment search failure doesn't break FTS results
- Empty query optimization: skip FTS overhead for "show all" behavior
- Complete sequence diagrams for list flow and two-phase search flow
- Real-world search example traced through all layers with deduplication
- Performance optimizations: prefix scans, batch queries, HashSet filtering
- Testing strategy: unit tests for FTS, deduplication, E2E tests for search UI
- Troubleshooting: FTS syntax errors, missing results, slow performance with EXPLAIN QUERY PLAN
- Real code from repository.rs, services/notes.rs, commands/notes.rs, notesApi.ts, notesList.ts, main.ts, index.html
- **Status**: Complete, ready for reader use

#### ✅ Chapter 10: Updating and Deleting (`chapters/10-updating-and-deleting.md`)
- Partial updates with optional parameters: Option<T> in Rust, null in TypeScript
- Dynamic SQL with SQLx QueryBuilder: building UPDATE queries conditionally
- Soft delete pattern: deleted_at timestamp instead of hard delete for recoverability
- Cascade operations: deleting associated reminders when note is soft-deleted
- Trash management: count_deleted_notes and prune_deleted_notes for cleanup
- FTS synchronization: conditional updates (only if title/content changed), delete-then-insert pattern
- Frontend delete flow: closeNote() → deleteNote() → close windows → refresh UI
- Error handling: NoteNotFound when rows_affected == 0, already deleted cases
- Hard delete vs soft delete: permanent removal for testing only, user-facing uses soft delete
- Complete sequence diagrams: update flow and delete flow with all layers
- Optimistic vs pessimistic UI: when to use each pattern, SwatNotes uses pessimistic
- Real code from commands/notes.rs, services/notes.rs, repository.rs, main.ts, notesApi.ts, models.rs
- **Status**: Complete, ready for reader use

#### ✅ Documentation Structure
- `/docs/README.md` - Book landing page with setup instructions
- `/docs/SUMMARY.md` - Complete table of contents (25 chapters planned)
- `/docs/PROGRESS.md` - This file

#### ✅ Chapter 11: State Management (`chapters/11-state-management.md`)
- AppState struct: central hub holding services, database, blob store, scheduler
- #[derive(Clone)] for cheap cloning: all fields Arc-wrapped or inexpensive
- Arc<T> pattern: shared ownership with atomic reference counting
- Mutex<T> pattern: mutual exclusion for thread-safe mutable state
- Arc<Mutex<T>> combo: shared ownership + exclusive access for concurrent mutation
- State injection in commands: State<'_, AppState> parameter for automatic dependency injection
- Service layer pattern: business logic encapsulation, FTS coordination, logging, graceful degradation
- AppState initialization: sequential setup (Database → BlobStore → Services), error handling
- Frontend appState singleton: single source of truth for UI state
- Getter/setter pattern: encapsulated access with automatic notifications
- Pub-sub pattern: subscribe(), notify(), unsubscribe() for reactive updates
- Wildcard subscriptions: subscribe('*') to observe all state changes
- Atomic compound operations: openNote(), closeNote() for multi-field consistency
- Backend-frontend synchronization: pessimistic updates, backend as source of truth
- Mutex best practices: minimize lock scope, clone data out, avoid nested locks
- Memory leak prevention: unsubscribe functions for cleanup
- State debugging: global exposure, change logging, state snapshots
- Complete sequence diagrams: initialization flow, update cycle
- Common pitfalls: holding locks too long, forgetting unsubscribe, stale closures, race conditions
- Real code from app.rs, appState.ts, commands/notes.rs, services/notes.rs, commands/windows.rs
- **Status**: Complete, ready for reader use

#### ✅ Chapter 12: Frontend Architecture (`chapters/12-frontend-architecture.md`)
- Vanilla TypeScript rationale: no framework overhead, smaller bundles, faster startup, simpler for small apps
- ES Modules: import/export syntax, named exports, avoiding circular dependencies
- TypeScript configuration: target ES2020, module ESNext, bundler resolution, path mapping
- Multi-page application: 4 HTML entry points (main, sticky-note, settings, update-required)
- Vite build configuration: rollupOptions with multiple inputs, tree shaking, code splitting
- Component pattern: functions returning cleanup handlers (NoteEditorInstance with destroy())
- Event handling: DOM events (addEventListener), Tauri events (listen/emit), state subscriptions
- DOM manipulation: template strings with escapeHtml() for XSS prevention
- API wrappers: centralized invoke() calls with TypeScript types (notesApi, attachmentsApi, etc.)
- Utility modules: formatters (escapeHtml, formatDate, extractTextPreview), logger (structured logging)
- Custom modal system: replacing alert/confirm/prompt with DaisyUI modals
- Debouncing pattern: preventing excessive function calls (search input, autosave)
- Vite development: HMR for instant updates, source maps for debugging
- Vite production build: TypeScript → transpile → bundle → minify → tree shake
- Performance patterns: minimize reflows, debounce expensive ops, use innerHTML for bulk DOM insertion
- Testing: Vitest for unit tests, E2E tests with WebdriverIO
- Common mistakes: forgetting to remove listeners (memory leaks), not escaping input (XSS), blocking UI thread
- Real code from main.ts, components/noteEditor.ts, components/notesList.ts, events/handlers.ts, utils/formatters.ts, utils/logger.ts, utils/modal.ts, vite.config.js, tsconfig.json
- **Status**: Complete, ready for reader use

#### ✅ Chapter 13: File Attachments (`chapters/13-file-attachments.md`)
- Content-addressed storage fundamentals: files identified by SHA-256 hash, not filename
- Automatic deduplication: same content = same hash = stored once
- SHA-256 hashing with sha2 crate: collision resistance, cryptographic integrity
- Blob store architecture: two-level directory sharding (blobs/ab/cd/hash) prevents filesystem slowdown
- Atomic write pattern: write to .tmp file, then rename for crash safety
- Complete upload flow: Frontend FileReader → Backend hash calculation → BlobStore write → Database record
- Database schema: attachments table with blob_hash reference (metadata only, not binary data)
- Service layer: 100 MB size validation, filename sanitization, BlobStore + Repository coordination
- Filename sanitization: preventing path traversal attacks by filtering dangerous characters
- Custom Quill blots: AttachmentImageBlot and AttachmentFileBlot storing hash references
- Async image loading: placeholder → fetch from backend → replace with <img>
- Object URLs vs Data URLs: blob:http://... (50 bytes) vs data:image/png;base64,... (MB)
- Drag-and-drop implementation: dragover/dragleave/drop event handlers with visual feedback
- Clipboard paste handling: detecting images in clipboard, preventing default base64 insertion
- File picker upload: traditional button flow with readFileAsBytes()
- Deduplication in action: uploading same file twice stores blob once, creates two DB records
- Security: size limits (100 MB), MIME type validation, path traversal prevention
- Performance: lazy loading images, parallel uploads, object URL cleanup
- Garbage collection: not implemented (blobs remain even if unreferenced, future work)
- Complete sequence diagrams: upload flow, blob storage structure
- Common mistakes: base64 bloat in Delta, not preventing default paste, unsanitized filenames, memory leaks from object URLs
- Real code from blob_store.rs, commands/attachments.rs, services/attachments.rs, attachmentsApi.ts, quillAttachmentBlots.ts, noteEditor.ts, models.rs, repository.rs
- **Status**: Complete, ready for reader use

#### ✅ Chapter 14: Encryption Fundamentals (`chapters/14-encryption-fundamentals.md`)
- AES-256-GCM authenticated encryption: confidentiality, integrity, authenticity in single operation
- Symmetric cipher: same key encrypts and decrypts, 256-bit key = 32 bytes
- GCM mode: Galois/Counter Mode with authentication tag preventing tampering
- Nonce (96-bit): number used once, ensures same plaintext produces different ciphertext each encryption
- Argon2id key derivation: password → 256-bit key using memory-hard hashing
- Winner of Password Hashing Competition 2015, hybrid of Argon2i and Argon2d
- Memory-hard algorithm: prevents GPU/ASIC brute-force attacks by requiring RAM
- Salt (128-bit): random value preventing rainbow table attacks, stored with ciphertext
- EncryptedData struct: {salt, nonce, ciphertext} container for all decryption inputs
- Encryption flow: generate salt → derive key → generate nonce → AES-256-GCM encrypt
- Decryption flow: read salt/nonce → derive key → AES-256-GCM decrypt + verify auth tag
- Authentication tag (16-byte): cryptographic checksum, decryption fails if ciphertext modified
- Backup encryption: ZIP file → encrypt with password → serialize to JSON → write .enc file
- Backup decryption: read .enc → deserialize → decrypt → extract ZIP → verify checksums
- Security properties: confidentiality (unreadable without key), integrity (tampering detected), authenticity (proves creator)
- Random number generation: OsRng for cryptographically secure salt/nonce (never hardcode)
- Performance: Argon2id ~100ms (intentionally slow), AES-256-GCM ~200 MB/s with hardware acceleration
- Testing: encrypt/decrypt roundtrip, wrong password fails, corrupted data fails, different salts/nonces
- Common mistakes: password as key directly, reusing nonce, not verifying auth tag, logging passwords
- Threat scenarios: cloud storage, stolen USB, tampered backup, weak password, all mitigated
- Real code from crypto.rs, services/backup.rs, backupApi.ts, Cargo.toml dependencies
- **Status**: Complete, ready for reader use

#### ✅ Chapter 15: Backup System (`chapters/15-backup-system.md`)
- Backup manifest structure: JSON file listing all files with SHA-256 checksums, version, timestamp
- Manifest enables integrity verification during restore, compatibility checks
- ZIP archive creation: package database + blobs + manifest with Deflate compression
- Preserves blob directory structure (blobs/ab/cd/hash) within ZIP
- Checksum calculation: SHA-256 for each file before compression
- Complete backup flow: validate notes exist → build manifest → create ZIP → encrypt → record metadata
- Encryption integration: ZIP encrypted with AES-256-GCM, password from user, saved as .enc file
- Database metadata: backups table stores path, size, timestamp, manifest_hash
- Retention policy: automatically delete old backups beyond configured limit (default 10)
- Retention implementation: sort by timestamp, keep newest N, batch delete rest atomically
- Orphaned record cleanup: detect DB records without files, auto-delete on list_backups()
- Restore flow: decrypt → extract ZIP → verify checksums → atomic swap → cleanup
- Checksum verification: every file SHA-256 compared to manifest, fail if mismatch
- Atomic restore pattern: rename db.sqlite → db.sqlite_backup, restored/db.sqlite → db.sqlite
- Database connection handling: close pool before restore (Windows file locking), wait 100ms
- Old backup cleanup: keep renamed files for 60 seconds as safety net, then delete
- Path traversal prevention: canonicalize paths, verify within backup directory
- Security validation: reject paths with ../ or outside allowed directory
- Frontend UI: create backup with password validation, list backups sorted by timestamp
- Backup list display: timestamp, file size, restore/delete buttons
- Restore confirmation: warn user, prompt for password, restart app on success
- Empty backup prevention: require at least one note before creating backup
- Testing: create/restore roundtrip, retention policy, wrong password, corrupted backup, empty DB
- Common mistakes: not validating checksums, forgetting to close DB, no retention policy
- Real code from services/backup.rs, commands/backup.rs, repository.rs, ui/backup.ts, backupApi.ts
- **Status**: Complete, ready for reader use

#### ✅ Chapter 16: Reminders and Scheduling (`chapters/16-reminders-and-scheduling.md`)
- Reminder data model: note_id + trigger_time (UTC) + triggered flag + created_at
- Polling loop strategy: check every 5 seconds for due reminders (5-second accuracy, low overhead)
- Background scheduler: tokio::spawn with tokio::time::interval for periodic checks
- Checking for due reminders: query active reminders, compare trigger_time <= now (UTC)
- Mark-before-notify pattern: UPDATE triggered = 1 before sending notification (prevents duplicates)
- Visual notification strategy: open/focus note window instead of system notifications
- Window management: unminimize, show, center on screen, set always-on-top without stealing focus
- Window creation: new windows start invisible/unfocused to prevent jarring focus theft
- AppHandle injection: Arc<Mutex<Option<AppHandle>>> for thread-safe access from background loop
- Database operations: create_reminder (UTC timestamp), list_active_reminders (WHERE triggered = 0)
- Cascade deletion: ON DELETE CASCADE removes reminders when note is deleted
- Frontend integration: datetime picker with local-to-UTC conversion via toISOString()
- Timezone handling: store UTC, display local time with toLocaleString()
- Reminder triggered event: backend emits event, frontend plays sound + shows modal alert
- Multi-layered notification: window appears + sound plays + in-app modal (redundancy prevents missing)
- Service lifecycle: initialize on startup, inject AppHandle, start polling loop
- Automatic backup scheduling: tokio-cron-scheduler with cron expressions (daily/weekly)
- Cron vs polling: cron for fixed schedules, polling for variable times
- Performance: index on triggered column makes queries instant (<1ms for 10k reminders)
- Testing: create past reminder, verify triggering, check database state
- Common mistakes: forgetting timezone conversion, not marking triggered, blocking polling loop
- Real code from services/reminders.rs, commands/reminders.rs, repository.rs, remindersApi.ts, noteEditor.ts, events/handlers.ts
- **Status**: Complete, ready for reader use

#### ✅ Chapter 17: System Integration (`chapters/17-system-integration.md`)
- Global hotkeys: system-wide keyboard shortcuts using tauri-plugin-global-shortcut
- Hotkey registration: on_shortcut() with ShortcutState::Pressed event filtering
- Default hotkeys: Ctrl+Shift+N (new note), Ctrl+Shift+F (toggle main), Ctrl+Shift+H (toggle note)
- Conflict prevention: unregister existing hotkeys before registration, user-configurable shortcuts
- System tray integration: TrayIconBuilder with icon, menu, click handlers
- Tray menu structure: menu items with hotkey hints, separator, quit option
- Tray event handling: left-click toggles main window, right-click shows menu
- Hide-to-tray behavior: CloseRequested event intercepted, main window hides instead of closing
- Window management: toggle pattern (if visible → hide, if hidden → show), multi-window coordination
- Last focused tracking: Arc<Mutex<Option<String>>> stores last focused note window label
- Toggle all notes: grid layout calculation based on screen dimensions (cols = screen_width / window_width)
- Autostart on Windows: registry manipulation with reg.exe (HKCU\Software\Microsoft\Windows\CurrentVersion\Run)
- Registry commands: reg add/delete for enabling/disabling autostart
- Platform-specific code: #[cfg(target_os = "windows")] for Windows-only features
- Settings UI: hotkey configuration with restart requirement, autostart checkbox with optimistic UI
- Performance: <0.1% CPU at idle (event-driven), 50-100ms warm start (unhiding window)
- Event-driven architecture: global hotkeys trigger async tasks without blocking
- Window show behavior: emit refresh-notes + focus-search events when showing main window
- Grid positioning: calculate row/col from index (row = i / cols, col = i % cols)
- Common issues: hotkey conflicts, tray icon in hidden icons overflow, autostart registry errors
- Testing checklist: global hotkeys from any app, tray menu functionality, autostart on boot
- Real code from app.rs, commands/windows.rs, commands/settings.rs, services/settings.rs, settings.ts
- **Status**: Complete, ready for reader use

#### ✅ Chapter 18: Collections and Organization (`chapters/18-collections-and-organization.md`)
- Collection data model: id, name, description, color (hex), icon, sort_order, timestamps
- Nullable foreign key: notes.collection_id REFERENCES collections(id) ON DELETE SET NULL
- Cascade behavior: deleting collection sets notes to uncategorized (collection_id = NULL)
- CRUD operations: create_collection, list_collections, update_collection, delete_collection
- sort_order field: auto-incrementing on creation (MAX(sort_order) + 1), enables manual reordering
- Default values: color = '#6B7280' (gray), icon = 'folder'
- Dynamic SQL updates: QueryBuilder for partial updates (only specified fields change)
- Moving notes: update_note_collection(note_id, collection_id?) sets or removes collection
- Filtering queries: list_notes_in_collection, list_uncategorized_notes (WHERE collection_id IS NULL)
- Counting optimization: fetch all notes once, count in JavaScript to avoid N+1 queries
- Sidebar UI: color-coded badges (visual scanning), note counts, hover-to-delete buttons
- Predefined color palette: 18 colors from TailwindCSS, random assignment on creation
- Active state highlighting: currentFilter tracked, bg-base-300 applied to selected collection
- XSS prevention: escapeHtml() function escapes all collection names in dynamic HTML
- Index performance: idx_notes_collection_id makes filtering instant (<1ms for 10k notes)
- Edge cases: delete collection with notes (cascade), invalid collection_id (graceful), empty name (frontend validation)
- Frontend counting: allNotes.filter(n => n.collection_id === id).length instead of separate backend calls
- Color as visual grep: human vision processes color faster than text for quick scanning
- Future enhancements: nested collections (parent_id), drag-drop reordering, color picker UI, icon/emoji support
- Real code from commands/collections.rs, repository.rs, models.rs, collectionsApi.ts, main.ts, migration 004
- **Status**: Complete, ready for reader use

#### ✅ Chapter 19: Auto-Update System (`chapters/19-auto-update-system.md`)
- GitHub Releases API: free update server for public repositories, no hosting costs
- Semantic versioning (semver): x.y.z format (major.minor.patch) for predictable comparisons
- Version comparison algorithm: is_newer_version() compares each part sequentially
- GitHub Release structure: tag_name, body (release notes), assets (installers), html_url
- Fetching latest release: reqwest HTTP client with User-Agent header (required by GitHub)
- UpdateInfo struct: available, version, body, current_version, release_url, installer_url
- Automatic startup check: tokio::spawn background task, doesn't block app initialization
- Update-required window: modal blocking access until user updates or quits
- Release notes flow: PowerShell script → Git annotated tag → GitHub Release → API → UI
- Download process: reqwest with redirects + 5-minute timeout, save to temp directory
- Installer launching: Windows cmd /C start command, opens with default handler
- Frontend download UX: loading spinner, success message, error handling with retry
- Graceful degradation: all network/API failures return None, app continues normally
- Security: HTTPS only, no auto-execution without user consent, UAC prompt for installation
- Error handling: comprehensive logging with tracing, fallback to opening release page in browser
- Cross-platform consideration: Windows-specific cmd.exe launcher, would need xdg-open/open for Linux/macOS
- Performance: ~500ms API check (background), 5-60s download (depends on file size and connection)
- Testing strategies: manual checklist (simulate old version, test download, test offline), version comparison unit tests
- Future enhancements: delta updates (binary diffs), automatic background installation, rollback mechanism, update channels
- Real code from commands/updater.rs, update-required.ts, updateApi.ts, scripts/update-application.ps1, app.rs
- **Status**: Complete, ready for reader use

### Chapters In Progress

**None** - Ready to start Chapter 20 or any requested chapter.

---

## Planned Chapter List

| Chapter | Title | Status | Key Topics |
|---------|-------|--------|-----------|
| **Part 0** | **The Map** | ✅ Complete | Architecture, data flow, tech stack |
| **Ch 1** | **First Principles** | ✅ Complete | Ownership, borrowing, types, async |
| **Ch 2** | **Setting Up Your Environment** | ✅ Complete | Rust/Node install, dependencies, first project |
| **Ch 3** | **Hello Tauri** | ✅ Complete | First command, frontend-backend bridge |
| **Ch 4** | **Understanding the Stack** | ✅ Complete | SQLite, SQLx, Tauri v2, DaisyUI, Vite/Cargo |
| **Ch 5** | **Project Architecture** | ✅ Complete | Modules, AppState, config, logging |
| **Ch 6** | **Database Foundations** | ✅ Complete | Schema, migrations, Repository pattern |
| **Ch 7** | **Creating Notes** | ✅ Complete | Data flow, Quill Delta, FTS sync, errors |
| **Ch 8** | **Rich Text Editing** | ✅ Complete | Quill.js, autosave, custom blots, paste/drop |
| **Ch 9** | **Listing and Searching** | ✅ Complete | Queries, FTS5, BM25, two-phase search |
| **Ch 10** | **Updating and Deleting** | ✅ Complete | Update ops, soft delete, optimistic UI |
| **Ch 11** | **State Management** | ✅ Complete | AppState deep dive, Arc/Mutex, pub-sub |
| **Ch 12** | **Frontend Architecture** | ✅ Complete | Vanilla TypeScript, modules, events, Vite |
| **Ch 13** | **File Attachments** | ✅ Complete | Content-addressed storage, SHA-256, blob store |
| **Ch 14** | **Encryption Fundamentals** | ✅ Complete | AES-256-GCM, Argon2id, key derivation |
| **Ch 15** | **Backup System** | ✅ Complete | ZIP manifests, retention, atomic restore |
| **Ch 16** | **Reminders and Scheduling** | ✅ Complete | Polling loop, UTC timestamps, window notifications |
| **Ch 17** | **System Integration** | ✅ Complete | Global hotkeys, system tray, hide-to-tray, autostart |
| **Ch 18** | **Collections and Organization** | ✅ Complete | Hierarchical data, color-coded folders, filtering |
| **Ch 19** | **Auto-Update System** | ✅ Complete | GitHub Releases, semver, downloads, installation |
| Ch 20 | Error Handling Patterns | 📝 Planned | Custom errors, propagation, user-facing messages |
| Ch 21 | Testing Strategies | 📝 Planned | Unit, integration, E2E tests |
| Ch 22 | Testing Strategies | 📝 Planned | Unit, integration, E2E tests |
| Ch 23 | Building and Distribution | 📝 Planned | Installers, code signing, CI/CD |
| Ch 24 | Performance Optimization | 📝 Planned | Profiling, query optimization |
| Ch 25 | Production Readiness | 📝 Planned | Logging, monitoring, maintenance |

---

## Repository Facts Discovered

### Tauri Commands (Complete List)

Located in `src-tauri/src/commands/` with the following modules:

#### General Commands (`mod.rs`)
- `greet(name: String)` - Test command
- `get_app_info()` - Returns version and app_data_dir
- `restart_app()` - Restart application

#### Notes Commands (`notes.rs`)
- `create_note(title, content_json)` - Create new note
- `get_note(id)` - Get note by ID
- `list_notes()` - List all non-deleted notes
- `update_note(id, title?, content_json?, title_modified?)` - Update note
- `delete_note(id)` - Soft delete note
- `search_notes(query)` - Full-text search
- `count_deleted_notes()` - Count in trash
- `prune_deleted_notes()` - Permanently delete all trash
- `quick_capture_from_clipboard()` - Create note from clipboard

#### Attachments Commands (`attachments.rs`)
- `create_attachment(note_id, filename, mime_type, data)` - Create attachment
- `list_attachments(note_id)` - List attachments for note
- `get_attachment_data(id)` - Get attachment file data
- `delete_attachment(id)` - Delete attachment

#### Backup Commands (`backup.rs`)
- `create_backup(password?)` - Create encrypted backup
- `list_backups()` - List all backups
- `restore_backup(path, password?)` - Restore from backup
- `delete_backup(id)` - Delete backup
- `pick_backup_directory()` - File dialog for backup location
- `get_backup_directory()` - Get current backup directory

#### Reminders Commands (`reminders.rs`)
- `create_reminder(note_id, trigger_time)` - Create reminder
- `list_active_reminders()` - List未triggered reminders
- `delete_reminder(id)` - Delete reminder
- `get_reminder_settings()` - Get notification settings
- `update_reminder_settings(settings)` - Update notification settings

#### Collections Commands (`collections.rs`)
- `create_collection(name, description?, color?, icon?)` - Create collection
- `get_collection(id)` - Get collection by ID
- `list_collections()` - List all collections
- `update_collection(id, name?, description?, color?, icon?, sort_order?)` - Update
- `delete_collection(id)` - Delete collection
- `update_note_collection(note_id, collection_id?)` - Move note to collection
- `list_notes_in_collection(collection_id)` - List notes in collection
- `list_uncategorized_notes()` - List notes without collection
- `count_notes_in_collection(collection_id)` - Count notes

#### Settings Commands (`settings.rs`)
- `get_hotkey_settings()` - Get global hotkey settings
- `update_hotkey_settings(settings)` - Update hotkeys
- `set_autostart(enabled)` - Enable/disable autostart
- `store_auto_backup_password(password)` - Store in OS keyring
- `has_auto_backup_password()` - Check if password stored
- `delete_auto_backup_password()` - Remove from keyring
- `get_auto_backup_settings()` - Get auto-backup config
- `update_auto_backup_settings(settings)` - Update auto-backup

#### Window Commands (`windows.rs`)
- `create_or_focus_window(config)` - Create or focus window
- `delete_note_and_close_window(window, note_id)` - Delete note and close
- `open_note_window(note_id)` - Open sticky note window
- `create_new_sticky_note()` - Create and open new sticky
- `set_last_focused_note_window(window)` - Track last focused
- `toggle_last_focused_note_window()` - Toggle last sticky
- `open_settings_window()` - Open settings
- `open_main_window_and_focus_search()` - Open main + focus search
- `toggle_main_window()` - Show/hide main window
- `toggle_settings_window()` - Show/hide settings
- `toggle_all_note_windows()` - Show/hide all stickies

#### Updater Commands (`updater.rs`)
- `check_for_update()` - Check for new version
- `download_and_install_update()` - Download and install update

### Key Data Models

All defined in `src-tauri/src/database/models.rs`:

#### `Note`
- **Location**: `src-tauri/src/database/models.rs`, lines 11-24
- **Purpose**: Core note entity with rich text content
- **Key Fields**:
  - `id: String` - UUID primary key
  - `title: String` - Note title
  - `content_json: String` - Quill Delta format (JSON)
  - `created_at: DateTime<Utc>`
  - `updated_at: DateTime<Utc>`
  - `deleted_at: Option<DateTime<Utc>>` - Soft delete timestamp
  - `title_modified: bool` - Whether title was manually set
  - `collection_id: Option<String>` - Foreign key to collection
- **Table**: `notes`

#### `Collection`
- **Location**: `src-tauri/src/database/models.rs`, lines 27-36
- **Purpose**: Folder/tag for organizing notes
- **Key Fields**:
  - `id: String` - UUID
  - `name: String`
  - `description: Option<String>`
  - `color: String` - Hex color code
  - `icon: Option<String>` - Icon name/emoji
  - `sort_order: i32` - Display order
- **Table**: `collections`

#### `Attachment`
- **Location**: `src-tauri/src/database/models.rs`, lines 79-87
- **Purpose**: File attachment linked to note
- **Key Fields**:
  - `id: String` - UUID
  - `note_id: String` - Foreign key
  - `blob_hash: String` - SHA-256 hash (content-addressed)
  - `filename: String`
  - `mime_type: String`
  - `size: i64` - Bytes
- **Table**: `attachments`
- **Physical Storage**: `<app_data>/blobs/ab/cd/abcd1234...` (hash-sharded)

#### `Reminder`
- **Location**: `src-tauri/src/database/models.rs`, lines 90-97
- **Purpose**: Time-based notification for note
- **Key Fields**:
  - `id: String` - UUID
  - `note_id: String` - Foreign key
  - `trigger_time: DateTime<Utc>` - When to notify
  - `triggered: bool` - Whether it fired
- **Table**: `reminders`

#### `Backup`
- **Location**: `src-tauri/src/database/models.rs`, lines 100-107
- **Purpose**: Metadata for backup file
- **Key Fields**:
  - `id: String` - UUID
  - `path: String` - Filesystem path to ZIP
  - `timestamp: DateTime<Utc>`
  - `size: i64` - ZIP file size
  - `manifest_hash: String` - SHA-256 of manifest.json
- **Table**: `backups`
- **Physical Storage**: `<app_data>/backups/backup_2026-01-27_143022.zip`

### Storage and Persistence Approach

#### Database: SQLite with SQLx

- **File**: `<app_data>/db.sqlite`
- **Library**: SQLx with compile-time checked queries
- **Configuration** (`src-tauri/src/database/schema.rs`):
  - WAL mode enabled (better concurrency)
  - Foreign keys enforced
  - Auto-vacuum enabled
- **Migrations**: Embedded SQL in `schema.rs`
- **Full-Text Search**: FTS5 virtual table `notes_fts` for note content

#### Blob Storage

- **Implementation**: `src-tauri/src/storage/blob_store.rs`
- **Strategy**: Content-addressed storage using SHA-256
- **Directory Structure**:
  ```
  <app_data>/blobs/
    ab/cd/abcd1234...ef  (first 2 chars, next 2 chars, full hash)
  ```
- **Operations**:
  - `write(data) -> hash` - Atomic write with temp file
  - `read(hash) -> data` - Read by hash
  - `delete(hash)` - Remove blob (with reference counting check)
  - `exists(hash)` - Check existence
- **Deduplication**: Same content = same hash = stored once

#### Backup Files

- **Format**: Encrypted ZIP archive
- **Location**: `<app_data>/backups/backup_YYYY-MM-DD_HHMMSS.zip`
- **Contents**:
  - `manifest.json` - File list with checksums
  - `db.sqlite` - Database snapshot
  - `blobs/` - All blob files
- **Encryption**: AES-256-GCM with Argon2id key derivation
- **Retention**: Configurable (default: keep last 10)

#### App Data Directory

Location on Windows: `C:\Users\<user>\AppData\Roaming\swatnotes\`

### UI Routes/Pages/Components Map

#### HTML Pages

1. **`index.html`** - Main application window
   - Entry point: `src/main.ts`
   - Components: note list, editor, collections sidebar
   
2. **`sticky-note.html`** - Floating sticky note window
   - Entry point: `src/sticky-note.ts`
   - Single-note editor view

3. **`settings.html`** - Settings window
   - Entry point: `src/settings.ts`
   - Tabs: General, Hotkeys, Backups, Reminders, About

4. **`update-required.html`** - Update notification window
   - Entry point: `src/update-required.ts`
   - Shows when update available

#### TypeScript Components

Located in `src/`:

- **`components/noteEditor.ts`** - Quill.js rich text editor wrapper
  - Function: `createNoteEditor(container, note?, readonly?)`
  - Handles autosave, attachments, formatting

- **`components/notesList.ts`** - Note list rendering
  - Function: `renderNotesList(notes, container, onclick?)`
  - Displays notes with title, preview, timestamp

- **`state/appState.ts`** - Global application state
  - `appState.currentNote` - Currently editing note
  - `appState.notes` - Cached note list
  - Mutation functions: `setCurrentNote()`, `updateNote()`, etc.

- **`ui/theme.ts`** - DaisyUI theme management
  - `initTheme()` - Load saved theme
  - `setupThemeSwitcher()` - Theme dropdown handler

- **`ui/backup.ts`** - Backup UI logic
  - Create backup flow with password modal
  - Restore flow with file picker

#### API Wrappers (`src/utils/`)

All Tauri command wrappers with TypeScript types:

- **`notesApi.ts`** - `createNote()`, `updateNote()`, `deleteNote()`, etc.
- **`attachmentsApi.ts`** - `createAttachment()`, `getAttachmentData()`, etc.
- **`backupApi.ts`** - `createBackup()`, `restoreBackup()`, etc.
- **`remindersApi.ts`** - `createReminder()`, `listActiveReminders()`, etc.
- **`collectionsApi.ts`** - `createCollection()`, `listCollections()`, etc.

### Frontend Dependencies

From `package.json`:

- **Tauri**: `@tauri-apps/api` v2.0.0
- **Tauri Plugins**: dialog, fs, global-shortcut, notification, process, shell, clipboard-manager
- **Editor**: `quill` v2.0.2
- **CSS**: `tailwindcss` v3.4.17, `daisyui` v4.12.14
- **Build**: `vite` v7.3.1
- **Testing**: `vitest` v4.0.17, `@wdio/cli` v7.36.0 (E2E)

### Rust Dependencies

From `src-tauri/Cargo.toml`:

- **Framework**: `tauri` v2.0
- **Async**: `tokio` v1 (full features)
- **Database**: `sqlx` v0.8 (runtime-tokio, sqlite, chrono)
- **Serialization**: `serde` v1, `serde_json` v1
- **Errors**: `anyhow` v1, `thiserror` v1
- **Logging**: `tracing` v0.1, `tracing-subscriber` v0.3
- **Crypto**: `aes-gcm` v0.10, `argon2` v0.5, `sha2` v0.10
- **Utilities**: `chrono` v0.4, `uuid` v1, `zip` v2
- **System**: `keyring` v3 (credential storage), `tokio-cron-scheduler` v0.13
- **HTTP**: `reqwest` v0.12 (for update checks)

---

## Glossary

**Terms and concepts introduced so far:**

| Term | Definition | Chapter Introduced |
|------|-----------|-------------------|
| **Ownership** | Each value has exactly one owner; when owner goes out of scope, value is dropped | Ch 1 |
| **Borrowing** | Temporary access to a value without taking ownership; can be immutable (&T) or mutable (&mut T) | Ch 1 |
| **Lifetimes** | Annotations ensuring references don't outlive the data they point to | Ch 1 |
| **Option<T>** | Type representing "maybe a value": `Some(T)` or `None` | Ch 1 |
| **Result<T, E>** | Type representing success (`Ok(T)`) or failure (`Err(E)`) | Ch 1 |
| **Async/Await** | Non-blocking execution; `.await` pauses function until Future completes | Ch 1 |
| **Borrow Checker** | Compiler component enforcing ownership and borrowing rules | Ch 1 |
| **Tauri Command** | Rust function exposed to frontend via `#[tauri::command]` macro | Part 0, Ch 3 |
| **IPC** | Inter-Process Communication; bridge between frontend (WebView) and backend (Rust) | Part 0, Ch 3 |
| **invoke()** | JavaScript function to call Tauri commands from frontend | Ch 3 |
| **Serialization** | Converting data to/from JSON for IPC communication (via serde) | Ch 3 |
| **#[tauri::command]** | Macro attribute that makes a Rust function callable from JavaScript | Ch 3 |
| **State<'_, AppState>** | Tauri parameter providing access to shared application state | Ch 3 |
| **API Wrapper** | TypeScript function encapsulating invoke() calls for type safety | Ch 3 |
| **SQLite** | Embedded relational database stored as single file; zero configuration | Ch 4 |
| **ACID** | Atomicity, Consistency, Isolation, Durability - database transaction guarantees | Ch 4 |
| **WAL Mode** | Write-Ahead Logging; SQLite mode enabling concurrent reads during writes | Ch 4 |
| **SQLx** | Rust SQL library with compile-time query checking against real database | Ch 4 |
| **query_as!()** | SQLx macro validating SQL and generating typed results at compile time | Ch 4 |
| **QueryBuilder** | SQLx tool for building dynamic SQL queries (e.g., batch IN clauses) | Ch 4 |
| **N+1 Query Problem** | Anti-pattern making N individual queries instead of 1 batch query | Ch 4 |
| **Tauri Plugin** | Extension adding desktop capabilities (dialogs, notifications, shortcuts) | Ch 4 |
| **Managed State** | Shared resources accessible to all commands via `.manage()` in Tauri | Ch 4 |
| **DaisyUI** | Component library built on Tailwind CSS with pre-styled UI elements | Ch 4 |
| **CSS Variables** | Custom properties like `--p` enabling theme switching without class changes | Ch 4 |
| **Vite** | Frontend build tool with HMR, multi-page support, and tree shaking | Ch 4 |
| **HMR** | Hot Module Replacement; instant browser updates during development | Ch 4 |
| **Tree Shaking** | Removing unused code from final bundle to reduce size | Ch 4 |
| **Cargo** | Rust build tool and package manager with dependency resolution | Ch 4 |
| **Feature Flags** | Cargo mechanism to enable/disable optional crate functionality | Ch 4 |
| **Incremental Compilation** | Recompiling only changed modules to speed up builds | Ch 4 |
| **Module** | Rust's code organization unit; declared with `mod` keyword | Ch 5 |
| **pub** | Visibility modifier making items accessible outside their module | Ch 5 |
| **mod.rs** | File defining a directory as a module with nested submodules | Ch 5 |
| **Re-export** | Using `pub use` to expose items from submodules at parent level | Ch 5 |
| **AppState** | Central state struct holding all services and shared resources | Ch 5 |
| **Dependency Injection** | Passing dependencies via constructor instead of hardcoding them | Ch 5 |
| **Service Layer** | Business logic layer coordinating between commands and repository | Ch 5 |
| **Repository** | Data access abstraction hiding SQL details behind clean API | Ch 5 |
| **Arc** | Atomic Reference Counter - thread-safe shared ownership pointer | Ch 5 |
| **Mutex** | Mutual exclusion lock ensuring single-threaded access to data | Ch 5 |
| **Tracing** | Structured logging library for Rust with levels and filtering | Ch 5 |
| **Log Levels** | Severity categories: ERROR, WARN, INFO, DEBUG, TRACE | Ch 5 |
| **EnvFilter** | Tracing filter configured via RUST_LOG environment variable | Ch 5 |
| **Static Config** | Compile-time constants defined in config.rs | Ch 5 |
| **Dynamic Settings** | Runtime configuration persisted to settings.json | Ch 5 |
| **Schema** | Database structure definition (tables, columns, types, constraints) | Ch 6 |
| **Migration** | Versioned, incremental change to database schema | Ch 6 |
| **UUID** | Universally Unique Identifier - 128-bit globally unique ID | Ch 6 |
| **Soft Delete** | Marking records deleted without removing from database | Ch 6 |
| **Foreign Key** | Column referencing primary key of another table for relationships | Ch 6 |
| **CASCADE** | Foreign key behavior: delete/update child rows when parent changes | Ch 6 |
| **Index** | Data structure speeding up queries on specific columns | Ch 6 |
| **FTS5** | SQLite Full-Text Search engine using inverted index | Ch 6 |
| **Composite Index** | Index on multiple columns for multi-column queries | Ch 6 |
| **Request/Response DTOs** | Data Transfer Objects defining inputs/outputs for repository methods | Ch 6 |
| **QueryBuilder** | SQLx tool for dynamically constructing type-safe SQL queries | Ch 6 |
| **Transaction** | Atomic unit of work - all operations succeed or all fail | Ch 6 |
| **ACID** | Database properties: Atomicity (all-or-nothing), Consistency (valid state), Isolation (concurrent safety), Durability (persisted changes) | Ch 6 |
| **UUID (Universally Unique Identifier)** | A 128-bit identifier (e.g., 550e8400-e29b-41d4-a716-446655440000) guaranteed to be unique without a central authority | Ch 7 |
| **Quill Delta** | A JSON format representing rich text content as an array of insert operations with attributes | Ch 7 |
| **Delta ops** | Individual operations in a Quill Delta, each with an insert (content) and optional attributes (formatting) | Ch 7 |
| **IPC (Inter-Process Communication)** | Communication between processes using message passing; Tauri uses IPC between TypeScript frontend and Rust backend | Ch 7 |
| **invoke()** | Tauri's TypeScript function for calling Rust commands; returns a Promise that resolves with result or rejects with error | Ch 7 |
| **State injection** | Passing shared state (like AppState) to functions via parameters; Tauri provides State<'_, AppState> to commands automatically | Ch 7 |
| **DTO (Data Transfer Object)** | A simple struct used to transfer data between layers (e.g., CreateNoteRequest); DTOs have no business logic | Ch 7 |
| **Thin handler / Fat service** | Pattern where command handlers (thin) delegate to service methods (fat); handlers adapt requests, services contain logic | Ch 7 |
| **Graceful degradation** | A system's ability to continue functioning when a non-critical component fails (e.g., note creation succeeds even if FTS sync fails) | Ch 7 |
| **RETURNING clause** | A SQLite feature that returns the inserted/updated row in the same query, avoiding a separate SELECT | Ch 7 |
| **Parameterized query** | A SQL query with placeholders (?) for values, filled in by binding; prevents SQL injection | Ch 7 |
| **FTS synchronization** | Keeping the FTS5 index in sync with the main table by inserting/updating/deleting FTS rows when the main table changes | Ch 7 |
| **Error propagation** | Passing errors up the call stack without handling them; in Rust, the ? operator propagates Err values automatically | Ch 7 |
| **Global shortcut** | A keyboard shortcut that works system-wide, even when the app is not focused; registered with the OS via Tauri plugin | Ch 7 |
| **AppHandle** | Tauri's handle to the running app instance; provides access to windows, clipboard, events, and other app-level APIs | Ch 7 |
| **Quill.js** | Rich text editor library using Delta format instead of HTML; provides WYSIWYG editing with clean API | Ch 8 |
| **WYSIWYG** | What You See Is What You Get - editing interface where content appears as it will when displayed | Ch 8 |
| **Delta ops** | Operations in Quill Delta format; each has insert (content) and optional attributes (formatting) | Ch 8 |
| **Debouncing** | Delaying function execution until a pause in events; prevents excessive calls (e.g., save on every keystroke) | Ch 8 |
| **Autosave** | Automatically saving content without user action; typically debounced to wait for typing pauses | Ch 8 |
| **Blot** | Quill's content type system; built-in blots (text, bold, image) can be extended with custom blots | Ch 8 |
| **BlockEmbed** | Quill blot type for block-level embedded content (like images or attachment chips) | Ch 8 |
| **Content-editable** | HTML attribute making elements editable; browsers provide native rich text editing (but inconsistent) | Ch 8 |
| **Data URL** | URL scheme embedding file data as base64 (e.g., data:image/png;base64,...); causes bloat if stored in database | Ch 8 |
| **Clipboard API** | Browser API for accessing clipboard data; clipboardData.items contains pasted content with MIME types | Ch 8 |
| **Drag-and-drop API** | Browser API for handling file drags; dragover, dragleave, drop events with dataTransfer.files | Ch 8 |
| **Memory leak** | Unreleased memory from event listeners or references; prevented by cleanup functions in destroy() | Ch 8 |
| **Event listener cleanup** | Removing event listeners when components are destroyed; prevents memory leaks and duplicate handlers | Ch 8 |
| **Partial update** | Updating only specific fields of a record, leaving others unchanged; uses optional parameters | Ch 10 |
| **Optional parameter** | Function parameter that can be omitted; in Rust Option<T>, in TypeScript T \| null or T \| undefined | Ch 10 |
| **Dynamic SQL** | SQL queries constructed at runtime based on input parameters; requires careful escaping to prevent injection | Ch 10 |
| **SQLx QueryBuilder** | Type-safe SQL query builder preventing injection by using parameterized queries with .push_bind() | Ch 10 |
| **Soft delete** | Marking records as deleted (with deleted_at timestamp) without removing from database; enables undo | Ch 10 |
| **Hard delete** | Permanently removing records from database; irreversible data loss | Ch 10 |
| **Trash** | Collection of soft-deleted items; can be emptied (pruned) to free disk space | Ch 10 |
| **Prune** | Permanently delete soft-deleted records; typically called "Empty Trash" in UI | Ch 10 |
| **Idempotent operation** | Operation that produces same result whether called once or multiple times | Ch 10 |
| **rows_affected** | SQL execution result indicating how many rows were changed by UPDATE/DELETE query | Ch 10 |
| **Orphaned data** | Child records whose parent was deleted, leaving dangling foreign keys | Ch 10 |
| **Reference counting** | Tracking how many references exist to a resource; delete resource when count reaches zero | Ch 10 |
| **Optimistic UI** | Updating UI immediately and sending backend request asynchronously; rollback on error | Ch 10 |
| **Pessimistic UI** | Waiting for backend confirmation before updating UI; slower but safer | Ch 10 |
| **Rollback** | Reversing changes when an operation fails; in optimistic UI, restoring previous state | Ch 10 |
| **Graceful failure** | Handling errors without crashing; log warnings and continue with degraded functionality | Ch 10 |
| **Query Planner** | SQLite component choosing fastest execution strategy for queries | Ch 6 |
| **Transaction** | Group of database operations executed atomically (all-or-nothing) | Ch 6 |
| **BEGIN/COMMIT** | Transaction control: start transaction, save all changes | Ch 6 |
| **ROLLBACK** | Undo all changes in current transaction | Ch 6 |
| **DTO** | Data Transfer Object - struct for passing data between layers | Ch 6 |
| **Virtual Table** | Special table type (like FTS5) providing query-like interface | Ch 6 |
| **Junction Table** | Table linking two tables in many-to-many relationship | Ch 6 |
| **AppState** | Shared application state accessible to all commands via `State<'_, AppState>` | Part 0 |
| **Repository Pattern** | Data access layer abstracting database operations | Part 0 |
| **Content-addressed storage** | Storage system where files are identified by their content hash (SHA-256), not filename | Ch 13 |
| **SHA-256** | Cryptographic hash function producing 64-character hex string; collision-resistant, deterministic | Ch 13 |
| **Cryptographic hash** | One-way function converting data to fixed-length digest; same input always produces same output | Ch 13 |
| **Two-level sharding** | Directory structure using first 4 hash characters: blobs/ab/cd/abcd1234...; prevents filesystem slowdown | Ch 13 |
| **Hash collision** | Two different inputs producing same hash; astronomically rare with SHA-256 (2^128 chance) | Ch 13 |
| **Deduplication** | Storing identical content once; content-addressed storage enables automatic deduplication | Ch 13 |
| **Atomic write** | Write operation that fully succeeds or fully fails; no partial writes; prevents corruption | Ch 13 |
| **Blob store** | Storage system for binary large objects (BLOBs); files stored outside database | Ch 13 |
| **Binary data** | Non-text data like images, videos, PDFs; represented as bytes (u8 in Rust, Uint8Array in TypeScript) | Ch 13 |
| **MIME type** | Multipurpose Internet Mail Extensions type; identifies file format (image/png, application/pdf, etc.) | Ch 13 |
| **File upload** | Transferring file from client (browser) to server (backend); uses FileReader API in browsers | Ch 13 |
| **Drag-and-drop** | UI pattern letting users drag files into application; uses dragover/drop events | Ch 13 |
| **Clipboard paste** | Inserting content from system clipboard; ClipboardEvent.clipboardData.items in browsers | Ch 13 |
| **FileReader API** | Browser API for reading files asynchronously; readAsArrayBuffer() returns binary data | Ch 13 |
| **Blob URL** | Temporary URL pointing to browser memory (blob:http://...); revoke with URL.revokeObjectURL() | Ch 13 |
| **Data URL** | URL embedding file data as base64 (data:image/png;base64,...); causes bloat if stored | Ch 13 |
| **Custom Quill blot** | Custom content type in Quill editor; extends built-in blots like BlockEmbed | Ch 13 |
| **BlockEmbed** | Quill blot type for block-level embedded content (images, attachment chips) | Ch 13 |
| **Async image loading** | Loading images asynchronously with placeholder; prevents blocking UI thread | Ch 13 |
| **Filename sanitization** | Removing dangerous characters from filenames (/, \\, :, etc.); prevents path traversal attacks | Ch 13 |
| **Path traversal attack** | Security exploit using ../.. in filenames to access parent directories | Ch 13 |
| **Size validation** | Checking file size before processing; prevents disk exhaustion and DoS attacks | Ch 13 |
| **Lazy loading** | Loading resources only when needed; images load as they become visible in viewport | Ch 13 |
| **Encryption** | Converting plaintext to ciphertext using cryptographic algorithm; requires key to decrypt | Ch 14 |
| **Decryption** | Converting ciphertext back to plaintext using correct key | Ch 14 |
| **Symmetric encryption** | Encryption where same key encrypts and decrypts; faster than asymmetric | Ch 14 |
| **AES (Advanced Encryption Standard)** | Symmetric block cipher with 128-bit blocks; AES-256 uses 256-bit keys | Ch 14 |
| **GCM (Galois/Counter Mode)** | Authenticated encryption mode providing encryption + authentication in single operation | Ch 14 |
| **Authenticated encryption** | Encryption that also proves data integrity and authenticity (e.g., GCM) | Ch 14 |
| **Authentication tag** | Cryptographic checksum proving data wasn't tampered; GCM produces 16-byte tag | Ch 14 |
| **Nonce** | Number Used Once; random value ensuring same plaintext produces different ciphertext | Ch 14 |
| **Key derivation** | Generating encryption key from password using cryptographic hash function | Ch 14 |
| **Argon2id** | Password hashing function for key derivation; memory-hard, winner of PHC 2015 | Ch 14 |
| **Memory-hard** | Algorithm requiring significant RAM; prevents GPU/ASIC attacks (e.g., Argon2id) | Ch 14 |
| **Salt** | Random value added to password before hashing; prevents rainbow table attacks | Ch 14 |
| **Rainbow table** | Precomputed table of password hashes; defeated by unique salts | Ch 14 |
| **Ciphertext** | Encrypted data; unreadable without decryption key | Ch 14 |
| **Plaintext** | Unencrypted original data | Ch 14 |
| **Brute-force attack** | Trying all possible passwords/keys until finding correct one | Ch 14 |
| **Entropy** | Measure of randomness/unpredictability; higher entropy = stronger password | Ch 14 |
| **OsRng** | Operating System Random Number Generator; cryptographically secure random source | Ch 14 |
| **Password strength** | Measure of password resistance to guessing; depends on length and entropy | Ch 14 |
| **Passphrase** | Multi-word password (e.g., "correct horse battery staple"); high entropy, memorable | Ch 14 |
| **Backup** | Complete snapshot of application data (database + blobs) at specific point in time | Ch 15 |
| **Manifest** | JSON file listing all files in backup with checksums, version, timestamp | Ch 15 |
| **ZIP archive** | Compressed file container; SwatNotes uses Deflate compression for backups | Ch 15 |
| **Checksum** | Hash value (SHA-256) proving file integrity; compared during restore | Ch 15 |
| **Retention policy** | Automatic deletion of old backups beyond configured limit (default 10) | Ch 15 |
| **Orphaned record** | Database record pointing to non-existent file; cleaned up automatically | Ch 15 |
| **Atomic operation** | Operation that fully succeeds or fully fails; no partial/intermediate states | Ch 15 |
| **Atomic restore** | File replacement using rename operations (atomic on most filesystems) | Ch 15 |
| **Path traversal** | Security attack using ../ in paths to access files outside intended directory | Ch 15 |
| **Canonicalize** | Resolve path to absolute form, eliminating .., ., symlinks | Ch 15 |
| **Batch deletion** | Deleting multiple records in single database transaction (all-or-nothing) | Ch 15 |
| **File locking** | OS preventing file modifications while open (Windows locks files more aggressively) | Ch 15 |
| **Connection pool** | Reusable set of database connections; must close to release file handles | Ch 15 |
| **Deflate compression** | Lossless compression algorithm used in ZIP files; reduces backup size | Ch 15 |
| **Integrity verification** | Checking data hasn't been corrupted by comparing checksums | Ch 15 |
| **Polling loop** | Repeatedly checking for events/conditions at regular intervals; e.g., checking for due reminders every 5 seconds | Ch 16 |
| **UTC (Coordinated Universal Time)** | Global time standard without timezone offsets; always use for storing timestamps (avoids DST issues) | Ch 16 |
| **Triggered flag** | Boolean indicating whether a reminder has already fired; prevents duplicate notifications | Ch 16 |
| **Mark-before-notify** | Pattern of updating database state before sending notification to prevent re-triggering on errors | Ch 16 |
| **Visual notification** | Non-intrusive notification showing window instead of system popup; provides context | Ch 16 |
| **Always-on-top** | Window property keeping it above other windows without stealing keyboard focus | Ch 16 |
| **AppHandle** | Tauri's handle to running application instance; needed for window creation, events, clipboard | Ch 16 |
| **tokio::time::interval** | Creates periodic timer that ticks at fixed intervals; used for polling loops | Ch 16 |
| **Cron expression** | String defining scheduled time (e.g., "0 0 2 * * *" = daily at 2 AM) | Ch 16 |
| **tokio-cron-scheduler** | Rust library for running scheduled tasks based on cron expressions | Ch 16 |
| **toISOString()** | JavaScript method converting Date to UTC string (e.g., "2026-01-28T15:30:00.000Z") | Ch 16 |
| **toLocaleString()** | JavaScript method formatting Date in user's local timezone and locale | Ch 16 |
| **Datetime picker** | HTML5 <input type="datetime-local"> element for selecting date and time | Ch 16 |
| **Event emission** | Sending events from backend to frontend; Tauri's AppHandle.emit() | Ch 16 |
| **Background task** | Long-running task spawned with tokio::spawn; runs independently from main thread | Ch 16 |
| **Daylight Saving Time (DST)** | Clock adjustment in some timezones (spring forward, fall back); avoided by using UTC | Ch 16 |
| **Job scheduler** | System for running tasks at specific times or intervals; tokio-cron-scheduler in Rust | Ch 16 |
| **Credential manager** | OS keyring for securely storing passwords; used for auto-backup password | Ch 16 |
| **RwLock** | Read-write lock allowing multiple readers OR one writer; more flexible than Mutex | Ch 16 |
| **Global hotkey** | System-wide keyboard shortcut that works even when app isn't focused (e.g., Ctrl+Shift+N) | Ch 17 |
| **System tray** | Notification area in taskbar with icons for background apps | Ch 17 |
| **Hide-to-tray** | Window hides when X clicked instead of closing; app stays running in system tray | Ch 17 |
| **Toggle operation** | Single action that switches between two states (show/hide, on/off) | Ch 17 |
| **CloseRequested** | Tauri event fired before window closes; can be prevented to hide instead | Ch 17 |
| **TrayIconBuilder** | Tauri API for creating system tray icon with menu and click handlers | Ch 17 |
| **Autostart** | Launching application automatically when OS boots; set via Windows registry | Ch 17 |
| **Registry** | Windows database storing OS and app settings; HKCU\...\Run for autostart programs | Ch 17 |
| **ShortcutState** | Enum indicating if hotkey is Pressed or Released; filter for Pressed to avoid double-triggering | Ch 17 |
| **Grid layout** | Arranging windows in rows and columns based on screen dimensions | Ch 17 |
| **Event-driven** | Architecture where code executes in response to events, not continuous polling | Ch 17 |
| **Warm start** | Showing already-initialized hidden window (fast); vs cold start (launching from zero) | Ch 17 |
| **Platform-specific code** | Code that only compiles/runs on specific OS; uses #[cfg(target_os = "...")] | Ch 17 |
| **Optimistic UI** | Updating UI immediately assuming success, rolling back on error | Ch 17 |
| **Collection** | Folder/group for organizing notes; has name, color, sort_order, and contains notes | Ch 18 |
| **Nullable foreign key** | Foreign key column that can be NULL; allows rows to exist without parent reference | Ch 18 |
| **ON DELETE SET NULL** | Foreign key behavior setting child references to NULL when parent is deleted | Ch 18 |
| **sort_order** | Integer field determining display order; allows manual reordering without timestamps | Ch 18 |
| **Uncategorized** | Notes without a collection (collection_id IS NULL); like loose papers without a folder | Ch 18 |
| **Color badge** | Small colored circle next to collection name; enables visual scanning | Ch 18 |
| **N+1 query problem** | Anti-pattern making N individual queries in a loop instead of 1 batch query | Ch 18 |
| **Visual grep** | Using color/visual patterns for instant filtering instead of reading text | Ch 18 |
| **Hover-to-delete** | UI pattern where delete button is hidden (opacity-0) until hovering over item | Ch 18 |
| **Active state** | UI highlighting showing which filter/item is currently selected | Ch 18 |
| **Predefined palette** | Fixed set of colors/options to choose from; ensures consistency and good UX | Ch 18 |
| **Hierarchical data** | Tree-structured data with parent-child relationships (e.g., nested collections) | Ch 18 |
| **Service Layer** | Business logic layer between commands and repository | Part 0 |
| **Content-Addressed Storage** | Files stored by hash of content (same content = same file) | Part 0 |
| **Semantic versioning (semver)** | Version numbering scheme using MAJOR.MINOR.PATCH format (e.g., 1.2.3) | Ch 19 |
| **GitHub Releases API** | RESTful API for accessing release information from GitHub repositories | Ch 19 |
| **User-Agent header** | HTTP header identifying the client application; required by GitHub API | Ch 19 |
| **Annotated Git tag** | Git tag with metadata (message, author, date); stores release notes | Ch 19 |
| **reqwest** | Rust HTTP client library with async support and redirect handling | Ch 19 |
| **Graceful degradation** | System continues functioning with reduced features when components fail | Ch 19 |
| **Temp directory** | OS-provided temporary file storage, auto-cleaned periodically | Ch 19 |
| **Delta update** | Updating software by applying only the differences (binary diff) instead of full replacement | Ch 19 |
| **Code signing certificate** | Digital certificate proving software publisher identity; prevents "Unknown Publisher" warnings | Ch 19 |
| **UAC (User Account Control)** | Windows security feature requiring admin approval for system changes | Ch 19 |
| **Soft Delete** | Marking records as deleted (deleted_at timestamp) without removing from DB | Part 0 |
| **FTS5** | SQLite Full-Text Search extension for fast text queries | Part 0, Ch 9 |
| **Delta Format** | Quill.js JSON representation of rich text with operations | Part 0 |
| **WAL Mode** | Write-Ahead Logging; SQLite mode for better concurrency | Part 0 |
| **DaisyUI** | Component library built on Tailwind CSS with pre-styled components | Part 0 |
| **WebView** | Embedded browser component (like Chrome) for rendering UI | Part 0 |
| **LIKE pattern** | SQL wildcard matching; % matches any characters (e.g., %budget% finds "budget_report.pdf") | Ch 9 |
| **Inverted index** | Data structure mapping words to document locations; like a book's index | Ch 9 |
| **Virtual table** | FTS5 table type providing search functionality; looks like a table but is actually an index | Ch 9 |
| **MATCH operator** | FTS5-specific SQL syntax for full-text queries; much faster than LIKE for text search | Ch 9 |
| **BM25** | Best Matching algorithm for ranking search results by relevance; considers term frequency and rarity | Ch 9 |
| **Term frequency (TF)** | How often a search term appears in a document; higher = more relevant | Ch 9 |
| **Inverse document frequency (IDF)** | How rare a term is across all documents; rare terms are more important | Ch 9 |
| **Prefix wildcard** | Adding * to end of search term for autocomplete-style matching (e.g., "proj*" matches "project") | Ch 9 |
| **Two-phase search** | Search strategy combining FTS5 (title/content) with LIKE (attachments) for comprehensive results | Ch 9 |
| **Deduplication** | Removing duplicate results; uses HashSet for O(1) lookups in SwatNotes | Ch 9 |
| **Batch query** | Single SQL query fetching multiple records; prevents N+1 problem (e.g., get_notes_by_ids) | Ch 9 |
| **Graceful degradation** | Continuing with reduced functionality when a feature fails; attachment search failure doesn't break FTS | Ch 9 |
| **Empty query optimization** | Skipping expensive operations (like FTS) when query is empty; returns list_notes() instead | Ch 9 |
| **HashSet** | Data structure with O(1) lookups for membership testing; used for deduplication | Ch 9 |
| **O(1) lookup** | Constant-time operation regardless of data size; HashSet contains() is O(1) vs Vec is O(n) | Ch 9 |
| **Prefix scan** | Database operation scanning index entries starting with specific prefix; enables wildcard search | Ch 9 |
| **EXPLAIN QUERY PLAN** | SQLite command showing how a query will be executed; useful for debugging slow queries | Ch 9 |
| **Arc (Atomic Reference Counter)** | Smart pointer enabling multiple ownership via reference counting; thread-safe with atomic operations | Ch 11 |
| **Clone trait** | Rust trait allowing types to be duplicated; #[derive(Clone)] makes cloning automatic | Ch 11 |
| **Mutex (Mutual Exclusion)** | Synchronization primitive allowing only one thread to access data at a time via locking | Ch 11 |
| **Arc<Mutex<T>>** | Combination pattern for shared mutable state: Arc for ownership, Mutex for exclusive access | Ch 11 |
| **.lock()** | Mutex method blocking until lock is available, returning guard for protected data | Ch 11 |
| **Lock guard** | RAII object holding Mutex lock; automatically unlocks when guard goes out of scope | Ch 11 |
| **Poisoned mutex** | Mutex in error state because a thread panicked while holding the lock | Ch 11 |
| **State<'_, T>** | Tauri wrapper providing access to managed state in commands; lifetime inferred by compiler | Ch 11 |
| **Managed state** | Shared resources registered with app.manage() accessible to all commands | Ch 11 |
| **Singleton** | Design pattern ensuring only one instance of a class exists; appState uses singleton pattern | Ch 11 |
| **Pub-Sub (Publish-Subscribe)** | Pattern where publishers emit events and subscribers receive notifications; decouples components | Ch 11 |
| **Observer pattern** | Design pattern where observers watch subject for changes; Pub-Sub is an implementation | Ch 11 |
| **Getter/Setter** | Methods for controlled access to private fields; getters read, setters write with validation | Ch 11 |
| **Atomic operation** | Operation completing entirely or not at all; no intermediate state visible to other threads | Ch 11 |
| **Compound operation** | Multi-step operation updating multiple fields together (e.g., openNote updates 3 fields) | Ch 11 |
| **Subscription** | Registration to receive notifications when state changes; returned from subscribe() | Ch 11 |
| **Unsubscribe** | Cleanup function removing subscription to prevent memory leaks; returned by subscribe() | Ch 11 |
| **Wildcard subscription** | Subscribing to all state changes with '*' instead of specific key | Ch 11 |
| **Race condition** | Bug where outcome depends on timing of events; prevented with Mutex locks | Ch 11 |
| **Memory leak** | Unreleased memory from forgotten subscriptions or event listeners | Ch 11 |
| **Stale closure** | Closure capturing old variable values; avoided by reading fresh state each time | Ch 11 |
| **Lock scope** | Duration for which a Mutex lock is held; minimize to avoid blocking other threads | Ch 11 |
| **Reactive state** | State that automatically notifies observers when changed; enables reactive UI updates | Ch 11 |
| **Source of truth** | Authoritative version of data; backend database is source of truth, frontend is cache | Ch 11 |
| **Optimistic update** | Updating UI immediately before backend confirms; requires rollback on error | Ch 11 |
| **Pessimistic update** | Waiting for backend confirmation before updating UI; slower but safer | Ch 11 |
| **Service facade** | Design pattern where AppState exposes services, hiding direct database access | Ch 11 |
| **Graceful degradation** | Continuing with reduced functionality when optional components fail (e.g., scheduler) | Ch 11 |
| **Vanilla JavaScript/TypeScript** | Using JavaScript/TypeScript without frameworks (React, Vue, Angular); direct DOM manipulation | Ch 12 |
| **ES Modules** | Modern JavaScript module system using import/export syntax; replaces CommonJS require() | Ch 12 |
| **Named export** | Exporting functions/classes by name (export function foo()); preferred over default exports | Ch 12 |
| **Default export** | Single export per module (export default foo); avoided in SwatNotes for consistency | Ch 12 |
| **Circular dependency** | Module A imports B, B imports A; causes initialization issues; break with third module | Ch 12 |
| **Multi-page application** | App with multiple HTML files, each with own entry point; alternative to SPA routing | Ch 12 |
| **Entry point** | Starting file for each page (main.ts, sticky-note.ts); Vite bundles separately | Ch 12 |
| **Tree shaking** | Build optimization removing unused code from bundles; enabled by ES modules | Ch 12 |
| **Code splitting** | Separating code into multiple bundles to reduce initial load size | Ch 12 |
| **Content hashing** | Adding hash to filename (main-abc123.js) for cache busting; changes when content changes | Ch 12 |
| **HMR (Hot Module Replacement)** | Updating modules in browser without full page reload; Vite dev server feature | Ch 12 |
| **Source maps** | Files mapping minified code to original TypeScript for debugging | Ch 12 |
| **Component (frontend)** | Reusable UI building block; in SwatNotes, a function returning instance with cleanup | Ch 12 |
| **Cleanup function** | Function returned by component to remove event listeners and prevent memory leaks | Ch 12 |
| **DOM manipulation** | Directly modifying HTML elements via JavaScript (innerHTML, appendChild, etc.) | Ch 12 |
| **Template string** | JavaScript backtick strings with ${} interpolation for HTML generation | Ch 12 |
| **XSS (Cross-Site Scripting)** | Security vulnerability where malicious code is injected into HTML; prevented with escaping | Ch 12 |
| **escapeHtml()** | Function converting special characters to HTML entities to prevent XSS | Ch 12 |
| **Event delegation** | Attaching single listener to parent instead of many children; efficient for dynamic elements | Ch 12 |
| **Debouncing** | Delaying function execution until events stop firing; used for search input, autosave | Ch 12 |
| **Throttling** | Limiting function calls to at most once per interval; used for scroll, mousemove events | Ch 12 |
| **API wrapper** | TypeScript function encapsulating invoke() calls with types; one per Tauri command | Ch 12 |
| **Modal** | Popup dialog overlaying main content; SwatNotes uses DaisyUI modals instead of browser dialogs | Ch 12 |
| **Reflow** | Browser recalculating layout; expensive operation triggered by DOM changes | Ch 12 |
| **Minification** | Removing whitespace and shortening names in production build to reduce file size | Ch 12 |
| **Bundler** | Tool combining multiple modules into single file (Vite uses Rollup internally) | Ch 12 |
| **Type-only import** | import type {} syntax; types erased after compilation, no runtime code | Ch 12 |
| **Vitest** | Fast unit testing framework for Vite projects; compatible with Jest API | Ch 12 |
| **E2E testing** | End-to-end testing simulating real user interactions; SwatNotes uses WebdriverIO | Ch 12 |

---

## Style Rules

### Voice and Tone

- **Friendly and encouraging**: "You've got this!" not "This is obvious."
- **Honest about difficulty**: "This will be hard, but worth it."
- **No hand-waving**: If something is complex, admit it and explain thoroughly.
- **Active voice**: "Rust prevents bugs" not "Bugs are prevented by Rust."

### Analogy Rules

1. **Use real-world, relatable scenarios**: Libraries, restaurants, keys, houses.
2. **Explain the analogy explicitly**: Don't assume reader gets it.
3. **Map analogy to code**: "Key = ownership, visitor pass = borrow."
4. **Don't overextend**: If analogy breaks down, acknowledge it.

### Diagram Conventions

- **Mermaid only** (no ASCII art, no images)
- **Use consistent colors**:
  - User/Frontend: light blue (`#e1f5ff`)
  - Tauri/IPC: light yellow (`#fff4e1`)
  - Rust/Backend: light red (`#ffe1e1`)
  - Storage: light green (`#e1ffe1`)
- **Label arrows clearly**: "invoke('command')" not just "→"
- **Include legends** when colors/shapes have meaning

### Code Reference Rules

1. **Always include file path**: `src-tauri/src/commands/notes.rs`
2. **Always include symbol name**: `create_note`
3. **Include line numbers** when referencing specific code (optional for general references)
4. **Excerpt length**: ≤25 words unless showing full function for teaching
5. **Never hallucinate**: If uncertain, mark as [TODO: verify] and list in PROGRESS.md

### Chapter Structure

Each chapter should have:

1. **Introduction** (why this matters)
2. **Mental Model** (analogy or visual explanation)
3. **Mermaid Diagram** (where applicable)
4. **Code Walkthrough** (actual repo code)
5. **Common Mistakes** (and fixes)
6. **Key Takeaways** (bullet list)
7. **Next Steps** (preview next chapter)

---

## Open Questions

**None currently** - All referenced files verified in repository.

Areas requiring deeper investigation for future chapters:
- [ ] Exact Argon2id parameters used in `crypto.rs` (for Ch 14)
- [ ] Global hotkey registration flow details (for Ch 18)
- [ ] Auto-update manifest format and verification (for Ch 20)
- [ ] CI/CD pipeline configuration (for Ch 23)

---

## Next Chapter Request

**To continue writing this book**, use this prompt:

```
Continue writing the book "Building Desktop Apps with Rust, Tauri & DaisyUI".

Current progress is documented in `/docs/PROGRESS.md`.

Please write [SPECIFY CHAPTER NUMBER AND TITLE HERE, e.g., "Chapter 2: Setting Up Your Environment"].

Requirements:
1. Follow all style rules and conventions in PROGRESS.md
2. Ground all facts in the actual SwatNotes repository
3. Include mental models and Mermaid diagrams
4. Reference actual code from the repo (with file paths)
5. Update PROGRESS.md after writing the chapter

Create the chapter file as `/docs/chapters/[NUMBER]-[slug].md` and update PROGRESS.md.
```

---

## Maintenance Notes

- Update **"Last Updated"** date each time PROGRESS.md is modified
- Mark chapters as ✅ Complete when fully written and reviewed
- Add new repo facts to **"Repository Facts Discovered"** as they're found
- Update **Glossary** with new terms introduced in each chapter
- Keep **Open Questions** current (remove when answered, add when discovered)

---

## Chapter Audit Log

### January 28, 2026 - Codebase Accuracy Audit

All 19 completed chapters were audited against the actual SwatNotes codebase. The following corrections were made to ensure documentation matches implementation:

#### Chapter 00 (The Map)
- Fixed `ReminderService` → `RemindersService` (plural naming)
- Updated directory structure to include `05-add_reminder_settings.sql` migration
- Updated Reminder model to show all 9 fields including notification settings (`sound_enabled`, `sound_type`, `shake_enabled`, `glow_enabled`)

#### Chapter 03 (Hello Tauri)
- Fixed FTS sync error handling: changed from `?` propagation to graceful degradation using `if let Err(e)` pattern
- Removed specific line number references that could become stale

#### Chapter 05 (Project Architecture)
- Fixed command signature order: `state` parameter now correctly shown as FIRST parameter
- Updated command count from 45+ to accurate 50+ count
- Updated service count from 6 to accurate 7 services
- Added SchedulerService to services list
- Updated return types to use `Result<T>` without explicit error type

#### Chapter 06 (Database Foundations)
- Added migration 005 (`05-add_reminder_settings.sql`) to migration list
- Added `backups` and `settings` tables to initial schema documentation
- Updated practice exercise to reference migration 006

#### Chapter 08 (Rich Text Editing)
- Removed specific line number reference for QuillDelta interface

#### Chapter 13 (File Attachments)
- Fixed `sanitize_filename` character filtering: removes `/`, `\`, `\0` (not `:`)
- Added `.take(255)` length limit to sanitize function
- Added `attachmentId` field to `AttachmentImageValue` interface
- Fixed blot registration paths: uses `'formats/attachment-image'` format
- Fixed `insertInlineAttachment` signature to use complete Attachment object

#### Chapter 16 (Reminders and Scheduling)
- Updated `create_reminder` repository function to include notification settings parameters
- Updated frontend `createReminder` to show optional `ReminderCreateSettings` parameter
- Added explanation of per-reminder notification settings to documentation

---

**Book Status**: 📝 In progress (4/25 chapters complete)  
**Next Recommended**: Chapter 4 - Understanding the Stack
