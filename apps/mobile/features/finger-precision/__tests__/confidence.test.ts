import { calculateBlendedConfidence } from '../utils/confidence';

describe('confidence blending', () => {
  it('performs high confidence blend when finger confidence is high', () => {
    const res = calculateBlendedConfidence(0.70, 0.85);
    expect(res.blendMode).toBe('high_confidence_blend');
    // blended = 0.70 * 0.55 + 0.85 * 0.45 = 0.385 + 0.3825 = 0.7675
    expect(res.blendedConfidence).toBeCloseTo(0.7675);
    expect(res.confidenceUplift).toBeCloseTo(0.0675);
  });

  it('performs signal added blend when finger confidence is medium', () => {
    const res = calculateBlendedConfidence(0.60, 0.65);
    expect(res.blendMode).toBe('signal_added');
    // blended = 0.60 * 0.70 + 0.65 * 0.30 = 0.42 + 0.195 = 0.615
    expect(res.blendedConfidence).toBeCloseTo(0.615);
    expect(res.confidenceUplift).toBeCloseTo(0.015);
  });

  it('performs face only blend when finger confidence is low', () => {
    const res = calculateBlendedConfidence(0.75, 0.40);
    expect(res.blendMode).toBe('face_only');
    // blended = 0.75 * 0.85 + 0.40 * 0.15 = 0.6375 + 0.06 = 0.6975
    // Note: since finger is low quality, blended confidence can be slightly lower than face confidence
    expect(res.blendedConfidence).toBeCloseTo(0.6975);
    expect(res.confidenceUplift).toBe(0.0); // clamped at 0
  });
});
