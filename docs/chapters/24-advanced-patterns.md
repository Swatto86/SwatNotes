# Chapter 24: Advanced Patterns

*Custom plugins, IPC patterns, and advanced Rust techniques*

Think of advanced patterns as the difference between someone who can drive a car and someone who understands suspension tuning, weight distribution, and racing lines. The basics work fine, but mastery comes from understanding deeper patterns. This chapter explores the sophisticated techniques that separate hobbyist code from production-grade desktop applications.

We'll examine patterns you've already been using throughout SwatNotes—derive macros, trait implementations, Tauri's plugin system, IPC event patterns, and builder APIs. By understanding these patterns explicitly, you'll recognize when to reach for them in your own features and how to compose them effectively.

## The Architecture of Extension

A well-designed application is like a Swiss Army knife—not because it does everything at once, but because it provides clean extension points. You want to add features without rewriting core logic, integrate external capabilities without tight coupling, and evolve the system without breaking existing functionality.

### What Makes Code "Extensible"

Consider SwatNotes' reminder system. When a reminder fires, it needs to:
- Open or focus the note window
- Apply visual effects (shake, glow)
- Play a sound (if enabled)
- Track which window was last focused

This could have been one giant function with all logic hardcoded. Instead, it uses:

1. **Plugin architecture**: Tauri plugins for global shortcuts, notifications
2. **Event system**: Decoupled communication between Rust and TypeScript
3. **Trait derivation**: Automatic serialization, cloning, error handling
4. **Builder patterns**: Fluent window creation APIs

Each pattern addresses a specific extensibility challenge:
- **Plugins**: Add capabilities without modifying core code
- **Events**: Communicate without direct dependencies
- **Traits**: Define behavior contracts, get implementations for free
- **Builders**: Configure complex objects step-by-step

Let's examine each pattern in depth.

## The Trait System: Contracts and Automatic Implementation

Rust's trait system is its secret weapon. Traits define *what* something can do without specifying *how* it does it. Think of them as interfaces with superpowers—they support default implementations, automatic derivation, and compile-time polymorphism.

### Derive Macros: Getting Implementations for Free

The simplest way to use traits is with `#[derive]`, which generates implementations automatically:

```rust
// From src-tauri/src/services/settings.rs
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HotkeySettings {
    pub new_note: String,
    pub toggle_note: String,
    pub open_search: String,
    pub open_settings: String,
    pub toggle_all_notes: String,
    pub quick_capture: String,
}
```

This single line generates:
- **Debug**: Format for `{:?}` debug printing
- **Clone**: Deep copy of the struct
- **Serialize**: Convert to JSON/other formats
- **Deserialize**: Parse from JSON/other formats

Without `#[derive]`, you'd write ~50 lines of boilerplate per struct. With it, the compiler generates optimal implementations automatically.

**When each trait is useful:**

| Trait | Use Case | Generated Behavior |
|-------|----------|-------------------|
| `Clone` | Share data across threads/services | Deep copy of all fields |
| `Debug` | Logging, error messages | Human-readable format |
| `Serialize` | Send to frontend, save to disk | Convert to JSON/bytes |
| `Deserialize` | Receive from frontend, load from disk | Parse from JSON/bytes |
| `PartialEq` | Compare instances, tests | Field-by-field equality |
| `Default` | Construct with sensible defaults | Zero/empty/false values |

### AppState: The Clone Pattern

SwatNotes' central state uses `Clone` with Arc-wrapped services:

```rust
// From src-tauri/src/app.rs
#[derive(Clone)]
pub struct AppState {
    pub notes_service: NotesService,
    pub attachments_service: AttachmentsService,
    pub backup_service: BackupService,
    pub reminders_service: RemindersService,
    pub settings_service: SettingsService,
    pub scheduler_service: Option<Arc<SchedulerService>>,
    pub last_focused_note_window: Arc<Mutex<Option<String>>>,
}
```

**Why `Clone` matters here:**

1. **Tauri commands** need `State<AppState>`, which requires `Clone`
2. **Cloning is cheap**: Each service is already `Arc<Mutex<...>>` internally
3. **No data duplication**: Cloning an `Arc` just increments a reference count (5 CPU cycles)

When you call `state.notes_service.clone()` in a command:
- Original Arc pointer: `0x7f8a4c001000`
- Cloned Arc pointer: `0x7f8a4c001000` (same!)
- Reference count: 1 → 2

The actual `NotesService` data exists only once. You're just creating another handle to it.

### Custom Trait Implementations: Domain Logic

Sometimes you need custom behavior beyond what `#[derive]` provides. SwatNotes implements standard traits for domain types:

#### The Default Trait: Sensible Defaults

```rust
// From src-tauri/src/services/settings.rs
impl Default for HotkeySettings {
    fn default() -> Self {
        Self {
            new_note: "CommandOrControl+Shift+N".to_string(),
            toggle_note: "CommandOrControl+Shift+T".to_string(),
            open_search: "CommandOrControl+Shift+S".to_string(),
            open_settings: "CommandOrControl+Shift+,".to_string(),
            toggle_all_notes: "CommandOrControl+Shift+A".to_string(),
            quick_capture: "CommandOrControl+Shift+C".to_string(),
        }
    }
}
```

**Why not use `#[derive(Default)]`?**

Derived Default gives you empty strings. Custom implementation gives *sensible* defaults. First-time users get working hotkeys immediately instead of having to configure everything.

#### The FromStr Trait: String Parsing

```rust
// From src-tauri/src/services/scheduler.rs
impl FromStr for BackupFrequency {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "daily" => Ok(BackupFrequency::Days(1)),
            "weekly" => Ok(BackupFrequency::Days(7)),
            "monthly" => Ok(BackupFrequency::Days(30)),
            s if s.starts_with("days(") && s.ends_with(')') => {
                let num_str = &s[5..s.len() - 1];
                num_str
                    .parse::<u32>()
                    .map(BackupFrequency::Days)
                    .map_err(|_| format!("Invalid days value: {}", num_str))
            }
            _ => Err(format!("Unknown backup frequency: {}", s)),
        }
    }
}
```

