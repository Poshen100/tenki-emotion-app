// DORMANT: awaiting multi-modal-blend wiring (feature barrel not yet consumed). Not an orphan; do not delete.
/**
 * @module finger-precision/utils/confidence
 * @description Confidence calculations and multi-modal blending.
 *
 * @version 1.0
 */

export interface BlendedConfidenceResult {
  blendedConfidence: number;
  blendMode: 'high_confidence_blend' | 'signal_added' | 'face_only';
  confidenceUplift: number;
}

export function calculateBlendedConfidence(
  faceConfidence: number,
  fingerConfidence: number
): BlendedConfidenceResult {
  let blendMode: 'high_confidence_blend' | 'signal_added' | 'face_only' = 'face_only';
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

  // Ensure confidence is clamped between 0 and 1
  blendedConfidence = Math.min(1, Math.max(0, blendedConfidence));
  const confidenceUplift = Math.max(0, blendedConfidence - faceConfidence);

  return {
    blendedConfidence,
    blendMode,
    confidenceUplift,
  };
}
