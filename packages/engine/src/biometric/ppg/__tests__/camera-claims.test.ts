/**
 * What a camera is allowed to claim.
 *
 * 🔴 founder decisions, 2026-09-11:
 *   - Camera **pulse** is the headline reading (Pulse Anchor).
 *   - Camera **PRV** may reach a user, but only through its own gate — and it
 *     is never HRV, never populates an HRV field, never feeds the HRV driver.
 *   - Camera **respiratory rate** may be released only as a standalone Breath
 *     Lock measurement, which does not exist yet, so it is off.
 *
 * The measurements behind the PRV gate are in `beat-template.ts`. The short
 * version: the quality score is blind to sensor noise, so a capture it rates
 * **99** can carry a **156%** PRV error, and nothing else in the pipeline —
 * including repeatability — notices.
 *
 * @see docs/PHONE-PPG.md
 */
import { PPG_FIXTURES, synthesizePpg } from '../replay';
import { analyzePpgScan } from '../analyze';
import { toEngineInput } from '../to-reading';
import { PRV_MIN_TEMPLATE_CORRELATION } from '../beat-template';
import { modeReports } from '../../scan-modes';
import { FEATURE_FLAGS } from '../../../../../shared/src/feature-flags/flags';
import type { PpgAnalysis } from '../types';

function analyseDefault(overrides: Parameters<typeof synthesizePpg>[0] = {}): PpgAnalysis {
  const scan = synthesizePpg({ durationSec: 90, ...overrides });
  // No third argument: exactly what a caller gets without opting in.
  const outcome = analyzePpgScan(scan.frames, 'full_scan');
  if (outcome.status !== 'analysed') throw new Error(`rejected: ${outcome.reason}`);
  return outcome.analysis;
}

describe('the camera reports a resting pulse', () => {
  it('establishes a heart rate from a clean scan', () => {
    // The claim that IS made. Losing this would make the whole feature pointless.
    const analysis = analyseDefault();
    expect(analysis.heartRateBpm).not.toBeNull();
    expect(analysis.heartRateBpm as number).toBeGreaterThan(40);
    expect(analysis.heartRateBpm as number).toBeLessThan(200);
  });
});

describe('PRV reaches a user only through its own gate', () => {
  it('reports it on a capture whose beats actually resemble each other', () => {
    const analysis = analyseDefault();
    expect(analysis.beatTemplateCorrelation as number).toBeGreaterThanOrEqual(
      PRV_MIN_TEMPLATE_CORRELATION,
    );
    expect(analysis.prvRmssdMs).not.toBeNull();
  });

  it('🔴 withholds it on a noisy capture the quality score rates as excellent', () => {
    // THE case this gate exists for. Sensor noise leaves perfusion, periodicity,
    // coverage and motion untouched — so the score stays at the top — while
    // moving every peak slightly and destroying the intervals PRV is made of.
    const analysis = analyseDefault({ noiseSd: 1.5 });
    expect(analysis.quality.score).toBeGreaterThan(90);
    expect(analysis.heartRateBpm).not.toBeNull();
    expect(analysis.beatTemplateCorrelation as number).toBeLessThan(
      PRV_MIN_TEMPLATE_CORRELATION,
    );
    expect(analysis.prvRmssdMs).toBeNull();
    expect(analysis.withheld).toContainEqual({ metric: 'prv', reason: 'unstable_beat_shape' });
  });

  it('withholds it on a weakly perfused capture too', () => {
    // Measured PRV error there was 35-55%; the gate removes it.
    const analysis = analyseDefault({ perfusion: 0.35 });
    expect(analysis.prvRmssdMs).toBeNull();
  });

  it('measures no repeatability once PRV is withheld', () => {
    expect(analyseDefault({ noiseSd: 1.5 }).repeatabilitySdMs).toBeNull();
  });
});

