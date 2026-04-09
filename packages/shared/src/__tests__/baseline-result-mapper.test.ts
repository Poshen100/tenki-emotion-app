import { describe, it, expect } from 'vitest';
import { mapMockResult } from '../baseline/result-mapper';

describe('mapMockResult', () => {
  it('accepted has high confidence and accept action', () => {
    const r = mapMockResult('accepted');
    expect(r.confidence).toBe('high');
    expect(r.recommendedAction).toBe('accept');
    expect(r.baselineScore).toBe(87);
    expect(r.stability).toBe('stable');
    expect(r.observations.length).toBeGreaterThanOrEqual(3);
  });

  it('provisional has medium confidence and accept action', () => {
    const r = mapMockResult('provisional');
    expect(r.confidence).toBe('medium');
    expect(r.recommendedAction).toBe('accept');
    expect(r.baselineScore).toBe(61);
  });

  it('insufficient has retry action', () => {
    const r = mapMockResult('insufficient');
    expect(r.confidence).toBe('low');
    expect(r.recommendedAction).toBe('retry_now');
    expect(r.retryReason).toBe('signal_inconclusive');
  });

  it('failed also maps to retry', () => {
    const r = mapMockResult('failed');
    expect(r.recommendedAction).toBe('retry_now');
  });

  it('all results have resultId and createdAt', () => {
    ['accepted', 'provisional', 'insufficient', 'failed'].forEach(a => {
      const r = mapMockResult(a as any);
      expect(r.resultId).toMatch(/^baseline-/);
      expect(r.createdAt).toBeDefined();
    });
  });
});
