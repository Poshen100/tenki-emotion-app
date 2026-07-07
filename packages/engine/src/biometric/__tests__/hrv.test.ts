/**
 * @module biometric/__tests__/hrv.test.ts
 * @description Unit tests for the v3 HRV processing module.
 */

import {
  calculateHrvBaselineRange,
  getHrvStatus,
  harmonizeHrv,
  computeHrvZScore,
} from '../hrv';
import type { MetricBaseline } from '../../common/types';

describe('calculateHrvBaselineRange', () => {
  it('returns zeros for an empty sample set', () => {
    expect(calculateHrvBaselineRange([])).toEqual({ low: 0, high: 0, mean: 0 });
  });

  it('returns a zero-width range for a single sample', () => {
    expect(calculateHrvBaselineRange([50])).toEqual({ low: 50, high: 50, mean: 50 });
  });

  it('computes mean ± 1 SD for multiple samples', () => {
    // samples [40,60] → mean 50, variance ((−10)²+10²)/2 = 100, std 10
    expect(calculateHrvBaselineRange([40, 60])).toEqual({ low: 40, high: 60, mean: 50 });
  });
});

describe('getHrvStatus', () => {
  const range = { low: 40, high: 60, mean: 50 };

  it('is BALANCED when no baseline exists yet', () => {
    expect(getHrvStatus(30, { low: 0, high: 0, mean: 0 })).toBe('BALANCED');
  });

  it.each<[number, string]>([
    [70, 'ELEVATED'],   // > high * 1.1 (66)
    [50, 'BALANCED'],   // >= low
    [37, 'UNBALANCED'], // >= low*0.85 (34)
    [30, 'LOW'],        // >= low*0.70 (28)
    [20, 'POOR'],       // below all
  ])('classifies rmssd %i as %s', (rmssd, expected) => {
    expect(getHrvStatus(rmssd, range)).toBe(expected);
  });
});

describe('harmonizeHrv', () => {
  it('approximates RMSSD from HealthKit SDNN (× 0.75)', () => {
    expect(harmonizeHrv('healthkit', 0, 80)).toBe(60);
  });

  it('uses the raw RMSSD when SDNN is absent or source is not healthkit', () => {
    expect(harmonizeHrv('healthkit', 45, null)).toBe(45);
    expect(harmonizeHrv('ble_chest', 45, 80)).toBe(45);
  });
});

describe('computeHrvZScore', () => {
  const baseline: MetricBaseline = { mean: 50, std: 10, sampleCount: 20, lastUpdatedAt: Date.now() };

  it('returns 0 when the baseline is insufficient', () => {
    expect(computeHrvZScore(70, { ...baseline, sampleCount: 0 })).toBe(0);
    expect(computeHrvZScore(70, { ...baseline, std: 0 })).toBe(0);
  });

  it('computes the standardized deviation from baseline', () => {
    expect(computeHrvZScore(70, baseline)).toBe(2); // (70-50)/10
    expect(computeHrvZScore(30, baseline)).toBe(-2);
  });
});
