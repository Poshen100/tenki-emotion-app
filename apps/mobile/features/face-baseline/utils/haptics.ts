/**
 * @module face-baseline/utils/haptics
 * @description Pure haptics gating logic. Lives in utils (dependency-free)
 * so the jest contract harness can test it without the react-native tree.
 */

/**
 * Pure gate for whether a haptic may fire.
 * Haptics require an available implementation and are suppressed when
 * Reduce Motion is on (haptics are never the sole feedback channel).
 *
 * @param reducedMotion - Whether the user has Reduce Motion enabled.
 * @param hasImplementation - Whether a haptics implementation is available.
 * @returns True when the haptic should fire.
 */
export function shouldFireHaptic(reducedMotion: boolean, hasImplementation: boolean): boolean {
  return hasImplementation && !reducedMotion;
}
