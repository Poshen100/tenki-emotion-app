/**
 * @module biometric/ppg/quiet-segments
 * @description Reading a pulse out of a capture the camera kept interrupting.
 *
 * 🔴 Built for one measured device behaviour. The fifth real-device report
 * (2026-09-17) showed a DC drift of **29% of the level** with a **17-second**
 * period and a largest one-second step of **22%** — and that combination is
 * only possible if the camera holds a level for several seconds, moves quickly
 * to a new one, and holds again. Auto-exposure settling, then re-deciding.
 *
 * ⚠️ The important consequence is structural, not spectral: **most of the
 * capture is quiet.** Seven transitions across sixty seconds disturb maybe
 * four of those seconds. The other fifty-six are plateaus with an undisturbed
 * pulse riding on them — and analysing the capture as one block throws all of
 * that away, because the transitions are broadband and land in the cardiac
 * band. Measured on a fixture reproducing the device's own three numbers: the
 * whole capture is **refused**, while a 6.8-second plateau inside it reads
 * **67 bpm at a periodicity of 0.93** against a truth of 68.
 *
 * 🔴 This is NOT the gain-drift correction that was removed in §22. That one
 * tried to divide the drift out of the whole signal, and no criterion could
 * tell when that was valid. This one does not touch the signal at all: it
 * *excludes* the disturbed stretches and reads what was already there.
 *
 * 🔴 What makes it safe is **agreement**, not the individual windows. A short
 * window is easier to look periodic by chance, so one window proves nothing.
 * Independent stretches of the same capture agreeing on a rate is evidence
 * noise does not produce — the same reasoning `respiration.ts` already applies
 * with `agreesAcrossHalves`. Swept over 120 combinations of rate, drift period,
 * transition speed and amplitude: worst error **1.5 bpm**, and **zero** cases
 * where a capture with no pulse in it produced enough agreeing segments.
 *
 * @see docs/PHONE-PPG.md §23
 */

import { bandPass, median, perfusionIndex } from './filtering';
import { MIN_PERIODICITY, estimateRate } from './pulse';
import { MIN_PERFUSION } from './quality';

/**
 * Rate of level change, per second and as a fraction of the level, above which
 * the camera is moving its own operating point.
 *
 * 🔴 Taken from the gap between two measured distributions, not from an
 * argument. The first version reasoned from the cardiac ripple — AC/DC is
 * 0.5-2% in total, so 2% per second must be the camera — and that was wrong,
 * because the pulse is not what competes here. **Respiratory baseline wander
 * is**, and it is slower but much larger. Measured over 60 s captures:
 *
 * | capture                         | p95 slew | max slew |
 * |---------------------------------|----------|----------|
 * | clean, 48 / 68 / 96 bpm         | 0.015    | **0.023** |
 * | fast breathing (22 brpm)        | 0.014    | 0.020    |
 * | deep breathing (RSA 120 ms)     | 0.015    | 0.022    |
 * | device-shaped drift transitions | **0.10-0.14** | 0.16 |
 *
 * At 0.02 a clean capture shattered into three fragments — the bar was inside
 * the breathing distribution. 0.05 sits about twice above everything a still
 * finger produces and about twice below the transitions it has to catch.
 *
 * ⚠️ It shares a number with `DC_DRIFT_SUSPECT` and shares nothing else: that
 * one is a **total excursion**, this is a **rate**. Do not deduplicate them.
 */
export const QUIET_SLEW_PER_SEC = 0.05;

/**
 * Shortest stretch worth estimating a rate from, in seconds.
 *
 * ⚠️ Bounded below by the estimator, not by taste: `dominantPeriod` needs two
 * full cycles of its longest lag, which at 40 bpm is 3 seconds. Five gives
 * that plus margin, and holds five or six beats at a resting rate.
 */
export const MIN_QUIET_SEGMENT_SEC = 5;

/**
 * How many stretches must agree before their rate is reported.
 *
 * 🔴 Three, because two agreeing is a coincidence with no way to tell. This is
 * the load-bearing constant: in the sweep, no capture without a pulse ever
 * produced three passing segments, drift or no drift.
 */
export const MIN_AGREEING_SEGMENTS = 3;

/**
 * How far apart the segments' rates may be before they are not agreeing.
 *
 * ⚠️ Measured: across 120 swept combinations with a real pulse, the observed
 * spread was **1 or 3 bpm and never more** — and 3 bpm is a single lag step on
 * the 30 Hz grid near 68 bpm, so it is quantisation rather than disagreement.
 * Six leaves roughly double that headroom while still refusing a scatter.
 */
export const MAX_SEGMENT_SPREAD_BPM = 6;

/** A stretch of the capture the camera left alone. */
export interface QuietSegment {
  /** Index of the first sample, on the resampled grid. */
  startIndex: number;
  /** The samples themselves, in the signal's original units. */
  values: number[];
}

