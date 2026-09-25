/**
 * @module biometric/ppg/filtering
 * @description Resampling, detrending and band-pass filtering for camera PPG.
 *
 * A fingertip PPG's pulse is around 1-3% of the light reaching the sensor. The
 * other 97% is DC, exposure drift, breathing wander and motion — all of it
 * larger than the thing being measured. Peak-picking a raw channel mean is
 * therefore not a shortcut to the same answer; it is a different, wrong answer.
 * This module is what makes the beat visible at all.
 */

/** Lowest heart rate the band admits, in Hz (42 bpm). */
export const PPG_BAND_LOW_HZ = 0.7;
/** Highest heart rate the band admits, in Hz (210 bpm). */
export const PPG_BAND_HIGH_HZ = 3.5;

/** Uniform grid the pipeline resamples onto. */
export const PPG_RESAMPLE_HZ = 30;

/** A gap larger than this many nominal frame intervals counts as dropped frames. */
export const DROP_GAP_FACTOR = 1.5;

/** Result of putting jittery camera timestamps onto a uniform grid. */
export interface ResampledSignal {
  /** Uniformly spaced values. */
  values: number[];
  /** Grid rate in Hz. */
  sampleRateHz: number;
  /** Timestamp of the first grid point (Unix ms). */
  startedAtMs: number;
  /** Fraction of grid points that had to be filled across a gap, 0..1. */
  gapFraction: number;
  /** Median inter-frame interval actually delivered, in ms. */
  medianFrameIntervalMs: number;
}

/**
 * Puts irregularly timed frames onto a uniform grid by linear interpolation.
 *
 * Camera frame timestamps jitter and sometimes stop; treating the frame index
 * as time is the quiet way to get a heart rate that is wrong by exactly the
 * amount the device was struggling. Interpolating over a gap is a fabrication
 * of sorts, so the fraction of interpolated points is reported and used to
 * hold the quality score down rather than hidden.
 *
 * @param timestampsMs - Frame timestamps, ascending.
 * @param values - One scalar per frame, same length.
 * @param targetHz - Grid rate.
 * @returns The resampled signal, or null when there is not enough to resample.
 */
export function resampleUniform(
  timestampsMs: readonly number[],
  values: readonly number[],
  targetHz: number = PPG_RESAMPLE_HZ,
): ResampledSignal | null {
  if (timestampsMs.length !== values.length || timestampsMs.length < 2) {
    return null;
  }

  const startedAtMs = timestampsMs[0];
  const endMs = timestampsMs[timestampsMs.length - 1];
  const spanMs = endMs - startedAtMs;
  if (spanMs <= 0) return null;

  const stepMs = 1000 / targetHz;
  const pointCount = Math.floor(spanMs / stepMs) + 1;
  if (pointCount < 2) return null;

  const deltas: number[] = [];
  for (let i = 1; i < timestampsMs.length; i++) {
    deltas.push(timestampsMs[i] - timestampsMs[i - 1]);
  }
  const medianFrameIntervalMs = median(deltas);
  const gapThresholdMs = medianFrameIntervalMs * DROP_GAP_FACTOR;

  const out: number[] = new Array<number>(pointCount);
  let gapPoints = 0;
  let cursor = 0;

  for (let i = 0; i < pointCount; i++) {
    const t = startedAtMs + i * stepMs;
    while (cursor + 2 < timestampsMs.length && timestampsMs[cursor + 1] < t) {
      cursor++;
    }
    const t0 = timestampsMs[cursor];
    const t1 = timestampsMs[cursor + 1];
    const span = t1 - t0;
    const alpha = span > 0 ? (t - t0) / span : 0;
    out[i] = values[cursor] + (values[cursor + 1] - values[cursor]) * alpha;

    if (span > gapThresholdMs) gapPoints++;
  }

  return {
    values: out,
    sampleRateHz: targetHz,
    startedAtMs,
    gapFraction: gapPoints / pointCount,
    medianFrameIntervalMs,
  };
}

