/**
 * @module shared/zone-config.test
 * @description Unit tests for v3 zone configuration (3 zones).
 */

import { ZONE_CONFIG, getZoneByScore, classifyZone } from '../zone-config';

describe('ZONE_CONFIG', () => {
  it('should have exactly 3 zones', () => {
    expect(ZONE_CONFIG.length).toBe(3);
  });

  it('should have clear, neutral, strain zones', () => {
    const zoneNames = ZONE_CONFIG.map(z => z.zone);
    expect(zoneNames).toContain('clear');
    expect(zoneNames).toContain('neutral');
    expect(zoneNames).toContain('strain');
  });

  it('zones should cover full 0-100 range without gaps', () => {
    const sorted = [...ZONE_CONFIG].sort((a, b) => a.min - b.min);
    expect(sorted[0].min).toBe(0);
    expect(sorted[sorted.length - 1].max).toBe(100);

    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i].min).toBe(sorted[i - 1].max + 1);
    }
  });

  it('each zone should have color and text color', () => {
    for (const zone of ZONE_CONFIG) {
      expect(zone.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(zone.textColor).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it('each zone guidance should be non-empty and compliant', () => {
    for (const zone of ZONE_CONFIG) {
      expect(zone.guidance.length).toBeGreaterThan(0);
    }
  });
});

describe('getZoneByScore', () => {
  it('should return clear for score 70', () => {
    expect(getZoneByScore(70).zone).toBe('clear');
  });

  it('should return clear for score 100', () => {
    expect(getZoneByScore(100).zone).toBe('clear');
  });

  it('should return neutral for score 40', () => {
    expect(getZoneByScore(40).zone).toBe('neutral');
  });

  it('should return neutral for score 69', () => {
    expect(getZoneByScore(69).zone).toBe('neutral');
  });

  it('should return strain for score 39', () => {
    expect(getZoneByScore(39).zone).toBe('strain');
  });

  it('should return strain for score 0', () => {
    expect(getZoneByScore(0).zone).toBe('strain');
  });

  it('should fallback to strain for negative scores', () => {
    expect(getZoneByScore(-5).zone).toBe('strain');
  });
});

describe('classifyZone', () => {
  it('should classify 75 as clear', () => {
    expect(classifyZone(75)).toBe('clear');
  });

  it('should classify 50 as neutral', () => {
    expect(classifyZone(50)).toBe('neutral');
  });

  it('should classify 20 as strain', () => {
    expect(classifyZone(20)).toBe('strain');
  });

  it('boundary: 70 should be clear', () => {
    expect(classifyZone(70)).toBe('clear');
  });

  it('boundary: 69 should be neutral', () => {
    expect(classifyZone(69)).toBe('neutral');
  });

  it('boundary: 40 should be neutral', () => {
    expect(classifyZone(40)).toBe('neutral');
  });

  it('boundary: 39 should be strain', () => {
    expect(classifyZone(39)).toBe('strain');
  });
});
