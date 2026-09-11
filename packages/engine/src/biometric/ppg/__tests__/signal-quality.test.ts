/**
 * The instrument a capture reports about itself.
 *
 * Two things are worth holding here, and they are different:
 *   1. the four dimensions must move the way they claim to (a shaking hand must
 *      read as more motion artifact, not less), and
 *   2. they must be the SAME numbers the score was built from, because an
 *      instrument that can disagree with the score beside it eventually will.
 */
import { PPG_FIXTURES, synthesizePpg } from '../replay';
import { analyzePpgScan } from '../analyze';
import {
  PPG_POSITIVE_REASONS,
  PPG_REJECTION_REASONS,
  dimensionGoodness,
  isRejectionReason,
  toSignalQuality,
} from '../signal-quality';
import { PPG_QUALITY_REASONS } from '../types';
import type { PpgAnalysis } from '../types';

function analyse(overrides: Parameters<typeof synthesizePpg>[0] = {}): PpgAnalysis {
  const outcome = analyzePpgScan(synthesizePpg({ durationSec: 90, ...overrides }).frames, 'full_scan');
  if (outcome.status !== 'analysed') throw new Error(`rejected: ${outcome.reason}`);
  return outcome.analysis;
}

describe('the rejection vocabulary is a subset, not a second vocabulary', () => {
  it('classifies every quality reason as either positive or a rejection', () => {
    // 🔴 A reason in neither list is a reason no surface can render. This is
    // what stops the two lists drifting into a parallel vocabulary.
    for (const reason of PPG_QUALITY_REASONS) {
      const positive = (PPG_POSITIVE_REASONS as readonly string[]).includes(reason);
      const rejection = (PPG_REJECTION_REASONS as readonly string[]).includes(reason);
      expect(positive || rejection).toBe(true);
      expect(positive && rejection).toBe(false);
    }
  });

  it('never treats a good-capture reason as grounds for rejection', () => {
    expect(isRejectionReason('strong_pulse')).toBe(false);
    expect(isRejectionReason('low_perfusion')).toBe(true);
  });
});

describe('the four dimensions are the score components, not a recalculation', () => {
  it('reads each dimension straight off the quality components', () => {
    const analysis = analyse();
    const signal = toSignalQuality(analysis);
    expect(signal.contactCoverage).toBe(analysis.quality.components.coverage);
    expect(signal.lightStability).toBe(analysis.quality.components.clipping);
    expect(signal.rhythmicCoherence).toBe(analysis.quality.components.periodicity);
    // The inverted one, to within the rounding step.
    expect(signal.motionArtifact).toBeCloseTo(1 - analysis.quality.components.motion, 2);
  });

  it('reports the capture duration in ms and the frames behind it', () => {
    const analysis = analyse();
    const signal = toSignalQuality(analysis);
    expect(signal.captureDurationMs).toBe(Math.round(analysis.durationSec * 1000));
    expect(signal.usableFrameCount).toBeLessThanOrEqual(signal.totalFrameCount);
    expect(signal.totalFrameCount).toBeGreaterThan(0);
  });
});

describe('the dimensions move the way they claim to', () => {
  it('reads more motion artifact on a shaking capture than a still one', () => {
    // 🔴 The direction guard. `motionArtifact` is the one dimension where 1 is
    // bad, and a sign error here would show a shaking hand as a perfect one.
    const still = toSignalQuality(analyse());
    const shaking = toSignalQuality(analyse({ motionAmplitude: 1.2 }));
    expect(shaking.motionArtifact).toBeGreaterThan(still.motionArtifact);
    expect(dimensionGoodness(shaking, 'motionArtifact')).toBeLessThan(
      dimensionGoodness(still, 'motionArtifact'),
    );
  });

  it('reads lower rhythmic coherence when there is no clear rhythm to find', () => {
    const clean = toSignalQuality(analyse());
    const weak = toSignalQuality(analyse(PPG_FIXTURES.lowPerfusion));
    expect(clean.rhythmicCoherence).toBeGreaterThan(weak.rhythmicCoherence);
  });

  it('reads lower contact coverage when the finger keeps sliding', () => {
    const clean = toSignalQuality(analyse());
    const sliding = toSignalQuality(analyse(PPG_FIXTURES.poorCoverage));
    expect(clean.contactCoverage).toBeGreaterThan(sliding.contactCoverage);
  });

  it('reads lower light stability when the exposure is clipping', () => {
    const clean = toSignalQuality(analyse());
    const clipped = toSignalQuality(analyse(PPG_FIXTURES.clipped));
    expect(clean.lightStability).toBeGreaterThan(clipped.lightStability);
  });

  it('turns every dimension into a 0..1 bar where 1 is always good', () => {
    const signal = toSignalQuality(analyse());
    for (const dimension of ['contactCoverage', 'lightStability', 'motionArtifact', 'rhythmicCoherence'] as const) {
      const goodness = dimensionGoodness(signal, dimension);
      expect(goodness).toBeGreaterThanOrEqual(0);
      expect(goodness).toBeLessThanOrEqual(1);
    }
  });
});

describe('accepted means a reading exists', () => {
  it('accepts a capture that established a pulse, with nothing to report against it', () => {
    const signal = toSignalQuality(analyse());
    expect(signal.accepted).toBe(true);
    expect(signal.rejectionReasons).toEqual([]);
  });

  it('refuses a capture with no pulse, and names what was wrong with it', () => {
    // ⚠️ Not "the score was low" — accepted tracks whether a reading exists.
    const analysis = analyse(PPG_FIXTURES.lowPerfusion);
    expect(analysis.heartRateBpm).toBeNull();
    const signal = toSignalQuality(analysis);
    expect(signal.accepted).toBe(false);
    expect(signal.rejectionReasons).toContain('low_perfusion');
  });
});
