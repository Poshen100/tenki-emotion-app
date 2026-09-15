/**
 * One stage, one instruction.
 *
 * 🔴 The two claims worth protecting: the screen never asks for more than one
 * thing at a time, and no stage runs ahead of the evidence the gate uses.
 */
import { INITIAL_READINESS, assessCaptureReadiness } from '../capture-readiness';
import {
  CAPTURE_INSTRUCTIONS,
  INSTRUCTION_PRIORITY,
  PULSE_LENS_STATES,
  resolveCaptureStage,
  type CaptureStageInput,
} from '../capture-stage';
import { assessExposureStability } from '../exposure-stability';
import type { LiveReading } from '../live';
import {
  INITIAL_PULSE_LOCK,
  LIVE_WINDOW_SEC,
  advancePulseLock,
  assessLiveWindow,
  recentFrames,
} from '../live';
import { synthesizePpg } from '../replay';
import type { PpgFrame } from '../types';

/** A camera that is re-deciding its own level. */
const HUNTING = {
  dcMedian: 190,
  dcDriftFraction: 0.31,
  largestStepFraction: 0.22,
  slowDriftDominates: true,
  framesPerSecond: 30,
  longestGapMs: 40,
  frameCount: 1200,
};

/** A live window plus lock, the way the surface has them. */
function live(frames: PpgFrame[], upToSec: number) {
  const t0 = frames[0].timestampMs;
  const upTo = frames.filter((f) => f.timestampMs <= t0 + upToSec * 1000);
  let lock = INITIAL_PULSE_LOCK;
  let reading = assessLiveWindow(recentFrames(upTo, LIVE_WINDOW_SEC), 'full_scan');
  for (let end = 2; end <= upToSec; end += 2) {
    reading = assessLiveWindow(
      recentFrames(
        frames.filter((f) => f.timestampMs <= t0 + end * 1000),
        LIVE_WINDOW_SEC,
      ),
      'full_scan',
    );
    lock = advancePulseLock(lock, reading);
  }
  return {
    reading,
    lock,
    exposure: assessExposureStability(upTo),
  } satisfies CaptureStageInput;
}

const clean = (overrides = {}) => synthesizePpg({ durationSec: 90, ...overrides }).frames;

describe('the screen asks for one thing at a time', () => {
  it('never returns more than one instruction, by construction', () => {
    // Structural: the return type holds a single value, not a list. Restated as
    // a test because "show one thing" was the entire point of the brief.
    const view = resolveCaptureStage(live(clean(), 40));
    expect(Array.isArray(view.instruction)).toBe(false);
  });

  it('picks the earliest fixable problem, not the worst-sounding one', () => {
    // 🔴 A finger that is off the lens AND moving AND over-exposed gets told to
    // cover the lens. Telling someone to hold still while their finger is not
    // on the camera is advice they cannot act on.
    const off = live(clean({ coverage: 0.05, motionAmplitude: 6 }), 40);
    const view = resolveCaptureStage({
      ...off,
      readiness: assessCaptureReadiness(clean({ coverage: 0.05 }).slice(0, 40), 0),
    });
    expect(view.instruction).toBe('cover_lens');
  });

  it('🔴 when two problems are true at once, the earlier-to-fix one wins', () => {
    // ⚠️ The first version of this test compared indexes inside
    // `INSTRUCTION_PRIORITY` — which is circular: it asserted the list is in the
    // order the list is in. Replacing the picker with "take any matching one"
    // left it green. These cases assert the OUTPUT instead, on inputs where two
    // conditions genuinely hold together.
    const base = live(clean(), 40);
    const both = (over: Partial<LiveReading>, exposure = base.exposure) =>
      resolveCaptureStage({
        ...base,
        exposure,
        reading: { ...base.reading, ...over },
      }).instruction;

    // Over-exposed AND moving AND cold → pressure first: the other two readings
    // are not trustworthy while the level is pinned.
    expect(
      both({ lightStability: 0.1, motionArtifact: 0.9, reasons: ['low_perfusion'] }),
    ).toBe('relax_touch');
    // 🔴 Over-exposed AND the camera hunting → the CAMERA, not the grip.
    // Saturation while auto-exposure is re-deciding the level is the camera's
    // doing; blaming the user's touch for it is a claim we cannot support.
    // (The first version ranked pressure first, contradicting this module's own
    // stated rationale — founder caught it in the COVERAGE LOCK brief.)
    expect(both({ lightStability: 0.1 }, HUNTING)).toBe('camera_adapting');
    // Exposure hunting AND moving → the camera first, for the same reason.
    expect(both({ motionArtifact: 0.9 }, HUNTING)).toBe('camera_adapting');
    // Moving AND cold → movement first; a cold finger is not fixable in-capture.
    expect(both({ motionArtifact: 0.9, reasons: ['low_perfusion'] })).toBe('hold_still');
    // Not on the lens beats everything, including a pinned exposure.
    expect(both({ contactCoverage: 0.1, lightStability: 0.1 })).toBe('cover_more');

    // And every instruction is reachable — an unlisted one would never show.
    expect([...INSTRUCTION_PRIORITY].sort()).toEqual([...CAPTURE_INSTRUCTIONS].sort());
  });

  it('says nothing when there is nothing to fix', () => {
    const view = resolveCaptureStage(live(clean(), 40));
    expect(view.instruction).toBeNull();
  });
});

