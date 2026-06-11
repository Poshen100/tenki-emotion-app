/**
 * @module domain/schemas/scan-schema
 * @description Runtime validation helpers for scan domain contracts.
 * These validators are intentionally dependency-free so they can run on-device.
 */

import {
  DOMAIN_CONFIDENCE_BANDS,
  DOMAIN_EDGE_ZONES,
  DOMAIN_GATE_RESULTS,
  DOMAIN_SCAN_TYPES,
  DOMAIN_SESSION_MODES,
  DOMAIN_TRADER_TEMPLATE_IDS,
  type PersistedScanRecordContract,
  type ScanHandoffContract,
  type ScanReadinessChecklistContract,
  type ScanRequestContract,
  SIGNAL_GRADES,
} from '../contracts/scan-contract';
import { validateScanRequestPolicy } from '../policies/scan-policy';

export interface ValidationSuccess<T> {
  success: true;
  value: T;
}

export interface ValidationFailure {
  success: false;
  errors: string[];
}

export type ValidationResult<T> = ValidationSuccess<T> | ValidationFailure;

const DISALLOWED_PERSISTED_KEYS = [
  'rawHrSamples',
  'rawHrvSamples',
  'rawRrSamples',
  'rawSignals',
  'rawSamples',
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isPositiveTimestamp(value: unknown): value is number {
  return isFiniteNumber(value) && value > 0;
}

function isEnumValue<const T extends readonly string[]>(
  value: unknown,
  values: T
): value is T[number] {
  return typeof value === 'string' && values.includes(value);
}

function validateChecklist(input: unknown, path: string): string[] {
  const errors: string[] = [];

  if (!isRecord(input)) {
    return [`${path} must be an object`];
  }

  const checklist = input as Record<string, unknown>;
  const requiredKeys: ReadonlyArray<keyof ScanReadinessChecklistContract> = [
    'signalQualityReady',
    'coverageReady',
    'stabilityReady',
    'baselineReady',
    'cameraPermissionReady',
    'minimumDurationMet',
  ];

  for (const key of requiredKeys) {
    if (!isBoolean(checklist[key])) {
      errors.push(`${path}.${key} must be a boolean`);
    }
  }

  return errors;
}

/**
 * Validates a scan request contract, including policy rules.
 *
 * @param input - Unknown value to validate.
 * @returns Validation result with typed value on success.
 */
export function validateScanRequestContract(input: unknown): ValidationResult<ScanRequestContract> {
  const errors: string[] = [];

  if (!isRecord(input)) {
    return { success: false, errors: ['scan request must be an object'] };
  }

  if (!isEnumValue(input.type, DOMAIN_SCAN_TYPES)) {
    errors.push('scan request.type must be a valid scan type');
  }

  if (!isEnumValue(input.mode, DOMAIN_SESSION_MODES)) {
    errors.push('scan request.mode must be a valid session mode');
  }

  if (!(input.templateId === null || isEnumValue(input.templateId, DOMAIN_TRADER_TEMPLATE_IDS))) {
    errors.push('scan request.templateId must be null or a valid trader template');
  }

  if (!isPositiveTimestamp(input.requestedAt)) {
    errors.push('scan request.requestedAt must be a positive timestamp');
  }

  if (!isBoolean(input.baselineAvailable)) {
    errors.push('scan request.baselineAvailable must be a boolean');
  }

  if (!isBoolean(input.featureFlagEnabled)) {
    errors.push('scan request.featureFlagEnabled must be a boolean');
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  const request = input as unknown as ScanRequestContract;
  const policyErrors = validateScanRequestPolicy(request);

  if (policyErrors.length > 0) {
    return { success: false, errors: policyErrors };
  }

  return { success: true, value: request };
}

/**
 * Validates the canonical scan handoff payload.
 *
 * @param input - Unknown value to validate.
 * @returns Validation result with typed value on success.
 */
export function validateScanHandoffContract(input: unknown): ValidationResult<ScanHandoffContract> {
  const errors: string[] = [];

  if (!isRecord(input)) {
    return { success: false, errors: ['scan handoff must be an object'] };
  }

  if (!isFiniteNumber(input.edgeScore) || input.edgeScore < 0 || input.edgeScore > 100) {
    errors.push('scan handoff.edgeScore must be a number between 0 and 100');
  }

  if (!isEnumValue(input.zone, DOMAIN_EDGE_ZONES)) {
    errors.push('scan handoff.zone must be a valid edge zone');
  }

  if (!isFiniteNumber(input.confidence) || input.confidence < 0 || input.confidence > 1) {
    errors.push('scan handoff.confidence must be a number between 0 and 1');
  }

  if (!isEnumValue(input.confidenceBand, DOMAIN_CONFIDENCE_BANDS)) {
    errors.push('scan handoff.confidenceBand must be a valid confidence band');
  }

  if (!isEnumValue(input.gateResult, DOMAIN_GATE_RESULTS)) {
    errors.push('scan handoff.gateResult must be a valid gate result');
  }

  if (!isFiniteNumber(input.scanDurationSec) || input.scanDurationSec <= 0) {
    errors.push('scan handoff.scanDurationSec must be a positive number');
  }

  if (!isEnumValue(input.signalGrade, SIGNAL_GRADES)) {
    errors.push('scan handoff.signalGrade must be a valid signal grade');
  }

  if (!isPositiveTimestamp(input.timestamp)) {
    errors.push('scan handoff.timestamp must be a positive timestamp');
  }

  if (!isRecord(input.drivers)) {
    errors.push('scan handoff.drivers must be an object');
  } else {
    const driverKeys = [
      'hrv',
      'hrStability',
      'respiration',
      'stressProxy',
      'sleepRecovery',
      'recentTrend',
      'baselineFreshness',
      'signalQuality',
    ] as const;

    for (const key of driverKeys) {
      const value = input.drivers[key];
      if (!isFiniteNumber(value) || value < 0 || value > 100) {
        errors.push(`scan handoff.drivers.${key} must be a number between 0 and 100`);
      }
    }
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  return { success: true, value: input as unknown as ScanHandoffContract };
}

/**
 * Validates a persisted scan record and enforces the privacy policy that raw
 * biometrics never reach encrypted persistence.
 *
 * @param input - Unknown value to validate.
 * @returns Validation result with typed value on success.
 */
export function validatePersistedScanRecordContract(
  input: unknown
): ValidationResult<PersistedScanRecordContract> {
  const errors: string[] = [];

  if (!isRecord(input)) {
    return { success: false, errors: ['persisted scan record must be an object'] };
  }

  if (typeof input.id !== 'string' || input.id.trim().length === 0) {
    errors.push('persisted scan record.id must be a non-empty string');
  }

  if (!isEnumValue(input.type, DOMAIN_SCAN_TYPES)) {
    errors.push('persisted scan record.type must be a valid scan type');
  }

  if (!isEnumValue(input.mode, DOMAIN_SESSION_MODES)) {
    errors.push('persisted scan record.mode must be a valid session mode');
  }

  if (!(input.templateId === null || isEnumValue(input.templateId, DOMAIN_TRADER_TEMPLATE_IDS))) {
    errors.push('persisted scan record.templateId must be null or a valid trader template');
  }

  errors.push(...validateChecklist(input.checklist, 'persisted scan record.checklist'));

  const handoffResult = validateScanHandoffContract(input.handoff);
  if (!handoffResult.success) {
    errors.push(...handoffResult.errors.map(error => `persisted scan record.handoff: ${error}`));
  }

  if (input.storagePolicy !== 'encrypted_sqlite') {
    errors.push('persisted scan record.storagePolicy must be "encrypted_sqlite"');
  }

  if (!isPositiveTimestamp(input.createdAt)) {
    errors.push('persisted scan record.createdAt must be a positive timestamp');
  }

  if (!isPositiveTimestamp(input.updatedAt)) {
    errors.push('persisted scan record.updatedAt must be a positive timestamp');
  }

  for (const key of DISALLOWED_PERSISTED_KEYS) {
    if (key in input) {
      errors.push(`persisted scan record cannot contain ${key}`);
    }
  }

  for (const key of Object.keys(input)) {
    if (key.startsWith('raw')) {
      errors.push(`persisted scan record cannot contain privacy-sensitive key "${key}"`);
    }
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  return { success: true, value: input as unknown as PersistedScanRecordContract };
}

/**
 * Asserts that a scan request contract is valid.
 *
 * @param input - Unknown request payload.
 */
export function assertScanRequestContract(input: unknown): asserts input is ScanRequestContract {
  const result = validateScanRequestContract(input);
  if (!result.success) {
    throw new Error(result.errors.join('; '));
  }
}

/**
 * Asserts that a scan handoff contract is valid.
 *
 * @param input - Unknown handoff payload.
 */
export function assertScanHandoffContract(input: unknown): asserts input is ScanHandoffContract {
  const result = validateScanHandoffContract(input);
  if (!result.success) {
    throw new Error(result.errors.join('; '));
  }
}

/**
 * Asserts that a persisted scan record is valid and privacy-safe.
 *
 * @param input - Unknown persistence payload.
 */
export function assertPersistedScanRecordContract(
  input: unknown
): asserts input is PersistedScanRecordContract {
  const result = validatePersistedScanRecordContract(input);
  if (!result.success) {
    throw new Error(result.errors.join('; '));
  }
}
