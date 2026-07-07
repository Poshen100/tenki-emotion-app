/**
 * @module common/__tests__/ewma.test.ts
 * @description Unit tests for the EWMA smoother (v3).
 */

import {
  createEwma,
  updateEwma,
  getEwmaValue,
  resetEwma,
  EWMA_DEFAULT_ALPHA,
} from '../ewma';

describe('createEwma', () => {
  it('starts empty with the default alpha', () => {
    const s = createEwma();
    expect(s.value).toBeNull();
    expect(s.sampleCount).toBe(0);
    expect(s.alpha).toBe(EWMA_DEFAULT_ALPHA);
  });

  it('honours a custom alpha', () => {
    expect(createEwma(0.3).alpha).toBe(0.3);
  });
});

describe('updateEwma', () => {
  it('sets the value directly on the first observation', () => {
    const s = updateEwma(createEwma(0.5), 42);
    expect(s.value).toBe(42);
    expect(s.sampleCount).toBe(1);
  });

  it('blends subsequent observations by alpha', () => {
    let s = updateEwma(createEwma(0.5), 10);
    s = updateEwma(s, 20);
    // 10*(1-0.5) + 20*0.5 = 15
    expect(s.value).toBe(15);
    expect(s.sampleCount).toBe(2);
  });

  it('converges slowly under the medical-grade default alpha', () => {
    let s = createEwma();
    for (let i = 0; i < 10; i++) s = updateEwma(s, 100);
    // With alpha 0.05, ten steps from 100 stay very close to 100.
    expect(s.value).toBeGreaterThan(99);
    expect(s.value).toBeLessThanOrEqual(100);
  });
});

describe('getEwmaValue', () => {
  it('returns the fallback when there are no observations', () => {
    expect(getEwmaValue(createEwma(), 7)).toBe(7);
    expect(getEwmaValue(createEwma())).toBe(0);
  });

  it('returns the smoothed value once populated', () => {
    const s = updateEwma(createEwma(), 55);
    expect(getEwmaValue(s, 7)).toBe(55);
  });
});

describe('resetEwma', () => {
  it('clears the value but preserves alpha', () => {
    let s = updateEwma(createEwma(0.4), 30);
    s = resetEwma(s);
    expect(s.value).toBeNull();
    expect(s.sampleCount).toBe(0);
    expect(s.alpha).toBe(0.4);
  });
});