describe('a stage never runs ahead of the evidence', () => {
  it('reaches locked only when the lock says so, and reports it as the reading gate', () => {
    const at40 = live(clean(), 40);
    const view = resolveCaptureStage(at40);
    expect(at40.lock.locked).toBe(true);
    expect(view.stage).toBe('pulse_locked');
    expect(view.wouldYieldReading).toBe(true);
  });

  it('is still searching for rhythm while the window is too short to look', () => {
    // 🔴 Below the rhythm minimum `rhythmicCoherence` is null — not zero. The
    // stage must not read that as "no pulse here".
    const early = live(clean(), 6);
    expect(early.reading.rhythmicCoherence).toBeNull();
    const view = resolveCaptureStage(early);
    expect(['searching_contact', 'locking_light', 'searching_rhythm']).toContain(view.stage);
    expect(view.wouldYieldReading).toBe(false);
  });

  it('never claims a candidate on a capture that ends in a refusal', () => {
    // The direction that matters: an optimistic instrument is dishonest, a
    // conservative one is not.
    const weak = live(clean({ perfusion: 0.08, seed: 991 }), 60);
    const view = resolveCaptureStage(weak);
    expect(['pulse_candidate', 'pulse_locked']).not.toContain(view.stage);
    expect(view.wouldYieldReading).toBe(false);
  });

  it('🔴 takes "candidate" from the reading gate, not from a rhythm number', () => {
    // ⚠️ The discriminating case, found by measuring rather than assumed: the
    // irregular fixture at 25 s has a rhythm component of 0.25 — above any
    // plausible hand-picked bar — while `meetsReadingGate` is still false. An
    // implementation that thresholded the rhythm number itself would call this
    // a candidate; the gate does not, and the gate is what the final reading
    // uses. (The weakly-perfused case above cannot catch this: it raises an
    // instruction, so it never reaches the candidate branch at all.)
    const irregular = live(clean({ beatJitterMs: 150, seed: 3131 }), 25);
    expect(irregular.reading.rhythmicCoherence ?? 0).toBeGreaterThan(0.2);
    expect(irregular.reading.meetsReadingGate).toBe(false);
    const view = resolveCaptureStage(irregular);
    expect(view.instruction).toBeNull();
    expect(view.stage).toBe('searching_rhythm');
  });

  it('treats a lost light field as needing adjustment, not as early progress', () => {
    // 🔴 "You had it, fix this" is a different message from "you are still
    // getting there". A capture that already reached the light field and then
    // degraded must not read as if it were starting over.
    //
    // ⚠️ And it takes `previousStage` to know that. The first version inferred
    // it from the window being long enough to assess rhythm, which is also true
    // of a capture that never had a light field — it would have told the user
    // they lost something they never had.
    const base = live(clean(), 40);
    const degraded = resolveCaptureStage({
      ...base,
      previousStage: 'pulse_locked',
      exposure: {
        dcMedian: 190,
        dcDriftFraction: 0.31,
        largestStepFraction: 0.22,
        slowDriftDominates: true,
        framesPerSecond: 30,
        longestGapMs: 40,
        frameCount: 1200,
      },
      lock: { consecutive: 0, locked: false },
    });
    expect(degraded.stage).toBe('needs_adjustment');
    expect(degraded.instruction).toBe('camera_adapting');

    // Same window, but nothing was ever established → still just getting there.
    const neverHadIt = resolveCaptureStage({
      ...base,
      exposure: {
        dcMedian: 190,
        dcDriftFraction: 0.31,
        largestStepFraction: 0.22,
        slowDriftDominates: true,
        framesPerSecond: 30,
        longestGapMs: 40,
        frameCount: 1200,
      },
      lock: { consecutive: 0, locked: false },
    });
    expect(neverHadIt.stage).toBe('locking_light');
    expect(neverHadIt.instruction).toBe('camera_adapting');
  });
});

