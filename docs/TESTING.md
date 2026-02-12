# Testing Guide

> See also [PRE_IMPLEMENTATION_CHECKLIST.md](PRE_IMPLEMENTATION_CHECKLIST.md) for the pre-coding testing strategy step.

This guide covers how to run tests for SwatNotes, including both frontend (TypeScript) and backend (Rust) tests, as well as the **mandatory testing policies** enforced by the DevWorkflow contract.

---

## Testing Policy (Non-Negotiable)

These rules come from Part A, Rule 3 of the DevWorkflow AI Operating Contract and are enforced via the PR template.

### 1. E2E Tests Are Mandatory for User-Visible Features

E2E tests MUST exercise the application through its real runtime (built app), using real storage and real code paths. They live in `e2e/` and use WebDriverIO.

### 2. Regression Tests Are Mandatory for Every Bug Fix

Every bug fix MUST add a regression test that **fails on the pre-fix code and passes on the fixed code**. Prefer E2E regression when the bug is user-facing.

### 3. Minimal Unit Tests Only Where They Unlock E2E

Unit tests are OPTIONAL. They may be added only to validate pure logic that is hard to cover via E2E (e.g., parsing, serialisation), but they MUST NOT replace required E2E coverage.

### 4. Mocks Are Optional and Tightly Scoped

Mocks MUST NOT be used for core business logic or user flows. Mocks may be used only to isolate truly external dependencies (e.g., Tauri `invoke()` in frontend tests). If used, the PR MUST explain why a real-system test is not feasible.

### 5. Failure-Mode Coverage Is Required

Tests MUST include at least one scenario covering failure or partial-success relevant to the change (e.g., missing file, corrupted data, permission denied, interrupted write).

### 6. Test Evidence Is Required

PRs MUST include the commands used to run tests and the observed results (logs, screenshots, or structured output) in the PR template's "Test Evidence" section.

---

## Prerequisites

- Node.js 18+ and npm
- Rust 1.70+ with cargo
- SQLite development libraries (for Rust tests)

## Frontend Tests (TypeScript)

The frontend uses [Vitest](https://vitest.dev/) as the test runner.

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode (re-runs on file changes)
npm test -- --watch

# Run tests with UI dashboard
npm run test:ui

# Run tests with coverage report
npm run test:coverage

# Run a specific test file
npm test -- src/utils/notesApi.test.ts

# Run tests matching a pattern
npm test -- -t "createNote"
```

### Test Location

Frontend tests are located alongside their source files:

```
src/
├── utils/
│   ├── notesApi.ts
│   ├── notesApi.test.ts      # Tests for notesApi
│   ├── attachmentsApi.ts
│   ├── attachmentsApi.test.ts
│   ├── remindersApi.ts
│   └── remindersApi.test.ts
```

### Writing Frontend Tests

Tests use Vitest with happy-dom for DOM simulation. Example:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { invoke } from '@tauri-apps/api/core';

// Mock Tauri invoke
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}));

describe('myFunction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should do something', async () => {
    vi.mocked(invoke).mockResolvedValue({ result: 'value' });
    // Test your function...
    expect(result).toEqual(expected);
  });
});
```

## Backend Tests (Rust)

The backend uses Rust's built-in test framework with SQLx for database testing.

### Running Tests

```bash
# Navigate to the Tauri source directory
cd src-tauri

# Run all tests
cargo test

# Run tests with output (shows println! statements)
cargo test -- --nocapture

# Run a specific test
cargo test test_create_and_get_note

# Run tests in a specific module
cargo test database::repository::tests

# Run tests with verbose output
cargo test -- --nocapture --test-threads=1
```

### Test Location

Backend tests are organized as module tests within each file:

```
src-tauri/src/
├── database/
│   ├── repository.rs         # Contains #[cfg(test)] mod tests
│   └── schema.rs
├── services/
│   ├── notes.rs              # Contains #[cfg(test)] mod tests
│   ├── backup.rs
│   ├── reminders.rs
│   └── settings.rs
├── storage/
│   └── blob_store.rs
└── crypto.rs
```

### Writing Backend Tests

Backend tests use in-memory SQLite databases for isolation:

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use crate::database::schema::initialize_database;
    use sqlx::sqlite::SqlitePoolOptions;

    async fn create_test_repo() -> Repository {
        let pool = SqlitePoolOptions::new()
            .connect("sqlite::memory:")
            .await
            .unwrap();

        initialize_database(&pool).await.unwrap();
        Repository::new(pool)
    }

    #[tokio::test]
    async fn test_create_note() {
        let repo = create_test_repo().await;
        // Test your code...
    }
}
```

## Test Coverage

### Frontend Coverage

```bash
npm run test:coverage
```

Coverage reports are generated in the `coverage/` directory. Open `coverage/index.html` in a browser to view detailed reports.

### Backend Coverage

For Rust coverage, you can use `cargo-llvm-cov`:

```bash
# Install cargo-llvm-cov
cargo install cargo-llvm-cov

# Run with coverage
cd src-tauri
cargo llvm-cov --html

# Open the report
open target/llvm-cov/html/index.html
```

## Type Checking

Run TypeScript type checking without building:

```bash
npm run type-check
```

## Continuous Integration

For CI environments, use these commands:

```bash
# Frontend: Run tests once and exit
npm test -- --run

# Frontend: Generate coverage in CI format
npm run test:coverage -- --reporter=json

# Backend: Run tests
cd src-tauri && cargo test
```

## Debugging Tests

### Frontend

1. Use `console.log()` in tests (output shown when tests fail)
2. Use `npm run test:ui` for interactive debugging
3. Add `--reporter=verbose` for detailed output

### Backend

1. Use `println!()` macros with `--nocapture`
2. Use `RUST_BACKTRACE=1` for stack traces on panics
3. Use `tracing` with `RUST_LOG=debug` for detailed logging

```bash
RUST_LOG=debug RUST_BACKTRACE=1 cargo test -- --nocapture
```

## Test Categories

| Category | Location | Framework | Command |
|----------|----------|-----------|---------|
| API Wrappers | `src/utils/*.test.ts` | Vitest | `npm test` |
| State Management | `src/state/*.test.ts` | Vitest | `npm test` |
| Components | `src/components/*.test.ts` | Vitest | `npm test` |
| Repository | `src-tauri/src/database/` | Rust | `cargo test` |
| Services | `src-tauri/src/services/` | Rust | `cargo test` |
| Crypto | `src-tauri/src/crypto.rs` | Rust | `cargo test` |
