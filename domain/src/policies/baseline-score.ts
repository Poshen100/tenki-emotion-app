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
 * One stored measurement.
 *
 * 🔴 Deliberately a **time series**, not four running scalars. `{mean, std, n}`
 * is enough to compute a z-score, but it can never support quality weighting or
 * condition matching — and history that was never stored cannot be recovered
 * later. Five scalars per scan buys the option to swap the maths without a
 * migration. See `docs/EDGE-SCORE-DEFINITION.md`.
 *
 * ⚠️ Samples from different measurement profiles must never share an array.
 * A 3.6s enrollment capture and a 10s daily scan are not the same measurement:
 * the short window is intrinsically more dispersed, so mixing them inflates the
 * denominator and pulls every score toward 50 while looking completely normal.
 * Pooling is enforced at the storage layer (`apps/preview/baseline-store.js`).
 */
export interface BaselineSample {
  /** Epoch milliseconds. */
  ts: number;
  /** The person-signal composite for that scan (see `personSignalComposite`). */
  composite: number;
}

/**
 * Summary statistics over one profile's samples.
 *
 * ⚠️ Field names deliberately match the engine's `MetricBaseline`
 * (`packages/engine/src/common/types.ts`) so the two stay readable side by side,
 * but this is computed from the series rather than maintained incrementally.
 */
