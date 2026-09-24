/**
 * Reading a pulse out of a capture the camera kept interrupting.
 *
 * 🔴 The claim under test is narrow and the dangerous direction is obvious:
 * this module exists to turn some refusals into readings, so every test that
 * matters here is one where it must **not**. A short window is easier to look
 * periodic by chance than a long one, so "it found a rate" is not evidence —
 * agreement between independent stretches is.
 */
import { PPG_FIXTURES, synthesizePpg } from '../replay';
import { PPG_RESAMPLE_HZ, bandPass, resampleUniform } from '../filtering';
import { estimateRate } from '../pulse';
import {
  MAX_SEGMENT_SPREAD_BPM,
  MIN_AGREEING_SEGMENTS,
  MIN_QUIET_SEGMENT_SEC,
  QUIET_SLEW_PER_SEC,
  estimateRateFromQuietSegments,
  findQuietSegments,
} from '../quiet-segments';
import type { PpgFrame } from '../types';

const DURATION_SEC = 60;

/**
 * Hold a level, move to a new one over `rampSec`, hold again.
 *
 * ⚠️ These defaults are not decorative: at amplitude 0.16, a 17 s cycle and a
 * 0.5 s transition, `assessExposureStability` reports drift 0.2922, largest
 * one-second step 0.2150 and a ratio of 0.74 — against the device's own
 * 0.2944 / 0.2201 / 0.75. This fixture IS the device's signature.
 */
function rampHold(
  frames: readonly PpgFrame[],
  amplitude = 0.16,
  cycleSec = 17,
  rampSec = 0.5,
): PpgFrame[] {
  const t0 = frames[0].timestampMs;
  return frames.map((f) => {
    const phase = (((f.timestampMs - t0) / 1000) % cycleSec) / cycleSec;
    const r = rampSec / cycleSec;
    let level: number;
    if (phase < r) level = -1 + (2 * phase) / r;
    else if (phase < 0.5) level = 1;
    else if (phase < 0.5 + r) level = 1 - (2 * (phase - 0.5)) / r;
    else level = -1;
    const k = 1 + amplitude * level;
    return { ...f, red: f.red * k, green: f.green * k, blue: f.blue * k };
  });
}

function grid(frames: readonly PpgFrame[]) {
  const r = resampleUniform(
    frames.map((f) => f.timestampMs),
    frames.map((f) => f.red),
    PPG_RESAMPLE_HZ,
  );
  if (r === null) throw new Error('fixture failed to resample');
  return r;
}

/** What the pipeline gets today: one estimate over the whole capture. */
function wholeCaptureRate(frames: readonly PpgFrame[]) {
  const r = grid(frames);
  return estimateRate(bandPass(r.values, r.sampleRateHz), r.sampleRateHz);
}

/** The assessment, including the counts behind a refusal. */
function assess(frames: readonly PpgFrame[]) {
  const r = grid(frames);
  return estimateRateFromQuietSegments(r.values, r.sampleRateHz);
}

/** Just the rate, or null — what the pipeline actually acts on. */
function segmentedRate(frames: readonly PpgFrame[]) {
  const got = assess(frames);
  return got.bpm === null ? null : got;
}

describe('the device-shaped capture', () => {
  it('is refused as one block and recovered from its plateaus', () => {
    // 🔴 The whole reason this module exists, in one assertion pair.
    const scan = synthesizePpg({ durationSec: DURATION_SEC, sampleRateHz: 60 });
    const drifted = rampHold(scan.frames);

    expect(wholeCaptureRate(drifted)).toBeNull();

    const recovered = segmentedRate(drifted);
    expect(recovered).not.toBeNull();
    if (recovered === null) return;
    expect(Math.abs((recovered.bpm as number) - scan.truth.meanBpm)).toBeLessThan(3);
    expect(recovered.periodicCount).toBeGreaterThanOrEqual(MIN_AGREEING_SEGMENTS);
    expect(recovered.spreadBpm as number).toBeLessThanOrEqual(MAX_SEGMENT_SPREAD_BPM);
  });

  it('reports how much of the capture it actually used', () => {
    // The evidence is weaker than a whole capture and the number has to say so,
    // rather than the surface implying sixty seconds of it.
    const recovered = segmentedRate(
      rampHold(synthesizePpg({ durationSec: DURATION_SEC, sampleRateHz: 60 }).frames),
    );
    expect(recovered).not.toBeNull();
    if (recovered === null) return;
    expect(recovered.analysedSec).toBeGreaterThan(MIN_QUIET_SEGMENT_SEC);
    expect(recovered.analysedSec).toBeLessThan(DURATION_SEC);
  });
});

