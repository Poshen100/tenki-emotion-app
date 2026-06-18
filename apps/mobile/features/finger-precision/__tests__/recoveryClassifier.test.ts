import { classifyRecoveryReason } from '../utils/recoveryClassifier';
import type { FingerQualityMetrics } from '../types';

describe('recoveryClassifier', () => {
  const defaultIdeal: FingerQualityMetrics = {
    fingerCoverage: 0.90,
    flashVisibility: 0.80,
    contactPressure: 0.80,
    motionStability: 0.90,
    pulseWaveform: 0.85,
    beatRegularity: 0.90,
    ambientLight: 0.10,
    totalPpgConfidence: 0.95,
  };

  it('returns null if quality is perfect', () => {
    expect(classifyRecoveryReason(defaultIdeal)).toBeNull();
  });

  it('classifies contact_lost first', () => {
    const q: FingerQualityMetrics = {
      ...defaultIdeal,
      fingerCoverage: 0.40,
    };
    expect(classifyRecoveryReason(q)).toBe('contact_lost');
  });

  it('classifies ambient_light leakage', () => {
    const q: FingerQualityMetrics = {
      ...defaultIdeal,
      ambientLight: 0.60,
    };
    expect(classifyRecoveryReason(q)).toBe('ambient_light');
  });

  it('classifies finger_moved for high motion', () => {
    const q: FingerQualityMetrics = {
      ...defaultIdeal,
      motionStability: 0.35, // lower than 0.50
    };
    expect(classifyRecoveryReason(q)).toBe('finger_moved');
  });

  it('classifies pressure_high for poor pressure confidence', () => {
    const q: FingerQualityMetrics = {
      ...defaultIdeal,
      contactPressure: 0.40,
    };
    expect(classifyRecoveryReason(q)).toBe('pressure_high');
  });
});
