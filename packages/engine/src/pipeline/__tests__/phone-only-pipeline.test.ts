/**
 * 🔴 The phone-only reading through the pipeline that is actually called
 * (`apps/mobile/features/scan/hooks/useProgressiveScan.ts`).
 *
 * Before these guards existed, a reading with a heart rate and nothing else
 * came back `success: true`, `score: NaN`, `zone: 'strain'`, `confidence: 0.67`.
 * The zone is the dangerous part: `NaN >= 70` and `NaN >= 40` are both false,
 * so the last branch wins and a user whose beat timing was merely too noisy for
 * HRV is told their state is poor.
 */
import { runScanPipeline, type PipelineDependencies } from '../scan-pipeline';
import { createEmptyBaselineProfile, updateBaselineProfile } from '../../baseline/baseline';
import type { BaselineProfile, BiometricReading, SignalQuality } from '../../common/types';

const AT = new Date('2026-09-10T09:30:00Z').getTime();

const GOOD_SIGNAL: SignalQuality = {
  score: 85,
  grade: 'B',
  coverage: 0.95,
  stability: 0.9,
  acceptable: true,
};

/** A baseline with real variance, so a NaN would actually propagate. */
function seededBaseline(): BaselineProfile {
  let baseline = createEmptyBaselineProfile();
  for (let i = 0; i < 6; i++) {
    baseline = updateBaselineProfile(
      baseline,
      { hrBpm: 62 + i, hrvRmssdMs: 40 + i, rrBrpm: 13 + (i % 3), timestamp: AT - i * 60_000 },
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
    ...overrides,
  };
}

/** What `ppg/to-reading.ts` hands over when only a heart rate was established. */
const HR_ONLY: BiometricReading = {
  hrBpm: 68,
  hrvRmssdMs: Number.NaN,
  rrBrpm: Number.NaN,
  timestamp: AT,
};

describe('phone-only reading through runScanPipeline', () => {
  it('produces a finite score, never NaN', () => {
    const result = runScanPipeline(HR_ONLY, GOOD_SIGNAL, deps());

    expect(result.success).toBe(true);
    expect(Number.isFinite(result.edgeScoreResult?.score)).toBe(true);
  });

  it('does not classify a partial reading as strain by accident', () => {
    // The specific defect: NaN falling through classifyEdgeZone's last branch.
    const result = runScanPipeline(HR_ONLY, GOOD_SIGNAL, deps());
    const score = result.edgeScoreResult?.score as number;

    expect(result.edgeScoreResult?.zone).toBe(score >= 70 ? 'clear' : score >= 40 ? 'neutral' : 'strain');
    expect(score).toBeGreaterThan(39);
  });

  it('excludes the unmeasured drivers and says which', () => {
    const result = runScanPipeline(HR_ONLY, GOOD_SIGNAL, deps());

    expect(result.excludedDrivers).toEqual(
      expect.arrayContaining(['hrv_vs_baseline', 'stress_proxy_vs_baseline', 'respiration_stability']),
    );
  });

  it('narrows availability from the reading even when the caller declares everything present', () => {
    // The caller lying (or simply not knowing) must not be able to produce a
    // NaN score. This is the second layer, and it is the one that catches the
    // caller who forgot.
    const result = runScanPipeline(
      HR_ONLY,
      GOOD_SIGNAL,
      deps({ availability: { hrv: true, respiration: true } }),
    );

    expect(Number.isFinite(result.edgeScoreResult?.score)).toBe(true);
    expect(result.excludedDrivers).toContain('hrv_vs_baseline');
  });

  it('leaves the unmeasured baseline tracks untouched', () => {
    const before = seededBaseline();
    const result = runScanPipeline(HR_ONLY, GOOD_SIGNAL, deps({ currentBaseline: before }));

    expect(result.updatedBaseline.hrv.morning).toEqual(before.hrv.morning);
    expect(result.updatedBaseline.rr.morning).toEqual(before.rr.morning);
    expect(Number.isFinite(result.updatedBaseline.hr.morning.mean)).toBe(true);
  });

  it('rejects outright when not even a heart rate was established', () => {
    // No heart rate is not a thin reading — it is no reading. Every remaining
    // physiological driver reads from it.
    const nothing: BiometricReading = {
      hrBpm: Number.NaN,
      hrvRmssdMs: Number.NaN,
      rrBrpm: Number.NaN,
      timestamp: AT,
    };
    const result = runScanPipeline(nothing, GOOD_SIGNAL, deps());

    expect(result.success).toBe(false);
    expect(result.rejectReason).toBe('NO_HEART_RATE');
    expect(result.edgeScoreResult).toBeUndefined();
  });

  it('scores a complete reading exactly as it did before any of this', () => {
    const complete: BiometricReading = { hrBpm: 68, hrvRmssdMs: 44, rrBrpm: 14, timestamp: AT };
    const result = runScanPipeline(complete, GOOD_SIGNAL, deps());

    expect(result.success).toBe(true);
    expect(result.excludedDrivers).toEqual([]);
    expect(Number.isFinite(result.edgeScoreResult?.score)).toBe(true);
  });

  it('reports lower confidence for the partial reading than the complete one', () => {
    const complete: BiometricReading = { hrBpm: 68, hrvRmssdMs: 44, rrBrpm: 14, timestamp: AT };
    const partial = runScanPipeline(HR_ONLY, GOOD_SIGNAL, deps());
    const full = runScanPipeline(complete, GOOD_SIGNAL, deps());

    expect(partial.edgeScoreResult?.confidence.overall).toBeLessThan(
      full.edgeScoreResult?.confidence.overall as number,
    );
  });
});

describe('the pipeline actually forwards availability, tested where nothing else catches it', () => {
  // 🔴 Reverse verification caught these two as decorative. Cutting the
  // `availability` hand-off to the Edge Score, and cutting it to the baseline
  // update, BOTH left all 469 tests green — because the NaN in a phone-only
  // reading is independently caught downstream (`resolveAvailability` re-derives
  // it inside the engine; `updateMetricBaseline` drops non-finite values).
  //
  // The only case that isolates the hand-off is a field holding a FINITE value
  // the caller says is not a measurement. Same lesson as the two baseline
  // guards — see docs/PLAYBOOK.md.

  /** A stale wearable value sitting in the field the caller says is unmeasured. */
  const FINITE_BUT_UNMEASURED: BiometricReading = {
    hrBpm: 68,
    hrvRmssdMs: 44,
    rrBrpm: 14,
    timestamp: AT,
  };

  it('forwards a declared-unavailable field to the Edge Score', () => {
    const result = runScanPipeline(
      FINITE_BUT_UNMEASURED,
      GOOD_SIGNAL,
      deps({ availability: { hrv: false, respiration: true } }),
    );

    expect(result.excludedDrivers).toContain('hrv_vs_baseline');
    expect(result.excludedDrivers).not.toContain('respiration_stability');
  });

  it('forwards a declared-unavailable field to the baseline update', () => {
    const before = seededBaseline();
    const result = runScanPipeline(
      FINITE_BUT_UNMEASURED,
      GOOD_SIGNAL,
      deps({ currentBaseline: before, availability: { hrv: false, respiration: true } }),
    );

    // The HRV track must not move on a value the caller said was not measured,
    // even though the number is perfectly well-formed.
    expect(result.updatedBaseline.hrv.morning).toEqual(before.hrv.morning);
    // The track that WAS declared measured still moved.
    expect(result.updatedBaseline.rr.morning.sampleCount).toBe(before.rr.morning.sampleCount + 1);
  });
});
