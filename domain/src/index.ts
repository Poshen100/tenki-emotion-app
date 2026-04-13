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
