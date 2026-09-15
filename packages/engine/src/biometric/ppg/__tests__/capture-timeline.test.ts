/**
 * Anchor first, refine naturally.
 *
 * 🔴 Everything here is about not taking something away: once a reading has
 * cleared the gate it belongs to the user, and nothing later — degradation, a
 * worse estimate, or the clock — may quietly remove it.
 */
import {
  ANCHOR_AT_SEC,
  INITIAL_TIMELINE,
  PRECISION_ENDS_SEC,
  REFINEMENT_ENDS_SEC,
  advanceCaptureTimeline,
  shouldKeepCapturing,
  supersedesAnchor,
  type CaptureTimelineState,
  type TimelineCandidate,
} from '../capture-timeline';
import { SCAN_MODE_CONFIGS } from '../../scan-modes';

const good = (over: Partial<TimelineCandidate> = {}): TimelineCandidate => ({
  heartRateBpm: 68,
  qualityScore: 80,
  durationSec: 30,
  meetsGate: true,
  ...over,
});

const refused = (over: Partial<TimelineCandidate> = {}): TimelineCandidate => ({
  heartRateBpm: null,
  qualityScore: 40,
  durationSec: 30,
  meetsGate: false,
  ...over,
});

/** Runs to an anchor and returns the state holding it. */
function anchored(): CaptureTimelineState {
  const state = advanceCaptureTimeline(INITIAL_TIMELINE, {
    elapsedSec: ANCHOR_AT_SEC,
    candidate: good(),
  });
  expect(state.anchor).not.toBeNull();
  return state;
}

describe('the anchor arrives early and costs nothing to keep', () => {
  it('is not offered before its moment, however good the signal looks', () => {
    const early = advanceCaptureTimeline(INITIAL_TIMELINE, {
      elapsedSec: ANCHOR_AT_SEC - 1,
      candidate: good({ qualityScore: 99 }),
    });
    expect(early.anchor).toBeNull();
    expect(early.canLeaveWithResult).toBe(false);
    expect(early.phase).toBe('anchoring');
  });

  it('is accepted at its moment only when the gate passes', () => {
    expect(
      advanceCaptureTimeline(INITIAL_TIMELINE, {
        elapsedSec: ANCHOR_AT_SEC,
        candidate: refused(),
      }).anchor,
    ).toBeNull();

    const state = anchored();
    expect(state.phase).toBe('anchor_ready');
    expect(state.canLeaveWithResult).toBe(true);
  });

  it('🔴 rests on the same heart-rate bar the long scan uses', () => {
    // Not a relaxed gate — the same number, quoted rather than restated.
    expect(SCAN_MODE_CONFIGS.quick_check.minQualityForHeartRate).toBe(
      SCAN_MODE_CONFIGS.full_scan.minQualityForHeartRate,
    );
    expect(ANCHOR_AT_SEC).toBe(SCAN_MODE_CONFIGS.quick_check.targetDurationSec);
  });
});

