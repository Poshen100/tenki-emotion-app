/**
 * @module biometric/ans-balance
 * @description Autonomic balance — a relative read on which branch of the
 * autonomic nervous system the user's signals currently lean toward.
 *
 * This is a DERIVED indicator, not a ninth Edge Score dimension. The eight
 * dimensions are calibrated and their weights sum to one; adding a ninth means
 * redistributing and re-validating all of them, which costs far more than it
 * returns. Autonomic balance shares the same inputs and produces an independent
 * output used for explanation, never for the weighted score.
 *
 * Language boundary: the output is a RELATIVE position against the user's own
 * baseline, in -1 (sympathetic-leaning) to +1 (parasympathetic-leaning). It is
 * never an absolute value and never a clinical grade. "Balance tendency" is a
 * wellness observation; "autonomic dysfunction" is a diagnosis, and this module
 * must never enable the second one.
 *
 * @see docs/EDGE-DETECTOR-ARCHITECTURE.md §4
 */

import type { StressProxyResult } from './stress-proxy';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

/**
 * Which branch the signals lean toward. Deliberately coarse — three buckets,
 * no numeric grade shown to the user.
 */
export const ANS_LEANS = ['sympathetic', 'balanced', 'parasympathetic'] as const;
export type AnsLean = typeof ANS_LEANS[number];

/** Autonomic balance reading. */
export interface AnsBalanceResult {
  /**
   * Relative position, -1 (sympathetic-leaning) to +1 (parasympathetic-leaning).
   * Relative to the user's own baseline — not comparable across people.
   */
  readonly position: number;
  /** Bucketed lean, which is what the interface shows. */
  readonly lean: AnsLean;
  /**
   * How much to trust this reading, 0–1. Low when the baseline is immature or
   * the inputs are incomplete — the same reason a high Edge Score means little
   * on day one.
   */
  readonly confidence: number;
}

/** Inputs for an autonomic balance reading. */
export interface AnsBalanceInput {
  /**
   * HRV expressed as deviation from the personal baseline, in standard
   * deviations. Positive means HRV above baseline.
   */
  readonly hrvZ: number;
  /** Heart-rate stability, 0–1 where 1 is perfectly steady. */
  readonly hrStability: number;
  /** Current stress proxy result. */
  readonly stress: StressProxyResult;
  /** Baseline maturity, 0–1. Drives confidence, not position. */
  readonly baselineMaturity: number;
}

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

/**
 * Weights for the three position components. HRV deviation dominates because it
 * is the signal with the strongest published link to autonomic tone; stability
 * and stress act as corroboration rather than evidence on their own.
 */
export const ANS_WEIGHTS = { hrv: 0.55, stability: 0.2, stress: 0.25 } as const;

/** Absolute position below which the reading is reported as 'balanced'. */
export const ANS_BALANCED_BAND = 0.25;

/** Confidence below which callers should not surface a lean at all. */
export const ANS_MIN_DISPLAY_CONFIDENCE = 0.5;

// ─────────────────────────────────────────────
// Computation
// ─────────────────────────────────────────────

/** Clamps a value into a range. */
function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Buckets a position into a lean.
 *
 * @param position - Relative position, -1 to +1.
 * @returns The lean bucket.
 */
export function classifyLean(position: number): AnsLean {
  if (position > ANS_BALANCED_BAND) return 'parasympathetic';
  if (position < -ANS_BALANCED_BAND) return 'sympathetic';
  return 'balanced';
}

/**
 * Computes an autonomic balance reading.
 *
 * HRV above baseline, steady heart rate and low stress all push toward the
 * parasympathetic side; their opposites push the other way. The result is
 * bounded to -1..+1 so it can never be read as a measurement with units.
 *
 * @param input - The reading inputs.
 * @returns The autonomic balance result.
 */
export function computeAnsBalance(input: AnsBalanceInput): AnsBalanceResult {
  const { hrvZ, hrStability, stress, baselineMaturity } = input;

  // HRV above baseline → parasympathetic side. Two SDs is treated as the edge
  // of the meaningful range; beyond that, more deviation says little more.
  const hrvComponent = clamp(hrvZ / 2, -1, 1);

  // Stability maps 0..1 onto -1..+1: steady is calm, erratic is activated.
  const stabilityComponent = clamp(hrStability * 2 - 1, -1, 1);

  // Stress runs 0..100 with higher meaning more stressed, so it inverts.
  const stressComponent = clamp(1 - stress.score / 50, -1, 1);

  const position = clamp(
    hrvComponent * ANS_WEIGHTS.hrv +
      stabilityComponent * ANS_WEIGHTS.stability +
      stressComponent * ANS_WEIGHTS.stress,
    -1,
    1
  );

  // Confidence follows the baseline, not the signal: a confident-looking
  // reading against an immature reference frame is exactly the false positive
  // this guards against.
  const confidence = clamp(baselineMaturity, 0, 1);

  return { position, lean: classifyLean(position), confidence };
}

/**
 * Whether a reading is solid enough to show.
 *
 * @param result - The reading.
 * @returns True when the lean may be surfaced in the interface.
 */
export function isAnsBalanceDisplayable(result: AnsBalanceResult): boolean {
  return result.confidence >= ANS_MIN_DISPLAY_CONFIDENCE;
}