describe('PRV is not HRV, and the boundary is structural', () => {
  it('🔴 never populates the HRV field, even on a capture that produced PRV', () => {
    // The single most important assertion in this file. `BiometricReading.
    // hrvRmssdMs` is the RR-derived field the Edge Score's HRV driver reads;
    // a camera value arriving there would be indistinguishable downstream from
    // a chest strap's.
    const analysis = analyseDefault();
    expect(analysis.prvRmssdMs).not.toBeNull();

    const input = toEngineInput(analysis, Date.now());
    expect(Number.isFinite(input.reading.hrvRmssdMs)).toBe(false);
    expect(input.availability.hrv).toBe(false);
  });

  it('carries PRV outside the reading, where nothing can copy it into HRV by habit', () => {
    const analysis = analyseDefault();
    const input = toEngineInput(analysis, Date.now());
    expect(input.prvRmssdMs).toBe(analysis.prvRmssdMs);
    expect(Object.keys(input.reading)).not.toContain('prvRmssdMs');
  });

  it('names the metric prv everywhere it is withheld', () => {
    const analysis = analyseDefault({ noiseSd: 1.5 });
    for (const entry of analysis.withheld) {
      expect(entry.metric).not.toBe('hrv');
    }
  });
});

describe('respiratory rate is off until Breath Lock exists', () => {
  it('reports none by default, however clean the signal', () => {
    const analysis = analyseDefault({ rsaAmplitudeMs: 80, beatJitterMs: 10 });
    expect(analysis.respiratoryRateBrpm).toBeNull();
    expect(analysis.withheld).toContainEqual({
      metric: 'respiration',
      reason: 'mode_excludes_metric',
    });
  });

  it('says the build withheld it, not the signal', () => {
    // A user whose capture was perfect must not be told their signal was poor.
    const analysis = analyseDefault();
    expect(analysis.withheld).toContainEqual({
      metric: 'respiration',
      reason: 'mode_excludes_metric',
    });
  });

  it('gives the same reason on a capture too poor to establish any pulse', () => {
    // Both exits from the pipeline answer the same question the same way.
    const analysis = analyseDefault(PPG_FIXTURES.lowPerfusion);
    expect(analysis.heartRateBpm).toBeNull();
    expect(analysis.withheld).toContainEqual({
      metric: 'respiration',
      reason: 'mode_excludes_metric',
    });
  });

  it('names the signal instead once Breath Lock is enabled', () => {
    // The other direction: without this the assertion above would pass on a
    // pipeline that hardcodes the reason and has stopped looking at the signal.
    const scan = synthesizePpg({ durationSec: 90, ...PPG_FIXTURES.lowPerfusion });
    const outcome = analyzePpgScan(scan.frames, 'full_scan', { cameraBreathLock: true });
    if (outcome.status !== 'analysed') throw new Error(`rejected: ${outcome.reason}`);
    expect(outcome.analysis.withheld).toContainEqual({
      metric: 'respiration',
      reason: 'irregular_periodicity',
    });
  });
});

describe('the flags say what they govern', () => {
  it('reports PRV by default and stops when the kill switch is thrown', () => {
    expect(modeReports('full_scan', 'prv')).toBe(true);
    expect(modeReports('full_scan', 'prv', { cameraPrvEstimates: false })).toBe(false);
  });

  it('withholds respiration by default and yields it only when Breath Lock is on', () => {
    expect(modeReports('full_scan', 'respiration')).toBe(false);
    expect(modeReports('full_scan', 'respiration', { cameraBreathLock: true })).toBe(true);
  });

  it('never gates the beat-sensor mode on a camera decision', () => {
    // 🔴 A chest strap's RR intervals are a different provenance with a
    // different quality path. Gating `precision` on a camera decision would be
    // a category error — and it is the one that would silently remove HRV from
    // the users who have the best claim to it.
    expect(modeReports('precision', 'prv')).toBe(true);
    expect(modeReports('precision', 'respiration')).toBe(true);
    expect(modeReports('precision', 'respiration', { cameraBreathLock: false })).toBe(true);
  });

  it('ships PRV on and Breath Lock off', () => {
    expect(FEATURE_FLAGS.camera_prv_estimates.defaultValue).toBe(true);
    expect(FEATURE_FLAGS.camera_breath_lock.defaultValue).toBe(false);
  });

  it('keeps both remotely configurable, so either decision can be revisited', () => {
    expect(FEATURE_FLAGS.camera_prv_estimates.remoteConfigurable).toBe(true);
    expect(FEATURE_FLAGS.camera_breath_lock.remoteConfigurable).toBe(true);
  });
});
