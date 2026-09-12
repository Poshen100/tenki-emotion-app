/**
 * @module biometric/ppg/quality
 * @description Signal quality and confidence for a camera PPG window.
 *
 * Quality is not a decoration on the result — it is the thing that decides
 * which results exist. Every gate downstream reads this score, so it has to be
 * built from the conditions that actually break fingertip PPG rather than from
 * whatever was convenient to measure.
 *
 * Score and confidence stay separate, and neither is the reading. A user can
 * have a perfectly measured Strain state (high quality, high confidence, low
 * Edge Score) or a barely-measured Clear one. Collapsing the two would make
 * every uncertain scan look like a bad state.
 */

import { mean, standardDeviation } from './filtering';
import type { PpgFrame, PpgQuality, PpgQualityComponents, PpgQualityReason } from './types';

/**
 * Perfusion below which there is no usable pulse in the light.
 *
 * 🔴 These two numbers are calibrated against what `perfusionIndex()` actually
 * returns, not against the textbook 1-3% perfusion index. The measure here is
 * RMS-based over a band-passed signal whose pulse shape is a narrow spike, so a
 * healthy synthetic fingertip reads 0.0062, half perfusion reads 0.0032, and a
 * barely-perfused one reads 0.00096. Thresholds set from the textbook range
 * instead would have marked every good scan `weak_pulse` — and the first
 * version of this file did exactly that until the fixtures were measured.
 * Re-measure both if `perfusionIndex` changes.
 */
export const MIN_PERFUSION = 0.0015;
/** Perfusion at or above which perfusion stops limiting the score. */
export const GOOD_PERFUSION = 0.0055;

/** Mean coverage below which the fingertip is not really on the lens. */
export const MIN_COVERAGE = 0.7;

/** Mean motion above which beat timing cannot be trusted. */
export const MAX_MOTION = 0.35;

/** Clipped-pixel fraction above which the waveform's apex is being cut off. */
export const MAX_CLIPPING = 0.05;

/** Frame-drop fraction above which the timebase itself is unreliable. */
export const MAX_FRAME_DROPS = 0.25;

/** Periodicity that scores 0 on the rhythm component. */
export const PERIODICITY_AT_ZERO = 0.2;
/** Periodicity at which the rhythm component saturates. */
export const PERIODICITY_AT_ONE = 0.7;

/** How much each component can contribute to the 0-100 score. */
export const QUALITY_WEIGHTS = {
  perfusion: 25,
  periodicity: 25,
  motion: 20,
  coverage: 15,
  clipping: 8,
  frameDrops: 7,
} as const;

/** Inputs the score is computed from. */
export interface QualityInput {
  frames: readonly PpgFrame[];
  /** Strength of the dominant periodicity, 0..1; 0 when no rate was found. */
  periodicity: number;
  /** AC/DC ratio of the window. */
  perfusion: number;
  /** Fraction of grid points interpolated across a gap, 0..1. */
  frameDropFraction: number;
  /** Seconds of signal analysed. */
  durationSec: number;
  /** Shortest capture this scan mode accepts. */
  minDurationSec: number;
  /**
   * Whether the capture layer had a torch. `undefined` means it was not
   * reported — which is different from "there was none".
   *
   * ⚠️ Recorded, never scored. A missing torch is a fact about the device, not
   * a fault in the capture, and its real consequence (a weak signal) is
   * already measured by perfusion.
   */
  torchAvailable?: boolean;
}

/** Maps a value onto 0..1 by where it falls between two bounds. */
function ramp(value: number, atZero: number, atOne: number): number {
  if (atOne === atZero) return value >= atOne ? 1 : 0;
  return Math.max(0, Math.min(1, (value - atZero) / (atOne - atZero)));
}

/**
 * What the frames alone say about contact, light and stillness.
 *
 * Separated from the score because these three need NO minimum duration and no
 * rhythm: a tenth of a second of frames already says whether the finger is on
 * the lens. The live capture surface shows them from the first moment, long
 * before there is enough signal to look for a pulse — and it must read them
 * from here rather than compute its own, or the guidance during a capture would
 * be able to disagree with the verdict after it.
 */
export interface FrameComponents {
  /** Mean coverage across the window, 0..1. */
  coverage: number;
  /** Frame-to-frame coverage wobble, 0..1. */
  coverageWobble: number;
  /** Mean motion, 0..1. */
  motion: number;
  /** Mean clipped-pixel fraction, 0..1. */
  clipping: number;
  /** Stillness, 0..1 — 1 = still. */
  stability: number;
  /** Normalised contact component: mean coverage, penalised by wobble. */
  contactComponent: number;
  /** Normalised exposure component: 1 = nothing at the sensor ceiling. */
  lightComponent: number;
  /** Frames that individually met the contact, exposure and motion limits. */
  usableFrameCount: number;
}

/**
 * Reduces frames to what they say about the capture conditions.
 *
 * @param frames - The window's frames, already reduced to scalars.
 * @returns Contact, light and motion measures plus their normalised components.
 */