describe('🔴 it must not manufacture a pulse', () => {
  it('finds nothing in a capture with no pulse in it, drift or no drift', () => {
    // 🔴 The decisive test. A fingertip that is not there, put through exactly
    // the drift that makes the real capture unreadable: the transitions chop it
    // into plenty of segments, and none of them agree on anything.
    const noise = synthesizePpg({
      durationSec: DURATION_SEC,
      sampleRateHz: 60,
      perfusion: 0,
      noiseSd: 1.2,
    });
    expect(segmentedRate(noise.frames)).toBeNull();
    const drifted = rampHold(noise.frames);
    // It really is being cut into candidate segments — the refusal is not
    // "there was nothing to look at".
    expect(findQuietSegments(grid(drifted).values, PPG_RESAMPLE_HZ).length).toBeGreaterThanOrEqual(
      MIN_AGREEING_SEGMENTS,
    );
    expect(segmentedRate(drifted)).toBeNull();
  });

  it('finds nothing on a barely-perfused fingertip', () => {
    const weak = synthesizePpg({
      durationSec: DURATION_SEC,
      sampleRateHz: 60,
      ...PPG_FIXTURES.lowPerfusion,
    });
    expect(segmentedRate(weak.frames)).toBeNull();
  });

  it('refuses when the stretches disagree, even though each one is periodic', () => {
    // 🔴 Agreement is the whole safeguard, so it needs a test where the
    // segments individually pass and the spread is what refuses. Built by
    // stitching three captures at genuinely different rates.
    // ⚠️ Each part also sits at its own level, or there is nothing for the
    // segmenter to cut at and the whole thing stays one stretch — which is
    // what the first version of this fixture did, and it passed for the wrong
    // reason.
    const parts = [48, 76, 104].map((bpm, i) => ({
      scan: synthesizePpg({ durationSec: 24, sampleRateHz: 60, bpm, seed: bpm }),
      gain: 1 + 0.16 * (i % 2 === 0 ? 1 : -1),
    }));
    let t = 0;
    const stitched: PpgFrame[] = [];
    for (const { scan: part, gain } of parts) {
      const t0 = part.frames[0].timestampMs;
      for (const f of part.frames) {
        stitched.push({ ...f, timestampMs: t + (f.timestampMs - t0), red: f.red * gain });
      }
      t += 24_000;
    }
    const segments = findQuietSegments(grid(stitched).values, PPG_RESAMPLE_HZ);
    expect(segments.length).toBeGreaterThanOrEqual(MIN_AGREEING_SEGMENTS);
    expect(segmentedRate(stitched)).toBeNull();
  });

  it('refuses two agreeing stretches, because two agreeing is a coincidence', () => {
    // 🔴 A single level jump in the middle of an otherwise perfect capture:
    // exactly two quiet stretches, each long, each periodic, both landing on
    // the same rate. It must still come back null.
    //
    // ⚠️ The first version of this test used a short drifting capture and
    // asserted conditionally — so it passed whether the bar was 2 or 3, which
    // made the constant it was supposed to be guarding unobservable.
    const scan = synthesizePpg({ durationSec: 60, sampleRateHz: 60 });
    const t0 = scan.frames[0].timestampMs;
    const oneJump = scan.frames.map((f) => {
      const k = (f.timestampMs - t0) / 1000 < 30 ? 1 : 1.16;
      return { ...f, red: f.red * k, green: f.green * k, blue: f.blue * k };
    });
    const segments = findQuietSegments(grid(oneJump).values, PPG_RESAMPLE_HZ);
    expect(segments).toHaveLength(2);
    expect(segmentedRate(oneJump)).toBeNull();
  });
});