**Why this matters:**

Now you can parse backup frequencies from user settings files:

```rust
let frequency: BackupFrequency = settings.frequency.parse()?;
// "weekly" becomes BackupFrequency::Days(7)
// "days(14)" becomes BackupFrequency::Days(14)
```

Standard library traits (`FromStr`, `Display`, `From`, `TryFrom`) integrate your types seamlessly with Rust's ecosystem.

#### The Serialize Trait: Custom Serialization

```rust
// From src-tauri/src/error.rs
impl serde::Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}
```

**Why custom serialization?**

AppError implements `std::error::Error`, which isn't serializable by default. When Tauri sends errors to the frontend, they need JSON representation. This custom implementation serializes errors as strings:

```rust
// Rust error
AppError::Database(DatabaseError::NotFound("note-123"))

// JSON sent to frontend
"Note not found: note-123"
```

Frontend gets clean error messages without internal implementation details.

### The thiserror Crate: Automatic Error Implementation

Error handling in Rust requires implementing `std::error::Error`, `Display`, and `Debug`. The `thiserror` crate automates this:

```rust
// From src-tauri/src/error.rs
use thiserror::Error;

#[derive(Error, Debug)]
pub enum AppError {
    #[error("Database error: {0}")]
    Database(#[from] crate::storage::DatabaseError),

    #[error("Blob store error: {0}")]
    BlobStore(#[from] crate::storage::BlobStoreError),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("{0}")]
    Generic(String),
}
```

**What `#[derive(Error)]` generates:**

1. **Error trait implementation**: Makes this a proper Rust error
2. **Display implementation**: Uses `#[error("...")]` format strings
3. **Automatic conversions**: `#[from]` generates `From` implementations

**Why `#[from]` is powerful:**

```rust
// Without #[from], you'd write:
impl From<DatabaseError> for AppError {
    fn from(err: DatabaseError) -> Self {
        AppError::Database(err)
    }
}

// With #[from], the compiler generates this automatically
// You get automatic error conversions with ?
fn some_function() -> Result<(), AppError> {
    let note = repo.get_note(id).await?; // DatabaseError auto-converts to AppError
    Ok(())
}
```

**Mental model**: Think of `#[from]` as saying "this error variant can be created automatically from another error type." The compiler handles the plumbing.

## Tauri's Plugin Architecture

Plugins extend Tauri's capabilities without modifying core code. Think of them as Rust's version of NPM packages—composable, reusable, maintained by the community.

### Official Plugins in SwatNotes

```rust
// From src-tauri/src/main.rs
fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .setup(|app| {
            crate::app::setup(app)?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

**What each plugin provides:**

| Plugin | Capability | Used For |
|--------|-----------|----------|
| `global-shortcut` | System-wide keyboard shortcuts | Ctrl+Shift+N anywhere triggers new note |
| `notification` | System notifications | Reminder alerts (native OS notifications) |
| `dialog` | File pickers, alerts | "Import backup" file selection |
| `fs` | Safe file operations | Reading/writing files with permissions |
| `shell` | Run external commands | Open files in default application |
| `clipboard-manager` | Clipboard access | Quick capture from clipboard hotkey |

### Using Plugins: Global Shortcuts

Here's how the global shortcut plugin integrates into SwatNotes:

```rust
// From src-tauri/src/app.rs
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};

fn setup_global_hotkeys(app: &mut App) -> Result<()> {
    let state: tauri::State<AppState> = app.state();
    let hotkeys = /* load from settings */;

    // Register hotkey for creating new sticky notes
    let new_note_shortcut = hotkeys.new_note.clone();
    app.global_shortcut()
        .on_shortcut(new_note_shortcut.as_str(), move |app, _shortcut, event| {
            if event.state == ShortcutState::Pressed {
                tracing::info!("New note hotkey triggered");

                let app_handle = app.clone();
                tauri::async_runtime::spawn(async move {
                    if let Err(e) = crate::commands::create_new_sticky_note(
                        app_handle.clone(),
                        app_handle.state(),
                    )
                    .await
                    {
                        tracing::error!("Failed to create sticky note from hotkey: {}", e);
                    }
                });
            }
        })?;

    Ok(())
}
```

**Pattern breakdown:**

1. **Extension trait**: `GlobalShortcutExt` adds `.global_shortcut()` to `App`
2. **Closure callback**: Handler is a closure capturing `app` handle
3. **Event filtering**: Only act on `ShortcutState::Pressed` (ignore release)
4. **Async spawning**: Long-running work happens on async runtime

**Why plugins over direct implementation:**

- **Cross-platform**: Plugin handles Windows/macOS/Linux differences
- **Maintained**: Updates for new OS versions handled by plugin authors
- **Security**: Tauri's permission system controls what plugins can access
- **Isolation**: Plugin bugs don't crash your app

### Plugin Pattern: Builder APIs

Notice the `.on_shortcut()` method? It both *registers* the shortcut and *sets up* the handler in one call. This is a builder pattern:

```rust
// Conceptual implementation (simplified)
impl GlobalShortcut {
    pub fn on_shortcut<F>(
        &self,
        shortcut: &str,
        handler: F,
    ) -> Result<()>
    where
        F: Fn(&AppHandle, &Shortcut, &ShortcutEvent) + Send + Sync + 'static,
    {
        // 1. Parse shortcut string
        let parsed = parse_shortcut(shortcut)?;
        
        // 2. Register with OS
        register_with_os(parsed)?;
        
        // 3. Store handler for when shortcut fires
        self.handlers.lock().unwrap().insert(shortcut.to_string(), Box::new(handler));
        
        Ok(())
    }
}
```

One method call does multiple steps. Compare to a non-builder approach:

```rust
// Non-builder (hypothetical)
let shortcut = parse_shortcut("CommandOrControl+Shift+N")?;
global_shortcut.register(shortcut)?;
global_shortcut.set_handler(shortcut, |app, event| { /* ... */ })?;
```

Builder APIs reduce boilerplate and enforce correct ordering (can't set handler before registering).

## The Event System: Decoupled Communication

Events are SwatNotes' nervous system—they let Rust and TypeScript communicate without knowing about each other. Think of events as radio broadcasts: anyone can tune in, no direct connections required.

### The Emitter Trait: Sending Events

```rust
// From src-tauri/src/services/reminders.rs
use tauri::{AppHandle, Emitter};

