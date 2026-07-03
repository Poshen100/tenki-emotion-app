/**
 * @module face-baseline/utils
 * @description Barrel for Face Baseline pure-logic utilities.
 */
export {
  QUALITY_OK,
  STRICT_DELTA,
  ARC_POSE_MIN,
  isQualityOk,
  neutralGate,
  arcGate,
  stabilityGate,
  phaseGate,
  deriveQualityStatus,
} from './qualityThresholds';
export type { CaptureGatePhase, GateOptions } from './qualityThresholds';
export {
  STAGE_THRESHOLDS,
  STAGE_ORDER,
  maturityStage,
  scansRequiredForNextStage,
  stageProgress,
} from './maturityStage';
export { PHASE_WEIGHTS, clamp01, captureProgress } from './progress';
export { classifyRetryReason, RETRY_COPY_KEY } from './retryReason';
export type { RetryContext } from './retryReason';
export { estimateConfidence, totalBaselineConfidence, confidenceBand } from './confidence';
export type { ConfidenceBand } from './confidence';
export {
  DAILY_SCORE_MIN,
  DAILY_SCORE_MAX,
  FALLBACK_SCORE_BASE,
  FALLBACK_SCORE_SPREAD,
  isDailyRefinement,
  deriveDailyEdgeScore,
  buildRefinementEntry,
  toScanMetrics,
  formatHistoryTime,
} from './dailyScan';
