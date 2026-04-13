import {
  assertPersistedScanRecordContract,
  buildScanHandoffContract,
  validateScanHandoffContract,
  validateScanRequestContract,
} from '../index';

const fullDriverSet = [
  { key: 'hrv_vs_baseline', rawSubScore: 81 },
  { key: 'hr_stability', rawSubScore: 76 },
  { key: 'respiration_stability', rawSubScore: 73 },
  { key: 'stress_proxy_vs_baseline', rawSubScore: 68 },
  { key: 'sleep_recovery', rawSubScore: 85 },
  { key: 'recent_trend', rawSubScore: 71 },
  { key: 'baseline_freshness', rawSubScore: 64 },
  { key: 'signal_quality', rawSubScore: 92 },
] as const;

describe('scan schema', () => {
  it('builds a canonical scan handoff payload from driver arrays', () => {
    const handoff = buildScanHandoffContract({
      edgeScore: 78,
      zone: 'clear',
      confidence: 0.86,
      confidenceBand: 'high',
      gateResult: 'clear_pass',
      scanDurationSec: 60,
      signalGrade: 'A',
      timestamp: 1_744_173_600_000,
      drivers: fullDriverSet,
    });

    expect(handoff.drivers).toEqual({
      hrv: 81,
      hrStability: 76,
      respiration: 73,
      stressProxy: 68,
      sleepRecovery: 85,
      recentTrend: 71,
      baselineFreshness: 64,
      signalQuality: 92,
    });
  });

  it('throws when any required driver is missing from the handoff', () => {
    expect(() =>
      buildScanHandoffContract({
        edgeScore: 62,
        zone: 'neutral',
        confidence: 0.68,
        confidenceBand: 'moderate',
        gateResult: 'soft_caution',
        scanDurationSec: 30,
        signalGrade: 'B',
        timestamp: 1_744_173_600_000,
        drivers: fullDriverSet.slice(0, 7),
      })
    ).toThrow('Missing scan drivers for handoff');
  });

  it('validates scan handoff numeric ranges', () => {
    const result = validateScanHandoffContract({
      edgeScore: 120,
      zone: 'clear',
      confidence: 1.2,
      confidenceBand: 'high',
      gateResult: 'clear_pass',
      scanDurationSec: 0,
      signalGrade: 'A',
      timestamp: 0,
      drivers: {
        hrv: 90,
        hrStability: 88,
        respiration: 84,
        stressProxy: 83,
        sleepRecovery: 79,
        recentTrend: 75,
        baselineFreshness: 72,
        signalQuality: 91,
      },
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors).toEqual([
        'scan handoff.edgeScore must be a number between 0 and 100',
        'scan handoff.confidence must be a number between 0 and 1',
        'scan handoff.scanDurationSec must be a positive number',
        'scan handoff.timestamp must be a positive timestamp',
      ]);
    }
  });

  it('rejects persisted scan records that include raw biometric samples', () => {
    expect(() =>
      assertPersistedScanRecordContract({
        id: 'scan_001',
        type: 'deep',
        mode: 'focus',
        templateId: null,
        checklist: {
          signalQualityReady: true,
          coverageReady: true,
          stabilityReady: true,
          baselineReady: true,
          cameraPermissionReady: true,
          minimumDurationMet: true,
        },
        handoff: buildScanHandoffContract({
          edgeScore: 74,
          zone: 'clear',
          confidence: 0.82,
          confidenceBand: 'high',
          gateResult: 'clear_pass',
          scanDurationSec: 60,
          signalGrade: 'A',
          timestamp: 1_744_173_600_000,
          drivers: fullDriverSet,
        }),
        storagePolicy: 'encrypted_sqlite',
        rawHrSamples: [71, 72, 73],
        createdAt: 1_744_173_600_000,
        updatedAt: 1_744_173_660_000,
      })
    ).toThrow('persisted scan record cannot contain rawHrSamples');
  });

  it('rejects non-trader requests that carry a trader template', () => {
    const result = validateScanRequestContract({
      type: 'quick',
      mode: 'focus',
      templateId: 'FBD',
      requestedAt: 1_744_173_600_000,
      baselineAvailable: true,
      featureFlagEnabled: true,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors).toEqual([
        'templateId can only be set when mode is "trader"',
      ]);
    }
  });
});
