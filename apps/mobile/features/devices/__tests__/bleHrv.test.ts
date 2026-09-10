import { buildStrapSamples } from '../adapters/bleHrv';
import type { HeartRateMeasurement } from '../adapters/bleHeartRate';

const NOW = 1_760_000_000_000;

function measurement(overrides: Partial<HeartRateMeasurement> = {}): HeartRateMeasurement {
  return {
    heartRateBpm: 62,
    rrIntervalsMs: [],
    sensorContact: 'good',
    energyExpendedKj: null,
    ...overrides,
  };
}

/** A believable resting RR series: ~62 bpm with normal beat-to-beat variation. */
function restingIntervals(count: number, jitter = 22): number[] {
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    // Deterministic pseudo-variation, no RNG in a test fixture.
    out.push(968 + Math.sin(i * 1.7) * jitter + Math.sin(i * 0.31) * (jitter / 2));
  }
  return out;
}

describe('chest strap → samples', () => {
  it('derives RMSSD and SDNN from real RR intervals', () => {
    const result = buildStrapSamples(
      measurement({ rrIntervalsMs: [960, 970] }),
      restingIntervals(60),
      'scan',
      NOW - 1000,
      NOW,
    );

    expect(result.hrvRefusedBecause).toBeNull();

    const rmssd = result.samples.find((s) => s.metric === 'hrv_rmssd_ms');
    const sdnn = result.samples.find((s) => s.metric === 'hrv_sdnn_ms');

    expect(rmssd).toBeDefined();
    expect(sdnn).toBeDefined();
    // Computed by TENKI from a series the strap actually measured — not the
    // strap's own claim, and not an inference from a light curve.
    expect(rmssd?.derivation).toBe('derived');
    expect(sdnn?.derivation).toBe('derived');
    expect(rmssd?.sourcePlatform).toBe('ble_chest');
  });

  it('reports heart rate as observed, since the strap states it directly', () => {
    const result = buildStrapSamples(measurement(), [], 'scan', NOW - 1000, NOW);
    const hr = result.samples.find((s) => s.metric === 'heart_rate_bpm');

    expect(hr?.value).toBe(62);
    expect(hr?.derivation).toBe('observed');
  });

  it('produces no HRV at all from a strap that reports no RR intervals', () => {
    // 🔴 The claim this blocks: "chest-strap HRV" from a device that only ever
    // sent a bpm number. There is no path from a heart rate to a variability.
    const result = buildStrapSamples(measurement({ rrIntervalsMs: [] }), [], 'scan', NOW - 1000, NOW);

    expect(result.hrvRefusedBecause).toBe('no_rr_intervals');
    expect(result.samples.map((s) => s.metric)).toEqual(['heart_rate_bpm']);
  });

  it('withholds HRV while the electrodes are not reading', () => {
    const result = buildStrapSamples(
      measurement({ sensorContact: 'poor', rrIntervalsMs: [960] }),
      restingIntervals(60),
      'scan',
      NOW - 1000,
      NOW,
    );

    // Intervals taken through poor contact describe the contact, not the user.
    expect(result.hrvRefusedBecause).toBe('poor_sensor_contact');
    expect(result.samples.some((s) => s.metric.startsWith('hrv_'))).toBe(false);
  });

  it('does not treat unknown contact as poor contact', () => {
    // Plenty of straps cannot report contact at all. That is missing
    // information, not evidence of a bad reading.
    const result = buildStrapSamples(
      measurement({ sensorContact: 'not_supported' }),
      restingIntervals(60),
      'scan',
      NOW - 1000,
      NOW,
    );

    expect(result.hrvRefusedBecause).toBeNull();
    // It does cost confidence, because the reading is less attested.
    const rmssd = result.samples.find((s) => s.metric === 'hrv_rmssd_ms');
    expect(rmssd?.confidence).toBeLessThan(0.95);
  });

  it('withholds HRV from too short a window rather than computing one anyway', () => {
    const result = buildStrapSamples(
      measurement({ rrIntervalsMs: [960] }),
      restingIntervals(6),
      'scan',
      NOW - 1000,
      NOW,
    );

    expect(result.hrvRefusedBecause).toBe('too_few_beats');
    expect(result.samples.some((s) => s.metric.startsWith('hrv_'))).toBe(false);
  });

  it('never emits the raw inter-beat series as a sample', () => {
    // `rr_interval_ms` is LOCAL_ONLY. Derived RMSSD/SDNN may sync; the series
    // they came from may not.
    const result = buildStrapSamples(
      measurement({ rrIntervalsMs: [960, 970] }),
      restingIntervals(60),
      'scan',
      NOW - 1000,
      NOW,
    );

    expect(result.samples.some((s) => s.metric === 'rr_interval_ms')).toBe(false);
  });

  it('keeps SDNN and RMSSD as separate values, never one converted into the other', () => {
    const result = buildStrapSamples(
      measurement({ rrIntervalsMs: [960] }),
      restingIntervals(60),
      'scan',
      NOW - 1000,
      NOW,
    );

    const rmssd = result.samples.find((s) => s.metric === 'hrv_rmssd_ms')?.value as number;
    const sdnn = result.samples.find((s) => s.metric === 'hrv_sdnn_ms')?.value as number;

    expect(rmssd).toBeGreaterThan(0);
    expect(sdnn).toBeGreaterThan(0);
    expect(rmssd).not.toBe(sdnn);
  });
});
