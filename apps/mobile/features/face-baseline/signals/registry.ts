/**
 * @module face-baseline/signals/registry
 * @description Injectable singletons for the signal providers, with safe mock
 * defaults so the flow runs end-to-end without any native stack. Phase 2 calls
 * the `set*` functions once at app bootstrap to swap in real implementations.
 *
 * Mirrors the `setHapticsImplementation` façade pattern already in use.
 */

import type {
  CameraPermissionProvider,
  EnvironmentSignalSource,
  FaceDetectorProvider,
  QualitySignalSource,
} from './types';

// ── Mock defaults (clearly synthetic; let the flow proceed for demos/tests) ──

const mockPermission: CameraPermissionProvider = {
  get: () => 'unknown',
  request: () => Promise.resolve('granted'),
};

const mockEnvironment: EnvironmentSignalSource = {
  read: () => ({ brightness: 0.8, distance: 0.85, stabilityJitter: 0.15 }),
};

const mockQuality: QualitySignalSource = {
  read: () => ({ sqi: 0.85, motion: 0.15, coverage: 0.9, brightness: 0.8 }),
};

const mockFaceDetector: FaceDetectorProvider = {
  lockState: () => 'searching',
  faceCount: () => 0,
};

// ── Active providers (default to mocks) ──

let permissionProvider: CameraPermissionProvider = mockPermission;
let environmentSource: EnvironmentSignalSource = mockEnvironment;
let qualitySource: QualitySignalSource = mockQuality;
let faceDetector: FaceDetectorProvider = mockFaceDetector;

/** Inject the real camera-permission provider (pass null to restore the mock). */
export function setCameraPermissionProvider(p: CameraPermissionProvider | null): void {
  permissionProvider = p ?? mockPermission;
}
/** Inject the real environment signal source (pass null to restore the mock). */
export function setEnvironmentSignalSource(s: EnvironmentSignalSource | null): void {
  environmentSource = s ?? mockEnvironment;
}
/** Inject the real quality signal source (pass null to restore the mock). */
export function setQualitySignalSource(s: QualitySignalSource | null): void {
  qualitySource = s ?? mockQuality;
}
/** Inject the real face detector (pass null to restore the mock). */
export function setFaceDetectorProvider(p: FaceDetectorProvider | null): void {
  faceDetector = p ?? mockFaceDetector;
}

/** Current active providers (whatever has been injected, else the mocks). */
export function getCameraPermissionProvider(): CameraPermissionProvider {
  return permissionProvider;
}
export function getEnvironmentSignalSource(): EnvironmentSignalSource {
  return environmentSource;
}
export function getQualitySignalSource(): QualitySignalSource {
  return qualitySource;
}
export function getFaceDetectorProvider(): FaceDetectorProvider {
  return faceDetector;
}

/** Restore every provider to its mock default (useful for tests/teardown). */
export function resetSignalProviders(): void {
  permissionProvider = mockPermission;
  environmentSource = mockEnvironment;
  qualitySource = mockQuality;
  faceDetector = mockFaceDetector;
}
