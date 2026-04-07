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
