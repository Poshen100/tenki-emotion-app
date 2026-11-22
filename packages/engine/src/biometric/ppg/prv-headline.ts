/**
 * @module biometric/ppg/prv-headline
 * @description May this device show the camera Pulse Rhythm as a number on the
 * reading screen?
 *
 * 🔴 founder 2026-11-22 relaxed "Pulse Rhythm lives only in the evidence layer"
 * into "it may headline once **this phone** has been checked against a chest
 * strap". Synthetic signals cannot answer that: photon noise leaves the quality
 * score at 99 while the beat intervals are off by up to 156%
 * (`docs/PHONE-PPG.md` §13). Only paired real captures can.
 *
 * Two questions, kept separate on purpose:
 *   1. {@link assessReferenceAgreement} — did this device's camera agree with a
 *      chest strap measured AT THE SAME TIME, often enough, on more than one day?
 *   2. {@link resolvePrvHeadline} — given that, may THIS capture headline?
 *      (Its own beat-template gate still has to pass.)
 *
 * ⚠️ Why not ICC (the threshold first written in
 * `docs/research/BUSINESS-VALUE-2026-11.md`): a device is validated by the
 * people who use it, usually one. ICC divides by between-subject spread, and one
 * person's resting RMSSD barely spreads — so ICC fails a camera that is within
 * 3% every time, and could pass a sloppy one on a household with very different
 * hearts. It measures the sample, not the instrument. Relative error does not.
 *
 * What this never does: call it HRV, feed `hrvRmssdMs`, or touch Edge Score.
 * Passing here moves a number up the screen; it changes no downstream maths.
 *
 * @see docs/PHONE-PPG.md §12 (#27), §13
 */

import type { ValidationCapture } from '../validation-log';

/** Paired captures needed before the device is judged at all. */
export const MIN_REFERENCE_PAIRS = 10;

/** …spread over at least this many local days (one sitting is one context). */
export const MIN_REFERENCE_DAYS = 2;

/**
 * Median |camera − strap| / strap must stay at or below this.
 * The clean synthetic capture already under-reads by 7–9% (§13), so 10% leaves
 * almost no room beyond what the method costs by itself.
 */
export const MAX_MEDIAN_RELATIVE_ERROR = 0.1;

/**
 * 90th-percentile relative error must stay at or below this. 17% is the §13
 * knee: the error the 0.96 template threshold would have let through, rejected
 * because RMSSD's own day-to-day variation is that size — an error as large as
 * the signal is not a reading.
 */
export const MAX_P90_RELATIVE_ERROR = 0.17;

/** Where this device stands. */
export type ReferenceAgreementStatus = 'accumulating' | 'passed' | 'failed';

/** What check #27 reports. */
export interface ReferenceAgreement {
  status: ReferenceAgreementStatus;
  /** Usable pairs: resting, pulse established, gate passed, strap value entered. */
  pairCount: number;
  /** Distinct local days those pairs came from. */
  dayCount: number;
  /** Median signed (camera − strap) / strap, or null with no pairs. */
  medianBias: number | null;
  /** Median |camera − strap| / strap, or null with no pairs. */
  medianAbsError: number | null;
  /** 90th percentile (nearest rank) of the same, or null with no pairs. */
  p90AbsError: number | null;
}

/**
 * Whether a value is a usable positive number. The log is persisted across app
 * versions, so a field added later arrives as `undefined` on old rows — never
 * test those with `!== null` (see `present()` in validation-log.ts).
 */
function positive(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

/**
 * Judges this device's camera Pulse Rhythm against simultaneous chest-strap
 * RMSSD values the user typed in.
 *
 * Only resting captures count: §13's own evidence (and the 2026 meta-analysis
 * the founder's report cites) is that camera-vs-ECG agreement holds at rest and
 * not in motion — validating on a walk would test a claim nobody makes.
 *
 * @param log - Every capture attempt on this device.
 * @returns The status and the numbers behind it. Below the minimums the status
 *   is `accumulating` and no verdict is given, whatever the errors look like.
 */
export function assessReferenceAgreement(log: readonly ValidationCapture[]): ReferenceAgreement {
  const pairs = log.filter(
    (c) =>
      c.scenario === 'resting' &&
      c.accepted &&
      positive(c.prvRmssdMs) &&
      positive(c.referenceRmssdMs),
  );
  const relative = pairs.map(
    (c) => ((c.prvRmssdMs as number) - (c.referenceRmssdMs as number)) / (c.referenceRmssdMs as number),
  );
  const absolute = relative.map(Math.abs).sort((a, b) => a - b);
  const dayCount = new Set(pairs.map((c) => c.localDateKey)).size;

  const medianBias = median(relative);
  const medianAbsError = median(absolute);
  const p90AbsError =
    absolute.length === 0 ? null : round3(absolute[Math.ceil(0.9 * absolute.length) - 1]);

  let status: ReferenceAgreementStatus = 'accumulating';
  if (pairs.length >= MIN_REFERENCE_PAIRS && dayCount >= MIN_REFERENCE_DAYS) {
    // 🔴 `passed` has to be EARNED by both bounds holding. Anything else —
    // including a null that should be impossible past the minimums — fails.
    const ok =
      medianAbsError !== null &&
      p90AbsError !== null &&
      medianAbsError <= MAX_MEDIAN_RELATIVE_ERROR &&
      p90AbsError <= MAX_P90_RELATIVE_ERROR;
    status = ok ? 'passed' : 'failed';
  }

  return { status, pairCount: pairs.length, dayCount, medianBias, medianAbsError, p90AbsError };
}

/** Why the number stays in the evidence layer. */
export type PrvHeadlineWithheld = 'gate_not_passed' | 'device_not_validated' | 'device_failed_validation';

/** The headline decision for one capture. */
export type PrvHeadline =
  | { show: true; valueMs: number; layer: 'calculated' }
  | { show: false; reason: PrvHeadlineWithheld };

/**
 * May this capture's Pulse Rhythm appear on the reading screen?
 *
 * The capture's own gate is checked first: a device that passed validation
 * does not make a capture with unstable beat shapes trustworthy.
 *
 * @param agreement - This device's standing, from {@link assessReferenceAgreement}.
 * @param prvRmssdMs - This capture's Pulse Rhythm, null when its gate failed.
 * @returns Show it (always labelled as the calculated layer), or why not.
 */
export function resolvePrvHeadline(agreement: ReferenceAgreement, prvRmssdMs: number | null): PrvHeadline {
  if (!positive(prvRmssdMs)) return { show: false, reason: 'gate_not_passed' };
  if (agreement.status === 'passed') return { show: true, valueMs: prvRmssdMs, layer: 'calculated' };
  return {
    show: false,
    reason: agreement.status === 'failed' ? 'device_failed_validation' : 'device_not_validated',
  };
}

function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const value = sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  return round3(value);
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}
