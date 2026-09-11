/**
 * What a camera is allowed to claim.
 *
 * 🔴 founder decision, 2026-09-11: a first release reports resting pulse from
 * the camera and nothing else. No HRV, no respiratory rate. The pipeline for
 * both is complete and tested — the other suites in this directory exercise it
 * by enabling `cameraHrvEstimates` explicitly — but the DEFAULT must withhold
 * them, and this suite is what holds that default in place.
 *
 * Why the default is the way it is, measured rather than assumed:
 *  - camera RMSSD under-reads its own ground truth by 7-9%
 *  - repeatability on a weak-but-accepted signal reaches ~13 ms against an
 *    RMSSD of ~30 — over a third of the quantity being reported
 *  - and the ratio that decides whether any of that carries information (real
 *    day-to-day variation against measurement noise) CANNOT be established
 *    from synthetic data: the generator has no day-to-day variation at all
 *
 * @see docs/PHONE-PPG.md
 */
import { PPG_FIXTURES, synthesizePpg } from '../replay';
import { analyzePpgScan } from '../analyze';
import { modeReports } from '../../scan-modes';
import { FEATURE_FLAGS } from '../../../../../shared/src/feature-flags/flags';

function analyseDefault(overrides: Parameters<typeof synthesizePpg>[0] = {}) {
  const scan = synthesizePpg({ durationSec: 90, ...overrides });
  // No third argument: exactly what a caller gets without opting in.
  const outcome = analyzePpgScan(scan.frames, 'full_scan');
  if (outcome.status !== 'analysed') throw new Error(`rejected: ${outcome.reason}`);
  return outcome.analysis;
}

describe('the camera reports resting pulse and nothing else', () => {
  it('establishes a heart rate from a clean scan', () => {
    // The claim that IS made. Losing this would make the whole feature pointless.
    const analysis = analyseDefault();
    expect(analysis.heartRateBpm).not.toBeNull();
    expect(analysis.heartRateBpm as number).toBeGreaterThan(40);
    expect(analysis.heartRateBpm as number).toBeLessThan(200);
  });

  it('reports no HRV by default, however clean the signal', () => {
    // 🔴 The structural claim. Not a quality threshold — a pristine 90-second
    // capture must still come back with nothing in this field.
    const analysis = analyseDefault();
    expect(analysis.quality.score).toBeGreaterThan(90);
    expect(analysis.hrvRmssdMs).toBeNull();
  });

  it('reports no respiratory rate by default', () => {
    const analysis = analyseDefault({ rsaAmplitudeMs: 80, beatJitterMs: 10 });
    expect(analysis.respiratoryRateBrpm).toBeNull();
  });

  it('says the metrics were withheld by the build, not by the signal', () => {
    // A user whose scan was perfect must not be told their signal was poor.
    const analysis = analyseDefault();
    expect(analysis.withheld).toContainEqual({ metric: 'hrv', reason: 'mode_excludes_metric' });
    expect(analysis.withheld).toContainEqual({
      metric: 'respiration',
      reason: 'mode_excludes_metric',
    });
  });

  it('measures no repeatability, because there is no HRV to be repeatable', () => {
    // Repeatability is the spread of HRV across a scan's own windows. With no
    // HRV reported there is nothing to spread.
    expect(analyseDefault().repeatabilitySdMs).toBeNull();
  });

  it('withholds them on a poor signal too, without pretending that was the reason', () => {
    const analysis = analyseDefault(PPG_FIXTURES.poorCoverage);
    expect(analysis.hrvRmssdMs).toBeNull();
    expect(analysis.withheld.some((w) => w.metric === 'hrv')).toBe(true);
  });

  it('gives the same reason on a scan too poor to establish any pulse', () => {
    // ⚠️ There are two exits from the pipeline. The early one — no pulse at
    // all, so nothing downstream can be attempted — reported
    // `irregular_periodicity` for HRV regardless of the gate. That is a WEAKER
    // reason than the truth: this build does not report the metric at all.
    // Both exits must answer the same question the same way.
    const analysis = analyseDefault(PPG_FIXTURES.lowPerfusion);
    expect(analysis.heartRateBpm).toBeNull();
    expect(analysis.withheld).toContainEqual({ metric: 'hrv', reason: 'mode_excludes_metric' });
    expect(analysis.withheld).toContainEqual({
      metric: 'respiration',
      reason: 'mode_excludes_metric',
    });
  });

  it('names the signal instead once the gate is open', () => {
    // The other direction. Without this the assertion above would pass on a
    // pipeline that hardcodes `mode_excludes_metric` and has stopped looking
    // at the signal at all.
    const scan = synthesizePpg({ durationSec: 90, ...PPG_FIXTURES.lowPerfusion });
    const outcome = analyzePpgScan(scan.frames, 'full_scan', { cameraHrvEstimates: true });
    if (outcome.status !== 'analysed') throw new Error(`rejected: ${outcome.reason}`);
    expect(outcome.analysis.withheld).toContainEqual({
      metric: 'hrv',
      reason: 'irregular_periodicity',
    });
  });
});

describe('the gate is a build decision, not a signal one', () => {
  it('withholds camera HRV by default and yields it when enabled', () => {
    expect(modeReports('full_scan', 'hrv')).toBe(false);
    expect(modeReports('full_scan', 'hrv', { cameraHrvEstimates: true })).toBe(true);
  });

  it('never gates the beat-sensor mode on a camera decision', () => {
    // 🔴 A chest strap's RR intervals are a different provenance with a
    // different quality path. Gating `precision` on a camera decision would be
    // a category error — and it is the one that would silently remove HRV from
    // the users who have the best claim to it.
    expect(modeReports('precision', 'hrv')).toBe(true);
    expect(modeReports('precision', 'respiration')).toBe(true);
  });

  it('ships with the flag off', () => {
    expect(FEATURE_FLAGS.camera_hrv_estimates.defaultValue).toBe(false);
  });

  it('keeps the flag remotely configurable, so the decision can be revisited', () => {
    // The pipeline is kept rather than deleted precisely so real-user data can
    // reopen this. A hardcoded refusal would throw that away.
    expect(FEATURE_FLAGS.camera_hrv_estimates.remoteConfigurable).toBe(true);
  });
});