#[derive(Debug, Clone, serde::Serialize)]
struct ReminderEvent {
    reminder_id: String,
    note_id: String,
    note_title: String,
    sound_enabled: bool,
    sound_type: String,
    shake_enabled: bool,
    glow_enabled: bool,
}

async fn send_notification(&self, reminder: &Reminder) {
    let handle = /* get AppHandle */;
    
    // Create custom event payload
    let reminder_event = ReminderEvent {
        reminder_id: reminder.id.clone(),
        note_id: reminder.note_id.clone(),
        note_title: note.title.clone(),
        sound_enabled: reminder.sound_enabled,
        sound_type: reminder.sound_type.clone(),
        shake_enabled: reminder.shake_enabled,
        glow_enabled: reminder.glow_enabled,
    };

    // Emit to all windows
    if let Err(e) = handle.emit("reminder-triggered", reminder_event.clone()) {
        tracing::error!("Failed to emit reminder event: {}", e);
    }
}
```

**Event flow:**

1. **Rust creates event**: `ReminderEvent` struct with all data frontend needs
2. **Serialization**: serde converts to JSON automatically
3. **Broadcast**: `emit()` sends to all windows in the app
4. **TypeScript receives**: Event listeners get the JSON payload

**Why this pattern works:**

- **No coupling**: Rust doesn't know what frontend does with events
- **Multiple listeners**: Main window updates UI, note windows shake
- **Typed data**: Rust ensures all required fields are present
- **Error handling**: Failed emit is logged but doesn't crash sender

### Listening to Events: TypeScript Side

```typescript
// From src/sticky-note.ts
import { getCurrentWindow } from '@tauri-apps/api/window';

const currentWindow = getCurrentWindow();

// Listen for window-specific events
currentWindow.listen('toggle-note-window', async () => {
  if (await currentWindow.isVisible()) {
    await currentWindow.hide();
  } else {
    await currentWindow.show();
    await currentWindow.setFocus();
  }
});

// Listen for focus events (built-in Tauri event)
currentWindow.listen('tauri://focus', () => {
  // Update last focused window in Rust state
  invoke('set_last_focused_note_window', {
    windowLabel: currentWindow.label,
  });
});
```

**Event types:**

1. **Custom events**: `toggle-note-window`, `reminder-triggered` (defined by your app)
2. **Tauri built-in**: `tauri://focus`, `tauri://blur`, `tauri://close-requested`

**Pattern: Window-specific listeners**

Each note window listens for its own events. When global shortcut fires, Rust:
1. Determines which window to toggle (last focused)
2. Emits `toggle-note-window` to that specific window
3. Window receives event and shows/hides itself

**This is better than direct control because:**
- Window manages its own state (visible/hidden)
- No race conditions (window knows its current state)
- Composable (any component can listen to events)

### Bidirectional IPC: Commands and Events

SwatNotes uses two IPC mechanisms:

```
Frontend → Backend: Tauri Commands (invoke)
Backend → Frontend: Events (emit + listen)
```

**Commands (invoke):**

```typescript
// From src/utils/notesApi.ts
import { invoke } from '@tauri-apps/api/core';

export async function createNote(title: string, content: string): Promise<Note> {
  return invoke<Note>('create_note', { title, content });
}
```

