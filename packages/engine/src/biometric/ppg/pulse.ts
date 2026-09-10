/**
 * @module biometric/ppg/pulse
 * @description Rate estimation and beat detection on a band-passed PPG.
 *
 * Two independent estimates of the same thing, on purpose:
 *
 *   - **Autocorrelation** gives a rate that does not depend on any individual
 *     peak surviving, plus a periodicity score that says whether the window
 *     contains a repeating pulse at all. That score is what separates "a heart
 *     rate" from "a number computed from noise".
 *   - **Peak detection** gives the beat times HRV needs, which autocorrelation
 *     cannot provide.
 *
 * The peak detector is seeded with the autocorrelation period so its refractory
 * window is set from the signal rather than from an assumed rate. Without that,
 * the dicrotic notch of each beat gets counted and the reported rate doubles.
 */

import { dominantPeriod, mean, standardDeviation } from './filtering';

/** Slowest heart rate accepted, in bpm. */
export const MIN_PLAUSIBLE_BPM = 40;
/** Fastest heart rate accepted, in bpm. */
export const MAX_PLAUSIBLE_BPM = 200;

/**
 * Minimum normalized autocorrelation at the dominant lag for the window to be
 * called periodic. Below this the signal has no repeating pulse and no rate may
 * be reported from it.
 */
export const MIN_PERIODICITY = 0.35;

/** Refractory period as a fraction of the estimated beat interval. */
const REFRACTORY_FRACTION = 0.55;

/** Peak threshold above the local mean, in local standard deviations. */
const PEAK_THRESHOLD_SD = 0.35;

/** A detected pulse peak. */
export interface PulsePeak {
  /**
   * Time of the peak apex in ms from the start of the window. Sub-sample:
   * at 30 fps one frame is 33 ms, which is comparable to the whole RMSSD being
   * measured, so the apex is interpolated rather than rounded to a frame.
   */
  timeMs: number;
  /** Amplitude at the apex. */
  amplitude: number;
}

/** Result of the autocorrelation rate estimate. */
export interface RateEstimate {
  /** Dominant rate in bpm. */
  bpm: number;
  /** Normalized autocorrelation at the dominant lag, 0..1. */
  periodicity: number;
  /** Dominant period in samples. */
  periodSamples: number;
}

/**
 * Finds the dominant cardiac period by autocorrelation.
 *
 * @param values - Band-passed signal.
 * @param sampleRateHz - Sample rate.
 * @returns The estimate, or null when the window is too short to hold two beats.
 */
export function estimateRate(
  values: readonly number[],
  sampleRateHz: number,
): RateEstimate | null {
  const minLag = Math.floor((60 / MAX_PLAUSIBLE_BPM) * sampleRateHz);
  const maxLag = Math.ceil((60 / MIN_PLAUSIBLE_BPM) * sampleRateHz);

  const found = dominantPeriod(values, minLag, maxLag);
  if (found === null) return null;

  return {
    bpm: (60 * sampleRateHz) / found.lagSamples,
    periodicity: found.periodicity,
    periodSamples: found.lagSamples,
  };
}

/**
 * Detects beat peaks with an adaptive threshold and a refractory window.
 *
 * @param values - Band-passed signal.
 * @param sampleRateHz - Sample rate.
 * @param periodSamples - Expected beat period, from `estimateRate`.
 * @returns Peaks in time order.
 */
export function detectPulsePeaks(
  values: readonly number[],
  sampleRateHz: number,
  periodSamples: number,
): PulsePeak[] {
  const refractory = Math.max(1, Math.floor(periodSamples * REFRACTORY_FRACTION));
  // Threshold tracks a window of a few beats so a drifting pulse amplitude does
  // not silently stop producing peaks half-way through the scan.
  const windowSamples = Math.max(refractory * 4, Math.floor(sampleRateHz * 2));

  const peaks: PulsePeak[] = [];
  let lastPeakIndex = -Infinity;

  for (let i = 1; i < values.length - 1; i++) {
    const value = values[i];
    if (value <= values[i - 1] || value < values[i + 1]) continue;

    const start = Math.max(0, i - windowSamples);
    const end = Math.min(values.length, i + windowSamples);
    const local = values.slice(start, end);
    const threshold = mean(local) + PEAK_THRESHOLD_SD * standardDeviation(local);
    if (value < threshold) continue;

    if (i - lastPeakIndex < refractory) {
      // Inside the refractory window: keep only the taller of the two, which is
      // how the systolic peak wins over the dicrotic bump that follows it.
      const previous = peaks[peaks.length - 1];
      if (previous !== undefined && value > previous.amplitude) {
        peaks[peaks.length - 1] = interpolatePeak(values, i, sampleRateHz);
        lastPeakIndex = i;
      }
      continue;
    }

    peaks.push(interpolatePeak(values, i, sampleRateHz));
    lastPeakIndex = i;
  }

  return peaks;
}

/**
 * Refines a peak's position to sub-sample resolution by fitting a parabola
 * through it and its two neighbours.
 *
 * @param values - The signal.
 * @param index - Index of the sample at the apex.
 * @param sampleRateHz - Sample rate.
 * @returns The interpolated peak.
 */
function interpolatePeak(
  values: readonly number[],
  index: number,
  sampleRateHz: number,
): PulsePeak {
  const y0 = values[index - 1];
  const y1 = values[index];
  const y2 = values[index + 1];
  const denominator = y0 - 2 * y1 + y2;

  // A flat or upward-curving triple has no parabolic apex to solve for.
  const offset = denominator !== 0 ? (0.5 * (y0 - y2)) / denominator : 0;
  const clamped = Math.max(-0.5, Math.min(0.5, offset));

  return {
    timeMs: ((index + clamped) / sampleRateHz) * 1000,
    amplitude: y1,
  };
}
