# Investigate (Debug) — TENKI Adapted

> Adapted from gstack /investigate (Garry Tan). Customized for TENKI CORE engine debugging.

## Core Principle

> No fixes without verified root cause. Fixing symptoms creates whack-a-mole debugging.

## Phase 1: Evidence Collection

1. **Read the error** — Exact error message, stack trace, reproduction steps
2. **Trace the code** — Follow execution path backward from symptom using Grep and Read
3. **Check recent changes** — `git log --oneline -20 -- <affected-files>` for regressions
4. **Reproduce** — Attempt deterministic reproduction. Cannot proceed without this.
5. **Check MEMORY.md** — Has this area been debugged before? Recurring bugs signal architectural issues.

**TENKI-specific trace paths:**
| Symptom area | Start tracing from |
|-------------|-------------------|
| Edge Score wrong | `packages/engine/src/scoring/` → check 8 dimension weights |
| Zone misclassification | `packages/shared/src/zone-config.ts` → boundary values 40/70 |
| Baseline issues | `packages/engine/src/baseline/` → Welford algorithm, time buckets |
| Session state stuck | `packages/engine/src/session/` → 10-state machine transitions |
| Scan pipeline error | `packages/scan/src/` → scenario mode, timer, events |
| Compliance false positive | `packages/engine/src/compliance/` → safe-copy, notification-guard |
| Signal quality wrong | `packages/engine/src/baseline/signal-quality-gate.ts` |

**Output:** A specific, testable hypothesis. Not vague speculation.

## Phase 2: Pattern Matching

Match the bug signature against known patterns:

| Pattern | Symptoms |
|---------|----------|
| Race condition | Intermittent, timing-dependent, works on retry |
| Null propagation | `undefined is not a function`, missing optional chaining |
| State corruption | Partial updates, impossible state combinations |
| Boundary error | Fails at exactly 0, 39, 40, 69, 70, or 100 |
| EWMA drift | Values converge too fast or too slow (check alpha = 0.05) |
| Welford overflow | NaN/Infinity after many samples (check decay at 100 samples) |
| Type coercion | String "70" vs number 70 comparisons |

## Phase 3: Hypothesis Testing

1. **Confirm** — Add temporary logging or assertions at suspected root cause
2. **Reproduce** — Run test or manual repro, check if evidence aligns
3. **If wrong** — Return to Phase 1, gather more evidence

**3-strike rule:** After 3 failed hypotheses, STOP and ask:
- Continue with new hypothesis?
- Escalate for Founder review?
- Add instrumentation to capture more data?

**Do not guess. Do not apply speculative fixes.**

## Phase 4: Fix

Once root cause is verified:

1. **Fix the root cause, not the symptom** — Smallest change that eliminates the actual problem
2. **Minimal diff** — Fewest files, fewest lines
3. **Write a regression test** that fails without fix, passes with fix
4. **Run full suite** — `npx vitest run` — zero regressions
5. **Type check** — `npx tsc --noEmit` — zero errors
6. **Blast radius** — If >5 files touched, ask Founder before proceeding
7. **Commit** — `fix(<scope>): <root cause description>`

## Phase 5: Report

```
INVESTIGATION REPORT
════════════════════
Symptom:         <what was observed>
Root cause:      <what was actually wrong>
Fix:             <changes with file:line references>
Evidence:        <test output, reproduction confirmation>
Regression test: <file:line of new test>
Related:         <prior bugs in area, architectural notes>
Status:          DONE | DONE_WITH_CONCERNS | BLOCKED
```

Update `MEMORY.md` if the investigation reveals architectural knowledge worth preserving.

## Rules

- Never apply a fix you haven't confirmed works
- Never skip reproduction ("it probably works" is not verification)
- No `any` casts as workarounds
- No changes to `apps/web/` or `apps/preview/`
- Each fix = one commit following convention
