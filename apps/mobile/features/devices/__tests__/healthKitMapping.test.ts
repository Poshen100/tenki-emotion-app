import {
  HEALTHKIT_METRIC_BY_IDENTIFIER,
  type HealthKitQuantitySample,
  mapQuantitySample,
  mapSleepSession,
} from '../adapters/healthKitMapping';

const NOW = 1_760_000_000_000;

function quantity(overrides: Partial<HealthKitQuantitySample> = {}): HealthKitQuantitySample {
  return {
    identifier: 'heartRate',
    value: 62,
    unit: 'count/min',
    endDate: NOW - 60_000,
    deviceName: 'Apple Watch',
    sourceName: null,
    ...overrides,
  };
}

describe('mapQuantitySample', () => {
  it('maps a heart rate with its provenance intact', () => {
    const result = mapQuantitySample(quantity(), 'scan', NOW);
    expect(result.status).toBe('mapped');
    if (result.status !== 'mapped') return;

    expect(result.sample).toMatchObject({
      metric: 'heart_rate_bpm',
      value: 62,
      sourcePlatform: 'healthkit',
      sourceDevice: 'Apple Watch',
      permissionScope: 'scan',
    });
  });

  it('files Apple HRV as SDNN, never as RMSSD', () => {
    const result = mapQuantitySample(
      quantity({ identifier: 'heartRateVariabilitySDNN', value: 58, unit: 'ms' }),
      'context',
      NOW,
    );
    expect(result.status).toBe('mapped');
    if (result.status !== 'mapped') return;
    expect(result.sample.metric).toBe('hrv_sdnn_ms');
  });

  it('converts SDNN in seconds to milliseconds', () => {
    const result = mapQuantitySample(
      quantity({ identifier: 'heartRateVariabilitySDNN', value: 0.058, unit: 's' }),
      'context',
      NOW,
    );
    expect(result.status).toBe('mapped');
    if (result.status !== 'mapped') return;
    expect(result.sample.value).toBeCloseTo(58, 6);
  });

  it('converts a fractional SpO2 to a percentage', () => {
    const result = mapQuantitySample(
      quantity({ identifier: 'oxygenSaturation', value: 0.97, unit: 'fraction' }),
      'context',
      NOW,
    );
    expect(result.status).toBe('mapped');
    if (result.status !== 'mapped') return;
    expect(result.sample.value).toBeCloseTo(97, 6);
  });

  it('refuses to assume a unit it was not told', () => {
    // HealthKit's own "%" is ambiguous across bridges — so it is not accepted.
    const result = mapQuantitySample(
      quantity({ identifier: 'oxygenSaturation', value: 0.97, unit: '%' }),
      'context',
      NOW,
    );
    expect(result.status).toBe('rejected');
    if (result.status !== 'rejected') return;
    expect(result.errors[0]).toContain('will not assume');
  });

  it('catches a unit slip that gets past the unit table, via the plausibility range', () => {
    // Bridge declared percent but handed over a fraction: 0.97% is not a real
    // reading, and the domain validator is the second net that stops it.
    const result = mapQuantitySample(
      quantity({ identifier: 'oxygenSaturation', value: 0.97, unit: 'percent' }),
      'context',
      NOW,
    );
    expect(result.status).toBe('rejected');
    if (result.status !== 'rejected') return;
    expect(result.errors[0]).toContain('plausible range');
  });

  it('ignores identifiers TENKI does not consume, without treating them as errors', () => {
    const result = mapQuantitySample(quantity({ identifier: 'bodyMass' }), 'context', NOW);
    expect(result.status).toBe('ignored');
  });

  it('downgrades a number the user typed in by hand', () => {
    const measured = mapQuantitySample(quantity(), 'scan', NOW);
    const typed = mapQuantitySample(quantity({ wasUserEntered: true }), 'scan', NOW);

    expect(measured.status).toBe('mapped');
    expect(typed.status).toBe('mapped');
    if (measured.status !== 'mapped' || typed.status !== 'mapped') return;

    expect(typed.sample.quality).toBeLessThan(measured.sample.quality);
    expect(typed.sample.confidence).toBeLessThan(measured.sample.confidence);
  });

  it('rejects a future timestamp instead of storing it', () => {
    const result = mapQuantitySample(quantity({ endDate: NOW + 3_600_000 }), 'scan', NOW);
    expect(result.status).toBe('rejected');
  });

  it('maps every identifier in the table to a metric the contract knows', () => {
    for (const [identifier, metric] of Object.entries(HEALTHKIT_METRIC_BY_IDENTIFIER)) {
      expect(typeof metric).toBe('string');
      expect(identifier.length).toBeGreaterThan(0);
    }
    // Apple reports SDNN; RMSSD must not appear on this platform's table.
    expect(Object.values(HEALTHKIT_METRIC_BY_IDENTIFIER)).not.toContain('hrv_rmssd_ms');
  });
});

describe('mapSleepSession', () => {
  it('derives duration in hours and dates it by when the night ended', () => {
    const endDate = NOW - 2 * 3_600_000;
    const result = mapSleepSession(
      { startDate: endDate - 7.5 * 3_600_000, endDate, deviceName: 'Apple Watch' },
      'context',
      NOW,
    );

    expect(result.status).toBe('mapped');
    if (result.status !== 'mapped') return;
    expect(result.sample.metric).toBe('sleep_duration_hours');
    expect(result.sample.value).toBeCloseTo(7.5, 6);
    expect(result.sample.observedAt).toBe(endDate);
  });

  it('rejects a session that ends before it starts', () => {
    const result = mapSleepSession({ startDate: NOW, endDate: NOW - 1000 }, 'context', NOW);
    expect(result.status).toBe('rejected');
  });

  it('rejects an implausibly long night rather than storing it', () => {
    const result = mapSleepSession(
      { startDate: NOW - 30 * 3_600_000, endDate: NOW },
      'context',
      NOW,
    );
    expect(result.status).toBe('rejected');
  });
});
