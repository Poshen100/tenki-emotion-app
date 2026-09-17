/**
 * @module biometric/ppg/exposure-stability
 * @description Is the camera holding still, or re-deciding its own exposure?
 *
 * 🔴 Built to settle one real-device result. Second run, torch on:
 *
 * | dimension | value  |
 * |-----------|--------|
 * | 接觸       | 100%   |
 * | 光         | 100%   (nothing clipped — so NOT the §16 saturation case) |
 * | 穩定       | 83%    |
 * | 節律       | **0%** |
 *
 * and the reasons said `strong_pulse` **and** `irregular_periodicity` at the
 * same time. That pair is the whole clue: there is plenty of energy in the
 * cardiac band — `perfusionIndex` is AC/DC over the band-passed signal — and
 * none of it repeats. A finger with no pulse in it would read low perfusion.
 *
 * The leading suspect is the camera itself. Auto-exposure and auto-white-balance
 * run continuously against a torch-lit fingertip and keep re-adjusting gain.
 * Those adjustments are large, step-shaped and irregular, so they land in the
 * cardiac band, dominate the small cardiac ripple, and carry no period. That is
 * why phone PPG normally locks exposure before it measures anything.
 *
 * 🔴 This module does not assert that diagnosis — it measures the thing that
 * separates it from the alternatives, so the device can answer instead of us
 * guessing:
 *
 *   - **A cardiac ripple is small.** AC/DC for a fingertip runs about 0.5-2%.
 *     So a slow DC excursion of 5% or more is several times the pulse and
 *     cannot be cardiac — it is the camera moving its own operating point.
 *   - **A stuttering timebase looks the same from the outside.** Frames per
 *     second and the longest gap separate "the camera is re-exposing" from
 *     "the page is not getting frames".
 *
 * @see docs/PHONE-PPG.md
 */

import { mean } from './filtering';
import type { PpgChannel } from './channels';
import type { PpgFrame } from './types';

/**
 * Slow DC excursion, as a fraction of DC, above which the drift is bigger than
 * any pulse could be.
 *
 * ⚠️ Derived, not picked: a fingertip's pulsatile AC/DC is roughly 0.5-2%
 * (`perfusionIndex` returns that range on real captures, and `GOOD_PERFUSION`
 * is 0.0055). At 5% the slow movement is at least 2.5× the strongest cardiac
 * ripple, so whatever is moving the level is not the heart. It marks a
 * suspicion, never a verdict — the report prints the number either way.
 */
export const DC_DRIFT_SUSPECT = 0.05;

/** Seconds per bucket when reducing DC to a slow series. */
export const DC_BUCKET_SEC = 1;

/** Fewest frames worth assessing. */
export const MIN_EXPOSURE_FRAMES = 15;

/**
 * Shortest drift period `driftPeriodSec` can report, in seconds.
 *
 * 🔴 Set by the bucket width: the one-second means that make the slow series
 * are themselves a 1 Hz sampling of the drift, so anything faster than two
 * buckets is aliased and partly averaged away. A null answer therefore means
 * "not measurable at this resolution", never "no drift".
 */
export const DRIFT_PERIOD_MIN_SEC = DC_BUCKET_SEC * 2;

/** Longest drift period `driftPeriodSec` can report, in seconds. */
export const DRIFT_PERIOD_MAX_SEC = 20;

/**
 * Mean-crossings required before the slow series counts as oscillating.
 *
 * 🔴 Four crossings is two full cycles, the same "twice or it is not evidence"
 * rule `dominantPeriod` applies to its own lag range. Without it a **ramp**
 * gets a period: a camera that walks its gain one way and stays there still
 * crosses its own mean once in the middle, and breathing adds one or two more,
 * which came out as a confident 19.3 s oscillation that was never there.
 */
export const MIN_DRIFT_CROSSINGS = 4;

