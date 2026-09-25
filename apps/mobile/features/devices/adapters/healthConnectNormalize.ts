/**
 * @module features/devices/adapters/healthConnectNormalize
 * @description Reshapes what `react-native-health-connect` actually returns
 * into the flat records `healthConnectMapping` consumes.
 *
 * Three differences between the library's shapes and ours, each of which would
 * silently produce nothing (or nonsense) if handled by guesswork:
 *
 *   1. **Times are ISO strings**, not Unix ms.
 *   2. **A HeartRate record is a bag of samples**, not one reading — an hour of
 *      watch data arrives as a single record with dozens of timestamped beats.
 *      Flattening it wrong means one heart rate where there were forty.
 *   3. **Energy arrives pre-converted** (`{inKilocalories, inJoules, …}`),
 *      not as `{unit, value}`.
 *
 * Keeping this separate from the mapper is deliberate: the mapper is the
 * canonical translation and must stay tied to the domain contract, not to one
 * npm package's types. If the library changes shape, only this file moves.
 */

import type { RawHealthConnectRecord } from './healthConnectMapping';

/** Health Connect's manual-entry recording method (`RECORDING_METHOD_MANUAL_ENTRY`). */
export const RECORDING_METHOD_MANUAL_ENTRY = 3;

/** The subset of the library's metadata this adapter reads. */
export interface HealthConnectMetadata {
  dataOrigin?: string;
  device?: { manufacturer?: string; model?: string };
  recordingMethod?: number;
}

/** A record as the library hands it over, before reshaping. */
export interface LibraryHealthConnectRecord {
  recordType: string;
  metadata?: HealthConnectMetadata;
  /** InstantaneousRecord */
  time?: string;
  /** IntervalRecord */
  startTime?: string;
  endTime?: string;
  /** HeartRate */
  samples?: { time: string; beatsPerMinute: number }[];
  beatsPerMinute?: number;
  heartRateVariabilityMillis?: number;
  rate?: number;
  percentage?: number;
  count?: number;
  energy?: { inKilocalories?: number };
}

/** A normalized record plus whether the user typed it in rather than measured it. */
export interface NormalizedHealthConnectRecord {
  record: RawHealthConnectRecord;
  wasManuallyEntered: boolean;
}

/** Parses an ISO timestamp, returning null rather than NaN. */
function parseIso(value: string | undefined): number | null {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

/** Device label for the row's freshness line, when the platform reports one. */
function describeDevice(metadata: HealthConnectMetadata | undefined): string | null {
  const device = metadata?.device;
  if (!device) return null;

  const label = [device.manufacturer, device.model].filter(Boolean).join(' ').trim();
  return label.length > 0 ? label : null;
}

/**
 * Reshapes one library record into zero or more flat records.
 *
 * Returns an array because a HeartRate record carries many samples, and each
 * beat is its own reading with its own timestamp.
 *
 * @param raw - One record from `readRecords`.
 * @returns Normalized records; empty when the record carries nothing usable.
 */
export function normalizeHealthConnectRecord(
  raw: LibraryHealthConnectRecord,
): NormalizedHealthConnectRecord[] {
  const origin = {
    dataOriginPackage: raw.metadata?.dataOrigin ?? null,
    deviceModel: describeDevice(raw.metadata),
  };
  const wasManuallyEntered = raw.metadata?.recordingMethod === RECORDING_METHOD_MANUAL_ENTRY;
  const wrap = (record: RawHealthConnectRecord): NormalizedHealthConnectRecord => ({
    record,
    wasManuallyEntered,
  });

  const time = parseIso(raw.time);
  const endTime = parseIso(raw.endTime);
  const startTime = parseIso(raw.startTime);

  switch (raw.recordType) {
    case 'HeartRate':
      // One record, many beats — each keeps its own timestamp.
      return (raw.samples ?? []).flatMap((sample) => {
        const sampleTime = parseIso(sample.time);
        if (sampleTime === null) return [];
        return [
          wrap({
            ...origin,
            recordType: 'HeartRate',
            beatsPerMinute: sample.beatsPerMinute,
            time: sampleTime,
          } as RawHealthConnectRecord),
        ];
      });

    case 'RestingHeartRate':
      if (time === null) return [];
      return [
        wrap({
          ...origin,
          recordType: 'RestingHeartRate',
          beatsPerMinute: raw.beatsPerMinute,
          time,
        } as RawHealthConnectRecord),
      ];

    case 'HeartRateVariabilityRmssd':
      if (time === null) return [];
      return [
        wrap({
          ...origin,
          recordType: 'HeartRateVariabilityRmssd',
          heartRateVariabilityMillis: raw.heartRateVariabilityMillis,
          time,
        } as RawHealthConnectRecord),
      ];

    case 'RespiratoryRate':
      if (time === null) return [];
      return [
        wrap({ ...origin, recordType: 'RespiratoryRate', rate: raw.rate, time } as RawHealthConnectRecord),
      ];

    case 'OxygenSaturation':
      if (time === null) return [];
      return [
        wrap({
          ...origin,
          recordType: 'OxygenSaturation',
          percentage: raw.percentage,
          time,
        } as RawHealthConnectRecord),
      ];

    case 'Steps':
      if (endTime === null) return [];
      return [
        wrap({ ...origin, recordType: 'Steps', count: raw.count, endTime } as RawHealthConnectRecord),
      ];

    case 'ActiveCaloriesBurned': {
      const kcal = raw.energy?.inKilocalories;
      if (endTime === null || typeof kcal !== 'number') return [];
      return [
        wrap({
          ...origin,
          recordType: 'ActiveCaloriesBurned',
          // The library already converted; re-declare the unit explicitly so the
          // mapper still refuses anything it was not told about.
          energy: { unit: 'kilocalories', value: kcal },
          endTime,
        } as RawHealthConnectRecord),
      ];
    }

    case 'SleepSession':
      if (startTime === null || endTime === null) return [];
      return [
        wrap({
          ...origin,
          recordType: 'SleepSession',
          startTime,
          endTime,
        } as RawHealthConnectRecord),
      ];

    default:
      // Unknown types reach the mapper untouched, which reports them ignored.
      return [wrap({ ...origin, recordType: raw.recordType } as RawHealthConnectRecord)];
  }
}

/** Normalizes a batch, flattening heart-rate samples across records. */
export function normalizeHealthConnectRecords(
  raw: readonly LibraryHealthConnectRecord[],
): NormalizedHealthConnectRecord[] {
  return raw.flatMap(normalizeHealthConnectRecord);
}
