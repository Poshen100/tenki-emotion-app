/**
 * @module biometric/ppg/repeatability
 * @description How reproducible this scan's HRV was — the system's own noise
 * floor, measured from the scan itself.
 *
 * Why this exists, in one measurement: a simulated user whose physiological
 * state never changed produced Edge Scores spanning 47–87 with a standard
 * deviation of ~12. Sweeping the ratio of real day-to-day variation against
 * measurement noise showed the score's *spread stays the same* across that
 * whole sweep — 12.2 when only a third of the movement was real, 11.3 when
 * 97% of it was. The picture on screen is identical. Nothing in the product
 * could tell those two worlds apart, because nothing had ever measured how
 * noisy the measurement itself is.
 *
 * That is what this module measures. A single scan is cut into consecutive
 * windows, RMSSD is computed for each, and the spread between them is this
 * scan's repeatability: how differently the same body, the same finger and the
 * same phone read across one sitting.
 *
 * Two properties make it usable (both measured against the synthetic fixtures):
 *
 *  1. **It tracks quality, so it is personal rather than a constant.** A clean
 *     scan reads 2.09 ms; a lightly moving finger reads 15.89 ms — 7.6× — and
 *     a scan with dropped frames reads 7.51 ms while its quality SCORE still
 *     says 92. Repeatability catches what the quality score misses.
 *  2. **It over-estimates, which is the safe direction.** It runs 1.2–1.8×
 *     larger than the actual scan-to-scan spread, because a short window holds
 *     fewer beats than a full one. A noise floor should err high: claiming more
 *     precision than you have is the failure that matters.
 *
 * ⚠️ This is NOT a substitute for a baseline's spread. It measures variation
 * within one sitting; a baseline's spread must also contain real day-to-day
 * physiological change, which is strictly larger. It is a FLOOR — the point
 * below which a difference cannot be distinguished from the instrument.
 */

import { computeRmssd } from './beats';
import { standardDeviation } from './filtering';

/** Length of each window the scan is cut into. */
export const REPEATABILITY_WINDOW_SEC = 30;

/** Fewest windows that can produce a spread at all. */
export const MIN_WINDOWS_FOR_REPEATABILITY = 2;

/**
 * Fewest intervals a window needs before its RMSSD is worth comparing.
 * Lower than `MIN_INTERVALS_FOR_HRV` on purpose: these values are never
 * reported to the user, they are only compared with each other.
 */
export const MIN_INTERVALS_PER_WINDOW = 12;

/** How reproducible one scan's HRV was. */
export interface Repeatability {
  /** Spread of RMSSD between windows, in ms. */
  sdMs: number;
  /** Windows that produced a comparable value. */
  windowCount: number;
  /** Length of each window, in seconds. */
  windowSec: number;
}

/**
 * Measures how much this scan's HRV moved across its own duration.
 *
 * @param intervalsMs - Accepted inter-beat intervals, in time order.
 * @param timesMs - Closing-beat time of each interval, same order and length.
 * @param windowSec - Window length; defaults to `REPEATABILITY_WINDOW_SEC`.
 * @returns The spread, or null when the scan is too short or too sparse to
 *   produce at least two comparable windows.
 */
export function estimateRepeatability(
  intervalsMs: readonly number[],
  timesMs: readonly number[],
  windowSec: number = REPEATABILITY_WINDOW_SEC,
): Repeatability | null {
  if (intervalsMs.length !== timesMs.length || timesMs.length === 0) {
    return null;
  }

  const windowMs = windowSec * 1000;
  const start = timesMs[0];
  const end = timesMs[timesMs.length - 1];

  const perWindow: number[] = [];

  for (let from = start; from + windowMs <= end + 1; from += windowMs) {
    const slice: number[] = [];
    for (let i = 0; i < timesMs.length; i++) {
      if (timesMs[i] >= from && timesMs[i] < from + windowMs) {
        slice.push(intervalsMs[i]);
      }
    }

    const rmssd = computeRmssd(slice, MIN_INTERVALS_PER_WINDOW);
    if (rmssd !== null) perWindow.push(rmssd);
  }

  if (perWindow.length < MIN_WINDOWS_FOR_REPEATABILITY) {
    return null;
  }

  return {
    sdMs: Math.round(standardDeviation(perWindow) * 100) / 100,
    windowCount: perWindow.length,
    windowSec,
  };
}
