/**
 * @module scoring/edge-score.test
 * @description Unit tests for the Decision Edge Score engine.
 */

import { calculateEdgeScore, classifyEdgeZone, getTimeBucket, type EdgeScoreInput } from '../edge-score';
import type { BaselineProfile, MetricBaseline } from '../../common/types';

// ─── Test Helpers ───────────────────────────

function createMetricBaseline(mean: number, std: number, count: number = 10): MetricBaseline {
  return { mean, std, sampleCount: count, lastUpdatedAt: Date.now() - 3600000 };
}

function createMatureBaseline(): BaselineProfile {
  return {
    hr: {
      morning: createMetricBaseline(68, 5),
      midday: createMetricBaseline(72, 6),
      evening: createMetricBaseline(65, 4),
    },
    hrv: {
      morning: createMetricBaseline(45, 10),
      midday: createMetricBaseline(40, 8),
      evening: createMetricBaseline(50, 12),
    },
    rr: {
      morning: createMetricBaseline(16, 2),
      midday: createMetricBaseline(17, 2),
      evening: createMetricBaseline(15, 2),
    },
    stressProxy: createMetricBaseline(50, 10),
    maturity: 'mature',
    totalScanCount: 30,
    version: '3.0.0',
  };
}

function createDefaultInput(overrides: Partial<EdgeScoreInput> = {}): EdgeScoreInput {
  const now = new Date();
  now.setHours(10, 0, 0, 0); // Morning

  return {
    reading: {
      hrBpm: 68,
      hrvRmssdMs: 48,
      rrBrpm: 16,
      timestamp: now.getTime(),
    },
    baseline: createMatureBaseline(),
    signalQuality: {
      score: 85,
      grade: 'A' as const,
      coverage: 0.95,
      stability: 0.90,
      acceptable: true,
    },
    sleepRecovery: {
      durationHours: 7.5,
      qualityScore: 75,
      source: 'healthkit' as const,
      stalenessHours: 4,
    },
    recentScores: [72, 68, 75, 70, 65],
    ...overrides,
  };
}

// ─── classifyEdgeZone ───────────────────────

describe('classifyEdgeZone', () => {
  it('should return clear for score >= 70', () => {
    expect(classifyEdgeZone(70)).toBe('clear');
    expect(classifyEdgeZone(85)).toBe('clear');
    expect(classifyEdgeZone(100)).toBe('clear');
  });

  it('should return neutral for score 40-69', () => {
    expect(classifyEdgeZone(40)).toBe('neutral');
    expect(classifyEdgeZone(55)).toBe('neutral');
    expect(classifyEdgeZone(69)).toBe('neutral');
  });

  it('should return strain for score < 40', () => {
    expect(classifyEdgeZone(0)).toBe('strain');
    expect(classifyEdgeZone(20)).toBe('strain');
    expect(classifyEdgeZone(39)).toBe('strain');
  });
});

// ─── getTimeBucket ──────────────────────────

describe('getTimeBucket', () => {
  it('should return morning for 8am', () => {
    const d = new Date(); d.setHours(8, 0, 0, 0);
    expect(getTimeBucket(d.getTime())).toBe('morning');
  });

  it('should return midday for 2pm', () => {
    const d = new Date(); d.setHours(14, 0, 0, 0);
    expect(getTimeBucket(d.getTime())).toBe('midday');
  });

  it('should return evening for 8pm', () => {
    const d = new Date(); d.setHours(20, 0, 0, 0);
    expect(getTimeBucket(d.getTime())).toBe('evening');
  });

  it('should return evening for midnight', () => {
    const d = new Date(); d.setHours(0, 0, 0, 0);
    expect(getTimeBucket(d.getTime())).toBe('evening');
  });
});

// ─── calculateEdgeScore ─────────────────────

