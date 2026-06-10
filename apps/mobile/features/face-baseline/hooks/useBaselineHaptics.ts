/**
 * @module face-baseline/hooks/useBaselineHaptics
 * @description Dependency-free haptics façade. The feature never imports
 * `expo-haptics` directly so it stays buildable without the native stack; the
 * native phase injects a real implementation once via `setHapticsImplementation`.
 * Haptics are suppressed when Reduce Motion is on (never the sole feedback).
 *
 * INTEGRATION (expo-haptics): in app bootstrap, call
 *   setHapticsImplementation({ trigger: (k) => Haptics.<map>(k) })
 */
import { useMemo } from 'react';
import { useFaceBaselineStore } from '../store/faceBaselineStore';

/** Semantic haptic moments used across the flow (see SPEC Task 8). */
export type HapticKind =
  | 'selection'
  | 'impactLight'
  | 'impactMedium'
  | 'impactSoft'
  | 'success'
  | 'warning';

/** Platform haptics adapter, injected by the native layer. */
export interface HapticsImpl {
  trigger: (kind: HapticKind) => void;
}

let activeImpl: HapticsImpl | null = null;

/** Register (or clear) the platform haptics implementation. */
export function setHapticsImplementation(impl: HapticsImpl | null): void {
  activeImpl = impl;
}

/**
 * Pure gating rule: fire only when motion is allowed and an impl is present.
 * Exported for unit testing without a React renderer.
 */
export function shouldFireHaptic(reducedMotion: boolean, hasImpl: boolean): boolean {
  return !reducedMotion && hasImpl;
}

export interface BaselineHapticsApi {
  trigger: (kind: HapticKind) => void;
}

export function useBaselineHaptics(): BaselineHapticsApi {
  const reducedMotion = useFaceBaselineStore((s) => s.reducedMotion);

  return useMemo<BaselineHapticsApi>(
    () => ({
      trigger: (kind: HapticKind): void => {
        if (shouldFireHaptic(reducedMotion, activeImpl !== null)) {
          activeImpl?.trigger(kind);
        }
      },
    }),
    [reducedMotion],
  );
}
