/**
 * `stabiliseGain` — a measured candidate that is deliberately NOT wired in.
 *
 * 🔴 Read this before wiring it into `channels.ts` or `live.ts`. The function
 * exists because auto-exposure re-deciding the sensor gain mid-capture is the
 * leading suspect for the device's "strong blood signal, zero rhythm" pair
 * (`docs/PHONE-PPG.md` §19). It was wired in once, measured, and reverted:
 * the benefit is real on synthetic gain steps but **unverified on the real
 * device**, and the case the device most likely has — a slow, large plateau —
 * provably is not rescued by it. See §20 for the decision and its condition.
 *
 * These tests exist so the numbers in that decision are re-run rather than
 * remembered. A comment claiming "0.11 → 0.48" that nothing checks is exactly
 * the decorative assertion this repo keeps catching itself writing.
 */
import { synthesizePpg } from '../replay';
import {
  GAIN_WINDOW_SEC,
  PPG_RESAMPLE_HZ,
  bandPass,
  median,
  perfusionIndex,
  resampleUniform,
  stabiliseGain,
} from '../filtering';
import { MIN_PERIODICITY, estimateRate } from '../pulse';
import type { PpgFrame } from '../types';

const DURATION_SEC = 60;

/**
 * What a camera gain change actually does: it multiplies every channel of a
 * frame by the same factor. Not additive, not band-limited — which is why a
 * band-pass cannot remove it and its step edges land in the cardiac band.
 */
function applyGainSteps(frames: readonly PpgFrame[], amplitude: number, periodSec: number) {
  const t0 = frames[0].timestampMs;
  return frames.map((f) => {
    const step = Math.floor((f.timestampMs - t0) / 1000 / periodSec);
    const k = 1 + (step % 2 === 0 ? amplitude : -amplitude);
    return { ...f, red: f.red * k, green: f.green * k, blue: f.blue * k };
  });
}

function resample(frames: readonly PpgFrame[]) {
  const out = resampleUniform(
    frames.map((f) => f.timestampMs),
    frames.map((f) => f.red),
    PPG_RESAMPLE_HZ,
  );
  if (out === null) throw new Error('fixture failed to resample');
  return out;
}

/** Periodicity and perfusion as the pipeline would compute them. */
function measure(values: readonly number[], sampleRateHz: number) {
  const cardiac = bandPass(values, sampleRateHz);
  return {
    periodicity: estimateRate(cardiac, sampleRateHz)?.periodicity ?? 0,
    perfusion: perfusionIndex(values, cardiac),
  };
}

function beforeAndAfter(frames: readonly PpgFrame[]) {
  const r = resample(frames);
  return {
    before: measure(r.values, r.sampleRateHz),
    after: measure(stabiliseGain(r.values, r.sampleRateHz), r.sampleRateHz),
  };
}

