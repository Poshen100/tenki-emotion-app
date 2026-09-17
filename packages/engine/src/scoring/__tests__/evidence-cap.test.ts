/**
 * What a phone is allowed to move the Edge Score by.
 *
 * 🔴 founder rule, 2026-09-11: *"沒有可用生理訊號 ≠ 自動加高其他分項權重
 * ≠ Edge Score 變高"*. The engine used to do exactly that — excluded drivers had
 * their weight redistributed across whatever survived — and the effect was
 * invisible: a phone-only reading excludes HRV (25), the stress proxy (15) and
 * respiration (10), so `hr_stability` went from 15% of the score to 30%. This
 * suite is what stops that coming back.
 */
import { calculateEdgeScore, resolveEvidenceSources, type EdgeScoreInput } from '../edge-score';
import {
  EDGE_SCORE_ANCHOR,
  PHONE_EVIDENCE_CAPS,
  PHONE_ONLY_PHYSIOLOGY_CAP,
} from '../types';
import type { BaselineProfile, MetricBaseline } from '../../common/types';

function metric(mean: number, std: number): MetricBaseline {
  return { mean, std, sampleCount: 20, lastUpdatedAt: Date.now() - 3_600_000 };
}

function baseline(): BaselineProfile {
  const hr = { morning: metric(68, 5), midday: metric(72, 6), evening: metric(65, 4) };
  const hrv = { morning: metric(45, 10), midday: metric(40, 8), evening: metric(50, 12) };
  const rr = { morning: metric(16, 2), midday: metric(17, 2), evening: metric(15, 2) };
  return {
    hr,
    hrv,
    rr,
    stressProxy: metric(50, 10),
    maturity: 'mature',
    totalScanCount: 30,
    version: '3.0.0',
  };
}

const MORNING = (() => {
  const d = new Date();
  d.setHours(10, 0, 0, 0);
  return d.getTime();
})();

function input(overrides: Partial<EdgeScoreInput> = {}): EdgeScoreInput {
  return {
    reading: { hrBpm: 68, hrvRmssdMs: 45, rrBrpm: 16, timestamp: MORNING },
    baseline: baseline(),
    signalQuality: { score: 85, grade: 'A', coverage: 0.95, stability: 0.9, acceptable: true },
    sleepRecovery: { durationHours: 7.5, qualityScore: 75, source: 'healthkit', stalenessHours: 4 },
    recentScores: [72, 68, 75, 70, 65],
    ...overrides,
  };
}

/**
 * A reading where every phone-measurable signal is as favourable as it gets.
 *
 * ⚠️ That means sitting **on** the baseline, not far below it. `hr_stability`
 * scores how close the pulse is to the user's own baseline, so 68 bpm against a
 * 68 bpm baseline scores 100 and 53 bpm scores 0. The first version of this
 * helper used 53 "because lower is better" — which made the regression test
 * below assert nothing, since redistribution was amplifying a driver that was
 * scoring zero.
 */
function veryFavourablePulse(overrides: Partial<EdgeScoreInput> = {}): EdgeScoreInput {
  return input({
    reading: { hrBpm: 68, hrvRmssdMs: 45, rrBrpm: 16, timestamp: MORNING },
    ...overrides,
  });
}

describe('the phone cannot buy score with the weight of what is missing', () => {
  it('🔴 does not raise the score by taking HRV away', () => {
    // The regression in one assertion. Same favourable pulse, once with HRV
    // present and once without. Under weight redistribution the second scored
    // HIGHER, because `hr_stability` inherited HRV's 25 points.
    const withHrv = calculateEdgeScore(
      veryFavourablePulse({ evidence: { pulse: 'wearable', hrv: 'rr_sensor', breath: 'wearable' } }),
    );
    const withoutHrv = calculateEdgeScore(
      veryFavourablePulse({
        reading: { hrBpm: 68, hrvRmssdMs: Number.NaN, rrBrpm: 16, timestamp: MORNING },
        evidence: { pulse: 'wearable', breath: 'wearable' },
      }),
    );

    expect(withoutHrv.metadata.excludedDrivers).toContain('hrv_vs_baseline');
    expect(withoutHrv.score).toBeLessThanOrEqual(withHrv.score);
  });

  it('reports the missing drivers rather than hiding the thinness', () => {
    const thin = calculateEdgeScore(
      input({
        reading: { hrBpm: 68, hrvRmssdMs: Number.NaN, rrBrpm: Number.NaN, timestamp: MORNING },
      }),
    );
    expect(thin.metadata.excludedDrivers).toEqual(
      expect.arrayContaining([
        'hrv_vs_baseline',
        'stress_proxy_vs_baseline',
        'respiration_stability',
      ]),
    );
  });
});

