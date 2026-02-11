# Copilot Instructions for SwatNotes

## Verification Mandate

Before declaring any task complete, run:

```powershell
pwsh -File scripts/verify.ps1
```

This is the single source of truth for "the repo is healthy." All 9 steps must pass. Do not weaken checks to make things pass — fix the underlying issue.

## Architecture Rules

- **Backend**: Rust + Tauri v2. All I/O is async. No `unwrap()` or `expect()` in production code — use `?` with proper error types.
- **Frontend**: TypeScript + Vite. Quill.js editor. Tailwind CSS + DaisyUI.
- **Database**: SQLx with SQLite in WAL mode. Compile-time checked SQL. Repository pattern.
- **Error handling**: `thiserror` for domain errors, `anyhow` for ad-hoc context. Always propagate with `?`.

## Code Style

- **Rust**: `cargo fmt` + `cargo clippy -D warnings`. No clippy allows without justification.
- **TypeScript**: Prettier + ESLint. Prefix intentionally unused variables with `_`.
- **Commits**: Conventional Commits format (`feat:`, `fix:`, `ci:`, `docs:`, `test:`, `refactor:`).

## Testing

- Frontend unit tests: Vitest with happy-dom. Run with `npx vitest run`.
- Rust integration tests: `cargo test --manifest-path src-tauri/Cargo.toml --test integration_test`.
- Rust `--lib` tests: Cannot run outside Tauri runtime (WebView2 DLL dependency). Do not attempt.
- E2E tests: WebDriverIO. Require a built app. Not part of `verify.ps1`.

## Project Structure

- `src/` — Frontend TypeScript (components, state, utils, UI)
- `src-tauri/src/` — Rust backend (commands, services, database, storage)
- `scripts/` — Automation scripts
- `docs/` — Documentation
- `e2e/` — WebDriverIO end-to-end tests (not run by Vitest)

## Key Patterns

- **Tauri commands**: Add in `src-tauri/src/commands/`, export from `mod.rs`, register in `main.rs`.
- **Frontend API calls**: Wrapper functions in `src/utils/*Api.ts` that call `invoke()`.
- **State**: Centralized pub-sub in `src/state/appState.ts`.
- **Blob storage**: Content-addressed (SHA-256), deduplicated, atomic writes.
- **Backups**: AES-256-GCM encrypted ZIP with manifest. Always checkpoint WAL before reading DB.

## What Not To Do

- Do not add `#[allow(clippy::...)]` without a comment explaining why.
- Do not skip the verification script — it catches real bugs.
- Do not run `cargo test --lib` — it will crash with STATUS_ENTRYPOINT_NOT_FOUND.
- Do not add e2e tests to `src/` — they belong in `e2e/` and use WebDriverIO, not Vitest.
