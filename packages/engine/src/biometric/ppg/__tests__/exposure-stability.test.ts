/**
 * Is the camera holding still, or re-deciding its own exposure?
 *
 * 🔴 The claim under test: a clean cardiac capture and an exposure-hunting
 * capture are told apart by slow DC movement, NOT by perfusion — because the
 * real device produced `strong_pulse` and zero periodicity together, which is
 * what sent me looking for this measurement in the first place.
 */
import {
  DC_DRIFT_SUSPECT,
  DRIFT_PERIOD_MAX_SEC,
  DRIFT_PERIOD_TRUSTWORTHY_SEC,
  MIN_EXPOSURE_FRAMES,
  assessExposureStability,
} from '../exposure-stability';
import { perfusionIndex, bandPass, resampleUniform, PPG_RESAMPLE_HZ } from '../filtering';
import { estimateRate } from '../pulse';
import { synthesizePpg } from '../replay';
import type { PpgFrame } from '../types';

const FPS = 30;

/**
 * A capture whose DC level is moved by `steps` — the shape auto-exposure makes:
 * flat for a while, then a jump, with the cardiac ripple riding on top.
 */
function withExposureSteps(
  durationSec: number,
  stepFraction: number,
  everySec: number,
): PpgFrame[] {
  const base = synthesizePpg({ durationSec }).frames;
  const t0 = base[0].timestampMs;
  return base.map((frame) => {
    const sec = (frame.timestampMs - t0) / 1000;
    // Alternating steps, so the level moves up and down rather than ramping —
    // a ramp would be removed by the band-pass, a step would not.
    const step = Math.floor(sec / everySec) % 2 === 0 ? 0 : stepFraction;
    return { ...frame, red: frame.red * (1 + step), green: frame.green * (1 + step) };
  });
}

describe('a steady camera and a hunting one are distinguishable', () => {
  it('reads a clean capture as steady, with drift far below the pulse', () => {
    const stability = assessExposureStability(synthesizePpg({ durationSec: 30 }).frames);
    expect(stability).not.toBeNull();
    if (stability === null) return;
    expect(stability.slowDriftDominates).toBe(false);
    // 🔴 The number that makes the threshold meaningful: a real pulse moves the
    // one-second means by well under a percent.
    expect(stability.dcDriftFraction).toBeLessThan(DC_DRIFT_SUSPECT / 2);
    expect(stability.framesPerSecond).toBeGreaterThan(FPS * 0.8);
  });

  it('flags a capture whose level is being re-decided', () => {
    const stability = assessExposureStability(withExposureSteps(30, 0.2, 3));
    expect(stability).not.toBeNull();
    if (stability === null) return;
    expect(stability.slowDriftDominates).toBe(true);
    expect(stability.dcDriftFraction).toBeGreaterThan(DC_DRIFT_SUSPECT);
    expect(stability.largestStepFraction).toBeGreaterThan(DC_DRIFT_SUSPECT);
  });

  it('🔴 catches what perfusion cannot: strong in-band energy, no rhythm', () => {
    // This is the real-device signature. Exposure steps put large energy in the
    // cardiac band, so perfusion looks healthy while periodicity collapses —
    // exactly `strong_pulse` + `irregular_periodicity` on one screen.
    const hunting = withExposureSteps(30, 0.35, 1.4);
    const resampled = resampleUniform(
      hunting.map((f) => f.timestampMs),
      hunting.map((f) => f.red),
      PPG_RESAMPLE_HZ,
    );
    expect(resampled).not.toBeNull();
    if (resampled === null) return;
    const cardiac = bandPass(resampled.values, resampled.sampleRateHz);

    const perfusion = perfusionIndex(resampled.values, cardiac);
    const periodicity = estimateRate(cardiac, resampled.sampleRateHz)?.periodicity ?? 0;
    const clean = synthesizePpg({ durationSec: 30 }).frames;
    const cleanResampled = resampleUniform(
      clean.map((f) => f.timestampMs),
      clean.map((f) => f.red),
      PPG_RESAMPLE_HZ,
    );
    expect(cleanResampled).not.toBeNull();
    if (cleanResampled === null) return;
    const cleanPeriodicity =
      estimateRate(bandPass(cleanResampled.values, cleanResampled.sampleRateHz), cleanResampled.sampleRateHz)
        ?.periodicity ?? 0;

    // Perfusion does not separate them — it goes UP with the interference.
    expect(perfusion).toBeGreaterThan(
      perfusionIndex(cleanResampled.values, bandPass(cleanResampled.values, cleanResampled.sampleRateHz)),
    );
    // Rhythm collapses.
    expect(periodicity).toBeLessThan(cleanPeriodicity);
    // And the exposure measurement is the one that says why.
    expect(assessExposureStability(hunting)?.slowDriftDominates).toBe(true);
  });
});

describe('it refuses to guess', () => {
  it('returns null rather than "steady" when there are too few frames', () => {
    // 🔴 Null is not a verdict of steady. A surface that treated it as one
    // would report a calm camera for every capture's first half-second.
    const few = synthesizePpg({ durationSec: 30 }).frames.slice(0, MIN_EXPOSURE_FRAMES - 1);
    expect(assessExposureStability(few)).toBeNull();
    expect(assessExposureStability([])).toBeNull();
  });

  it('follows the channel it was asked about', () => {
    // The pulse is not always in red (`channels.ts`), so the drift that matters
    // is the drift in the channel the reading came from.
    const frames = synthesizePpg({ durationSec: 20 }).frames;
    const red = assessExposureStability(frames, 'red');
    const green = assessExposureStability(frames, 'green');
    expect(red?.dcMedian).not.toBe(green?.dcMedian);
  });

  it('reports the timebase too, so a stuttering feed is not mistaken for drift', () => {
    const frames = synthesizePpg({ durationSec: 20, dropFraction: 0.3, seed: 77 }).frames;
    const stability = assessExposureStability(frames);
    expect(stability).not.toBeNull();
    if (stability === null) return;
    expect(stability.framesPerSecond).toBeLessThan(FPS * 0.9);
    expect(stability.longestGapMs).toBeGreaterThan(1000 / FPS);
  });
});

