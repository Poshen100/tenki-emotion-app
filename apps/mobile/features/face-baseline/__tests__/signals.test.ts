import { deriveEnvironmentChecks, ENV_THRESHOLDS } from '../utils/environment';
import {
  getCameraPermissionProvider,
  getEnvironmentSignalSource,
  getQualitySignalSource,
  getFaceDetectorProvider,
  setEnvironmentSignalSource,
  setFaceDetectorProvider,
  resetSignalProviders,
} from '../signals/registry';
import { isQualityOk } from '../utils/qualityThresholds';

describe('deriveEnvironmentChecks', () => {
  it('passes all checks for an ideal signal', () => {
    expect(deriveEnvironmentChecks({ brightness: 0.9, distance: 0.9, stabilityJitter: 0.1 })).toEqual({
      lighting: true,
      distance: true,
      stability: true,
    });
  });

  it('fails the matching check at each boundary', () => {
    const dim = deriveEnvironmentChecks({ brightness: ENV_THRESHOLDS.brightness - 0.01, distance: 0.9, stabilityJitter: 0.1 });
    expect(dim.lighting).toBe(false);
    const far = deriveEnvironmentChecks({ brightness: 0.9, distance: ENV_THRESHOLDS.distance - 0.01, stabilityJitter: 0.1 });
    expect(far.distance).toBe(false);
    const shaky = deriveEnvironmentChecks({ brightness: 0.9, distance: 0.9, stabilityJitter: ENV_THRESHOLDS.stabilityJitter + 0.01 });
    expect(shaky.stability).toBe(false);
  });

  it('clamps out-of-range inputs', () => {
    expect(deriveEnvironmentChecks({ brightness: 5, distance: 5, stabilityJitter: -5 })).toEqual({
      lighting: true,
      distance: true,
      stability: true,
    });
  });
});

describe('signal registry', () => {
  afterEach(resetSignalProviders);

  it('defaults to mock providers that let the flow proceed', () => {
    expect(getCameraPermissionProvider().get()).toBe('unknown');
    expect(deriveEnvironmentChecks(getEnvironmentSignalSource().read())).toEqual({
      lighting: true,
      distance: true,
      stability: true,
    });
    expect(isQualityOk(getQualitySignalSource().read())).toBe(true);
    expect(getFaceDetectorProvider().faceCount()).toBe(0);
  });

  it('mock permission request resolves to granted', async () => {
    await expect(getCameraPermissionProvider().request()).resolves.toBe('granted');
  });

  it('injects and restores real implementations', () => {
    setEnvironmentSignalSource({ read: () => ({ brightness: 0, distance: 0, stabilityJitter: 1 }) });
    setFaceDetectorProvider({ lockState: () => 'locked', faceCount: () => 1 });

    expect(deriveEnvironmentChecks(getEnvironmentSignalSource().read())).toEqual({
      lighting: false,
      distance: false,
      stability: false,
    });
    expect(getFaceDetectorProvider().lockState()).toBe('locked');

    resetSignalProviders();
    expect(getFaceDetectorProvider().lockState()).toBe('searching');
  });
});
