# Chapter 3: Hello Tauri

You've installed the tools. You understand Rust's fundamentals. Now it's time to **write code**.

This chapter is hands-on. By the end, you'll:
- Create a Tauri command in Rust
- Call it from TypeScript
- Understand the IPC bridge
- See data flow in both directions

This is where frontend meets backend—where the magic happens.

---

## The Bridge Between Worlds

**Mental Model**: Think of Tauri as a **translator** between two people who speak different languages:

- **Frontend** (TypeScript/JavaScript): "Hey, can you save this note?"
- **Tauri IPC**: Translates the request
- **Backend** (Rust): Receives the request, saves the note, returns success
- **Tauri IPC**: Translates the response
- **Frontend**: "Great, it's saved!"

```mermaid
sequenceDiagram
    participant JS as JavaScript<br/>(Frontend)
    participant IPC as Tauri IPC<br/>(Bridge)
    participant Rust as Rust<br/>(Backend)
    
    JS->>IPC: invoke('greet', {name: 'Alice'})
    Note over IPC: Serializes to bytes
    IPC->>Rust: greet(name: String)
    Rust->>Rust: Process: format!("Hello, {}", name)
    Rust-->>IPC: Ok("Hello, Alice!")
    Note over IPC: Deserializes to JSON
    IPC-->>JS: Promise resolves: "Hello, Alice!"
    
    style JS fill:#e1f5ff
    style IPC fill:#fff4e1
    style Rust fill:#ffe1e1
```

**Key Insight**: You never write IPC code yourself. Tauri handles serialization, deserialization, and the bridge automatically. You just:
1. Write a Rust function
2. Add `#[tauri::command]`
3. Call it from JavaScript with `invoke()`

That's it.

---

## Your First Command: `greet`

Let's start with the simplest possible command. We'll build it step-by-step, then examine how SwatNotes uses this same pattern.

### Step 1: Create a New Tauri Project

If you haven't already (from Chapter 2):

```bash
npm create tauri-app@latest my-tauri-app
cd my-tauri-app
npm install
```

### Step 2: Write the Rust Command

Open `src-tauri/src/main.rs`. You'll see something like:

```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

**Replace it with this**:

```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

// 1. Define the command
#[tauri::command]
fn greet(name: String) -> String {
    format!("Hello, {}! You've called Rust from JavaScript.", name)
}

