/**
 * @module features/devices/adapters/healthConnectMapping
 * @description Turns Android Health Connect records into canonical
 * `BiometricSample`s — the mirror of the HealthKit mapper, and deliberately
 * not shared with it.
 *
 * The two platforms disagree about the thing that matters most: **Health
 * Connect's HRV type is RMSSD, Apple's is SDNN.** Keeping one mapper per
 * platform is what makes that difference impossible to paper over — each one
 * can only produce its own platform's HRV metric.
 *
 * Same two refusals as the HealthKit mapper: no assumed units, and every
 * mapped sample re-validated against the domain's plausibility ranges.
 *
 * @see features/devices/adapters/healthKitMapping.ts
 * @see docs/WEARABLE-INTEGRATION.md §3
 */

import {
  type BiometricPermissionScope,
  type BiometricSample,
  type SampleQualityGrade,
  validateBiometricSample,
} from '@tenki/domain';
import type { MappingResult } from './healthKitMapping';

/** Provenance Health Connect attaches to every record. */
interface RecordOrigin {
  /** Writing app's package name, e.g. "com.garmin.android.apps.connectmobile". */
  dataOriginPackage?: string | null;
  /** Device model as recorded, when known. */
  deviceModel?: string | null;
}

/** Energy as Health Connect expresses it — the unit travels with the value. */
export interface HealthConnectEnergy {
  unit: 'kilocalories' | 'joules';
  value: number;
}

/** The Health Connect records TENKI consumes. */
export type HealthConnectRecord = RecordOrigin &
  (
    | { recordType: 'HeartRate'; beatsPerMinute: number; time: number }
    | { recordType: 'RestingHeartRate'; beatsPerMinute: number; time: number }
    | { recordType: 'HeartRateVariabilityRmssd'; heartRateVariabilityMillis: number; time: number }
    | { recordType: 'RespiratoryRate'; rate: number; time: number }
    | { recordType: 'OxygenSaturation'; percentage: number; time: number }
    | { recordType: 'Steps'; count: number; endTime: number }
    | { recordType: 'ActiveCaloriesBurned'; energy: HealthConnectEnergy; endTime: number }
    | { recordType: 'SleepSession'; startTime: number; endTime: number }
  );

/**
 * What the bridge actually hands over: a record type we may or may not know,
 * with whatever fields Health Connect attached to it.
 */
export type RawHealthConnectRecord = RecordOrigin & { recordType: string };

/** Hub-derived measurements are good but not reference-grade. */
const HUB_QUALITY: SampleQualityGrade = 4;
const HUB_CONFIDENCE = 0.8;

const JOULES_PER_KCAL = 4184;

/**
 * Maps one Health Connect record into the canonical contract.
 *
 * @param record - The record as the native bridge hands it over.
 * @param scope - Consent bucket this read was made under.
 * @param now - Current time (Unix ms), for the validator's clock check.
 * @returns Mapped, ignored, or rejected — never a guess.
 */
export function mapHealthConnectRecord(
  raw: RawHealthConnectRecord,
  scope: BiometricPermissionScope,
  now: number = Date.now(),
): MappingResult {
  // One deliberate cast at the boundary: the bridge's payload is untyped at
  // runtime whatever we declare, so the switch below narrows the shapes we
  // know and `default` catches the rest. A record of a known type but the
  // wrong shape yields undefined fields, which the validator then rejects —
  // it never reaches a baseline.
  const record = raw as HealthConnectRecord;
  const build = (
    metric: BiometricSample['metric'],
    value: number,
    observedAt: number,
  ): MappingResult => {
    const result = validateBiometricSample(
      {
        metric,
        value,
        observedAt,
        sourcePlatform: 'health_connect',
        sourceDevice: raw.deviceModel ?? null,
        sourceApp: raw.dataOriginPackage ?? null,
        quality: HUB_QUALITY,
        confidence: HUB_CONFIDENCE,
        permissionScope: scope,
      },
      now,
    );

    return result.success
      ? { status: 'mapped', sample: result.value }
      : { status: 'rejected', errors: result.errors };
  };

  switch (record.recordType) {
    case 'HeartRate':
      return build('heart_rate_bpm', record.beatsPerMinute, record.time);

    case 'RestingHeartRate':
      return build('resting_heart_rate_bpm', record.beatsPerMinute, record.time);

    // Health Connect defines its HRV type as RMSSD — it can never become SDNN.
    case 'HeartRateVariabilityRmssd':
      return build('hrv_rmssd_ms', record.heartRateVariabilityMillis, record.time);

    case 'RespiratoryRate':
      return build('respiratory_rate_brpm', record.rate, record.time);

    // Health Connect's percentage is already 0..100, unlike HealthKit's fraction.
    case 'OxygenSaturation':
      return build('spo2_pct', record.percentage, record.time);

    case 'Steps':
      return build('steps_count', record.count, record.endTime);

    case 'ActiveCaloriesBurned': {
      const kcal = toKilocalories(record.energy);
      if (kcal === null) {
        return {
          status: 'rejected',
          errors: [
            `active energy arrived in unit "${record.energy.unit}", which this adapter will not assume`,
          ],
        };
      }
      return build('active_energy_kcal', kcal, record.endTime);
    }

    case 'SleepSession': {
      const durationMs = record.endTime - record.startTime;
      if (durationMs <= 0) {
        return { status: 'rejected', errors: ['sleep session ends before it starts'] };
      }
      // A night is dated by when it ended — that is when it becomes context.
      return build('sleep_duration_hours', durationMs / 3_600_000, record.endTime);
    }

    default:
      return {
        status: 'ignored',
        reason: `unmapped Health Connect record type ${raw.recordType}`,
      };
  }
}

/** Converts declared energy to kcal, or null when the unit is not one we know. */
function toKilocalories(energy: HealthConnectEnergy): number | null {
  if (energy.unit === 'kilocalories') return energy.value;
  if (energy.unit === 'joules') return energy.value / JOULES_PER_KCAL;
  return null;
}
