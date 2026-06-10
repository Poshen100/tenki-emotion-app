/**
 * @module face-baseline
 * @description Public barrel for the TENKI Face Baseline feature.
 * Camera-free logic foundation (tokens, types, utils, store, machine).
 * Screens and native components are wired in once the camera/animation
 * dependency stack is installed — see SPEC.md.
 *
 * @version 3.0
 * @see apps/mobile/features/face-baseline/SPEC.md
 */

export { faceBaselineTokens } from './tokens/faceBaseline.tokens';
export type { AccentWorld, FaceBaselineTokens } from './tokens/faceBaseline.tokens';

export type {
  FlowStep,
  PermissionState,
  FaceLockState,
  CapturePhase,
  ProcessingStatus,
  MaturityStage,
  RetryReason,
  QualityStatus,
  EnvironmentChecks,
  QualityMetrics,
  RefinementEntry,
} from './types';

export {
  QUALITY_OK,
  isQualityOk,
  deriveQualityStatus,
  STAGE_THRESHOLDS,
  STAGE_ORDER,
  maturityStage,
  scansRequiredForNextStage,
  stageProgress,
  PHASE_WEIGHTS,
  clamp01,
  captureProgress,
  classifyRetryReason,
  RETRY_COPY_KEY,
  estimateConfidence,
  confidenceBand,
} from './utils';
export type { RetryContext, ConfidenceBand } from './utils';

export {
  useFaceBaselineStore,
  MAX_HISTORY,
  DEFAULT_SCANS_REQUIRED,
} from './store/faceBaselineStore';
export type { FaceBaselineState } from './store/faceBaselineStore';
export {
  selectQualityOk,
  selectTotalProgress,
  selectCanStartScan,
  selectActiveQualityStatus,
  selectMaturityRatio,
  selectHasBaseline,
} from './store/selectors';

export {
  FACE_BASELINE_TRANSITIONS,
  INITIAL_STATE,
  FINAL_STATES,
  transition,
  canTransition,
  isFinal,
} from './machine/faceBaselineMachine';
export type { MachineState, FaceBaselineEvent } from './machine/faceBaselineMachine';
export { RESUME_TARGET, partialRetryPhase } from './machine/transitions';
export type { RetryablePhase } from './machine/transitions';
