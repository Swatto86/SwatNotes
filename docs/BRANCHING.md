# Branching & Merge Strategy

> **DevWorkflow Rule (Part D):**
> Agentic & Concurrent Execution Model — all branching, parallel work,
> and integration rules below are non-negotiable.

---

## Branch Naming Convention

| Prefix | Purpose | Example |
|--------|---------|---------|
| `feature/` | New user-visible functionality | `feature/voice-notes` |
| `fix/` | Bug fixes | `fix/reminder-missed-on-restart` |
| `refactor/` | Internal restructuring (no behaviour change) | `refactor/split-backup-service` |
| `docs/` | Documentation-only changes | `docs/update-atlas` |
| `test/` | Test-only additions | `test/e2e-collection-deletion` |
| `ci/` | CI/CD pipeline changes | `ci/add-coverage-upload` |

Branch names MUST reflect intent. Avoid generic names like `update`, `wip`, or `my-branch`.

---

## Workflow Rules

### 1. Each Unit of Work Gets Its Own Branch

Every logical change (feature, fix, refactor, test addition) MUST be developed in its own branch off `main`.

### 2. No Overlapping Ownership

Parallel branches MUST NOT overlap ownership of the same module or responsibility unless explicitly coordinated. If two branches need to touch the same file, define the shared contract/interface first and treat it as immutable during parallel work.

### 3. Shared Contracts First

When parallel work depends on a shared interface (e.g., a new service trait, a new command signature), that interface MUST be merged to `main` first before parallel branches build on it.

### 4. Incremental Merges

- Merges MUST be small and incremental.
- Each merge MUST represent a coherent, independently correct change.
- The system MUST remain functional after every merge.

### 5. CI Must Pass Before Merge

- **All 9 steps** of `scripts/verify.ps1` MUST pass in CI before a PR can merge.
- A failing CI MUST block merge (enforce via GitHub branch protection on `main`).
- Documentation and PROJECT_ATLAS.md updates MUST be included in the same PR if the change affects structure, APIs, boundaries, build, or config.

### 6. Main Branch Is Always Deployable

The `main` branch MUST **always** represent a correct, buildable, deployable system. Broken, partial, or unstable states MUST NOT be merged.

---

## Merge Checklist

Before merging any PR:

1. [ ] CI passes (all 9 verify.ps1 steps)
2. [ ] PR template is fully completed (including test evidence)
3. [ ] No merge conflicts
4. [ ] Commit messages use Conventional Commits format
5. [ ] PROJECT_ATLAS.md updated if needed
6. [ ] No `unwrap()`/`expect()` in production Rust code

---

## Recommended GitHub Branch Protection Settings

For the `main` branch, enable:

- **Require pull request reviews** (at least 1 approval)
- **Require status checks to pass** (require the `verify` job from `ci.yml`)
- **Require branches to be up to date before merging**
- **Do not allow bypassing the above settings**
