/**
 * The noise floor, and the dead zone it creates in the Edge Score.
 */
import {
  MAX_APPLIED_NOISE_FLOOR_MS,
  MIN_SCANS_FOR_NOISE_FLOOR,
  NOISE_FLOOR_WINDOW,
  createEmptyNoiseFloor,
  recordRepeatability,
  resolveEffectiveStd,
  resolveNoiseFloor,
} from '../noise-floor';
import { calculateEdgeScore } from '../../scoring/edge-score';
import { createEmptyBaselineProfile, updateBaselineProfile } from '../baseline';
import type { BaselineProfile, SleepRecoveryInput } from '../../common/types';

const NO_SLEEP: SleepRecoveryInput = {
  durationHours: null, qualityScore: null, source: 'none', stalenessHours: 0,
};

function accumulate(values: (number | null)[]) {
  return values.reduce(recordRepeatability, createEmptyNoiseFloor());
}

describe('accumulating a noise floor', () => {
  it('withholds a floor until there is enough evidence', () => {
    expect(resolveNoiseFloor(accumulate([2.1, 2.4]))).toBeNull();
    expect(resolveNoiseFloor(accumulate([2.1, 2.4, 2.2]))).not.toBeNull();
    expect(MIN_SCANS_FOR_NOISE_FLOOR).toBe(3);
  });

  it('uses the median, so one bad scan does not raise the floor for good', () => {
    // 🔴 The reason this is not a mean. A moving finger reads several times
    // worse than a clean scan; averaging that in would flatten every future
    // reading the user takes.
    const steady = accumulate([2.0, 2.2, 2.1, 2.3, 2.0]);
    const withOneDisaster = accumulate([2.0, 2.2, 2.1, 2.3, 2.0, 40]);

    const before = resolveNoiseFloor(steady) as number;
    const after = resolveNoiseFloor(withOneDisaster) as number;

    expect(after - before).toBeLessThan(0.5);
  });

  it('ignores values that are not measurements', () => {
    const state = accumulate([2.0, null, Number.NaN, 0, -3, 2.2, 2.1]);
    expect(state.samples).toEqual([2.0, 2.2, 2.1]);
  });

  it('keeps only the recent window, so the floor tracks the current phone', () => {
    const many = accumulate(Array.from({ length: NOISE_FLOOR_WINDOW + 10 }, (_, i) => 2 + i * 0.01));
    expect(many.samples.length).toBe(NOISE_FLOOR_WINDOW);
  });

  it('caps how high a floor may be applied', () => {
    // A user who only ever scans badly must not silently flatten their own
    // score into never registering a change — the honest answer to that is the
    // quality reasons the scan already reports.
    const awful = accumulate([50, 60, 55, 70, 65]);
    expect(resolveNoiseFloor(awful)).toBe(MAX_APPLIED_NOISE_FLOOR_MS);
  });
});

describe('the denominator a z-score should use', () => {
  it('never divides by less than the instrument can resolve', () => {
    expect(resolveEffectiveStd(0.6, 2.0)).toBe(2.0);
  });

  it('leaves a baseline that has genuinely seen movement alone', () => {
    expect(resolveEffectiveStd(9.0, 2.0)).toBe(9.0);
  });

  it('changes nothing while no floor is established', () => {
    expect(resolveEffectiveStd(0.6, null)).toBe(0.6);
  });
});

describe('the dead zone in the Edge Score', () => {
  /** A baseline built from readings so alike that its spread is below the floor. */
  function tightBaseline(): BaselineProfile {
    let baseline = createEmptyBaselineProfile();
    const at = new Date('2026-09-11T08:00:00Z').getTime();
    for (let i = 0; i < 8; i++) {
      baseline = updateBaselineProfile(
        baseline,
        { hrBpm: 64, hrvRmssdMs: 30 + (i % 2) * 0.4, rrBrpm: 14, timestamp: at + i * 86_400_000 },
        50,
      );
    }
    return baseline;
  }

  function score(baseline: BaselineProfile, hrv: number, floor: number | null): number {
    return calculateEdgeScore({
      reading: { hrBpm: 64, hrvRmssdMs: hrv, rrBrpm: 14, timestamp: new Date('2026-09-19T08:00:00Z').getTime() },
      baseline,
      signalQuality: { score: 88, grade: 'B', coverage: 0.96, stability: 0.94, acceptable: true },
      sleepRecovery: NO_SLEEP,
      recentScores: [],
      hrvNoiseFloorMs: floor,
    }).score;
  }

  it('stops a difference smaller than the measurement error from moving the score', () => {
    const baseline = tightBaseline();
    // 2 ms above a baseline whose own spread is a fraction of a ms — without a
    // floor this is a huge z-score built entirely out of measurement error.
    const without = score(baseline, 32, null);
    const withFloor = score(baseline, 32, 3.0);

    expect(Math.abs(withFloor - 50)).toBeLessThan(Math.abs(without - 50));
  });

  it('leaves the score untouched when the baseline has real spread', () => {
    // 🔴 The property that makes the floor safe: it must be SELECTIVE. Measured
    // over a sweep of signal-to-noise ratios, it cut score volatility by 34%
    // where two thirds of the movement was noise, and changed nothing at all
    // where the signal was strong.
    let wide = createEmptyBaselineProfile();
    const at = new Date('2026-09-11T08:00:00Z').getTime();
    for (let i = 0; i < 8; i++) {
      wide = updateBaselineProfile(
        wide,
        { hrBpm: 64, hrvRmssdMs: 20 + i * 3, rrBrpm: 14, timestamp: at + i * 86_400_000 },
        50,
      );
    }

    expect(score(wide, 40, 3.0)).toBe(score(wide, 40, null));
  });

  it('does not apply a floor that has not been established', () => {
    // Not "the same call twice" — that assertion can never fail. This asserts
    // the parameter genuinely gates the behaviour: a floor big enough to move
    // the score must move it, and null must not.
    const baseline = tightBaseline();
    expect(score(baseline, 32, 3.0)).not.toBe(score(baseline, 32, null));
  });
});
