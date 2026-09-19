/**
 * @module domain/readiness-history.test
 * @description Tests for the append-only readiness history. The defended
 * properties: nothing is ever silently overwritten, unreadable rows are
 * counted rather than quietly dropped, and the distribution reports how far a
 * signal really travels.
 */

import {
  READINESS_HISTORY_MAX,
  READINESS_HISTORY_SCHEMA,
  type ReadinessHistorySample,
} from '../contracts/readiness-history';
import type { ReadinessReading } from '../contracts/readiness-reading';
import {
  appendHistorySample,
  histogram,
  loadHistory,
  summarizeHistory,
  summarizeSignal,
  toHistorySample,
} from '../policies/readiness-history';

const DAY = 86_400_000;
const T0 = new Date(2026, 8, 9, 10, 0, 0).getTime();

function sample(overrides: Partial<ReadinessHistorySample> = {}): ReadinessHistorySample {
  return {
    schema: READINESS_HISTORY_SCHEMA,
    ts: T0,
    stillness: 0.6,
    lighting: 0.7,
    uniformity: 0.8,
    blinkCadence: 0.5,
    tier: 'A',
    band: 'neutral',
    confidence: 'moderate',
    ...overrides,
  };
}

// ─── toHistorySample ─────────────────────────

describe('toHistorySample', () => {
  it('flattens a reading without inventing a numeric score', () => {
    const reading: ReadinessReading = {
      band: 'clear',
      confidence: 'high',
      ts: T0,
      evidence: {
        stillness: 0.82,
        lighting: 0.71,
        uniformity: 0.66,
        blinkCadence: 0.44,
        tier: 'A',
      },
    };
    const row = toHistorySample(reading);
    expect(row).toEqual({
      schema: READINESS_HISTORY_SCHEMA,
      ts: T0,
      stillness: 0.82,
      lighting: 0.71,
      uniformity: 0.66,
      blinkCadence: 0.44,
      tier: 'A',
      band: 'clear',
      confidence: 'high',
    });
    expect(Object.keys(row)).not.toContain('score');
    expect(Object.keys(row)).not.toContain('value');
  });

  it('carries a null blink cadence through instead of substituting a number', () => {
    const reading: ReadinessReading = {
      band: 'neutral',
      confidence: 'low',
      ts: T0,
      evidence: {
        stillness: 0.5,
        lighting: 0.5,
        uniformity: 0.5,
        blinkCadence: null,
        tier: 'B',
      },
    };
    expect(toHistorySample(reading).blinkCadence).toBeNull();
  });
});

// ─── appendHistorySample ─────────────────────

describe('appendHistorySample', () => {
  it('accumulates instead of overwriting — the whole point of the store', () => {
    let history: ReadinessHistorySample[] = [];
    for (let i = 0; i < 5; i++) {
      history = appendHistorySample(history, sample({ ts: T0 + i * DAY }));
    }
    expect(history).toHaveLength(5);
  });

  it('does not mutate the history it was given', () => {
    const original = [sample({ ts: T0 })];
    appendHistorySample(original, sample({ ts: T0 + DAY }));
    expect(original).toHaveLength(1);
  });

  it('keeps rows oldest first even when appended out of order', () => {
    let history = appendHistorySample([], sample({ ts: T0 + DAY }));
    history = appendHistorySample(history, sample({ ts: T0 }));
    expect(history.map((r) => r.ts)).toEqual([T0, T0 + DAY]);
  });

  it('replaces rather than duplicates a repeated timestamp', () => {
    let history = appendHistorySample([], sample({ ts: T0, stillness: 0.2 }));
    history = appendHistorySample(history, sample({ ts: T0, stillness: 0.9 }));
    expect(history).toHaveLength(1);
    expect(history[0].stillness).toBe(0.9);
  });

  it('caps the history by dropping the oldest rows', () => {
    let history: ReadinessHistorySample[] = [];
    for (let i = 0; i < READINESS_HISTORY_MAX + 10; i++) {
      history = appendHistorySample(history, sample({ ts: T0 + i * 60_000 }));
    }
    expect(history).toHaveLength(READINESS_HISTORY_MAX);
    expect(history[0].ts).toBe(T0 + 10 * 60_000);
    expect(history[history.length - 1].ts).toBe(T0 + (READINESS_HISTORY_MAX + 9) * 60_000);
  });
});

// ─── loadHistory ─────────────────────────────

