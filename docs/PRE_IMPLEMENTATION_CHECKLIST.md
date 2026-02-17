# Pre-Implementation Checklist

> **DevWorkflow Rule (Part C):**
> Before writing any code, you MUST explicitly complete this checklist.
> If any item cannot be answered, implementation MUST NOT begin.

This checklist must be completed (mentally or in writing) before starting
any non-trivial implementation. For PR submissions, confirm completion via
the PR template.

---

## 1. Problem Definition

- [ ] What exact problem is being solved?
- [ ] Who is the user of this capability?
- [ ] What is explicitly out of scope?

## 2. Requirements & Constraints

- [ ] Functional requirements (inputs, outputs, behaviour)
- [ ] Non-functional requirements (performance, security, reliability)
- [ ] Known constraints (platforms, policies, compliance)
- [ ] Unknowns or ambiguities flagged and resolved before implementation

## 3. Architectural Placement

- [ ] Which layer/module owns this behaviour? (commands / services / repository / frontend)
- [ ] Which boundaries are crossed (if any)?
- [ ] What interfaces or adapters are required?
- [ ] Which existing components must remain unchanged?

## 4. Project Atlas Alignment

- [ ] Which files/folders will be modified?
- [ ] Does [PROJECT_ATLAS.md](../PROJECT_ATLAS.md) already describe this area accurately?
- [ ] What Atlas updates will be required?

## 5. Testing Strategy

- [ ] What are the success cases?
- [ ] What are the failure, edge, and corruption cases?
- [ ] What regression risks exist?
- [ ] Is a regression test needed? (mandatory for bug fixes)
- [ ] Is failure-mode coverage included? (e.g., missing file, corrupt data, permission denied)

## 6. Safety & Risk Review

- [ ] Are any actions destructive or irreversible?
- [ ] What safeguards are required?
- [ ] What is the failure mode if something goes wrong?

## 7. Increment Plan

- [ ] What is the smallest coherent change?
- [ ] How will correctness be verified at this step?
- [ ] What does "done" mean for this increment?

---

## Quick Reference: Which Tests Are Required?

| Change Type | E2E Required? | Regression Test? | Failure-Mode Coverage? |
|-------------|---------------|-------------------|----------------------|
| New user-visible feature | **Yes** | No | Yes (at least one scenario) |
| Bug fix | Preferred (if user-facing) | **Yes** (must fail on pre-fix code) | Yes |
| Refactor | No (existing tests should pass) | No | No |
| Pure logic change | Optional unit test | No | Preferred |

See [docs/TESTING.md](TESTING.md) for the full testing policy.
