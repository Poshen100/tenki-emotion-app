/**
 * @module biometric/ppg/types
 * @description Vocabulary for the phone-camera PPG pipeline.
 *
 * TENKI's largest group of users owns a phone and nothing else, so the camera
 * path is a first-class measurement chain, not a fallback. Being first-class
 * means being honest about what an optical waveform can and cannot support:
 * every metric this pipeline can produce is nullable, and withholding one is a
 * normal outcome rather than an error.
 *
 * Two boundaries are structural:
 *
 *   1. **Frames never enter this module.** A `PpgFrame` is a frame already
 *      reduced to scalars on the capture side. Raw pixels are not persisted,
 *      not passed around, and not reachable from here — the privacy rule is
 *      enforced by the shape of the input, not by remembering to delete.
 *   2. **Nothing here is medical-grade.** A camera estimates beat timing from
 *      light passing through a fingertip. It is not an ECG and not equivalent
 *      to a chest strap, and the vocabulary below never lets it claim to be.
 *
 * @see docs/PHONE-PPG.md
 */

/**
 * One camera frame, already reduced to the scalars a PPG needs.
 *
 * The capture layer computes these over its region of interest and discards
 * the frame. Channel means are in the sensor's own 0..255 scale.
 */
export interface PpgFrame {
  /** Capture time in ms. Monotonic; spacing may jitter, and gaps mean drops. */
  timestampMs: number;
  /** Mean red channel over the ROI — the pulsatile channel under a flash. */
  red: number;
  /** Mean green channel over the ROI. */
  green: number;
  /** Mean blue channel over the ROI. */
  blue: number;
  /** Fraction of ROI pixels at the sensor ceiling or floor, 0..1. */
  clippedFraction: number;
  /** Fraction of the ROI actually covered by the fingertip, 0..1. */
  coverage: number;
  /** Frame-to-frame movement proxy, 0 (still) to 1 (heavy motion). */
  motion: number;
}

/**
 * Why a quality score came out where it did. Reasons are what the UI turns
 * into "hold your finger still" — a scan that fails without saying which of
 * eleven things went wrong is a scan the user cannot fix.
 *
 * Positive and negative reasons share one list on purpose: a report that can
 * only say what is wrong cannot tell a user that a scan was good.
 */
export const PPG_QUALITY_REASONS = [
  // Positive
  'stable_signal',
  'low_motion',
  'strong_pulse',
  'good_periodicity',
  'full_coverage',
  // Negative
  'motion_detected',
  'weak_pulse',
  'low_perfusion',
  'sensor_clipping',
  'unstable_coverage',
  'frame_drops',
  'irregular_periodicity',
  'insufficient_duration',
  'unstable_sampling',
] as const;
export type PpgQualityReason = typeof PPG_QUALITY_REASONS[number];

/** Metrics the pipeline may withhold, named so the UI can say which. */
export const PPG_METRICS = ['heart_rate', 'hrv', 'respiration'] as const;
export type PpgMetric = typeof PPG_METRICS[number];

/**
 * Why one metric was not reported. A withheld metric is a result, not a
 * failure: "we could not time your beats well enough for HRV" is information,
 * and inventing a plausible number in its place is not.
 */
export interface PpgWithheld {
  metric: PpgMetric;
  reason: PpgQualityReason | 'mode_excludes_metric' | 'too_few_beats' | 'too_many_artifacts';
}

/** Signal quality for one scan window. */
export interface PpgQuality {
  /** Overall quality 0-100. */
  score: number;
  /** How much the pipeline trusts what it reported, 0..1. */
  confidence: number;
  /** What drove the score, positive and negative. */
  reasons: PpgQualityReason[];
  /** Mean pulse amplitude relative to the DC level (AC/DC), 0..1. */
  perfusion: number;
  /** Strength of the dominant periodicity, 0..1, from autocorrelation. */
  periodicity: number;
  /** Mean coverage across the window, 0..1. */
  coverage: number;
  /** Motion stability, 0 (heavy motion) to 1 (still). */
  stability: number;
  /** Fraction of expected frames that never arrived, 0..1. */
  frameDropFraction: number;
}

/**
 * The result of one camera scan. Every physiological field is nullable, and a
 * null means "not established", never "zero" and never "unknown, so assume
 * average".
 */
export interface PpgAnalysis {
  /** Signal quality for the window. */
  quality: PpgQuality;
  /** Heart rate in bpm, or null when the signal did not support one. */
  heartRateBpm: number | null;
  /**
   * HRV RMSSD in ms, or null. Always an ESTIMATE when non-null — beat timing
   * inferred from an optical waveform is not a chest strap's RR series and is
   * never presented as one.
   */
  hrvRmssdMs: number | null;
  /** Respiratory rate in breaths per minute, or null. */
  respiratoryRateBrpm: number | null;
  /** Accepted beats after artifact rejection. */
  beatCount: number;
  /** Fraction of detected intervals rejected as artifacts, 0..1. */
  artifactFraction: number;
  /** Seconds of signal actually analysed, after drops. */
  durationSec: number;
  /** Sample rate the window was resampled onto, in Hz. */
  sampleRateHz: number;
  /**
   * How reproducible this scan's HRV was across its own duration, in ms, or
   * null when HRV was not reported or the scan was too short to split.
   *
   * This is the instrument measuring itself. It feeds the user's noise floor
   * (`baseline/noise-floor.ts`), which is what stops a difference smaller than
   * the measurement error from being scored as a change in state.
   */
  repeatabilitySdMs: number | null;
  /** Metrics deliberately not reported, with the reason for each. */
  withheld: PpgWithheld[];
}
