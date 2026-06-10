/**
 * @module face-baseline/signals
 * @description Barrel for the library-agnostic signal seam (Phase 2 swap point).
 */
export type {
  CameraPermissionProvider,
  EnvironmentSignalSource,
  QualitySignalSource,
  FaceDetectorProvider,
} from './types';
export {
  setCameraPermissionProvider,
  setEnvironmentSignalSource,
  setQualitySignalSource,
  setFaceDetectorProvider,
  getCameraPermissionProvider,
  getEnvironmentSignalSource,
  getQualitySignalSource,
  getFaceDetectorProvider,
  resetSignalProviders,
} from './registry';
