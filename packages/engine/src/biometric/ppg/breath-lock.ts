/**
 * @module biometric/ppg/breath-lock
 * @description The contract a camera-derived respiratory rate has to satisfy
 * before it may exist at all.
 *
 * 🔴 founder rule, 2026-09-11: camera respiratory rate *"may be researched and
 * released only as a standalone Breath Lock measurement"*. Not a by-product of
 * a pulse scan, not a field that appears when the beat timing happens to look
 * periodic — its own capture, its own protocol, its own gates, and a comparison
 * against a reference source before anyone is shown a number.
 *
 * This module is that contract. **The capture layer does not exist yet**, and
 * `camera_breath_lock` is off, so nothing here produces a user-facing reading
 * today. It exists so that when the capture layer is written it cannot be
 * wired up any other way, and so the rules are checkable rather than
 * remembered.
 *
 * What Breath Lock is never allowed to become:
 *   - clinical respiratory monitoring;
 *   - a basis for inferring stress, anxiety, disease, sleep apnea or
 *     respiratory illness;
 *   - a silent contributor to the Edge Score — it moves the score only within
 *     the phone evidence cap (`PHONE_EVIDENCE_CAPS.breath`), and when its
 *     quality fails it disappears from inference rather than degrading.
 *
 * @see docs/PHONE-PPG.md
 */

import type { PpgFrame } from './types';

/**
 * The capture protocol, in seconds.
 *
 * 🔴 A RANGE with a hard floor, not a target. Respiration at 12 breaths per
 * minute is one cycle every five seconds; 45 seconds is nine cycles, which is
 * the fewest worth estimating a rate and a rhythm consistency from. Above 60
 * the user has usually stopped breathing naturally and started performing
 * breathing, which measures something else.
 */
export const BREATH_LOCK_MIN_SEC = 45;
export const BREATH_LOCK_MAX_SEC = 60;

/** Breaths per minute below/above which a camera estimate is not plausible. */
export const BREATH_LOCK_MIN_BRPM = 6;
export const BREATH_LOCK_MAX_BRPM = 30;

/**
 * How closely two independent respiratory estimates must agree before their
 * agreement may raise confidence, in breaths per minute.
 *
 * ⚠️ 2 brpm is the convention respiratory-rate devices are usually compared at,
 * NOT something measured here — TENKI has no second respiratory source to
 * calibrate against yet. It must be re-derived against a reference device
 * during validation (docs/PHONE-PPG.md §12), and until then it is a placeholder
 * with a named origin rather than a number someone picked.
 */
export const BREATH_AGREEMENT_BRPM = 2;

/** Where a respiratory estimate came from. */
export const BREATH_SOURCES = [
  'camera_ppg_derived',
  'front_camera_motion',
  'phone_imu',
  'wearable',
] as const;
export type BreathSource = typeof BREATH_SOURCES[number];

/** Why a Breath Lock capture was refused. Its own list, not the pulse's. */
export const BREATH_LOCK_REJECTION_REASONS = [
  /** Capture ran for less than `BREATH_LOCK_MIN_SEC`. */
  'capture_too_short',
  /** Capture ran past `BREATH_LOCK_MAX_SEC` — no longer natural breathing. */
  'capture_too_long',
  /** Too few usable frames within the capture window. */
  'insufficient_usable_frames',
  /** No respiratory periodicity stood out from the noise. */
  'no_respiratory_rhythm',
  /** The rhythm changed between the capture's halves. */
  'rhythm_not_sustained',
  /** The estimate fell outside the plausible range. */
  'implausible_rate',
  /** The beat series the estimate rests on was not trustworthy. */
  'beat_timing_unreliable',
  /** Two independent sources disagreed by more than the agreement window. */
  'source_conflict',
] as const;
export type BreathLockRejectionReason = typeof BREATH_LOCK_REJECTION_REASONS[number];

/** What the device could actually do during this capture. */
export interface BreathLockDeviceCapability {
  /** Whether a torch was available and on. */
  torch: boolean;
  /** Frames per second the capture layer sustained. */
  sampledHz: number;
  /** Which source produced the estimate. */
  source: BreathSource;
}

/** The conditions the capture ran under. Recorded, never guessed. */
export interface BreathLockContext {
  /** Posture, as the user reported it. */
  posture: 'sitting' | 'lying' | 'standing' | 'unknown';
  /**
   * Whether the user was asked to breathe naturally or to follow a pace.
   *
   * 🔴 A paced capture measures the pacing, not the person. It is recorded so a
   * paced reading can never be compared against a natural one.
   */
  breathing: 'natural' | 'paced';
}

/** What Breath Lock reports about its own signal. Independent of the pulse gates. */
export interface BreathLockQuality {
  /** Seconds of signal actually analysed. */
  captureDurationSec: number;
  /** Frames that met the capture layer's own limits. */
  usableFrameCount: number;
  /** Strength of the respiratory periodicity, 0..1. */
  rhythmCoherence: number;
  /** Agreement between the capture's two halves, 0..1. */
  rhythmSustained: number;
  /** True when every gate passed. */
  accepted: boolean;
  /** Every gate that did not. Empty on an accepted capture. */
  rejectionReasons: BreathLockRejectionReason[];
}

