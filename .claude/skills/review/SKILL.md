# Code Review — TENKI Adapted

> Adapted from gstack /review (Garry Tan). Customized for TENKI CORE monorepo.

## Phase 1: Setup

1. Detect base branch (`main`) and current branch
2. Run `git diff --stat main...HEAD` to understand scope
3. Read `MEMORY.md` Last Session for context

## Phase 2: Scope Check

1. Extract intent from commit messages (`git log main...HEAD --oneline`)
2. Classify each changed file as in-scope or scope creep
3. Output: `Scope Check: [CLEAN | DRIFT DETECTED]`

## Phase 3: TENKI Compliance Pass

**TENKI-specific checks (run on every review):**

| Check | How |
|-------|-----|
| Deprecated terms | Grep diff for TEI, PR99, PEAK, OPTIMAL, Trading Edge |
| `any` in TypeScript | Grep diff for `: any`, `as any`, `<any>` |
| Raw biometric upload | Grep for upload/fetch/POST patterns near HR/HRV/RR data |
| Safe copy violations | Check user-facing strings against ANTIGRAVITY.md Section 2 |
| Protected files | Flag changes to `apps/web/` or `apps/preview/` |
| Missing JSDoc | Check new public functions for JSDoc comments |
| Named exports | Check for `export default` (should be named exports) |

## Phase 4: Critical Pass

Review diff line-by-line for:

**CRITICAL:**
- SQL injection, shell injection, XSS
- Race conditions in async code
- Missing null/undefined guards
- Enum/union type completeness (read code outside diff to verify)
- State machine transition gaps (session 10-state machine)
- Edge Score calculation errors (8 dimensions, weights must sum to 1.0)

**INFORMATIONAL:**
- Async/sync mixing
- Missing error handling at system boundaries
- Test coverage gaps for new functions
- Zone boundary edge cases (39/40, 69/70 thresholds)

**Confidence calibration:**
- 9-10: Verified by reading code
- 7-8: High-confidence pattern match
- 5-6: Moderate, show with caveat
- Below 5: Suppress unless CRITICAL severity

Output: `[SEVERITY] (confidence: N/10) path:line — description`

## Phase 5: Fix-First

For each finding:

1. **AUTO-FIX**: Mechanical issues (formatting, obvious bugs, deprecated terms)
2. **ASK**: Judgment calls (design tradeoffs, architecture decisions)
3. Apply auto-fixes directly
4. Batch remaining items into one question for Founder confirmation

Rules:
- Never commit, push, or create PR (that's `/push` or `/ship`)
- One line problem + one line fix (be terse)
- Only flag real problems, skip anything that's fine

## Phase 6: Summary

```
REVIEW SUMMARY
══════════════
Branch: <branch>
Files changed: N
Quality score: N/10

CRITICAL: N findings (N auto-fixed)
INFORMATIONAL: N findings

TENKI Compliance: [PASS | FAIL]
  - Deprecated terms: [CLEAN | found N]
  - TypeScript any: [CLEAN | found N]
  - Privacy: [CLEAN | violations found]
  - Protected files: [CLEAN | violations found]
```
