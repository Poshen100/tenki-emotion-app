/**
 * @module intelligence/calibration
 * @description Calibration Proof — the anti-pattern pillar.
 *
 * Most wellness software is built to make the user feel that the intervention
 * worked. This module is built to report what actually happened, including
 * `no_clear_shift`, which is a **result, not a failure**. That honesty is the
 * feature: a system that admits "nothing moved" is the only kind whose "it
 * moved" means anything.
 *
 * 🔴 The meaningful-shift threshold is derived from the user's OWN variability,
 * never a fixed number. For someone whose readings swing 20 points day to day,
 * +3 is noise; for someone steady within 4, +3 is real. A fixed threshold would
 * quietly manufacture success for the first person and hide it from the second.
 *
 * @version 3.0
 * @see docs/DECISION-INTELLIGENCE.md § 4.2
 */

import { MIN_MEANINGFUL_STD, type PersonalReference } from './drift';
import {
  buildEvidence,
  countDistinctDays,
  insufficientEvidence,
  type EvidenceBasis,
  type EvidenceReasonCode,
  type EvidenceRequirement,
  type InsufficientEvidence,
} from './evidence';

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

/**
 * Evidence a calibration verdict must clear. The before/after pair is itself
 * two samples, so the floor is 2 — but reaching high confidence needs prior
 * calibrations, because a single pair cannot separate "the reset moved it" from
 * "it moved anyway".
 */
export const CALIBRATION_EVIDENCE_REQUIREMENT: EvidenceRequirement = {
  minSamples: 2,
  moderateSamples: 2,
  highSamples: 8,
  highWindowDays: 5,
};

/**
 * Smallest shift (readiness points) that may ever be called a change, whatever
 * the user's spread. Guards the other direction from {@link SHIFT_STD_FRACTION}:
 * a perfectly steady user must not have every 1-point wobble called a result.
 */
export const MIN_MEANINGFUL_SHIFT = 3;

/**
 * Fraction of the user's own spread that counts as a meaningful shift. Half a
 * standard deviation is the conventional "small but real" effect size, used
 * here as a v0 heuristic — not yet validated against real user outcomes.
 */
export const SHIFT_STD_FRACTION = 0.5;

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

/** What a calibration did to the reading. */
export type CalibrationVerdict = 'improved' | 'no_clear_shift' | 'declined';

/** One reading in a calibration pair. */
export interface CalibrationReading {
  /** Readiness value on the canonical 0-100 axis. */
  value: number;
  /** When it was taken (Unix ms). */
  ts: number;
  /**
   * Identifier of the capture conditions (source + tier). The two readings must
   * carry the same one — comparing a face-scan reading against a wearable one
   * measures the change of instrument, not the change of state.
   */
  captureId: string;
}

/** A previous calibration of the same kind, for context. */
export interface PriorCalibration {
  /** Signed shift that calibration produced, in readiness points. */
  shift: number;
  /** When it happened (Unix ms). */
  ts: number;
}

/** Inputs to {@link assessCalibration}. */
export interface CalibrationInput {
  /** Reading taken before the intervention. */
  before: CalibrationReading;
  /** Reading taken after it. */
  after: CalibrationReading;
  /**
   * The user's personal reference, which supplies the spread the threshold is
   * derived from. Null when no reference exists yet — the threshold then falls
   * back to {@link MIN_MEANINGFUL_SHIFT} and the evidence says so.
   */
  reference: PersonalReference | null;
  /** Prior calibrations of the same kind, for "5 of your last 7" context. */
  priors?: readonly PriorCalibration[];
}

/** How this calibration compares to the user's previous ones. */
export interface PriorCalibrationSummary {
  /** How many prior calibrations were available. */
  total: number;
  /** How many of them reached the same verdict as this one. */
  similar: number;
}

/** A calibration verdict, with the evidence that permits it. */
export interface CalibrationProof {
  /** Discriminant: this result carries a verdict. */
  state: 'assessed';
  /** What the calibration did. */
  verdict: CalibrationVerdict;
  /** Signed change in readiness points (after − before). */
  shift: number;
  /** The threshold this shift was judged against. */
  threshold: number;
  /** The reading before the intervention. */
  before: number;
  /** The reading after it. */
  after: number;
  /** How this compares with prior calibrations, or null when there are none. */
  priorSummary: PriorCalibrationSummary | null;
  /** What backs the verdict. */
  evidence: EvidenceBasis;
}

/** Either a calibration verdict, or an honest refusal to reach one. */
export type CalibrationResult = CalibrationProof | InsufficientEvidence;

