/**
 * The contract camera respiratory rate has to satisfy before it exists.
 *
 * 🔴 founder rule, 2026-09-11: camera respiratory rate may be released only as
 * a standalone Breath Lock measurement. The capture layer does not exist yet
 * and `camera_breath_lock` is off, so none of this reaches a user today — these
 * tests exist so it cannot be wired up any other way later.
 */
import {
  BREATH_AGREEMENT_BRPM,
  BREATH_LOCK_MAX_SEC,
  BREATH_LOCK_MIN_SEC,
  MIN_BREATH_USABLE_FRAMES,
  assessBreathLock,
  reconcileBreathSources,
  type BreathLockInput,
} from '../breath-lock';

function goodCapture(overrides: Partial<BreathLockInput> = {}): BreathLockInput {
  return {
    frames: [],
    durationSec: 50,
    usableFrameCount: MIN_BREATH_USABLE_FRAMES + 100,
    rhythmCoherence: 0.8,
    rhythmSustained: 0.85,
    candidateBrpm: 14,
    beatTimingReliable: true,
    ...overrides,
  };
}

describe('the capture protocol is a range with a hard floor', () => {
  it('accepts a capture inside the window', () => {
    const quality = assessBreathLock(goodCapture());
    expect(quality.accepted).toBe(true);
    expect(quality.rejectionReasons).toEqual([]);
  });

  it('refuses one that ran short of the floor', () => {
    const quality = assessBreathLock(goodCapture({ durationSec: BREATH_LOCK_MIN_SEC - 1 }));
    expect(quality.accepted).toBe(false);
    expect(quality.rejectionReasons).toContain('capture_too_short');
  });

  it('refuses one that ran past the ceiling', () => {
    // 🔴 Not pedantry: past a minute most people have stopped breathing
    // naturally and started performing breathing, which measures something else.
    const quality = assessBreathLock(goodCapture({ durationSec: BREATH_LOCK_MAX_SEC + 5 }));
    expect(quality.rejectionReasons).toContain('capture_too_long');
  });
});

describe('the gates are independent of the pulse gates', () => {
  it('refuses a capture with no sustained rhythm even when everything else passed', () => {
    const quality = assessBreathLock(goodCapture({ rhythmSustained: 0.2 }));
    expect(quality.accepted).toBe(false);
    expect(quality.rejectionReasons).toContain('rhythm_not_sustained');
  });

  it('refuses one whose beat timing was not trustworthy', () => {
    // Respiration here is read out of beat intervals, so it can never be better
    // founded than they are.
    expect(assessBreathLock(goodCapture({ beatTimingReliable: false })).rejectionReasons)
      .toContain('beat_timing_unreliable');
  });

  it('refuses an implausible rate rather than reporting it', () => {
    expect(assessBreathLock(goodCapture({ candidateBrpm: 42 })).rejectionReasons)
      .toContain('implausible_rate');
    expect(assessBreathLock(goodCapture({ candidateBrpm: null })).rejectionReasons)
      .toContain('implausible_rate');
  });

  it('names every gate that failed, not just the first', () => {
    // A capture that failed four ways should say four things — the user fixing
    // one of them would otherwise hit the next and think nothing changed.
    const quality = assessBreathLock(
      goodCapture({ durationSec: 10, usableFrameCount: 5, rhythmCoherence: 0.1, candidateBrpm: 2 }),
    );
    expect(quality.rejectionReasons.length).toBeGreaterThanOrEqual(4);
  });

  it('records duration, usable frames and both rhythm measures whatever the verdict', () => {
    // Persisted quality metadata is part of the rule: provenance, duration,
    // quality and rejection reasons travel with the reading.
    const quality = assessBreathLock(goodCapture({ durationSec: 10 }));
    expect(quality.captureDurationSec).toBe(10);
    expect(quality.usableFrameCount).toBeGreaterThan(0);
    expect(quality.rhythmCoherence).toBeGreaterThan(0);
    expect(quality.rhythmSustained).toBeGreaterThan(0);
  });
});

describe('two sources are reconciled, never averaged', () => {
  it('reports one source on its own without claiming agreement', () => {
    const result = reconcileBreathSources({ brpm: 14, source: 'camera_ppg_derived' }, null);
    expect(result).toEqual({ status: 'single', brpm: 14, source: 'camera_ppg_derived' });
  });

  it('agrees when the two are inside the window', () => {
    const result = reconcileBreathSources(
      { brpm: 14, source: 'camera_ppg_derived' },
      { brpm: 15, source: 'phone_imu' },
    );
    expect(result.status).toBe('agree');
  });

  it('🔴 produces NO rate when they disagree materially', () => {
    // The whole point. Two sources 6 apart do not make a trustworthy number in
    // the middle — they make one of them wrong, and the mean of a right answer
    // and a wrong one is a third wrong answer with a decimal point on it.
    const result = reconcileBreathSources(
      { brpm: 11, source: 'camera_ppg_derived' },
      { brpm: 17, source: 'front_camera_motion' },
    );
    expect(result.status).toBe('conflict');
    expect(result).not.toHaveProperty('brpm');
  });

  it('🔴 never returns a value neither source measured', () => {
    // Even inside the agreement window: reporting the mean of 14 and 15 as 14.5
    // would put a number on screen that no instrument produced.
    for (const [a, b] of [
      [14, 15],
      [12, 13.5],
      [20, 18.4],
    ] as const) {
      const result = reconcileBreathSources(
        { brpm: a, source: 'camera_ppg_derived' },
        { brpm: b, source: 'phone_imu' },
      );
      if (result.status === 'agree') {
        expect([a, b]).toContain(result.brpm);
      }
    }
  });

  it('treats the window as a boundary, not a suggestion', () => {
    const inside = reconcileBreathSources(
      { brpm: 14, source: 'camera_ppg_derived' },
      { brpm: 14 + BREATH_AGREEMENT_BRPM, source: 'phone_imu' },
    );
    const outside = reconcileBreathSources(
      { brpm: 14, source: 'camera_ppg_derived' },
      { brpm: 14 + BREATH_AGREEMENT_BRPM + 0.5, source: 'phone_imu' },
    );
    expect(inside.status).toBe('agree');
    expect(outside.status).toBe('conflict');
  });

  it('says nothing when neither source had anything', () => {
    expect(reconcileBreathSources(null, null)).toEqual({ status: 'none' });
  });
});
