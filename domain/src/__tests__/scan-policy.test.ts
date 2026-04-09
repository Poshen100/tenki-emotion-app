import {
  canStartScanFromChecklist,
  meetsSignalGradeRequirement,
  resolveScanRequirements,
  validateScanRequestPolicy,
} from '../index';

describe('scan policy', () => {
  it('resolves Mode 2 trader checks to a 30-second gate', () => {
    const requirements = resolveScanRequirements({
      type: 'trader_check',
      mode: 'trader',
      templateId: 'MODE_2',
      requestedAt: Date.now(),
      baselineAvailable: true,
      featureFlagEnabled: true,
    });

    expect(requirements.minimumDurationSec).toBe(30);
    expect(requirements.requiresBaseline).toBe(true);
    expect(requirements.requiresTemplate).toBe(true);
    expect(requirements.requiresSessionGate).toBe(true);
  });

  it('compares signal grades against the scan minimums', () => {
    expect(meetsSignalGradeRequirement('C', 'quick')).toBe(true);
    expect(meetsSignalGradeRequirement('C', 'deep')).toBe(false);
    expect(meetsSignalGradeRequirement('B', 'deep')).toBe(true);
  });

  it('rejects trader checks without template, baseline, or feature flag', () => {
    const errors = validateScanRequestPolicy({
      type: 'trader_check',
      mode: 'trader',
      templateId: null,
      requestedAt: Date.now(),
      baselineAvailable: false,
      featureFlagEnabled: false,
    });

    expect(errors).toEqual([
      'scan_pipeline_v1 feature flag must be enabled before starting a scan',
      'scan type "trader_check" requires a trader template',
      'scan type "trader_check" requires a baseline before it can run',
    ]);
  });

  it('requires the full checklist plus baseline for trader checks', () => {
    const requirements = resolveScanRequirements({
      type: 'trader_check',
      mode: 'trader',
      templateId: 'FBD',
      requestedAt: Date.now(),
      baselineAvailable: true,
      featureFlagEnabled: true,
    });

    expect(
      canStartScanFromChecklist(
        {
          signalQualityReady: true,
          coverageReady: true,
          stabilityReady: true,
          baselineReady: false,
          cameraPermissionReady: true,
          minimumDurationMet: true,
        },
        requirements
      )
    ).toBe(false);

    expect(
      canStartScanFromChecklist(
        {
          signalQualityReady: true,
          coverageReady: true,
          stabilityReady: true,
          baselineReady: true,
          cameraPermissionReady: true,
          minimumDurationMet: true,
        },
        requirements
      )
    ).toBe(true);
  });
});