describe('the correction is an identity, not a heuristic', () => {
  it('produces the same shape from a capture a slow gain has multiplied', () => {
    // 🔴 The claim the whole function rests on: if the camera applies k(t) and
    // k varies slower than a heartbeat, then x / avg(x) ≈ 1 + p(t) and k
    // cancels. If that is true, stabilising a gained capture and stabilising
    // the original must land on the same series.
    const scan = synthesizePpg({ durationSec: DURATION_SEC });
    const timestamps = scan.frames.map((f) => f.timestampMs);
    const t0 = timestamps[0];
    const plain = scan.frames.map((f) => f.red);
    const gained = scan.frames.map(
      (f) => f.red * (1 + 0.3 * Math.sin((2 * Math.PI * (f.timestampMs - t0)) / 20_000)),
    );

    const a = resampleUniform(timestamps, plain, PPG_RESAMPLE_HZ);
    const b = resampleUniform(timestamps, gained, PPG_RESAMPLE_HZ);
    if (a === null || b === null) throw new Error('fixture failed to resample');

    const sa = stabiliseGain(a.values, a.sampleRateHz);
    const sb = stabiliseGain(b.values, b.sampleRateHz);
    const la = median(sa);
    const lb = median(sb);

    // Skip one window at each end: a centred average has less to average over
    // there, so the edges are the one place the identity is approximate.
    const edge = Math.floor(GAIN_WINDOW_SEC * a.sampleRateHz);
    let worstStabilised = 0;
    let worstRaw = 0;
    const ra = median(a.values);
    const rb = median(b.values);
    for (let i = edge; i < sa.length - edge; i++) {
      worstStabilised = Math.max(worstStabilised, Math.abs(sa[i] / la - sb[i] / lb));
      worstRaw = Math.max(worstRaw, Math.abs(a.values[i] / ra - b.values[i] / rb));
    }

    // Measured: the gain moves the two series 30.8% of the level apart, and
    // after the correction the worst disagreement is 0.35% — two orders of
    // magnitude. The bar is set loosely around the measurement, because what
    // is under test is the order of magnitude, not the third digit.
    expect(worstRaw).toBeGreaterThan(0.2);
    expect(worstStabilised).toBeLessThan(0.01);
    expect(worstStabilised * 20).toBeLessThan(worstRaw);
  });

  it('gives the series back in its original units', () => {
    // Everything downstream — perfusion, the quality components, MIN_PERFUSION
    // itself — is expressed against the signal's own level. A correction that
    // renormalised the series would silently re-scale all of them.
    const r = resample(synthesizePpg({ durationSec: DURATION_SEC }).frames);
    const level = median(r.values);
    expect(median(stabiliseGain(r.values, r.sampleRateHz))).toBeCloseTo(level, 0);
  });

  it('leaves a capture it cannot average over untouched', () => {
    // Shorter than two windows: there is nothing to estimate a local level
    // from, so the honest output is the input.
    const short = Array.from({ length: 40 }, (_, i) => 100 + i);
    expect(stabiliseGain(short, PPG_RESAMPLE_HZ)).toEqual(short);
    expect(stabiliseGain([], PPG_RESAMPLE_HZ)).toEqual([]);
  });

  it('leaves a signal with no level to divide by untouched', () => {
    // ⚠️ A ratio needs a positive level. Hand it something already centred on
    // zero — a band-passed series, say — and the local average crosses zero
    // throughout, so x/avg is meaningless and its sign flips at every crossing.
    // The honest output is the input.
    const centred = Array.from({ length: PPG_RESAMPLE_HZ * 10 }, (_, i) =>
      Math.sin((2 * Math.PI * i) / PPG_RESAMPLE_HZ) - 0.01,
    );
    expect(stabiliseGain(centred, PPG_RESAMPLE_HZ)).toEqual(centred);
    expect(stabiliseGain(new Array<number>(PPG_RESAMPLE_HZ * 10).fill(0), PPG_RESAMPLE_HZ)).toEqual(
      new Array<number>(PPG_RESAMPLE_HZ * 10).fill(0),
    );
  });
});

