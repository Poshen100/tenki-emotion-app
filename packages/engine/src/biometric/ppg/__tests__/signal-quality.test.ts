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
  PPG_ADVISORY_REASONS,
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
  it('classifies every quality reason as exactly one of positive, rejection or advisory', () => {
    // 🔴 A reason in none of the lists is a reason no surface can render, and a
    // reason in two of them is a reason that means different things in
    // different places. This is what stops the lists drifting into a parallel
    // vocabulary.
    for (const reason of PPG_QUALITY_REASONS) {
      const memberships = [
        PPG_POSITIVE_REASONS,
        PPG_REJECTION_REASONS,
        PPG_ADVISORY_REASONS,
      ].filter((list) => (list as readonly string[]).includes(reason));
      expect(memberships).toHaveLength(1);
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

describe('a missing torch is stated, not charged against the capture', () => {
  it('records it without touching the score or the verdict', () => {
    // 🔴 founder decision: record, do not reject. iOS Safari has no torch API,
    // so rejecting on it would refuse every capture on a whole platform.
    const scan = synthesizePpg({ durationSec: 90 });
    const withTorch = analyzePpgScan(scan.frames, 'full_scan', { torchAvailable: true });
    const without = analyzePpgScan(scan.frames, 'full_scan', { torchAvailable: false });
    if (withTorch.status !== 'analysed' || without.status !== 'analysed') throw new Error('rejected');

    expect(without.analysis.quality.score).toBe(withTorch.analysis.quality.score);
    expect(without.analysis.heartRateBpm).toBe(withTorch.analysis.heartRateBpm);
    expect(without.analysis.quality.reasons).toContain('torch_unavailable');
    expect(withTorch.analysis.quality.reasons).not.toContain('torch_unavailable');
  });

  it('keeps it out of the rejection reasons of an accepted capture', () => {
    const outcome = analyzePpgScan(
      synthesizePpg({ durationSec: 90 }).frames,
      'full_scan',
      { torchAvailable: false },
    );
    if (outcome.status !== 'analysed') throw new Error('rejected');
    const signal = toSignalQuality(outcome.analysis);
    expect(signal.accepted).toBe(true);
    expect(signal.rejectionReasons).toEqual([]);
    expect(signal.advisories).toEqual(['torch_unavailable']);
  });

  it('says nothing when the capture layer did not report either way', () => {
    // `undefined` is "not reported", which is not the same as "there was none".
    const outcome = analyzePpgScan(synthesizePpg({ durationSec: 90 }).frames, 'full_scan');
    if (outcome.status !== 'analysed') throw new Error('rejected');
    expect(outcome.analysis.quality.reasons).not.toContain('torch_unavailable');
    expect(toSignalQuality(outcome.analysis).advisories).toEqual([]);
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

describe('a reading from fragments is marked as one', () => {
  it('carries the mark, so a set of anchors cannot blend two things silently', () => {
    // 🔴 CLAUDE.md's rule: two things measured differently must not merge into
    // one series without a mark, and a set of anchors is where that happens.
    // A fragment-derived rate is the same quantity and materially noisier
    // (worst error 2.4 bpm swept, against roughly 1 for a whole capture).
    const scan = synthesizePpg({ durationSec: 60, sampleRateHz: 60 });
    const t0 = scan.frames[0].timestampMs;
    const drifted = scan.frames.map((f) => {
      const phase = (((f.timestampMs - t0) / 1000) % 17) / 17;
      const r = 0.5 / 17;
      let level: number;
      if (phase < r) level = -1 + (2 * phase) / r;
      else if (phase < 0.5) level = 1;
      else if (phase < 0.5 + r) level = 1 - (2 * (phase - 0.5)) / r;
      else level = -1;
      const k = 1 + 0.16 * level;
      return { ...f, red: f.red * k, green: f.green * k, blue: f.blue * k };
    });
    const outcome = analyzePpgScan(drifted, 'full_scan');
    if (outcome.status !== 'analysed') throw new Error('expected an analysis');
    const quality = toSignalQuality(outcome.analysis);
    expect(quality.accepted).toBe(true);
    expect(quality.fromQuietSegments).toBe(true);
  });

  it('is false on an ordinary capture, and on one with no reading at all', () => {
    const clean = analyzePpgScan(synthesizePpg({ durationSec: 60 }).frames, 'full_scan');
    if (clean.status !== 'analysed') throw new Error('expected an analysis');
    expect(toSignalQuality(clean.analysis).fromQuietSegments).toBe(false);

    const weak = analyzePpgScan(
      synthesizePpg({ durationSec: 60, ...PPG_FIXTURES.lowPerfusion }).frames,
      'full_scan',
    );
    if (weak.status !== 'analysed') throw new Error('expected an analysis');
    expect(toSignalQuality(weak.analysis).accepted).toBe(false);
    expect(toSignalQuality(weak.analysis).fromQuietSegments).toBe(false);
  });
});
