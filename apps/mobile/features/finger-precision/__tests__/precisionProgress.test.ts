import { calculatePrecisionProgress } from '../utils/precisionProgress';

describe('precisionProgress', () => {
  it('identifies quick tier', () => {
    const progress = calculatePrecisionProgress(15, 1000);
    expect(progress.currentTier).toBe('quick');
    expect(progress.canStopEarly).toBe(false);
    expect(progress.overallProgress).toBeCloseTo(0.1);
    expect(progress.tierProgress).toBeCloseTo(0.5);
  });

  it('identifies stable tier and permits early stop', () => {
    const progress = calculatePrecisionProgress(75, 15000);
    expect(progress.currentTier).toBe('strong');
    expect(progress.canStopEarly).toBe(true);
    expect(progress.overallProgress).toBeCloseTo(0.5);
    expect(progress.tierProgress).toBeCloseTo(0.5);
  });

  it('clamps best tier overall progress at 1', () => {
    const progress = calculatePrecisionProgress(160, 60000);
    expect(progress.currentTier).toBe('best');
    expect(progress.overallProgress).toBe(1.0);
    expect(progress.tierProgress).toBe(1.0);
  });
});
