/**
 * @module features/devices/adapters/healthKitMapping
 * @description Turns Apple 健康 (HealthKit) samples into canonical
 * `BiometricSample`s.
 *
 * This is the half of the HealthKit adapter that needs no Mac: the native
 * bridge's only job is to hand over `{ identifier, value, unit, dates }`, and
 * everything after that — which metric it is, what unit it arrived in, whether
 * the number is plausible — is decided here, under test.
 *
 * Two deliberate refusals, because both failure modes are silent:
 *
 *   1. **An unknown unit is rejected, never assumed.** HealthKit's percent unit
 *      is a fraction (0.97 = 97%) while most bridges hand over 97, and SDNN
 *      arrives in seconds from Apple but milliseconds from most wrappers. A
 *      wrong guess here does not crash — it quietly moves a baseline. So the
 *      bridge must say which unit it used, in the vocabulary below.
 *   2. **Every mapped sample goes through the domain validator**, so a unit
 *      slip that survives step 1 still hits the plausibility range (an SpO2 of
 *      0.97 is rejected rather than stored as 0.97%).
 *
 * @see domain/src/schemas/wearable-schema.ts
 * @see docs/WEARABLE-INTEGRATION.md §5
 */

import {
  type BiometricMetric,
  type BiometricPermissionScope,
  type BiometricSample,
  type SampleQualityGrade,
  validateBiometricSample,
} from '@tenki/domain';

/** HealthKit quantity types TENKI consumes, by Apple's identifier. */
export const HEALTHKIT_METRIC_BY_IDENTIFIER: Readonly<Record<string, BiometricMetric>> = {
  heartRate: 'heart_rate_bpm',
  restingHeartRate: 'resting_heart_rate_bpm',
  heartRateVariabilitySDNN: 'hrv_sdnn_ms',
  respiratoryRate: 'respiratory_rate_brpm',
  oxygenSaturation: 'spo2_pct',
  stepCount: 'steps_count',
  activeEnergyBurned: 'active_energy_kcal',
};

/**
 * Units the bridge may declare, per metric, and how to reach the canonical
 * unit. `fraction` and `percent` are listed separately on purpose: that
 * distinction is the one HealthKit itself is ambiguous about.
 */
const UNIT_CONVERSIONS: Readonly<
  Record<BiometricMetric, Readonly<Record<string, (value: number) => number>>>
> = {
  heart_rate_bpm: { 'count/min': (v) => v, bpm: (v) => v },
  resting_heart_rate_bpm: { 'count/min': (v) => v, bpm: (v) => v },
  hrv_sdnn_ms: { ms: (v) => v, s: (v) => v * 1000 },
  respiratory_rate_brpm: { 'count/min': (v) => v, bpm: (v) => v },
  spo2_pct: { percent: (v) => v, fraction: (v) => v * 100 },
  steps_count: { count: (v) => v },
  active_energy_kcal: { kcal: (v) => v },
  // Not produced by quantity samples — sleep arrives as a session, see below.
  sleep_duration_hours: {},
  sleep_quality_pct: {},
  rr_interval_ms: {},
  hrv_rmssd_ms: {},
};

/** One quantity sample, as the native bridge must hand it over. */
export interface HealthKitQuantitySample {
  /** Apple's identifier without the `HKQuantityTypeIdentifier` prefix. */
  identifier: string;
  value: number;
  /** Which unit `value` is in — must be one this module knows. */
  unit: string;
  /** When the measurement was taken (Unix ms). */
  endDate: number;
  /** Device as reported by HealthKit ("Apple Watch"), when known. */
  deviceName?: string | null;
  /** Writing app as reported by HealthKit ("Garmin Connect"), when known. */
  sourceName?: string | null;
  /** HealthKit's `HKMetadataKeyWasUserEntered` — a typed-in number, not a measurement. */
  wasUserEntered?: boolean;
}