describe('the pre-roll owns the verdict before the clock starts', () => {
  it('stays in contact/light stages while readiness has not passed', () => {
    const view = resolveCaptureStage({
      ...live(clean(), 40),
      readiness: INITIAL_READINESS,
    });
    expect(view.stage).toBe('searching_contact');
    // ⚠️ And it must not claim a reading is available — the capture has not
    // even begun.
    expect(view.wouldYieldReading).toBe(false);
  });
});

describe('the screen names one of the brief’s exact display states', () => {
  const at = (over: Partial<LiveReading>, extra: Partial<CaptureStageInput> = {}) => {
    const base = live(clean(), 40);
    return resolveCaptureStage({
      ...base,
      uncoveredCells: 0,
      ...extra,
      reading: { ...base.reading, ...over },
    });
  };

  it('maps each correction to its own state — the user acts differently on each', () => {
    expect(at({ contactCoverage: 0.1 }).lensState).toBe('coverage_gap');
    expect(at({ lightStability: 0.1 }).lensState).toBe('pressure_adjustment');
    expect(at({ motionArtifact: 0.9 }).lensState).toBe('field_shifted');
  });

  it('🔴 blames the camera, not the grip, when the exposure is hunting', () => {
    // The brief's own test: "exposure drift triggers light_locking, not a false
    // pressure claim". Saturation while auto-exposure re-decides the level is
    // the camera's doing — we cannot support a claim about the user's touch.
    expect(at({ lightStability: 0.1 }, { exposure: HUNTING }).lensState).toBe('light_locking');
  });

  it('🔴 cannot say "confirmed" while a cell is still bare', () => {
    const gap = at({}, { uncoveredCells: 3 });
    expect(gap.evidence.coverageConfirmed).toBe(false);
    expect(gap.evidence.allConfirmed).toBe(false);
    expect(gap.lensState).not.toBe('coverage_locked');
  });

  it('🔴 treats "we did not look" as not confirmed', () => {
    // Null is not zero. A capture with no coverage field must not render a tick.
    expect(at({}, { uncoveredCells: null }).evidence.coverageConfirmed).toBe(false);
    expect(at({}, { uncoveredCells: undefined }).evidence.coverageConfirmed).toBe(false);
  });

  it('reports the evidence row live, so it can stop being true', () => {
    // ⚠️ Staying visible is not staying green. A row that kept claiming
    // "confirmed" after the finger slipped is the sticky-lock dishonesty the
    // Pulse Lock exists to avoid.
    expect(at({}).evidence.allConfirmed).toBe(true);
    expect(at({ motionArtifact: 0.9 }).evidence.contactSteady).toBe(false);
    expect(at({ lightStability: 0.1 }).evidence.lightUniform).toBe(false);
    expect(at({}, { exposure: HUNTING }).evidence.lightUniform).toBe(false);
  });

  it('every state it can produce is one the brief named', () => {
    const seen = new Set<string>([
      at({ contactCoverage: 0.1 }).lensState,
      at({ lightStability: 0.1 }).lensState,
      at({ motionArtifact: 0.9 }).lensState,
      at({}).lensState,
      at({}, { exposure: HUNTING }).lensState,
      resolveCaptureStage({ ...live(clean(), 40), uncoveredCells: 0 }).lensState,
      resolveCaptureStage({ ...live(clean(), 6), uncoveredCells: 0 }).lensState,
    ]);
    for (const state of seen) expect(PULSE_LENS_STATES).toContain(state);
  });
});
