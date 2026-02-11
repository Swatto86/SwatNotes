## What

<!-- One-sentence summary of the change -->

## Why

<!-- Link to issue/ticket, or explain the motivation -->

## How

<!-- Brief description of the approach -->

## Verification

- [ ] `pwsh -File scripts/verify.ps1` passes locally (all 9 steps)
- [ ] No new warnings introduced
- [ ] Changes tested manually where applicable

## Checklist

- [ ] Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/)
- [ ] New/changed behavior has tests
- [ ] Documentation updated if user-facing behavior changed
- [ ] No `unwrap()`/`expect()` added in production Rust code
