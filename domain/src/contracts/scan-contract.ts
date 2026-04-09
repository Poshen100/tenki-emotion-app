/**
 * @module domain/contracts/scan-contract
 * @description Canonical domain contracts for the TENKI scan pipeline.
 * These contracts define the handoff boundary between UI capture, scoring,
 * session gating, and encrypted persistence.
 */

export const DOMAIN_SCAN_TYPES = ['baseline', 'quick', 'deep', 'trader_check'] as const;
export type DomainScanType = typeof DOMAIN_SCAN_TYPES[number];

export const DOMAIN_SESSION_MODES = [
  'health_reset',
  'focus',
  'performance',
  'trader',
] as const;
export type DomainSessionMode = typeof DOMAIN_SESSION_MODES[number];

export const DOMAIN_TRADER_TEMPLATE_IDS = ['FBD', 'CANSLIM', 'MODE_2'] as const;
export type DomainTraderTemplateId = typeof DOMAIN_TRADER_TEMPLATE_IDS[number];

export const DOMAIN_EDGE_ZONES = ['clear', 'neutral', 'strain'] as const;
export type DomainEdgeZone = typeof DOMAIN_EDGE_ZONES[number];

export const DOMAIN_CONFIDENCE_BANDS = ['high', 'moderate', 'low'] as const;
export type DomainConfidenceBand = typeof DOMAIN_CONFIDENCE_BANDS[number];

export const DOMAIN_GATE_RESULTS = [
  'clear_pass',
  'soft_caution',
  'red_gate',
  'force_hold',
] as const;
export type DomainGateResult = typeof DOMAIN_GATE_RESULTS[number];

export const SIGNAL_GRADES = ['A', 'B', 'C', 'D', 'F'] as const;
export type SignalGrade = typeof SIGNAL_GRADES[number];

export const SCAN_UI_STATES = [
  'idle',
  'searching',
  'detecting',
  'locked',
  'scanning',
  'processing',
  'results',
  'error',
] as const;
export type ScanUiState = typeof SCAN_UI_STATES[number];

export const STORAGE_POLICIES = ['encrypted_sqlite', 'in_memory_only'] as const;
export type StoragePolicy = typeof STORAGE_POLICIES[number];

export const DOMAIN_SCORE_DRIVER_KEYS = [
  'hrv_vs_baseline',
  'hr_stability',
  'respiration_stability',
  'stress_proxy_vs_baseline',
  'sleep_recovery',
  'recent_trend',
  'baseline_freshness',
  'signal_quality',
] as const;
export type DomainScoreDriverKey = typeof DOMAIN_SCORE_DRIVER_KEYS[number];

const DRIVER_KEY_TO_HANDOFF_KEY: Record<DomainScoreDriverKey, keyof ScanDriverBreakdownContract> = {
  hrv_vs_baseline: 'hrv',
  hr_stability: 'hrStability',
  respiration_stability: 'respiration',
  stress_proxy_vs_baseline: 'stressProxy',
  sleep_recovery: 'sleepRecovery',
  recent_trend: 'recentTrend',
  baseline_freshness: 'baselineFreshness',
  signal_quality: 'signalQuality',
};

/** Domain-level checklist for deciding whether a scan is allowed to begin. */
export interface ScanReadinessChecklistContract {
  signalQualityReady: boolean;
  coverageReady: boolean;
  stabilityReady: boolean;
  baselineReady: boolean;
  cameraPermissionReady: boolean;
  minimumDurationMet: boolean;
}

/** Contract for a requested scan before capture begins. */
export interface ScanRequestContract {
  type: DomainScanType;
  mode: DomainSessionMode;
  templateId: DomainTraderTemplateId | null;
  requestedAt: number;
  baselineAvailable: boolean;
  featureFlagEnabled: boolean;
}

/** Policy output that downstream scan orchestration can enforce. */
export interface ScanRequirementsContract {
  type: DomainScanType;
  minimumDurationSec: number;
  minimumSignalGrade: SignalGrade;
  requiresBaseline: boolean;
  requiresTemplate: boolean;
  requiresSessionGate: boolean;
  allowedModes: readonly DomainSessionMode[];
}

/** Canonical driver breakdown expected by session gate and persistence. */
export interface ScanDriverBreakdownContract {
  hrv: number;
  hrStability: number;
  respiration: number;
  stressProxy: number;
  sleepRecovery: number;
  recentTrend: number;
  baselineFreshness: number;
  signalQuality: number;
}

/** Structured handoff between scan results and session gate logic. */
export interface ScanHandoffContract {
  edgeScore: number;
  zone: DomainEdgeZone;
  confidence: number;
  confidenceBand: DomainConfidenceBand;
  gateResult: DomainGateResult;
  scanDurationSec: number;
  signalGrade: SignalGrade;
  timestamp: number;
  drivers: ScanDriverBreakdownContract;
}

/** Shape used to build a canonical handoff from scored scan output. */
export interface BuildScanHandoffInput {
  edgeScore: number;
  zone: DomainEdgeZone;
  confidence: number;
  confidenceBand: DomainConfidenceBand;
  gateResult: DomainGateResult;
  scanDurationSec: number;
  signalGrade: SignalGrade;
  timestamp: number;
  drivers: ReadonlyArray<{
    key: DomainScoreDriverKey;
    rawSubScore: number;
  }>;
}

/** Persisted scan record contract. Raw biometric samples must never be stored here. */
export interface PersistedScanRecordContract {
  id: string;
  type: DomainScanType;
  mode: DomainSessionMode;
  templateId: DomainTraderTemplateId | null;
  checklist: ScanReadinessChecklistContract;
  handoff: ScanHandoffContract;
  storagePolicy: 'encrypted_sqlite';
  createdAt: number;
  updatedAt: number;
}

/**
 * Creates the empty driver breakdown used before mapping scored drivers.
 *
 * @returns Zeroed driver breakdown.
 */
export function createEmptyScanDriverBreakdown(): ScanDriverBreakdownContract {
  return {
    hrv: 0,
    hrStability: 0,
    respiration: 0,
    stressProxy: 0,
    sleepRecovery: 0,
    recentTrend: 0,
    baselineFreshness: 0,
    signalQuality: 0,
  };
}

/**
 * Builds the canonical session handoff payload from scored scan output.
 * Throws if any of the 8 required drivers are missing or duplicated.
 *
 * @param input - The scored scan payload to normalize.
 * @returns Canonical scan handoff contract.
 */
export function buildScanHandoffContract(input: BuildScanHandoffInput): ScanHandoffContract {
  const breakdown = createEmptyScanDriverBreakdown();
  const seenKeys = new Set<DomainScoreDriverKey>();

  for (const driver of input.drivers) {
    if (seenKeys.has(driver.key)) {
      throw new Error(`Duplicate driver key in scan handoff: ${driver.key}`);
    }

    const handoffKey = DRIVER_KEY_TO_HANDOFF_KEY[driver.key];
    breakdown[handoffKey] = driver.rawSubScore;
    seenKeys.add(driver.key);
  }

  const missingKeys = DOMAIN_SCORE_DRIVER_KEYS.filter(key => !seenKeys.has(key));
  if (missingKeys.length > 0) {
    throw new Error(`Missing scan drivers for handoff: ${missingKeys.join(', ')}`);
  }

  return {
    edgeScore: input.edgeScore,
    zone: input.zone,
    confidence: input.confidence,
    confidenceBand: input.confidenceBand,
    gateResult: input.gateResult,
    scanDurationSec: input.scanDurationSec,
    signalGrade: input.signalGrade,
    timestamp: input.timestamp,
    drivers: breakdown,
  };
}
