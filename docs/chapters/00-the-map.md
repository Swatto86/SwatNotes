# Part 0: The Map

Before you start learning the details, you need **the big picture**. This chapter is your map—it shows what we're building, how the pieces connect, and where your data travels.

Think of this as looking at a city map before exploring the streets. You'll return to this chapter often as you build each piece.

---

## What We're Building

**SwatNotes** is a production-grade desktop notes application. "Production-grade" means it's not a toy—it has:

- ✅ Rich text editing with formatting, images, and attachments
- ✅ Encrypted backups with AES-256-GCM
- ✅ System tray integration and global hotkeys
- ✅ Time-based reminders with notifications
- ✅ Auto-updates
- ✅ Full-text search across thousands of notes
- ✅ Collections/folders for organization
- ✅ Content-addressed storage (no duplicate files)
- ✅ OneNote import (sections → collections)

All of this runs **locally** on your machine—no servers, no cloud, complete privacy.

---

## The 10,000-Foot View

Here's the entire system in one diagram:

```mermaid
graph TD
    subgraph User["👤 User"]
        Browser["Web Interface<br/>(HTML/CSS/JS + DaisyUI)"]
    end
    
    subgraph Tauri["Tauri Runtime"]
        WebView["WebView<br/>(Chromium/WebKit)"]
        IPC["IPC Bridge<br/>(invoke/emit)"]
    end
    
    subgraph Rust["Rust Backend"]
        Commands["Tauri Commands<br/>(notes, backup, etc.)"]
        Services["Services Layer<br/>(NotesService, BackupService)"]
        Repository["Repository<br/>(Database Access)"]
        BlobStore["Blob Store<br/>(File Storage)"]
    end
    
    subgraph Storage["Persistent Storage"]
        SQLite["SQLite Database<br/>(notes, attachments, etc.)"]
        Blobs["Blob Files<br/>(SHA-256 addressed)"]
        Backups["Backup ZIPs<br/>(encrypted)"]
    end
    
    Browser -->|User Actions| WebView
    WebView -->|"invoke('command')"| IPC
    IPC --> Commands
    Commands --> Services
    Services --> Repository
    Services --> BlobStore
    Repository --> SQLite
    BlobStore --> Blobs
    Services -.->|Backup| Backups
    
    IPC -.->|"emit('event')"| WebView
    WebView -.->|"listen('event')"| Browser
    
    style User fill:#e1f5ff
    style Tauri fill:#fff4e1
    style Rust fill:#ffe1e1
    style Storage fill:#e1ffe1
```

**What this means:**

1. **User** interacts with a web interface (HTML/CSS/JS)
2. **Tauri** embeds this interface in a native window (like Chrome but tiny)
3. **IPC Bridge** lets JavaScript call Rust functions (and vice versa)
4. **Rust Backend** handles all business logic, security, and storage
5. **Persistent Storage** keeps everything safe between app restarts

**Key Insight**: The frontend (JavaScript) **never** touches the database or filesystem directly. It **always** goes through Rust commands. This is how we maintain security and data integrity.

---

## Technology Stack Deep Dive

```mermaid
graph LR
    subgraph Frontend
        HTML["HTML<br/>(Structure)"]
        Tailwind["Tailwind CSS<br/>(Styling)"]
        DaisyUI["DaisyUI<br/>(Components)"]
        TypeScript["TypeScript<br/>(Logic)"]
        Quill["Quill.js<br/>(Editor)"]
        Vite["Vite<br/>(Build Tool)"]
    end
    
    subgraph Backend
        Rust["Rust<br/>(Language)"]
        Tauri2["Tauri v2<br/>(Framework)"]
        Tokio["Tokio<br/>(Async Runtime)"]
        SQLx["SQLx<br/>(Database)"]
        Crypto["aes-gcm + argon2<br/>(Encryption)"]
    end
    
    subgraph Storage
        SQLite["SQLite<br/>(Database)"]
        FS["Filesystem<br/>(Blobs)"]
    end
    
    HTML --> DaisyUI
    Tailwind --> DaisyUI
    TypeScript --> Quill
    Vite --> TypeScript
    
    Rust --> Tauri2
    Tokio --> Tauri2
    SQLx --> SQLite
    Tauri2 --> FS
    Crypto --> FS
    
    TypeScript -.->|IPC| Tauri2
    
    style Frontend fill:#e3f2fd
    style Backend fill:#fce4ec
    style Storage fill:#f1f8e9
```

