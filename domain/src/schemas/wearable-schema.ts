/**
 * @module domain/schemas/wearable-schema
 * @description Runtime validation for `BiometricSample`, the boundary every
 * platform adapter (HealthKit, Health Connect, BLE, camera) must cross.
 * Dependency-free so it runs on-device.
 *
 * Adapters read from OS APIs we do not control, so this validator treats their
 * output as untrusted: an out-of-range heart rate or a future timestamp is a
 * rejected sample, not a value the engine gets to see.
 */

import {
  BIOMETRIC_METRICS,
  BIOMETRIC_PERMISSION_SCOPES,
  BIOMETRIC_SOURCE_PLATFORMS,
  type BiometricMetric,
  type BiometricSample,
  SAMPLE_QUALITY_GRADES,
} from '../contracts/wearable-sample';
import type { ValidationResult } from './scan-schema';

/**
 * Physiologically plausible bounds per metric, inclusive. A value outside
 * these is a broken adapter or a mis-scaled unit, never a real measurement —
 * both must be rejected before they can move a baseline.
 */
export const METRIC_PLAUSIBLE_RANGES: Readonly<
  Record<BiometricMetric, readonly [number, number]>
> = {
  heart_rate_bpm: [20, 250],
  resting_heart_rate_bpm: [25, 150],
  rr_interval_ms: [240, 3000],
  hrv_sdnn_ms: [1, 400],
  hrv_rmssd_ms: [1, 400],
  respiratory_rate_brpm: [3, 60],
  spo2_pct: [50, 100],
  sleep_duration_hours: [0, 24],
  sleep_quality_pct: [0, 100],
  steps_count: [0, 200_000],
  active_energy_kcal: [0, 20_000],
};

/**
 * How far ahead of `now` a sample timestamp may sit before it is rejected.
 * Small clock skew between a watch and a phone is normal; minutes are not.
 */
export const MAX_CLOCK_SKEW_MS = 60_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isEnumValue<const T extends readonly (string | number)[]>(
  value: unknown,
  values: T,
): value is T[number] {
  return values.includes(value as T[number]);
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

/**
 * Validates one sample coming out of a platform adapter.
 *
 * @param input - Unknown value to validate.
 * @param now - Current time (Unix ms), injected for testability.
 * @returns Validation result with the typed sample on success.
 */
export function validateBiometricSample(
  input: unknown,
  now: number = Date.now(),
): ValidationResult<BiometricSample> {
  if (!isRecord(input)) {
    return { success: false, errors: ['biometric sample must be an object'] };
  }

  const errors: string[] = [];

  const metricValid = isEnumValue(input.metric, BIOMETRIC_METRICS);
  if (!metricValid) {
    errors.push('biometric sample.metric must be a known metric');
  }

  if (!isFiniteNumber(input.value)) {
    errors.push('biometric sample.value must be a finite number');
  } else if (metricValid) {
    const [min, max] = METRIC_PLAUSIBLE_RANGES[input.metric as BiometricMetric];
    if (input.value < min || input.value > max) {
      errors.push(
        `biometric sample.value ${input.value} is outside the plausible range for ${String(input.metric)} (${min}..${max})`,
      );
    }
  }

  if (!isFiniteNumber(input.observedAt) || input.observedAt <= 0) {
    errors.push('biometric sample.observedAt must be a positive timestamp');
  } else if (input.observedAt > now + MAX_CLOCK_SKEW_MS) {
    errors.push('biometric sample.observedAt cannot be in the future');
  }

  if (!isEnumValue(input.sourcePlatform, BIOMETRIC_SOURCE_PLATFORMS)) {
    errors.push('biometric sample.sourcePlatform must be a known platform');
  }

  if (!isNullableString(input.sourceDevice)) {
    errors.push('biometric sample.sourceDevice must be a string or null');
  }

  if (!isNullableString(input.sourceApp)) {
    errors.push('biometric sample.sourceApp must be a string or null');
  }

  if (!isEnumValue(input.quality, SAMPLE_QUALITY_GRADES)) {
    errors.push('biometric sample.quality must be a grade from 0 to 5');
  }

  if (!isFiniteNumber(input.confidence) || input.confidence < 0 || input.confidence > 1) {
    errors.push('biometric sample.confidence must be between 0 and 1');
  }

  if (!isEnumValue(input.permissionScope, BIOMETRIC_PERMISSION_SCOPES)) {
    errors.push('biometric sample.permissionScope must be a known permission scope');
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  return { success: true, value: input as unknown as BiometricSample };
}

/**
 * Validates a batch, keeping the good samples and reporting the rest.
 * A single malformed sample from a health hub must not discard the sync.
 *
 * @param input - Unknown values from an adapter.
 * @param now - Current time (Unix ms), injected for testability.
 * @returns Accepted samples plus one error list per rejected entry.
 */
export function partitionValidSamples(
  input: readonly unknown[],
  now: number = Date.now(),
): { accepted: BiometricSample[]; rejected: { index: number; errors: string[] }[] } {
  const accepted: BiometricSample[] = [];
  const rejected: { index: number; errors: string[] }[] = [];

  input.forEach((entry, index) => {
    const result = validateBiometricSample(entry, now);
    if (result.success) {
      accepted.push(result.value);
    } else {
      rejected.push({ index, errors: result.errors });
    }
  });

  return { accepted, rejected };
}
