import {
  BIOMETRIC_METRICS,
  type BiometricSample,
  LOCAL_ONLY_METRICS,
  isHrvMetric,
  mayLeaveDevice,
} from '../contracts/wearable-sample';
import {
  MAX_CLOCK_SKEW_MS,
  METRIC_PLAUSIBLE_RANGES,
  partitionValidSamples,
  validateBiometricSample,
} from '../schemas/wearable-schema';

const NOW = 1_760_000_000_000;

function sample(overrides: Partial<BiometricSample> = {}): BiometricSample {
  return {
    metric: 'heart_rate_bpm',
    value: 62,
    observedAt: NOW - 1000,
    sourcePlatform: 'ble_chest',
    sourceDevice: 'Polar H10',
    sourceApp: null,
    quality: 5,
    confidence: 0.95,
    permissionScope: 'scan',
    ...overrides,
  };
}

describe('wearable sample contract', () => {
  it('keeps SDNN and RMSSD as separate metrics', () => {
    expect(BIOMETRIC_METRICS).toContain('hrv_sdnn_ms');
    expect(BIOMETRIC_METRICS).toContain('hrv_rmssd_ms');
    expect(isHrvMetric('hrv_sdnn_ms')).toBe(true);
    expect(isHrvMetric('hrv_rmssd_ms')).toBe(true);
    expect(isHrvMetric('heart_rate_bpm')).toBe(false);
  });

  it('keeps the raw inter-beat series on the device', () => {
    expect(LOCAL_ONLY_METRICS).toEqual(['rr_interval_ms']);
    expect(mayLeaveDevice('rr_interval_ms')).toBe(false);
    // Values DERIVED from the series are not raw and may sync.
    expect(mayLeaveDevice('hrv_rmssd_ms')).toBe(true);
    expect(mayLeaveDevice('sleep_duration_hours')).toBe(true);
  });

  it('declares a plausible range for every metric', () => {
    for (const metric of BIOMETRIC_METRICS) {
      const range = METRIC_PLAUSIBLE_RANGES[metric];
      expect(range).toBeDefined();
      expect(range[0]).toBeLessThan(range[1]);
    }
  });
});

describe('validateBiometricSample', () => {
  it('accepts a well-formed sample', () => {
    const result = validateBiometricSample(sample(), NOW);
    expect(result.success).toBe(true);
  });

  it('rejects a non-object', () => {
    expect(validateBiometricSample(null, NOW).success).toBe(false);
    expect(validateBiometricSample([sample()], NOW).success).toBe(false);
  });

  it('rejects an unknown metric or platform', () => {
    const badMetric = validateBiometricSample(sample({ metric: 'body_battery' as never }), NOW);
    expect(badMetric.success).toBe(false);

    const badPlatform = validateBiometricSample(
      sample({ sourcePlatform: 'google_fit' as never }),
      NOW,
    );
    expect(badPlatform.success).toBe(false);
  });

  it('rejects a value outside the metric range instead of clamping it', () => {
    const result = validateBiometricSample(sample({ value: 900 }), NOW);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors[0]).toContain('plausible range');
    }
  });

  it('ranges are per metric, so a valid HR is not a valid SpO2', () => {
    expect(validateBiometricSample(sample({ metric: 'spo2_pct', value: 62 }), NOW).success).toBe(
      true,
    );
    expect(validateBiometricSample(sample({ metric: 'spo2_pct', value: 140 }), NOW).success).toBe(
      false,
    );
  });

  it('tolerates small clock skew but rejects a future timestamp', () => {
    expect(
      validateBiometricSample(sample({ observedAt: NOW + MAX_CLOCK_SKEW_MS - 1 }), NOW).success,
    ).toBe(true);
    expect(
      validateBiometricSample(sample({ observedAt: NOW + MAX_CLOCK_SKEW_MS + 1 }), NOW).success,
    ).toBe(false);
  });

  it('rejects a non-finite value and an out-of-band confidence', () => {
    expect(validateBiometricSample(sample({ value: Number.NaN }), NOW).success).toBe(false);
    expect(validateBiometricSample(sample({ confidence: 1.4 }), NOW).success).toBe(false);
    expect(validateBiometricSample(sample({ quality: 6 as never }), NOW).success).toBe(false);
  });

  it('requires provenance fields to be present, even when unknown', () => {
    const { sourceDevice: _omitted, ...withoutDevice } = sample();
    expect(validateBiometricSample(withoutDevice, NOW).success).toBe(false);
    expect(validateBiometricSample(sample({ sourceDevice: null }), NOW).success).toBe(true);
  });

  it('reports every problem at once', () => {
    const result = validateBiometricSample(
      sample({ metric: 'nope' as never, confidence: 3, permissionScope: 'all' as never }),
      NOW,
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.length).toBeGreaterThanOrEqual(3);
    }
  });
});

describe('partitionValidSamples', () => {
  it('keeps the good samples and reports the bad ones by index', () => {
    const { accepted, rejected } = partitionValidSamples(
      [sample(), sample({ value: -5 }), sample({ metric: 'hrv_rmssd_ms', value: 44 })],
      NOW,
    );

    expect(accepted).toHaveLength(2);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].index).toBe(1);
  });

  it('returns empty results for an empty batch', () => {
    expect(partitionValidSamples([], NOW)).toEqual({ accepted: [], rejected: [] });
  });
});
