import { mapHealthConnectRecord } from '../adapters/healthConnectMapping';
import {
  type LibraryHealthConnectRecord,
  RECORDING_METHOD_MANUAL_ENTRY,
  normalizeHealthConnectRecord,
  normalizeHealthConnectRecords,
} from '../adapters/healthConnectNormalize';

const NOW = Date.parse('2026-09-08T08:00:00.000Z');
const T1 = '2026-09-08T07:58:00.000Z';
const T2 = '2026-09-08T07:59:00.000Z';

const META = {
  dataOrigin: 'com.google.android.apps.healthdata',
  device: { manufacturer: 'Google', model: 'Pixel Watch' },
};

describe('normalizeHealthConnectRecord', () => {
  it('expands a heart-rate record into one reading per beat', () => {
    const normalized = normalizeHealthConnectRecord({
      recordType: 'HeartRate',
      startTime: T1,
      endTime: T2,
      metadata: META,
      samples: [
        { time: T1, beatsPerMinute: 61 },
        { time: T2, beatsPerMinute: 64 },
      ],
    });

    expect(normalized).toHaveLength(2);
    expect(normalized.map((n) => n.record)).toEqual([
      expect.objectContaining({ recordType: 'HeartRate', beatsPerMinute: 61, time: Date.parse(T1) }),
      expect.objectContaining({ recordType: 'HeartRate', beatsPerMinute: 64, time: Date.parse(T2) }),
    ]);
  });

  it('converts ISO timestamps to Unix ms', () => {
    const [normalized] = normalizeHealthConnectRecord({
      recordType: 'RestingHeartRate',
      time: T1,
      beatsPerMinute: 52,
    });

    expect(normalized.record).toMatchObject({ time: Date.parse(T1) });
    expect(typeof (normalized.record as { time: number }).time).toBe('number');
  });

  it('re-declares the energy unit rather than passing a bare number', () => {
    const [normalized] = normalizeHealthConnectRecord({
      recordType: 'ActiveCaloriesBurned',
      startTime: T1,
      endTime: T2,
      energy: { inKilocalories: 240 },
    });

    expect(normalized.record).toMatchObject({
      energy: { unit: 'kilocalories', value: 240 },
    });
  });

  it('carries provenance through, joining manufacturer and model', () => {
    const [normalized] = normalizeHealthConnectRecord({
      recordType: 'OxygenSaturation',
      time: T1,
      percentage: 97,
      metadata: META,
    });

    expect(normalized.record).toMatchObject({
      dataOriginPackage: 'com.google.android.apps.healthdata',
      deviceModel: 'Google Pixel Watch',
    });
  });

  it('flags a manually entered record', () => {
    const [typed] = normalizeHealthConnectRecord({
      recordType: 'RestingHeartRate',
      time: T1,
      beatsPerMinute: 52,
      metadata: { ...META, recordingMethod: RECORDING_METHOD_MANUAL_ENTRY },
    });
    const [measured] = normalizeHealthConnectRecord({
      recordType: 'RestingHeartRate',
      time: T1,
      beatsPerMinute: 52,
      metadata: META,
    });

    expect(typed.wasManuallyEntered).toBe(true);
    expect(measured.wasManuallyEntered).toBe(false);
  });

  it('drops records whose timestamp cannot be parsed, rather than emitting NaN', () => {
    expect(
      normalizeHealthConnectRecord({ recordType: 'RestingHeartRate', time: 'not a date', beatsPerMinute: 52 }),
    ).toEqual([]);
    expect(normalizeHealthConnectRecord({ recordType: 'RestingHeartRate', beatsPerMinute: 52 })).toEqual([]);
    expect(
      normalizeHealthConnectRecord({
        recordType: 'HeartRate',
        samples: [{ time: 'nope', beatsPerMinute: 61 }],
      }),
    ).toEqual([]);
  });

  it('passes an unknown record type through for the mapper to ignore', () => {
    const [normalized] = normalizeHealthConnectRecord({ recordType: 'BodyTemperature', time: T1 });
    expect(normalized.record.recordType).toBe('BodyTemperature');
    expect(mapHealthConnectRecord(normalized.record, 'context', NOW).status).toBe('ignored');
  });

  it('handles missing device metadata without inventing a name', () => {
    const [normalized] = normalizeHealthConnectRecord({
      recordType: 'RestingHeartRate',
      time: T1,
      beatsPerMinute: 52,
      metadata: { dataOrigin: 'com.example.app' },
    });
    expect(normalized.record).toMatchObject({ deviceModel: null });
  });
});

describe('normalizeHealthConnectRecords → mapper', () => {
  it('turns a realistic read into samples the domain accepts', () => {
    const raw: LibraryHealthConnectRecord[] = [
      {
        recordType: 'HeartRate',
        startTime: T1,
        endTime: T2,
        metadata: META,
        samples: [
          { time: T1, beatsPerMinute: 61 },
          { time: T2, beatsPerMinute: 64 },
        ],
      },
      { recordType: 'HeartRateVariabilityRmssd', time: T2, heartRateVariabilityMillis: 44, metadata: META },
      { recordType: 'SleepSession', startTime: '2026-09-08T00:00:00.000Z', endTime: '2026-09-08T07:00:00.000Z' },
    ];

    const mapped = normalizeHealthConnectRecords(raw).map((n) =>
      mapHealthConnectRecord(n.record, 'context', NOW),
    );

    expect(mapped.every((result) => result.status === 'mapped')).toBe(true);
    const metrics = mapped.flatMap((r) => (r.status === 'mapped' ? [r.sample.metric] : []));
    expect(metrics).toEqual([
      'heart_rate_bpm',
      'heart_rate_bpm',
      'hrv_rmssd_ms',
      'sleep_duration_hours',
    ]);
  });
});
