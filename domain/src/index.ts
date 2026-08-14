export {
  DOMAIN_CONFIDENCE_BANDS,
  DOMAIN_EDGE_ZONES,
  DOMAIN_GATE_RESULTS,
  DOMAIN_SCAN_TYPES,
  DOMAIN_SCORE_DRIVER_KEYS,
  DOMAIN_SESSION_MODES,
  DOMAIN_TRADER_TEMPLATE_IDS,
  SCAN_UI_STATES,
  SIGNAL_GRADES,
  STORAGE_POLICIES,
  buildScanHandoffContract,
  createEmptyScanDriverBreakdown,
} from './contracts/scan-contract';

export type {
  BuildScanHandoffInput,
  DomainConfidenceBand,
  DomainEdgeZone,
  DomainGateResult,
  DomainScanType,
  DomainScoreDriverKey,
  DomainSessionMode,
  DomainTraderTemplateId,
  PersistedScanRecordContract,
  ScanDriverBreakdownContract,
  ScanHandoffContract,
  ScanReadinessChecklistContract,
  ScanRequestContract,
  ScanRequirementsContract,
  ScanUiState,
  SignalGrade,
  StoragePolicy,
} from './contracts/scan-contract';

export {
  canStartScanFromChecklist,
  meetsSignalGradeRequirement,
  resolveRequiredDurationSec,
  resolveScanRequirements,
  validateScanRequestPolicy,
} from './policies/scan-policy';

export {
  assertPersistedScanRecordContract,
  assertScanHandoffContract,
  assertScanRequestContract,
  validatePersistedScanRecordContract,
  validateScanHandoffContract,
  validateScanRequestContract,
} from './schemas/scan-schema';

export type {
  ValidationFailure,
  ValidationResult,
  ValidationSuccess,
} from './schemas/scan-schema';

export {
  assertAlertPayloadContract,
  validateAlertPayloadContract,
} from './schemas/alert-schema';

export {
  ALERT_AGGREGATION_WINDOW_SEC,
  ALERT_COOLDOWN_SEC,
  ALERT_DAILY_SURFACE_CAP,
  QUIET_WINDOW_CONTEXT_ZH,
  QUIET_WINDOW_END_HOUR,
  QUIET_WINDOW_START_HOUR,
  QUIET_WINDOW_TZ,
  createDefaultAlertSettings,
  createEmptyAlertThrottleState,
  evaluateAlertDelivery,
  groupSimultaneousAlerts,
  isWithinQuietWindowET,
  recordAlertSurfaced,
  resolveAlertDayKey,
} from './policies/alert-policy';

export type {
  AlertDeliveryEvaluation,
  AlertDeliveryInput,
  AlertDeliverySettings,
  AlertThrottleState,
} from './policies/alert-policy';

export {
  DOMAIN_MARKET_MODES,
  MARKET_MODE_CONTEXT_ZH,
  extractMarketMode,
  resolveMarketModeContext,
} from './policies/market-mode';

export type { DomainMarketMode } from './policies/market-mode';

export {
  isDisciplinedOutcome,
  resolveOutcomeTag,
  selectRecentOutcomes,
  summarizeDisciplineRate,
} from './policies/decision-outcome';

export type {
  DecisionEndInput,
  DecisionEndType,
  DecisionOutcomeRecord,
  DecisionOutcomeTag,
  DisciplineSummary,
} from './policies/decision-outcome';

export {
  ALERT_PAYLOAD_MAX_STRING_LENGTH,
  DOMAIN_ALERT_DELIVERY_DECISIONS,
  DOMAIN_ALERT_LIFECYCLE_STATES,
  DOMAIN_ALERT_PRIORITIES,
  DOMAIN_ALERT_SOURCES,
  buildAlertContract,
} from './contracts/alert-contract';

export type {
  AlertContract,
  AlertContractMeta,
  AlertPayloadContract,
  DomainAlertDeliveryDecision,
  DomainAlertLifecycleState,
  DomainAlertPriority,
  DomainAlertSource,
} from './contracts/alert-contract';

export {
  NEXT_ACTIONS,
  ONBOARDING_STEP_ORDER,
  SENSOR_CHOICES,
  createInitialOnboardingState,
} from './contracts/baseline-contract';

export type {
  BaselineFailureReason,
  BaselineOnboardingState,
  BaselineOnboardingStep,
  NextActionConfig,
  NextActionType,
  SensorChoice,
  SensorChoiceConfig,
} from './contracts/baseline-contract';