describe('loadHistory', () => {
  it('returns an empty history for anything that is not an array', () => {
    for (const raw of [null, undefined, 42, 'nope', {}]) {
      expect(loadHistory(raw)).toEqual({ samples: [], dropped: 0 });
    }
  });

  it('reports how many rows it could not read', () => {
    const raw = [sample(), { ts: T0 }, null, sample({ ts: T0 + DAY })];
    const loaded = loadHistory(raw);
    expect(loaded.samples).toHaveLength(2);
    expect(loaded.dropped).toBe(2);
  });

  it('drops a row written under a different schema rather than guessing', () => {
    const loaded = loadHistory([{ ...sample(), schema: READINESS_HISTORY_SCHEMA + 1 }]);
    expect(loaded.samples).toHaveLength(0);
    expect(loaded.dropped).toBe(1);
  });

  it('drops out-of-range signals instead of clamping them into a plausible shape', () => {
    const loaded = loadHistory([
      sample({ stillness: 1.4 }),
      sample({ ts: T0 + DAY, lighting: -0.1 }),
      sample({ ts: T0 + 2 * DAY, uniformity: Number.NaN }),
    ]);
    expect(loaded.samples).toHaveLength(0);
    expect(loaded.dropped).toBe(3);
  });

  it('drops rows whose tier, band or confidence is not a known value', () => {
    const loaded = loadHistory([
      sample({ tier: 'Z' as never }),
      sample({ ts: T0 + DAY, band: 'peak' as never }),
      sample({ ts: T0 + 2 * DAY, confidence: 'certain' as never }),
    ]);
    expect(loaded.samples).toHaveLength(0);
    expect(loaded.dropped).toBe(3);
  });

  it('accepts a null blink cadence', () => {
    expect(loadHistory([sample({ blinkCadence: null })]).samples).toHaveLength(1);
  });

  it('sorts what it loaded oldest first', () => {
    const loaded = loadHistory([sample({ ts: T0 + DAY }), sample({ ts: T0 })]);
    expect(loaded.samples.map((s) => s.ts)).toEqual([T0, T0 + DAY]);
  });
});

// ─── summarizeSignal ─────────────────────────

describe('summarizeSignal', () => {
  it('returns null when nothing was observed', () => {
    expect(summarizeSignal([])).toBeNull();
    expect(summarizeSignal([Number.NaN])).toBeNull();
  });

  it('reports span — how far the signal actually travels', () => {
    const wide = summarizeSignal([0.1, 0.5, 0.9]);
    const narrow = summarizeSignal([0.50, 0.51, 0.52]);
    expect(wide?.span).toBeCloseTo(0.8, 10);
    expect(narrow?.span).toBeCloseTo(0.02, 10);
  });

  it('reports zero span for a signal that never moves', () => {
    const flat = summarizeSignal([0.6, 0.6, 0.6]);
    expect(flat?.span).toBe(0);
    expect(flat?.std).toBe(0);
  });

  it('computes quartiles and mean', () => {
    const d = summarizeSignal([0, 0.25, 0.5, 0.75, 1]);
    expect(d).toMatchObject({ count: 5, min: 0, p25: 0.25, median: 0.5, p75: 0.75, max: 1 });
    expect(d?.mean).toBeCloseTo(0.5, 10);
  });

  it('handles a single observation without dividing by zero', () => {
    expect(summarizeSignal([0.42])).toMatchObject({
      count: 1,
      min: 0.42,
      median: 0.42,
      max: 0.42,
      std: 0,
      span: 0,
    });
  });
});

// ─── summarizeHistory ────────────────────────

describe('summarizeHistory', () => {
  it('describes an empty history without inventing anything', () => {
    const summary = summarizeHistory([]);
    expect(summary.sampleCount).toBe(0);
    expect(summary.distinctDays).toBe(0);
    expect(summary.firstTs).toBeNull();
    expect(summary.lastTs).toBeNull();
    expect(summary.signals.stillness).toBeNull();
  });

  it('counts distinct days, not samples', () => {
    const summary = summarizeHistory([
      sample({ ts: new Date(2026, 8, 9, 9, 0).getTime() }),
      sample({ ts: new Date(2026, 8, 9, 21, 0).getTime() }),
      sample({ ts: new Date(2026, 8, 10, 9, 0).getTime() }),
    ]);
    expect(summary.sampleCount).toBe(3);
    expect(summary.distinctDays).toBe(2);
  });

  it('summarizes blink cadence only from samples that carried one', () => {
    const summary = summarizeHistory([
      sample({ ts: T0, blinkCadence: null }),
      sample({ ts: T0 + DAY, blinkCadence: 0.4 }),
      sample({ ts: T0 + 2 * DAY, blinkCadence: 0.6 }),
    ]);
    expect(summary.signals.blinkCadence?.count).toBe(2);
    expect(summary.signals.stillness?.count).toBe(3);
  });

  it('counts samples per capture tier', () => {
    const summary = summarizeHistory([
      sample({ ts: T0, tier: 'A' }),
      sample({ ts: T0 + DAY, tier: 'B' }),
      sample({ ts: T0 + 2 * DAY, tier: 'B' }),
    ]);
    expect(summary.tierCounts).toEqual({ A: 1, B: 2 });
  });
});

// ─── histogram ───────────────────────────────

describe('histogram', () => {
  it('buckets across 0..1', () => {
    expect(histogram([0.05, 0.15, 0.15, 0.95], 10)).toEqual([1, 2, 0, 0, 0, 0, 0, 0, 0, 1]);
  });

  it('puts 1.0 in the last bucket, not past the end', () => {
    const buckets = histogram([1], 4);
    expect(buckets).toHaveLength(4);
    expect(buckets[3]).toBe(1);
  });

  it('clamps out-of-range values into the end buckets', () => {
    expect(histogram([-5, 5], 2)).toEqual([1, 1]);
  });

  it('ignores non-finite values', () => {
    expect(histogram([Number.NaN, 0.5], 2)).toEqual([0, 1]);
  });
});
