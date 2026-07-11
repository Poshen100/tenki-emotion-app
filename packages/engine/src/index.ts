/**
 * @module engine
 * @description TENKI CORE Engine v3 — public API.
 * Only exports v3 modules. Legacy modules are in ./legacy/ (deprecated).
 *
 * @version 3.0
 */

// ─── Common ─────────────────────────────────
export type {
  BiometricReading,
  BiometricSource,
  SignalQuality,
  SleepRecoveryInput,
  TimeBucket,
  MetricBaseline,
  BaselineProfile,
  BaselineMaturity,
  ConfidenceBand,
  ConfidenceBreakdown,
  FeatureFlagId,
  SubscriptionTier,
  BillingCadence,
} from './common/types';

export {
  BASELINE_THRESHOLDS,
  CONFIDENCE_BANDS,
} from './common/types';

// ─── Scoring ────────────────────────────────
export type {
  EdgeWeights,
  EdgeZone,
  StrainSubtype,
  EdgeZoneConfig,
  ScoreDriverKey,
  DriverDirection,
  ScoreDriver,
  EdgeScoreResult,
  EdgeScoreMetadata,
  DetectedState,
  EdgeDetectorState,
} from './scoring/types';

export {
  EDGE_WEIGHTS,
  EDGE_ZONE_BOUNDARIES,
  EDGE_ZONE_CONFIGS,
  EDGE_DETECTOR_THRESHOLDS,
} from './scoring/types';

// ─── Session Governance ─────────────────────
export type {
  SessionMode,
  ModeConfig,
  TraderTemplateId,
  TemplateSegment,
  TemplateRules,
  TraderTemplate,
  SessionState,
  SessionAction,
  GateResult,
  GateEvaluation,
  SessionEventType,
  SessionEvent,
  OutcomeTag,
  ReflectionRecord,
  ViolationType,
  ViolationEvent,
  SessionRecord,
} from './session/types';

export {
  SESSION_MODES,
  GATE_THRESHOLDS,
} from './session/types';

// ─── Compliance ─────────────────────────────
export {
  ALLOWED_VOCABULARY,
  PROHIBITED_VOCABULARY,
  findProhibitedTerms,
  isCompliantCopy,
  generateSafeCopy,
  getDriverExplanation,
} from './compliance/safe-copy';

export {
  SAFE_NOTIFICATION_TEMPLATES,
  validateNotification,
  getSafeNotification,
} from './compliance/notification-guard';

export type { NotificationTemplateId } from './compliance/notification-guard';

// ─── Biometric ──────────────────────────────
export {
  calculateHrvBaselineRange,
  getHrvStatus,
  harmonizeHrv,
  computeHrvZScore,
} from './biometric/hrv';

export type { HrvStatus, HrvBaselineRange, HrvSource } from './biometric/hrv';

export {
  clampBrpm,
  estimateBrpmFromRRIntervals,
  smoothBrpm,
  getRrStatus,
  analyzeRr,
  RR_NORMAL_MIN,
  RR_NORMAL_MAX,
} from './biometric/rr';

export type { RrStatus, RrResult } from './biometric/rr';

export {
  calculateStressProxy,
  getStressLevel,
  STRESS_WEIGHTS,
} from './biometric/stress-proxy';

export type { StressLevel, StressProxyResult } from './biometric/stress-proxy';

export {
  detectPeaks,
  computeIBI,
  estimateHrvFromIBI,
  assessBeatRegularity,
  processFingerPpgWindow,
} from './biometric/finger-ppg';

export type { FingerPpgSample, FingerPpgResult, Peak } from './biometric/finger-ppg';

// ─── Baseline ───────────────────────────────
export {
  updateMetricBaseline,
  createEmptyMetricBaseline,
  createEmptyBaselineProfile,
  resolveTimeBucket,
  assessMaturity,
  updateBaselineProfile,
} from './baseline/baseline';

// ─── Scoring Engine ─────────────────────────
export {
  calculateEdgeScore,
  classifyEdgeZone,
  getTimeBucket,
  inferStrainSubtype,
} from './scoring/edge-score';

export type { EdgeScoreInput } from './scoring/edge-score';

export {
  createEdgeDetectorState,
  tickDetector,
  recordAlertFired,
  resetDailyAlerts,
  shouldFireAlert,
} from './scoring/edge-detector';

export type { DetectorTickInput } from './scoring/edge-detector';

// ─── Session Governance ─────────────────────
export {
  nextSessionState,
  canTransition,
  getValidActions,
  isTerminalState,
  isActiveState,
  needsUserAction,
} from './session/state-machine';

export {
  evaluateGate,
  canProceed,
  shouldSuggestReset,
} from './session/gate';

export {
  TRADER_TEMPLATES,
  getTraderTemplate,
  getAllTraderTemplates,
} from './session/templates';

export { suggestTemplateForStrategyHint } from './session/template-suggestion';

// ─── Common ─────────────────────────────────
export {
  createEwma,
  updateEwma,
  getEwmaValue,
  resetEwma,
  EWMA_DEFAULT_ALPHA,
} from './common/ewma';

export type { EwmaState } from './common/ewma';

// ─── Haptics (TENKI Pulse) ──────────────────
export {
  createPulseProfile,
  evolvePulseProfile,
  maturityForSessions,
  scanEventPulse,
  zonePulse,
  toWebVibration,
  PULSE_LIMITS,
} from './haptics/haptics';

export type { HapticStep, HapticPattern, PulseEvent, PulseProfile } from './haptics/haptics';

// ─── Legacy Adapter ─────────────────────────
export {
  teiToEdgeScoreApprox,
  legacyZoneToEdgeZone,
  edgeZoneToLegacyZone,
} from './common/legacy-tei-adapter';
