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
