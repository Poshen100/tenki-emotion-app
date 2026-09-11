/**
 * The acceptance test for the phone-only user: someone with a phone, no watch,
 * no strap, no health hub. They must be able to complete the whole loop —
 * scan, baseline, Edge Score, confidence — and the engine must never invent a
 * number to get them there.
 */
import { synthesizePpg, PPG_FIXTURES } from '../replay';
import { analyzePpgScan } from '../analyze';
import { toEngineInput } from '../to-reading';
import { calculateEdgeScore } from '../../../scoring/edge-score';
import {
  createEmptyBaselineProfile,
  createEmptyMetricBaseline,
  updateBaselineProfile,
  updateMetricBaseline,
} from '../../../baseline/baseline';
import type { BaselineProfile } from '../../../common/types';
import type { SleepRecoveryInput } from '../../../common/types';

/** No wearable means no sleep data. This is the phone-only user's reality. */
const NO_SLEEP: SleepRecoveryInput = {
  durationHours: null,
  qualityScore: null,
  source: 'none',
  stalenessHours: 0,
};

const START = new Date('2026-09-10T09:00:00Z').getTime();

function scanAndScore(
  baseline: BaselineProfile,
  overrides: Parameters<typeof synthesizePpg>[0],
  at: number,
  recentScores: number[] = [],
) {
  const scan = synthesizePpg({ ...overrides, startedAtMs: at });
  // See analyze.test.ts — camera HRV is off by default. These cases are about
  // the missing-data path in the ENGINE, so they enable it explicitly to get a
  // complete reading to contrast against.
  const outcome = analyzePpgScan(scan.frames, 'full_scan', { cameraHrvEstimates: true });
  if (outcome.status !== 'analysed') throw new Error(`rejected: ${outcome.reason}`);

  const input = toEngineInput(outcome.analysis, at);
  const result = calculateEdgeScore({
    reading: input.reading,
    baseline,
    signalQuality: input.signalQuality,
    sleepRecovery: NO_SLEEP,
    recentScores,
    availability: input.availability,
  });

  return { analysis: outcome.analysis, input, result };
}

describe('a user with nothing but a phone', () => {
  it('completes the whole loop: scan, baseline, score, confidence', () => {
    let baseline = createEmptyBaselineProfile();
    const scores: number[] = [];

    for (let day = 0; day < 6; day++) {
      const at = START + day * 24 * 60 * 60 * 1000;
      const { input, result } = scanAndScore(baseline, {}, at, scores);

      expect(input.scorable).toBe(true);
      expect(Number.isFinite(result.score)).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
      expect(['clear', 'neutral', 'strain']).toContain(result.zone);

      scores.unshift(result.score);
      baseline = updateBaselineProfile(baseline, input.reading, 50, day + 1, null, input.availability);
    }

    // A personal baseline built entirely from the camera. No wearable was
    // required at any point.
    expect(baseline.totalScanCount).toBe(6);
    expect(baseline.hr.morning.sampleCount).toBeGreaterThan(0);
    expect(baseline.hrv.morning.sampleCount).toBeGreaterThan(0);
    expect(baseline.maturity).not.toBe('new');
  });

  it('still produces a score when the camera could only establish a heart rate', () => {
    // The realistic phone-only scan: HR recovered, beat timing not good enough
    // for HRV, so respiration goes with it.
    const baseline = createEmptyBaselineProfile();
    const { analysis, input, result } = scanAndScore(
      baseline,
      PPG_FIXTURES.frameDrops,
      START,
    );

    expect(analysis.heartRateBpm).not.toBeNull();
    expect(analysis.hrvRmssdMs).toBeNull();
    expect(input.availability.hrv).toBe(false);

    // A score exists — this user is not told to buy a watch.
    expect(Number.isFinite(result.score)).toBe(true);
    expect(result.score).toBeGreaterThan(0);
  });

  it('excludes the drivers it has no measurement for instead of scoring them neutral', () => {
    const baseline = createEmptyBaselineProfile();
    const { result } = scanAndScore(baseline, PPG_FIXTURES.frameDrops, START);

    expect(result.metadata.excludedDrivers).toEqual(
      expect.arrayContaining(['hrv_vs_baseline', 'stress_proxy_vs_baseline']),
    );
  });

  it('reports lower confidence for a thinner reading without lowering the score', () => {
    const baseline = createEmptyBaselineProfile();
    const full = scanAndScore(baseline, {}, START);
    const partial = scanAndScore(baseline, PPG_FIXTURES.frameDrops, START);

    // Confidence is where "we know less" belongs. The score is a state
    // reading; a partial reading of a calm person must not read as strain.
    expect(partial.result.confidence.overall).toBeLessThan(full.result.confidence.overall);
    expect(partial.result.metadata.dataCompleteness).toBeLessThan(
      full.result.metadata.dataCompleteness,
    );
  });

  it('never moves a baseline track the scan did not measure', () => {
    const seeded = updateBaselineProfile(
      createEmptyBaselineProfile(),
      { hrBpm: 62, hrvRmssdMs: 44, rrBrpm: 14, timestamp: START },
      50,
    );
    const hrvBefore = { ...seeded.hrv.morning };
    const rrBefore = { ...seeded.rr.morning };

    const { input } = scanAndScore(seeded, PPG_FIXTURES.frameDrops, START + 86_400_000);
    expect(input.availability.hrv).toBe(false);

    const after = updateBaselineProfile(seeded, input.reading, 50, 2, null, input.availability);

    expect(after.hrv.morning).toEqual(hrvBefore);
    expect(after.rr.morning).toEqual(rrBefore);
    // The track that WAS measured still moved.
    expect(after.hr.morning.sampleCount).toBe(seeded.hr.morning.sampleCount + 1);
  });

  it('refuses to hand the engine a placeholder that reads as a measurement', () => {
    const baseline = createEmptyBaselineProfile();
    const { input } = scanAndScore(baseline, PPG_FIXTURES.frameDrops, START);

    // Not 50, not 15, not the baseline mean — nothing a screen could print as
    // if it had been measured.
    expect(Number.isNaN(input.reading.hrvRmssdMs)).toBe(true);
    expect(Number.isFinite(input.reading.hrBpm)).toBe(true);
  });

  it('produces no score at all when the scan established nothing', () => {
    const scan = synthesizePpg(PPG_FIXTURES.lowPerfusion);
    const outcome = analyzePpgScan(scan.frames, 'full_scan', { cameraHrvEstimates: true });
    if (outcome.status !== 'analysed') throw new Error('expected an analysis');

    const input = toEngineInput(outcome.analysis, START);
    expect(input.scorable).toBe(false);
    expect(input.signalQuality.acceptable).toBe(false);
    expect(outcome.analysis.quality.reasons).toContain('low_perfusion');
  });
});

