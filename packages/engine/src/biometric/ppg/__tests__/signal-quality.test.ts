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
import { explainQualityScore } from '../quality';
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

describe('the score has to be able to explain itself', () => {
  /**
   * 🔴 founder 2026-09-24, looking at a capture scoring 54 with bars reading
   * 100% / 100% / 92% / 0%: 「訊號品質分數怎麼這麼低？」
   *
   * It was unanswerable from the screen. Four bars are shown and the score has
   * six components — perfusion is worth 25 of the 100, the joint-largest
   * weight, and has no bar at all.
   */
  it('the rows add up to the score — they are the arithmetic, not a retelling', () => {
    // The whole value of the breakdown is that it cannot drift into a
    // plausible-looking second story. If these ever disagree, the explanation
    // is lying about the number printed beside it.
    for (const fixture of [
      {},
      PPG_FIXTURES.lowPerfusion,
      PPG_FIXTURES.motion,
      PPG_FIXTURES.poorCoverage,
      PPG_FIXTURES.frameDrops,
      PPG_FIXTURES.quietWeakPulse,
    ]) {
      const outcome = analyzePpgScan(
        synthesizePpg({ durationSec: 60, sampleRateHz: 60, ...fixture }).frames,
        'full_scan',
      );
      if (outcome.status !== 'analysed') continue;
      const rows = explainQualityScore(outcome.analysis.quality);
      const total = rows.reduce((sum, r) => sum + r.points, 0);
      // Rounding: each row is rounded to 0.1 and the score to a whole number.
      expect(Math.abs(total - outcome.analysis.quality.score)).toBeLessThan(0.6);
    }
  });

  it('names every component, including the ones with no bar on screen', () => {
    const outcome = analyzePpgScan(synthesizePpg({ durationSec: 60 }).frames, 'full_scan');
    if (outcome.status !== 'analysed') throw new Error('expected an analysis');
    const keys = explainQualityScore(outcome.analysis.quality).map((r) => r.key);
    // 🔴 These two are the point: neither is one of the four dimensions, and
    // together they are a third of the score.
    expect(keys).toContain('perfusion');
    expect(keys).toContain('frameDrops');
    expect(keys).toHaveLength(6);
  });

  it('puts the heaviest weight first, so the reason is the top row', () => {
    const outcome = analyzePpgScan(synthesizePpg({ durationSec: 60 }).frames, 'full_scan');
    if (outcome.status !== 'analysed') throw new Error('expected an analysis');
    const rows = explainQualityScore(outcome.analysis.quality);
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i].weight).toBeLessThanOrEqual(rows[i - 1].weight);
    }
    expect(rows.reduce((sum, r) => sum + r.weight, 0)).toBe(100);
  });

  it("reproduces the founder's 54", () => {
    // 接觸 100%, 光 100%, 穩定 92%, 節律 0%, no dropped frames — and 54 on
    // screen. The arithmetic says perfusion contributed 5.6 of 25, which is a
    // component of 0.22, which is why the capture also said 「脈搏訊號偏弱」.
    const visible = 1.0 * 15 + 1.0 * 8 + 0.92 * 20 + 0 * 25 + 1.0 * 7;
    expect(visible).toBeCloseTo(48.4, 1);
    expect(54 - visible).toBeCloseTo(5.6, 1);
  });
});
