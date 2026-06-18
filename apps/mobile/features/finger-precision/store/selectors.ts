/**
 * @module finger-precision/store/selectors
 * @description Derived selectors over FingerPrecisionState.
 *
 * @version 1.0
 */

import type { FingerPrecisionState } from './fingerPrecisionStore';

export const selectReadinessReady = (s: FingerPrecisionState): boolean => s.readinessReady;

export const selectCanStartScan = (s: FingerPrecisionState): boolean =>
  s.cameraPermission === 'granted' && s.readinessReady;

export const selectTotalProgress = (s: FingerPrecisionState): number => {
  if (s.step === 'processing') {
    return s.processingProgress;
  }
  if (
    s.step === 'precision_build' ||
    s.step === 'quick_estimate' ||
    s.step === 'quality_recovery'
  ) {
    return s.precision.overallProgress;
  }
  return 0;
};

export const selectCanStopEarly = (s: FingerPrecisionState): boolean =>
  s.precision.canStopEarly;