describe('a complete reading is unaffected by any of this', () => {
  it('scores identically with availability omitted and with everything available', () => {
    const baseline = createEmptyBaselineProfile();
    const reading = { hrBpm: 64, hrvRmssdMs: 46, rrBrpm: 14, timestamp: START };
    const common = {
      reading,
      baseline,
      signalQuality: { score: 88, grade: 'B' as const, coverage: 0.97, stability: 0.95, acceptable: true },
      sleepRecovery: NO_SLEEP,
      recentScores: [70, 68, 72],
    };

    const omitted = calculateEdgeScore(common);
    const explicit = calculateEdgeScore({ ...common, availability: { hrv: true, respiration: true } });

    expect(omitted.score).toBe(explicit.score);
    expect(omitted.confidence.overall).toBe(explicit.confidence.overall);
    expect(omitted.metadata.excludedDrivers).toEqual([]);
  });
});

describe('the two baseline guards, tested one at a time', () => {
  // 🔴 These exist because the end-to-end test above could not tell them apart.
  // `updateBaselineProfile` skips an unmeasured track AND `updateMetricBaseline`
  // drops non-finite values, so breaking either one alone left the suite green:
  // the surviving guard covered the other's case. Redundancy is wanted here —
  // an untested layer is not.

  it('skips an unmeasured track even when the field holds a finite number', () => {
    // Isolates the availability check: nothing about this value is malformed,
    // it simply is not this scan's measurement.
    const seeded = updateBaselineProfile(
      createEmptyBaselineProfile(),
      { hrBpm: 62, hrvRmssdMs: 44, rrBrpm: 14, timestamp: START },
      50,
    );

    const after = updateBaselineProfile(
      seeded,
      { hrBpm: 70, hrvRmssdMs: 999, rrBrpm: 40, timestamp: START + 86_400_000 },
      50,
      2,
      null,
      { hrv: false, respiration: false },
    );

    expect(after.hrv.morning).toEqual(seeded.hrv.morning);
    expect(after.rr.morning).toEqual(seeded.rr.morning);
    expect(after.hr.morning.sampleCount).toBe(seeded.hr.morning.sampleCount + 1);
  });

  it('drops a non-finite value at Welford rather than poisoning the running mean', () => {
    // Isolates the arithmetic guard: one NaN into Welford makes the mean NaN
    // permanently, and every later scan inherits it.
    const seeded = updateMetricBaseline(createEmptyMetricBaseline(), 60, START);

    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      const after = updateMetricBaseline(seeded, bad, START + 1000);
      expect(after).toEqual(seeded);
      expect(Number.isFinite(after.mean)).toBe(true);
    }
  });
});
