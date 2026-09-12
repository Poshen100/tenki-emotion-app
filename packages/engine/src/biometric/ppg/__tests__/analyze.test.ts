/**
 * The pipeline against ground truth.
 *
 * Every recovered value is compared to what the generator actually produced,
 * not to the nominal parameters — see replay.ts for why. The refusals matter as
 * much as the recoveries: half of these tests assert that a number does NOT
 * come out.
 */
import { PPG_FIXTURES, synthesizePpg } from '../replay';
import { analyzePpgScan, hasUsableReading, wasWithheld } from '../analyze';
import type { PpgAnalysis } from '../types';

/**
 * ⚠️ These tests exercise the HRV and respiration paths, so they pass
 * `cameraPrvEstimates: true, cameraBreathLock: true` explicitly. That is NOT the product default —
 * camera HRV is off (founder decision 2026-09-11, see the
 * `camera_prv_estimates` kill switch). The pipeline is kept and tested so the
 * decision can be revisited with real-user data; `camera-claims.test.ts`
 * is what holds the default in place.
 */
const PRV_ENABLED = { cameraPrvEstimates: true, cameraBreathLock: true } as const;

function analyse(
  overrides: Parameters<typeof synthesizePpg>[0] = {},
  mode: 'quick_check' | 'full_scan' = 'full_scan',
): { analysis: PpgAnalysis; truth: ReturnType<typeof synthesizePpg>['truth'] } {
  const scan = synthesizePpg(overrides);
  const outcome = analyzePpgScan(scan.frames, mode, PRV_ENABLED);
  if (outcome.status !== 'analysed') {
    throw new Error(`expected an analysis, got rejection: ${outcome.reason}`);
  }
  return { analysis: outcome.analysis, truth: scan.truth };
}

describe('clean scan', () => {
  it('recovers the heart rate the generator actually produced', () => {
    const { analysis, truth } = analyse();
    expect(analysis.heartRateBpm).not.toBeNull();
    expect(Math.abs((analysis.heartRateBpm as number) - truth.meanBpm)).toBeLessThan(3);
  });

  it('does not double the rate on the dicrotic bump', () => {
    // The classic camera-PPG failure: a second peak per beat, and a reported
    // rate exactly twice the truth that looks entirely physiological.
    for (const bpm of [52, 68, 84, 96]) {
      const { analysis, truth } = analyse({ bpm });
      expect(analysis.heartRateBpm).not.toBeNull();
      expect(analysis.heartRateBpm as number).toBeLessThan(truth.meanBpm * 1.4);
      expect(analysis.heartRateBpm as number).toBeGreaterThan(truth.meanBpm * 0.7);
    }
  });

  it('recovers an HRV close to the intervals it was built from', () => {
    const { analysis, truth } = analyse();
    expect(analysis.prvRmssdMs).not.toBeNull();
    // Camera beat timing is quantised by the frame rate even after sub-sample
    // interpolation, so this is a tolerance, not an equality — which is exactly
    // why the value ships tagged as an estimate.
    // Measured at 7-9% under truth on the fixtures, consistently low: the
    // band-pass smooths beat-to-beat timing and the 30 Hz grid quantises it
    // even after sub-sample interpolation. The bias is NOT corrected by a
    // fudge factor — a fixed multiplier with no personal basis is exactly the
    // `harmonizeHrv() * 0.75` mistake this repo already removed. A personal
    // baseline built from this same pipeline absorbs a consistent bias; a
    // magic constant would hide it.
    const error = Math.abs((analysis.prvRmssdMs as number) - truth.rmssdMs) / truth.rmssdMs;
    expect(error).toBeLessThan(0.2);
  });

  it('recovers the breathing rate, not a fraction of the heart rate', () => {
    const { analysis, truth } = analyse();
    expect(analysis.respiratoryRateBrpm).not.toBeNull();
    expect(Math.abs((analysis.respiratoryRateBrpm as number) - truth.respirationBrpm)).toBeLessThan(
      2,
    );
  });

  it('scores well and reports why', () => {
    const { analysis } = analyse();
    expect(analysis.quality.score).toBeGreaterThan(70);
    expect(analysis.quality.reasons).toContain('good_periodicity');
    expect(analysis.quality.reasons).toContain('low_motion');
    expect(analysis.quality.reasons).not.toContain('motion_detected');
    expect(hasUsableReading(analysis)).toBe(true);
  });
});