export interface PersonalBaselineStats {
  /** Mean of the person-signal composite. */
  mean: number;
  /** Sample standard deviation (n−1), or `null` when fewer than two samples. */
  std: number | null;
  /** Number of samples. */
  sampleCount: number;
  /** Number of distinct local calendar days those samples fall on. */
  distinctDays: number;
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
 * for reasons that have nothing to do with the user.
 *
 * Below this the answer is `null`, never a placeholder number. Same discipline
 * as `MIN_BAND_SAMPLES_FOR_RATE` in `readiness-band.ts`.
 *
 * 🔴 **A thin baseline is the same thing as no signal.** Both mean "this number
 * does not hold up", so both return `null` and the UI shows progress instead.
 * Lowering the bar to get a number on screen sooner trades a real milestone for
 * a number that jumps for reasons the user cannot see — which costs more trust
 * than showing nothing.
 */
export const MIN_SAMPLES_FOR_SCORE = 30;

/**
 * Distinct calendar days those samples must span.
 *
 * 🔴 Count alone is not enough. Thirty scans taken in one afternoon share
 * posture, lighting and mood — they describe one moment, not a person's range.
 * The spread this model divides by is meant to be *between-day* variation, so
 * the baseline has to have actually seen different days.
 *
 * ⚠️ The storage layer already keeps at most one sample per profile per day, so
 * in practice this and `MIN_SAMPLES_FOR_SCORE` are the same clock. It is
 * asserted here anyway because that policy lives in another module, and a
 * guarantee that depends on a distant file is not a guarantee.
 */
export const MIN_DAYS_FOR_SCORE = 7;

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
 * Local calendar day key, `YYYY-MM-DD`.
 *
 * ⚠️ **Local**, not UTC. "Today" is what the user experienced; in UTC+8 every
 * evening scan would land on the next day and inflate the day count.
 *
 * @param ts - Epoch milliseconds.
 * @returns Day key.
 */
export function localDayKey(ts: number): string {
  const d = new Date(ts);
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${d.getFullYear()}-${m < 10 ? `0${m}` : m}-${day < 10 ? `0${day}` : day}`;
}

/**
 * Summarizes one profile's samples.
 *
 * ⚠️ `std` is the **sample** standard deviation (n−1) and is `null` below two
 * samples — the spread of a single reading is unknown, not zero. Same rule as
 * `stdDev` in `apps/preview/reliability.js`.
 *
 * @param samples - Samples from a single measurement profile.
 * @returns Summary, or `null` when there are no usable samples.
 */
export function summarizeSamples(
  samples: readonly BaselineSample[],
): PersonalBaselineStats | null {
  const usable = samples.filter(
    (s) => Number.isFinite(s.composite) && Number.isFinite(s.ts),
  );
  if (usable.length === 0) {
    return null;
  }
  const mean = usable.reduce((a, s) => a + s.composite, 0) / usable.length;
  let std: number | null = null;
  if (usable.length >= 2) {
    const ss = usable.reduce((a, s) => a + (s.composite - mean) ** 2, 0);
    std = Math.sqrt(ss / (usable.length - 1));
  }
  const days = new Set(usable.map((s) => localDayKey(s.ts)));
  return { mean, std, sampleCount: usable.length, distinctDays: days.size };
}

/**
 * Today's position within the user's own distribution.
 *
 * Takes the series rather than pre-computed statistics so that the gate, the
 * summary and the maths cannot drift apart across callers.
 *
 * @param value - Today's person-signal composite (see `personSignalComposite`).
 * @param samples - Prior samples **from the same measurement profile**.
 * @returns An integer in `SCORE_MIN..SCORE_MAX`, or `null` when there is not
 *   yet enough history to say anything honest.
 */
export function personalScore(
  value: number,
  samples: readonly BaselineSample[],
): number | null {
  const baseline = summarizeSamples(samples);
  if (baseline === null) {
    return null;
  }
  if (
    baseline.sampleCount < MIN_SAMPLES_FOR_SCORE ||
    baseline.distinctDays < MIN_DAYS_FOR_SCORE
  ) {
    return null;
  }
  // std === 0 means every sample so far was identical — z would be ±Infinity.
  // Not a degenerate case to paper over: it means the spread is not yet real.
  if (baseline.std === null || !(baseline.std > 0) || !Number.isFinite(baseline.std)) {
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
 * Weighted empirical percentile — **written, tested, and not yet wired up**.
 *
 * The eventual replacement for the z-score above: it drops the normality
 * assumption and makes room for weighting by capture quality, recency and
 * measurement conditions. It stays dormant until real series exist to justify
 * the switch; the interface of `personalScore` is unchanged either way, so the
 * swap will not touch any UI.
 *
 * 🔴 **The denominator carries one extra weight on purpose (Weibull plotting
 * position, `i/(n+1)`).** With the textbook `count/n` form, the best day in your
 * history *is* the maximum, so it evaluates to exactly 1.0 and clips to 99 —
 * endpoints are not rare, they are guaranteed, and about `2/n` of all readings
 * sit pinned at one end (~7% at n=30). v2's `calculateTeiPr()` had exactly this
 * flaw. Adding a weight to the denominator makes the extremes *approach* the
 * ends instead of hitting them, which is what "more extreme than 99% of your own
 * days" is supposed to mean.
 *
 * Ties take half credit, the standard mid-rank convention.
 *
 * @param value - Today's person-signal composite.
 * @param samples - Prior samples from the same measurement profile.
 * @param weightOf - Per-sample weight; defaults to 1 (unweighted).
 * @returns An integer in `SCORE_MIN..SCORE_MAX`, or `null` when there is not
 *   enough history.
 */
export function weightedPercentile(
  value: number,
  samples: readonly BaselineSample[],
  weightOf: (sample: BaselineSample) => number = () => 1,
): number | null {
  if (!Number.isFinite(value)) {
    return null;
  }
  const usable = samples.filter(
    (s) => Number.isFinite(s.composite) && Number.isFinite(s.ts),
  );
  if (usable.length < MIN_SAMPLES_FOR_SCORE) {
    return null;
  }
  if (new Set(usable.map((s) => localDayKey(s.ts))).size < MIN_DAYS_FOR_SCORE) {
    return null;
  }
  let below = 0;
  let equal = 0;
  let total = 0;
  for (const s of usable) {
    const w = weightOf(s);
    if (!Number.isFinite(w) || w <= 0) {
      continue;
    }
    total += w;
    if (s.composite < value) {
      below += w;
    } else if (s.composite === value) {
      equal += w;
    }
  }
  if (!(total > 0)) {
    return null;
  }
  // The +1 mean-weight in the denominator is the Weibull correction above.
  const denominator = total + total / usable.length;
  const percentile = (100 * (below + 0.5 * equal)) / denominator;
  return Math.min(SCORE_MAX, Math.max(SCORE_MIN, Math.round(percentile)));
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