**Pattern:**
- Synchronous request/response
- Frontend waits for Rust to return
- Typed return value (TypeScript knows it's a `Note`)
- Error propagation (Rust errors become TypeScript exceptions)

**Events (emit/listen):**

```typescript
// From src/events/handlers.ts
import { emit, listen } from '@tauri-apps/api/event';

// Frontend emits
await emit('refresh-notes');

// Main window listens
await listen('reminder-triggered', (event) => {
  const { note_id, note_title, sound_enabled } = event.payload;
  // Update UI with reminder data
});
```

**Pattern:**
- Asynchronous broadcast
- No return value
- Multiple listeners possible
- Fire-and-forget (sender doesn't wait)

**When to use each:**

| Use Commands When | Use Events When |
|-------------------|-----------------|
| Need return value | Broadcasting changes |
| Require confirmation | Pushing updates to UI |
| Request/response flow | Decoupled components |
| Single recipient | Multiple listeners |

### Custom Event Types: Type Safety Across the Boundary

Notice how `ReminderEvent` is a Rust struct that gets serialized to JSON for TypeScript:

```rust
// Rust side
#[derive(Debug, Clone, serde::Serialize)]
struct ReminderEvent {
    reminder_id: String,
    note_id: String,
    sound_enabled: bool,
    // ...
}
```

```typescript
// TypeScript side (manual type definition)
interface ReminderEvent {
  reminder_id: string;
  note_id: string;
  sound_enabled: boolean;
  // ...
}
```

**Best practice**: Keep TypeScript types synchronized with Rust structs manually or use codegen tools like `ts-rs` or `typeshare`.

**Why custom event types matter:**

1. **Type safety**: Both sides know the shape of data
2. **Documentation**: Event payload structure is self-documenting
3. **Validation**: Rust compiler ensures all fields are present
4. **Evolution**: Add fields without breaking existing listeners (use `Option<T>` for new fields)

## Builder Patterns: Fluent Configuration

Builders let you configure complex objects step-by-step with a readable, chainable API. Tauri uses this extensively for windows.

### Window Builder Pattern

```rust
// From src-tauri/src/commands/windows.rs
use tauri::{WebviewUrl, WebviewWindowBuilder};

pub fn create_or_focus_window(app: &tauri::AppHandle, config: WindowConfig) -> Result<bool> {
    let _window = WebviewWindowBuilder::new(
        app,
        &config.label,
        WebviewUrl::App(config.url.into())
    )
    .title(&config.title)
    .inner_size(config.width, config.height)
    .min_inner_size(config.min_width, config.min_height)
    .resizable(true)
    .decorations(true)
    .center()
    .visible(false)  // Hidden until content loads
    .background_color(WINDOW_BACKGROUND_COLOR)  // Prevent white flash
    .build()?;

    Ok(true)
}
```

**Builder anatomy:**

1. **Constructor**: `WebviewWindowBuilder::new(...)` - required parameters
2. **Configuration methods**: `.title()`, `.inner_size()`, etc. - optional settings
3. **Terminal method**: `.build()` - consumes builder, creates window

**Why builders are better than constructors:**

```rust
// Without builder (hypothetical)
let window = WebviewWindow::new(
    app,
    "note-123",
    "sticky-note.html",
    "My Note",           // title
    400.0,               // width
    500.0,               // height
    300.0,               // min_width
    200.0,               // min_height
    true,                // resizable
    true,                // decorations
    true,                // center
    false,               // visible
    WINDOW_BACKGROUND_COLOR, // background
)?;
```

**Problems with constructor approach:**

- Parameter order matters (easy to mix up width/height)
- All parameters required (can't omit optional ones)
- Unreadable (what is `true`? `false`?)
- Brittle (adding parameter breaks all call sites)

**Builder advantages:**

- Named methods (`.resizable(true)` is self-documenting)
- Optional parameters (only specify what you need)
- Type safety (can't pass width where height expected)
- Future-proof (new options don't break existing code)

### Tray Icon Builder

```rust
// From src-tauri/src/app.rs
use tauri::tray::TrayIconBuilder;

let icon = app.default_window_icon()
    .ok_or_else(|| AppError::Generic("No default window icon found".into()))?;

let _tray = TrayIconBuilder::new()
    .icon(icon.clone())
    .menu(&menu)
    .on_menu_event(|app, event| {
        match event.id.as_ref() {
            "show" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            "new_note" => {
                tauri::async_runtime::spawn(async move {
                    // Handle new note creation
                });
            }
            "quit" => {
                std::process::exit(0);
            }
            _ => {}
        }
    })
    .build(app)?;
```

**Pattern: Event handlers in builders**

The `.on_menu_event()` method takes a closure that handles all menu clicks. This is cleaner than:

```rust
// Without builder (hypothetical)
tray.set_menu(menu);
tray.set_click_handler(|app, id| { /* ... */ });
```

**Builder pattern checklist:**

- ✅ Starts with `::new()` or `::default()`
- ✅ Methods return `Self` for chaining
- ✅ Ends with `.build()` that consumes builder
- ✅ Required params in constructor, optional in methods
- ✅ Type state pattern (enforce ordering at compile time)

### Custom Builders: The WindowConfig Pattern

SwatNotes creates a custom config struct for window creation:

```rust
// From src-tauri/src/commands/windows.rs
pub struct WindowConfig {
    pub label: String,
    pub url: &'static str,
    pub title: String,
    pub width: f64,
    pub height: f64,
    pub min_width: f64,
    pub min_height: f64,
}
```

**Why a config struct instead of builder?**

Sometimes you need to compute configuration before building. A config struct:
- Can be constructed conditionally
- Can be passed between functions
- Can be stored/validated before building

**Usage:**

```rust
let config = WindowConfig {
    label: format!("note-{}", note_id),
    url: "sticky-note.html",
    title: note.title.clone(),
    width: config::STICKY_NOTE_DEFAULT_WIDTH,
    height: config::STICKY_NOTE_DEFAULT_HEIGHT,
    min_width: config::STICKY_NOTE_MIN_WIDTH,
    min_height: config::STICKY_NOTE_MIN_HEIGHT,
};

create_or_focus_window(app, config)?;
```

**Pattern: Configuration object + builder function**

This hybrid approach gives you:
- Named parameters (struct fields)
- Validation before building (check config validity)
- Reusability (same config for multiple windows)

## Arc Patterns: Sharing State Safely

SwatNotes uses `Arc` (Atomic Reference Counting) extensively for sharing state across async tasks and threads. Understanding when to use `Arc`, `Arc<Mutex<T>>`, or `Arc<RwLock<T>>` is crucial.

### Arc Alone: Immutable Shared Data

```rust
// From src-tauri/src/services/scheduler.rs
pub struct SchedulerService {
    scheduler: Arc<RwLock<JobScheduler>>,
    backup_service: Arc<BackupService>,  // ← Just Arc, no Mutex
    current_job_id: Arc<RwLock<Option<Uuid>>>,
}
```

**Why `Arc<BackupService>` without Mutex?**

`BackupService` is already `Clone` and its methods take `&self` (immutable reference). The Arc just allows multiple async tasks to hold references:

```rust
let backup_service_clone = self.backup_service.clone();
tauri::async_runtime::spawn(async move {
    // This task has its own Arc reference
    backup_service_clone.create_backup().await;
});
```

**Mental model**: Arc is like a shared smart pointer. Clone creates new pointer to same data, reference count increases. When last pointer drops, data is freed.

### Arc<Mutex<T>>: Mutable Shared Data

```rust
// From src-tauri/src/app.rs
pub struct AppState {
    pub last_focused_note_window: Arc<Mutex<Option<String>>>,
}
```

**Why Mutex?**

Multiple commands might read/write the last focused window:

```rust
// Command 1: Set focused window
{
    let mut last_focused = state.last_focused_note_window.lock().unwrap();
    *last_focused = Some("note-123".to_string());
} // Mutex unlocked here

// Command 2: Get focused window (different async task)
{
    let last_focused = state.last_focused_note_window.lock().unwrap();
    if let Some(label) = last_focused.as_ref() {
        // Use label
    }
} // Mutex unlocked here
```

**Mutex guarantees:**
1. Only one task can access data at a time
2. Other tasks block until lock is released
3. No data races (Rust enforces this at compile time)

**Performance consideration:**

Mutex locks are ~20 nanoseconds on uncontended locks. Don't worry about performance unless you're locking thousands of times per second.

### Arc<RwLock<T>>: Many Readers, One Writer

```rust
// From src-tauri/src/services/scheduler.rs
pub struct SchedulerService {
    scheduler: Arc<RwLock<JobScheduler>>,
    current_job_id: Arc<RwLock<Option<Uuid>>>,
}
```

**Why RwLock instead of Mutex?**

The scheduler is read frequently (checking job status) but written rarely (scheduling new jobs):

```rust
// Many readers can read simultaneously
{
    let scheduler = self.scheduler.read().await;
    let next_run = scheduler.next_tick_for_job(job_id);
} // Read lock released

// Only one writer can write
{
    let mut scheduler = self.scheduler.write().await;
    scheduler.remove(job_id).await?;
} // Write lock released
```

**RwLock rules:**
- Multiple `.read()` locks can coexist
- `.write()` lock is exclusive (no other readers or writers)
- Writers wait for all readers to finish

**When to use RwLock:**
- Read-heavy workloads (10+ reads per write)
- Long critical sections (holding lock for milliseconds)
- Contention is expected

**When to use Mutex:**
- Write-heavy or mixed workloads
- Short critical sections (microseconds)
- Simpler than RwLock (less overhead)

### Arc<Mutex<Option<T>>>: Optional Shared State

```rust
// From src-tauri/src/services/reminders.rs
pub struct RemindersService {
    repo: Repository,
    app_handle: Arc<Mutex<Option<AppHandle>>>,
}

impl RemindersService {
    pub fn new(repo: Repository) -> Self {
        Self {
            repo,
            app_handle: Arc::new(Mutex::new(None)),  // Start with None
        }
    }

    pub async fn set_app_handle(&self, handle: AppHandle) {
        let mut app_handle = self.app_handle.lock().await;
        *app_handle = Some(handle);
    }
}
```

**Why `Option<AppHandle>`?**

The service is created before the app is fully initialized. AppHandle isn't available yet:

1. **Initialization**: Service created with `None`
2. **App startup**: AppHandle becomes available
3. **Injection**: `set_app_handle()` updates to `Some(handle)`
4. **Usage**: Methods check if handle is set

**Pattern: Late initialization**

```rust
async fn send_notification(&self) {
    let app_handle_guard = self.app_handle.lock().await;
    let handle = match app_handle_guard.as_ref() {
        Some(h) => h.clone(),
        None => {
            tracing::error!("App handle not set");
            return;
        }
    };
    drop(app_handle_guard);  // Release lock ASAP

    // Use handle outside the lock
    handle.emit("reminder-triggered", event)?;
}
```

**Why `drop(app_handle_guard)` explicitly?**

Locks should be held as briefly as possible. The guard holds the lock until it goes out of scope. By cloning the handle and dropping the guard immediately, we minimize lock contention.

### Arc Cloning: The Performance Story

Every `Arc::clone()` call:
1. Increments atomic reference count (~5 CPU cycles)
2. Creates new pointer to existing data
3. No memory allocation, no data copying

**Example cost analysis:**

```rust
let service = Arc::new(NotesService::new(repo));  // 1 allocation

let clone1 = service.clone();  // 5 CPU cycles, 0 allocations
let clone2 = service.clone();  // 5 CPU cycles, 0 allocations
let clone3 = service.clone();  // 5 CPU cycles, 0 allocations

drop(clone1);  // Decrement count
drop(clone2);  // Decrement count
drop(clone3);  // Decrement count
drop(service); // Count = 0, deallocate NotesService
```

**Total cost:** 1 allocation + 1 deallocation + ~20 CPU cycles (negligible).

**This is why AppState can derive Clone:** All fields are Arc-wrapped, so cloning the entire state is just a handful of atomic increments.

## Command Pattern: Async Rust ↔ Sync TypeScript

Tauri commands bridge asynchronous Rust with TypeScript. Understanding this boundary is key to avoiding deadlocks and performance issues.

### Async Commands: The Standard Pattern

```rust
// From src-tauri/src/commands/windows.rs
#[tauri::command]
pub async fn open_note_window(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    note_id: String,
) -> Result<()> {
    tracing::info!("Opening note window for note: {}", note_id);

    // Await database query
    let note = state.notes_service.get_note(&note_id).await?;
    let window_label = format!("note-{}", note_id);

    // Check if window exists
    if let Some(window) = app.get_webview_window(&window_label) {
        match window.is_visible() {
            Ok(_) => {
                let _ = window.show();
                let _ = window.set_focus();
                return Ok(());
            }
            Err(_) => {
                // Window exists but is invalid, will create new one
            }
        }
    }

    // Create new window
    let _window = WebviewWindowBuilder::new(
        &app,
        &window_label,
        WebviewUrl::App("sticky-note.html".into()),
    )
    .title(&note.title)
    // ... configuration
    .build()?;

    Ok(())
}
```

**TypeScript call:**

```typescript
await invoke('open_note_window', { noteId: 'note-123' });
```

**Async flow:**

1. TypeScript calls `invoke()` (non-blocking, returns Promise)
2. Tauri dispatches to Rust async runtime
3. Rust awaits database query (non-blocking)
4. Rust creates window (synchronous OS call)
5. Returns `Ok(())` or `Err(...)`
6. TypeScript Promise resolves or rejects

**Why async Rust matters:**

Without `async`, database query would block the entire command thread. With async, thousands of concurrent commands can run (each awaits I/O independently).

### Sync Commands: When to Avoid Async

```rust
#[tauri::command]
pub fn set_last_focused_note_window(
    state: State<'_, AppState>,
    window_label: String,
) -> Result<()> {
    tracing::info!("Setting last focused note window: {}", window_label);

    if let Ok(mut last_focused) = state.last_focused_note_window.lock() {
        *last_focused = Some(window_label);
    }

    Ok(())
}
```

**No `async` keyword:** This command doesn't await anything. The `Mutex::lock()` is synchronous (blocks until lock acquired).

**When to use sync commands:**

- No I/O operations (disk, network, database)
- Pure computation (hashing, parsing)
- In-memory state updates (quick mutex locks)

**When to use async commands:**

- Database queries (`await`)
- File operations (`tokio::fs`)
- Network requests
- Anything that might block >1ms

### Spawning Background Tasks from Commands

Sometimes a command needs to trigger long-running work without waiting:

```rust
#[tauri::command]
pub async fn create_new_sticky_note(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<()> {
    // Create note (waits for database)
    let note = state
        .notes_service
        .create_note("Untitled".to_string(), DEFAULT_CONTENT.to_string())
        .await?;

    // Emit event (non-blocking)
    if let Err(e) = app.emit("notes-list-changed", ()) {
        tracing::warn!("Failed to emit event: {}", e);
    }

    // Open window (returns immediately, don't wait for window to load)
    open_note_window(app, state, note.id).await?;

    Ok(())
}
```

**Pattern: Fire-and-forget events**

The `emit()` call sends an event but doesn't wait for listeners to process it. If emit fails (no windows listening), log a warning but don't fail the command.

**Why this matters:**

If emit blocked waiting for listeners, the command would be slower. Fire-and-forget keeps commands fast.

## Integration Patterns: Putting It All Together

Let's trace a complete user flow through SwatNotes to see how all these patterns compose.

### Flow: User Presses Ctrl+Shift+N (New Note Hotkey)

**Step 1: Global shortcut fires (Plugin)**

```rust
// From src-tauri/src/app.rs
app.global_shortcut()
    .on_shortcut("CommandOrControl+Shift+N", move |app, _shortcut, event| {
        if event.state == ShortcutState::Pressed {
            let app_handle = app.clone();  // Arc clone (~5 CPU cycles)
            tauri::async_runtime::spawn(async move {
                // Spawn async task to avoid blocking shortcut handler
                if let Err(e) = crate::commands::create_new_sticky_note(
                    app_handle.clone(),
                    app_handle.state(),
                )
                .await
                {
                    tracing::error!("Failed to create sticky note: {}", e);
                }
            });
        }
    })?;
```

**Patterns in use:**
- Plugin: `tauri_plugin_global_shortcut` handles OS integration
- Arc clone: AppHandle cloned cheaply for async task
- Async spawn: Work happens on async runtime, shortcut handler returns immediately

**Step 2: Create note command (Async Command)**

```rust
#[tauri::command]
pub async fn create_new_sticky_note(
    app: tauri::AppHandle,
    state: State<'_, AppState>,  // AppState derives Clone
) -> Result<()> {
    let note = state
        .notes_service  // Arc clone inside
        .create_note("Untitled".to_string(), DEFAULT_CONTENT.to_string())
        .await?;  // Await database insert

    app.emit("notes-list-changed", ())?;  // Event: notify main window

    open_note_window(app, state, note.id).await?;  // Builder pattern for window

    Ok(())
}
```

**Patterns in use:**
- State injection: Tauri provides `State<AppState>`, which clones on access
- Async command: `await` database operation without blocking
- Event emission: Fire-and-forget notification to frontend
- Error propagation: `?` converts errors to `AppError` via `#[from]`

**Step 3: Insert into database (Service Layer)**

```rust
// From NotesService (simplified)
impl NotesService {
    pub async fn create_note(&self, title: String, content: String) -> Result<Note> {
        let note = Note {
            id: Uuid::new_v4().to_string(),
            title,
            content,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };

        self.repo.insert_note(&note).await?;  // Repository pattern
        Ok(note)
    }
}
```

**Patterns in use:**
- Repository pattern: Service doesn't know database details
- UUID generation: Unique IDs without coordination
- Error propagation: Database errors convert to `AppError`

**Step 4: Create window (Builder Pattern)**

```rust
let _window = WebviewWindowBuilder::new(&app, &window_label, url)
    .title(&note.title)
    .inner_size(400.0, 500.0)
    .min_inner_size(300.0, 200.0)
    .visible(false)  // Hidden until content loads
    .background_color(WINDOW_BACKGROUND_COLOR)  // Prevent white flash
    .build()?;
```

**Patterns in use:**
- Builder: Fluent API for complex window configuration
- Error handling: `?` propagates window creation errors

**Step 5: Window loads, frontend initializes (IPC)**

```typescript
// sticky-note.ts
import { getCurrentWindow } from '@tauri-apps/api/window';
import { invoke } from '@tauri-apps/api/core';

const currentWindow = getCurrentWindow();

// Get note ID from window label
const noteId = currentWindow.label.replace('note-', '');

// Load note data
const note = await invoke<Note>('get_note', { id: noteId });

// Set up event listener
currentWindow.listen('toggle-note-window', async () => {
  if (await currentWindow.isVisible()) {
    await currentWindow.hide();
  } else {
    await currentWindow.show();
  }
});
```

**Patterns in use:**
- IPC command: TypeScript invokes Rust to fetch note
- Event listener: Window registers for toggle events
- Window API: TypeScript controls window visibility

**Step 6: User focuses window (Event Emission)**

```typescript
currentWindow.listen('tauri://focus', () => {
  invoke('set_last_focused_note_window', {
    windowLabel: currentWindow.label,
  });
});
```

**Backend handler:**

```rust
#[tauri::command]
pub fn set_last_focused_note_window(
    state: State<'_, AppState>,
    window_label: String,
) -> Result<()> {
    if let Ok(mut last_focused) = state.last_focused_note_window.lock() {
        *last_focused = Some(window_label);  // Arc<Mutex<Option<String>>>
    }
    Ok(())
}
```

**Patterns in use:**
- Built-in events: Tauri emits `tauri://focus` automatically
- Mutex: Safely update shared mutable state
- Arc: Multiple commands can access `last_focused_note_window`

### The Full Pattern Stack

Every feature in SwatNotes composes multiple patterns:

```
User Action (Ctrl+Shift+N)
    ↓
Global Shortcut Plugin
    ↓
Arc Clone (AppHandle)
    ↓
Async Spawn (Non-blocking)
    ↓
Tauri Command (create_new_sticky_note)
    ↓
State Clone (AppState)
    ↓
Service Method (Arc-wrapped NotesService)
    ↓
Repository Pattern (Database abstraction)
    ↓
Error Conversion (#[from] AppError)
    ↓
Event Emission (notes-list-changed)
    ↓
Builder Pattern (WebviewWindowBuilder)
    ↓
Window Creation
    ↓
Frontend Load
    ↓
IPC Command (get_note)
    ↓
Event Listener (toggle-note-window)
    ↓
Mutex Update (last_focused_note_window)
```

**Each pattern solves a specific problem:**

- **Plugins**: OS integration without platform code
- **Arc**: Share state across tasks cheaply
- **Async**: Non-blocking I/O at scale
- **Traits**: Reusable behavior contracts
- **Builders**: Readable configuration
- **Events**: Decoupled components
- **IPC**: Type-safe frontend ↔ backend

## Best Practices and Anti-Patterns

### Do: Derive Traits When Possible

```rust
// Good: Let compiler generate implementations
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Settings {
    theme: String,
    font_size: u32,
}
```

```rust
// Bad: Manual implementation (unless you need custom behavior)
impl Clone for Settings {
    fn clone(&self) -> Self {
        Self {
            theme: self.theme.clone(),
            font_size: self.font_size,
        }
    }
}
```

### Do: Use Arc for Immutable Sharing, Arc<Mutex> for Mutable

```rust
// Good: BackupService methods take &self, so Arc alone is fine
pub struct SchedulerService {
    backup_service: Arc<BackupService>,
}

// Good: Need mutable access, use Mutex
pub struct AppState {
    last_focused: Arc<Mutex<Option<String>>>,
}
```

```rust
// Bad: Unnecessary Mutex for read-only service
pub struct SchedulerService {
    backup_service: Arc<Mutex<BackupService>>,  // Mutex not needed!
}
```

### Do: Clone Arc Handles Before Spawning

```rust
// Good: Clone Arc before moving into async task
let service_clone = self.service.clone();
tauri::async_runtime::spawn(async move {
    service_clone.do_work().await;
});
```

```rust
// Bad: Try to move original Arc (compile error if you need it later)
tauri::async_runtime::spawn(async move {
    self.service.do_work().await;  // self.service moved!
});
// Can't use self.service here anymore
```

### Do: Use Events for Decoupling, Commands for Data Fetching

```rust
// Good: Event notifies of change
app.emit("notes-list-changed", ())?;

// Frontend decides what to do
listen('notes-list-changed', async () => {
    const notes = await invoke('list_notes');
    updateUI(notes);
});
```

```rust
// Bad: Backend directly updates frontend state (too coupled)
#[tauri::command]
fn update_frontend_state(app: AppHandle, notes: Vec<Note>) -> Result<()> {
    app.emit("set-notes-state", notes)?;  // Frontend tightly coupled to this event
    Ok(())
}
```

### Don't: Hold Mutex Locks Across Await Points

```rust
// Bad: Mutex held while awaiting (can deadlock)
let mut data = self.mutex.lock().unwrap();
data.value = some_async_operation().await;  // ← Lock held during await!
```

```rust
// Good: Release lock before awaiting
let new_value = some_async_operation().await;
let mut data = self.mutex.lock().unwrap();
data.value = new_value;  // Lock held briefly
```

**Why this matters:** If two tasks await while holding the same mutex, they deadlock waiting for each other.

### Don't: Use Arc<Mutex> for Everything

```rust
// Bad: Over-synchronization
pub struct AppState {
    notes_service: Arc<Mutex<NotesService>>,  // NotesService already has internal Mutex!
}
```

```rust
// Good: Arc alone if service is already thread-safe
pub struct AppState {
    notes_service: NotesService,  // NotesService = Arc<Mutex<Repository>> internally
}

#[derive(Clone)]
pub struct NotesService {
    repo: Arc<Mutex<Repository>>,  // Mutex where needed
}
```

**Principle**: Push Mutex to the lowest level that needs it. Don't wrap entire services in Mutex if only specific fields need synchronization.

### Don't: Ignore Builder Return Values

```rust
// Bad: Ignoring window (can't control it later)
WebviewWindowBuilder::new(&app, "window", url)
    .title("My Window")
    .build()?;
```

```rust
// Good: Store window if you need to control it
let window = WebviewWindowBuilder::new(&app, "window", url)
    .title("My Window")
    .build()?;

// Can now use window
window.show()?;
window.set_focus()?;
```

### Don't: Emit Events Synchronously in Tight Loops

```rust
// Bad: Emitting thousands of events per second
for note in notes {
    app.emit("note-processed", note)?;  // ← Frontend overwhelmed
}
```

```rust
// Good: Batch events or throttle
const BATCH_SIZE: usize = 10;
for chunk in notes.chunks(BATCH_SIZE) {
    app.emit("notes-processed", chunk)?;
    tokio::time::sleep(Duration::from_millis(10)).await;  // Throttle
}
```

**Why:** Event listeners run on main thread. Flooding with events can freeze UI.

## Composing Patterns: Recipe Book

### Pattern: Late-Initialized Service with Arc<Mutex<Option>>

**Problem:** Service needs AppHandle, but AppHandle isn't available during service construction.

**Solution:**

```rust
pub struct MyService {
    app_handle: Arc<Mutex<Option<AppHandle>>>,
}

impl MyService {
    pub fn new() -> Self {
        Self {
            app_handle: Arc::new(Mutex::new(None)),
        }
    }

    pub async fn set_app_handle(&self, handle: AppHandle) {
        *self.app_handle.lock().await = Some(handle);
    }

    pub async fn do_work(&self) -> Result<()> {
        let handle = {
            let guard = self.app_handle.lock().await;
            match guard.as_ref() {
                Some(h) => h.clone(),
                None => return Err(AppError::Generic("App handle not set".into())),
            }
        }; // Lock released here

        handle.emit("work-done", ())?;
        Ok(())
    }
}
```

### Pattern: Custom Event with Type Safety

**Problem:** Need to send structured data from Rust to TypeScript with type safety on both sides.

**Solution:**

```rust
// Rust
#[derive(Debug, Clone, serde::Serialize)]
pub struct CustomEvent {
    pub id: String,
    pub message: String,
    pub timestamp: i64,
}

app.emit("custom-event", CustomEvent {
    id: "evt-123".to_string(),
    message: "Something happened".to_string(),
    timestamp: Utc::now().timestamp(),
})?;
```

```typescript
// TypeScript
interface CustomEvent {
  id: string;
  message: string;
  timestamp: number;
}

listen<CustomEvent>('custom-event', (event) => {
  const { id, message, timestamp } = event.payload;
  console.log(`Event ${id}: ${message} at ${timestamp}`);
});
```

### Pattern: Builder with Validation

**Problem:** Builder should validate configuration before building.

**Solution:**

```rust
pub struct ConfigBuilder {
    min_value: Option<i32>,
    max_value: Option<i32>,
}

impl ConfigBuilder {
    pub fn new() -> Self {
        Self {
            min_value: None,
            max_value: None,
        }
    }

    pub fn min_value(mut self, value: i32) -> Self {
        self.min_value = Some(value);
        self
    }

    pub fn max_value(mut self, value: i32) -> Self {
        self.max_value = Some(value);
        self
    }

    pub fn build(self) -> Result<Config, String> {
        let min = self.min_value.ok_or("min_value is required")?;
        let max = self.max_value.ok_or("max_value is required")?;

        if min > max {
            return Err("min_value must be <= max_value".to_string());
        }

        Ok(Config { min_value: min, max_value: max })
    }
}
```

### Pattern: Plugin-Based Feature Flag

**Problem:** Only enable certain features if plugin is initialized.

**Solution:**

```rust
// From src-tauri/src/app.rs
pub struct AppState {
    pub scheduler_service: Option<Arc<SchedulerService>>,
}

// Initialization
let scheduler_service = match SchedulerService::new(backup_service).await {
    Ok(s) => Some(Arc::new(s)),
    Err(e) => {
        tracing::warn!("Failed to initialize scheduler: {}", e);
        None  // App continues without scheduler
    }
};

// Usage
if let Some(scheduler) = state.scheduler_service.as_ref() {
    scheduler.schedule_backup(frequency).await?;
} else {
    tracing::warn!("Scheduler not available, skipping backup schedule");
}
```

**Pattern benefits:**
- Graceful degradation (app works even if feature unavailable)
- Optional dependencies (scheduler can fail without crashing app)
- Feature discovery (commands can check if feature is enabled)

## Conclusion: Patterns as Building Blocks

These patterns aren't academic exercises—they're the structural DNA of SwatNotes. Every feature you've built relies on multiple patterns working together:

- **Reminders** = Plugin (notifications) + Events (trigger UI) + Arc (shared state) + Async (polling)
- **Hotkeys** = Plugin (global shortcuts) + Async spawn (non-blocking) + Commands (actions)
- **Windows** = Builder (configuration) + Events (communication) + IPC (data fetching)
- **Settings** = Traits (Default, Serialize) + State (Arc) + Commands (read/write)

**When you're designing a new feature, ask:**

1. **Does it need configuration?** → Use builder pattern or config struct
2. **Does it share state?** → Use Arc (immutable) or Arc<Mutex> (mutable)
3. **Does it communicate across boundaries?** → Use events (push) or commands (pull)
4. **Does it extend capabilities?** → Use plugins or traits
5. **Does it do I/O?** → Use async commands, avoid blocking
6. **Does it need custom serialization?** → Implement Serialize manually
7. **Does it handle errors?** → Use thiserror + #[from] for automatic conversions

**The patterns you've learned:**

| Pattern | Purpose | When to Use |
|---------|---------|-------------|
| Derive macros | Auto-implement traits | Clone, Debug, Serialize, Default |
| Custom traits | Domain-specific behavior | Default (sensible defaults), FromStr (parsing) |
| thiserror | Error handling | Always for application errors |
| Plugins | External capabilities | OS integration, reusable features |
| Events | Decoupled communication | Notify multiple listeners, push updates |
| Commands | Request/response IPC | Fetch data, perform actions |
| Builders | Fluent configuration | Windows, complex objects |
| Arc | Immutable sharing | Services, read-only config |
| Arc<Mutex> | Mutable sharing | Shared mutable state |
| Arc<RwLock> | Many readers, one writer | Read-heavy workloads |

You're now equipped to extend SwatNotes with sophisticated features while maintaining clean architecture. The patterns you've learned—trait derivation, plugin composition, event-driven communication, and Arc-based state management—are transferable to any Rust application.

In the next chapter, we'll bring everything together with production readiness: logging strategies, error monitoring, performance profiling, and preparing SwatNotes for distribution.

---

**Key Takeaways:**

- Derive macros eliminate boilerplate while maintaining type safety
- Traits define behavior contracts; implement them for domain types
- Plugins extend capabilities without modifying core code
- Events decouple components; commands provide request/response
- Builders make complex configuration readable and type-safe
- Arc enables cheap sharing; Mutex/RwLock enable safe mutation
- Compose patterns to build sophisticated features cleanly

**Glossary:**

- **Trait**: Rust interface defining behavior contract (e.g., Clone, Debug, Serialize)
- **Derive macro**: Automatic trait implementation (`#[derive(Clone)]`)
- **Arc (Atomic Reference Counted)**: Thread-safe shared ownership pointer
- **Mutex (Mutual Exclusion)**: Lock allowing one task exclusive access to data
- **RwLock (Read-Write Lock)**: Lock allowing multiple readers or one writer
- **Builder pattern**: Fluent API for step-by-step object configuration
- **Plugin**: External module extending application capabilities
- **IPC (Inter-Process Communication)**: Data exchange between Rust and TypeScript
- **Event system**: Pub/sub pattern for decoupled component communication
- **thiserror**: Crate for automatic Error trait implementation
- **Emitter trait**: Tauri trait for sending events to windows
- **FromStr trait**: Standard trait for parsing strings into types
- **Default trait**: Standard trait for default instance construction
- **Serialize/Deserialize**: serde traits for data format conversion
- **Command**: Tauri function callable from TypeScript via `invoke()`
- **Extension trait**: Trait adding methods to existing types (e.g., `GlobalShortcutExt`)
