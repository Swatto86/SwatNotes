# Chapter 1: First Principles

Before we write any code, you need to understand **why Rust exists** and how it thinks differently from languages you might know (JavaScript, Python, Java).

This chapter teaches Rust's core concepts using **real-life analogies**. No code yet—just mental models. These analogies will make everything click when we start building.

---

## What is Rust and Why?

### The Problem Rust Solves

Imagine you're building a house. You have two options:

**Option A: Quick and Easy (JavaScript, Python)**
- Hire workers who clean up as they go
- Don't worry about memory—someone else handles it
- **Trade-off**: Can't control when cleanup happens. Sometimes the garbage truck (GC) pauses your work.

**Option B: Total Control (C, C++)**
- You manage every nail, every board
- Complete control over resources
- **Trade-off**: Easy to forget to lock a door (memory leak) or accidentally tear down a wall you're still using (use-after-free).

**Rust's Promise: Option C**
- Control like C/C++, but the **architect checks your blueprint** before building
- Impossible to leave doors unlocked (memory leaks are rare)
- Impossible to tear down walls you're using (no use-after-free)
- **Cost**: Stricter upfront planning (fighting the compiler)

### The Rust Guarantee

> If your Rust code compiles, it **will not** have memory safety bugs, data races, or null pointer crashes.

This is enforced at **compile time** (before the program runs), not runtime. The compiler is your strict but helpful teacher.

---

## Ownership: The Single Key

**Analogy**: Imagine you have a locked room. Ownership is like having the **only key** to that room.

### Rules of Ownership

1. **Every value has exactly one owner**
   - Only one person holds the key at any time

2. **When the owner goes away, the value is dropped**
   - If you leave the building (scope ends), the room is automatically locked and cleaned

3. **Ownership can be transferred (moved)**
   - You can hand the key to someone else, but then **you** don't have access anymore

### Example in Plain Language

```
You create a Note object. → You own it.
You pass it to a function. → That function now owns it.
The function returns. → The Note is destroyed (memory freed).
You try to use it again. → ❌ Compiler error: "You don't own this anymore!"
```

### Mental Model: Moving House

When you **move** a value in Rust, it's like selling your house:

1. You transfer the deed (ownership)
2. You can't walk into "your" old house anymore—it's not yours!
3. The new owner can do what they want with it

