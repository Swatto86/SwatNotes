## What

<!-- One-sentence summary of the change -->

## Why

<!-- Link to issue/ticket, or explain the motivation -->

## How

<!-- Brief description of the approach -->

## Pre-Implementation Checklist

<!-- Confirm these were addressed BEFORE coding (see docs/PRE_IMPLEMENTATION_CHECKLIST.md) -->

- [ ] Problem definition and scope are clear
- [ ] Architectural placement identified (which layer/module owns this?)
- [ ] PROJECT_ATLAS.md reviewed — changes aligned with documented boundaries
- [ ] Testing strategy planned (success cases, failure cases, regression risks)
- [ ] Safety review done for destructive or irreversible actions

## Verification

- [ ] `pwsh -File scripts/verify.ps1` passes locally (all 9 steps)
- [ ] No new warnings introduced
- [ ] Changes tested manually where applicable

## Test Evidence

<!-- REQUIRED: Paste the commands used to run tests and the observed results.
     Include logs, screenshots, or structured output where applicable. -->

```
<!-- Example:
$ pwsh -File scripts/verify.ps1
✓ All verification steps passed

$ npx vitest run src/utils/myApi.test.ts
✓ 5 tests passed
-->
```

## Checklist

- [ ] Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/)
- [ ] New/changed behavior has tests
- [ ] Bug fixes include a regression test that fails on pre-fix code
- [ ] Failure/edge cases covered in tests (missing file, bad data, permission denied, etc.)
- [ ] Documentation updated if user-facing behavior changed
- [ ] PROJECT_ATLAS.md updated if structure, APIs, boundaries, build, or config changed
- [ ] No `unwrap()`/`expect()` added in production Rust code
