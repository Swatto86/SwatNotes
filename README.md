# QuickNotes

A production-grade desktop notes application built with Rust + Tauri, featuring rich text editing, automatic backups, reminders, and beautiful DaisyUI themes.

## Features

- **Rich Text Editing**: WYSIWYG editor with image and file attachment support
- **Automatic Backups**: Scheduled backups with restore capability
- **Reminders**: Set reminders for notes with popup notifications
- **System Tray**: Minimize to tray with quick actions
- **Global Hotkeys**: Quick access with keyboard shortcuts
- **Beautiful Themes**: 20+ DaisyUI themes to choose from
- **Cross-Platform**: Windows (with Linux planned)

## Tech Stack

- **Backend**: Rust + Tauri v2
- **Frontend**: HTML/CSS/JS with Tailwind CSS + DaisyUI
- **Database**: SQLite with content-addressed blob storage
- **Rich Text**: Quill.js editor

## Prerequisites

- Rust (latest stable)
- Node.js 18+ and npm
- Platform-specific dependencies for Tauri:
  - **Windows**: Microsoft C++ Build Tools
  - **Linux**: See [Tauri prerequisites](https://tauri.app/v1/guides/getting-started/prerequisites)

## Getting Started

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd QuickNotes
```

2. Install Node dependencies:
```bash
npm install
```

3. Install Rust dependencies (automatic during first build)

### Development

Run the app in development mode:
```bash
npm run tauri dev
```

This will start the Vite dev server and launch the Tauri app with hot-reload.

### Building

Build for production:
```bash
npm run tauri build
```

The built executable will be in `src-tauri/target/release/`.

## Project Structure

```
QuickNotes/
├── ARCHITECTURE.md          # Detailed architecture documentation
├── src/                     # Frontend source
│   ├── components/          # UI components
│   ├── styles/              # CSS styles
│   ├── utils/               # Utility functions
│   └── main.js              # Frontend entry point
├── src-tauri/               # Rust backend
│   ├── src/
│   │   ├── main.rs          # Application entry
│   │   ├── app.rs           # App state and initialization
│   │   ├── commands.rs      # Tauri commands
│   │   ├── error.rs         # Error types
│   │   ├── database/        # Database layer
│   │   ├── services/        # Business logic services
│   │   ├── storage/         # Blob storage
│   │   └── platform/        # Platform integrations
│   ├── Cargo.toml
│   └── tauri.conf.json
├── index.html               # Main HTML
├── package.json
└── tailwind.config.js       # Tailwind + DaisyUI config
```

## Development Roadmap

### ✅ Slice 1: Repo + Build Scaffolding
- Tauri project setup
- Tailwind + DaisyUI integration
- Theme switching

### 🚧 Slice 2: Persistence Foundation
- SQLite schema and migrations
- Repository layer with tests
- App data directory layout

### 📋 Slice 3: Notes CRUD
- Create/read/update/delete notes
- Rich text editor integration
- Debounced autosave

### 📋 Slice 4: Clipboard & Attachments
- Paste images
- Attach files
- Blob store implementation

### 📋 Slice 5: Backup Service
- Snapshot packaging
- Scheduled backups
- Retention policy

### 📋 Slice 6: Restore Service
- Restore UI flow
- Safe staged swap
- Integrity verification

### 📋 Slice 7: Reminders
- Reminder CRUD
- Persistent scheduler
- Popup notifications

### 📋 Slice 8: System Integration
- System tray menu
- Global hotkeys
- Minimize to tray

### 📋 Slice 9: Polish
- Settings UI
- Logging and error reporting
- Documentation

## Contributing

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed architecture documentation and contribution guidelines.

## License

[License TBD]
