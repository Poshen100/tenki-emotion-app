import {
  deriveDotStatuses,
  calculatePpgConfidence,
  isReadinessPassed,
} from '../utils/qualityGates';
import type { FingerQualityMetrics } from '../types';

describe('qualityGates — dot statuses', () => {
  it('correctly maps ideal values to all green', () => {
    const q: FingerQualityMetrics = {
      fingerCoverage: 0.90,
      flashVisibility: 0.80,
      contactPressure: 0.80,
      motionStability: 0.15, // 0.15 is stable
      pulseWaveform: 0.85,
      beatRegularity: 0.90,
      ambientLight: 0.10,
      totalPpgConfidence: 0.95,
    };
    const dots = deriveDotStatuses(q);
    expect(dots.cover).toBe('green');
    expect(dots.still).toBe('green');
    expect(dots.pressure).toBe('green');
    expect(isReadinessPassed(dots.cover, dots.still, dots.pressure)).toBe(true);
  });

  it('correctly maps low values to red', () => {
    const q: FingerQualityMetrics = {
      fingerCoverage: 0.40,
      flashVisibility: 0.30,
      contactPressure: 0.30,
      motionStability: 0.60,
      pulseWaveform: 0.30,
      beatRegularity: 0.40,
      ambientLight: 0.50,
      totalPpgConfidence: 0.30,
    };
    const dots = deriveDotStatuses(q);
    expect(dots.cover).toBe('red');
    expect(dots.still).toBe('red');
    expect(dots.pressure).toBe('red');
    expect(isReadinessPassed(dots.cover, dots.still, dots.pressure)).toBe(false);
  });
});

describe('qualityGates — readiness check rules', () => {
  it('passes if all green', () => {
    expect(isReadinessPassed('green', 'green', 'green')).toBe(true);
  });

  it('passes if two green, one yellow', () => {
    expect(isReadinessPassed('green', 'green', 'yellow')).toBe(true);
    expect(isReadinessPassed('yellow', 'green', 'green')).toBe(true);
  });

  it('fails if one green, two yellow', () => {
    expect(isReadinessPassed('green', 'yellow', 'yellow')).toBe(false);
  });

  it('fails if any red', () => {
    expect(isReadinessPassed('green', 'green', 'red')).toBe(false);
  });
});