describe('refusals', () => {
  it('reports nothing at all from a barely-perfused fingertip', () => {
    const { analysis } = analyse(PPG_FIXTURES.lowPerfusion);
    expect(analysis.heartRateBpm).toBeNull();
    expect(analysis.prvRmssdMs).toBeNull();
    expect(analysis.respiratoryRateBrpm).toBeNull();
    expect(analysis.quality.reasons).toContain('low_perfusion');
    expect(hasUsableReading(analysis)).toBe(false);
  });

  it('withholds PRV when the finger was moving, and says so', () => {
    const { analysis } = analyse(PPG_FIXTURES.motion);
    expect(analysis.prvRmssdMs).toBeNull();
    expect(wasWithheld(analysis, 'prv')).toBe(true);
    expect(analysis.quality.reasons).toContain('motion_detected');
  });

  it('withholds PRV rather than reporting one built on rejected beats', () => {
    const { analysis, truth } = analyse(PPG_FIXTURES.irregular);
    // The dangerous case, and the reason MAX_ARTIFACT_FRACTION is 0.1: with the
    // gate at 0.2 this fixture reported RMSSD 125 ms against a truth of 262 ms.
    // Not noise — a confident, physiological-looking number less than half the
    // real variability, on a scan whose quality score was 83.
    expect(truth.rmssdMs).toBeGreaterThan(200);
    expect(analysis.prvRmssdMs).toBeNull();
    expect(analysis.withheld).toContainEqual({ metric: 'prv', reason: 'too_many_artifacts' });
  });

  it('withholds PRV built across interpolated frame gaps', () => {
    const { analysis } = analyse(PPG_FIXTURES.frameDrops);
    // The heart rate survives a third of the frames going missing; the
    // millisecond differences HRV is made of are partly TENKI's interpolation.
    expect(analysis.heartRateBpm).not.toBeNull();
    expect(analysis.prvRmssdMs).toBeNull();
    expect(analysis.withheld).toContainEqual({ metric: 'prv', reason: 'frame_drops' });
  });

  it('names the reason the user can act on, not the symptom', () => {
    const { analysis } = analyse(PPG_FIXTURES.lowPerfusion);
    // Low perfusion, motion and clipping all collapse into a loss of
    // periodicity. Reporting that would tell someone whose finger is barely on
    // the lens that their pulse was irregular.
    expect(analysis.withheld).toContainEqual({ metric: 'heart_rate', reason: 'low_perfusion' });
  });

  it('floors quality on a capture shorter than the mode accepts', () => {
    const { analysis } = analyse(PPG_FIXTURES.tooShort);
    expect(analysis.quality.reasons).toContain('insufficient_duration');
    expect(analysis.quality.score).toBeLessThanOrEqual(20);
    expect(analysis.heartRateBpm).toBeNull();
  });

  it('notices dropped frames and holds the score down for them', () => {
    const { analysis } = analyse(PPG_FIXTURES.frameDrops);
    const clean = analyse().analysis;
    expect(analysis.quality.frameDropFraction).toBeGreaterThan(0);
    expect(analysis.quality.score).toBeLessThan(clean.quality.score);
  });

  it('notices a clipped sensor', () => {
    const { analysis } = analyse(PPG_FIXTURES.clipped);
    expect(analysis.quality.reasons).toContain('sensor_clipping');
  });

  it('notices a finger sliding off the lens', () => {
    const { analysis } = analyse(PPG_FIXTURES.poorCoverage);
    expect(analysis.quality.reasons).toContain('unstable_coverage');
  });

  it('rejects a capture with too few frames instead of analysing it', () => {
    const scan = synthesizePpg({ durationSec: 1 });
    expect(analyzePpgScan(scan.frames, 'full_scan', PRV_ENABLED)).toEqual({
      status: 'rejected',
      reason: 'too_few_frames',
    });
  });

  it('refuses to run the camera pipeline for a mode that does not read the camera', () => {
    const scan = synthesizePpg();
    expect(analyzePpgScan(scan.frames, 'precision', PRV_ENABLED)).toEqual({
      status: 'rejected',
      reason: 'not_a_camera_mode',
    });
  });
});