describe('calculateEdgeScore', () => {
  it('should return a score between 0 and 100', () => {
    const result = calculateEdgeScore(createDefaultInput());
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it('should return a valid zone', () => {
    const result = calculateEdgeScore(createDefaultInput());
    expect(['clear', 'neutral', 'strain']).toContain(result.zone);
  });

  it('should return exactly 8 drivers', () => {
    const result = calculateEdgeScore(createDefaultInput());
    expect(result.drivers.length).toBe(8);
  });

  it('driver keys should match all 8 factors', () => {
    const result = calculateEdgeScore(createDefaultInput());
    const keys = result.drivers.map(d => d.key);
    expect(keys).toContain('hrv_vs_baseline');
    expect(keys).toContain('hr_stability');
    expect(keys).toContain('respiration_stability');
    expect(keys).toContain('stress_proxy_vs_baseline');
    expect(keys).toContain('sleep_recovery');
    expect(keys).toContain('recent_trend');
    expect(keys).toContain('baseline_freshness');
    expect(keys).toContain('signal_quality');
  });

  it('should include confidence breakdown', () => {
    const result = calculateEdgeScore(createDefaultInput());
    expect(result.confidence.overall).toBeGreaterThanOrEqual(0);
    expect(result.confidence.overall).toBeLessThanOrEqual(1);
    expect(['high', 'moderate', 'low']).toContain(result.confidence.band);
  });

  it('should include safe copy', () => {
    const result = calculateEdgeScore(createDefaultInput());
    expect(result.copy.headline).toBeTruthy();
    expect(result.copy.body).toBeTruthy();
  });

  it('should include metadata', () => {
    const result = calculateEdgeScore(createDefaultInput());
    expect(result.metadata.baselineVersion).toBe('3.0.0');
    expect(result.metadata.scanQuality).toBe(85);
    expect(result.metadata.computedAt).toBeGreaterThan(0);
  });

  it('optimal inputs should produce a clear zone score', () => {
    const input = createDefaultInput({
      reading: {
        hrBpm: 68,       // At baseline
        hrvRmssdMs: 55,   // Above morning baseline (45 ± 10)
        rrBrpm: 16,       // At baseline
        timestamp: new Date(2026, 3, 7, 10, 0).getTime(),
      },
    });
    const result = calculateEdgeScore(input);
    expect(result.zone).toBe('clear');
  });

  it('stressed inputs should produce lower scores', () => {
    const input = createDefaultInput({
      reading: {
        hrBpm: 95,        // Much higher than baseline
        hrvRmssdMs: 20,   // Much lower than baseline
        rrBrpm: 25,       // Elevated
        timestamp: new Date(2026, 3, 7, 10, 0).getTime(),
      },
      sleepRecovery: {
        durationHours: 4,
        qualityScore: 30,
        source: 'healthkit' as const,
        stalenessHours: 2,
      },
    });
    const result = calculateEdgeScore(input);
    expect(result.score).toBeLessThan(50);
  });

  it('missing sleep data should not crash', () => {
    const input = createDefaultInput({
      sleepRecovery: {
        durationHours: null,
        qualityScore: null,
        source: 'none' as const,
        stalenessHours: 0,
      },
    });
    const result = calculateEdgeScore(input);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it('empty recent scores should not crash', () => {
    const input = createDefaultInput({ recentScores: [] });
    const result = calculateEdgeScore(input);
    expect(result.score).toBeGreaterThanOrEqual(0);
  });

  it('new baseline (zero samples) should produce neutral-ish scores', () => {
    const emptyBaseline: BaselineProfile = {
      hr: {
        morning: createMetricBaseline(0, 0, 0),
        midday: createMetricBaseline(0, 0, 0),
        evening: createMetricBaseline(0, 0, 0),
      },
      hrv: {
        morning: createMetricBaseline(0, 0, 0),
        midday: createMetricBaseline(0, 0, 0),
        evening: createMetricBaseline(0, 0, 0),
      },
      rr: {
        morning: createMetricBaseline(0, 0, 0),
        midday: createMetricBaseline(0, 0, 0),
        evening: createMetricBaseline(0, 0, 0),
      },
      stressProxy: createMetricBaseline(0, 0, 0),
      maturity: 'new',
      totalScanCount: 0,
      version: '3.0.0',
    };
    const input = createDefaultInput({ baseline: emptyBaseline });
    const result = calculateEdgeScore(input);
    expect(result.score).toBeGreaterThanOrEqual(20);
    expect(result.score).toBeLessThanOrEqual(80);
    expect(result.confidence.band).toBe('moderate');
  });
});