describe('phone-derived physiology moves the score within a ceiling', () => {
  it('caps a camera pulse at its own ceiling', () => {
    const best = calculateEdgeScore(
      veryFavourablePulse({
        reading: { hrBpm: 68, hrvRmssdMs: Number.NaN, rrBrpm: Number.NaN, timestamp: MORNING },
        evidence: { pulse: 'phone_camera' },
      }),
    );
    // A pulse sitting exactly on its own baseline is the best `hr_stability`
    // can report, and its raw movement would be its full 15 points.
    expect(best.metadata.phoneEvidenceMovement).toBe(PHONE_EVIDENCE_CAPS.pulse);
    expect(best.metadata.cappedDrivers).toContain('hr_stability');
  });

  it('caps it in the downward direction too', () => {
    // 🔴 Symmetric on purpose. Over-claiming a LOW readiness from thin evidence
    // is the same error pointing the other way, and on this product it is the
    // one that reads like a health warning.
    //
    // ⚠️ Asserted on the reported movement, not on the gap between two
    // readings: the sub-scores are not all centred on the anchor (a resting
    // pulse sitting exactly on its baseline scores `hr_stability` 100, not 50),
    // so differencing two readings measures a RANGE — up to twice the cap —
    // and would look like a violation while the cap was working correctly.
    const worst = calculateEdgeScore(
      input({
        reading: { hrBpm: 110, hrvRmssdMs: Number.NaN, rrBrpm: Number.NaN, timestamp: MORNING },
        evidence: { pulse: 'phone_camera' },
      }),
    );
    expect(worst.metadata.phoneEvidenceMovement).toBeLessThan(0);
    expect(worst.metadata.phoneEvidenceMovement as number).toBeGreaterThanOrEqual(
      -PHONE_EVIDENCE_CAPS.pulse,
    );
    expect(worst.metadata.cappedDrivers).toContain('hr_stability');
  });

  it('caps camera breath at its own, smaller ceiling', () => {
    const withBreath = calculateEdgeScore(
      input({
        reading: { hrBpm: 110, hrvRmssdMs: Number.NaN, rrBrpm: 16, timestamp: MORNING },
        evidence: { pulse: 'phone_camera', breath: 'phone_camera' },
      }),
    );
    // Pulse pinned to its worst (-6), breath sitting on its baseline (+4).
    expect(withBreath.metadata.cappedDrivers).toEqual(
      expect.arrayContaining(['hr_stability', 'respiration_stability']),
    );
    expect(withBreath.metadata.phoneEvidenceMovement).toBe(
      PHONE_EVIDENCE_CAPS.breath - PHONE_EVIDENCE_CAPS.pulse,
    );
  });

  it('never lets everything a phone can measure add up past the total cap', () => {
    for (const reading of [
      { hrBpm: 68, rrBrpm: 16 },
      { hrBpm: 40, rrBrpm: 8 },
      { hrBpm: 110, rrBrpm: 30 },
      { hrBpm: 52, rrBrpm: 12 },
    ]) {
      const result = calculateEdgeScore(
        input({
          reading: {
            hrBpm: reading.hrBpm,
            hrvRmssdMs: Number.NaN,
            rrBrpm: reading.rrBrpm,
            timestamp: MORNING,
          },
          evidence: { pulse: 'phone_camera', breath: 'phone_camera' },
        }),
      );
      expect(Math.abs(result.metadata.phoneEvidenceMovement as number)).toBeLessThanOrEqual(
        PHONE_ONLY_PHYSIOLOGY_CAP,
      );
    }
  });

  it('⚠️ leaves the reserved 5 points unspent, because nothing computes them yet', () => {
    // Coupling (3) and regulation response (2) are budgeted but not measured.
    // If this starts failing, something is spending a budget it has not earned.
    const reachable = PHONE_EVIDENCE_CAPS.pulse + PHONE_EVIDENCE_CAPS.breath;
    expect(reachable).toBe(10);
    expect(
      PHONE_EVIDENCE_CAPS.pulse +
        PHONE_EVIDENCE_CAPS.breath +
        PHONE_EVIDENCE_CAPS.coupling +
        PHONE_EVIDENCE_CAPS.regulation_response,
    ).toBe(PHONE_ONLY_PHYSIOLOGY_CAP);

    const best = calculateEdgeScore(
      input({
        reading: { hrBpm: 68, hrvRmssdMs: Number.NaN, rrBrpm: 16, timestamp: MORNING },
        evidence: { pulse: 'phone_camera', breath: 'phone_camera' },
      }),
    );
    expect(best.metadata.phoneEvidenceMovement).toBe(reachable);
  });
});

