/**
 * @module face-baseline/hooks
 * @description Barrel for Face Baseline hooks. Signal hooks (camera permission,
 * face detection, environment/quality streams) are added in the native phase;
 * the screens currently use inline mocks marked `INTEGRATION`.
 */
export { useFaceBaselineMachine } from './useFaceBaselineMachine';
export type { FaceBaselineMachineApi } from './useFaceBaselineMachine';
export { useReducedMotion } from './useReducedMotion';
export {
  useBaselineHaptics,
  setHapticsImplementation,
  shouldFireHaptic,
} from './useBaselineHaptics';
export type { HapticKind, HapticsImpl, BaselineHapticsApi } from './useBaselineHaptics';