fn main() {
    tauri::Builder::default()
        // 2. Register the command
        .invoke_handler(tauri::generate_handler![greet])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

**What did we do?**

1. **`#[tauri::command]`**: Macro that makes a function callable from JavaScript
2. **`fn greet(name: String) -> String`**: Regular Rust function (takes String, returns String)
3. **`tauri::generate_handler![greet]`**: Macro that registers the command

**Mental Model**: `#[tauri::command]` is like publishing a phone number. The `invoke_handler` is like the directory where people look it up.

### Step 3: Call from JavaScript

Open `src/main.ts` (or `src/main.js`). Replace contents with:

```typescript
import { invoke } from '@tauri-apps/api/core';

// Get the button and input elements
const greetButton = document.querySelector('#greet-button') as HTMLButtonElement;
const nameInput = document.querySelector('#name-input') as HTMLInputElement;
const greetMsg = document.querySelector('#greet-msg') as HTMLParagraphElement;

// When button is clicked
greetButton.addEventListener('click', async () => {
  const name = nameInput.value || 'World';
  
  // Call the Rust command
  const message = await invoke<string>('greet', { name });
  
  // Display the result
  greetMsg.textContent = message;
});
```

**What's happening here?**

- **`invoke<string>('greet', { name })`**: 
  - `'greet'` = command name (matches Rust function)
  - `{ name }` = arguments (JavaScript object)
  - `<string>` = TypeScript type hint (optional)
  - Returns a `Promise`

### Step 4: Update the HTML

Open `index.html`, replace the `<body>` with:

```html
<body>
  <h1>Tauri Greeter</h1>
  <input id="name-input" type="text" placeholder="Enter your name" />
  <button id="greet-button">Greet Me!</button>
  <p id="greet-msg"></p>
  <script type="module" src="/src/main.ts"></script>
</body>
```

### Step 5: Run the App

```bash
npm run tauri dev
```

**Try it**:
1. Type your name in the input
2. Click "Greet Me!"
3. See the message from Rust!

🎉 **You just called Rust from JavaScript!**

---

## How SwatNotes Uses Commands

Let's look at real production code. SwatNotes has a similar pattern but more sophisticated.

### SwatNotes' `greet` Command

**File**: [src-tauri/src/commands/mod.rs](../../src-tauri/src/commands/mod.rs)

```rust
/// Simple greeting command for testing
#[tauri::command]
pub async fn greet(name: String) -> Result<String> {
    tracing::info!("Greet command called with name: {:?}", name);
    Ok(format!("Hello, {}! Welcome to SwatNotes.", name))
}
```

**Differences from our simple version**:

1. **`async fn`**: Asynchronous (can wait for database/file operations)
2. **`Result<String>`**: Can fail (returns `Ok(message)` or `Err(error)`)
3. **`tracing::info!`**: Logs to console for debugging
4. **`pub`**: Public (exported from module)

### SwatNotes' `get_app_info` Command

**File**: [src-tauri/src/commands/mod.rs](../../src-tauri/src/commands/mod.rs)

```rust
/// Get application information
#[tauri::command]
pub async fn get_app_info(state: State<'_, AppState>) -> Result<AppInfo> {
    Ok(AppInfo {
        version: env!("CARGO_PKG_VERSION").to_string(),
        app_data_dir: state.app_data_dir.to_string_lossy().to_string(),
    })
}
```

**New concepts**:

1. **`State<'_, AppState>`**: Access to shared application state
2. **`AppInfo`**: Custom struct (defined below)
3. **`env!("CARGO_PKG_VERSION")`**: Compile-time macro (gets version from Cargo.toml)

**The `AppInfo` struct**:

```rust
#[derive(serde::Serialize)]
pub struct AppInfo {
    pub version: String,
    pub app_data_dir: String,
}
```

- **`#[derive(serde::Serialize)]`**: Auto-generates JSON serialization
- JavaScript receives: `{ version: "0.9.0", app_data_dir: "C:\\Users\\..." }`

### How It's Called in SwatNotes

**File**: `src/main.ts` (not shown in full, but pattern is):

```typescript
import { invoke } from '@tauri-apps/api/core';

async function getAppInfo() {
  const info = await invoke<AppInfo>('get_app_info');
  console.log(`SwatNotes v${info.version}`);
  console.log(`Data directory: ${info.app_data_dir}`);
}
```

**Notice**: No arguments needed. The command accesses `AppState` internally.

---

## Understanding `invoke()`

The `invoke` function is your primary tool for calling Rust from JavaScript.

### Signature

```typescript
invoke<T>(command: string, args?: Record<string, unknown>): Promise<T>
```

- **`command`**: String matching Rust function name (snake_case in Rust, but called as-is)
- **`args`**: JavaScript object with parameters
- **`T`**: TypeScript type for the return value
- Returns a **Promise** (always async, even if Rust function isn't)

### Examples

```typescript
// No arguments
const version = await invoke<string>('get_version');

// With arguments
const note = await invoke<Note>('create_note', {
  title: 'My Note',
  contentJson: '{"ops":[{"insert":"Hello"}]}'
});

// Multiple arguments
const result = await invoke<boolean>('update_note', {
  id: 'abc123',
  title: 'New Title',
  contentJson: '...'
});
```

### Error Handling

```typescript
try {
  const note = await invoke<Note>('create_note', { title, content });
  console.log('Success!', note);
} catch (error) {
  console.error('Failed:', error);
  // error is a string from Rust's error message
}
```

**Mental Model**: `invoke` is like calling an API endpoint, except it's instant (no network) and type-safe (Rust checks at compile time).

---

## Parameter Mapping: JavaScript ↔ Rust

How do JavaScript values become Rust values?

```mermaid
graph LR
    subgraph JavaScript
        JSObj["{ name: 'Alice',<br/>age: 30 }"]
    end
    
    subgraph "Tauri IPC"
        Serialize["Serialize to JSON"]
        Deserialize["Deserialize from JSON"]
    end
    
    subgraph Rust
        RustStruct["struct User {<br/>name: String,<br/>age: u32<br/>}"]
    end
    
    JSObj --> Serialize
    Serialize --> Deserialize
    Deserialize --> RustStruct
    
    style JavaScript fill:#e1f5ff
    style "Tauri IPC" fill:#fff4e1
    style Rust fill:#ffe1e1
```

### Type Mapping Table

| JavaScript | Rust | Notes |
|-----------|------|-------|
| `string` | `String` | UTF-8 strings |
| `number` | `i32`, `f64`, `u64`, etc. | Depends on size/sign |
| `boolean` | `bool` | true/false |
| `null` | `Option::None` | Use `Option<T>` in Rust |
| `undefined` | `Option::None` | Same as null |
| `{ key: value }` | `struct` | With `#[derive(Deserialize)]` |
| `[1, 2, 3]` | `Vec<i32>` | Generic arrays |
| `Date` | ❌ | Use ISO string, parse to `DateTime` |

### Example: Complex Data

**JavaScript**:
```typescript
const note = {
  title: 'Shopping List',
  content: 'Buy milk',
  tags: ['grocery', 'urgent'],
  priority: 5
};

await invoke('create_note_advanced', { note });
```

**Rust**:
```rust
#[derive(serde::Deserialize)]
struct NoteInput {
    title: String,
    content: String,
    tags: Vec<String>,
    priority: u8,
}

#[tauri::command]
async fn create_note_advanced(note: NoteInput) -> Result<()> {
    // note.title, note.tags, etc. are all accessible
    Ok(())
}
```

**Mental Model**: Tauri uses **serde** (Rust's serialization library) to convert JavaScript objects to Rust structs. As long as field names match, it "just works."

---

## The `Result` Pattern in Commands

Nearly all SwatNotes commands return `Result<T, AppError>`. Here's why:

### Without `Result` (Fragile)

```rust
#[tauri::command]
fn get_note(id: String) -> Note {
    // What if note doesn't exist? 💥 Panic!
    database.find_note(&id).unwrap()
}
```

**Problem**: If the note doesn't exist, the app **crashes**.

### With `Result` (Robust)

```rust
#[tauri::command]
async fn get_note(id: String) -> Result<Note> {
    database.find_note(&id).await
    // Returns Ok(note) or Err(DatabaseError)
}
```

**JavaScript receives**:
- **Success**: Promise resolves with `Note` object
- **Error**: Promise rejects with error message

**Example in SwatNotes**:

**Rust** ([src-tauri/src/commands/notes.rs](../../src-tauri/src/commands/notes.rs)):
```rust
#[tauri::command]
pub async fn get_note(state: State<'_, AppState>, id: String) -> Result<Note> {
    state.notes_service.get_note(&id).await
}
```

**TypeScript** ([src/utils/notesApi.ts](../../src/utils/notesApi.ts)):
```typescript
export async function getNote(id: string): Promise<Note> {
  return await invoke('get_note', { id });
}
```

**Usage**:
```typescript
try {
  const note = await getNote('abc123');
  console.log(note.title);
} catch (error) {
  console.error('Note not found:', error);
}
```

---

## Accessing Shared State

SwatNotes uses `AppState` to share services across commands.

### What is `AppState`?

**File**: `src-tauri/src/app.rs` (simplified):

```rust
pub struct AppState {
    pub app_data_dir: PathBuf,
    pub notes_service: NotesService,
    pub backup_service: BackupService,
    // ... more services
}
```

**Mental Model**: `AppState` is a **toolbox** that every command can access. Instead of each command opening the database separately, they all share the same connections and services.

### Using State in Commands

**Pattern**:

```rust
#[tauri::command]
async fn my_command(state: State<'_, AppState>) -> Result<Something> {
    // Access services from state
    state.notes_service.do_something().await
}
```

- **`State<'_, AppState>`**: Tauri provides this automatically
- **No manual passing**: You don't create `AppState` in JavaScript—Tauri injects it

**Example from SwatNotes** ([src-tauri/src/commands/notes.rs](../../src-tauri/src/commands/notes.rs#L13-L18)):

```rust
#[tauri::command]
pub async fn create_note(
    state: State<'_, AppState>,
    title: String,
    content_json: String,
) -> Result<Note> {
    state.notes_service.create_note(title, content_json).await
}
```

**JavaScript call**:
```typescript
const note = await invoke('create_note', {
  title: 'Hello',
  contentJson: '{...}'
});
// State is injected by Tauri—no need to pass it!
```

---

## Command Registration

Commands must be registered in `main.rs` to be callable.

### SwatNotes Registration

**File**: [src-tauri/src/main.rs](../../src-tauri/src/main.rs)

```rust
tauri::Builder::default()
    // ... plugins ...
    .setup(|app| {
        app::setup(app)?;  // Initialize AppState
        Ok(())
    })
    .invoke_handler(tauri::generate_handler![
        commands::greet,
        commands::get_app_info,
        commands::create_note,
        commands::get_note,
        commands::list_notes,
        // ... 40+ more commands ...
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
```

**Key parts**:

1. **`.setup(|app| { ... })`**: Runs once on app start (initialize database, services)
2. **`.invoke_handler(...)`**: Registers all commands
3. **`tauri::generate_handler![...]`**: Macro that creates the dispatch table

**Mental Model**: The `invoke_handler` is like a **phone directory**. Each command is listed, so when JavaScript calls `invoke('create_note', ...)`, Tauri knows which Rust function to execute.

---

## Building a Complete Feature: Add Two Numbers

Let's build a slightly more complex example to solidify understanding.

### Step 1: Rust Command

Add to `src-tauri/src/main.rs`:

```rust
#[derive(serde::Deserialize)]
struct MathInput {
    a: f64,
    b: f64,
}

#[derive(serde::Serialize)]
struct MathOutput {
    result: f64,
    operation: String,
}

#[tauri::command]
fn add_numbers(input: MathInput) -> Result<MathOutput, String> {
    if input.a.is_nan() || input.b.is_nan() {
        return Err("Invalid input: NaN not allowed".to_string());
    }
    
    Ok(MathOutput {
        result: input.a + input.b,
        operation: format!("{} + {} = {}", input.a, input.b, input.a + input.b),
    })
}
```

**Register it**:
```rust
.invoke_handler(tauri::generate_handler![
    greet,
    add_numbers  // Add this line
])
```

### Step 2: TypeScript Types

Create `src/types.ts`:

```typescript
export interface MathInput {
  a: number;
  b: number;
}

export interface MathOutput {
  result: number;
  operation: string;
}
```

### Step 3: Call from Frontend

In `src/main.ts`:

```typescript
import { invoke } from '@tauri-apps/api/core';
import type { MathInput, MathOutput } from './types';

async function testMath() {
  try {
    const result = await invoke<MathOutput>('add_numbers', {
      input: { a: 10, b: 32 }
    });
    console.log(result.operation);  // "10 + 32 = 42"
    console.log(result.result);     // 42
  } catch (error) {
    console.error('Math failed:', error);
  }
}

testMath();
```

### Step 4: Run and Test

```bash
npm run tauri dev
```

Open the browser console (F12) → See: `10 + 32 = 42`

---

## Data Flow Visualization

Let's trace a real command from SwatNotes: creating a note.

```mermaid
sequenceDiagram
    actor User
    participant UI as noteEditor.ts
    participant API as notesApi.ts
    participant IPC as Tauri IPC
    participant Cmd as create_note<br/>(command)
    participant Svc as NotesService
    participant Repo as Repository
    participant DB as SQLite
    
    User->>UI: Clicks "Save"
    UI->>API: createNote(title, content)
    API->>IPC: invoke('create_note', {title, contentJson})
    
    Note over IPC: Serialize args to JSON
    
    IPC->>Cmd: create_note(state, title, content_json)
    Cmd->>Svc: notes_service.create_note(title, content_json)
    Svc->>Repo: repo.create_note(request)
    Repo->>DB: INSERT INTO notes (...)
    DB-->>Repo: ✓ Row inserted
    Repo-->>Svc: Note { id, title, ... }
    Svc-->>Cmd: Note
    Cmd-->>IPC: Ok(Note)
    
    Note over IPC: Serialize Note to JSON
    
    IPC-->>API: Promise<Note> resolves
    API-->>UI: Note object
    UI->>User: "Saved!" (UI update)
    
    style User fill:#e1f5ff
    style UI fill:#e1f5ff
    style API fill:#e1f5ff
    style IPC fill:#fff4e1
    style Cmd fill:#ffe1e1
    style Svc fill:#ffe1e1
    style Repo fill:#ffe1e1
    style DB fill:#e1ffe1
```

**Key Observations**:

1. **User action** triggers JavaScript
2. **API wrapper** (`notesApi.ts`) provides clean interface
3. **IPC** handles serialization (you don't see this)
4. **Command** is thin—delegates to service
5. **Service** contains business logic
6. **Repository** talks to database
7. **Response flows back** through every layer

**Mental Model**: Each layer has **one job**. No layer skips another. This makes the code testable and maintainable.

---

## Common Mistakes and Fixes

### Mistake 1: Forgetting to Register Command

**Symptom**: `invoke('my_command', ...)` throws "command not found"

**Fix**: Add to `invoke_handler`:
```rust
.invoke_handler(tauri::generate_handler![
    my_command  // Add this
])
```

### Mistake 2: Mismatched Parameter Names

**JavaScript**:
```typescript
await invoke('greet', { userName: 'Alice' });
```

**Rust**:
```rust
#[tauri::command]
fn greet(name: String) -> String { ... }
//        ^^^^ expects "name", not "userName"
```

**Error**: "missing field `name`"

**Fix**: Match names exactly (or use `#[serde(rename = "userName")]` in Rust).

### Mistake 3: Not Handling Errors in JavaScript

**Bad**:
```typescript
const note = await invoke('get_note', { id });
console.log(note.title);  // 💥 What if it failed?
```

**Good**:
```typescript
try {
  const note = await invoke('get_note', { id });
  console.log(note.title);
} catch (error) {
  console.error('Failed to load note:', error);
  showAlert('Note not found');
}
```

### Mistake 4: Returning `panic!` Instead of `Result`

**Bad**:
```rust
#[tauri::command]
fn divide(a: f64, b: f64) -> f64 {
    if b == 0.0 {
        panic!("Division by zero!");  // 💥 Crashes app
    }
    a / b
}
```

**Good**:
```rust
#[tauri::command]
fn divide(a: f64, b: f64) -> Result<f64, String> {
    if b == 0.0 {
        return Err("Cannot divide by zero".to_string());
    }
    Ok(a / b)
}
```

### Mistake 5: Using Sync Functions for I/O

**Bad**:
```rust
#[tauri::command]
fn read_file() -> String {
    std::fs::read_to_string("file.txt").unwrap()  // Blocks UI!
}
```

**Good**:
```rust
#[tauri::command]
async fn read_file() -> Result<String> {
    tokio::fs::read_to_string("file.txt").await
    //  ^^^^^^ Async version—doesn't block
}
```

---

## Frontend Best Practices

### Pattern 1: API Wrapper Functions

**Don't** call `invoke` everywhere in your UI code:

```typescript
// ❌ Bad: invoke directly in UI
button.onclick = async () => {
  const note = await invoke('create_note', { title, contentJson });
  // ...
};
```

**Do** create wrapper functions:

```typescript
// ✅ Good: API wrapper (src/utils/notesApi.ts)
export async function createNote(title: string, contentJson: string): Promise<Note> {
  return await invoke('create_note', { title, contentJson });
}

// UI code
button.onclick = async () => {
  const note = await createNote(title, contentJson);
  // ...
};
```

**Benefits**:
- Type safety
- Easy to mock for testing
- Single place to update if command signature changes

### Pattern 2: Type Definitions

Keep TypeScript types in sync with Rust structs:

**Rust** (`src-tauri/src/database/models.rs`):
```rust
#[derive(Serialize)]
pub struct Note {
    pub id: String,
    pub title: String,
    pub content_json: String,
    pub created_at: DateTime<Utc>,
}
```

**TypeScript** (`src/types.ts`):
```typescript
export interface Note {
  id: string;
  title: string;
  content_json: string;
  created_at: string;  // ISO 8601 date string
}
```

💡 **Tip**: Some projects use code generation to auto-create TypeScript types from Rust. SwatNotes maintains them manually (simpler for small projects).

### Pattern 3: Centralized Error Handling

```typescript
// src/utils/tauriError.ts
export async function safeInvoke<T>(
  command: string,
  args?: Record<string, unknown>
): Promise<T | null> {
  try {
    return await invoke<T>(command, args);
  } catch (error) {
    console.error(`Command '${command}' failed:`, error);
    showErrorNotification(String(error));
    return null;
  }
}

// Usage
const note = await safeInvoke<Note>('get_note', { id });
if (note) {
  // Use note
}
```

---

## Debugging Commands

### Rust Side

Add logging:

```rust
#[tauri::command]
async fn create_note(title: String, content: String) -> Result<Note> {
    tracing::info!("Creating note: {}", title);        // Log input
    let note = service.create_note(title, content).await?;
    tracing::debug!("Note created: {:?}", note);       // Log output
    Ok(note)
}
```

**View logs**: 
- **Dev**: Console where you ran `npm run tauri dev`
- **Prod**: Log file in app data directory (SwatNotes uses `tracing`)

### JavaScript Side

```typescript
const note = await invoke<Note>('create_note', { title, contentJson });
console.log('Note created:', note);  // Log in browser console
```

**View logs**: Browser DevTools console (F12)

### Debugging Tips

1. **Check browser console first** (F12)
2. **Check terminal** where `tauri dev` is running
3. **Add `tracing::info!`** in Rust to trace execution
4. **Use `console.log`** in TypeScript
5. **Check types match** (Rust struct fields = JS object keys)

---

## Performance Considerations

### When to Use Async

**Sync** (fast, blocks):
```rust
#[tauri::command]
fn add(a: i32, b: i32) -> i32 {
    a + b  // Instant
}
```

**Async** (non-blocking):
```rust
#[tauri::command]
async fn load_notes() -> Result<Vec<Note>> {
    repository.list_notes().await  // Might take time
}
```

**Rule of Thumb**:
- Pure computation → sync
- I/O (database, files, network) → async

### Batching Requests

**Bad** (N+1 queries):
```typescript
for (const id of noteIds) {
  const note = await getNote(id);  // 100 commands for 100 notes!
}
```

**Good** (1 query):
```typescript
const notes = await invoke<Note[]>('get_notes_by_ids', { ids: noteIds });
```

Create a Rust command that handles multiple IDs:

```rust
#[tauri::command]
async fn get_notes_by_ids(state: State<'_, AppState>, ids: Vec<String>) -> Result<Vec<Note>> {
    state.notes_service.get_multiple(&ids).await
}
```

---

## Real-World Example: SwatNotes `create_note`

Let's trace the entire flow for SwatNotes' note creation.

### 1. User Action (Frontend)

User clicks "New Note" button in `src/main.ts`:

```typescript
async function createNewNote() {
  const note = await createNote('Untitled', '{"ops":[{"insert":"\\n"}]}');
  openNoteEditor(note);
}
```

### 2. API Wrapper ([src/utils/notesApi.ts](../../src/utils/notesApi.ts))

```typescript
export async function createNote(title: string, contentJson: string): Promise<Note> {
  return await invoke('create_note', { title, contentJson });
}
```

### 3. Tauri Command ([src-tauri/src/commands/notes.rs](../../src-tauri/src/commands/notes.rs))

```rust
#[tauri::command]
pub async fn create_note(
    state: State<'_, AppState>,
    title: String,
    content_json: String,
) -> Result<Note> {
    state.notes_service.create_note(title, content_json).await
}
```

### 4. Service Layer ([src-tauri/src/services/notes.rs](../../src-tauri/src/services/notes.rs))

```rust
pub async fn create_note(&self, title: String, content_json: String) -> Result<Note> {
    tracing::info!("Creating new note: {}", title);

    let req = CreateNoteRequest {
        title: title.clone(),
        content_json: content_json.clone(),
    };

    let note = self.repo.create_note(req).await?;

    // Sync to FTS index - graceful degradation if FTS fails
    if let Err(e) = self
        .repo
        .insert_note_fts(&note.id, &title, &content_json)
        .await
    {
        tracing::warn!("Failed to insert note into FTS index: {}", e);
        // Don't fail the whole operation if FTS fails
    }

    tracing::info!("Note created successfully: {}", note.id);
    Ok(note)
}
```

### 5. Repository → Database

(SQL executed, row inserted, Note returned)

### 6. Response Flows Back

Each layer returns the `Note` until it reaches JavaScript as a plain object:

```typescript
{
  id: "550e8400-e29b-41d4-a716-446655440000",
  title: "Untitled",
  content_json: "{\"ops\":[{\"insert\":\"\\n\"}]}",
  created_at: "2026-01-28T10:30:00Z",
  updated_at: "2026-01-28T10:30:00Z",
  deleted_at: null,
  title_modified: false,
  collection_id: null
}
```

**Mental Model**: Like a relay race. Each runner (layer) passes the baton (data) to the next. No runner skips ahead or goes backward.

---

## Key Takeaways

Before moving to Chapter 4, make sure you understand:

✅ **`#[tauri::command]`** makes Rust functions callable from JavaScript  
✅ **`invoke('command', args)`** calls Rust from JavaScript  
✅ **`Result<T, E>`** handles errors gracefully  
✅ **`State<'_, AppState>`** provides shared services  
✅ **Register commands** in `.invoke_handler()`  
✅ **Type mapping** happens automatically (serde)  
✅ **Async commands** for I/O (database, files)  
✅ **API wrappers** in TypeScript for clean code  

**Mental Model**: Tauri is a **bridge** between two worlds. You define functions in Rust, annotate them, and call them from JavaScript. Tauri handles all the messy IPC details.

---

## Practice Exercise

Create a command that:

1. **Rust**: Takes a string, reverses it, returns it
2. **JavaScript**: Calls the command when user types in an input
3. **UI**: Displays the reversed string

**Solution** (try first, then peek):

**Rust** (`main.rs`):
```rust
#[tauri::command]
fn reverse_string(input: String) -> String {
    input.chars().rev().collect()
}

// Register:
.invoke_handler(tauri::generate_handler![reverse_string])
```

**TypeScript**:
```typescript
input.addEventListener('input', async (e) => {
  const text = (e.target as HTMLInputElement).value;
  const reversed = await invoke<string>('reverse_string', { input: text });
  output.textContent = reversed;
});
```

**Test**: Type "Hello" → See "olleH"

---

## What's Next?

You now know how to create commands and call them. But SwatNotes has **database queries**, **async operations**, and **complex state management**.

**Chapter 4: Understanding the Stack** will dive into:
- SQLite and why it's perfect for desktop apps
- SQLx and compile-time query checking
- Tauri v2 features SwatNotes uses
- DaisyUI component system
- How Vite and Cargo work together

You're building a mental model piece by piece. Soon it'll all click!

---

## Quick Reference

```rust
// Simplest command
#[tauri::command]
fn greet(name: String) -> String {
    format!("Hello, {}", name)
}

// With Result
#[tauri::command]
fn divide(a: f64, b: f64) -> Result<f64, String> {
    if b == 0.0 {
        return Err("Division by zero".to_string());
    }
    Ok(a / b)
}

// Async with State
#[tauri::command]
async fn get_note(state: State<'_, AppState>, id: String) -> Result<Note> {
    state.notes_service.get_note(&id).await
}

// Complex types
#[derive(serde::Deserialize)]
struct Input { /* fields */ }

#[derive(serde::Serialize)]
struct Output { /* fields */ }

#[tauri::command]
fn process(input: Input) -> Result<Output> {
    // ...
}
```

```typescript
// JavaScript
import { invoke } from '@tauri-apps/api/core';

// Simple call
const result = await invoke<string>('greet', { name: 'Alice' });

// With error handling
try {
  const note = await invoke<Note>('get_note', { id: '123' });
} catch (error) {
  console.error('Failed:', error);
}
```

---

[← Previous: Chapter 2 - Setting Up](02-setting-up-your-environment.md) | [Next: Chapter 4 - Understanding the Stack →](#)
