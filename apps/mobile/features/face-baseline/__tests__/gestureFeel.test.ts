/**
 * @module face-baseline/__tests__/gestureFeel
 * @description Holds the gesture grammar to its two promises.
 *
 * The first is the founder's call: poor signal quality may change how the hold
 * feels and must never change what it costs. The second is the rule this
 * session keeps re-learning: a haptic bound to a continuously rising value
 * leaves the phone buzzing, so charge pulses are edge triggered.
 */
import { createPulseProfile } from '../utils/pulse';
import {
  BASE_CHARGE_HALF_LIFE_MS,
  CHARGE_STEPS,
  HOLD_TO_CONFIRM_MS,
  MAX_VISUAL_DRAG,
  MIN_HAPTIC_SHARPNESS,
  NO_RESISTANCE,
  SWIPE_MAX_DX,
  SWIPE_MIN_DY,
  SWIPE_MIN_VELOCITY,
  chargeHalfLifeMs,
  chargeProgress,
  chargeStepCrossed,
  chargeStepPulse,
  resistance,
  swipeIntent,
} from '../utils/gestureFeel';

const PROFILE = createPulseProfile();

/** Milliseconds of holding before the charge first reads as complete. */
function msToComplete(stepMs: number): number {
  for (let held = 0; held <= HOLD_TO_CONFIRM_MS * 4; held += stepMs) {
    if (chargeProgress(held, HOLD_TO_CONFIRM_MS) >= 1) return held;
  }
  return Number.POSITIVE_INFINITY;
}

describe('resistance must not cost the user anything', () => {
  it('carries no unit of time in its shape', () => {
    // A field named for a duration would be a way to smuggle the cost back in.
    for (const key of Object.keys(resistance(0, false))) {
      expect(key).not.toMatch(/ms|duration|delay|time|required|threshold/i);
    }
  });

  it('takes exactly as long to complete at every quality', () => {
    const baseline = msToComplete(10);
    expect(Number.isFinite(baseline)).toBe(true);

    for (let quality = 0; quality <= 1.0001; quality += 0.05) {
      // resistance() is computed but deliberately cannot reach chargeProgress.
      resistance(quality, false);
      expect(msToComplete(10)).toBe(baseline);
    }
  });

  it('dulls the feel as quality falls, within bounds', () => {
    const good = resistance(1, false);
    const bad = resistance(0, false);

    expect(good).toEqual(NO_RESISTANCE);
    expect(bad.hapticSharpness).toBeLessThan(good.hapticSharpness);
    expect(bad.hapticSharpness).toBeGreaterThanOrEqual(MIN_HAPTIC_SHARPNESS);
    expect(bad.visualDrag).toBeGreaterThan(good.visualDrag);
    expect(bad.visualDrag).toBeLessThanOrEqual(MAX_VISUAL_DRAG);
  });

  it('disappears entirely under reduced motion', () => {
    for (const quality of [0, 0.3, 0.7, 1]) {
      expect(resistance(quality, true)).toEqual(NO_RESISTANCE);
    }
  });

  it('only ever lengthens the visual easing, never the hold', () => {
    expect(chargeHalfLifeMs(NO_RESISTANCE)).toBe(BASE_CHARGE_HALF_LIFE_MS);
    expect(chargeHalfLifeMs(resistance(0, false))).toBeGreaterThan(BASE_CHARGE_HALF_LIFE_MS);
  });
});

describe('chargeProgress', () => {
  it('runs 0 to 1 over the required hold', () => {
    expect(chargeProgress(0, HOLD_TO_CONFIRM_MS)).toBe(0);
    expect(chargeProgress(HOLD_TO_CONFIRM_MS / 2, HOLD_TO_CONFIRM_MS)).toBeCloseTo(0.5, 10);
    expect(chargeProgress(HOLD_TO_CONFIRM_MS, HOLD_TO_CONFIRM_MS)).toBe(1);
  });

  it('never overflows or returns NaN', () => {
    expect(chargeProgress(HOLD_TO_CONFIRM_MS * 10, HOLD_TO_CONFIRM_MS)).toBe(1);
    expect(chargeProgress(-500, HOLD_TO_CONFIRM_MS)).toBe(0);
    expect(chargeProgress(Number.NaN, HOLD_TO_CONFIRM_MS)).toBe(0);
    expect(chargeProgress(100, 0)).toBe(1);
  });
});

