/**
 * @module face-baseline/hooks/useHoldToConfirm
 * @description Wires the hold-to-confirm grammar in `utils/gestureFeel.ts` to
 * a real press.
 *
 * The hook owns only the timer, the haptic dispatch and one animated value;
 * every decision about how the hold behaves lives in the pure module, where it
 * is tested. The animated value is driven with `setValue`, so the charge sweep
 * costs no React re-renders.
 *
 * ## Reduced motion is a tap, not a hold
 *
 * Charging is a motion effect with a physical cost. Someone who has asked the
 * OS for less motion should not have to hold a button down for a second to get
 * past it, so under Reduce Motion the same control confirms on a plain press.
 * The action is identical; only the ceremony is dropped.
 *
 * @see apps/mobile/features/face-baseline/utils/gestureFeel.ts
 */
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Animated } from 'react-native';
import { usePulseProfileStore } from '../../../stores/pulse-profile-store';
import { useFaceBaselineStore } from '../store/faceBaselineStore';
import { dampedApproach } from '../utils/orbPhysics';
import {
  HOLD_TO_CONFIRM_MS,
  chargeHalfLifeMs,
  chargeProgress,
  chargeStepCrossed,
  chargeStepPulse,
  resistance,
} from '../utils/gestureFeel';
import { useBaselineHaptics } from './useBaselineHaptics';

/** How often the charge is sampled. Roughly one animation frame. */
const TICK_MS = 16;

export interface HoldToConfirmOptions {
  /** Called once the charge completes, or immediately on tap under Reduce Motion. */
  onConfirm: () => void;
  /** Full charge duration. Defaults to {@link HOLD_TO_CONFIRM_MS}. */
  requiredMs?: number;
  /** Live signal quality 0–1. Affects only how the hold feels. */
  quality?: number;
  /** When true the control does nothing at all. */
  disabled?: boolean;
}

export interface HoldToConfirm {
  /** Eased charge 0–1, for the visual sweep. Never triggers a re-render. */
  progress: Animated.Value;
  /** True when the control expects a hold rather than a tap. */
  requiresHold: boolean;
  onPressIn: () => void;
  onPressOut: () => void;
  onPress: () => void;
}

export function useHoldToConfirm({
  onConfirm,
  requiredMs = HOLD_TO_CONFIRM_MS,
  quality = 1,
  disabled = false,
}: HoldToConfirmOptions): HoldToConfirm {
  const reducedMotion = useFaceBaselineStore((s) => s.reducedMotion);
  const profile = usePulseProfileStore((s) => s.profile);
  const haptics = useBaselineHaptics();

  const progress = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAt = useRef(0);
  const lastTickAt = useRef(0);
  /** Last charge value seen, so haptics fire on crossings rather than on values. */
  const lastCharge = useRef(0);
  /** Eased value trailing the real charge. */
  const displayed = useRef(0);

  const drag = useMemo(() => resistance(quality, reducedMotion), [quality, reducedMotion]);
  const requiresHold = !reducedMotion && !disabled;

  const stop = useCallback((): void => {
    if (timer.current !== null) {
      clearInterval(timer.current);
      timer.current = null;
    }
    lastCharge.current = 0;
    displayed.current = 0;
    progress.setValue(0);
  }, [progress]);

  // A press in flight when the screen goes away must not keep ticking.
  useEffect(() => stop, [stop]);

  const onPressIn = useCallback((): void => {
    if (!requiresHold || timer.current !== null) return;

    const now = Date.now();
    startedAt.current = now;
    lastTickAt.current = now;
    lastCharge.current = 0;
    displayed.current = 0;
    progress.setValue(0);

    timer.current = setInterval(() => {
      const at = Date.now();
      const charge = chargeProgress(at - startedAt.current, requiredMs);

      const step = chargeStepCrossed(lastCharge.current, charge);
      if (step !== null) haptics.playPattern(chargeStepPulse(step, profile));
      lastCharge.current = charge;

      displayed.current = dampedApproach(
        displayed.current,
        charge,
        at - lastTickAt.current,
        chargeHalfLifeMs(drag),
      );
      lastTickAt.current = at;
      progress.setValue(displayed.current);

      if (charge >= 1) {
        stop();
        onConfirm();
      }
    }, TICK_MS);
  }, [requiresHold, requiredMs, drag, profile, haptics, onConfirm, progress, stop]);

  const onPressOut = useCallback((): void => {
    // Letting go is silent by design — see chargeStepCrossed.
    stop();
  }, [stop]);

  const onPress = useCallback((): void => {
    if (disabled) return;
    // Only the tap path confirms; a completed hold has already fired.
    if (!requiresHold) onConfirm();
  }, [disabled, requiresHold, onConfirm]);

  return { progress, requiresHold, onPressIn, onPressOut, onPress };
}
