/**
 * The autocorrelation search must not report its own wall as a measurement.
 *
 * 🔴 `dominantPeriod` searches a bounded lag range and returns the argmax. When
 * the series' real dominant component lies **outside** that range — a camera
 * gain drift at 0.2 Hz, say — the argmax has nowhere to go but the boundary,
 * and the correlation there can be high, because slow means smooth and smooth
 * autocorrelates well at every short lag. The caller then gets the edge of the
 * box dressed as a heart rate.
 *
 * ⚠️ This is not hypothetical. It is the shape the device reported on
 * 2026-09-17 (DC drift 28.8% of the level, largest one-second step 17.8%),
 * reproduced here.
 */
import { synthesizePpg } from '../replay';
import { PPG_RESAMPLE_HZ, bandPass, resampleUniform } from '../filtering';
import { MAX_PLAUSIBLE_BPM, MIN_PERIODICITY, MIN_PLAUSIBLE_BPM, estimateRate } from '../pulse';
import { assessExposureStability } from '../exposure-stability';
import type { PpgFrame } from '../types';

const DURATION_SEC = 60;

/**
 * A continuously hunting auto-exposure loop: a smooth multiplicative drift.
 *
 * 🔴 Smooth, not stepped, and that distinction is the whole reason this file
 * exists. A square-wave gain step has broadband harmonics that land in the
 * cardiac band and wreck periodicity, so those captures get refused for an
 * obvious reason. A *smooth* drift puts all its energy below the band, leaves
 * periodicity looking respectable, and is the case that produced a confident
 * wrong number.
 */
function driftingGain(frames: readonly PpgFrame[], amplitude: number, periodSec: number) {
  const t0 = frames[0].timestampMs;
  return frames.map((f) => {
    const k = 1 + amplitude * Math.sin((2 * Math.PI * (f.timestampMs - t0)) / 1000 / periodSec);
    return { ...f, red: f.red * k, green: f.green * k, blue: f.blue * k };
  });
}

function rateOf(frames: readonly PpgFrame[]) {
  const r = resampleUniform(
    frames.map((f) => f.timestampMs),
    frames.map((f) => f.red),
    PPG_RESAMPLE_HZ,
  );
  if (r === null) throw new Error('fixture failed to resample');
  return { rate: estimateRate(bandPass(r.values, r.sampleRateHz), r.sampleRateHz), grid: r };
}

describe('the device-measured exposure drift', () => {
  /**
   * ⚠️ These parameters are not chosen for effect. They are the ones that
   * reproduce the device's own two aggregates, and the ratio between those
   * aggregates is what identifies the shape: `largestStepFraction` /
   * `dcDriftFraction` was **0.62** on the device, which is a smooth drift of
   * roughly a five-second period — a square wave puts that ratio near 1.0,
   * because adjacent one-second buckets jump the whole span.
   */
  const DRIFT_PERIOD_SEC = 5;
  const DRIFT_AMPLITUDE = 0.155;

  it('reproduces the report: drift near 0.29 with a one-second step near 0.18', () => {
    const drifted = driftingGain(
      synthesizePpg({ durationSec: DURATION_SEC, sampleRateHz: 60 }).frames,
      DRIFT_AMPLITUDE,
      DRIFT_PERIOD_SEC,
    );
    const exposure = assessExposureStability(drifted, 'red');
    expect(exposure).not.toBeNull();
    if (exposure === null) return;
    // Device: 0.2879 and 0.1782. Bars are loose around those, because what is
    // under test is that this fixture stands in for the device's signature —
    // not the fourth digit of a synthetic waveform.
    expect(exposure.dcDriftFraction).toBeGreaterThan(0.25);
    expect(exposure.dcDriftFraction).toBeLessThan(0.33);
    expect(exposure.largestStepFraction).toBeGreaterThan(0.15);
    expect(exposure.largestStepFraction).toBeLessThan(0.21);
    expect(exposure.slowDriftDominates).toBe(true);
  });

  it('is refused rather than reported at the wall of the search', () => {
    // 🔴 Measured before the guard: **200 bpm with a periodicity of 0.75**,
    // against a truth of 68. Over every gate in the pipeline, and wrong by
    // 130 bpm. `MIN_PERIODICITY` cannot catch it, because the number it
    // inspects is genuinely high.
    const scan = synthesizePpg({ durationSec: DURATION_SEC, sampleRateHz: 60 });
    const { rate } = rateOf(driftingGain(scan.frames, DRIFT_AMPLITUDE, DRIFT_PERIOD_SEC));
    expect(rate).toBeNull();
  });

  it('refuses it through the octave corrector too, not just the argmax', () => {
    // 🔴 The half-fix that looked like a fix. `preferFundamental` corrects the
    // classic autocorrelation octave error by moving to a **submultiple** — a
    // shorter lag — so it can take a perfectly interior argmax and land the
    // answer on `minLagSamples`. Guarding only the argmax left this capture
    // reporting 200 bpm at periodicity 0.53.
    const scan = synthesizePpg({ durationSec: DURATION_SEC, sampleRateHz: 60 });
    const { rate } = rateOf(driftingGain(scan.frames, 0.14, 5.2));
    expect(rate).toBeNull();
  });
});

describe('what the guard costs', () => {
  it('still reports a rate anywhere inside the searched range', () => {
    // The guard refuses the two boundary lags, so the honest statement of the
    // reportable range is one lag narrower at each end than MIN/MAX_PLAUSIBLE.
    // At 30 Hz that is lag 10..44, i.e. 40.9..180 bpm. Everything in between
    // must still come back — a guard that quietly swallowed the fast end would
    // be worse than the bug.
    for (const bpm of [44, 50, 68, 100, 150, 180]) {
      const scan = synthesizePpg({ durationSec: DURATION_SEC, bpm, sampleRateHz: 60 });
      const { rate } = rateOf(scan.frames);
      expect(rate).not.toBeNull();
      if (rate === null) continue;
      expect(rate.periodicity).toBeGreaterThan(MIN_PERIODICITY);
      // Lag quantisation is coarse at the fast end (lag 10, 11, 12 are 180,
      // 163.6 and 150 bpm) and that is pre-existing, so compare generously.
      expect(Math.abs(rate.bpm - scan.truth.meanBpm) / scan.truth.meanBpm).toBeLessThan(0.06);
    }
  });

  it('refuses a rate at the very edge of the plausible range, and that is the trade', () => {
    // 🔴 Stated rather than hidden: a genuine pulse at exactly
    // MAX_PLAUSIBLE_BPM is now refused. The reason this is the right trade is
    // that the lag grid up there is 20 bpm wide (180, then 200) — "200 bpm"
    // was never a measurement this pipeline could make, while the false
    // readings it was letting through were real.
    const scan = synthesizePpg({
      durationSec: DURATION_SEC,
      bpm: MAX_PLAUSIBLE_BPM,
      sampleRateHz: 60,
    });
    expect(rateOf(scan.frames).rate).toBeNull();
    // And the slow end: the boundary lag is 40.0 bpm, so 40.9 is the slowest
    // rate that still comes back.
    const slow = synthesizePpg({
      durationSec: DURATION_SEC,
      bpm: MIN_PLAUSIBLE_BPM + 1,
      sampleRateHz: 60,
    });
    expect(rateOf(slow.frames).rate).not.toBeNull();
  });
});