describe('charge haptics are edge triggered', () => {
  it('fires once per step across a full hold, not once per frame', () => {
    let previous = 0;
    let fired = 0;

    // 16ms frames, run one frame past the requirement because that is when a
    // real timer first observes a full charge. The naive binding that watches
    // the value itself would fire on ~56 of these.
    for (let held = 0; held <= HOLD_TO_CONFIRM_MS + 16; held += 16) {
      const next = chargeProgress(held, HOLD_TO_CONFIRM_MS);
      if (chargeStepCrossed(previous, next) !== null) fired++;
      previous = next;
    }

    expect(fired).toBe(CHARGE_STEPS.length);
  });

  it('stays silent when the progress does not move', () => {
    expect(chargeStepCrossed(0.5, 0.5)).toBeNull();
    expect(chargeStepCrossed(0.9, 0.9)).toBeNull();
  });

  it('stays silent on release', () => {
    expect(chargeStepCrossed(0.8, 0)).toBeNull();
    expect(chargeStepCrossed(1, 0.4)).toBeNull();
  });

  it('collapses a coarse jump into a single pulse', () => {
    // A timer that stalls and jumps past two thresholds must not double-buzz.
    expect(chargeStepCrossed(0.2, 0.8)).toBe(2);
  });

  it('ignores NaN rather than firing', () => {
    expect(chargeStepCrossed(Number.NaN, 0.5)).toBeNull();
    expect(chargeStepCrossed(0.1, Number.NaN)).toBeNull();
  });
});

describe('chargeStepPulse', () => {
  it('rises in intensity toward the commit', () => {
    const peaks = CHARGE_STEPS.map((_, i) =>
      Math.max(...chargeStepPulse(i, PROFILE).map((s) => s.intensity)),
    );

    for (let i = 1; i < peaks.length; i++) {
      expect(peaks[i]).toBeGreaterThan(peaks[i - 1]);
    }
  });

  it('stays inside the safe intensity range', () => {
    for (let i = 0; i < CHARGE_STEPS.length; i++) {
      for (const step of chargeStepPulse(i, PROFILE)) {
        expect(step.intensity).toBeGreaterThan(0);
        expect(step.intensity).toBeLessThanOrEqual(1);
        expect(step.durationMs).toBeGreaterThan(0);
      }
    }
  });
});

describe('swipeIntent', () => {
  it('accepts a fast, straight upward flick', () => {
    expect(swipeIntent(0, -(SWIPE_MIN_DY + 20), -(SWIPE_MIN_VELOCITY + 100))).toBe('retry');
  });

  it('rejects a slow drag, however long', () => {
    expect(swipeIntent(0, -400, -50)).toBeNull();
  });

  it('rejects a fast flick that barely moves', () => {
    expect(swipeIntent(0, -10, -1200)).toBeNull();
  });

  it('rejects a diagonal, leaving the system back gesture alone', () => {
    expect(swipeIntent(SWIPE_MAX_DX + 10, -200, -900)).toBeNull();
    expect(swipeIntent(-(SWIPE_MAX_DX + 10), -200, -900)).toBeNull();
  });

  it('rejects downward motion', () => {
    expect(swipeIntent(0, 300, 900)).toBeNull();
  });

  it('rejects NaN', () => {
    expect(swipeIntent(Number.NaN, -200, -900)).toBeNull();
    expect(swipeIntent(0, Number.NaN, -900)).toBeNull();
    expect(swipeIntent(0, -200, Number.NaN)).toBeNull();
  });
});