### Why These Technologies?

| Technology | Purpose | Why Not Alternatives? |
|-----------|---------|---------------------|
| **Rust** | Backend language | Memory safety without garbage collection. No runtime crashes. |
| **Tauri v2** | Desktop framework | Smaller than Electron (5MB vs 150MB). Native performance. |
| **SQLite** | Database | Zero-config. Embedded. ACID guarantees. Reliable. |
| **SQLx** | Database library | Compile-time SQL checking. No runtime SQL errors. |
| **DaisyUI** | UI components | Beautiful themes out-of-box. Built on Tailwind. |
| **Quill.js** | Rich text editor | Mature, extensible, Delta format for data. |
| **Tokio** | Async runtime | Standard in Rust. Efficient concurrency. |

---

## System Architecture

Let's zoom into the Rust backend's layers:

```mermaid
graph TD
    subgraph "Frontend (TypeScript)"
        UI["UI Components<br/>(notesList, noteEditor)"]
        State["App State<br/>(appState.ts)"]
        API["API Wrappers<br/>(notesApi, backupApi)"]
    end
    
    subgraph "Tauri Commands"
        NotesCmd["notes.rs<br/>create_note, update_note, etc."]
        BackupCmd["backup.rs<br/>create_backup, restore_backup"]
        AttachCmd["attachments.rs<br/>create_attachment, get_data"]
        RemindCmd["reminders.rs<br/>create_reminder, list_active"]
    end
    
    subgraph "Services Layer"
        NotesService["NotesService<br/>(business logic)"]
        BackupService["BackupService<br/>(backup orchestration)"]
        RemindersService["RemindersService<br/>(scheduling)"]
    end
    
    subgraph "Data Layer"
        Repository["Repository<br/>(SQL operations)"]
        BlobStore["BlobStore<br/>(file storage)"]
        Crypto["Crypto Module<br/>(encrypt/decrypt)"]
    end
    
    subgraph "Storage"
        DB[(SQLite)]
        Files[("Blob Files")]
    end
    
    UI --> API
    API -->|invoke| NotesCmd
    API -->|invoke| BackupCmd
    API -->|invoke| AttachCmd
    
    NotesCmd --> NotesService
    BackupCmd --> BackupService
    AttachCmd --> NotesService
    RemindCmd --> RemindersService
    
    NotesService --> Repository
    NotesService --> BlobStore
    BackupService --> Repository
    BackupService --> BlobStore
    BackupService --> Crypto
    RemindersService --> Repository
    
    Repository --> DB
    BlobStore --> Files
    
    style UI fill:#e1f5ff
    style NotesCmd fill:#fff4e1
    style NotesService fill:#ffe1f0
    style Repository fill:#f0ffe1
    style DB fill:#e1ffe1
```

### Architectural Principles

1. **Separation of Concerns**
   - Commands = thin HTTP-like handlers
   - Services = business logic
   - Repository = data access only
   - Each layer has one job

