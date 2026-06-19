# Testing Strategy

> Extended testing context for AI agents. Referenced from AGENTS.md.
> **The TDD mandate (tests before implementation) is enforced in AGENTS.md and verified by Sentinel.**
> This document covers the details of HOW to test.

---

## Test Types

| Type | Purpose | Location | Runner |
|------|---------|----------|--------|
| Unit | Core logic, pure functions, isolated components | `tests/unit/` or `*.test.ts` | Vitest |
| Integration | Cross-component interactions, API calls, DOM manipulation | `tests/integration/` | Vitest |
| E2E | Critical user flows end-to-end | `tests/e2e/` | wdio-obsidian-service |

## Coverage Requirements

- **New code**: 80% diff coverage required (lines added/modified in the PR)
- **Project-wide coverage**: must never decrease from the previous merge baseline
- **Critical paths**: 100% coverage required (auth, payments, data mutations)
- **Run coverage**: `pnpm test --coverage`
- **Sentinel verifies coverage thresholds on every PR**

## Test-Only PRs

PRs that only add tests to existing (untested) code use commit type `test(scope)` and are exempt from test-first choreography ordering (there is no `feat`/`fix` to follow). Sentinel verifies the tests are meaningful and pass.

## Testing Patterns

### Mocking
The `obsidian` package ships **types only** — there is no runtime implementation outside the app, so any module that imports it must be mocked in unit tests. **Preferred:** keep parsing/conversion logic Obsidian-free (pure functions) so the vast majority of tests need no mocks. For the thin Obsidian-coupled layer (`main.ts`, `settings.ts`), stub the specific API surface with Vitest's `vi.mock('obsidian', ...)`. Full end-to-end behavior is covered separately by `wdio-obsidian-service` against a real Obsidian instance.

```typescript
// Example: `obsidian` has no Node runtime — stub only the surface under test.
import { vi } from 'vitest';

vi.mock('obsidian', () => ({
  Notice: vi.fn(),
  Plugin: class { addCommand = vi.fn(); },
}));
```

### Test Naming Convention
```
describe('parseSrt', () => {
  it('should produce one cue when given a single subtitle block', () => {
    // Arrange → Act → Assert
  });
});
```

### What Must Be Tested
- All public API functions
- Error paths and edge cases (not just happy paths)
- State transitions
- Input validation and boundary conditions

### What Should NOT Be Tested
- Framework internals
- Third-party library behavior
- Implementation details (test behavior, not structure)

## CI Integration

- Tests run automatically on every PR via GitHub Actions
- All tests must pass before Sentinel review begins
- Flaky tests must be fixed immediately, not skipped