// ─────────────────────────────────────────────
// Threshold
// ─────────────────────────────────────────────

/**
 * Derives the smallest shift that may be called a change for this user.
 *
 * @param reference - The user's personal reference, or null when none exists.
 * @returns The threshold in readiness points, never below {@link MIN_MEANINGFUL_SHIFT}.
 */
export function meaningfulShiftThreshold(reference: PersonalReference | null): number {
  if (!reference || reference.std < MIN_MEANINGFUL_STD) return MIN_MEANINGFUL_SHIFT;
  return Math.max(MIN_MEANINGFUL_SHIFT, round1(reference.std * SHIFT_STD_FRACTION));
}

/**
 * Classifies a shift against a threshold.
 *
 * @param shift - Signed change in readiness points.
 * @param threshold - The meaningful-shift threshold.
 * @returns The verdict; anything inside the threshold is `no_clear_shift`.
 */
export function classifyShift(shift: number, threshold: number): CalibrationVerdict {
  if (shift >= threshold) return 'improved';
  if (shift <= -threshold) return 'declined';
  return 'no_clear_shift';
}

/**
 * Summarizes how often prior calibrations reached the same verdict.
 *
 * @param priors - Prior calibrations of the same kind.
 * @param threshold - Threshold to classify them against (this user's, today's).
 * @param verdict - The verdict reached this time.
 * @returns Totals, or null when there are no priors to compare with.
 */
export function summarizePriors(
  priors: readonly PriorCalibration[],
  threshold: number,
  verdict: CalibrationVerdict
): PriorCalibrationSummary | null {
  if (priors.length === 0) return null;
  const usable = priors.filter((p) => Number.isFinite(p.shift));
  if (usable.length === 0) return null;
  return {
    total: usable.length,
    similar: usable.filter((p) => classifyShift(p.shift, threshold) === verdict).length,
  };
}

// ─────────────────────────────────────────────
// Assessment
// ─────────────────────────────────────────────

/**
 * Assesses what a calibration actually did to the user's reading.
 *
 * Refuses (returns {@link InsufficientEvidence}) when the two readings were not
 * captured under the same conditions, or when either value is not a finite
 * number — in both cases the difference would measure the instrument rather
 * than the person.
 *
 * @param input - The before/after pair, the personal reference, and prior calibrations.
 * @returns A calibration proof with its evidence, or an insufficient-evidence result.
 */
export function assessCalibration(input: CalibrationInput): CalibrationResult {
  const { before, after } = input;
  const priors = input.priors ?? [];
  const timestamps = [before.ts, after.ts, ...priors.map((p) => p.ts)];

  const evidenceInput = {
    sampleCount: 2 + priors.length,
    windowDays: countDistinctDays(timestamps),
    provenance: ['measured', 'behavioral'] as const,
    requirement: CALIBRATION_EVIDENCE_REQUIREMENT,
  };

  const valuesUsable = Number.isFinite(before.value) && Number.isFinite(after.value);
  const sameConditions = before.captureId === after.captureId;

  if (!valuesUsable || !sameConditions) {
    return insufficientEvidence({
      ...evidenceInput,
      sampleCount: 0,
      extraReasons: sameConditions ? [] : ['mixed_capture_conditions'],
    });
  }

  const threshold = meaningfulShiftThreshold(input.reference);
  const shift = round1(after.value - before.value);
  const verdict = classifyShift(shift, threshold);

  const extraReasons: EvidenceReasonCode[] = [];
  if (!input.reference || input.reference.std < MIN_MEANINGFUL_STD) {
    // The threshold fell back to the floor because the user's own spread is not
    // yet known — say so rather than presenting a personalized-looking verdict.
    extraReasons.push('low_variability_reference');
  }

  return {
    state: 'assessed',
    verdict,
    shift,
    threshold,
    before: round1(before.value),
    after: round1(after.value),
    priorSummary: summarizePriors(priors, threshold, verdict),
    evidence: buildEvidence({ ...evidenceInput, extraReasons }),
  };
}

/**
 * Type guard for a calibration result that carries a verdict.
 *
 * @param result - The calibration result to narrow.
 * @returns True when the result is a proof rather than a refusal.
 */
export function isCalibrationAssessed(result: CalibrationResult): result is CalibrationProof {
  return result.state === 'assessed';
}

/**
 * Rounds to one decimal — readiness points are reported to the tenth, never further.
 *
 * @param value - Raw value.
 * @returns Value rounded to one decimal place.
 */
function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
