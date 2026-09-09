/**
 * @module intelligence/evidence.test
 * @description Unit tests for the evidence contract. The point of these tests
 * is the honesty direction: adding evidence may never weaken a claim, and
 * removing evidence may never strengthen one.
 */

import {
  buildEvidence,
  capBand,
  countDistinctDays,
  insufficientEvidence,
  normalizeProvenance,
  samplesShortOfFloor,
  CAPPING_REASONS,
  type EvidenceRequirement,
} from '../evidence';

const REQ: EvidenceRequirement = {
  minSamples: 8,
  moderateSamples: 12,
  highSamples: 24,
  highWindowDays: 10,
};

// ─── normalizeProvenance ─────────────────────

describe('normalizeProvenance', () => {
  it('de-duplicates and orders canonically', () => {
    expect(normalizeProvenance(['inferred', 'measured', 'inferred'])).toEqual([
      'measured',
      'inferred',
    ]);
  });

  it('returns an empty list for no provenance', () => {
    expect(normalizeProvenance([])).toEqual([]);
  });
});

// ─── capBand ─────────────────────────────────

describe('capBand', () => {
  it('never raises a band', () => {
    expect(capBand('low', 'high')).toBe('low');
    expect(capBand('moderate', 'high')).toBe('moderate');
  });

  it('lowers a band to the ceiling', () => {
    expect(capBand('high', 'moderate')).toBe('moderate');
    expect(capBand('high', 'low')).toBe('low');
  });
});

// ─── buildEvidence ───────────────────────────

describe('buildEvidence', () => {
  it('reaches high confidence only with enough samples across enough days', () => {
    const ev = buildEvidence({
      sampleCount: 28,
      windowDays: 21,
      provenance: ['measured', 'behavioral'],
      requirement: REQ,
    });
    expect(ev.confidence).toBe('high');
    expect(ev.reasons).toEqual([]);
  });

  it('caps at moderate when the samples span too few days', () => {
    const ev = buildEvidence({
      sampleCount: 28,
      windowDays: 2,
      provenance: ['measured'],
      requirement: REQ,
    });
    expect(ev.confidence).toBe('moderate');
    expect(ev.reasons).toContain('window_too_short');
  });

  it('caps at moderate when every input is inferred', () => {
    const ev = buildEvidence({
      sampleCount: 40,
      windowDays: 40,
      provenance: ['inferred'],
      requirement: REQ,
    });
    expect(ev.confidence).toBe('moderate');
    expect(ev.reasons).toContain('inferred_only');
  });

  it('does not apply the inferred cap when something was measured', () => {
    const ev = buildEvidence({
      sampleCount: 40,
      windowDays: 40,
      provenance: ['measured', 'inferred'],
      requirement: REQ,
    });
    expect(ev.confidence).toBe('high');
    expect(ev.reasons).not.toContain('inferred_only');
  });

  it('forces low and flags the floor when below minSamples', () => {
    const ev = buildEvidence({
      sampleCount: 3,
      windowDays: 3,
      provenance: ['measured'],
      requirement: REQ,
    });
    expect(ev.confidence).toBe('low');
    expect(ev.reasons).toContain('sample_floor_not_met');
  });

  it('lands on moderate between the moderate and high sample gates', () => {
    const ev = buildEvidence({
      sampleCount: 15,
      windowDays: 15,
      provenance: ['measured'],
      requirement: REQ,
    });
    expect(ev.confidence).toBe('moderate');
    expect(ev.reasons).toContain('sample_count_below_high');
  });

  it('lets every capping reason cap an otherwise high claim', () => {
    for (const reason of CAPPING_REASONS) {
      const ev = buildEvidence({
        sampleCount: 99,
        windowDays: 99,
        provenance: ['measured'],
        requirement: REQ,
        extraReasons: [reason],
      });
      expect(ev.confidence).toBe('moderate');
      expect(ev.reasons).toContain(reason);
    }
  });

  it('never records a reason twice', () => {
    const ev = buildEvidence({
      sampleCount: 99,
      windowDays: 99,
      provenance: ['measured'],
      requirement: REQ,
      extraReasons: ['inferred_only', 'inferred_only'],
    });
    expect(ev.reasons.filter((r) => r === 'inferred_only')).toHaveLength(1);
  });

  it('floors negative and fractional counts instead of trusting them', () => {
    const ev = buildEvidence({
      sampleCount: -5,
      windowDays: 2.9,
      provenance: ['measured'],
      requirement: REQ,
    });
    expect(ev.sampleCount).toBe(0);
    expect(ev.windowDays).toBe(2);
  });

  it('is monotonic: more samples never lower the band', () => {
    const bands = [4, 8, 12, 24, 60].map(
      (n) =>
        buildEvidence({
          sampleCount: n,
          windowDays: 30,
          provenance: ['measured'],
          requirement: REQ,
        }).confidence
    );
    const rank = { low: 0, moderate: 1, high: 2 } as const;
    for (let i = 1; i < bands.length; i++) {
      expect(rank[bands[i]]).toBeGreaterThanOrEqual(rank[bands[i - 1]]);
    }
  });
});

// ─── insufficientEvidence ────────────────────

describe('insufficientEvidence', () => {
  it('reports exactly how many more samples are needed', () => {
    const result = insufficientEvidence({
      sampleCount: 2,
      windowDays: 1,
      provenance: ['measured'],
      requirement: REQ,
    });
    expect(result.state).toBe('insufficient');
    expect(result.moreSamplesNeeded).toBe(6);
    expect(result.evidence.confidence).toBe('low');
  });

  it('reports zero shortfall once the floor is met', () => {
    expect(samplesShortOfFloor(8, REQ)).toBe(0);
    expect(samplesShortOfFloor(80, REQ)).toBe(0);
  });
});

// ─── countDistinctDays ───────────────────────

describe('countDistinctDays', () => {
  it('counts two readings on the same day once', () => {
    const morning = new Date(2026, 8, 9, 9, 0).getTime();
    const evening = new Date(2026, 8, 9, 21, 0).getTime();
    expect(countDistinctDays([morning, evening])).toBe(1);
  });

  it('counts readings on different days separately', () => {
    const d1 = new Date(2026, 8, 9, 9, 0).getTime();
    const d2 = new Date(2026, 8, 10, 9, 0).getTime();
    expect(countDistinctDays([d1, d2])).toBe(2);
  });

  it('ignores non-finite timestamps rather than counting them as a day', () => {
    const d1 = new Date(2026, 8, 9, 9, 0).getTime();
    expect(countDistinctDays([d1, Number.NaN, Number.POSITIVE_INFINITY])).toBe(1);
  });

  it('returns 0 for an empty set', () => {
    expect(countDistinctDays([])).toBe(0);
  });
});
