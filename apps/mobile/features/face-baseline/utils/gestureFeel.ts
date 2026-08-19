/**
 * @module face-baseline/utils/gestureFeel
 * @description The grammar of the app's gestures, as pure functions.
 *
 * Fourth time using the same shape as `choreography.ts`, `orbPhysics.ts` and
 * `atmosphere.ts`: how an interaction *feels* is decided here, where jest can
 * reach it without a device, and components are left holding only the wiring.
 *
 * ## The rule that is not aesthetic
 *
 * Poor signal quality changes how the hold *feels* — blunter haptics, a
 * laggier charge bar — and changes **nothing about how long it takes**. That
 * is enforced structurally rather than by comment: {@link chargeProgress}
 * takes no quality argument, and {@link Resistance} carries no unit of time.
 * Someone with a tremor, uncontrollable lighting, or a poor camera feels the
 * instrument working harder; they are never locked out by it.
 *
 * Haptics are edge triggered through {@link chargeStepCrossed} for the same
 * reason as in `choreography.ts`: binding touch to a continuously rising value
 * leaves the phone buzzing without pause, which reads as a fault.
 *
 * @see apps/mobile/features/face-baseline/utils/choreography.ts
 */
import { clamp01 } from './progress';
import { scanEventPulse, type HapticPattern, type PulseProfile } from './pulse';

// ─────────────────────────────────────────────
// Hold to confirm
// ─────────────────────────────────────────────

/** How long a deliberate, irreversible action must be held. */
export const HOLD_TO_CONFIRM_MS = 900;

/** Progress values at which the charge is felt. The last one is the commit. */
export const CHARGE_STEPS = [0.25, 0.5, 0.75, 1] as const;

/**
 * Charge progress for a hold.
 *
 * Deliberately takes only time. There is no quality parameter, and adding one
 * would be the bug — see the module note.
 *
 * @param heldMs - How long the press has been down.
 * @param requiredMs - How long a full charge takes.
 * @returns Progress 0–1.
 */
export function chargeProgress(heldMs: number, requiredMs: number): number {
  if (!Number.isFinite(heldMs) || !Number.isFinite(requiredMs)) return 0;
  if (requiredMs <= 0) return 1;
  return clamp01(heldMs / requiredMs);
}

/**
 * The charge step crossed between two samples, if any.
 *
 * Returns the *highest* step crossed, so a coarse timer that jumps past two
 * thresholds still produces one pulse rather than two stacked on top of each
 * other. Backwards movement — a release — is silent by design: letting go is
 * not an event worth feeling.
 *
 * @param previous - Progress at the last sample.
 * @param next - Progress now.
 * @returns Index into {@link CHARGE_STEPS}, or null if nothing was crossed.
 */
export function chargeStepCrossed(previous: number, next: number): number | null {
  if (!Number.isFinite(previous) || !Number.isFinite(next)) return null;
  if (next <= previous) return null;

  let crossed: number | null = null;
  for (let i = 0; i < CHARGE_STEPS.length; i++) {
    const step = CHARGE_STEPS[i];
    if (step > previous && step <= next) crossed = i;
  }
  return crossed;
}

/** Intensity multipliers for the pre-commit steps. The commit is its own event. */
const CHARGE_RAMP: readonly number[] = [1, 1.4, 1.9];

/**
 * Haptic for one charge step, personalized by the user's pulse profile.
 *
 * Built out of the existing ceremony events rather than a new table of
 * patterns: the intermediate steps are a `scan_tick` at rising intensity, and
 * the final step borrows `face_locked` — the same beat the app already uses to
 * mean "this is now held". Nothing new to keep in sync with the engine mirror.
 *
 * @param stepIndex - Index into {@link CHARGE_STEPS}.
 * @param profile - The user's evolving pulse profile.
 * @returns A pattern ready for `playPattern`.
 */
export function chargeStepPulse(stepIndex: number, profile: PulseProfile): HapticPattern {
  if (stepIndex >= CHARGE_STEPS.length - 1) return scanEventPulse('face_locked', profile);

  const ramp = CHARGE_RAMP[Math.max(0, stepIndex)] ?? 1;
  return scanEventPulse('scan_tick', profile).map((step) => ({
    ...step,
    intensity: clamp01(step.intensity * ramp),
  }));
}