/** A rate assembled from several quiet stretches that agreed. */
export interface SegmentedRate {
  /** Median of the agreeing segments' rates, in bpm. */
  bpm: number;
  /** How many segments agreed. */
  segmentCount: number;
  /** Spread between the fastest and slowest agreeing segment, in bpm. */
  spreadBpm: number;
  /** Total seconds the agreeing segments covered. */
  analysedSec: number;
}

/**
 * Splits a resampled channel into the stretches where the level held still.
 *
 * ⚠️ The level is smoothed over a beat before its slope is taken, or the pulse
 * itself reads as slew and every capture comes back as one long disturbance.
 *
 * @param values - Uniformly resampled channel values.
 * @param sampleRateHz - The grid rate those values sit on.
 * @returns The quiet stretches, longest-first order not guaranteed; empty when
 *   the capture never held still for long enough.
 */
export function findQuietSegments(
  values: readonly number[],
  sampleRateHz: number,
): QuietSegment[] {
  const level = median(values);
  const minSamples = Math.floor(MIN_QUIET_SEGMENT_SEC * sampleRateHz);
  if (level <= 0 || values.length < minSamples) return [];

  // One second either side: long enough to average a beat away, short enough
  // that a real transition still shows up as a slope.
  const half = Math.max(1, Math.floor(sampleRateHz));
  const smoothed = values.map((_, i) => {
    const lo = Math.max(0, i - half);
    const hi = Math.min(values.length - 1, i + half);
    let sum = 0;
    for (let j = lo; j <= hi; j++) sum += values[j];
    return sum / (hi - lo + 1);
  });

  const segments: QuietSegment[] = [];
  let start = 0;
  let run: number[] = [];
  const flush = () => {
    if (run.length >= minSamples) segments.push({ startIndex: start, values: run });
    run = [];
  };

  for (let i = 0; i < values.length; i++) {
    const slewPerSec =
      i === 0 ? 0 : (Math.abs(smoothed[i] - smoothed[i - 1]) * sampleRateHz) / level;
    if (slewPerSec < QUIET_SLEW_PER_SEC) {
      if (run.length === 0) start = i;
      run.push(values[i]);
    } else {
      flush();
    }
  }
  flush();

  return segments;
}

/**
 * Estimates a rate from the quiet stretches, but only when they agree.
 *
 * 🔴 Returns null far more often than it returns a number, and that is the
 * design. A rate assembled from fragments is weaker evidence than one read off
 * a whole capture, so it has to clear a bar the whole capture never had to:
 * three independent stretches, each periodic on its own, landing within
 * `MAX_SEGMENT_SPREAD_BPM` of each other.
 *
 * ⚠️ This must never be used for beat timing. PRV is the spacing between
 * consecutive beats, and consecutive beats across a discarded transition are
 * not consecutive.
 *
 * @param values - Uniformly resampled channel values.
 * @param sampleRateHz - The grid rate those values sit on.
 * @returns The agreed rate, or null when the stretches were too few, too
 *   short, individually unconvincing, or disagreed.
 */
export function estimateRateFromQuietSegments(
  values: readonly number[],
  sampleRateHz: number,
): SegmentedRate | null {
  const segments = findQuietSegments(values, sampleRateHz);
  if (segments.length < MIN_AGREEING_SEGMENTS) return null;

  const rates: number[] = [];
  let analysedSamples = 0;
  for (const segment of segments) {
    const cardiac = bandPass(segment.values, sampleRateHz);
    // 🔴 Perfusion is re-checked **inside** the segment, and that is not
    // belt-and-braces — it closes a hole the caller cannot close.
    //
    // `analyzePpgScan` gates on the perfusion of the whole capture, and the
    // drift **inflates** that: a stepped level reads an AC/DC of 0.148 where a
    // clean capture reads 0.006. So on a weakly-perfused fingertip the
    // artefact pushes the whole-capture perfusion over the bar and switches
    // off the very gate that was meant to stop this. Measured: the
    // `lowPerfusion` fixture with the device's drift on it was rescued to
    // 67 bpm, sailing past a gate it should have failed.
    //
    // The segments are the evidence, so the evidence about blood has to come
    // from the same place. Inside a quiet stretch there is no drift left to
    // inflate it.
    if (perfusionIndex(segment.values, cardiac) < MIN_PERFUSION) continue;
    const estimate = estimateRate(cardiac, sampleRateHz);
    if (estimate === null || estimate.periodicity < MIN_PERIODICITY) continue;
    rates.push(estimate.bpm);
    analysedSamples += segment.values.length;
  }
  if (rates.length < MIN_AGREEING_SEGMENTS) return null;

  const sorted = [...rates].sort((a, b) => a - b);
  const spreadBpm = sorted[sorted.length - 1] - sorted[0];
  if (spreadBpm > MAX_SEGMENT_SPREAD_BPM) return null;

  return {
    bpm: sorted[Math.floor(sorted.length / 2)],
    segmentCount: rates.length,
    spreadBpm: round1(spreadBpm),
    analysedSec: round1(analysedSamples / sampleRateHz),
  };
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