**Rust Code Analogy** (don't worry about syntax yet):

```rust
let note = create_note(); // You own the note
save_to_database(note);    // Ownership transferred to this function
// note is gone here—you can't use it!
```

### Why This Matters

In JavaScript:
```javascript
let note = createNote();
saveToDatabase(note);
note.title = "Changed!"; // ✅ Works, but did saveToDatabase expect this?
```

You can modify `note` even after passing it somewhere. This can cause bugs when two parts of code unexpectedly share mutable data.

Rust prevents this: once you hand off ownership, you **cannot** accidentally modify it.

---

## Borrowing: Visitor Passes

**Analogy**: You own a house, but you let friends **borrow a key** to visit. There are rules:

1. **Immutable Borrow** (Shared Visit)
   - Multiple friends can have visitor passes
   - They can look around but **can't move furniture**
   - You still own the house

2. **Mutable Borrow** (Exclusive Access)
   - Only ONE friend gets a key at a time
   - They CAN move furniture
   - Nobody else (including you!) can enter while they're there

### The Borrowing Rules

```
✅ Many immutable borrows at once (read-only)
✅ ONE mutable borrow at a time (read-write)
❌ Cannot have immutable AND mutable borrows simultaneously
```

### Mental Model: Reading vs Editing a Document

**Scenario**: You're editing a Google Doc.

- **Immutable Borrow**: 10 people can **view** the doc at once. Nobody can edit.
- **Mutable Borrow**: Only 1 person can **edit**. While editing, nobody else can even view it (prevents reading half-written data).

### Why This Prevents Bugs

**JavaScript Problem**:
```javascript
let notes = [note1, note2];
for (let note of notes) {
  if (note.expired) {
    notes.push(note); // ❌ Modifying list while iterating—crash!
  }
}
```

**Rust Solution**:
```rust
for note in &notes {  // Immutable borrow
  if note.expired {
    notes.push(note); // ❌ Compiler error: can't mutate while borrowing!
  }
}
```

The compiler **forces** you to fix this before running.

---

## Lifetimes: Rental Agreements

**Analogy**: Lifetimes are like rental contracts with **expiration dates**.

### The Problem

Imagine you borrow a friend's car (a reference). What if your friend **sells the car** while you still have the keys? 💥 Crash!

Rust's lifetime system ensures **references don't outlive the data they point to**.

### Mental Model: Library Books

1. You check out a book (borrow a reference)
2. The library stamps a **due date** (lifetime)
3. The book can't be destroyed until **all borrowers return it**
4. If you try to keep the book past its due date → ❌ Compiler error

### Example in Plain Language

```
fn get_title(note: &Note) -> &str {
  &note.title  // Borrow the title
}

// Lifetime check:
// - note must live as long as the returned &str
// - If note dies, &str becomes invalid
// - Compiler ensures this can't happen
```

### Why You Don't Always See Lifetimes

Rust's **lifetime elision** rules infer lifetimes in simple cases:

```rust
fn get_title(note: &Note) -> &str  // Compiler infers lifetimes
```

Explicit lifetimes only needed when ambiguous (we'll cover this later).

---

## Types and Safety

Rust is **strongly and statically typed**:

- **Strongly**: You can't add a string and a number
- **Statically**: Types checked at compile time

### Mental Model: Airport Security

**Loose Security (JavaScript)**:
- "What's in your bag?" → "Stuff."
- ✅ They let you through, trusting you

**Strict Security (Rust)**:
- "What's in your bag?" → "A laptop and a book."
- "Prove it." → You open the bag, they verify
- ✅ Only then you proceed

Rust **verifies everything upfront**. No surprises at runtime.

### The `Option` Type: Handling "Maybe Nothing"

**Problem**: In JavaScript, `null` is everywhere and causes crashes:

```javascript
let note = findNoteById(id);
console.log(note.title); // 💥 Cannot read property 'title' of null
```

**Rust Solution**: Use `Option<T>`:

```
Option<Note> means:
- Some(note) → The note exists
- None → No note found
```

You **must** handle both cases:

```rust
match find_note_by_id(id) {
  Some(note) => println!("{}", note.title), // ✅ Safe
  None => println!("Not found"),            // ✅ Handled
}
```

**The Rust compiler forces you to handle `None`**. No null pointer crashes!

### The `Result` Type: Handling Errors

```
Result<T, E> means:
- Ok(value) → Success
- Err(error) → Failure
```

**Every function that can fail returns `Result`**:

```rust
fn save_note(note: Note) -> Result<(), DatabaseError>
```

**Mental Model: Delivery Packages**

When you order online:
- `Ok(package)` → "Delivered successfully"
- `Err(reason)` → "Could not deliver: address not found"

Rust makes you **check which one you got** before opening the "package."

---

## Async: Waiting Without Blocking

**Analogy**: Ordering food at a restaurant.

### Blocking (Synchronous)

You stand at the counter until your order is ready:
```
You → [WAITING...] → Food arrives → You sit
```

Everyone waits in a **long line**. Only one person served at a time.

### Non-Blocking (Asynchronous)

You order, they give you a **buzzer**, you sit down:
```
You order → Get buzzer → Sit and chat → Buzz! → Pick up food
```

The kitchen serves **many orders simultaneously**. When yours is ready, the buzzer calls you.

### Rust's Async Model

```rust
async fn create_note(title: String) -> Result<Note> {
  // This function returns a "buzzer" (Future)
  // It doesn't run until you `.await` it
}

// Later...
let note = create_note("Hello".to_string()).await;
// "await" = "Wait for my buzzer to go off"
```

**Why This Matters in SwatNotes**:
- **Database queries** take time → Don't block the UI
- **File I/O** takes time → Don't block the UI
- **Network requests** (update checks) take time → Don't block the UI

Async lets the app stay responsive while waiting.

### The `.await` Keyword

**Mental Model**: `.await` is you saying, "I need the result now. I'll wait, but let other tasks run in the meantime."

```rust
let note = create_note("Title").await; // Wait here
println!("{}", note.title);            // Use result
```

---

## The Borrow Checker: Your Strict Teacher

The **borrow checker** enforces ownership, borrowing, and lifetime rules at compile time.

### Common Complaint

> "I know this is safe, but the compiler won't let me!"

**Reality**: 95% of the time, the compiler is right. You have:
- A use-after-free bug waiting to happen, or
- A data race (two threads modifying the same data)

### Learning Curve

```
Week 1: "This is impossible!"
Week 2: "I'm fighting the compiler constantly."
Week 3: "Oh, I see why that's unsafe."
Week 4: "I can't believe I used to write code without this."
```

**The compiler is not your enemy—it's your safety net.**

### Mental Model: Spell Checker

- **JavaScript**: You can write gibberish, and it runs (until it crashes)
- **Rust**: Like a spell checker that **refuses to save** until you fix all errors

Yes, it's annoying. But it prevents publishing a document with "teh" instead of "the."

---

## Comparison Table: Rust vs. Other Languages

| Feature | JavaScript | Python | C++ | Rust |
|---------|-----------|--------|-----|------|
| **Memory Management** | GC | GC | Manual | Ownership |
| **Null Safety** | ❌ `null`/`undefined` | ❌ `None` | ❌ `NULL` | ✅ `Option<T>` |
| **Error Handling** | Exceptions | Exceptions | Exceptions | `Result<T, E>` |
| **Concurrency Safety** | ❌ (single-threaded) | ❌ (GIL) | ⚠️ (manual) | ✅ (checked) |
| **Compile-Time Checks** | ❌ | ❌ | ⚠️ | ✅✅✅ |
| **Runtime Crashes** | Common | Common | Very common | Rare |
| **Learning Curve** | Easy | Easy | Hard | **Very Hard** |
| **Reward** | Quick prototypes | Quick scripts | Full control | **Control + Safety** |

---

## Practical Rust in SwatNotes

Let's see these concepts in the actual codebase:

### Ownership in Action

**File**: `src-tauri/src/services/notes.rs`  
**Function**: `create_note`

```rust
pub async fn create_note(&self, title: String, content_json: String) -> Result<Note>
```

- `title: String` → **Owns** the string (not borrowed)
- Function **consumes** these values
- Caller can't use them after passing

### Borrowing in Action

**File**: `src-tauri/src/services/notes.rs`  
**Function**: `get_note`

```rust
pub async fn get_note(&self, id: &str) -> Result<Note>
```

- `&self` → **Borrow** self (read-only access)
- `id: &str` → **Borrow** the ID (don't need ownership)
- Function can read but not modify

### `Option` in Action

**File**: `src-tauri/src/database/models.rs`  
**Struct**: `Note`

```rust
pub struct Note {
  pub id: String,
  pub title: String,
  pub deleted_at: Option<DateTime<Utc>>,  // Might be deleted
  pub collection_id: Option<String>,      // Might not be in a collection
}
```

- `deleted_at: Option<DateTime>` → Either `Some(timestamp)` or `None`
- Forces you to check if note is deleted before using the timestamp

### `Result` in Action

**File**: `src-tauri/src/commands/notes.rs`  
**Command**: `create_note`

```rust
#[tauri::command]
pub async fn create_note(
  state: State<'_, AppState>,
  title: String,
  content_json: String,
) -> Result<Note>  // Returns Result, not Note
```

- Might fail (DB error, validation error, etc.)
- Caller **must** handle `Err` case
- Rust won't let you ignore errors

### Async in Action

**File**: `src-tauri/src/commands/notes.rs`

```rust
#[tauri::command]
pub async fn create_note(...) -> Result<Note> {
  state.notes_service.create_note(title, content_json).await
  //                                                    ^^^^^^
  //                        Wait for DB operation to complete
}
```

- `async fn` → Returns a `Future` (like a promise)
- `.await` → "I'll wait here, but let other tasks run"
- Keeps UI responsive during slow operations

---

## Key Takeaways

Before moving on, make sure you understand these mental models:

✅ **Ownership** = Single key to a room  
✅ **Borrowing** = Visitor passes (immutable or mutable)  
✅ **Lifetimes** = Rental agreements with expiration dates  
✅ **Option** = Honest "maybe nothing"  
✅ **Result** = Honest "might fail"  
✅ **Async** = Ordering food with a buzzer  
✅ **Borrow Checker** = Strict teacher preventing bugs  

You don't need to be an expert yet. You'll learn by doing. But when the compiler yells at you, return to these analogies and ask:

> "Which rule am I breaking? Ownership? Borrowing? Lifetimes?"

---

## Practice: Reading Rust Code

Let's read a real function from SwatNotes and apply our knowledge.

**File**: `src-tauri/src/services/notes.rs`  
**Lines**: 22-42 (simplified here)

```rust
pub async fn create_note(&self, title: String, content_json: String) -> Result<Note> {
    tracing::info!("Creating new note: {}", title);

    let req = CreateNoteRequest {
        title: title.clone(),       // Clone because we use it twice
        content_json: content_json.clone(),
    };

    let note = self.repo.create_note(req).await?;
    //                                     ^^^^^^
    //                   Async: wait for DB operation
    //                                         ^
    //                       `?` operator: if Err, return early

    tracing::info!("Note created successfully: {}", note.id);

    Ok(note) // Wrap in Ok (success variant of Result)
}
```

### Analysis

1. **`&self`**: Borrow self (read-only). Service isn't consumed.
2. **`title: String`**: Takes ownership. Caller can't use `title` after calling.
3. **`title.clone()`**: Make a copy so we can use it twice (once for logging, once for struct).
4. **`async fn`**: Returns a Future. Caller must `.await`.
5. **`.await?`**: Wait for result, and if `Err`, return early.
6. **`Ok(note)`**: Success! Wrap `note` in `Result::Ok`.

**No pointers. No manual memory management. No null checks. Just safe, predictable code.**

---

## Common Beginner Mistakes (and Fixes)

### Mistake 1: Using a value after moving it

```rust
let note = create_note();
save_note(note);       // Ownership moved
println!("{}", note);  // ❌ Error: value used after move
```

**Fix**: Clone or borrow:
```rust
let note = create_note();
save_note(note.clone()); // Clone before moving
println!("{}", note);    // ✅ Original still exists
```

### Mistake 2: Mutable and immutable borrows together

```rust
let mut notes = vec![note1, note2];
let first = &notes[0];     // Immutable borrow
notes.push(note3);         // ❌ Mutable borrow while immutably borrowed
println!("{}", first);
```

**Fix**: Limit borrow scope:
```rust
let mut notes = vec![note1, note2];
{
  let first = &notes[0];
  println!("{}", first);
}  // Immutable borrow ends here
notes.push(note3);  // ✅ Now we can mutate
```

### Mistake 3: Ignoring `Result`

```rust
create_note(title); // ❌ Warning: unused Result
```

**Fix**: Handle it:
```rust
match create_note(title) {
  Ok(note) => println!("Created: {}", note.id),
  Err(e) => eprintln!("Error: {}", e),
}
```

Or use `?` to propagate:
```rust
let note = create_note(title)?; // If Err, return from current function
```

---

## Why This Is Worth It

You might be thinking: "This is so much harder than JavaScript!"

**True**. But consider:

| JavaScript App | Rust App |
|---------------|----------|
| Runs, crashes later with null error | Won't compile if null not handled |
| Data race crashes randomly | Data races impossible (compiler prevents) |
| Memory leaks accumulate | Memory automatically freed (no GC pauses) |
| Debugging in production | Most bugs caught **before** running |

**SwatNotes** has:
- Zero null pointer crashes
- Zero use-after-free bugs
- Zero data races
- Predictable performance (no GC pauses)

**This is only possible because Rust is strict.**

---

## Next Steps

You've learned the **mental models**. Next chapters:

- **Chapter 2**: Install Rust and set up your environment
- **Chapter 3**: Write your first Tauri command
- **Chapter 4**: Understand the full tech stack

Whenever the compiler complains, return to this chapter. Ask:

> "Am I breaking ownership rules? Borrowing rules? Do I need to handle an Option or Result?"

The compiler's error messages are good. Read them carefully. They'll teach you Rust faster than any tutorial.

---

**Remember the mantra**:

> If it compiles, it's probably safe.  
> If it's unsafe, it probably won't compile.

---

[← Previous: Part 0 - The Map](00-the-map.md) | [Next: Chapter 2 - Setting Up →](02-setting-up-your-environment.md)
