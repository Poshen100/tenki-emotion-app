/**
 * @module domain/policies/decision-outcome
 * @description Resolves the process-neutral outcome of a completed decision
 * session and computes the running discipline-completion rate. An outcome
 * describes DECISION PROCESS quality (followed the process / broke it), never
 * a financial result — no PnL, win-rate, or profit language ever enters here.
 * Canonical event chain: docs/TRADINGVIEW-ALERT-SPEC.md §9 (Result stage).
 */

/**
 * Process-oriented outcome tag. Mirrors `OutcomeTag` in
 * `packages/engine/src/session/types.ts` (source of truth); domain has no
 * dependency on engine, so the union is mirrored locally. Keep in sync.
 */
export type DecisionOutcomeTag =
  | 'stayed_disciplined'
  | 'broke_discipline'
  | 'timed_out'
  | 'no_action_taken';

/** How the decision timer ended. */
export type DecisionEndType = 'close' | 'cancel' | 'timeout';

/** Input for resolving a decision session's outcome. */
export interface DecisionEndInput {
  /** How the session ended. */
  endType: DecisionEndType;
  /** Whether the readiness window was reached before completion. */
  reachedReadiness: boolean;
}

/**
 * Resolves the outcome tag for an ended decision session.
 * - timeout → let the full timer run → `timed_out`
 * - cancel → left the process early → `broke_discipline`
 * - close after reaching readiness → `stayed_disciplined`
 * - close before readiness (提前收束) → `broke_discipline`
 *
 * @param input - How the session ended + whether readiness was reached.
 * @returns The process-neutral outcome tag.
 */
export function resolveOutcomeTag(input: DecisionEndInput): DecisionOutcomeTag {
  if (input.endType === 'timeout') {
    return 'timed_out';
  }
  if (input.endType === 'cancel') {
    return 'broke_discipline';
  }
  // endType === 'close'
  return input.reachedReadiness ? 'stayed_disciplined' : 'broke_discipline';
}

/**
 * Whether an outcome counts as having followed the decision process.
 * Both a disciplined close and a full timeout count; leaving early does not.
 *
 * @param tag - The outcome tag.
 * @returns True when the process was followed.
 */
export function isDisciplinedOutcome(tag: DecisionOutcomeTag): boolean {
  return tag === 'stayed_disciplined' || tag === 'timed_out';
}

/** Persisted record of one decision session outcome (local-first, no biometric). */
export interface DecisionOutcomeRecord {
  /** Normalized market symbol. */
  symbol: string;
  /** Session template id (e.g. FBD / CANSLIM / MODE_2). */
  templateId: string;
  /** Process outcome. */
  outcomeTag: DecisionOutcomeTag;
  /** Reflection context tag (process language) or null when skipped. */
  contextTag: string | null;
  /** Whether the readiness window was reached. */
  reachedReadiness: boolean;
  /** Session duration in seconds. */
  durationSec: number;
  /** Record timestamp (Unix ms). */
  ts: number;
}

/** Aggregate discipline-completion summary. */
export interface DisciplineSummary {
  /** Total ended sessions counted. */
  total: number;
  /** Sessions that followed the process (disciplined + timed out). */
  disciplined: number;
  /** disciplined / total, or null when there are no records yet. */
  rate: number | null;
}

/**
 * Selects the most recent `limit` outcome records in chronological order
 * (oldest → newest), for rendering a decision-trajectory strip. The input is
 * assumed already in insertion (chronological) order — the newest is last — so
 * this returns the trailing window without re-sorting. A non-positive limit
 * yields an empty list; a limit at or above the record count returns a copy of
 * all records.
 *
 * @param records - Persisted decision outcome records (chronological).
 * @param limit - Maximum number of trailing records to return.
 * @returns The last `limit` records, oldest → newest.
 */
export function selectRecentOutcomes(
  records: readonly DecisionOutcomeRecord[],
  limit: number,
): DecisionOutcomeRecord[] {
  if (limit <= 0) {
    return [];
  }
  return records.slice(Math.max(0, records.length - limit));
}

/**
 * Summarizes the discipline-completion rate over decision outcome records.
 * Rate = process-followed sessions ÷ total ended sessions.
 *
 * @param records - Persisted decision outcome records.
 * @returns Total, disciplined count, and rate (null when empty).
 */
export function summarizeDisciplineRate(
  records: readonly DecisionOutcomeRecord[],
): DisciplineSummary {
  const total = records.length;
  const disciplined = records.reduce(
    (count, record) => (isDisciplinedOutcome(record.outcomeTag) ? count + 1 : count),
    0,
  );
  return {
    total,
    disciplined,
    rate: total === 0 ? null : disciplined / total,
  };
}
