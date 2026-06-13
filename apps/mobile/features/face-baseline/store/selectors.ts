/**
 * @module face-baseline/store/selectors
 * @description Pure derived selectors over FaceBaselineState. Kept separate
 * from the store so they are trivially unit-testable without React.
 */

import type { QualityStatus } from '../types/faceBaseline.types';
import { captureProgress } from '../utils/progress';
import { deriveQualityStatus, isQualityOk } from '../utils/qualityThresholds';
import type { FaceBaselineState } from './faceBaselineStore';

/** True when current quality passes every capture threshold. */
export const selectQualityOk = (s: FaceBaselineState): boolean => isQualityOk(s.quality);

/**
 * Overall progress (0–1) for the active phase: processing progress while
 * processing, otherwise weighted neutral + arc + stability capture progress.
 */
export const selectTotalProgress = (s: FaceBaselineState): number =>
  s.step === 'processing'
    ? s.processingProgress
    : captureProgress(s.neutralProgress, s.arcProgress, s.stabilityProgress);

/** Whether the user may start the scan (permission granted + environment ready). */
export const selectCanStartScan = (s: FaceBaselineState): boolean =>
  s.permission === 'granted' && s.envReady;

/** The single quality nudge to surface during capture (never a list). */
export const selectActiveQualityStatus = (s: FaceBaselineState): QualityStatus =>
  deriveQualityStatus(s.quality);

/** Progress (0–1) toward the current stage's scan target. */
export const selectMaturityRatio = (s: FaceBaselineState): number =>
  Math.min(1, s.scanCount / Math.max(1, s.scansRequired));

/** Whether the maturity flow should be the entry point (baseline already exists). */
export const selectHasBaseline = (s: FaceBaselineState): boolean => s.baselineEstablished;
