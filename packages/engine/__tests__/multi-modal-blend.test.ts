import { blendFingerWithFaceBaseline } from '../src/baseline/multi-modal-blend';
import { createEmptyBaselineProfile } from '../src/baseline/baseline';
import type { BiometricReading, SignalQuality } from '../src/common/types';

describe('Baseline Multi-Modal Blending Logic', () => {
  const emptyProfile = createEmptyBaselineProfile();
  const fingerReading: BiometricReading = {
    hrBpm: 70,
    hrvRmssdMs: 50,
    rrBrpm: 14,
    timestamp: new Date('2026-06-18T08:00:00').getTime(), // morning bucket (8:00 AM local time)
  };

  it('performs high confidence blend when finger quality is excellent', () => {
    const fingerQuality: SignalQuality = {
      score: 95,
      grade: 'A',
      coverage: 0.95,
      stability: 0.95,
      acceptable: true,
    };

    const res = blendFingerWithFaceBaseline({
      faceBaseline: emptyProfile,
      fingerReading,
      fingerQuality,
    });

    expect(res.blendMode).toBe('high_confidence_blend');
    expect(res.confidenceUplift).toBeGreaterThan(0);
    
    // Check that baseline profile time-bucket resolves to 'morning' and updates
    expect(res.blendedBaseline.totalScanCount).toBe(1);
    expect(res.blendedBaseline.hr.morning.sampleCount).toBe(1);
    expect(res.blendedBaseline.hr.morning.mean).toBe(70);
    expect(res.blendedBaseline.hrv.morning.mean).toBe(50);
  });

  it('performs face-only fallback when finger quality is poor', () => {
    const fingerQuality: SignalQuality = {
      score: 40,
      grade: 'F',
      coverage: 0.50,
      stability: 0.30,
      acceptable: false,
    };

    const res = blendFingerWithFaceBaseline({
      faceBaseline: emptyProfile,
      fingerReading,
      fingerQuality,
    });

    expect(res.blendMode).toBe('face_only');
    expect(res.blendedBaseline.totalScanCount).toBe(1);
  });
});
