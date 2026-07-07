/**
 * @module pipeline/__tests__/progressive-pipeline.test.ts
 * @description Unit tests for the progressive (partial) scan pipeline —
 * level resolution, factor masking, confidence deflation, wearable HRV
 * override, fusion source selection, and level-advance detection.
 */

import {
  runProgressiveScan,
  resolveLevel,
  didLevelAdvance,
  LEVEL_RR_REQUIREMENTS,
  LEVEL_ACCURACY_CEILING,
  LEVEL_CONFIDENCE_MULTIPLIER,
  LEVEL_ACTIVE_FACTORS,
  type ProgressiveScanInput,
  type ProgressiveLevel,
} from '../progressive-pipeline';
import type { SourceQuality } from '../../fusion';
import type { BiometricReading, SignalQuality, BaselineProfile, SleepRecoveryInput } from '../../common/types';

function createMockBaseline(): BaselineProfile {
  const defaultMetric = { mean: 60, std: 5, sampleCount: 10, lastUpdatedAt: Date.now() - 3600000 };
  return {
    hr: { morning: { ...defaultMetric }, midday: { ...defaultMetric }, evening: { ...defaultMetric } },
    hrv: { morning: { ...defaultMetric, mean: 40 }, midday: { ...defaultMetric, mean: 40 }, evening: { ...defaultMetric, mean: 40 } },
    rr: { morning: { ...defaultMetric, mean: 14, std: 2 }, midday: { ...defaultMetric, mean: 14, std: 2 }, evening: { ...defaultMetric, mean: 14, std: 2 } },
    stressProxy: { ...defaultMetric, mean: 0, std: 1 },
    maturity: 'mature',
    totalScanCount: 30,
    version: '3.0',
  };
}

const reading: BiometricReading = { hrBpm: 62, hrvRmssdMs: 45, rrBrpm: 15, timestamp: Date.now() };

const goodSignal: SignalQuality = { score: 95, grade: 'A', coverage: 0.98, stability: 0.95, acceptable: true };

const sleep: SleepRecoveryInput = { durationHours: 8, qualityScore: 85, source: 'healthkit', stalenessHours: 2 };

function inputAt(rrIntervalCount: number, overrides: Partial<ProgressiveScanInput> = {}): ProgressiveScanInput {
  return {
    reading,
    signalQuality: goodSignal,
    baseline: createMockBaseline(),
    sleepRecovery: sleep,
    recentScores: [85, 80, 88],
    rrIntervalCount,
    ...overrides,
  };
}

describe('resolveLevel', () => {
  it.each<[number, ProgressiveLevel]>([
    [0, 1],
    [14, 1],
    [15, 2],
    [29, 2],
    [30, 3],
    [59, 3],
    [60, 4],
    [120, 4],
  ])('rrCount %i → level %i', (rrCount, expected) => {
    expect(resolveLevel(rrCount)).toBe(expected);
  });

  it('level RR requirements are monotonically increasing', () => {
    expect(LEVEL_RR_REQUIREMENTS[1]).toBeLessThan(LEVEL_RR_REQUIREMENTS[2]);
    expect(LEVEL_RR_REQUIREMENTS[2]).toBeLessThan(LEVEL_RR_REQUIREMENTS[3]);
    expect(LEVEL_RR_REQUIREMENTS[3]).toBeLessThan(LEVEL_RR_REQUIREMENTS[4]);
  });
});

describe('didLevelAdvance', () => {
  it('is true when crossing a level boundary', () => {
    expect(didLevelAdvance(14, 15)).toBe(true); // 1 → 2
    expect(didLevelAdvance(29, 30)).toBe(true); // 2 → 3
    expect(didLevelAdvance(59, 60)).toBe(true); // 3 → 4
  });

  it('is false when staying within the same level', () => {
    expect(didLevelAdvance(0, 14)).toBe(false);
    expect(didLevelAdvance(60, 120)).toBe(false);
  });
});

describe('runProgressiveScan', () => {
  it('reports the resolved level and its accuracy ceiling', () => {
    const r = runProgressiveScan(inputAt(15));
    expect(r.level).toBe(2);
    expect(r.accuracyCeiling).toBe(LEVEL_ACCURACY_CEILING[2]);
  });

  it('exposes active/skipped factors partitioning all 8 factors', () => {
    const r = runProgressiveScan(inputAt(30));
    expect(r.activeFactors).toEqual(LEVEL_ACTIVE_FACTORS[3]);
    // active + skipped together cover exactly the 8 factors, no overlap
    const union = new Set([...r.activeFactors, ...r.skippedFactors]);
    expect(union.size).toBe(8);
    expect(r.activeFactors.some(f => r.skippedFactors.includes(f))).toBe(false);
  });

  it('deflates confidence by the level multiplier', () => {
    const level1 = runProgressiveScan(inputAt(0));
    const level4 = runProgressiveScan(inputAt(60));
    // Level 1 confidence is deflated far more aggressively than level 4.
    expect(LEVEL_CONFIDENCE_MULTIPLIER[1]).toBeLessThan(LEVEL_CONFIDENCE_MULTIPLIER[4]);
    expect(level1.confidence).toBeLessThanOrEqual(level4.confidence);
    expect(level1.confidence).toBeGreaterThanOrEqual(0);
    expect(level4.confidence).toBeLessThanOrEqual(1);
  });

  it('produces a valid score, zone and full edgeScoreResult at every level', () => {
    for (const rr of [0, 15, 30, 60]) {
      const r = runProgressiveScan(inputAt(rr));
      expect(r.score).toBeGreaterThanOrEqual(0);
      expect(r.score).toBeLessThanOrEqual(100);
      expect(['clear', 'neutral', 'strain']).toContain(r.zone);
      expect(r.edgeScoreResult).toBeDefined();
      expect(r.computedAt).toBe(reading.timestamp);
    }
  });

  it('applies wearable HRV override when a positive RMSSD is supplied', () => {
    const withWearable = runProgressiveScan(inputAt(60, { wearableHrvRmssdMs: 70 }));
    expect(withWearable.wearableHrvApplied).toBe(true);
  });

  it('does not apply wearable override for zero/absent RMSSD', () => {
    expect(runProgressiveScan(inputAt(60)).wearableHrvApplied).toBe(false);
    expect(runProgressiveScan(inputAt(60, { wearableHrvRmssdMs: 0 })).wearableHrvApplied).toBe(false);
  });

  it('selects the best fusion source when availableSources are provided', () => {
    const sources: SourceQuality[] = [
      { source: 'rppg_cheek', sqiScore: 55 },
      { source: 'ble_chest', sqiScore: 90 },
    ];
    const r = runProgressiveScan(inputAt(60, { availableSources: sources }));
    expect(r.fusionLog.source).toBe('ble_chest');
  });

  it('falls back to rppg_cheek fusion log when no sources are given', () => {
    const r = runProgressiveScan(inputAt(60));
    expect(r.fusionLog.source).toBe('rppg_cheek');
    expect(r.fusionLog.sqiScore).toBe(goodSignal.score);
  });
});
