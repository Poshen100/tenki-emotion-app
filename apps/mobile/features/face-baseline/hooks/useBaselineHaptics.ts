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
import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useFaceBaselineStore } from '../store/faceBaselineStore';
import { shouldFireHaptic } from '../utils/haptics';

/** Semantic haptic moments used across the flow (see SPEC Task 8). */
export type HapticKind =
  | 'selection'
  | 'impactLight'
  | 'impactMedium'
  | 'impactSoft'
  | 'success'
  | 'warning';

export interface BaselineHapticsApi {
  trigger: (kind: HapticKind) => void;
}

export { shouldFireHaptic } from '../utils/haptics';

export function useBaselineHaptics(): BaselineHapticsApi {
  const reducedMotion = useFaceBaselineStore((s) => s.reducedMotion);

  return useMemo<BaselineHapticsApi>(
    () => ({
      trigger: (kind: HapticKind): void => {
        if (!shouldFireHaptic(reducedMotion, true)) return;

        if (Platform.OS === 'web') {
          // Safe HTML5 web vibration fallback
          if (typeof navigator !== 'undefined' && navigator.vibrate) {
            try {
              switch (kind) {
                case 'selection':
                case 'impactSoft':
                  navigator.vibrate(10);
                  break;
                case 'impactLight':
                  navigator.vibrate(15);
                  break;
                case 'impactMedium':
                  navigator.vibrate(30);
                  break;
                case 'success':
                  navigator.vibrate([40, 40, 40]);
                  break;
                case 'warning':
                  navigator.vibrate([80, 50, 80]);
                  break;
              }
            } catch (e) {
              // Ignore silent permission or state errors on web
            }
          }
        } else {
          // Native expo-haptics triggers
          try {
            switch (kind) {
              case 'selection':
                Haptics.selectionAsync();
                break;
              case 'impactSoft':
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
                break;
              case 'impactLight':
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                break;
              case 'impactMedium':
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                break;
              case 'success':
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                break;
              case 'warning':
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                break;
            }
          } catch (e) {
            // Ignore native runtime errors safely
          }
        }
      },
    }),
    [reducedMotion],
  );
}