describe('finding the quiet stretches', () => {
  it('leaves a clean capture in one piece', () => {
    // No transitions means nothing to cut at: the whole capture is one quiet
    // stretch, and this module changes nothing about it.
    const r = grid(synthesizePpg({ durationSec: DURATION_SEC, sampleRateHz: 60 }).frames);
    const segments = findQuietSegments(r.values, r.sampleRateHz);
    expect(segments).toHaveLength(1);
    expect(segments[0].values.length / r.sampleRateHz).toBeGreaterThan(DURATION_SEC * 0.9);
  });

  it('does not mistake the pulse itself for the camera moving', () => {
    // 🔴 The failure that makes the whole module useless: take the slope
    // without smoothing over a beat and every upstroke reads as a transition,
    // so a perfect capture shatters into fragments. A resting pulse must leave
    // the level "quiet" by this measure.
    const r = grid(synthesizePpg({ durationSec: DURATION_SEC, sampleRateHz: 60, bpm: 96 }).frames);
    expect(findQuietSegments(r.values, r.sampleRateHz)).toHaveLength(1);
  });

  it('cuts where the level is moving faster than a pulse could move it', () => {
    const r = grid(rampHold(synthesizePpg({ durationSec: DURATION_SEC, sampleRateHz: 60 }).frames));
    const segments = findQuietSegments(r.values, r.sampleRateHz);
    expect(segments.length).toBeGreaterThanOrEqual(MIN_AGREEING_SEGMENTS);
    // Every stretch clears the minimum, and none of them spans a transition.
    for (const segment of segments) {
      expect(segment.values.length / r.sampleRateHz).toBeGreaterThanOrEqual(MIN_QUIET_SEGMENT_SEC);
    }
  });

  it('says nothing rather than guessing on a signal with no level', () => {
    expect(findQuietSegments([], PPG_RESAMPLE_HZ)).toHaveLength(0);
    expect(findQuietSegments(new Array<number>(600).fill(0), PPG_RESAMPLE_HZ)).toHaveLength(0);
  });

  it('keeps the slew bar inside the measured gap, on both sides', () => {
    // 🔴 Taken from the gap between two distributions, not from an argument.
    // A still finger — pulse and breathing together — never exceeded 0.023;
    // the device-shaped transitions run 0.10 and up. The bar has to clear the
    // first and stay under the second, and both halves matter: too low and a
    // clean capture shatters (it did, at 0.02), too high and the transitions
    // it exists to find are inside the segments.
    expect(QUIET_SLEW_PER_SEC).toBeGreaterThan(0.023);
    expect(QUIET_SLEW_PER_SEC).toBeLessThan(0.10);
  });
});

describe('🔴 a refusal has to say which refusal it was', () => {
  // Three different causes, three different repairs — and without the counts
  // the device can only say no, which costs another day per round.
  it('too few stretches: says how many it found and how long the best one was', () => {
    // A clean capture is one long stretch, so it can never reach three.
    const got = assess(synthesizePpg({ durationSec: 60, sampleRateHz: 60 }).frames);
    expect(got.bpm).toBeNull();
    expect(got.foundCount).toBeLessThan(MIN_AGREEING_SEGMENTS);
    expect(got.longestSec).toBeGreaterThan(MIN_QUIET_SEGMENT_SEC);
  });

  it('stretches found but not periodic: separates the two counts', () => {
    // 🔴 The case the device was probably hitting. Plenty of stretches, none of
    // them carrying a usable pulse — which is a completely different problem
    // from not finding stretches at all.
    const noise = synthesizePpg({
      durationSec: 60,
      sampleRateHz: 60,
      perfusion: 0,
      noiseSd: 1.2,
    });
    const got = assess(rampHold(noise.frames));
    expect(got.bpm).toBeNull();
    expect(got.foundCount).toBeGreaterThanOrEqual(MIN_AGREEING_SEGMENTS);
    expect(got.periodicCount).toBe(0);
  });

  it('reports the actual periodic count when it is short, not just "fewer than three"', () => {
    // 🔴 The refusal that needs a NUMBER. One jump in an otherwise clean
    // capture gives exactly two usable stretches — and "two" is a completely
    // different message from "none": two means the pulse is there and the
    // capture was simply not interrupted often enough to prove it.
    //
    // ⚠️ The first version of this asserted only `< MIN_AGREEING_SEGMENTS`,
    // which the default of 0 satisfies — so dropping the count from the refusal
    // broke nothing. Asserting the value is what makes it observable.
    const scan = synthesizePpg({ durationSec: 60, sampleRateHz: 60 });
    const t0 = scan.frames[0].timestampMs;
    const oneJump = scan.frames.map((f) => {
      const k = (f.timestampMs - t0) / 1000 < 30 ? 1 : 1.16;
      return { ...f, red: f.red * k, green: f.green * k, blue: f.blue * k };
    });
    const got = assess(oneJump);
    expect(got.bpm).toBeNull();
    expect(got.foundCount).toBe(2);
    expect(got.periodicCount).toBe(2);
    expect(got.analysedSec).toBeGreaterThan(0);
  });

  it('stretches disagreed: reports the spread that refused them', () => {
    const parts = [48, 76, 104].map((bpm, i) => ({
      scan: synthesizePpg({ durationSec: 24, sampleRateHz: 60, bpm, seed: bpm }),
      gain: 1 + 0.16 * (i % 2 === 0 ? 1 : -1),
    }));
    let t = 0;
    const stitched: PpgFrame[] = [];
    for (const { scan: part, gain } of parts) {
      const t0 = part.frames[0].timestampMs;
      for (const f of part.frames) {
        stitched.push({ ...f, timestampMs: t + (f.timestampMs - t0), red: f.red * gain });
      }
      t += 24_000;
    }
    const got = assess(stitched);
    expect(got.bpm).toBeNull();
    expect(got.periodicCount).toBeGreaterThanOrEqual(MIN_AGREEING_SEGMENTS);
    expect(got.spreadBpm as number).toBeGreaterThan(MAX_SEGMENT_SPREAD_BPM);
  });
});
