/**
 * @module pipeline/__tests__/scan-pipeline.test.ts
 * @description Unit tests for the end-to-end Scan Pipeline.
 */

import { runScanPipeline, type PipelineDependencies } from '../scan-pipeline';
import type { BiometricReading, SignalQuality, BaselineProfile } from '../../common/types';

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

  it('should reject at the gate (not the signal check) when a valid signal yields a red-gate score', () => {
    // Acceptable signal (passes Step 1) but a reading far off baseline drives
    // the edge score into red-gate territory → !canProceed → GATE_REJECTED.
    const offBaseline: BiometricReading = { hrBpm: 130, hrvRmssdMs: 5, rrBrpm: 30, timestamp: Date.now() };
    const usableSignal: SignalQuality = { score: 50, grade: 'C', coverage: 0.6, stability: 0.55, acceptable: true };
    const result = runScanPipeline(offBaseline, usableSignal, {
      ...deps,
      sleepRecovery: { durationHours: 3, qualityScore: 20, source: 'manual', stalenessHours: 1 },
      recentScores: [20, 25, 22],
    });
    expect(result.success).toBe(false);
    expect(result.rejectReason).toBe('GATE_REJECTED');
    expect(['red_gate', 'force_hold']).toContain(result.gateFeedback.result);
    // Rejected scans must not advance the baseline.
    expect(result.updatedBaseline.totalScanCount).toBe(deps.currentBaseline.totalScanCount);
  });

  it('should apply the wearable HRV override for a calibrated, high-confidence finger source', () => {
    const result = runScanPipeline(mockReading, goodSignal, {
      ...deps,
      fingerCalibrated: true,
      fingerConfidence: 0.9,
      wearableHrvRmssdMs: 70,
    });
    expect(result.success).toBe(true);
    expect(result.wearableHrvApplied).toBe(true);
  });

  it('should not apply the wearable override when confidence is below the 0.80 threshold', () => {
    const result = runScanPipeline(mockReading, goodSignal, {
      ...deps,
      fingerCalibrated: true,
      fingerConfidence: 0.6,
      wearableHrvRmssdMs: 70,
    });
    expect(result.wearableHrvApplied).toBeFalsy();
  });

  it.each<[number, string]>([
    [0.9, 'high_confidence_blend'],
    [0.6, 'signal_added'],
    [0.4, 'face_only'],
  ])('should pick blend mode %s → %s when finger is calibrated', (fingerConfidence, expectedMode) => {
    const result = runScanPipeline(mockReading, goodSignal, {
      ...deps,
      fingerCalibrated: true,
      fingerConfidence,
    });
    expect(result.success).toBe(true);
    expect(result.blendMode).toBe(expectedMode);
    expect(result.blendedConfidence).toBeGreaterThanOrEqual(0);
    expect(result.blendedConfidence).toBeLessThanOrEqual(1);
  });

  it('should leave blend fields undefined when finger is not calibrated', () => {
    const result = runScanPipeline(mockReading, goodSignal, deps);
    expect(result.blendMode).toBeUndefined();
    expect(result.blendedConfidence).toBeUndefined();
  });

  it('should select the best available fusion source over the rppg_cheek fallback', () => {
    const result = runScanPipeline(mockReading, goodSignal, {
      ...deps,
      availableSources: [
        { source: 'rppg_cheek', sqiScore: 55 },
        { source: 'ble_chest', sqiScore: 92 },
      ],
    });
    expect(result.success).toBe(true);
    expect(result.fusionLog.source).toBe('ble_chest');
  });
});
