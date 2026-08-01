import type { ReadinessEvidence, ReadinessReading } from '../contracts/readiness-reading';
import {
  MIN_BAND_SAMPLES_FOR_RATE,
  READING_FRESHNESS_MS,
  buildReading,
  captureQuality,
  deriveBand,
  isReadingFresh,
  resolveConfidence,
  resolveReadingGate,
  summarizeDisciplineByBand,
  tierSupportsHighConfidence,
} from '../policies/readiness-band';

function evidence(overrides: Partial<ReadinessEvidence> = {}): ReadinessEvidence {
  return {
    stillness: 0.8,
    lighting: 0.8,
    uniformity: 0.8,
    blinkCadence: 0.8,
    tier: 'A',
    ...overrides,
  };
}

describe('captureQuality', () => {
  it('weights lighting above uniformity', () => {
    const brighter = captureQuality(evidence({ lighting: 1, uniformity: 0 }));
    const eveners = captureQuality(evidence({ lighting: 0, uniformity: 1 }));
    expect(brighter).toBeGreaterThan(eveners);
  });

  it('clamps out-of-range and non-finite inputs', () => {
    expect(captureQuality(evidence({ lighting: 5, uniformity: 5 }))).toBe(1);
    expect(captureQuality(evidence({ lighting: -3, uniformity: -3 }))).toBe(0);
    expect(captureQuality(evidence({ lighting: Number.NaN, uniformity: 1 }))).toBeCloseTo(
      0.4,
    );
  });
});

describe('deriveBand', () => {
  it('returns clear for steady, well-captured evidence', () => {
    expect(deriveBand(evidence({ stillness: 0.95, blinkCadence: 0.9 }))).toBe('clear');
  });

  it('returns strain when stillness collapses', () => {
    expect(deriveBand(evidence({ stillness: 0.05, blinkCadence: 0.1 }))).toBe('strain');
  });

  it('returns neutral in the middle of the range', () => {
    expect(deriveBand(evidence({ stillness: 0.55, blinkCadence: 0.5 }))).toBe('neutral');
  });

  it('redistributes blink weight to stillness rather than assuming a value', () => {
    // Absent blink data must not by itself push the band up or down: a steady
    // capture stays clear, and a shaky one stays strain.
    expect(deriveBand(evidence({ stillness: 0.95, blinkCadence: null }))).toBe('clear');
    expect(deriveBand(evidence({ stillness: 0.05, blinkCadence: null }))).toBe('strain');
  });
});

describe('resolveConfidence', () => {
  it('gives high only for tier A with good capture and blink data', () => {
    expect(resolveConfidence(evidence({ tier: 'A', lighting: 0.9, uniformity: 0.9 }))).toBe(
      'high',
    );
  });

  it('never claims high confidence on tier B', () => {
    expect(resolveConfidence(evidence({ tier: 'B', lighting: 1, uniformity: 1 }))).toBe(
      'moderate',
    );
  });

  it('caps at moderate when blink data is missing', () => {
    expect(
      resolveConfidence(evidence({ tier: 'A', lighting: 1, uniformity: 1, blinkCadence: null })),
    ).toBe('moderate');
  });

  it('drops to low in poor capture conditions', () => {
    expect(resolveConfidence(evidence({ lighting: 0.2, uniformity: 0.2 }))).toBe('low');
  });
});

describe('buildReading', () => {
  it('carries band, confidence, timestamp and evidence', () => {
    const ev = evidence();
    const reading = buildReading(ev, 1_000);
    expect(reading).toEqual({
      band: deriveBand(ev),
      confidence: resolveConfidence(ev),
      ts: 1_000,
      evidence: ev,
    });
  });

  it('produces no numeric score field', () => {
    expect(Object.keys(buildReading(evidence(), 1_000))).toEqual([
      'band',
      'confidence',
      'ts',
      'evidence',
    ]);
  });
});

describe('isReadingFresh / resolveReadingGate', () => {
  const reading: ReadinessReading = buildReading(evidence(), 10_000);

  it('treats a reading inside the freshness window as fresh', () => {
    expect(isReadingFresh(reading, 10_000 + READING_FRESHNESS_MS - 1)).toBe(true);
  });

  it('treats a reading at exactly the window edge as stale', () => {
    expect(isReadingFresh(reading, 10_000 + READING_FRESHNESS_MS)).toBe(false);
  });

  it('treats a null reading as not fresh', () => {
    expect(isReadingFresh(null, 10_000)).toBe(false);
  });

  it('tolerates clock skew by treating future readings as fresh', () => {
    expect(isReadingFresh(reading, 5_000)).toBe(true);
  });

  it('maps gates for carry-forward, rescan and no-reading', () => {
    expect(resolveReadingGate(reading, 10_000 + 60_000)).toBe('carry_forward');
    expect(resolveReadingGate(reading, 10_000 + READING_FRESHNESS_MS + 1)).toBe(
      'suggest_rescan',
    );
    expect(resolveReadingGate(null, 10_000)).toBe('no_reading');
  });
});

describe('summarizeDisciplineByBand', () => {
  it('excludes records with no band rather than guessing one', () => {
    const stats = summarizeDisciplineByBand([
      { band: null, disciplined: true },
      { band: null, disciplined: false },
    ]);
    expect(stats).toEqual([]);
  });

  it('reports counts but a null rate below the minimum sample', () => {
    const stats = summarizeDisciplineByBand([
      { band: 'clear', disciplined: true },
      { band: 'clear', disciplined: false },
    ]);
    expect(stats).toEqual([{ band: 'clear', total: 2, disciplined: 1, rate: null }]);
  });

  it('computes a rate once the minimum sample is reached', () => {
    const records = Array.from({ length: MIN_BAND_SAMPLES_FOR_RATE }, (_unused, index) => ({
      band: 'clear' as const,
      disciplined: index > 0,
    }));
    const [stat] = summarizeDisciplineByBand(records);
    expect(stat.total).toBe(MIN_BAND_SAMPLES_FOR_RATE);
    expect(stat.rate).toBeCloseTo((MIN_BAND_SAMPLES_FOR_RATE - 1) / MIN_BAND_SAMPLES_FOR_RATE);
  });

  it('orders bands clear → neutral → strain and skips empty ones', () => {
    const stats = summarizeDisciplineByBand([
      { band: 'strain', disciplined: false },
      { band: 'clear', disciplined: true },
    ]);
    expect(stats.map((stat) => stat.band)).toEqual(['clear', 'strain']);
  });
});

describe('tierSupportsHighConfidence', () => {
  it('allows high confidence only on tier A', () => {
    expect(tierSupportsHighConfidence('A')).toBe(true);
    expect(tierSupportsHighConfidence('B')).toBe(false);
  });
});