// ─────────────────────────────────────────────
// Resistance — feel only
// ─────────────────────────────────────────────

/**
 * How much harder the instrument feels to work when the signal is poor.
 *
 * Note what is absent: no duration, no delay, no threshold. Resistance can
 * only ever change the texture of the interaction, never its cost.
 */
export interface Resistance {
  /** 0.4–1. Lower is blunter, more smeared haptics. */
  hapticSharpness: number;
  /** 0–{@link MAX_VISUAL_DRAG}. How far the charge bar lags the real progress. */
  visualDrag: number;
}

/** Ceiling on the visual lag. Beyond this the bar stops reading as responsive. */
export const MAX_VISUAL_DRAG = 0.35;

/** Floor on haptic sharpness. Below this the steps stop being distinguishable. */
export const MIN_HAPTIC_SHARPNESS = 0.4;

/** Resistance under ideal conditions — nothing dulled, nothing lagging. */
export const NO_RESISTANCE: Resistance = Object.freeze({
  hapticSharpness: 1,
  visualDrag: 0,
});

/**
 * Resistance for the current signal quality.
 *
 * @param quality - Capture signal quality, 0–1.
 * @param reducedMotion - When true there is no resistance at all: drag is a
 *   motion effect, and dulled haptics without the matching visual would be a
 *   cue the user cannot interpret.
 * @returns A bounded {@link Resistance}.
 */
export function resistance(quality: number, reducedMotion: boolean): Resistance {
  if (reducedMotion) return NO_RESISTANCE;

  const poor = 1 - clamp01(quality);
  return {
    hapticSharpness: 1 - poor * (1 - MIN_HAPTIC_SHARPNESS),
    visualDrag: poor * MAX_VISUAL_DRAG,
  };
}

/** Half-life the charge bar eases with when nothing is resisting. */
export const BASE_CHARGE_HALF_LIFE_MS = 40;

/**
 * Easing half-life for the charge bar, for use with `orbPhysics.dampedApproach`.
 *
 * This is the *animation* smoothing constant, not the hold requirement — it
 * changes how the bar catches up to the progress, never what the progress is.
 *
 * @param value - Current resistance.
 * @returns Half-life in milliseconds.
 */
export function chargeHalfLifeMs(value: Resistance): number {
  return BASE_CHARGE_HALF_LIFE_MS * (1 + clamp01(value.visualDrag) * 2);
}

// ─────────────────────────────────────────────
// Swipe
// ─────────────────────────────────────────────

/** What a completed swipe asks for. */
export type SwipeIntent = 'retry';

/** Minimum upward travel, in points. */
export const SWIPE_MIN_DY = 72;
/** Maximum sideways drift before the gesture stops counting as vertical. */
export const SWIPE_MAX_DX = 60;
/** Minimum upward speed, in points per second. */
export const SWIPE_MIN_VELOCITY = 350;

/**
 * Classifies a finished pan.
 *
 * Upward, not sideways: iOS reserves the horizontal edge drag for interactive
 * back, so a left- or right-swipe shortcut would fight the system gesture.
 *
 * Distance alone is not enough — a slow drag down the screen covers plenty of
 * it — so direction purity and speed are required too.
 *
 * @param dx - Horizontal travel, points.
 * @param dy - Vertical travel, points. Negative is upward.
 * @param velocityY - Vertical speed, points per second. Negative is upward.
 * @returns The intent, or null when the gesture was not one.
 */
export function swipeIntent(dx: number, dy: number, velocityY: number): SwipeIntent | null {
  if (!Number.isFinite(dx) || !Number.isFinite(dy) || !Number.isFinite(velocityY)) return null;
  if (dy > -SWIPE_MIN_DY) return null;
  if (Math.abs(dx) > SWIPE_MAX_DX) return null;
  if (velocityY > -SWIPE_MIN_VELOCITY) return null;
  return 'retry';
}