export {
  MAX_CALIBRATION_ATTEMPTS,
  MAX_ONBOARDING_SEC,
  TARGET_COMPLETION_SEC,
  canTransitionTo,
  evaluateRetryStrategy,
  getNextStep,
  getPreviousStep,
  isWithinTargetTime,
  shouldShowBaselineOnboarding,
} from './policies/baseline-policy';

export { READINESS_CAPTURE_TIERS } from './contracts/readiness-reading';

export type {
  AttachedReadinessReading,
  ReadinessCaptureTier,
  ReadinessEvidence,
  ReadinessReading,
} from './contracts/readiness-reading';

export {
  MIN_BAND_SAMPLES_FOR_RATE,
  READING_FRESHNESS_MS,
  buildReading,
  captureQuality,
  deriveBand,
  isReadingFresh,
  resolveConfidence,
  resolveReadingGate,
  summarizeDisciplineByBand,
  tierSupportsHighConfidence,
} from './policies/readiness-band';

export type { BandDisciplineStat, ReadingGate } from './policies/readiness-band';

export {
  BENCHMARK_CLARITY_BANDS,
  BENCHMARK_COHORT_DIMENSIONS,
  BENCHMARK_K_THRESHOLD,
  BENCHMARK_MATURITY_STAGES,
  BENCHMARK_ROLLOUT_STAGES,
  BENCHMARK_TIME_BUCKETS,
  ENVELOPE_REJECTION_REASONS,
  FORBIDDEN_ENVELOPE_FIELDS,
  ROLLOUT_STAGE_DIMENSIONS,
  buildCohortKey,
  isCohortEligible,
  validateEnvelope,
} from './contracts/benchmark-contract';

export type {
  AnonymousBenchmarkEnvelope,
  BenchmarkClarityBand,
  BenchmarkCohortDimension,
  BenchmarkCohortDistribution,
  BenchmarkCohortKey,
  BenchmarkComparisonResult,
  BenchmarkMaturityStage,
  BenchmarkRolloutStage,
  BenchmarkTimeBucket,
  EnvelopeRejectionReason,
  EnvelopeValidation,
} from './contracts/benchmark-contract';

export {
  EDGE_DETECTED_STATES,
  EDGE_DETECTION_STRENGTHS,
  EDGE_EVENT_SOURCES,
  EDGE_EVENT_TIME_BUCKETS,
  EVENT_REJECTION_REASONS,
  FORBIDDEN_EVENT_FIELDS,
  buildEventDedupeKey,
  isDuplicateEvent,
  isLiveAlertEligible,
  validateEdgeEvent,
} from './contracts/edge-event-contract';

export type {
  EdgeDetectedEvent,
  EdgeDetectedState,
  EdgeDetectionStrength,
  EdgeEventSource,
  EdgeEventTimeBucket,
  EdgeEventValidation,
  EventRejectionReason,
} from './contracts/edge-event-contract';

export {
  DEFAULT_QUIET_HOURS_END,
  DEFAULT_QUIET_HOURS_START,
  EDGE_NOTIFICATION_COOLDOWN_SEC,
  EDGE_NOTIFICATION_DAILY_CAP,
  EDGE_NOTIFICATION_DECISIONS,
  EDGE_WITHHOLD_REASONS,
  createDefaultEdgeNotificationSettings,
  createEmptyEdgeNotificationState,
  evaluateEdgeNotification,
  isWithinQuietHours,
  recordEdgeNotificationSent,
  resolveEdgeNotificationDayKey,
} from './policies/edge-notification-policy';

export type {
  EdgeNotificationDecision,
  EdgeNotificationEvaluation,
  EdgeNotificationInput,
  EdgeNotificationSettings,
  EdgeNotificationThrottleState,
  EdgeWithholdReason,
} from './policies/edge-notification-policy';

export {
  MAX_UPLOADS_PER_DAY,
  MIN_UPLOAD_INTERVAL_MS,
  PARTICIPATION_BLOCKERS,
  UPLOAD_BUFFER_HOURS,
  canContribute,
  isBufferDue,
  isThrottled,
  resolveComparison,
} from './policies/benchmark-policy';

export type {
  BenchmarkParticipationState,
  ParticipationBlocker,
  ParticipationDecision,
} from './policies/benchmark-policy';
