/**
 * @module biometric/ppg
 * @description Phone-camera PPG pipeline — public surface.
 * @see docs/PHONE-PPG.md
 */

export type {
  PpgFrame,
  PpgQuality,
  PpgQualityComponents,
  PpgQualityReason,
  PpgAnalysis,
  PpgMetric,
  PpgWithheld,
} from './types';
export { PPG_QUALITY_REASONS, PPG_METRICS } from './types';

// The instrument a capture reports about itself — what a surface renders.
export {
  PPG_POSITIVE_REASONS,
  PPG_REJECTION_REASONS,
  SIGNAL_DIMENSION_DIRECTION,
  dimensionGoodness,
  isRejectionReason,
  toSignalQuality,
} from './signal-quality';
export type {
  PpgPositiveReason,
  PpgRejectionReason,
  PpgSignalQuality,
  SignalDimension,
} from './signal-quality';

export { analyzePpgScan, hasUsableReading, wasWithheld, MIN_FRAMES } from './analyze';

// Which colour channel the pulse is actually in — measured, not assumed.
export { PPG_CHANNELS, analyseChannel, selectPulseChannel } from './channels';
export type {
  ChannelAnalysis,
  ChannelSelection,
  PpgChannel,
  PpgChannelDiagnostic,
} from './channels';

// The gate PRV has to pass — the only measure here that notices sensor noise.
export {
  MIN_BEATS_FOR_TEMPLATE,
  PRV_MIN_TEMPLATE_CORRELATION,
  beatTemplateCorrelation,
} from './beat-template';

// What a camera-derived respiratory rate has to satisfy before it exists.
export {
  BREATH_AGREEMENT_BRPM,
  BREATH_LOCK_MAX_BRPM,
  BREATH_LOCK_MAX_SEC,
  BREATH_LOCK_MIN_BRPM,
  BREATH_LOCK_MIN_SEC,
  BREATH_LOCK_REJECTION_REASONS,
  BREATH_SOURCES,
  MIN_BREATH_COHERENCE,
  MIN_BREATH_SUSTAINED,
  MIN_BREATH_USABLE_FRAMES,
  assessBreathLock,
  reconcileBreathSources,
} from './breath-lock';
export type {
  BreathAgreement,
  BreathEstimate,
  BreathLockContext,
  BreathLockDeviceCapability,
  BreathLockInput,
  BreathLockQuality,
  BreathLockRejectionReason,
  BreathLockResult,
  BreathSource,
} from './breath-lock';

// What a capture may say about itself while it is still running.
export {
  INITIAL_PULSE_LOCK,
  LIVE_WINDOW_SEC,
  LOCK_CONSECUTIVE_WINDOWS,
  MIN_LIVE_FRAMES,
  MIN_LIVE_WINDOW_SEC,
  MIN_LOCK_COHERENCE,
  advancePulseLock,
  assessLiveWindow,
  recentFrames,
} from './live';
export type { LiveReading, PulseLockState } from './live';

export { toEngineInput } from './to-reading';
export type { PpgEngineInput, PpgReadingAvailability } from './to-reading';
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

export {
  GOOD_PERFUSION,
  MIN_PERFUSION,
  PERIODICITY_AT_ONE,
  PERIODICITY_AT_ZERO,
  QUALITY_WEIGHTS,
  assessFrameComponents,
  assessPpgQuality,
} from './quality';
export type { FrameComponents } from './quality';

export {
  MIN_INTERVALS_PER_WINDOW,
  MIN_WINDOWS_FOR_REPEATABILITY,
  REPEATABILITY_WINDOW_SEC,
  estimateRepeatability,
} from './repeatability';
export type { Repeatability } from './repeatability';
export type { QualityInput } from './quality';

// The synthetic generator ships with the module on purpose: it is how the
// pipeline's thresholds were calibrated and how they stay honest. It is a test
// instrument — nothing it produces may reach a user-facing reading.
export { CLEAN_SCAN, PPG_FIXTURES, synthesizePpg, pulseShape } from './replay';
export type { SyntheticPpgOptions, SyntheticPpgScan, SyntheticPpgTruth } from './replay';