describe('what it does and does not rescue', () => {
  it('does not cost a clean capture anything', () => {
    // Measured: periodicity 0.935 → 0.955, perfusion 0.0062 → 0.0069.
    const { before, after } = beforeAndAfter(synthesizePpg({ durationSec: DURATION_SEC }).frames);
    expect(before.periodicity).toBeGreaterThan(MIN_PERIODICITY);
    expect(after.periodicity).toBeGreaterThanOrEqual(before.periodicity);
    expect(after.perfusion).toBeCloseTo(before.perfusion, 2);
  });

  it('rescues fast gain hunting: a refused capture becomes a readable one', () => {
    // ±35% every 1.4 s — a camera re-deciding its exposure roughly once per
    // beat. Measured: periodicity 0.111 → 0.483, across MIN_PERIODICITY (0.35).
    // This is the entire case for the function.
    const stepped = applyGainSteps(
      synthesizePpg({ durationSec: DURATION_SEC }).frames,
      0.35,
      1.4,
    );
    const { before, after } = beforeAndAfter(stepped);
    expect(before.periodicity).toBeLessThan(MIN_PERIODICITY);
    expect(after.periodicity).toBeGreaterThan(MIN_PERIODICITY);
  });

  it('does NOT rescue a slow gain plateau, and the capture stays refused', () => {
    // 🔴 The honest limit, and the reason this is not wired in. ±20% every
    // 3.0 s: over three seconds a 1.5 s averaging window cannot tell the
    // plateau from the signal. Measured: periodicity 0.000 → 0.104 — better,
    // and still nowhere near the gate.
    //
    // ⚠️ The fix this case needs is locking the exposure, not filtering it
    // out. Shipping the correction as if it covered this case would hide a
    // capture failure behind a slightly-less-zero number.
    const stepped = applyGainSteps(synthesizePpg({ durationSec: DURATION_SEC }).frames, 0.2, 3.0);
    const { before, after } = beforeAndAfter(stepped);
    expect(before.periodicity).toBeLessThan(MIN_PERIODICITY);
    expect(after.periodicity).toBeLessThan(MIN_PERIODICITY);
  });

  it('leaves gain hunting at heart-rate frequency refused, before and after', () => {
    // 🔴 The row that should temper any enthusiasm for this function. ±50%
    // every 0.8 s is a 1.25 Hz oscillation — inside the cardiac band, at a
    // plausible pulse rate. The correction cannot touch it, because at that
    // speed the gain is no longer "slower than a beat": it *is* a beat.
    //
    // ⚠️ This test used to assert something worse and truer of the old
    // pipeline: the capture read as **periodic (0.708)** and yielded a
    // confident **40 bpm** against a truth near 69. That 40 was
    // `MIN_PLAUSIBLE_BPM` — the wall of the autocorrelation search, not a
    // measurement. `dominantPeriod` now refuses a boundary lag
    // (`rate-bounds.test.ts`), so both sides of this comparison are honest
    // refusals. The claim under test is that stabilising does not turn one
    // back into a reading.
    const scan = synthesizePpg({ durationSec: DURATION_SEC });
    const stepped = applyGainSteps(scan.frames, 0.5, 0.8);
    const r = resample(stepped);
    const before = estimateRate(bandPass(r.values, r.sampleRateHz), r.sampleRateHz);
    const after = estimateRate(
      bandPass(stabiliseGain(r.values, r.sampleRateHz), r.sampleRateHz),
      r.sampleRateHz,
    );
    expect(before).toBeNull();
    expect(after).toBeNull();
  });

  it('does not make the interference look less like a strong pulse', () => {
    // ⚠️ Gain steps read as an enormous AC/DC — 0.148 against a clean
    // capture's 0.006, twenty times over — and the correction barely moves it
    // (0.148 → 0.141). So `strong_pulse` still fires on a capture that has no
    // usable rhythm in it, both before and after.
    //
    // 🔴 That is the founder-visible screen contradiction from device run 2
    // (「✓ 血流訊號強」 beside 「找不到穩定的脈搏節律」), and this function
    // does not fix it. Perfusion was never the discriminator; rhythm is.
    const clean = beforeAndAfter(synthesizePpg({ durationSec: DURATION_SEC }).frames);
    const stepped = beforeAndAfter(
      applyGainSteps(synthesizePpg({ durationSec: DURATION_SEC }).frames, 0.35, 1.4),
    );
    expect(stepped.before.perfusion).toBeGreaterThan(clean.before.perfusion * 10);
    expect(stepped.after.perfusion).toBeGreaterThan(clean.after.perfusion * 10);
  });
});

describe('the window is bounded by physiology at both ends', () => {
  it('is at least one resting beat period long', () => {
    // Shorter than a beat and the average starts absorbing the pulse it exists
    // to preserve. 40 bpm is the bottom of the resting range: a 1.5 s period.
    expect(GAIN_WINDOW_SEC).toBeGreaterThanOrEqual(60 / 40);
  });

  it('is short enough to still separate gain from signal', () => {
    // The 3.0 s plateau case above is what sets the upper bound: by then the
    // window cannot tell them apart any more.
    expect(GAIN_WINDOW_SEC).toBeLessThan(3);
  });
});