/**
 * A camera hunting its own gain continuously: a smooth multiplicative drift.
 *
 * ⚠️ Separate from `withExposureSteps` on purpose. A square step has broadband
 * harmonics in the cardiac band; a smooth drift puts its energy below the band
 * and is the shape the device's own numbers point at.
 */
function withSmoothDrift(durationSec: number, amplitude: number, periodSec: number): PpgFrame[] {
  const base = synthesizePpg({ durationSec, sampleRateHz: 60 }).frames;
  const t0 = base[0].timestampMs;
  return base.map((frame) => {
    const k =
      1 + amplitude * Math.sin((2 * Math.PI * (frame.timestampMs - t0)) / 1000 / periodSec);
    return { ...frame, red: frame.red * k, green: frame.green * k };
  });
}

describe('how fast the drift is, not just how big', () => {
  it('names the period of a smooth drift', () => {
    // 🔴 The number the whole exposure decision turns on, and the reason it was
    // added: whether the drift is slower than a heartbeat decides whether it
    // can be divided out at all. Before this, the shape had to be inferred
    // from the ratio between the two magnitudes, which is arithmetic on a
    // guess, not a measurement.
    const stability = assessExposureStability(withSmoothDrift(60, 0.155, 5), 'red');
    expect(stability).not.toBeNull();
    if (stability === null) return;
    expect(stability.driftPeriodSec).not.toBeNull();
    expect(stability.driftPeriodSec as number).toBeGreaterThan(4.5);
    expect(stability.driftPeriodSec as number).toBeLessThan(5.8);
  });

  it('reports the full cycle of an alternating step, not the half', () => {
    // A gain that alternates every 3 s has a 6 s cycle, and 6 s is the period
    // that matters when comparing against a beat.
    const stability = assessExposureStability(withExposureSteps(60, 0.2, 3), 'red');
    expect(stability).not.toBeNull();
    if (stability === null) return;
    expect(stability.driftPeriodSec as number).toBeGreaterThan(5);
    expect(stability.driftPeriodSec as number).toBeLessThan(7);
  });

  it('🔴 reads a fast drift as slower than it is — the one failure to remember', () => {
    // A true 1.4 s oscillation comes back near 3.6 s, because one-second
    // buckets fold it. The error runs toward "slow", which is the direction
    // that would wrongly license dividing the drift out.
    //
    // ⚠️ This test exists to pin the failure, not to celebrate a pass. The
    // defence is `DRIFT_PERIOD_TRUSTWORTHY_SEC`: the reported value stays
    // below it, so a caller obeying that bound is not misled.
    const stability = assessExposureStability(withSmoothDrift(60, 0.2, 1.4), 'red');
    expect(stability).not.toBeNull();
    if (stability === null) return;
    const period = stability.driftPeriodSec as number;
    expect(period).toBeGreaterThan(1.4 * 2);
    expect(period).toBeLessThan(DRIFT_PERIOD_TRUSTWORTHY_SEC);
  });

  it('does not call respiratory baseline wander an exposure problem', () => {
    // 🔴 A clean capture reports a period around 4.4 s, and that is real: it is
    // breathing moving the baseline. The period alone cannot tell it from a
    // camera, and it is not supposed to — **size** is what separates them, and
    // that is why `dcDriftFraction` carries the verdict and the period only
    // describes the shape.
    const clean = assessExposureStability(synthesizePpg({ durationSec: 60 }).frames, 'red');
    expect(clean).not.toBeNull();
    if (clean === null) return;
    expect(clean.driftPeriodSec).not.toBeNull();
    expect(clean.dcDriftFraction).toBeLessThan(DC_DRIFT_SUSPECT);
    expect(clean.slowDriftDominates).toBe(false);
  });

  it('says nothing about a ramp, which is drift without a period', () => {
    // 🔴 A camera that walks its gain one way and stays there is drifting, but
    // it is not oscillating. ⚠️ It still crosses its own mean once in the
    // middle, and respiratory wander adds one or two more — measured, that came
    // out as a confident **19.3 s** period for something with no period at all,
    // which is why `MIN_DRIFT_CROSSINGS` demands two full cycles.
    const base = synthesizePpg({ durationSec: 30 }).frames;
    const t0 = base[0].timestampMs;
    const ramped = base.map((f) => {
      const progress = (f.timestampMs - t0) / 1000 / 30;
      return { ...f, red: f.red * (1 + 0.3 * progress) };
    });
    const stability = assessExposureStability(ramped, 'red');
    expect(stability).not.toBeNull();
    if (stability === null) return;
    // The drift is real and large — it is the *period* that is unavailable.
    expect(stability.dcDriftFraction).toBeGreaterThan(DC_DRIFT_SUSPECT);
    expect(stability.driftPeriodSec).toBeNull();
  });

  it('never reports a period longer than the window can support', () => {
    const stability = assessExposureStability(withSmoothDrift(60, 0.2, 40), 'red');
    expect(stability).not.toBeNull();
    if (stability === null) return;
    if (stability.driftPeriodSec !== null) {
      expect(stability.driftPeriodSec).toBeLessThanOrEqual(DRIFT_PERIOD_MAX_SEC);
    }
  });
});
