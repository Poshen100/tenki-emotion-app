/**
 * The test instrument has to be trustworthy before anything it tests is.
 * These check that the generator produces the conditions it claims to.
 */
import { CLEAN_SCAN, PPG_FIXTURES, pulseShape, synthesizePpg } from '../replay';

describe('synthetic PPG generator', () => {
  it('is deterministic for a given seed, and different for another', () => {
    const a = synthesizePpg({ durationSec: 20 });
    const b = synthesizePpg({ durationSec: 20 });
    const c = synthesizePpg({ durationSec: 20, seed: CLEAN_SCAN.seed + 1 });

    expect(a.frames.map((f) => f.red)).toEqual(b.frames.map((f) => f.red));
    expect(a.frames.map((f) => f.red)).not.toEqual(c.frames.map((f) => f.red));
  });

  it('reports the beat intervals it actually generated, not the ones requested', () => {
    const { truth } = synthesizePpg({ bpm: 68, durationSec: 60 });

    // Realised mean lands near the request, but RSA and jitter move it — which
    // is exactly why the tests compare against `truth` and not against 68.
    expect(truth.meanBpm).toBeGreaterThan(64);
    expect(truth.meanBpm).toBeLessThan(72);
    expect(truth.rmssdMs).toBeGreaterThan(0);
    expect(truth.intervalsMs.length).toBeGreaterThan(50);
  });

  it('puts the systolic peak before the dicrotic bump, and makes it taller', () => {
    // A detector seeded with the wrong refractory window locks onto the second
    // bump and doubles the rate. A sine-wave fixture could never catch that.
    expect(pulseShape(0.18)).toBeGreaterThan(pulseShape(0.45));
    expect(pulseShape(0.45)).toBeGreaterThan(pulseShape(0.75));
  });

  it('produces a pulse that is a small fraction of the DC level', () => {
    const { frames } = synthesizePpg({ durationSec: 20 });
    const reds = frames.map((f) => f.red);
    const dc = reds.reduce((a, b) => a + b, 0) / reds.length;
    const swing = Math.max(...reds) - Math.min(...reds);

    // Real fingertip PPG modulates transmitted light by roughly 1-3%.
    expect(swing / dc).toBeLessThan(0.06);
    expect(swing / dc).toBeGreaterThan(0.005);
  });

  it('builds each fixture into the condition it is named for', () => {
    const motion = synthesizePpg(PPG_FIXTURES.motion);
    const meanMotion = motion.frames.reduce((s, f) => s + f.motion, 0) / motion.frames.length;
    expect(meanMotion).toBeGreaterThan(0.35);

    const clipped = synthesizePpg(PPG_FIXTURES.clipped);
    expect(clipped.frames.some((f) => f.clippedFraction > 0)).toBe(true);

    const drops = synthesizePpg(PPG_FIXTURES.frameDrops);
    const clean = synthesizePpg(PPG_FIXTURES.clean);
    expect(drops.frames.length).toBeLessThan(clean.frames.length * 0.8);

    const short = synthesizePpg(PPG_FIXTURES.tooShort);
    expect(short.frames.length / 30).toBeLessThan(15);

    const poor = synthesizePpg(PPG_FIXTURES.poorCoverage);
    const meanCoverage = poor.frames.reduce((s, f) => s + f.coverage, 0) / poor.frames.length;
    expect(meanCoverage).toBeLessThan(0.7);
  });

  it('makes the low-perfusion fixture a genuinely weaker pulse, not just noisier', () => {
    const weak = synthesizePpg(PPG_FIXTURES.lowPerfusion);
    const strong = synthesizePpg(PPG_FIXTURES.clean);

    const swing = (fs: { red: number }[]): number =>
      Math.max(...fs.map((f) => f.red)) - Math.min(...fs.map((f) => f.red));

    expect(swing(weak.frames)).toBeLessThan(swing(strong.frames) / 2);
  });
});
