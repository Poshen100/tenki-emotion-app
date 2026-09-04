import {
  createEmptyBaselineProfile,
  selectHrvBaseline,
  updateBaselineProfile,
} from '../../baseline/baseline';
import type { BiometricReading } from '../../common/types';
import {
  NATIVE_HRV_METRIC,
  buildHrvObservation,
  computeHrvZScore,
} from '../hrv';

const TS = 1_760_000_000_000; // fixed instant, bucket resolved by the profile

function reading(overrides: Partial<BiometricReading> = {}): BiometricReading {
  return { hrBpm: 62, hrvRmssdMs: 42, rrBrpm: 14, timestamp: TS, ...overrides };
}

describe('NATIVE_HRV_METRIC', () => {
  it('knows Apple Health reports SDNN and Health Connect reports RMSSD', () => {
    expect(NATIVE_HRV_METRIC.healthkit).toBe('sdnn');
    expect(NATIVE_HRV_METRIC.health_connect).toBe('rmssd');
    expect(NATIVE_HRV_METRIC.ble_chest).toBe('rmssd');
    expect(NATIVE_HRV_METRIC.finger_scan).toBe('rmssd');
  });
});

describe('buildHrvObservation', () => {
  it('tags a HealthKit value as SDNN instead of converting it to RMSSD', () => {
    expect(buildHrvObservation('healthkit', { sdnnMs: 100 })).toEqual({
      metric: 'sdnn',
      valueMs: 100,
    });
  });

  it('tags a chest-strap value as RMSSD', () => {
    expect(buildHrvObservation('ble_chest', { rmssdMs: 55 })).toEqual({
      metric: 'rmssd',
      valueMs: 55,
    });
  });

  it('prefers the source native statistic when both values are present', () => {
    expect(buildHrvObservation('healthkit', { rmssdMs: 40, sdnnMs: 90 })?.metric).toBe('sdnn');
    expect(buildHrvObservation('ble_chest', { rmssdMs: 40, sdnnMs: 90 })?.metric).toBe('rmssd');
  });

  it('falls back to the other statistic, tagged honestly, rather than converting', () => {
    const observation = buildHrvObservation('healthkit', { rmssdMs: 40, sdnnMs: null });
    expect(observation).toEqual({ metric: 'rmssd', valueMs: 40 });
  });

  it('drops a value it cannot label, instead of inventing one', () => {
    expect(buildHrvObservation('healthkit', {})).toBeNull();
    expect(buildHrvObservation('healthkit', { sdnnMs: 0, rmssdMs: null })).toBeNull();
    expect(buildHrvObservation('ble_chest', { rmssdMs: Number.NaN })).toBeNull();
    expect(buildHrvObservation('ble_chest', { rmssdMs: -5 })).toBeNull();
  });
});

describe('separate HRV baseline tracks', () => {
  it('starts with no usable baseline on either track', () => {
    const profile = createEmptyBaselineProfile();
    const bucket = 'morning' as const;

    expect(selectHrvBaseline(profile, 'rmssd', bucket)).toBeNull();
    expect(selectHrvBaseline(profile, 'sdnn', bucket)).toBeNull();
  });

  it('an RMSSD reading never feeds the SDNN track', () => {
    let profile = createEmptyBaselineProfile();
    profile = updateBaselineProfile(profile, reading({ hrvRmssdMs: 42 }), 50);

    const buckets = ['morning', 'midday', 'evening'] as const;
    for (const bucket of buckets) {
      expect(selectHrvBaseline(profile, 'sdnn', bucket)).toBeNull();
    }
    expect(profile.hrv.morning.sampleCount + profile.hrv.midday.sampleCount + profile.hrv.evening.sampleCount).toBe(1);
  });

  it('keeps the two statistics in separate tracks with their own means', () => {
    let profile = createEmptyBaselineProfile();
    profile = updateBaselineProfile(profile, reading({ hrvRmssdMs: 42 }), 50, 0, 96);

    const rmssdSamples = Object.values(profile.hrv).filter((b) => b.sampleCount > 0);
    const sdnnSamples = Object.values(profile.hrvSdnn ?? {}).filter((b) => b.sampleCount > 0);

    expect(rmssdSamples).toHaveLength(1);
    expect(sdnnSamples).toHaveLength(1);
    expect(rmssdSamples[0].mean).toBe(42);
    expect(sdnnSamples[0].mean).toBe(96);
  });

  it('ignores a non-positive or non-finite SDNN instead of polluting the track', () => {
    let profile = createEmptyBaselineProfile();
    profile = updateBaselineProfile(profile, reading(), 50, 0, 0);
    profile = updateBaselineProfile(profile, reading(), 50, 0, Number.NaN);

    const sdnnSamples = Object.values(profile.hrvSdnn ?? {}).filter((b) => b.sampleCount > 0);
    expect(sdnnSamples).toHaveLength(0);
  });

  it('creates the SDNN track on a profile persisted before the track existed', () => {
    const legacyProfile = createEmptyBaselineProfile();
    legacyProfile.hrvSdnn = undefined;

    const updated = updateBaselineProfile(legacyProfile, reading(), 50, 0, 88);
    const sdnnSamples = Object.values(updated.hrvSdnn ?? {}).filter((b) => b.sampleCount > 0);

    expect(sdnnSamples).toHaveLength(1);
    expect(sdnnSamples[0].mean).toBe(88);
  });

  it('reports no SDNN baseline for an old profile rather than reusing the RMSSD one', () => {
    let profile = createEmptyBaselineProfile();
    profile = updateBaselineProfile(profile, reading({ hrvRmssdMs: 42 }), 50);
    profile.hrvSdnn = undefined;

    const buckets = ['morning', 'midday', 'evening'] as const;
    for (const bucket of buckets) {
      expect(selectHrvBaseline(profile, 'sdnn', bucket)).toBeNull();
    }
  });
});

describe('computeHrvZScore', () => {
  it('scores a value against the baseline it is paired with', () => {
    const baseline = { mean: 40, std: 10, sampleCount: 12, lastUpdatedAt: TS };
    expect(computeHrvZScore(50, baseline)).toBe(1);
    expect(computeHrvZScore(30, baseline)).toBe(-1);
  });

  it('returns 0 when the baseline cannot support a z-score', () => {
    expect(computeHrvZScore(50, { mean: 40, std: 0, sampleCount: 12, lastUpdatedAt: TS })).toBe(0);
    expect(computeHrvZScore(50, { mean: 40, std: 10, sampleCount: 0, lastUpdatedAt: TS })).toBe(0);
  });
});
