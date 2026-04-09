/**
 * @module common/legacy-tei-adapter.test
 * @description Unit tests for the legacy TEI compatibility adapter.
 */

import {
  teiToEdgeScoreApprox,
  legacyZoneToEdgeZone,
  edgeZoneToLegacyZone,
} from '../legacy-tei-adapter';

describe('teiToEdgeScoreApprox', () => {
  it('should map PR 1 to approximately 1', () => {
    expect(teiToEdgeScoreApprox(1)).toBe(1);
  });

  it('should map PR 50 to approximately 51', () => {
    const result = teiToEdgeScoreApprox(50);
    expect(result).toBeGreaterThanOrEqual(45);
    expect(result).toBeLessThanOrEqual(55);
  });

  it('should map PR 99 to 100', () => {
    expect(teiToEdgeScoreApprox(99)).toBe(100);
  });

  it('should clamp values below 1', () => {
    const result = teiToEdgeScoreApprox(0);
    expect(result).toBeGreaterThanOrEqual(1);
  });

  it('should clamp values above 99', () => {
    const result = teiToEdgeScoreApprox(150);
    expect(result).toBe(100);
  });

  it('should be monotonically increasing', () => {
    for (let i = 1; i < 99; i++) {
      expect(teiToEdgeScoreApprox(i + 1)).toBeGreaterThanOrEqual(teiToEdgeScoreApprox(i));
    }
  });
});

describe('legacyZoneToEdgeZone', () => {
  it('should map PEAK to clear', () => {
    expect(legacyZoneToEdgeZone('PEAK')).toBe('clear');
  });

  it('should map OPTIMAL to clear', () => {
    expect(legacyZoneToEdgeZone('OPTIMAL')).toBe('clear');
  });

  it('should map NEUTRAL to neutral', () => {
    expect(legacyZoneToEdgeZone('NEUTRAL')).toBe('neutral');
  });

  it('should map DEGRADED to strain', () => {
    expect(legacyZoneToEdgeZone('DEGRADED')).toBe('strain');
  });
});

describe('edgeZoneToLegacyZone', () => {
  it('should map clear / high score to PEAK', () => {
    expect(edgeZoneToLegacyZone('clear', 85)).toBe('PEAK');
  });

  it('should map clear / lower score to OPTIMAL', () => {
    expect(edgeZoneToLegacyZone('clear', 72)).toBe('OPTIMAL');
  });

  it('should map neutral to NEUTRAL', () => {
    expect(edgeZoneToLegacyZone('neutral', 50)).toBe('NEUTRAL');
  });

  it('should map strain to DEGRADED', () => {
    expect(edgeZoneToLegacyZone('strain', 20)).toBe('DEGRADED');
  });
});
