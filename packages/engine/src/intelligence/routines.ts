/**
 * @module intelligence/routines
 * @description Pre-decision routine experiments — Calibration Proof, widened.
 *
 * founder 2026-11-22 (`docs/research/BUSINESS-VALUE-2026-11.md` §2.4): the
 * single 90-second reset becomes a set of routines the user picks — breathe,
 * walk, water, step away, re-read the plan — each measured before and after
 * with the SAME {@link assessCalibration}. Over time each routine gets its own
 * tally: "what actually moves me before a decision".
 *
 * Borrowed from Welltory's before/after experiments, its strongest retention
 * feature. What is NOT borrowed:
 *
 * - 🔴 **No ranking, no "best routine".** The output is per-routine counts. A
 *   sentence like "walking works best for you" is a recommendation built on a
 *   handful of pairs that also differ in time of day, market and mood.
 * - 🔴 **All three counts, always.** Never "mostly no change": with small n,
 *   a majority claim hides the half that matters (CLAUDE.md, small samples).
 * - 🔴 **Nothing about trading.** A routine changes the user's reading; whether
 *   to take a trade is never this module's business.
 * - `no_clear_shift` stays a result, not a failure (§4.2) — a routine that
 *   never moves the reading is useful to know.
 *
 * ⚠️ Real readings cannot feed this yet: `assessCalibration` works on the
 * 0-100 axis, and phone-only readings are qualitative bands until the drift
 * axis is decided (`docs/DECISION-INTELLIGENCE.md` §6). Until then only the
 * `/drift/` demo exercises it.
 *
 * @see docs/DECISION-INTELLIGENCE.md § 4.2
 */

import { type CalibrationResult, isCalibrationAssessed } from './calibration';
import {
  buildEvidence,
  countDistinctDays,
  insufficientEvidence,
  type EvidenceBasis,
  type EvidenceRequirement,
  type InsufficientEvidence,
} from './evidence';

/**
 * The routines a user can test. `breath_reset` is the original 90-second reset.
 * A closed list on purpose: a free-text routine cannot be compared with itself
 * across weeks ("walk", "short walk", "walked a bit" are three tallies).
 */
export const PRE_DECISION_ROUTINES = [
  'breath_reset',
  'short_walk',
  'water',
  'screen_break',
  'plan_review',
] as const;
export type PreDecisionRoutine = (typeof PRE_DECISION_ROUTINES)[number];

/**
 * Evidence a per-routine tally must clear. Higher than a single calibration's
 * floor of 2: one pair says what happened once; a tally claims a pattern, and
 * five is the least that can show one result recurring rather than occurring.
 */
export const ROUTINE_EVIDENCE_REQUIREMENT: EvidenceRequirement = {
  minSamples: 5,
  moderateSamples: 5,
  highSamples: 12,
  highWindowDays: 7,
};

/** One before/after run of a routine. */
export interface RoutineRun {
  routine: PreDecisionRoutine;
  /** When the routine finished (Unix ms). */
  ts: number;
  /** The calibration verdict for that run, or its refusal. */
  result: CalibrationResult;
}

/** A routine's tally, once there is enough to show one. */
export interface RoutineTally {
  state: 'assessed';
  routine: PreDecisionRoutine;
  /** Comparable runs counted. */
  total: number;
  improved: number;
  noClearShift: number;
  declined: number;
  /** Runs left out because the before/after pair was not comparable. */
  notComparable: number;
  evidence: EvidenceBasis;
}

/** A routine still short of its floor. */
export type RoutineTallyInsufficient = InsufficientEvidence & {
  routine: PreDecisionRoutine;
  notComparable: number;
};

export type RoutineTallyResult = RoutineTally | RoutineTallyInsufficient;

/**
 * Tallies each routine's before/after results.
 *
 * Only comparable runs count. A refused pair (different capture conditions) is
 * reported as `notComparable` rather than dropped silently — a routine that is
 * always measured on mixed instruments should say so, not look untried.
 *
 * @param runs - Every recorded routine run.
 * @returns One result per routine that has at least one run, in
 *   {@link PRE_DECISION_ROUTINES} order (a fixed order, never a ranking).
 */
export function summarizeRoutineEffects(runs: readonly RoutineRun[]): RoutineTallyResult[] {
  return PRE_DECISION_ROUTINES.flatMap((routine): RoutineTallyResult[] => {
    const mine = runs.filter((r) => r.routine === routine);
    if (mine.length === 0) return [];

    const assessed = mine.map((r) => r.result).filter(isCalibrationAssessed);
    const comparableTs = mine.filter((r) => isCalibrationAssessed(r.result)).map((r) => r.ts);
    const notComparable = mine.length - assessed.length;
    const evidenceInput = {
      sampleCount: assessed.length,
      windowDays: countDistinctDays(comparableTs),
      provenance: ['measured', 'behavioral'] as const,
      requirement: ROUTINE_EVIDENCE_REQUIREMENT,
    };

    if (assessed.length < ROUTINE_EVIDENCE_REQUIREMENT.minSamples) {
      return [{ ...insufficientEvidence(evidenceInput), routine, notComparable }];
    }

    return [
      {
        state: 'assessed',
        routine,
        total: assessed.length,
        improved: assessed.filter((r) => r.verdict === 'improved').length,
        noClearShift: assessed.filter((r) => r.verdict === 'no_clear_shift').length,
        declined: assessed.filter((r) => r.verdict === 'declined').length,
        notComparable,
        evidence: buildEvidence(evidenceInput),
      },
    ];
  });
}