/** One Breath Lock measurement, with everything needed to judge it. */
export interface BreathLockResult {
  /**
   * Breaths per minute, or null.
   *
   * 🔴 Labelled **camera-derived respiratory rate** wherever it is shown. Never
   * "respiration", never "breathing rate" unqualified, and never presented as
   * monitoring.
   */
  respiratoryRateBrpm: number | null;
  capturedAtMs: number;
  capability: BreathLockDeviceCapability;
  context: BreathLockContext;
  quality: BreathLockQuality;
}

/** Inputs the gate is evaluated from. */
export interface BreathLockInput {
  frames: readonly PpgFrame[];
  /** Seconds of signal analysed. */
  durationSec: number;
  /** Frames that met the capture layer's limits. */
  usableFrameCount: number;
  /** Respiratory periodicity strength, 0..1. */
  rhythmCoherence: number;
  /** Agreement between the capture's halves, 0..1. */
  rhythmSustained: number;
  /** The candidate rate, or null when none was found. */
  candidateBrpm: number | null;
  /** Whether the beat series the estimate rests on was itself trustworthy. */
  beatTimingReliable: boolean;
}

/** Coherence a respiratory rhythm must reach to be called one. */
export const MIN_BREATH_COHERENCE = 0.5;
/** Agreement between halves below which the rhythm did not hold. */
export const MIN_BREATH_SUSTAINED = 0.6;
/** Fewest usable frames: `BREATH_LOCK_MIN_SEC` at a conservative 15 fps. */
export const MIN_BREATH_USABLE_FRAMES = BREATH_LOCK_MIN_SEC * 15;

/**
 * Applies the Breath Lock gates.
 *
 * 🔴 Every gate is independent of the pulse gates. A capture that produced a
 * perfect Pulse Anchor can fail every one of these, and must.
 *
 * @param input - What the capture layer measured.
 * @returns The quality verdict, with every failed gate named.
 */
export function assessBreathLock(input: BreathLockInput): BreathLockQuality {
  const rejectionReasons: BreathLockRejectionReason[] = [];

  if (input.durationSec < BREATH_LOCK_MIN_SEC) rejectionReasons.push('capture_too_short');
  if (input.durationSec > BREATH_LOCK_MAX_SEC) rejectionReasons.push('capture_too_long');
  if (input.usableFrameCount < MIN_BREATH_USABLE_FRAMES) {
    rejectionReasons.push('insufficient_usable_frames');
  }
  if (!input.beatTimingReliable) rejectionReasons.push('beat_timing_unreliable');
  if (input.rhythmCoherence < MIN_BREATH_COHERENCE) rejectionReasons.push('no_respiratory_rhythm');
  if (input.rhythmSustained < MIN_BREATH_SUSTAINED) rejectionReasons.push('rhythm_not_sustained');
  if (
    input.candidateBrpm === null ||
    input.candidateBrpm < BREATH_LOCK_MIN_BRPM ||
    input.candidateBrpm > BREATH_LOCK_MAX_BRPM
  ) {
    rejectionReasons.push('implausible_rate');
  }

  return {
    captureDurationSec: Math.round(input.durationSec * 10) / 10,
    usableFrameCount: input.usableFrameCount,
    rhythmCoherence: Math.round(input.rhythmCoherence * 100) / 100,
    rhythmSustained: Math.round(input.rhythmSustained * 100) / 100,
    accepted: rejectionReasons.length === 0,
    rejectionReasons,
  };
}

/** One source's respiratory estimate. */
export interface BreathEstimate {
  brpm: number;
  source: BreathSource;
}

/** What two independent respiratory estimates add up to. */
export type BreathAgreement =
  /** Only one source had a usable estimate. Confidence is unchanged. */
  | { status: 'single'; brpm: number; source: BreathSource }
  /** Both agreed within the window. Confidence may rise. */
  | { status: 'agree'; brpm: number; sources: BreathSource[]; differenceBrpm: number }
  /**
   * They disagreed materially. 🔴 There is no rate in this outcome, on purpose.
   */
  | { status: 'conflict'; sources: BreathSource[]; differenceBrpm: number }
  /** Neither source had anything. */
  | { status: 'none' };

/**
 * Reconciles two independent respiratory estimates.
 *
 * 🔴 **Never averages.** Two sources 6 brpm apart do not make a trustworthy
 * number in the middle — they make one source wrong, and the mean of a right
 * answer and a wrong one is a third wrong answer wearing a decimal point. A
 * material disagreement returns `conflict` with no rate, and the surface says
 * "signal conflict" or shows nothing.
 *
 * @param a - First estimate, or null when that source had none.
 * @param b - Second estimate, or null.
 * @returns What may be claimed from the pair.
 */
export function reconcileBreathSources(
  a: BreathEstimate | null,
  b: BreathEstimate | null,
): BreathAgreement {
  if (a === null && b === null) return { status: 'none' };
  if (a === null) return { status: 'single', brpm: (b as BreathEstimate).brpm, source: (b as BreathEstimate).source };
  if (b === null) return { status: 'single', brpm: a.brpm, source: a.source };

  const differenceBrpm = Math.round(Math.abs(a.brpm - b.brpm) * 10) / 10;
  if (differenceBrpm > BREATH_AGREEMENT_BRPM) {
    return { status: 'conflict', sources: [a.source, b.source], differenceBrpm };
  }

  return {
    // Within the agreement window the two are the same measurement twice, so
    // reporting either is honest. The LOWER is reported rather than the mean,
    // so that nothing in this function ever produces a value neither source
    // measured.
    status: 'agree',
    brpm: Math.min(a.brpm, b.brpm),
    sources: [a.source, b.source],
    differenceBrpm,
  };
}
