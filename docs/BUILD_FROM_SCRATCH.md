# Build from Scratch

This guide covers everything needed to clone SwatNotes and reach a working dev environment on Windows.

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| **Rust** | stable (1.75+) | [rustup.rs](https://rustup.rs) |
| **Node.js** | LTS (20+) | [nodejs.org](https://nodejs.org) |
| **npm** | 10+ | Bundled with Node.js |
| **WebView2** | Latest | Pre-installed on Windows 10 22H2+ and Windows 11. [Manual download](https://developer.microsoft.com/en-us/microsoft-edge/webview2/) if missing. |
| **Visual Studio Build Tools** | 2022+ | [Download](https://visualstudio.microsoft.com/visual-studio-build-tools/). Select "Desktop development with C++" workload. |
| **PowerShell** | 7+ | `winget install Microsoft.PowerShell` |
| **Git** | 2.40+ | [git-scm.com](https://git-scm.com) |

### Optional

| Tool | Purpose | Install |
|------|---------|---------|
| **GitHub CLI** | PR creation, issue management | `winget install GitHub.cli` |
| **cargo-watch** | Auto-rebuild on save | `cargo install cargo-watch` |

## Clone and Install

```powershell
git clone https://github.com/Swatto86/SwatNotes.git
cd SwatNotes
npm ci
```

`npm ci` installs frontend dependencies (Vite, Tailwind, DaisyUI, Quill, etc.) from the lockfile.

Rust dependencies are fetched automatically on the first build.

## Verify the Repo

```powershell
pwsh -File scripts/verify.ps1
```

This runs 9 checks (formatting, linting, types, tests, builds). All must pass. On a fresh clone, this takes ~5 minutes (mostly Rust compilation). Subsequent runs are faster due to caching.

## Development Server

```powershell
npm run tauri dev
```

This starts:
1. Vite dev server at `http://localhost:5173` (hot reload)
2. Rust compilation and Tauri app window

The app window appears once both frontend and backend are ready.

## Production Build

```powershell
npm run tauri build
```

Output: `src-tauri/target/release/bundle/nsis/SwatNotes_<version>_x64-setup.exe`

## Running Tests

### Frontend (Vitest)

```powershell
npx vitest run          # Run all 316 tests once
npx vitest              # Watch mode
npx vitest run --coverage  # With coverage report
```

### Rust Integration Tests

```powershell
cargo test --manifest-path src-tauri/Cargo.toml --test integration_test
```

> **Do not run `cargo test --lib`** — it crashes with `STATUS_ENTRYPOINT_NOT_FOUND` because Tauri's lib tests require the WebView2 runtime, which is only available inside the actual app process.

### E2E Tests (WebDriverIO)

```powershell
npm run tauri build     # Must build first
npx wdio run wdio.conf.cjs
```

E2E tests require a built app binary and are not part of the verification script.

## Project Layout

```
SwatNotes/
├── src/                    Frontend TypeScript
│   ├── components/         UI components (editor, notes list)
│   ├── events/             Event handlers
│   ├── state/              Centralized pub-sub state
│   ├── styles/             Tailwind CSS
│   ├── ui/                 UI helpers (theme, backup dialogs)
│   └── utils/              API wrappers (invoke calls to Rust)
├── src-tauri/              Rust backend
│   ├── src/
│   │   ├── commands/       Tauri command handlers
│   │   ├── database/       SQLx repository, models, migrations
│   │   ├── services/       Business logic (notes, backup, reminders)
│   │   └── storage/        Content-addressed blob store
│   └── tests/              Integration tests
├── pages/                  HTML entry points (multi-page app)
├── e2e/                    WebDriverIO E2E tests
├── scripts/                Automation (verify.ps1)
└── docs/                   Documentation
```

## Common Issues

### `STATUS_ENTRYPOINT_NOT_FOUND` when running Rust tests

You ran `cargo test` without `--test integration_test`. The `--lib` target links against Tauri/WebView2 which isn't available outside the app. Always use:

```powershell
cargo test --manifest-path src-tauri/Cargo.toml --test integration_test
```

### `error: linker 'link.exe' not found`

Visual Studio Build Tools are not installed, or the "Desktop development with C++" workload is missing. Install from the [Build Tools page](https://visualstudio.microsoft.com/visual-studio-build-tools/).

### Vite dev server starts but no window appears

WebView2 runtime may be missing. Download from [Microsoft](https://developer.microsoft.com/en-us/microsoft-edge/webview2/).

### SQLx compile-time check failures

If you modify SQL queries, SQLx validates them at compile time. Ensure the database schema matches. Run migrations by starting the app once, or check `src-tauri/src/database/migrations/`.

### `npm ci` fails with lockfile mismatch

Your Node.js version may be incompatible. Use the LTS version (`node --version` should be 20+).

### Prettier/ESLint conflicts

If ESLint `--fix` reformats code that Prettier disagrees with, re-run Prettier:

```powershell
npx prettier --write "src/**/*.{ts,tsx,js,json,css}"
```

The verification script checks Prettier first, so formatting issues surface early.

## Data Locations

The app stores data in:

```
%APPDATA%\com.swatnotes.app\
├── db.sqlite          Main database (SQLite WAL mode)
├── blobs/             Content-addressed attachment storage
├── backups/           Encrypted backup ZIPs
└── logs/              Application logs
```
