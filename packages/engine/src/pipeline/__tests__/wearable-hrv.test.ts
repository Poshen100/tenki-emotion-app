/**
 * The rule that decides whether a wearable HRV value may stand in for a scan's
 * HRV — and, just as much, the two cases where it may not.
 */
import {
  WEARABLE_HRV_FRESHNESS_MS,
  evaluateWearableHrv,
  runScanPipeline,
  type PipelineDependencies,
  type WearableHrvContext,
} from '../scan-pipeline';
import { createEmptyBaselineProfile, updateBaselineProfile } from '../../baseline/baseline';
import type { BaselineProfile, BiometricReading, SignalQuality } from '../../common/types';

const NOW = new Date('2026-09-10T09:30:00Z').getTime();

const GOOD_SIGNAL: SignalQuality = {
  score: 85,
  grade: 'B',
  coverage: 0.95,
  stability: 0.9,
  acceptable: true,
};

function context(overrides: Partial<WearableHrvContext> = {}): WearableHrvContext {
  return {
    metric: 'rmssd',
    valueMs: 52,
    observedAt: NOW - 60_000,
    source: 'ble_chest',
    ...overrides,
  };
}

function seededBaseline(): BaselineProfile {
  let baseline = createEmptyBaselineProfile();
  for (let i = 0; i < 6; i++) {
    baseline = updateBaselineProfile(
      baseline,
      { hrBpm: 62 + i, hrvRmssdMs: 40 + i, rrBrpm: 13 + (i % 3), timestamp: NOW - i * 60_000 },
      50,
    );
  }
  return baseline;
}

function deps(overrides: Partial<PipelineDependencies> = {}): PipelineDependencies {
  return {
    currentBaseline: seededBaseline(),
    sleepRecovery: { durationHours: null, qualityScore: null, source: 'none', stalenessHours: 0 },
    recentScores: [],
    now: NOW,
    ...overrides,
  };
}

describe('evaluateWearableHrv', () => {
  it('accepts a fresh RMSSD value and tags how it was derived', () => {
    const verdict = evaluateWearableHrv(context(), NOW);

    expect(verdict).toEqual({ valueMs: 52, derivation: 'derived' });
  });

  it('tags a health-hub value as observed, not derived', () => {
    // The hub reports HRV as its own value; TENKI computed nothing.
    const verdict = evaluateWearableHrv(context({ source: 'healthkit', metric: 'rmssd' }), NOW);

    expect(verdict).toEqual({ valueMs: 52, derivation: 'observed' });
  });

  it('refuses an SDNN value rather than letting it enter the RMSSD field', () => {
    // 🔴 SDNN is not a worse RMSSD, it is a different statistic, and no fixed
    // ratio converts one into the other for a given person. Apple Health
    // reports SDNN, so this is the live case, not a hypothetical one.
    const verdict = evaluateWearableHrv(context({ metric: 'sdnn' }), NOW);

    expect(verdict).toEqual({ rejectedBecause: 'wrong_metric' });
  });

  it("refuses yesterday's value rather than presenting it as the user's HRV now", () => {
    const yesterday = context({ observedAt: NOW - WEARABLE_HRV_FRESHNESS_MS - 1 });

    expect(evaluateWearableHrv(yesterday, NOW)).toEqual({ rejectedBecause: 'stale' });
  });

  it('treats the freshness edge as still usable', () => {
    const edge = context({ observedAt: NOW - WEARABLE_HRV_FRESHNESS_MS });

    expect(evaluateWearableHrv(edge, NOW)).toEqual({ valueMs: 52, derivation: 'derived' });
  });

  it('refuses a value that is not a measurement', () => {
    for (const valueMs of [Number.NaN, 0, -5, Number.POSITIVE_INFINITY]) {
      expect(evaluateWearableHrv(context({ valueMs }), NOW)).toEqual({
        rejectedBecause: 'implausible',
      });
    }
  });
});

describe('wearable HRV through the pipeline', () => {
  /** Camera established a heart rate only — the common phone-only outcome. */
  const HR_ONLY: BiometricReading = {
    hrBpm: 68,
    hrvRmssdMs: Number.NaN,
    rrBrpm: Number.NaN,
    timestamp: NOW,
  };

  it('fills the gap the camera left, which the old rule could not', () => {
    // 🔴 The previous condition required `fingerCalibrated && fingerConfidence
    // >= 0.80` — so the wearable only ever helped when the camera had ALREADY
    // succeeded at high confidence, and never when it was actually needed.
    const result = runScanPipeline(HR_ONLY, GOOD_SIGNAL, deps({ wearableHrv: context() }));

    expect(result.wearableHrv).toEqual({
      applied: true,
      derivation: 'derived',
      rejectedBecause: null,
    });
    expect(result.excludedDrivers).not.toContain('hrv_vs_baseline');
  });

  it('leaves the HRV driver excluded when the wearable value was refused', () => {
    const result = runScanPipeline(
      HR_ONLY,
      GOOD_SIGNAL,
      deps({ wearableHrv: context({ metric: 'sdnn' }) }),
    );

    expect(result.wearableHrv?.rejectedBecause).toBe('wrong_metric');
    expect(result.excludedDrivers).toContain('hrv_vs_baseline');
    expect(Number.isFinite(result.edgeScoreResult?.score)).toBe(true);
  });

  it('does not let a wearable value move the camera baseline', () => {
    // The baseline tracks what the CAMERA measured. A wearable value may stand
    // in for scoring; letting it also seed the camera's own reference would
    // make every later camera scan compare against a device it never used.
    const before = seededBaseline();
    const result = runScanPipeline(
      HR_ONLY,
      GOOD_SIGNAL,
      deps({ currentBaseline: before, wearableHrv: context() }),
    );

    expect(result.wearableHrv?.applied).toBe(true);
    expect(result.updatedBaseline.hrv.morning).toEqual(before.hrv.morning);
  });

  it('reports nothing about a wearable when none was supplied', () => {
    const result = runScanPipeline(HR_ONLY, GOOD_SIGNAL, deps());

    expect(result.wearableHrv).toBeUndefined();
    expect(result.wearableHrvApplied).toBe(false);
  });
});
