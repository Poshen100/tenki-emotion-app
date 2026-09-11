/**
 * Repeatability is the instrument measuring itself. These tests hold the two
 * properties that make it usable as a noise floor.
 */
import { PPG_FIXTURES, synthesizePpg } from '../replay';
import { analyzePpgScan } from '../analyze';
import { estimateRepeatability, MIN_WINDOWS_FOR_REPEATABILITY } from '../repeatability';

/** See analyze.test.ts — camera HRV is off by default; these exercise the path. */
const PRV_ENABLED = { cameraPrvEstimates: true, cameraBreathLock: true } as const;

function repeatabilityOf(overrides: Parameters<typeof synthesizePpg>[0]): number | null {
  const scan = synthesizePpg({ durationSec: 90, ...overrides });
  const outcome = analyzePpgScan(scan.frames, 'full_scan', PRV_ENABLED);
  if (outcome.status !== 'analysed') return null;
  return outcome.analysis.repeatabilitySdMs;
}

describe('within-scan repeatability', () => {
  it('is measured on a clean scan', () => {
    const value = repeatabilityOf({});
    expect(value).not.toBeNull();
    expect(value as number).toBeGreaterThan(0);
  });

  it('rises with the noise in the beat series it is given', () => {
    // 🔴 The property that makes it personal rather than a constant.
    //
    // ⚠️ Tested on the function directly, not through a fixture. It used to run
    // a weakly-perfused capture through the pipeline — but the PRV gate
    // (`beat-template.ts`) now refuses that capture outright, because its PRV
    // error was 35-55%. The gate took over the job of removing poor captures,
    // so there is no longer a pipeline fixture that is both accepted and noisy.
    // The property still holds and still matters; the way to see it is to hand
    // the function two series.
    const steady: number[] = [];
    const jittery: number[] = [];
    const times: number[] = [];
    let t = 0;
    for (let i = 0; i < 120; i++) {
      // Deterministic alternation, so neither series depends on a seed.
      steady.push(880 + (i % 2 === 0 ? 4 : -4));
      jittery.push(880 + (i % 2 === 0 ? 60 : -60));
      t += 880;
      times.push(t);
    }

    const low = estimateRepeatability(steady, times);
    const high = estimateRepeatability(jittery, times);
    expect(low).not.toBeNull();
    expect(high).not.toBeNull();
    expect((high as { sdMs: number }).sdMs).toBeGreaterThanOrEqual(
      (low as { sdMs: number }).sdMs,
    );
  });

  it('says nothing about a scan whose HRV was withheld, even with beats to spare', () => {
    // 🔴 The isolating case, and reverse verification is why it is this one.
    // A heavy-motion scan has too few surviving beats to produce a spread
    // anyway, so removing the guard left the suite green. The dropped-frame
    // fixture is the case that separates them: plenty of beats, a heart rate
    // established, but HRV withheld because the timebase was interpolated.
    // A reading that never reaches a baseline tells us nothing about how
    // trustworthy that baseline is.
    const scan = synthesizePpg({ ...PPG_FIXTURES.frameDrops, durationSec: 90 });
    const outcome = analyzePpgScan(scan.frames, 'full_scan', PRV_ENABLED);
    if (outcome.status !== 'analysed') throw new Error('expected an analysis');

    expect(outcome.analysis.heartRateBpm).not.toBeNull();
    expect(outcome.analysis.beatCount).toBeGreaterThan(40);
    expect(outcome.analysis.prvRmssdMs).toBeNull();
    expect(outcome.analysis.repeatabilitySdMs).toBeNull();
  });

  it('returns null rather than a spread it cannot support', () => {
    expect(estimateRepeatability([], [])).toBeNull();
    expect(estimateRepeatability([900, 910], [1000, 1900])).toBeNull();
    // Mismatched lengths are a caller error, not a zero.
    expect(estimateRepeatability([900, 910], [1000])).toBeNull();
  });

  it('needs at least two comparable windows', () => {
    // One window has nothing to be a spread against.
    const times: number[] = [];
    const intervals: number[] = [];
    for (let i = 0; i < 40; i++) { times.push(i * 900); intervals.push(900); }

    const result = estimateRepeatability(intervals, times, 60);
    expect(result).toBeNull();
    expect(MIN_WINDOWS_FOR_REPEATABILITY).toBe(2);
  });
});