describe('nothing later may take the anchor away', () => {
  it('🔴 survives the signal falling apart afterwards', () => {
    // Rule 8. The user has their reading; only the extra detail is missing.
    const before = anchored();
    const after = advanceCaptureTimeline(before, {
      elapsedSec: REFINEMENT_ENDS_SEC,
      candidate: refused({ durationSec: 60 }),
    });
    expect(after.anchor).toEqual(before.anchor);
    expect(after.refinementIncomplete).toBe(true);
    expect(after.canLeaveWithResult).toBe(true);
  });

  it('🔴 is never replaced by a worse estimate', () => {
    // Rule 9. A longer capture is not automatically a better one — a refinement
    // whose last thirty seconds were ruined scores below the clean first thirty.
    const before = anchored();
    const worse = advanceCaptureTimeline(before, {
      elapsedSec: 50,
      candidate: good({ qualityScore: 60, heartRateBpm: 91, durationSec: 50 }),
    });
    expect(worse.anchor).toEqual(before.anchor);
    expect(worse.anchorSuperseded).toBe(false);
    if (before.anchor !== null) {
      expect(supersedesAnchor(good({ qualityScore: 60 }), before.anchor)).toBe(false);
    }
  });

  it('is replaced by a better one — and says so rather than swapping silently', () => {
    const before = anchored();
    const better = advanceCaptureTimeline(before, {
      elapsedSec: 50,
      candidate: good({ qualityScore: 95, heartRateBpm: 70, durationSec: 50 }),
    });
    expect(better.anchor?.heartRateBpm).toBe(70);
    expect(better.anchor?.durationSec).toBe(50);
    expect(better.anchorSuperseded).toBe(true);
  });

  it('is left alone by a tick that analysed nothing', () => {
    const before = anchored();
    const idle = advanceCaptureTimeline(before, { elapsedSec: 40, candidate: null });
    expect(idle.anchor).toEqual(before.anchor);
    expect(idle.anchorSuperseded).toBe(false);
  });

  it('never mutates the state it was given', () => {
    // Immutability as a property, not a promise: the caller's object is intact.
    const before = anchored();
    const snapshot = JSON.stringify(before);
    advanceCaptureTimeline(before, {
      elapsedSec: 50,
      candidate: good({ qualityScore: 99, durationSec: 50 }),
    });
    expect(JSON.stringify(before)).toBe(snapshot);
  });
});

describe('the user is never held longer than they chose', () => {
  it('🔴 stops at the end of refinement, even with nothing to show', () => {
    // ⚠️ The first version kept sampling past 60 s whenever no anchor existed,
    // hoping a marginal capture would still land one — which is precisely the
    // trap rule 7 forbids. A capture with nothing at 60 s ends with nothing.
    const nothing = advanceCaptureTimeline(INITIAL_TIMELINE, {
      elapsedSec: REFINEMENT_ENDS_SEC,
      candidate: refused({ durationSec: 60 }),
    });
    expect(nothing.anchor).toBeNull();
    expect(shouldKeepCapturing(nothing, REFINEMENT_ENDS_SEC)).toBe(false);
  });

  it('runs past refinement only when the user opted in', () => {
    const state = anchored();
    expect(shouldKeepCapturing(state, REFINEMENT_ENDS_SEC)).toBe(false);
    expect(shouldKeepCapturing(state, REFINEMENT_ENDS_SEC, true)).toBe(true);
    expect(shouldKeepCapturing(state, PRECISION_ENDS_SEC, true)).toBe(false);
  });

  it('names the three states the user has to tell apart', () => {
    // Rule 10: anchor captured / refining / precision optional.
    const ready = anchored();
    expect(ready.phase).toBe('anchor_ready');
    expect(
      advanceCaptureTimeline(ready, { elapsedSec: 45, candidate: null }).phase,
    ).toBe('refining');
    expect(
      advanceCaptureTimeline(ready, { elapsedSec: REFINEMENT_ENDS_SEC, candidate: null }).phase,
    ).toBe('refined');
    expect(
      advanceCaptureTimeline(ready, {
        elapsedSec: REFINEMENT_ENDS_SEC,
        candidate: null,
        precisionOptIn: true,
      }).phase,
    ).toBe('precision');
  });

  it('🔴 does not borrow the chest-strap mode’s name for a camera capture', () => {
    // The user-facing "Precision Session" is a longer CAMERA capture. The
    // engine's `precision` ScanMode is defined for an external beat sensor —
    // letting the two share a name would let a phone reading claim a grade of
    // evidence it cannot have.
    expect(SCAN_MODE_CONFIGS.precision.signalSource).toBe('external_beat_sensor');
    expect(PRECISION_ENDS_SEC).toBe(SCAN_MODE_CONFIGS.full_scan.targetDurationSec);
    expect(PRECISION_ENDS_SEC).not.toBe(SCAN_MODE_CONFIGS.precision.targetDurationSec);
  });
});
