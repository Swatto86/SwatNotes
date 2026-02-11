#Requires -Version 5.1
<#
.SYNOPSIS
    Single authoritative verification script for SwatNotes.

.DESCRIPTION
    Runs all quality gates in order:
      1. Frontend format check (Prettier)
      2. Frontend lint (ESLint)
      3. Frontend type check (TypeScript)
      4. Rust format check (cargo fmt)
      5. Rust lint (cargo clippy)
      6. Frontend unit tests (Vitest)
      7. Rust tests (cargo test)
      8. Frontend build (Vite)
      9. Rust/Tauri release build (cargo build --release)

    Stops immediately on any failure and exits non-zero.
    This script is the single source of truth for "repo is healthy".

.EXAMPLE
    pwsh -File scripts/verify.ps1
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# ── Helpers ───────────────────────────────────────────────────────────────────

function Write-Section {
    param([string]$Title)
    $separator = '─' * 60
    Write-Host ""
    Write-Host $separator -ForegroundColor Cyan
    Write-Host "  $Title" -ForegroundColor Cyan
    Write-Host $separator -ForegroundColor Cyan
    Write-Host ""
}

function Invoke-Step {
    param(
        [string]$Name,
        [string]$Command,
        [string[]]$Arguments
    )

    Write-Host "▶ $Name" -ForegroundColor Yellow
    Write-Host "  Running: $Command $($Arguments -join ' ')" -ForegroundColor DarkGray

    & $Command @Arguments
    if ($LASTEXITCODE -ne 0) {
        Write-Host "✗ FAILED: $Name (exit code $LASTEXITCODE)" -ForegroundColor Red
        exit $LASTEXITCODE
    }
    Write-Host "✓ $Name passed" -ForegroundColor Green
    Write-Host ""
}

# ── Ensure we're at repo root ─────────────────────────────────────────────────

$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
# If invoked from repo root, $PSScriptRoot is scripts/
if (Test-Path (Join-Path $PSScriptRoot '..\package.json')) {
    $repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
}
Push-Location $repoRoot

try {
    Write-Host "╔══════════════════════════════════════════════════════════════╗" -ForegroundColor Magenta
    Write-Host "║           SwatNotes Verification Pipeline                   ║" -ForegroundColor Magenta
    Write-Host "║           $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')                        ║" -ForegroundColor Magenta
    Write-Host "╚══════════════════════════════════════════════════════════════╝" -ForegroundColor Magenta

    # ── 1. Frontend Format Check ──────────────────────────────────────────────
    Write-Section "1/9  Frontend Format Check (Prettier)"
    Invoke-Step "Prettier --check" "npx" @("prettier", "--check", "src/**/*.{ts,tsx,js,json,css}")

    # ── 2. Frontend Lint ──────────────────────────────────────────────────────
    Write-Section "2/9  Frontend Lint (ESLint)"
    Invoke-Step "ESLint" "npx" @("eslint", "src/")

    # ── 3. Frontend Type Check ────────────────────────────────────────────────
    Write-Section "3/9  Frontend Type Check (TypeScript)"
    Invoke-Step "TypeScript --noEmit" "npx" @("tsc", "--noEmit")

    # ── 4. Rust Format Check ──────────────────────────────────────────────────
    Write-Section "4/9  Rust Format Check (cargo fmt)"
    Invoke-Step "cargo fmt --check" "cargo" @("fmt", "--manifest-path", "src-tauri/Cargo.toml", "--", "--check")

    # ── 5. Rust Lint ──────────────────────────────────────────────────────────
    Write-Section "5/9  Rust Lint (cargo clippy)"
    Invoke-Step "cargo clippy" "cargo" @("clippy", "--manifest-path", "src-tauri/Cargo.toml", "--all-targets", "--", "-D", "warnings")

    # ── 6. Frontend Unit Tests ────────────────────────────────────────────────
    Write-Section "6/9  Frontend Unit Tests (Vitest)"
    Invoke-Step "Vitest run" "npx" @("vitest", "run")

    # ── 7. Rust Tests ─────────────────────────────────────────────────────────
    Write-Section "7/9  Rust Tests (cargo test)"
    # Note: --lib tests are excluded because they link against Tauri/WebView2
    # which requires the full runtime. Integration tests cover all core logic.
    Invoke-Step "cargo test (integration)" "cargo" @("test", "--manifest-path", "src-tauri/Cargo.toml", "--test", "integration_test")

    # ── 8. Frontend Build ─────────────────────────────────────────────────────
    Write-Section "8/9  Frontend Build (Vite)"
    Invoke-Step "Vite build" "npx" @("vite", "build")

    # ── 9. Rust Release Build ─────────────────────────────────────────────────
    Write-Section "9/9  Rust Release Build"
    Invoke-Step "cargo build --release" "cargo" @("build", "--release", "--manifest-path", "src-tauri/Cargo.toml")

    # ── Summary ───────────────────────────────────────────────────────────────
    Write-Host ""
    Write-Host "╔══════════════════════════════════════════════════════════════╗" -ForegroundColor Green
    Write-Host "║           ✓ All verification steps passed                   ║" -ForegroundColor Green
    Write-Host "╚══════════════════════════════════════════════════════════════╝" -ForegroundColor Green
    Write-Host ""
}
finally {
    Pop-Location
}