/**
 * Below this, a reported period cannot be told apart from an aliased faster
 * drift, so it must not be used to decide that a drift is slow enough to
 * divide out.
 *
 * 🔴 Measured, and the measurement is worse than the theory: a true 1.4 s gain
 * oscillation reports **3.58 s** here, because one-second buckets fold it. The
 * error runs in the dangerous direction — a drift at cardiac frequency, which
 * nothing can separate from a pulse, comes back looking like a slow drift that
 * could be corrected. `DRIFT_PERIOD_MIN_SEC` is the resolution floor; this is
 * the floor for *trusting* the answer, and they are not the same number.
 */
export const DRIFT_PERIOD_TRUSTWORTHY_SEC = 4;


/** What the camera's own behaviour looked like during a capture. */
export interface ExposureStability {
  /** Median level of the channel, in the sensor's 0-255 scale. */
  dcMedian: number;
  /**
   * Slow excursion of the DC level (p95 − p5 of one-second means) as a
   * fraction of `dcMedian`. Compare against `DC_DRIFT_SUSPECT`.
   */
  dcDriftFraction: number;
  /** Largest change between consecutive one-second means, same units. */
  largestStepFraction: number;
  /** True when `dcDriftFraction` is at or above `DC_DRIFT_SUSPECT`. */
  slowDriftDominates: boolean;
  /**
   * Period of the dominant slow oscillation in seconds, or null when the slow
   * series does not repeat strongly enough to name one.
   *
   * 🔴 This is the number that decides what can be done about the drift, and
   * it was previously missing — so the shape had to be inferred from the ratio
   * between `largestStepFraction` and `dcDriftFraction`, which is an inference,
   * not a measurement. A drift slower than a heartbeat can be divided out
   * (`stabiliseGain`); one at cardiac frequency cannot be separated from a
   * pulse by anything.
   *
   * ⚠️ Null is **not** "steady" and not "no drift". Anything faster than
   * `DRIFT_PERIOD_MIN_SEC` is invisible to one-second buckets — and that is
   * also the regime where `dcDriftFraction` itself under-reports, because the
   * bucket averaging attenuates it. Read it together with the fraction.
   *
   * 🔴 **The period says what shape the drift is; only the amplitude says what
   * caused it.** A clean capture reports about 4.4 s here, and that is not an
   * error and not noise — it is respiratory baseline wander, a real slow
   * oscillation that belongs in a fingertip capture. What separates it from a
   * camera hunting its own gain is size: respiratory wander moves the level by
   * a percent or two, and `DC_DRIFT_SUSPECT` is 5%. The device's 28.8% is
   * twenty times too large to be breathing.
   *
   * ⚠️ And see `DRIFT_PERIOD_TRUSTWORTHY_SEC` before concluding from a small
   * value that a drift is slow.
   */
  driftPeriodSec: number | null;
  /** Frames actually delivered per second over the span. */
  framesPerSecond: number;
  /** Longest gap between consecutive frames, in ms. */
  longestGapMs: number;
  /** Frames the assessment rests on. */
  frameCount: number;
}

/**
 * Measures how steady the camera's own operating point was.
 *
 * @param frames - The capture's frames, oldest first.
 * @param channel - Which channel's level to follow; use the one the pulse was
 *   read from when it is known, so the drift measured is the drift that
 *   mattered.
 * @returns The camera's behaviour, or null when there are too few frames to
 *   say anything. Null is not "steady".
 */