/** Median of a non-empty numeric array. */
export function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/** Mean of a numeric array; 0 for an empty one. */
export function mean(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** Population standard deviation. */
export function standardDeviation(values: readonly number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  return Math.sqrt(values.reduce((sum, v) => sum + (v - m) ** 2, 0) / values.length);
}

/**
 * Smoothing coefficient of a one-pole low-pass at a given cutoff.
 *
 * @param cutoffHz - Cutoff frequency.
 * @param sampleRateHz - Sample rate.
 * @returns Coefficient in (0, 1].
 */
function poleAlpha(cutoffHz: number, sampleRateHz: number): number {
  return 1 - Math.exp((-2 * Math.PI * cutoffHz) / sampleRateHz);
}

/**
 * Zero-phase one-pole low-pass: filtered forward, then backward.
 *
 * Running it in both directions cancels the phase lag. That is not cosmetic
 * here — a one-directional filter shifts every peak by the same amount, which
 * leaves the heart rate intact but corrupts nothing so much as it flatters it,
 * while an amplitude-dependent lag moves peaks by *different* amounts and lands
 * straight in the beat intervals HRV is computed from.
 *
 * @param values - Input series.
 * @param cutoffHz - Cutoff frequency.
 * @param sampleRateHz - Sample rate.
 * @returns Filtered series, same length.
 */
export function lowPassZeroPhase(
  values: readonly number[],
  cutoffHz: number,
  sampleRateHz: number,
): number[] {
  const alpha = poleAlpha(cutoffHz, sampleRateHz);
  const forward: number[] = new Array<number>(values.length);

  let acc = values[0] ?? 0;
  for (let i = 0; i < values.length; i++) {
    acc += alpha * (values[i] - acc);
    forward[i] = acc;
  }

  const out: number[] = new Array<number>(values.length);
  acc = forward[forward.length - 1] ?? 0;
  for (let i = forward.length - 1; i >= 0; i--) {
    acc += alpha * (forward[i] - acc);
    out[i] = acc;
  }

  return out;
}

/**
 * Band-passes a signal as the difference of two zero-phase low-passes.
 *
 * Removes the DC level and the breathing wander below the band, and the sensor
 * noise above it, leaving the cardiac component.
 *
 * @param values - Input series.
 * @param sampleRateHz - Sample rate.
 * @param lowHz - Lower edge.
 * @param highHz - Upper edge.
 * @returns Band-passed series, same length.
 */
export function bandPass(
  values: readonly number[],
  sampleRateHz: number,
  lowHz: number = PPG_BAND_LOW_HZ,
  highHz: number = PPG_BAND_HIGH_HZ,
): number[] {
  const upper = lowPassZeroPhase(values, highHz, sampleRateHz);
  const lower = lowPassZeroPhase(values, lowHz, sampleRateHz);
  return upper.map((v, i) => v - lower[i]);
}

/**
 * Removes slow baseline drift by subtracting a centred moving average.
 * Used for the respiration band, where the wander IS the signal and the
 * cardiac band-pass would delete it.
 *
 * @param values - Input series.
 * @param windowSamples - Width of the moving average.
 * @returns Detrended series, same length.
 */
export function detrend(values: readonly number[], windowSamples: number): number[] {
  const half = Math.max(1, Math.floor(windowSamples / 2));
  const out: number[] = new Array<number>(values.length);

  // Prefix sums keep this linear; a naive slice per point is O(n·window) and
  // this runs on a phone.
  const prefix: number[] = new Array<number>(values.length + 1);
  prefix[0] = 0;
  for (let i = 0; i < values.length; i++) {
    prefix[i + 1] = prefix[i] + values[i];
  }

  for (let i = 0; i < values.length; i++) {
    const start = Math.max(0, i - half);
    const end = Math.min(values.length, i + half + 1);
    const avg = (prefix[end] - prefix[start]) / (end - start);
    out[i] = values[i] - avg;
  }

  return out;
}

/**
 * Pulse amplitude relative to the DC level (the perfusion index).
 *
 * Below roughly half a percent there is no fingertip on the lens, or no blood
 * reaching it, and every downstream number would be noise dressed as a pulse.
 *
 * @param rawValues - The unfiltered channel series.
 * @param bandPassed - The same series after the cardiac band-pass.
 * @returns AC/DC ratio, 0..1.
 */
export function perfusionIndex(
  rawValues: readonly number[],
  bandPassed: readonly number[],
): number {
  const dc = mean(rawValues);
  if (dc <= 0) return 0;
  // RMS→peak for a roughly sinusoidal component.
  const ac = standardDeviation(bandPassed) * Math.SQRT2;
  return Math.min(1, ac / dc);
}

/** A dominant repeating component found by autocorrelation. */
export interface DominantPeriod {
  /** Lag of the strongest correlation, in samples. */
  lagSamples: number;
  /** Normalized correlation at that lag, 0..1. */
  periodicity: number;
}

/**
 * Finds the strongest repeating component within a lag range.
 *
 * Shared by the cardiac and the respiratory estimates because both ask the same
 * question of different series: is there something periodic here, and how
 * strongly? The periodicity it returns is what lets a caller refuse — without
 * it, a dominant lag always exists and always looks like an answer.
 *
 * @param values - The series to search.
 * @param minLagSamples - Shortest lag to consider.
 * @param maxLagSamples - Longest lag to consider.
 * @returns The dominant period, or null when the series cannot support the range.
 */
export function dominantPeriod(
  values: readonly number[],
  minLagSamples: number,
  maxLagSamples: number,
): DominantPeriod | null {
  // Two full cycles at the longest lag, or the lag is longer than the evidence
  // supporting it.
  if (minLagSamples < 1 || maxLagSamples < minLagSamples || values.length < maxLagSamples * 2) {
    return null;
  }

  const m = mean(values);
  const centred = values.map((v) => v - m);
  const energy = centred.reduce((sum, v) => sum + v * v, 0);
  if (energy <= 0) return null;

  let bestLag = 0;
  let bestScore = -Infinity;

  for (let lag = minLagSamples; lag <= maxLagSamples; lag++) {
    let sum = 0;
    for (let i = 0; i + lag < centred.length; i++) {
      sum += centred[i] * centred[i + lag];
    }
    // Normalize by the overlap so long lags are not penalised for having less
    // of the window to correlate over.
    const overlap = centred.length - lag;
    const score = sum / (energy * (overlap / centred.length));

    if (score > bestScore) {
      bestScore = score;
      bestLag = lag;
    }
  }

  if (bestLag === 0) return null;

  const fundamental = preferFundamental(centred, energy, bestLag, bestScore, minLagSamples);

  return {
    lagSamples: fundamental.lag,
    periodicity: Math.max(0, Math.min(1, fundamental.score)),
  };
}

/**
 * How close a submultiple's correlation must come to the winner's before it is
 * treated as the real period. High on purpose: a genuine fundamental correlates
 * almost as strongly as its own harmonic, while an unrelated shorter lag does
 * not come near.
 */
const HARMONIC_TOLERANCE = 0.75;

/**
 * Corrects the octave error in autocorrelation.
 *
 * A signal repeating every T samples also correlates strongly at 2T and 3T, and
 * once the overlap normalization is applied the longer lag can win — reporting
 * exactly half the true rate. 🔴 Measured, not theoretical: before this
 * correction the respiration estimate returned 8 brpm for a 16 brpm fixture and
 * 10 for a 20 brpm one, dead-on at 8 and 12 the whole time, so the failure only
 * appeared above a certain rate and looked like a plausible reading at every
 * point.
 *
 * Only integer submultiples of the winning lag are considered, so this can move
 * an estimate to a shorter period only when the shorter one is the fundamental
 * the winner is a harmonic of — never onto an unrelated nearby lag.
 */
function preferFundamental(
  centred: readonly number[],
  energy: number,
  bestLag: number,
  bestScore: number,
  minLagSamples: number,
): { lag: number; score: number } {
  for (const divisor of [3, 2]) {
    const candidate = Math.round(bestLag / divisor);
    if (candidate < minLagSamples) continue;

    let sum = 0;
    for (let i = 0; i + candidate < centred.length; i++) {
      sum += centred[i] * centred[i + candidate];
    }
    const overlap = centred.length - candidate;
    const score = sum / (energy * (overlap / centred.length));

    if (score >= bestScore * HARMONIC_TOLERANCE) {
      return { lag: candidate, score };
    }
  }

  return { lag: bestLag, score: bestScore };
}
