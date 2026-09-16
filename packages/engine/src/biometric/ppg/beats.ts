/**
 * @module biometric/ppg/beats
 * @description Inter-beat intervals, artifact rejection, and the HRV that may
 * honestly be computed from them.
 *
 * Every function here returns null rather than a number when the evidence is
 * short. That is the whole design: a missed beat inflates one interval to
 * double and RMSSD — which squares successive differences — turns that single
 * detection error into a dramatic-looking result. An HRV the pipeline declines
 * to report costs the user a row on a screen; an HRV built on two missed beats
 * costs them a baseline that is quietly wrong for weeks.
 */

import { median } from './filtering';

/** Shortest interval that can be a real beat, in ms (200 bpm). */
export const MIN_INTERVAL_MS = 300;
/** Longest interval that can be a real beat, in ms (40 bpm). */
export const MAX_INTERVAL_MS = 1500;

/**
 * How far an interval may sit from the local median before it is treated as a
 * detection artifact rather than genuine variability.
 */
export const ARTIFACT_DEVIATION_FRACTION = 0.25;

/** Intervals on each side used to form the local median. */
const LOCAL_WINDOW = 5;

/** Fewest accepted intervals RMSSD may be computed from. */
export const MIN_INTERVALS_FOR_HRV = 20;

/** Fewest accepted intervals a respiration estimate may be computed from. */
export const MIN_INTERVALS_FOR_RESPIRATION = 24;

/**
 * Highest fraction of intervals that may be rejected before the surviving ones
 * stop describing a beat series at all.
 *
 * 🔴 Deliberately tight, and the reason is a measurement, not caution. On the
 * `irregular` fixture — a genuinely variable beat series, truth RMSSD 262 ms —
 * rejection removed 19% of the intervals and the survivors gave RMSSD 125 ms.
 * Not noise: a confident, physiological-looking number less than half the real
 * variability. Optical beat timing cannot tell a genuinely irregular beat from
 * a detection artifact, so past this fraction the survivors are a filtered
 * series that understates by an unknown amount, and the only honest output is
 * none.
 */
export const MAX_ARTIFACT_FRACTION = 0.1;

/** Intervals kept and thrown away, with the ratio between them. */
export interface IntervalSeries {
  /** Intervals that survived rejection, in ms, in time order. */
  accepted: number[];
  /**
   * Time of each accepted interval's closing beat, in ms, same order.
   * Carried through rejection because the respiration estimate needs to know
   * WHEN each surviving interval happened — dropping an interval leaves a hole
   * in time, and a tachogram indexed by position instead of time would silently
   * compress that hole away.
   */
  acceptedAtMs: number[];
  /** How many were rejected. */
  rejectedCount: number;
  /** Rejected share of all candidate intervals, 0..1. */
  artifactFraction: number;
}

/**
 * Converts peak times into inter-beat intervals.
 *
 * @param peakTimesMs - Peak times in ms, ascending.
 * @returns Successive differences.
 */
export function toIntervals(peakTimesMs: readonly number[]): number[] {
  const intervals: number[] = [];
  for (let i = 1; i < peakTimesMs.length; i++) {
    intervals.push(peakTimesMs[i] - peakTimesMs[i - 1]);
  }
  return intervals;
}

/**
 * Closing-beat time of each interval produced by `toIntervals`.
 *
 * @param peakTimesMs - Peak times in ms, ascending.
 * @returns One timestamp per interval.
 */
export function intervalTimes(peakTimesMs: readonly number[]): number[] {
  return peakTimesMs.slice(1);
}

/**
 * Rejects intervals that are not plausible beats.
 *
 * Two rules, because they catch different mistakes. The absolute range catches
 * a wholly missed or doubled beat. The local-median rule catches the subtler
 * case: an interval well inside the physiological range that still cannot
 * follow its neighbours — which is what a peak detected on a motion spike looks
 * like.
 *
 * @param intervals - Candidate intervals in ms.
 * @param timesMs - Closing-beat time of each interval; defaults to none.
 * @returns Accepted intervals, their times, and the artifact fraction.
 */
export function rejectArtifacts(
  intervals: readonly number[],
  timesMs: readonly number[] = [],
): IntervalSeries {
  if (intervals.length === 0) {
    return { accepted: [], acceptedAtMs: [], rejectedCount: 0, artifactFraction: 0 };
  }

  const accepted: number[] = [];
  const acceptedAtMs: number[] = [];
  let rejectedCount = 0;

  for (let i = 0; i < intervals.length; i++) {
    const interval = intervals[i];

    if (interval < MIN_INTERVAL_MS || interval > MAX_INTERVAL_MS) {
      rejectedCount++;
      continue;
    }

    const start = Math.max(0, i - LOCAL_WINDOW);
    const end = Math.min(intervals.length, i + LOCAL_WINDOW + 1);
    const neighbours = intervals
      .slice(start, end)
      .filter((v, idx) => start + idx !== i && v >= MIN_INTERVAL_MS && v <= MAX_INTERVAL_MS);

    // With no plausible neighbours there is nothing to be an outlier against,
    // and inventing a verdict would be worse than accepting the interval.
    if (neighbours.length === 0) {
      accepted.push(interval);
      if (timesMs[i] !== undefined) acceptedAtMs.push(timesMs[i]);
      continue;
    }

    const local = median(neighbours);
    if (local > 0 && Math.abs(interval - local) / local > ARTIFACT_DEVIATION_FRACTION) {
      rejectedCount++;
      continue;
    }

    accepted.push(interval);
    if (timesMs[i] !== undefined) acceptedAtMs.push(timesMs[i]);
  }

  return {
    accepted,
    acceptedAtMs,
    rejectedCount,
    artifactFraction: rejectedCount / intervals.length,
  };
}

/**
 * RMSSD over accepted intervals.
 *
 * @param intervals - Accepted intervals in ms.
 * @param minIntervals - Minimum count required.
 * @returns RMSSD in ms, or null when there is not enough to compute one.
 */
export function computeRmssd(
  intervals: readonly number[],
  minIntervals: number = MIN_INTERVALS_FOR_HRV,
): number | null {
  if (intervals.length < minIntervals) return null;

  let sum = 0;
  for (let i = 1; i < intervals.length; i++) {
    sum += (intervals[i] - intervals[i - 1]) ** 2;
  }
  const rmssd = Math.sqrt(sum / (intervals.length - 1));
  return Math.round(rmssd * 10) / 10;
}

/**
 * SDNN over accepted intervals. Reported separately from RMSSD and never
 * converted into it — they are different statistics over different time
 * structure (see `biometric/hrv.ts`).
 *
 * @param intervals - Accepted intervals in ms.
 * @param minIntervals - Minimum count required.
 * @returns SDNN in ms, or null.
 */
export function computeSdnn(
  intervals: readonly number[],
  minIntervals: number = MIN_INTERVALS_FOR_HRV,
): number | null {
  if (intervals.length < minIntervals) return null;

  const m = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  const variance = intervals.reduce((sum, v) => sum + (v - m) ** 2, 0) / (intervals.length - 1);
  return Math.round(Math.sqrt(variance) * 10) / 10;
}

/**
 * Heart rate from accepted intervals, using the median rather than the mean so
 * one surviving outlier cannot move the reported rate.
 *
 * @param intervals - Accepted intervals in ms.
 * @returns Heart rate in bpm, or null when there are no intervals.
 */
export function heartRateFromIntervals(intervals: readonly number[]): number | null {
  if (intervals.length === 0) return null;
  const m = median(intervals);
  if (m <= 0) return null;
  return Math.round(60_000 / m);
}
