/**
 * @module domain/contracts/runner-ledger
 * @description What the trader reports about **how a position was managed
 * after entry** — two narrow facts, self-reported, no broker feed.
 *
 * Why it exists: every persisted field stops at the entry. `outcomeTag` asks
 * "was a judgment made", `tradeResult` asks "how did it end" — and between
 * those two sits the half of the method `docs/TRADING-METHODOLOGY.md` §4
 * actually spells out (lock ~75% at the first level, keep a runner, and
 * **do not close it voluntarily until the structure fails**). Cutting a
 * runner early, or never locking the first level, was invisible: the record
 * looked identical either way. That gap is why the screen's old
 * 「對齊率 100%」 cell retired (§10 item 7) — a boolean that only measured
 * up to the entry had been named after the whole trade.
 *
 * Founder's ruling, 2026-11-03 (「兩個窄事實」): record exactly two facts,
 * each answerable with one finger. Position adds / averaging down are a third
 * axis and are **deliberately out of v1**.
 *
 * ⚠️ Compliance boundary — the same one `trade-result.ts` carries, and it is
 * stricter here because these two facts are the ones that look most like a
 * grade: they drive **no** score, no streak, no percentage, no "aligned" rate,
 * and no user-facing copy may evaluate them ("you should have held").
 * A record with neither fact reported is **not** a worse record
 * (`docs/DECISION-RECORD-LOOP.md` §4 principle 4).
 *
 * 🔴 **Absence is not a value.** A fact that was not reported means the field
 * does not exist on the record — never `null`, never a default. Writing
 * `firstLevelLock: 'not_locked'` because nobody answered would turn "he did
 * not tell us" into "he did not do it", which is the single most expensive
 * mistake available in this file.
 */

/**
 * Whether the first level's partial profit was taken.
 *
 * `never_reached` is a first-class answer, not a missing value: price never
 * getting to the first level is a fact about the market, and lumping it in
 * with `not_locked` would read as a discipline lapse for something the trader
 * had no say in.
 */
export const FIRST_LEVEL_LOCKS = ['locked', 'not_locked', 'never_reached'] as const;
export type FirstLevelLock = typeof FIRST_LEVEL_LOCKS[number];

/**
 * How the runner ended.
 *
 * `no_runner` is a first-class answer too (the whole position came off at the
 * levels — a plan, not an omission), and `still_running` is what makes this
 * contract reportable **before** the trade is over, which is the normal case:
 * the decision window closes in half an hour, the position can run for days.
 */
export const RUNNER_OUTCOMES = [
  'structure_failed',
  'cut_early',
  'still_running',
  'no_runner',
] as const;
export type RunnerOutcome = typeof RUNNER_OUTCOMES[number];

/** The two facts as they sit on a record. An unreported fact is absent. */
export interface RunnerLedger {
  firstLevelLock?: FirstLevelLock;
  runnerOutcome?: RunnerOutcome;
}

/**
 * Whether a decision can carry a runner ledger at all.
 *
 * Only a decision that reached the market can: standing down
 * (`judged_stood_down`) has no position to manage, and leaving without a
 * judgment (`abandoned_no_judgment`) does not even establish that a trade
 * happened. Asking either of them would invite an answer about something
 * that never existed — the same reason `tradeResult` is derived rather than
 * asked for those two (`decision-outcome.js` `defaultTradeResult`).
 *
 * 🔴 It stays true while `tradeResult` is `'pending'`. The runner question is
 * answerable (and most honest) **during** the trade — `still_running` is one
 * of its answers.
 *
 * @param outcomeTag - The record's judgment tag.
 * @returns True when the two facts are meaningful for this record.
 */
export function allowsRunnerLedger(outcomeTag: string | null | undefined): boolean {
  return outcomeTag === 'judged_entered';
}

/** Why a reported ledger contradicts the rest of the record. */
export type RunnerLedgerConflict = 'still_running_but_closed';

/**
 * The one contradiction this contract can actually defend.
 *
 * `still_running` says a position is open. A closed `tradeResult`, or a
 * `closedAt`, says it is not. Both cannot be true, and the honest move is to
 * **show the conflict** rather than pick a side or quietly drop one of them
 * (CLAUDE.md: two sources that disagree get "訊號衝突", never an average).
 *
 * ⚠️ **Deliberately the only one.** The combinations that look wrong but are
 * not, so that nobody "fixes" them into conflicts later:
 *   - `never_reached` + `structure_failed` — price never got to the first
 *     level and then the structure broke. That is a normal losing trade.
 *   - `not_locked` + `no_runner` — the whole position came off at once,
 *     without a partial. Against the method, but a coherent report.
 *   - `locked` + `no_runner` — locked the first level and closed the rest
 *     there too. §4 allows level-to-level exits that simply finish early.
 *
 * @param ledger - The reported facts.
 * @param record - The surrounding record's closing facts.
 * @returns The conflict, or null when the report is coherent.
 */
export function runnerLedgerConflict(
  ledger: RunnerLedger,
  record: { tradeResult?: string | null; closedAt?: number | null },
): RunnerLedgerConflict | null {
  if (ledger.runnerOutcome !== 'still_running') return null;
  const closedResult =
    record.tradeResult === 'profit_taken' ||
    record.tradeResult === 'stopped_out' ||
    record.tradeResult === 'scratch';
  const hasClosedAt = typeof record.closedAt === 'number' && Number.isFinite(record.closedAt);
  return closedResult || hasClosedAt ? 'still_running_but_closed' : null;
}

/**
 * Whether a value is one this contract knows.
 *
 * 🔴 Used to **reject** a stored value from an older or hostile write, not to
 * coerce it: an unknown value stays unknown (the caller drops the field),
 * it does not become the first enum member.
 *
 * @param value - Candidate value.
 * @returns True when it is a known `firstLevelLock`.
 */
export function isFirstLevelLock(value: unknown): value is FirstLevelLock {
  return typeof value === 'string' && (FIRST_LEVEL_LOCKS as readonly string[]).includes(value);
}

/**
 * Whether a value is a known `runnerOutcome`.
 *
 * @param value - Candidate value.
 * @returns True when it is a known `runnerOutcome`.
 */
export function isRunnerOutcome(value: unknown): value is RunnerOutcome {
  return typeof value === 'string' && (RUNNER_OUTCOMES as readonly string[]).includes(value);
}

/**
 * Reads the ledger off a record, keeping only values this contract knows.
 *
 * @param record - Any stored record shape.
 * @returns The reported facts; an unreported or unrecognized one is absent.
 */
export function readRunnerLedger(record: {
  firstLevelLock?: unknown;
  runnerOutcome?: unknown;
}): RunnerLedger {
  const ledger: RunnerLedger = {};
  if (isFirstLevelLock(record.firstLevelLock)) ledger.firstLevelLock = record.firstLevelLock;
  if (isRunnerOutcome(record.runnerOutcome)) ledger.runnerOutcome = record.runnerOutcome;
  return ledger;
}
