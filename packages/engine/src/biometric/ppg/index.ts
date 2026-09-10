/**
 * @module biometric/ppg
 * @description Phone-camera PPG pipeline — public surface.
 * @see docs/PHONE-PPG.md
 */

export type {
  PpgFrame,
  PpgQuality,
  PpgQualityReason,
  PpgAnalysis,
  PpgMetric,
  PpgWithheld,
} from './types';
export { PPG_QUALITY_REASONS, PPG_METRICS } from './types';

export { analyzePpgScan, hasUsableReading, wasWithheld, MIN_FRAMES } from './analyze';
export type { PpgOutcome, PpgCompletion, PpgRejection } from './analyze';

export {
  PPG_BAND_HIGH_HZ,
  PPG_BAND_LOW_HZ,
  PPG_RESAMPLE_HZ,
  bandPass,
  detrend,
  dominantPeriod,
  lowPassZeroPhase,
  perfusionIndex,
  resampleUniform,
} from './filtering';
export type { ResampledSignal, DominantPeriod } from './filtering';

export { MIN_PERIODICITY, detectPulsePeaks, estimateRate } from './pulse';
export type { PulsePeak, RateEstimate } from './pulse';

export {
  ARTIFACT_DEVIATION_FRACTION,
  MAX_ARTIFACT_FRACTION,
  MAX_INTERVAL_MS,
  MIN_INTERVALS_FOR_HRV,
  MIN_INTERVAL_MS,
  computeRmssd,
  computeSdnn,
  heartRateFromIntervals,
  intervalTimes,
  rejectArtifacts,
  toIntervals,
} from './beats';
export type { IntervalSeries } from './beats';

export {
  MIN_BEATS_PER_BREATH,
  MIN_RESPIRATION_PERIODICITY,
  RESPIRATION_MAX_HZ,
  RESPIRATION_MIN_HZ,
  estimateRespiration,
} from './respiration';
export type { RespirationEstimate } from './respiration';

export { GOOD_PERFUSION, MIN_PERFUSION, QUALITY_WEIGHTS, assessPpgQuality } from './quality';
export type { QualityInput } from './quality';

// The synthetic generator ships with the module on purpose: it is how the
// pipeline's thresholds were calibrated and how they stay honest. It is a test
// instrument — nothing it produces may reach a user-facing reading.
export { CLEAN_SCAN, PPG_FIXTURES, synthesizePpg, pulseShape } from './replay';
export type { SyntheticPpgOptions, SyntheticPpgScan, SyntheticPpgTruth } from './replay';
