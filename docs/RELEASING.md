# Releasing SwatNotes

This document describes the release process for SwatNotes.

## Prerequisites

- All changes merged to `main`
- `pwsh -File scripts/verify.ps1` passes on `main`
- GitHub CLI (`gh`) installed and authenticated
- Tauri signing key configured (see `update-application.ps1` comments)

## Release Steps

### 1. Verify main is clean

```powershell
git checkout main
git pull origin main
pwsh -File scripts/verify.ps1
```

All 9 steps must pass. Do not release if verification fails.

### 2. Update CHANGELOG.md

Move items from `[Unreleased]` to a new version section:

```markdown
## [1.1.0] - 2025-03-15

### Added
- ...

### Fixed
- ...
```

Commit the changelog update:

```powershell
git add CHANGELOG.md
git commit -m "docs: update CHANGELOG for v1.1.0"
git push origin main
```

### 3. Run the release script

```powershell
.\update-application.ps1 -Version "1.1.0" -Notes "Your release notes here"
```

This script:
1. Updates version in `Cargo.toml`, `tauri.conf.json`, `package.json`, `config.ts`, `about.html`
2. Commits the version bump
3. Cleans up old tags and releases (single-latest-release model)
4. Creates an annotated git tag with your release notes
5. Pushes to GitHub, triggering the release workflow

### 4. Monitor the build

The release workflow (`.github/workflows/release.yml`) will:
1. Create a draft GitHub Release
2. Build the app on `windows-latest`
3. Upload NSIS installer + update artifacts
4. Publish the release (remove draft status)

Watch progress at: `https://github.com/Swatto86/SwatNotes/actions`

### 5. Verify the release

After the workflow completes:
1. Check the [Releases page](https://github.com/Swatto86/SwatNotes/releases) for the new version
2. Download and install the NSIS installer to verify it works
3. Check that the auto-update JSON (`latest.json`) is present in release assets

## Version Strategy

SwatNotes uses [Semantic Versioning](https://semver.org/):
- **Major** (`2.0.0`): Breaking changes (data format, config incompatibilities)
- **Minor** (`1.1.0`): New features, backward-compatible
- **Patch** (`1.0.10`): Bug fixes only

The release model is single-latest-release: only one version is live at a time. Previous releases are deleted when a new one is published.

## Rollback

If a release has issues:

1. Revert the problematic commits on `main`
2. Run a new release with incremented patch version
3. The auto-updater will push the fix to users

There is no mechanism to roll back to a previous release artifact since old releases are deleted.

## Auto-Update Flow

1. App checks `https://github.com/Swatto86/SwatNotes/releases/latest` periodically
2. Compares versions using the `latest.json` artifact
3. If newer version exists, prompts user with release notes
4. Downloads and installs the NSIS update package
5. Restarts the app

The update check is signed — the app verifies the signature using the public key in `tauri.conf.json`.
