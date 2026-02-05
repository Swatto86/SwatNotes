# SwatNotes

A production-grade desktop notes application built with Rust and Tauri v2. SwatNotes combines powerful features with a clean, intuitive interface for seamless note-taking.

![Version](https://img.shields.io/badge/version-1.0.6-blue)
![Rust](https://img.shields.io/badge/rust-1.70%2B-orange)
![Tauri](https://img.shields.io/badge/tauri-v2-green)

## Features

### 📝 Rich Note-Taking
- **Quill.js Editor** - Full-featured WYSIWYG editor with formatting, lists, colors, code blocks, and links
- **Autosave** - Debounced autosave (1000ms) ensures your work is never lost
- **Fast Search** - Full-text search across all notes with FTS5
- **Collections** - Organize notes into color-coded collections/folders
- **Multiple Themes** - 20+ beautiful themes powered by DaisyUI

### 📎 Attachments & Media
- **Paste Images** - Copy/paste images directly from clipboard (`Ctrl+V`)
- **File Attachments** - Drag & drop or browse to attach files
- **Content-Addressed Storage** - SHA-256 based deduplication

### 🔒 Security & Backups
- **Encrypted Backups** - AES-256-GCM encryption with Argon2id key derivation
- **One-Click Restore** - Decrypt and restore with automatic checksum verification
- **Retention Policy** - Automatically keep last 10 backups (configurable)

### ⏰ Reminders
- **Time-Based Reminders** - Set reminders for any note with customizable notifications
- **System Notifications** - Visual and audio alerts when reminders trigger
- **Background Scheduler** - Checks for due reminders every 5 seconds

### 🚀 Quick Access
- **System Tray** - Lives in your system tray for quick access
- **Global Hotkeys** - `Ctrl+Shift+N` (new note), `Ctrl+Shift+H` (toggle note), `Ctrl+Shift+F` (search)
- **Auto-Updates** - Automatic update checks with GitHub releases integration
- **Windows Autostart** - Optional launch on system startup

## Tech Stack

### Backend (Rust)
- **Tauri v2** - Modern desktop framework
- **SQLx** - Compile-time checked SQL
- **Tokio** - Async runtime
- **AES-GCM** - Backup encryption
- **Argon2** - Key derivation
- **Chrono** - Date/time handling

### Frontend
- **Vite** - Fast build tool
- **Quill.js** - Rich text editor
- **Tailwind CSS** - Utility-first CSS
- **DaisyUI** - Component library

## Getting Started

### Prerequisites

- **Rust** 1.70+ → [Install](https://rustup.rs/)
- **Node.js** 18+ → [Install](https://nodejs.org/)
- **Windows 10/11** with WebView2 (pre-installed on modern Windows)

### Installation

```bash
# Clone repository
git clone <repository-url>
cd SwatNotes

# Install dependencies
npm install

# Run in development
npm run tauri dev

# Build for production
npm run tauri build
```

Installers are created in `src-tauri/target/release/bundle/`

## Usage Guide

### Creating Notes
- Click "New Note" in sidebar
- Use global hotkey: `Ctrl+Shift+N`
- Right-click system tray icon → "New Note"

### Adding Attachments
- Drag & drop files onto editor
- Paste images with `Ctrl+V`
- Click "Add File" button

### Setting Reminders
1. Open a note
2. Click "Set Reminder"
3. Choose date and time
4. Click "Save"

### Creating Backups
1. Click settings icon (⚙️)
2. Enter password (min 8 chars)
3. Click "Create Encrypted Backup"

### Restoring from Backup
1. Open Settings
2. Find backup in "Recent Backups"
3. Click "Restore"
4. Enter password
5. Restart app

⚠️ **Warning:** Restoring replaces all current data

### Changing Themes
Click theme dropdown in sidebar and select from 20+ themes

## Project Structure

```
SwatNotes/
├── src/                    # Frontend
│   ├── components/         # UI components
│   ├── utils/             # API wrappers
│   └── main.js            # App init
├── src-tauri/             # Backend
│   ├── src/
│   │   ├── app.rs         # Setup
│   │   ├── commands.rs    # Tauri commands
│   │   ├── crypto.rs      # Encryption
│   │   ├── database/      # DB layer
│   │   ├── services/      # Business logic
│   │   └── storage/       # Blob store
│   └── Cargo.toml
├── ARCHITECTURE.md        # Tech docs
└── README.md             # This file
```

## Configuration

### Data Locations
- **Windows:** `%APPDATA%\com.swatnotes.app\`
- **macOS:** `~/Library/Application Support/com.swatnotes.app/`
- **Linux:** `~/.local/share/com.swatnotes.app/`

### Database
- File: `db.sqlite`
- Mode: WAL (Write-Ahead Logging)
- Auto-migrations on startup

### Backups
- Directory: `backups/`
- Format: Encrypted ZIP + manifest
- Default retention: 10 backups

## Architecture

SwatNotes follows production best practices:

- **Clean Architecture** - Repository pattern, service layer
- **No Panics** - No `unwrap()`/`expect()` in production
- **Async Everything** - Tokio for non-blocking I/O
- **Type Safety** - Rust prevents entire classes of bugs
- **Compile-Time SQL** - SQLx checks queries at build time

See [ARCHITECTURE.md](ARCHITECTURE.md) for details.

## Development

### Running Tests
```bash
cd src-tauri
cargo test
```

### Code Style
- Rust: `cargo fmt && cargo clippy`
- JavaScript: Standard style

### Adding Migrations
Place SQL files in `src-tauri/src/database/migrations/`

## Development Roadmap

### ✅ Completed Slices
1. ✅ Repo + Build Scaffolding
2. ✅ Persistence Foundation
3. ✅ Notes CRUD + Rich Text
4. ✅ Clipboard & Attachments
5. ✅ Encrypted Backup Service
6. ✅ Restore with Verification
7. ✅ Reminders + Scheduler
8. ✅ System Tray + Hotkeys
9. ✅ Polish + Documentation

### 🚀 Future Enhancements
- [ ] Mobile apps
- [ ] Markdown import/export
- [ ] Tags & categories
- [ ] Plugin system
- [ ] Voice notes
- [ ] OCR for images

## Security

- **Encryption:** AES-256-GCM with random nonces
- **Key Derivation:** Argon2id with random salts
- **SQL Injection:** Prevented via parameterized queries
- **XSS:** Sanitized HTML in previews
- **Error Handling:** Proper Result types throughout

## Performance

- **Autosave Debouncing:** Reduces DB writes
- **Content Addressing:** File deduplication
- **Background Tasks:** Don't block UI
- **WAL Mode:** Concurrent reads/writes
- **Lazy Loading:** Notes loaded on demand

## Troubleshooting

### Build Issues

**Linux: Missing dependencies**
```bash
sudo apt-get install libwebkit2gtk-4.1-dev libgtk-3-dev
```

**Rust too old**
```bash
rustup update
```

### Runtime Issues

**Database locked**
- Close other instances
- Check for zombies: `ps aux | grep swatnotes`

**Reminders not working**
- Check system notification permissions
- Verify time is in future

## Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing`)
3. Commit changes (`git commit -m 'Add feature'`)
4. Push (`git push origin feature/amazing`)
5. Open Pull Request

Guidelines:
- All tests must pass
- No `unwrap()`/`expect()` in production code
- Follow existing code style
- Descriptive commit messages

## License

This project is licensed under the MIT License.

## Acknowledgments

- **Tauri** - Fantastic desktop framework
- **Quill.js** - Excellent rich text editor
- **DaisyUI** - Beautiful components
- **SQLx** - Type-safe SQL in Rust

---

**Built with ❤️ using Rust and Tauri**
