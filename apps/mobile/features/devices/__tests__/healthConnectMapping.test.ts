import { HEALTHKIT_METRIC_BY_IDENTIFIER } from '../adapters/healthKitMapping';
import {
  type RawHealthConnectRecord,
  mapHealthConnectRecord,
} from '../adapters/healthConnectMapping';

const NOW = 1_760_000_000_000;
const RECENT = NOW - 60_000;

function record(overrides: Partial<RawHealthConnectRecord> = {}): RawHealthConnectRecord {
  return {
    recordType: 'HeartRate',
    beatsPerMinute: 62,
    time: RECENT,
    dataOriginPackage: 'com.garmin.android.apps.connectmobile',
    deviceModel: 'Forerunner 265',
    ...overrides,
  } as RawHealthConnectRecord;
}

describe('mapHealthConnectRecord', () => {
  it('maps a heart rate with its provenance intact', () => {
    const result = mapHealthConnectRecord(record(), 'scan', NOW);
    expect(result.status).toBe('mapped');
    if (result.status !== 'mapped') return;

    expect(result.sample).toMatchObject({
      metric: 'heart_rate_bpm',
      value: 62,
      sourcePlatform: 'health_connect',
      sourceDevice: 'Forerunner 265',
      sourceApp: 'com.garmin.android.apps.connectmobile',
    });
  });

  it('files Health Connect HRV as RMSSD, never as SDNN', () => {
    const result = mapHealthConnectRecord(
      record({
        recordType: 'HeartRateVariabilityRmssd',
        heartRateVariabilityMillis: 44,
      } as Partial<RawHealthConnectRecord>),
      'context',
      NOW,
    );

    expect(result.status).toBe('mapped');
    if (result.status !== 'mapped') return;
    expect(result.sample.metric).toBe('hrv_rmssd_ms');
  });

  it('is impossible for the two platforms to produce the same HRV metric', () => {
    // The whole point of one mapper per platform: Apple can only make SDNN,
    // Health Connect can only make RMSSD.
    const hc = mapHealthConnectRecord(
      record({
        recordType: 'HeartRateVariabilityRmssd',
        heartRateVariabilityMillis: 44,
      } as Partial<RawHealthConnectRecord>),
      'context',
      NOW,
    );
    expect(hc.status === 'mapped' && hc.sample.metric).toBe('hrv_rmssd_ms');
    expect(Object.values(HEALTHKIT_METRIC_BY_IDENTIFIER)).toContain('hrv_sdnn_ms');
    expect(Object.values(HEALTHKIT_METRIC_BY_IDENTIFIER)).not.toContain('hrv_rmssd_ms');
  });

  it('takes SpO2 as an already-scaled percentage, unlike HealthKit', () => {
    const result = mapHealthConnectRecord(
      record({ recordType: 'OxygenSaturation', percentage: 97 } as Partial<RawHealthConnectRecord>),
      'context',
      NOW,
    );
    expect(result.status).toBe('mapped');
    if (result.status !== 'mapped') return;
    expect(result.sample.value).toBe(97);
  });

  it('converts joules to kilocalories and refuses any other energy unit', () => {
    const joules = mapHealthConnectRecord(
      record({
        recordType: 'ActiveCaloriesBurned',
        energy: { unit: 'joules', value: 4184 },
        endTime: RECENT,
      } as Partial<RawHealthConnectRecord>),
      'context',
      NOW,
    );
    expect(joules.status).toBe('mapped');
    if (joules.status === 'mapped') expect(joules.sample.value).toBeCloseTo(1, 6);

    const unknown = mapHealthConnectRecord(
      record({
        recordType: 'ActiveCaloriesBurned',
        energy: { unit: 'calories', value: 500 },
        endTime: RECENT,
      } as unknown as Partial<RawHealthConnectRecord>),
      'context',
      NOW,
    );
    expect(unknown.status).toBe('rejected');
    if (unknown.status === 'rejected') expect(unknown.errors[0]).toContain('will not assume');
  });

  it('derives sleep duration and dates it by when the night ended', () => {
    const endTime = NOW - 2 * 3_600_000;
    const result = mapHealthConnectRecord(
      record({
        recordType: 'SleepSession',
        startTime: endTime - 7 * 3_600_000,
        endTime,
      } as Partial<RawHealthConnectRecord>),
      'context',
      NOW,
    );

    expect(result.status).toBe('mapped');
    if (result.status !== 'mapped') return;
    expect(result.sample.metric).toBe('sleep_duration_hours');
    expect(result.sample.value).toBeCloseTo(7, 6);
    expect(result.sample.observedAt).toBe(endTime);
  });

  it('rejects a sleep session that ends before it starts', () => {
    const result = mapHealthConnectRecord(
      record({
        recordType: 'SleepSession',
        startTime: NOW,
        endTime: NOW - 1000,
      } as Partial<RawHealthConnectRecord>),
      'context',
      NOW,
    );
    expect(result.status).toBe('rejected');
  });

  it('ignores record types TENKI does not consume', () => {
    const result = mapHealthConnectRecord(
      record({ recordType: 'BodyTemperature' } as Partial<RawHealthConnectRecord>),
      'context',
      NOW,
    );
    expect(result.status).toBe('ignored');
    if (result.status === 'ignored') expect(result.reason).toContain('BodyTemperature');
  });

  it('rejects a known record type that arrives with the wrong shape', () => {
    // The boundary cast cannot make a missing field appear — the validator
    // catches it before it can reach a baseline.
    const result = mapHealthConnectRecord(
      { recordType: 'HeartRate', time: RECENT } as RawHealthConnectRecord,
      'scan',
      NOW,
    );
    expect(result.status).toBe('rejected');
    if (result.status === 'rejected') expect(result.errors[0]).toContain('finite number');
  });

  it('rejects an implausible heart rate rather than storing it', () => {
    const result = mapHealthConnectRecord(record({ beatsPerMinute: 900 }), 'scan', NOW);
    expect(result.status).toBe('rejected');
  });
});