describe('scan modes', () => {
  it('never produces PRV in quick check, however good the signal is', () => {
    // The signal here is the clean fixture — the refusal is structural, not a
    // consequence of quality.
    const { analysis } = analyse({ durationSec: 30 }, 'quick_check');
    expect(analysis.heartRateBpm).not.toBeNull();
    expect(analysis.prvRmssdMs).toBeNull();
    expect(analysis.withheld).toContainEqual({ metric: 'prv', reason: 'mode_excludes_metric' });
  });

  it('produces HRV in a full scan of the same signal', () => {
    const { analysis } = analyse({ durationSec: 60 }, 'full_scan');
    expect(analysis.prvRmssdMs).not.toBeNull();
  });

  it('never reports respiration without the beat timing HRV needs', () => {
    const { analysis } = analyse(PPG_FIXTURES.motion);
    expect(analysis.prvRmssdMs).toBeNull();
    expect(analysis.respiratoryRateBrpm).toBeNull();
  });
});

describe('score and confidence stay separate', () => {
  it('does not lower the heart rate because confidence is low', () => {
    const long = analyse({ durationSec: 90 });
    const short = analyse({ durationSec: 50 });

    expect(short.analysis.quality.confidence).toBeLessThan(long.analysis.quality.confidence);
    // Same body, less evidence: the reading should not move much, only the
    // confidence in it.
    expect(
      Math.abs((short.analysis.heartRateBpm as number) - (long.analysis.heartRateBpm as number)),
    ).toBeLessThan(4);
  });
});

describe('respiration is breathing, not a function of heart rate', () => {
  it('reports the same breathing rate across a wide range of heart rates', () => {
    // 🔴 Regression guard for a real defect. The estimator this replaced
    // (`estimateBrpmFromRRIntervals`, zero-crossing counting) returned 14.3 at
    // 50 bpm and 33.8 at 105 bpm for a fixture breathing at a fixed 14 — a
    // number that tracked the pulse and looked physiological the whole way up.
    const reported: number[] = [];

    for (const bpm of [52, 64, 76, 88]) {
      const { analysis } = analyse({ bpm, durationSec: 90, respirationBrpm: 12 });
      if (analysis.respiratoryRateBrpm !== null) reported.push(analysis.respiratoryRateBrpm);
    }

    expect(reported.length).toBeGreaterThanOrEqual(3);
    for (const brpm of reported) {
      expect(Math.abs(brpm - 12)).toBeLessThan(2);
    }
  });

  it('refuses rather than halving when breathing outruns the beat sampling', () => {
    // The tachogram is sampled once per beat, so a fast breath at a slow pulse
    // is under its own Nyquist limit. Every reported value must be right; the
    // unresolvable ones come back null.
    for (const brpm of [8, 10, 12, 14, 16, 18, 20, 24]) {
      const { analysis } = analyse({ durationSec: 90, respirationBrpm: brpm });
      if (analysis.respiratoryRateBrpm !== null) {
        expect(Math.abs(analysis.respiratoryRateBrpm - brpm)).toBeLessThan(2);
      }
    }
  });
});