2. **Dependency Flow**
   - Always flows inward: UI → Commands → Services → Data
   - Never backwards (Data doesn't know about UI)

3. **Error Handling**
   - Every layer can fail
   - Errors bubble up using `Result<T, AppError>`
   - Logged at every boundary

4. **State Management**
   - Shared `AppState` holds all services
   - Accessed via Tauri's state management
   - Thread-safe with `Arc` and interior mutability

---

## End-to-End Data Flow: Creating a Note

Let's follow **one piece of data** through the entire system. This is the "running example" we'll reference throughout the book.

**Scenario**: User types "Buy groceries" in the editor and the app autosaves.

```mermaid
sequenceDiagram
    actor User
    participant Editor as Quill Editor
    participant UI as noteEditor.ts
    participant IPC as Tauri IPC
    participant Cmd as create_note command
    participant Svc as NotesService
    participant Repo as Repository
    participant DB as SQLite
    participant FTS as FTS5 Index
    
    User->>Editor: Types "Buy groceries"
    Editor->>UI: Delta change event
    UI->>UI: Debounce 500ms
    Note over UI: Wait for user to stop typing
    UI->>IPC: invoke('create_note', {title, content_json})
    IPC->>Cmd: create_note(state, title, content_json)
    Cmd->>Svc: create_note(title, content_json)
    
    Svc->>Svc: Generate UUID for note.id
    Svc->>Repo: create_note(CreateNoteRequest)
    Repo->>DB: INSERT INTO notes (id, title, content_json, ...)
    DB-->>Repo: ✓ Note inserted
    Repo->>FTS: INSERT INTO notes_fts (id, title, content)
    FTS-->>Repo: ✓ Indexed
    Repo-->>Svc: Note{id, title, ...}
    Svc-->>Cmd: Note{id, title, ...}
    Cmd-->>IPC: Ok(Note)
    IPC-->>UI: Note object
    UI->>UI: Update appState.currentNote
    UI->>Editor: Keep editing (no UI disruption)
    
    Note over User,Editor: ✓ Data safely persisted<br/>✓ Searchable<br/>✓ User never interrupted
```

### What Just Happened?

1. **User types** → Quill emits a change event
2. **Debounce** → Wait 500ms (don't save on every keystroke!)
3. **Invoke Tauri command** → `create_note` called from TypeScript
4. **Service layer** → Validates, generates UUID
5. **Repository** → Executes SQL INSERT in transaction
6. **FTS indexing** → Makes note searchable
7. **Response bubbles back** → Through every layer
8. **UI updates** → Silently, no jarring feedback

**Why this architecture?**
- **Separation**: Frontend doesn't know SQL, backend doesn't know DOM
- **Testability**: Each layer can be tested independently
- **Safety**: Rust's type system prevents many bugs
- **Performance**: Debouncing prevents 100 writes/second

---

## Key Data Models

These are the core types you'll work with:

```mermaid
classDiagram
    class Note {
        +String id (UUID)
        +String title
        +String content_json (Quill Delta)
        +DateTime~Utc~ created_at
        +DateTime~Utc~ updated_at
        +Option~DateTime~ deleted_at
        +bool title_modified
        +Option~String~ collection_id
    }
    
    class Attachment {
        +String id (UUID)
        +String note_id (FK)
        +String blob_hash (SHA-256)
        +String filename
        +String mime_type
        +i64 size
        +DateTime created_at
    }
    
    class Collection {
        +String id (UUID)
        +String name
        +Option~String~ description
        +String color
        +Option~String~ icon
        +i32 sort_order
        +DateTime created_at
        +DateTime updated_at
    }
    
    class Reminder {
        +String id (UUID)
        +String note_id (FK)
        +DateTime trigger_time
        +bool triggered
        +DateTime created_at
        +Option~bool~ sound_enabled
        +Option~String~ sound_type
        +Option~bool~ shake_enabled
        +Option~bool~ glow_enabled
    }
    
    class Backup {
        +String id (UUID)
        +String path
        +DateTime timestamp
        +i64 size
        +String manifest_hash
    }
    
    Note "1" --> "0..*" Attachment : has
    Note "0..*" --> "0..1" Collection : belongs to
    Note "1" --> "0..*" Reminder : has
    
    style Note fill:#e3f2fd
    style Attachment fill:#fff3e0
    style Collection fill:#f3e5f5
    style Reminder fill:#e8f5e9
    style Backup fill:#fce4ec
```

### Data Model Insights

| Model | Purpose | Key Fields | Storage Location |
|-------|---------|-----------|-----------------|
| **Note** | Core entity | `content_json` (Quill Delta) | SQLite `notes` table |
| **Attachment** | File linked to note | `blob_hash` (SHA-256) | SQLite + blob files |
| **Collection** | Folder/tag | `sort_order` | SQLite `collections` table |
| **Reminder** | Time-based alert | `trigger_time`, `triggered`, notification settings | SQLite `reminders` table |
| **Backup** | Snapshot | `manifest_hash` | SQLite + ZIP file |

**Why JSON for content?**  
Quill uses the Delta format—a structured representation of rich text. Storing as JSON lets us query and index text while preserving formatting.

**Why SHA-256 for blobs?**  
Content-addressed storage. If two notes have the same image, we store it once. Hash = fingerprint.

---

## Directory Structure

Where does everything live?

```
SwatNotes/
├── src/                          # Frontend (TypeScript)
│   ├── main.ts                   # App entry point
│   ├── types.ts                  # TypeScript interfaces
│   ├── config.ts                 # Frontend configuration
│   ├── components/               # UI components
│   │   ├── noteEditor.ts         # Quill integration
│   │   └── notesList.ts          # Note list rendering
│   ├── utils/                    # API wrappers
│   │   ├── notesApi.ts           # Notes CRUD
│   │   ├── backupApi.ts          # Backup operations
│   │   ├── attachmentsApi.ts     # Attachment handling
│   │   ├── collectionsApi.ts     # Collections CRUD
│   │   ├── remindersApi.ts       # Reminders CRUD
│   │   └── updateApi.ts          # Auto-update checks
│   ├── events/
│   │   └── handlers.ts           # Event handlers
│   ├── ui/
│   │   ├── backup.ts             # Backup UI logic
│   │   └── theme.ts              # Theme management
│   ├── state/
│   │   └── appState.ts           # Global state
│   └── styles/
│       └── main.css              # Tailwind + DaisyUI
│
├── src-tauri/                    # Rust Backend
│   ├── src/
│   │   ├── main.rs               # Entry point
│   │   ├── lib.rs                # Public library
│   │   ├── app.rs                # AppState setup
│   │   ├── config.rs             # Backend configuration
│   │   ├── commands/             # Tauri commands
│   │   │   ├── mod.rs            # Command exports
│   │   │   ├── notes.rs          # Note commands
│   │   │   ├── backup.rs         # Backup commands
│   │   │   ├── attachments.rs    # Attachment commands
│   │   │   ├── collections.rs    # Collection commands
│   │   │   ├── reminders.rs      # Reminder commands
│   │   │   ├── settings.rs       # Settings commands
│   │   │   ├── windows.rs        # Window management
│   │   │   └── updater.rs        # Auto-update commands
│   │   ├── services/             # Business logic
│   │   │   ├── mod.rs            # Service exports
│   │   │   ├── notes.rs          # NotesService
│   │   │   ├── backup.rs         # BackupService
│   │   │   ├── attachments.rs    # AttachmentsService
│   │   │   ├── reminders.rs      # RemindersService
│   │   │   ├── settings.rs       # SettingsService
│   │   │   └── scheduler.rs      # SchedulerService
│   │   ├── database/             # Data layer
│   │   │   ├── schema.rs         # Migrations
│   │   │   ├── repository.rs     # SQL operations
│   │   │   └── models.rs         # Data models
│   │   ├── storage/
│   │   │   └── blob_store.rs     # File storage
│   │   ├── crypto.rs             # Encryption
│   │   └── error.rs              # Error types
│   ├── Cargo.toml                # Rust dependencies
│   └── tauri.conf.json           # Tauri config
│
├── public/                       # Static assets
├── dist/                         # Built frontend (generated)
├── target/                       # Compiled Rust (generated)
│
└── docs/                         # This book!
    ├── README.md
    ├── SUMMARY.md
    ├── PROGRESS.md
    └── chapters/
        ├── 00-the-map.md
        ├── 01-first-principles.md
        └── ...
```

**Mental Model**: Think of `src/` as the **skin** (what users see) and `src-tauri/` as the **organs** (what does the work).

---

## App Data Directory

At runtime, SwatNotes stores data in:

- **Windows**: `C:\Users\<user>\AppData\Roaming\swatnotes\`

Inside this directory:

```
swatnotes/
├── db.sqlite              # Main database
├── db.sqlite-wal          # Write-Ahead Log (SQLite)
├── db.sqlite-shm          # Shared memory (SQLite)
├── blobs/                 # Content-addressed files
│   ├── ab/
│   │   └── cd/
│   │       └── abcd1234...ef (SHA-256 hash as filename)
├── backups/               # Encrypted ZIP files
│   ├── backup_2026-01-27_143022.zip
│   └── ...
└── logs/
    └── swatnotes.log      # Application logs
```

**Why this structure?**
- SQLite WAL mode = better concurrency and crash safety
- Blob sharding (`ab/cd/`) = avoids filesystem limits (too many files in one folder)
- Separate backups folder = easy to browse/copy

---

## Communication Patterns

### 1. Frontend → Backend (Commands)

```mermaid
sequenceDiagram
    participant TS as TypeScript
    participant IPC as Tauri IPC
    participant Rust as Rust Command
    
    TS->>IPC: invoke('create_note', {title, content})
    IPC->>Rust: create_note(state, title, content)
    Rust->>Rust: Business logic
    Rust-->>IPC: Result<Note, AppError>
    IPC-->>TS: Promise<Note>
    
    Note over TS,Rust: Strongly typed both sides
```

**Key Points**:
- Frontend **calls** backend (never the other way)
- All calls are **async** (use `await`)
- Type-safe: TypeScript types match Rust structs

### 2. Backend → Frontend (Events)

```mermaid
sequenceDiagram
    participant Rust as Rust Service
    participant IPC as Tauri IPC
    participant TS as TypeScript Listener
    
    Rust->>IPC: emit('reminder-triggered', {note_id})
    IPC->>TS: Event payload
    TS->>TS: Handle event (show notification)
    
    Note over Rust,TS: Push model for notifications
```

**When to use**:
- Background tasks (reminders, auto-backup)
- Server-initiated updates
- Progress reporting (e.g., download progress)

---

## Error Flow

Errors can happen anywhere. Here's how they propagate:

```mermaid
graph TD
    UserAction["User Action"]
    Frontend["Frontend (TypeScript)"]
    Command["Tauri Command"]
    Service["Service Layer"]
    Repository["Repository"]
    DB["SQLite"]
    
    UserAction -->|"Click 'Save'"| Frontend
    Frontend -->|"invoke('update_note')"| Command
    Command -->|"service.update_note()"| Service
    Service -->|"repo.update_note()"| Repository
    Repository -->|"SQL UPDATE"| DB
    
    DB -.->|"❌ UNIQUE constraint failed"| Repository
    Repository -.->|"Err(DatabaseError)"| Service
    Service -.->|"Err(AppError)"| Command
    Command -.->|"Err(serialized)"| Frontend
    Frontend -.->|"Show alert"| UserAction
    
    style DB fill:#ffe1e1
    style UserAction fill:#e1f5ff
```

**Error Handling Rules**:
1. **Rust**: Use `Result<T, AppError>` everywhere
2. **Never panic** in production code
3. **Log** errors at the boundary
4. **Convert** to user-friendly messages in frontend

---

## Concurrency Model

SwatNotes uses **async Rust** with Tokio:

```mermaid
graph TD
    subgraph "Main Thread"
        UI["UI (Single-threaded)"]
    end
    
    subgraph "Tokio Runtime (Thread Pool)"
        Task1["Database Query"]
        Task2["File I/O"]
        Task3["Encryption"]
        Task4["Network Request<br/>(Update Check)"]
    end
    
    subgraph "Background Scheduler"
        Cron["Cron Job<br/>(Reminders)"]
    end
    
    UI -->|"spawn async task"| Task1
    UI -->|"spawn async task"| Task2
    Task1 -.->|"await"| UI
    Task2 -.->|"await"| UI
    
    Cron -->|"every 60s"| Task1
    
    style UI fill:#e1f5ff
    style Task1 fill:#fff4e1
    style Task2 fill:#fff4e1
    style Task3 fill:#fff4e1
    style Task4 fill:#fff4e1
    style Cron fill:#ffe1e1
```

**Mental Model**:
- Think of async as "waiting without blocking"
- Like ordering food: you don't stand at the counter waiting—you sit down and they call you
- Tokio manages the "waiters" (threads) efficiently

---

## Security Boundaries

Where security matters:

```mermaid
graph LR
    subgraph "Untrusted Zone"
        User["User Input"]
        Clipboard["Clipboard Data"]
        Files["Dropped Files"]
    end
    
    subgraph "Trusted Zone"
        Validation["Input Validation<br/>(commands layer)"]
        Sanitization["SQL Parameterization<br/>(SQLx)"]
        Encryption["AES-256-GCM<br/>(backups)"]
    end
    
    subgraph "Storage"
        DB[(Encrypted Backups)]
        Plaintext[(Plaintext DB)]
    end
    
    User --> Validation
    Clipboard --> Validation
    Files --> Validation
    
    Validation --> Sanitization
    Sanitization --> Plaintext
    
    Validation --> Encryption
    Encryption --> DB
    
    style "Untrusted Zone" fill:#ffe1e1
    style "Trusted Zone" fill:#fff4e1
    style Storage fill:#e1ffe1
```

**Security Principles**:
1. **Never trust user input** (validate everything)
2. **Use parameterized queries** (prevent SQL injection)
3. **Encrypt backups** (but not the working DB—trade-off for speed)
4. **Store passwords in OS keyring** (never in DB)

---

## Build and Runtime Flow

How does code become an app?

```mermaid
graph TD
    subgraph Development
        TSSrc["TypeScript Source<br/>(src/)"]
        RustSrc["Rust Source<br/>(src-tauri/src/)"]
    end
    
    subgraph Build
        Vite["Vite Build<br/>(bundles JS/CSS)"]
        Cargo["Cargo Build<br/>(compiles Rust)"]
    end
    
    subgraph Output
        Dist["dist/<br/>(HTML/JS/CSS)"]
        Binary["swatnotes.exe<br/>(Native Binary)"]
    end
    
    subgraph Runtime
        WebView["WebView"]
        RustRuntime["Rust Runtime"]
    end
    
    subgraph Package
        Installer["Installer<br/>(MSI/DMG/DEB)"]
    end
    
    TSSrc -->|"npm run build"| Vite
    Vite --> Dist
    
    RustSrc -->|"cargo build --release"| Cargo
    Cargo --> Binary
    
    Dist --> WebView
    Binary --> RustRuntime
    WebView <-->|IPC| RustRuntime
    
    Dist --> Installer
    Binary --> Installer
    
    style Development fill:#e3f2fd
    style Build fill:#fff3e0
    style Output fill:#f3e5f5
    style Runtime fill:#e8f5e9
    style Package fill:#fce4ec
```

**Development vs Production**:
- **Dev**: Hot-reload, unoptimized, debug logs
- **Prod**: Minified JS, optimized Rust (LTO), stripped binaries

---

## What's Next?

You now have the map. You know:

✅ What SwatNotes does  
✅ How the pieces connect  
✅ Where data flows  
✅ Which technologies we use  

Next steps:

1. **Chapter 1**: Learn Rust fundamentals with real-life analogies
2. **Chapter 2**: Set up your environment
3. **Chapter 3**: Build your first Tauri command

Keep this chapter open in another tab. You'll reference these diagrams constantly.

---

## Quick Reference: The Layers

| Layer | Purpose | Example Files | Language |
|-------|---------|--------------|----------|
| **UI** | User interface | `noteEditor.ts`, `main.css` | TypeScript, CSS |
| **API Wrappers** | Type-safe calls to backend | `notesApi.ts` | TypeScript |
| **Commands** | Thin HTTP-like handlers | `commands/notes.rs` | Rust |
| **Services** | Business logic | `services/notes.rs` | Rust |
| **Repository** | Data access | `database/repository.rs` | Rust |
| **Storage** | Persistence | SQLite, files | SQL, binary |

**Mantra**: *UI knows nothing about storage. Storage knows nothing about UI. Services coordinate.*

---

[Next: Chapter 1 - First Principles →](01-first-principles.md)
