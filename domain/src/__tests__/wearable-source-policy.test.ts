import type { BiometricSample } from '../contracts/wearable-sample';
import {
  METRIC_FRESHNESS_MS,
  SOURCE_PLATFORM_PRIORITY,
  isSampleFresh,
  isUsableSample,
  resolveLatestByMetric,
  resolveSourcePlatform,
  sampleAgeMs,
  selectPreferredSample,
} from '../policies/wearable-source-policy';

const NOW = 1_760_000_000_000;

function sample(overrides: Partial<BiometricSample> = {}): BiometricSample {
  return {
    metric: 'heart_rate_bpm',
    value: 62,
    observedAt: NOW - 1000,
    sourcePlatform: 'healthkit',
    sourceDevice: 'Apple Watch',
    sourceApp: null,
    quality: 4,
    confidence: 0.8,
    permissionScope: 'scan',
    ...overrides,
  };
}

describe('source ranking', () => {
  it('puts the chest strap above the health hubs, and manual entry last', () => {
    expect(SOURCE_PLATFORM_PRIORITY.ble_chest).toBeGreaterThan(SOURCE_PLATFORM_PRIORITY.healthkit);
    expect(SOURCE_PLATFORM_PRIORITY.healthkit).toBeGreaterThan(
      SOURCE_PLATFORM_PRIORITY.finger_scan,
    );
    expect(SOURCE_PLATFORM_PRIORITY.finger_scan).toBeGreaterThan(SOURCE_PLATFORM_PRIORITY.camera);
    expect(SOURCE_PLATFORM_PRIORITY.camera).toBeGreaterThan(SOURCE_PLATFORM_PRIORITY.manual);
  });

  it('ranks the two health hubs equally — neither platform is privileged', () => {
    expect(SOURCE_PLATFORM_PRIORITY.health_connect).toBe(SOURCE_PLATFORM_PRIORITY.healthkit);
  });
});

describe('freshness', () => {
  it('expires a live metric in minutes and a context metric in more than a day', () => {
    expect(METRIC_FRESHNESS_MS.heart_rate_bpm).toBeLessThan(60 * 60_000);
    expect(METRIC_FRESHNESS_MS.sleep_duration_hours).toBeGreaterThan(24 * 60 * 60_000);
  });

  it('treats a sample at exactly the window edge as still fresh', () => {
    const edge = sample({ observedAt: NOW - METRIC_FRESHNESS_MS.heart_rate_bpm });
    expect(isSampleFresh(edge, NOW)).toBe(true);

    const past = sample({ observedAt: NOW - METRIC_FRESHNESS_MS.heart_rate_bpm - 1 });
    expect(isSampleFresh(past, NOW)).toBe(false);
  });

  it('clamps clock skew rather than reporting a negative age', () => {
    expect(sampleAgeMs(sample({ observedAt: NOW + 5000 }), NOW)).toBe(0);
  });

  it('rejects a low-quality sample even when it is fresh', () => {
    expect(isUsableSample(sample({ quality: 1 }), NOW)).toBe(false);
    expect(isUsableSample(sample({ quality: 2 }), NOW)).toBe(true);
  });
});

