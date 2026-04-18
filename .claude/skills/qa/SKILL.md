# QA Testing — TENKI Adapted

> Adapted from gstack /qa (Garry Tan). Customized for TENKI CORE engine/scan packages.

## Scope

TENKI is a monorepo with TypeScript packages. QA focuses on:
- `packages/engine/` — Edge Score, baseline, session, compliance
- `packages/scan/` — Finger Heat Zone pipeline
- `packages/shared/` — Zone config, feature flags, design tokens
- `domain/` — Contracts, policies, schemas

## Phase 1: Diff Analysis

1. Run `git diff main...HEAD --name-only` to identify changed files
2. Map changed files to affected modules
3. Determine test scope (only test affected modules unless `--full` specified)

## Phase 2: Existing Test Audit

1. Run `npx vitest run` to get current baseline
2. Record pass/fail counts and coverage
3. Identify changed files that lack corresponding test files

## Phase 3: Bug Discovery

For each changed module, check:

| Category | What to check |
|----------|---------------|
| Edge cases | Zone boundaries (39↔40, 69↔70), score 0 and 100, empty arrays |
| Type safety | Null/undefined inputs, wrong types at boundaries |
| State machine | Invalid transitions, double-enter, missing guards |
| Calculations | Edge Score weights sum to 1.0, EWMA convergence, Welford algorithm edge cases |
| Compliance | Safe copy rejects forbidden words, notification guard blocks unsafe content |
| Baseline | Bootstrap with insufficient data, signal quality gate thresholds |
| Concurrency | Async operations, race conditions in scan pipeline |

Document each issue:
```
BUG-NNN: [severity] [module] — description
  Expected: <what should happen>
  Actual: <what happens>
  Repro: <how to trigger>
```

## Phase 4: Fix Loop

For each bug (severity-ordered):

1. Locate source file
2. Apply minimal fix only
3. Write a regression test that fails without fix, passes with fix
4. Run `npx vitest run` — zero regressions allowed
5. Commit atomically: `fix(<scope>): <description>`

**Stop conditions:**
- After 20 fixes in one session
- If fix requires >5 files changed (ask Founder first)
- If unsure about intended behavior (ask, don't guess)

## Phase 5: New Test Generation

For changed files without tests:

1. Create test file following naming: `__tests__/<module-name>.test.ts`
2. Cover: happy path, edge cases, error cases
3. Use existing test patterns from `packages/engine/src/baseline/__tests__/`
4. Run all tests to confirm

## Phase 6: Report

```
QA REPORT — TENKI CORE
═══════════════════════
Date: <date>
Scope: <modules tested>

Test baseline: N pass / N fail
After QA:      N pass / N fail (+N new tests)

Issues found: N
  CRITICAL: N (N fixed)
  HIGH: N (N fixed)
  MEDIUM: N (N fixed)

Commits:
  - fix(engine): <description> — <sha>
  - test(baseline): <description> — <sha>

Deferred (needs Founder decision):
  - <issue description>

Coverage gaps:
  - <file without tests>
```

## Rules

- Never modify `apps/web/` or `apps/preview/`
- Every fix gets its own commit: `fix(<scope>): <description>`
- Every new test gets its own commit: `test(<scope>): <description>`
- Run `npx tsc --noEmit` after all changes — zero errors
- No `any` in test code either