export function assessFrameComponents(frames: readonly PpgFrame[]): FrameComponents {
  const coverage = mean(frames.map((f) => f.coverage));
  const coverageWobble = standardDeviation(frames.map((f) => f.coverage));
  const motion = mean(frames.map((f) => f.motion));
  const clipping = mean(frames.map((f) => f.clippedFraction));
  const stability = Math.max(0, Math.min(1, 1 - motion / MAX_MOTION));

  return {
    coverage,
    coverageWobble,
    motion,
    clipping,
    stability,
    contactComponent: ramp(coverage, MIN_COVERAGE, 0.95) * (1 - Math.min(1, coverageWobble * 4)),
    lightComponent: 1 - Math.min(1, clipping / MAX_CLIPPING),
    // Per-frame limits, not window means — a capture can average acceptable
    // coverage while half its frames had the finger off the lens.
    usableFrameCount: frames.filter(
      (f) =>
        f.coverage >= MIN_COVERAGE && f.clippedFraction <= MAX_CLIPPING && f.motion <= MAX_MOTION,
    ).length,
  };
}

/**
 * Scores a scan window and says why.
 *
 * @param input - Frame-level and signal-level measurements of the window.
 * @returns Quality score, confidence, and the reasons behind them.
 */
export function assessPpgQuality(input: QualityInput): PpgQuality {
  const { frames } = input;

  const frameParts = assessFrameComponents(frames);
  const { coverage, coverageWobble, motion, clipping, stability } = frameParts;

  const components: PpgQualityComponents = {
    perfusion: ramp(input.perfusion, MIN_PERFUSION, GOOD_PERFUSION),
    periodicity: ramp(input.periodicity, PERIODICITY_AT_ZERO, PERIODICITY_AT_ONE),
    motion: stability,
    coverage: frameParts.contactComponent,
    clipping: frameParts.lightComponent,
    frameDrops: 1 - Math.min(1, input.frameDropFraction / MAX_FRAME_DROPS),
  };

  let score = 0;
  for (const key of Object.keys(QUALITY_WEIGHTS) as (keyof typeof QUALITY_WEIGHTS)[]) {
    score += components[key] * QUALITY_WEIGHTS[key];
  }

  // A capture shorter than its mode accepts is not a low-quality scan, it is an
  // incomplete one. Nothing downstream should read a rate out of it, so the
  // score is floored rather than merely reduced.
  const tooShort = input.durationSec < input.minDurationSec;
  const finalScore = tooShort ? Math.min(Math.round(score), 20) : Math.round(score);

  const reasons: PpgQualityReason[] = [];

  if (tooShort) reasons.push('insufficient_duration');
  if (input.perfusion < MIN_PERFUSION) reasons.push('low_perfusion');
  else if (components.perfusion < 0.5) reasons.push('weak_pulse');
  else reasons.push('strong_pulse');

  if (motion > MAX_MOTION) reasons.push('motion_detected');
  else if (stability > 0.8) reasons.push('low_motion');

  if (coverage < MIN_COVERAGE || coverageWobble > 0.1) reasons.push('unstable_coverage');
  else if (coverage >= 0.95) reasons.push('full_coverage');

  if (clipping > MAX_CLIPPING) reasons.push('sensor_clipping');
  if (input.frameDropFraction > MAX_FRAME_DROPS) reasons.push('frame_drops');

  if (input.periodicity < 0.35) reasons.push('irregular_periodicity');
  else if (input.periodicity >= 0.6) reasons.push('good_periodicity');

  if (finalScore >= 75 && !reasons.includes('motion_detected')) reasons.push('stable_signal');

  // Advisory, appended after the score is final so it cannot influence it.
  if (input.torchAvailable === false) reasons.push('torch_unavailable');

  return {
    score: Math.max(0, Math.min(100, finalScore)),
    confidence: deriveConfidence(finalScore, input.periodicity, input.durationSec, input.minDurationSec),
    reasons,
    perfusion: Math.round(input.perfusion * 10_000) / 10_000,
    periodicity: Math.round(input.periodicity * 100) / 100,
    coverage: Math.round(coverage * 100) / 100,
    stability: Math.round(stability * 100) / 100,
    frameDropFraction: Math.round(input.frameDropFraction * 100) / 100,
    components: {
      perfusion: round2(components.perfusion),
      periodicity: round2(components.periodicity),
      motion: round2(components.motion),
      coverage: round2(components.coverage),
      clipping: round2(components.clipping),
      frameDrops: round2(components.frameDrops),
    },
    frameCount: frames.length,
    usableFrameCount: frameParts.usableFrameCount,
  };
}

/** Two decimals — an instrument bar has no use for more. */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * How much the pipeline trusts what it reported.
 *
 * Distinct from the score: the score says how clean the light was, confidence
 * says how much of a reading the window supports. A short but pristine capture
 * scores well and is still thin evidence.
 *
 * @param score - Quality score 0-100.
 * @param periodicity - Dominant periodicity 0..1.
 * @param durationSec - Seconds analysed.
 * @param minDurationSec - The mode's minimum.
 * @returns Confidence 0..1.
 */
function deriveConfidence(
  score: number,
  periodicity: number,
  durationSec: number,
  minDurationSec: number,
): number {
  // Beyond twice the mode's minimum, extra seconds stop adding evidence about
  // the current state and start describing a different moment.
  const durationFactor = Math.min(1, durationSec / (minDurationSec * 2));
  const value = (score / 100) * 0.55 + periodicity * 0.25 + durationFactor * 0.2;
  return Math.round(Math.max(0, Math.min(1, value)) * 100) / 100;
}
