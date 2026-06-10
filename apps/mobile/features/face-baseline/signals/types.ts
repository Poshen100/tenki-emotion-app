/**
 * @module face-baseline/signals/types
 * @description Library-agnostic provider contracts for the real-signal sources
 * the flow needs. Phase 2 implements these against whatever camera/detection
 * stack is chosen (vision-camera, expo-camera, …) and injects them via the
 * registry; nothing in Phase 1 depends on a specific native library.
 */

import type {
  FaceLockState,
  PermissionState,
  QualityMetrics,
} from '../types/faceBaseline.types';
import type { RawEnvironmentSignal } from '../utils/environment';

/** Camera permission lifecycle, backed by the platform permission API. */
export interface CameraPermissionProvider {
  /** Current cached permission state. */
  get: () => PermissionState;
  /** Request permission; resolves to the resulting state. */
  request: () => Promise<PermissionState>;
}

/** Polls a normalized environment signal (lighting/distance/stability). */
export interface EnvironmentSignalSource {
  read: () => RawEnvironmentSignal;
}

/** Polls normalized capture quality metrics. */
export interface QualitySignalSource {
  read: () => QualityMetrics;
}

/** Reports face acquisition/lock state from the detector. */
export interface FaceDetectorProvider {
  lockState: () => FaceLockState;
  faceCount: () => number;
}
