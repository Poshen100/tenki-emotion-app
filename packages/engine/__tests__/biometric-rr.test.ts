/**
 * @description Unit tests for v3 biometric/rr — BrPM clamping, RSA estimation,
 * EWMA smoothing, status classification, and baseline z-score analysis.
 * (Distinct from __tests__/rr.test.ts, which covers the legacy top-level rr.ts.)
 */

import {
  RR_ABS_MIN,
  RR_ABS_MAX,
  RR_EWMA_ALPHA,
  clampBrpm,
  estimateBrpmFromRRIntervals,
  smoothBrpm,
  getRrStatus,
  analyzeRr,
} from '../src/biometric/rr';
import type { MetricBaseline } from '../src/common/types';

const baseline = (mean: number, std: number, sampleCount: number): MetricBaseline => ({
  mean,
  std,
  sampleCount,
  lastUpdatedAt: 0,
});

describe('clampBrpm', () => {
  it('clamps below the physiological floor', () => {
    expect(clampBrpm(1)).toBe(RR_ABS_MIN);
  });

  it('clamps above the physiological ceiling', () => {
    expect(clampBrpm(120)).toBe(RR_ABS_MAX);
  });

  it('passes through in-range values', () => {
    expect(clampBrpm(16)).toBe(16);
  });
});

describe('estimateBrpmFromRRIntervals', () => {
  it('returns null for fewer than 6 intervals', () => {
    expect(estimateBrpmFromRRIntervals([900, 1100, 900, 1100, 900])).toBeNull();
    expect(estimateBrpmFromRRIntervals([])).toBeNull();
  });

  it('returns null when there are no zero-crossings (monotonic intervals)', () => {
    expect(estimateBrpmFromRRIntervals([800, 850, 900, 950, 1000, 1050])).toBeNull();
  });

  it('estimates BrPM from alternating RSA oscillation', () => {
    // 12 intervals alternating 900/1100ms → 12s total, 10 crossings → 5 cycles → 25 BrPM.
    const intervals = Array.from({ length: 12 }, (_, i) => (i % 2 === 0 ? 900 : 1100));
    expect(estimateBrpmFromRRIntervals(intervals)).toBe(25);
  });

  it('clamps implausibly fast estimates to the ceiling', () => {
    // 6 short intervals (1.8s total, 4 crossings → 2 cycles → 66.7 BrPM) → clamped to 40.
    const intervals = [250, 350, 250, 350, 250, 350];
    expect(estimateBrpmFromRRIntervals(intervals)).toBe(RR_ABS_MAX);
  });
});

describe('smoothBrpm', () => {
  it('returns the current value on the first reading', () => {
    expect(smoothBrpm(17.3, null)).toBe(17.3);
  });

  it('applies EWMA with the default alpha', () => {
    // 0.15 * 20 + 0.85 * 10 = 11.5
    expect(smoothBrpm(20, 10)).toBe(11.5);
    expect(RR_EWMA_ALPHA).toBe(0.15);
  });

  it('respects a custom alpha and rounds to one decimal', () => {
    // 0.5 * 15 + 0.5 * 14.11 = 14.555 → 14.6
    expect(smoothBrpm(15, 14.11, 0.5)).toBe(14.6);
  });
});

describe('getRrStatus', () => {
  it.each([
    [5, 'CRITICAL'],
    [6, 'LOW'],
    [11.9, 'LOW'],
    [12, 'NORMAL'],
    [20, 'NORMAL'],
    [20.5, 'ELEVATED'],
    [28, 'ELEVATED'],
    [29, 'CRITICAL'],
  ] as const)('classifies %s BrPM as %s', (brpm, expected) => {
    expect(getRrStatus(brpm)).toBe(expected);
  });
});

describe('analyzeRr', () => {
  it('computes z-score against a valid baseline', () => {
    const result = analyzeRr(18, baseline(14, 2, 10));
    expect(result).toEqual({
      brpm: 18,
      status: 'NORMAL',
      zScore: 2,
      withinNormal: true,
    });
  });

  it('reports zero z-score when the baseline has no samples or no variance', () => {
    expect(analyzeRr(18, baseline(14, 2, 0)).zScore).toBe(0);
    expect(analyzeRr(18, baseline(14, 0, 10)).zScore).toBe(0);
  });

  it('clamps out-of-range input before classifying', () => {
    const result = analyzeRr(100, baseline(14, 2, 10));
    expect(result.brpm).toBe(RR_ABS_MAX);
    expect(result.status).toBe('CRITICAL');
    expect(result.withinNormal).toBe(false);
  });
});
