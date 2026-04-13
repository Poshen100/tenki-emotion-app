/**
 * @module pipeline/__tests__/scan-pipeline.test.ts
 * @description Unit tests for the end-to-end Scan Pipeline.
 */

import { runScanPipeline, PipelineDependencies } from '../scan-pipeline';
import { BiometricReading, SignalQuality, BaselineProfile } from '../../common/types';
import { BASELINE_THRESHOLDS } from '../../common/types';

function createMockBaseline(): BaselineProfile {
  const defaultMetric = {
    mean: 60, std: 5, sampleCount: 10, lastUpdatedAt: Date.now() - 3600000
  };
  return {
    hr: { morning: { ...defaultMetric }, midday: { ...defaultMetric }, evening: { ...defaultMetric } },
    hrv: { morning: { ...defaultMetric, mean: 40 }, midday: { ...defaultMetric, mean: 40 }, evening: { ...defaultMetric, mean: 40 } },
    rr: { morning: { ...defaultMetric, mean: 14, std: 2 }, midday: { ...defaultMetric, mean: 14, std: 2 }, evening: { ...defaultMetric, mean: 14, std: 2 } },
    stressProxy: { ...defaultMetric, mean: 0, std: 1 },
    maturity: 'mature',
    totalScanCount: 30,
    version: '3.0'
  };
}

describe('runScanPipeline', () => {
  const mockReading: BiometricReading = {
    hrBpm: 62,
    hrvRmssdMs: 45,
    rrBrpm: 15,
    timestamp: Date.now() // Morning, Midday or Evening based on run environment, but valid
  };

  const goodSignal: SignalQuality = {
    score: 95,
    grade: 'A',
    coverage: 0.98,
    stability: 0.95,
    acceptable: true
  };

  const badSignal: SignalQuality = {
    score: 15,
    grade: 'F',
    coverage: 0.20,
    stability: 0.10,
    acceptable: false
  };

  let deps: PipelineDependencies;

  beforeEach(() => {
    deps = {
      currentBaseline: createMockBaseline(),
      sleepRecovery: {
        durationHours: 8,
        qualityScore: 85,
        source: 'healthkit',
        stalenessHours: 2
      },
      recentScores: [85, 80, 88]
    };
  });

  it('should reject scans with poor signal quality early', () => {
    const result = runScanPipeline(mockReading, badSignal, deps);
    expect(result.success).toBe(false);
    expect(result.rejectReason).toBe('POOR_SIGNAL');
    expect(result.gateFeedback.result).toBe('force_hold');
  });

  it('should process a valid scan successfully and return an Edge Score Result', () => {
    const result = runScanPipeline(mockReading, goodSignal, deps);
    expect(result.success).toBe(true);
    expect(result.edgeScoreResult).toBeDefined();
    expect(result.edgeScoreResult?.score).toBeGreaterThan(0);
    expect(result.updatedBaseline.totalScanCount).toBe(deps.currentBaseline.totalScanCount + 1);
  });
});
