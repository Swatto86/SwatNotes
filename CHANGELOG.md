# Changelog

All notable changes to SwatNotes will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Edit reminders — modify existing reminder time and notification settings
- Verification pipeline (`scripts/verify.ps1`) — single-command repo health check
- CI workflow (`.github/workflows/ci.yml`) — gates PRs on full verification
- PR template with verification mandate
- Copilot instructions for AI-assisted development
- Comprehensive build guide (`docs/BUILD_FROM_SCRATCH.md`)
- Release process documentation (`docs/RELEASING.md`)
- Integration tests for collections, reminders, settings, note lifecycle (19 → 28)

### Fixed
- WAL checkpoint bug: backups now flush WAL before copying db.sqlite
- Clippy warnings: collapsible_if, implicit_saturating_sub, bool_assert_comparison
- Integration test correctness: soft-delete assertions, backup prerequisites, pool reconnect

## [1.0.9] - 2025-01-01

### Notes
- Initial changelog entry. Prior changes are not tracked here.
- See [GitHub Releases](https://github.com/Swatto86/SwatNotes/releases) for historical release notes.