describe('sensor evidence is not capped, because it is not phone evidence', () => {
  it('lets a chest strap move the score by more than the phone ceiling', () => {
    // 🔴 The cap is about provenance, not caution. Capping RR-derived HRV would
    // punish the users with the best claim to a real reading.
    const withSensors = {
      pulse: 'wearable',
      hrv: 'rr_sensor',
      breath: 'wearable',
    } as const;
    const flat = calculateEdgeScore(
      input({
        reading: { hrBpm: 68, hrvRmssdMs: 45, rrBrpm: 16, timestamp: MORNING },
        evidence: withSensors,
      }),
    );
    const collapsed = calculateEdgeScore(
      input({
        // HRV four standard deviations below baseline: real evidence of a real
        // change, and the score is allowed to say so.
        reading: { hrBpm: 68, hrvRmssdMs: 5, rrBrpm: 16, timestamp: MORNING },
        evidence: withSensors,
      }),
    );
    expect(flat.score - collapsed.score).toBeGreaterThan(PHONE_ONLY_PHYSIOLOGY_CAP);
    expect(flat.metadata.phoneEvidenceMovement).toBe(0);
    expect(collapsed.metadata.phoneEvidenceMovement).toBe(0);
  });

  it('does not mark uncapped drivers as capped', () => {
    const result = calculateEdgeScore(
      input({
        reading: { hrBpm: 55, hrvRmssdMs: 85, rrBrpm: 12, timestamp: MORNING },
        evidence: { pulse: 'wearable', hrv: 'rr_sensor', breath: 'wearable' },
      }),
    );
    expect(result.metadata.cappedDrivers).toEqual([]);
  });
});

describe('an undeclared source is treated as the one it can always support', () => {
  it('defaults to phone-derived, which is the capped case', () => {
    const resolved = resolveEvidenceSources(undefined, { hrv: true, respiration: true });
    expect(resolved.pulse).toBe('phone_camera');
    expect(resolved.breath).toBe('phone_camera');
  });

  it('never resolves HRV to a camera, whatever it is handed', () => {
    // 🔴 Camera PRV is a different quantity from RR-interval HRV and may never
    // populate an HRV field. The type forbids it; this checks the resolver
    // cannot produce it by default either.
    expect(resolveEvidenceSources(undefined, { hrv: true, respiration: true }).hrv).not.toBe(
      'phone_camera',
    );
    expect(resolveEvidenceSources(undefined, { hrv: false, respiration: true }).hrv).toBe('none');
  });

  it('marks breath as absent when no respiratory rate was measured', () => {
    expect(resolveEvidenceSources({ breath: 'wearable' }, { hrv: true, respiration: false }).breath)
      .toBe('none');
  });
});

describe('the anchor is where a reading with nothing behind it sits', () => {
  it('scores near the anchor when no physiology and no context favours anything', () => {
    const flat = calculateEdgeScore(
      input({
        reading: { hrBpm: 68, hrvRmssdMs: Number.NaN, rrBrpm: Number.NaN, timestamp: MORNING },
        baseline: { ...baseline(), maturity: 'new', totalScanCount: 0 },
        sleepRecovery: { durationHours: null, qualityScore: null, source: 'none', stalenessHours: 0 },
        recentScores: [],
        signalQuality: { score: 50, grade: 'C', coverage: 0.7, stability: 0.6, acceptable: true },
        evidence: { pulse: 'phone_camera' },
      }),
    );
    expect(Math.abs(flat.score - EDGE_SCORE_ANCHOR)).toBeLessThanOrEqual(
      PHONE_ONLY_PHYSIOLOGY_CAP,
    );
  });
});
