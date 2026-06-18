/**
 * @module baseline/multi-modal-blend
 * @description Blends finger PPG readings with the face baseline profile and calculates blended confidence.
 *
 * @version 1.0
 */

import type { BaselineProfile, BiometricReading, SignalQuality } from '../common/types';
import { updateBaselineProfile } from './baseline';

export interface BlendInput {
  faceBaseline: BaselineProfile;
  fingerReading: BiometricReading;
  fingerQuality: SignalQuality;
}

export interface BlendResult {
  blendedBaseline: BaselineProfile;
  blendMode: 'high_confidence_blend' | 'signal_added' | 'face_only';
  confidenceUplift: number;
}

/**
 * Blends the finger scan reading into the existing face baseline profile,
 * and determines the blended confidence level.
 */
export function blendFingerWithFaceBaseline(input: BlendInput): BlendResult {
  const { faceBaseline, fingerReading, fingerQuality } = input;

  // 1. Calculate finger confidence based on signal quality coverage and stability
  const fingerConfidence = Math.min(1, Math.max(0, fingerQuality.score / 100));

  // 2. Determine blend mode and compute blended confidence
  // We assume a hypothetical baseline/face confidence derived from total scans or maturity.
  // A mature face baseline has high confidence (e.g. 0.8), a new one has lower (e.g. 0.5).
  let faceConfidence = 0.5;
  if (faceBaseline.maturity === 'mature') faceConfidence = 0.85;
  else if (faceBaseline.maturity === 'ready') faceConfidence = 0.70;
  else if (faceBaseline.maturity === 'building') faceConfidence = 0.55;

  let blendMode: BlendResult['blendMode'] = 'face_only';
  let blendedConfidence = faceConfidence;

  if (fingerConfidence >= 0.80) {
    blendMode = 'high_confidence_blend';
    blendedConfidence = faceConfidence * 0.55 + fingerConfidence * 0.45;
  } else if (fingerConfidence >= 0.55) {
    blendMode = 'signal_added';
    blendedConfidence = faceConfidence * 0.70 + fingerConfidence * 0.30;
  } else {
    blendMode = 'face_only';
    blendedConfidence = faceConfidence * 0.85 + fingerConfidence * 0.15;
  }

  const confidenceUplift = Math.max(0, blendedConfidence - faceConfidence);

  // 3. Update baseline profile using Welford's algorithm via the finger reading
  // We use stress proxy score of 50 (neutral) for the calibration update.
  const blendedBaseline = updateBaselineProfile(faceBaseline, fingerReading, 50);

  return {
    blendedBaseline,
    blendMode,
    confidenceUplift: Math.round(confidenceUplift * 100) / 100,
  };
}
