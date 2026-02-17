# Building Desktop Apps with Rust, Tauri & DaisyUI

**A Complete Beginner's Guide from Zero to Production**

Welcome! This book will take you from knowing nothing about Rust, Tauri, or desktop application development to building a complete, production-ready notes application like SwatNotes.

## What You'll Build

By the end of this book, you'll have built:

- **A Rich Notes Application** with WYSIWYG editing using Quill.js
- **Encrypted Backups** with AES-256-GCM and Argon2id key derivation
- **File Attachments** using content-addressed storage (SHA-256)
- **Reminders & Notifications** with background scheduling
- **System Tray Integration** with global hotkeys
- **Auto-Updates** with download and install functionality
- **Collections/Folders** for organizing notes
- **Full-Text Search** using SQLite FTS5

All powered by:
- **Rust** (backend logic and safety)
- **Tauri v2** (native desktop framework)
- **SQLite** (local database with SQLx)
- **DaisyUI + Tailwind CSS** (beautiful UI components)
- **TypeScript** (frontend logic)

## Who This Book Is For

- **Complete beginners** to Rust who want to build real applications
- **Web developers** wanting to create desktop apps
- **Anyone curious** about systems programming with safety
- **Learners who prefer building** over abstract tutorials

No prior Rust experience required. We start from first principles and build practical understanding through real code from a production application.

## How This Book Works

This is not a reference manual. It's a **guided build experience**.

Each chapter:
1. Introduces one concept or feature
2. Shows the mental model (with analogies and diagrams)
3. Walks through the actual codebase implementation
4. Explains why it was built this way

Every code reference points to real files in the SwatNotes repository. Nothing is made up or simplified beyond recognition. You'll learn from production-quality code with proper error handling, logging, and architecture.

## Book Structure

### Part 0: The Map
Get the big picture before diving in. See how all pieces connect.

### Part 1: Foundations (Chapters 1-5)
- First principles: ownership, borrowing, types
- Setting up your environment
- Understanding Tauri's architecture
- Building your first command

### Part 2: Core Features (Chapters 6-12)
- Database design with SQLite + SQLx
- CRUD operations for notes
- Rich text editing with Quill
- Frontend-backend communication
- State management

### Part 3: Advanced Features (Chapters 13-20)
- File attachments & blob storage
- Encryption & backup system
- Reminders with background tasks
- System tray & global shortcuts
- Auto-updates

### Part 4: Polish & Deployment (Chapters 21-25)
- Error handling patterns
- Testing strategies
- Building installers
- Logging & debugging
- Performance optimization

## Prerequisites

You should know:
- Basic programming concepts (variables, functions, loops)
- Basic HTML/CSS/JavaScript
- How to use a terminal/command line

You do **not** need:
- Rust experience (we teach this from scratch)
- Systems programming knowledge
- Desktop app development experience

## Setup Instructions

Before starting Chapter 1, make sure you have:

1. **Rust** (via rustup): [https://rustup.rs/](https://rustup.rs/)
2. **Node.js** 18+: [https://nodejs.org/](https://nodejs.org/)
3. **VS Code** (recommended): [https://code.visualstudio.com/](https://code.visualstudio.com/)
   - With rust-analyzer extension

**Platform requirements:**
- **Windows 10/11**: WebView2 (usually pre-installed), Visual Studio Build Tools

Full setup instructions are in [Chapter 1](chapters/01-first-principles.md).

## Learning Philosophy

This book teaches through **real-life analogies** and **visual thinking**:

- Rust's **ownership** = Having the single key to a locked room
- **Borrowing** = Giving someone a visitor pass
- **Lifetimes** = Rental agreements with expiration dates
- **Channels** = Pneumatic tubes in old office buildings

Every important data structure includes:
1. **Mental model** (plain language explanation)
2. **Mermaid diagram** (visual representation)
3. **Data journey** (where it comes from, where it goes)

## Using This Book

### For Complete Beginners
Read sequentially from Part 0 through Part 4. Don't skip chapters even if you think you know the topic—we often provide Tauri-specific context.

### For Experienced Developers
- Start with Part 0 (The Map)
- Skim Part 1 if you know Rust basics
- Focus on Parts 2-4 for Tauri-specific patterns

### For Reference
- Use the [Table of Contents](SUMMARY.md)
- Check [docs/API.md](API.md) for quick Tauri command reference
- See [ARCHITECTURE.md](../ARCHITECTURE.md) for system overview

## Conventions Used

- `inline code` = Symbol names, file names, commands
- **Bold** = Important concepts
- [Links](#) = References to other chapters or files
- 💡 **Tip** = Helpful insights
- ⚠️ **Warning** = Common mistakes to avoid
- 🔍 **Deep Dive** = Optional advanced topics

## Code References

When we reference code, we always include:
- **File path**: `src-tauri/src/commands/notes.rs`
- **Symbol name**: `create_note`
- **Context**: Why it's designed this way

You can follow along in the actual SwatNotes codebase to see the complete implementation.

## Getting Help

Stuck? Here's what to do:

1. Re-read the current chapter's "Mental Model" section
2. Check the Mermaid diagrams in Part 0
3. Look at the actual code in the referenced files
4. Review the glossary in [PROGRESS.md](PROGRESS.md)
5. Search for error messages in [docs/TESTING.md](TESTING.md)

## Let's Begin

Ready to build something real? Start with [Part 0: The Map](chapters/00-the-map.md) to see what you're building, then move to [Chapter 1: First Principles](chapters/01-first-principles.md) to learn Rust from scratch.

By the end, you'll have not just built an app—you'll understand **why** it's built this way and be able to create your own desktop applications with confidence.

---

**Version**: 1.0  
**Based on**: SwatNotes v1.0.6  
**Last Updated**: February 5, 2026