export function assessExposureStability(
  frames: readonly PpgFrame[],
  channel: PpgChannel = 'red',
): ExposureStability | null {
  if (frames.length < MIN_EXPOSURE_FRAMES) return null;

  const values = frames.map((f) => (channel === 'red' ? f.red : f.green));
  const spanSec = (frames[frames.length - 1].timestampMs - frames[0].timestampMs) / 1000;
  if (spanSec <= 0) return null;

  const dcMedian = median(values);
  if (dcMedian <= 0) return null;

  // One-second buckets: the cardiac ripple averages out inside a bucket, so
  // what is left between buckets is the slow movement — which is the thing
  // auto-exposure does and the heart does not.
  const startMs = frames[0].timestampMs;
  const buckets = new Map<number, number[]>();
  for (const [i, frame] of frames.entries()) {
    const bucket = Math.floor((frame.timestampMs - startMs) / (DC_BUCKET_SEC * 1000));
    const list = buckets.get(bucket);
    if (list === undefined) buckets.set(bucket, [values[i]]);
    else list.push(values[i]);
  }
  const slow = [...buckets.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, list]) => mean(list));

  const sorted = [...slow].sort((a, b) => a - b);
  const drift = sorted.length < 2 ? 0 : percentile(sorted, 0.95) - percentile(sorted, 0.05);

  let largestStep = 0;
  for (let i = 1; i < slow.length; i++) {
    largestStep = Math.max(largestStep, Math.abs(slow[i] - slow[i - 1]));
  }

  let longestGapMs = 0;
  for (let i = 1; i < frames.length; i++) {
    longestGapMs = Math.max(
      longestGapMs,
      frames[i].timestampMs - frames[i - 1].timestampMs,
    );
  }

  const dcDriftFraction = drift / dcMedian;

  return {
    dcMedian: round2(dcMedian),
    dcDriftFraction: round4(dcDriftFraction),
    largestStepFraction: round4(largestStep / dcMedian),
    slowDriftDominates: dcDriftFraction >= DC_DRIFT_SUSPECT,
    driftPeriodSec: measureDriftPeriod(slow),
    framesPerSecond: round2((frames.length - 1) / spanSec),
    longestGapMs: Math.round(longestGapMs),
    frameCount: frames.length,
  };
}

/**
 * Names the period of the dominant slow oscillation, when there is one.
 *
 * 🔴 Counts mean-crossings rather than autocorrelating, and that is a
 * correction, not a shortcut. `dominantPeriod` was the obvious tool and it is
 * the wrong one here: it normalises by the overlap, which deliberately favours
 * long lags so that a short cardiac window is not penalised — and on a clean
 * 5 s drift that sends the argmax to **lag 25**, the fifth multiple, with a
 * periodicity of 1.000. `preferFundamental` only inspects small integer
 * submultiples, so it cannot walk 25 back to 5. Bending that normalisation to
 * suit this one caller would change the cardiac and respiration estimates too.
 *
 * ⚠️ A sinusoid crosses its mean twice per cycle, and so does a square wave, so
 * both report their **full** cycle — a gain that alternates every 3 s reports
 * 6 s. That is the period of the interference, which is what the comparison
 * against a heartbeat needs.
 *
 * @param slow - One-second means of the channel, oldest first.
 * @returns The period in seconds, or null when the window holds no full cycle,
 *   or the answer falls outside what one-second buckets can resolve.
 */
function measureDriftPeriod(slow: readonly number[]): number | null {
  const spanSec = (slow.length - 1) * DC_BUCKET_SEC;
  if (spanSec < DRIFT_PERIOD_MIN_SEC) return null;

  const level = mean(slow);
  let crossings = 0;
  for (let i = 1; i < slow.length; i++) {
    if ((slow[i - 1] - level) * (slow[i] - level) < 0) crossings++;
  }
  // Too few crossings means the level went somewhere and stayed — a ramp, not
  // an oscillation. Naming a period for that would be inventing one.
  if (crossings < MIN_DRIFT_CROSSINGS) return null;

  const period = (2 * spanSec) / crossings;
  // Outside the instrument's range the answer is not wrong, it is unknown:
  // faster than two buckets is aliased, slower than the window is unsupported.
  if (period < DRIFT_PERIOD_MIN_SEC || period > DRIFT_PERIOD_MAX_SEC) return null;

  return round2(period);
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/** Linear-interpolated percentile of an already-sorted array. */
function percentile(sorted: readonly number[], p: number): number {
  const pos = (sorted.length - 1) * p;
  const lower = Math.floor(pos);
  const upper = Math.ceil(pos);
  return lower === upper
    ? sorted[lower]
    : sorted[lower] + (sorted[upper] - sorted[lower]) * (pos - lower);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}