/** A sleep session as the bridge must hand it over. */
export interface HealthKitSleepSession {
  /** Sleep start (Unix ms). */
  startDate: number;
  /** Sleep end (Unix ms). */
  endDate: number;
  deviceName?: string | null;
  sourceName?: string | null;
}

/** Outcome of mapping one sample. */
export type MappingResult =
  /** Mapped and validated. */
  | { status: 'mapped'; sample: BiometricSample }
  /** A sample TENKI does not consume — normal, not a problem. */
  | { status: 'ignored'; reason: string }
  /** A sample that should have mapped but cannot be trusted. */
  | { status: 'rejected'; errors: string[] };

/** Hub-derived measurements are good but not reference-grade. */
const HUB_QUALITY: SampleQualityGrade = 4;
const HUB_CONFIDENCE = 0.8;
/** A number a person typed in is not a measurement. */
const USER_ENTERED_QUALITY: SampleQualityGrade = 2;
const USER_ENTERED_CONFIDENCE = 0.4;

/**
 * Maps one HealthKit quantity sample into the canonical contract.
 *
 * @param sample - The bridge's sample.
 * @param scope - Consent bucket this read was made under.
 * @param now - Current time (Unix ms), for the validator's clock check.
 * @returns Mapped, ignored, or rejected — never a guess.
 */
export function mapQuantitySample(
  sample: HealthKitQuantitySample,
  scope: BiometricPermissionScope,
  now: number = Date.now(),
): MappingResult {
  const metric = HEALTHKIT_METRIC_BY_IDENTIFIER[sample.identifier];
  if (!metric) {
    return { status: 'ignored', reason: `unmapped HealthKit identifier ${sample.identifier}` };
  }

  const convert = UNIT_CONVERSIONS[metric][sample.unit];
  if (!convert) {
    return {
      status: 'rejected',
      errors: [
        `HealthKit sample for ${metric} arrived in unit "${sample.unit}", which this adapter will not assume`,
      ],
    };
  }

  return validateMapped(
    {
      metric,
      value: convert(sample.value),
      observedAt: sample.endDate,
      sourcePlatform: 'healthkit',
      sourceDevice: sample.deviceName ?? null,
      sourceApp: sample.sourceName ?? null,
      quality: sample.wasUserEntered ? USER_ENTERED_QUALITY : HUB_QUALITY,
      confidence: sample.wasUserEntered ? USER_ENTERED_CONFIDENCE : HUB_CONFIDENCE,
      permissionScope: scope,
    },
    now,
  );
}

/**
 * Maps a sleep session to its derived duration.
 *
 * Only the duration crosses into TENKI: the stage-by-stage breakdown is a
 * richer signal than the Edge Score consumes today, and reading more than is
 * used is exactly what the per-scope consent model exists to avoid.
 *
 * @param session - The bridge's sleep session.
 * @param scope - Consent bucket this read was made under.
 * @param now - Current time (Unix ms).
 * @returns Mapped, ignored, or rejected.
 */
export function mapSleepSession(
  session: HealthKitSleepSession,
  scope: BiometricPermissionScope,
  now: number = Date.now(),
): MappingResult {
  const durationMs = session.endDate - session.startDate;
  if (durationMs <= 0) {
    return { status: 'rejected', errors: ['sleep session ends before it starts'] };
  }

  return validateMapped(
    {
      metric: 'sleep_duration_hours',
      value: durationMs / 3_600_000,
      // A night is dated by when it ended — that is when it becomes context.
      observedAt: session.endDate,
      sourcePlatform: 'healthkit',
      sourceDevice: session.deviceName ?? null,
      sourceApp: session.sourceName ?? null,
      quality: HUB_QUALITY,
      confidence: HUB_CONFIDENCE,
      permissionScope: scope,
    },
    now,
  );
}

function validateMapped(candidate: BiometricSample, now: number): MappingResult {
  const result = validateBiometricSample(candidate, now);
  return result.success
    ? { status: 'mapped', sample: result.value }
    : { status: 'rejected', errors: result.errors };
}
