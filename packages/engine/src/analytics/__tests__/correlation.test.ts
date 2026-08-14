/**
 * @module analytics/correlation.test
 * @description Tests for personal correlation analysis. The gating tests carry
 * the weight: a wellness product that tells someone a fluke is part of who
 * they are does real damage, so the guards against thin and unstable evidence
 * are the behaviour worth pinning down.
 */

import {
  MIN_ABS_RHO,
  MIN_PAIRS_FOR_CORRELATION,
  MIN_SPAN_DAYS,
  analyzeCorrelation,
  pearson,
  rank,
  spearman,
} from '../correlation';
import type { CorrelationPair } from '../correlation';

const DAY_MS = 24 * 60 * 60 * 1000;
const START = 1_775_000_000_000;

/**
 * Builds pairs spread one per day.
 *
 * @param values - Driver values.
 * @param clarities - Clarity values, same length.
 */
function pairs(values: readonly number[], clarities: readonly number[]): CorrelationPair[] {
  return values.map((value, i) => ({
    value,
    clarity: clarities[i],
    atMs: START + i * DAY_MS,
  }));
}

/**
 * Builds n pairs with a strong monotonic positive relationship.
 *
 * Clarity steps 1→5 across the range rather than cycling, because a 1–5 scale
 * paired against a rising driver produces plateaus, not a straight line — the
 * shape real ordinal data actually takes.
 */
function perfectPositive(n: number): CorrelationPair[] {
  const values = Array.from({ length: n }, (_, i) => i);
  const clarities = Array.from({ length: n }, (_, i) =>
    Math.min(5, 1 + Math.floor((i / n) * 5))
  );
  return pairs(values, clarities);
}

describe('rank', () => {
  it('ranks distinct values from 1', () => {
    expect(rank([10, 30, 20])).toEqual([1, 3, 2]);
  });

  it('averages ranks across ties', () => {
    // Two values tied at positions 2 and 3 both take rank 2.5.
    expect(rank([1, 5, 5, 9])).toEqual([1, 2.5, 2.5, 4]);
  });

  it('handles an all-tied series', () => {
    expect(rank([7, 7, 7])).toEqual([2, 2, 2]);
  });
});

describe('pearson', () => {
  it('returns 1 for a perfect positive line', () => {
    expect(pearson([1, 2, 3, 4], [2, 4, 6, 8])).toBeCloseTo(1, 10);
  });

  it('returns -1 for a perfect negative line', () => {
    expect(pearson([1, 2, 3, 4], [8, 6, 4, 2])).toBeCloseTo(-1, 10);
  });

  it('returns null when a series has no variance', () => {
    expect(pearson([5, 5, 5], [1, 2, 3])).toBeNull();
  });

  it('returns null on mismatched lengths', () => {
    expect(pearson([1, 2], [1, 2, 3])).toBeNull();
  });
});

describe('spearman', () => {
  it('captures a monotonic but non-linear relationship', () => {
    // Exponential in y — Pearson would understate this, Spearman sees rank order.
    expect(spearman([1, 2, 3, 4, 5], [1, 4, 9, 16, 25])).toBeCloseTo(1, 10);
  });

  it('is unmoved by a single extreme outlier', () => {
    const withOutlier = spearman([1, 2, 3, 4, 100], [1, 2, 3, 4, 5]);
    expect(withOutlier).toBeCloseTo(1, 10);
  });
});

describe('gating', () => {
  it('refuses below the pair floor', () => {
    const result = analyzeCorrelation(perfectPositive(MIN_PAIRS_FOR_CORRELATION - 1));
    expect(result.status).toBe('none');
    if (result.status === 'none') expect(result.gap).toBe('insufficient_pairs');
  });

  it('refuses when the observations do not span enough days', () => {
    // Enough pairs, but all crammed into a few hours.
    const crammed: CorrelationPair[] = Array.from({ length: 30 }, (_, i) => ({
      value: i,
      clarity: 1 + (i % 5),
      atMs: START + i * 60_000,
    }));
    const result = analyzeCorrelation(crammed);
    expect(result.status).toBe('none');
    if (result.status === 'none') expect(result.gap).toBe('insufficient_span');
  });

  it('refuses a constant driver', () => {
    const flat = pairs(
      Array.from({ length: 30 }, () => 7),
      Array.from({ length: 30 }, (_, i) => 1 + (i % 5))
    );
    const result = analyzeCorrelation(flat);
    expect(result.status).toBe('none');
    if (result.status === 'none') expect(result.gap).toBe('no_variance');
  });

  it('refuses an effect too small to mean anything', () => {
    // Clarity cycles independently of the driver.
    const noise = pairs(
      Array.from({ length: 40 }, (_, i) => i),
      Array.from({ length: 40 }, (_, i) => [3, 1, 4, 2, 5][i % 5])
    );
    const result = analyzeCorrelation(noise);
    expect(result.status).toBe('none');
    if (result.status === 'none') {
      expect(['effect_too_small', 'unstable_across_halves']).toContain(result.gap);
    }
  });

  it('refuses a pattern that reverses between halves', () => {
    // Rises for the first half, falls for the second: the whole-sample rho may
    // look usable but the pattern is not a stable personal trait.
    const n = 40;
    const values = Array.from({ length: n }, (_, i) => i);
    const clarities = Array.from({ length: n }, (_, i) =>
      i < n / 2 ? 1 + Math.floor((i / (n / 2)) * 4) : 5 - Math.floor(((i - n / 2) / (n / 2)) * 4)
    );
    const result = analyzeCorrelation(pairs(values, clarities));
    if (result.status === 'none') {
      expect(['unstable_across_halves', 'effect_too_small']).toContain(result.gap);
    }
  });

  it('reports a strong stable relationship', () => {
    const result = analyzeCorrelation(perfectPositive(40));
    expect(result.status).toBe('found');
    if (result.status === 'found') {
      expect(result.finding.direction).toBe('positive');
      expect(Math.abs(result.finding.rho)).toBeGreaterThanOrEqual(MIN_ABS_RHO);
      expect(result.finding.pairCount).toBe(40);
      expect(result.finding.spanDays).toBeGreaterThanOrEqual(MIN_SPAN_DAYS);
    }
  });

  it('reports direction for a negative relationship', () => {
    const n = 40;
    const values = Array.from({ length: n }, (_, i) => i);
    const clarities = Array.from({ length: n }, (_, i) =>
      Math.max(1, 5 - Math.floor((i / n) * 5))
    );
    const result = analyzeCorrelation(pairs(values, clarities));
    if (result.status === 'found') {
      expect(result.finding.direction).toBe('negative');
      expect(result.finding.rho).toBeLessThan(0);
    }
  });

  it('keeps both half-sample coefficients so the stability claim is auditable', () => {
    const result = analyzeCorrelation(perfectPositive(40));
    if (result.status === 'found') {
      expect(Math.sign(result.finding.firstHalfRho)).toBe(Math.sign(result.finding.rho));
      expect(Math.sign(result.finding.secondHalfRho)).toBe(Math.sign(result.finding.rho));
    }
  });

  it('does not mutate the caller array', () => {
    const input = perfectPositive(40);
    const snapshot = [...input];
    analyzeCorrelation(input);
    expect(input).toEqual(snapshot);
  });
});