describe('selectPreferredSample', () => {
  it('prefers the chest strap over a slightly newer watch reading', () => {
    const chest = sample({ sourcePlatform: 'ble_chest', observedAt: NOW - 4000, value: 58 });
    const watch = sample({ sourcePlatform: 'healthkit', observedAt: NOW - 1000, value: 71 });

    expect(selectPreferredSample([watch, chest], 'heart_rate_bpm', NOW)).toBe(chest);
  });

  it('falls back to the next source when the top one is stale', () => {
    const staleChest = sample({
      sourcePlatform: 'ble_chest',
      observedAt: NOW - METRIC_FRESHNESS_MS.heart_rate_bpm - 1,
    });
    const watch = sample({ sourcePlatform: 'healthkit' });

    expect(selectPreferredSample([staleChest, watch], 'heart_rate_bpm', NOW)).toBe(watch);
  });

  it('breaks a same-platform tie by quality, then confidence, then recency', () => {
    const better = sample({ quality: 5, observedAt: NOW - 3000 });
    const worse = sample({ quality: 3, observedAt: NOW - 500 });
    expect(selectPreferredSample([worse, better], 'heart_rate_bpm', NOW)).toBe(better);

    const confident = sample({ confidence: 0.9, observedAt: NOW - 3000 });
    const unsure = sample({ confidence: 0.4, observedAt: NOW - 500 });
    expect(selectPreferredSample([unsure, confident], 'heart_rate_bpm', NOW)).toBe(confident);

    const newer = sample({ observedAt: NOW - 500 });
    const older = sample({ observedAt: NOW - 5000 });
    expect(selectPreferredSample([older, newer], 'heart_rate_bpm', NOW)).toBe(newer);
  });

  it('ignores samples of other metrics', () => {
    const hrv = sample({ metric: 'hrv_rmssd_ms', value: 44, sourcePlatform: 'ble_chest' });
    const hr = sample();
    expect(selectPreferredSample([hrv, hr], 'heart_rate_bpm', NOW)).toBe(hr);
  });

  it('returns null when nothing usable is available', () => {
    expect(selectPreferredSample([], 'heart_rate_bpm', NOW)).toBeNull();
    expect(selectPreferredSample([sample({ quality: 0 })], 'heart_rate_bpm', NOW)).toBeNull();
  });
});

describe('resolveLatestByMetric', () => {
  it('keeps SDNN and RMSSD apart instead of collapsing them into one HRV value', () => {
    const sdnn = sample({ metric: 'hrv_sdnn_ms', value: 58, sourcePlatform: 'healthkit' });
    const rmssd = sample({ metric: 'hrv_rmssd_ms', value: 41, sourcePlatform: 'ble_chest' });

    const resolved = resolveLatestByMetric([sdnn, rmssd], NOW);

    expect(resolved.size).toBe(2);
    expect(resolved.get('hrv_sdnn_ms')?.value).toBe(58);
    expect(resolved.get('hrv_rmssd_ms')?.value).toBe(41);
  });

  it('returns one winner per metric and drops unusable samples entirely', () => {
    const resolved = resolveLatestByMetric(
      [
        sample({ sourcePlatform: 'camera', value: 70 }),
        sample({ sourcePlatform: 'ble_chest', value: 58 }),
        sample({ metric: 'spo2_pct', value: 97, quality: 1 }),
      ],
      NOW,
    );

    expect(resolved.size).toBe(1);
    expect(resolved.get('heart_rate_bpm')?.value).toBe(58);
    expect(resolved.has('spo2_pct')).toBe(false);
  });

  it('does not depend on input order', () => {
    const chest = sample({ sourcePlatform: 'ble_chest', value: 58 });
    const camera = sample({ sourcePlatform: 'camera', value: 70 });

    expect(resolveLatestByMetric([chest, camera], NOW).get('heart_rate_bpm')).toBe(chest);
    expect(resolveLatestByMetric([camera, chest], NOW).get('heart_rate_bpm')).toBe(chest);
  });
});

describe('resolveSourcePlatform', () => {
  it('passes canonical platforms through', () => {
    expect(resolveSourcePlatform('ble_chest')).toBe('ble_chest');
    expect(resolveSourcePlatform('health_connect')).toBe('health_connect');
  });

  it('maps the legacy per-package names onto canonical platforms', () => {
    expect(resolveSourcePlatform('watch_healthkit')).toBe('healthkit');
    expect(resolveSourcePlatform('finger_ppg')).toBe('finger_scan');
    expect(resolveSourcePlatform('rppg_glabella')).toBe('camera');
    expect(resolveSourcePlatform('face_estimate')).toBe('camera');
  });

  it('returns null for a name that is not a platform', () => {
    // 'fusion' is a derived state in the mobile store, not a data source.
    expect(resolveSourcePlatform('fusion')).toBeNull();
    expect(resolveSourcePlatform('google_fit')).toBeNull();
    expect(resolveSourcePlatform('toString')).toBeNull();
  });
});
