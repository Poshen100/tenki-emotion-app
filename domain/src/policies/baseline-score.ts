/**
 * @module domain/policies/baseline-score
 * @description Turns one scan into a 1-99 position **relative to the user's own
 * baseline** — not an absolute score.
 *
 * The number answers exactly one question: "how does today compare with your
 * own normal?" 50 means *exactly* your normal. That is the whole point of the
 * scale, and it is what an absolute 0-100 can never say.
 *
 * 🔴 **This is not a health measurement and makes no absolute claim.** It is a
 * position statement about one person's own history, which is why it stays
 * inside calibration language and never becomes a diagnosis.
 *
 * ⚠️ Deliberately kept separate from `readiness-band.ts`. That module derives a
 * band from an *absolute* composite and is the cold-start path — it works on
 * scan #1, when no baseline exists yet. This module only speaks once there is
 * enough history. The two scales must never be mixed (see EDGE-SCORE-DEFINITION.md).
 *
 * Canonical spec: `docs/EDGE-SCORE-DEFINITION.md`
 */

import type { ReadinessEvidence } from '../contracts/readiness-reading';
import type { DomainEdgeZone } from '../contracts/scan-contract';

/**
 * The running statistics this module needs.
 *
 * ⚠️ Declared locally on purpose: `domain/src` has no dependency on
 * `@tenki/engine`, so the engine's `MetricBaseline` is mirrored here rather than
 * imported. Keep the field names in sync with
 * `packages/engine/src/common/types.ts`.
 */
export interface PersonalBaselineStats {
  /** Running mean of the person-signal composite. */
  mean: number;
  /** Running standard deviation. */
  std: number;
  /** Number of accepted samples behind mean/std. */
  sampleCount: number;
}

/** Lowest score ever displayed. */
export const SCORE_MIN = 1;

/** Highest score ever displayed. */
export const SCORE_MAX = 99;

/**
 * |z| beyond which the score saturates.
 *
 * 🔴 Not an arbitrary clamp — Φ(±2.33) *is* 1% and 99%, so the displayed range
 * and this bound are the same statement. Past this point the honest reading is
 * "more extreme than 99% of your own days", which is what 99 already says.
 */
export const Z_CLAMP = 2.33;

/**
 * Samples required before a score may be shown at all.
 *
 * ⚠️ Deliberately **higher** than the engine's `ready` maturity (5 scans). With
 * n=5 the standard deviation is far too unstable — the score would swing wildly
 * for reasons that have nothing to do with the user. Roughly two weeks of daily
 * scans is the first point where the spread means anything.
 *
 * Below this the answer is `null`, never a placeholder number. Same discipline
 * as `MIN_BAND_SAMPLES_FOR_RATE` in `readiness-band.ts`.
 */
export const MIN_SAMPLES_FOR_SCORE = 14;

/**
 * Band thresholds **on the 1-99 position** (not on the absolute composite).
 *
 * 🔴 Because a position is uniform over the user's own history, a threshold
 * decides *how often the app says something*, not what is physiologically true.
 * 80/20 means "unusual" is genuinely unusual: about one day in five each way,
 * and three days in five are simply typical.
 *
 * ⚠️ The old absolute thresholds (70/40) would put a user below the lower band
 * on 40% of their days **forever**, however well they were doing — a direct
 * consequence of ranking against yourself, and both a bad product and a
 * compliance risk.
 */
export const SCORE_CLEAR_AT = 80;
export const SCORE_NEUTRAL_AT = 20;

/**
 * Weights for the person-signal composite.
 *
 * 🔴 **Capture quality (lighting/uniformity) is deliberately absent.** That is
 * the room, not the person — ranking it would mean a dim room lowers your
 * score. Environment belongs to `resolveConfidence()`, which already degrades
 * confidence when evidence is weak.
 */
const WEIGHT_STILLNESS = 0.6;
const WEIGHT_BLINK = 0.4;

/** Clamps a value into 0..1. */
function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/**
 * Standard normal cumulative distribution function.
 *
 * Uses the Abramowitz & Stegun 7.1.26 rational approximation of erf (absolute
 * error ≤ 1.5e-7) — far finer than a 1-99 display needs, and dependency-free.
 *
 * ⚠️ **Mathematically Φ never reaches 0 or 1, but in float64 it does**: past
 * roughly |z| = 38 the `exp(-x²)` term underflows and this returns exactly 0 or
 * 1. So the "never 0, never 100" guarantee does **not** come from the curve —
 * it comes from `Z_CLAMP` in `personalScore`, which bounds the input long
 * before the tails get that thin. Anyone calling `normalCdf` directly must not
 * rely on an open interval.
 *
 * @param z - Standard score.
 * @returns Probability in 0..1.
 */
export function normalCdf(z: number): number {
  const sign = z < 0 ? -1 : 1;
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t +
      0.254829592) *
      t *
      Math.exp(-x * x);
  return 0.5 * (1 + sign * y);
}

/**
 * The quantity that gets compared against the baseline.
 *
 * Only signals that describe **the person** — stillness, and blink cadence when
 * an enrollment baseline exists. When blink cadence is unavailable its weight
 * folds into stillness rather than being replaced by capture quality, so the
 * composite never silently starts measuring the room.
 *
 * @param evidence - Measured scan signals.
 * @returns Composite in 0..1.
 */
export function personSignalComposite(evidence: ReadinessEvidence): number {
  const stillness = clamp01(evidence.stillness);
  if (evidence.blinkCadence === null) {
    return stillness;
  }
  return stillness * WEIGHT_STILLNESS + clamp01(evidence.blinkCadence) * WEIGHT_BLINK;
}

/**
 * Today's position within the user's own distribution.
 *
 * @param value - Today's person-signal composite (see `personSignalComposite`).
 * @param baseline - Running statistics of that same composite.
 * @returns An integer in `SCORE_MIN..SCORE_MAX`, or `null` when there is not
 *   yet enough history to say anything honest.
 */
export function personalScore(
  value: number,
  baseline: PersonalBaselineStats,
): number | null {
  if (baseline.sampleCount < MIN_SAMPLES_FOR_SCORE) {
    return null;
  }
  // std === 0 means every sample so far was identical — z would be ±Infinity.
  // Not a degenerate case to paper over: it means the spread is not yet real.
  if (!(baseline.std > 0) || !Number.isFinite(baseline.std)) {
    return null;
  }
  if (!Number.isFinite(value) || !Number.isFinite(baseline.mean)) {
    return null;
  }
  const rawZ = (value - baseline.mean) / baseline.std;
  const z = Math.min(Z_CLAMP, Math.max(-Z_CLAMP, rawZ));
  const score = Math.round(100 * normalCdf(z));
  return Math.min(SCORE_MAX, Math.max(SCORE_MIN, score));
}

/**
 * Band for a position score.
 *
 * ⚠️ Only valid for values produced by `personalScore`. Passing an absolute
 * 0-100 score here is a category error — the thresholds mean different things
 * on the two scales.
 *
 * @param score - A 1-99 position score.
 * @returns The band that position falls in.
 */
export function scoreBand(score: number): DomainEdgeZone {
  if (score >= SCORE_CLEAR_AT) {
    return 'clear';
  }
  if (score >= SCORE_NEUTRAL_AT) {
    return 'neutral';
  }
  return 'strain';
}
