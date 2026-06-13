/**
 * @module face-baseline/utils/confidence
 * @description Baseline confidence helpers. Confidence (0–1) reflects how well
 * the captured signal supports a reliable personal reference. It is a quality
 * indicator only — never a score, diagnosis, or judgement of the user.
 */

import type { QualityMetrics } from '../types/faceBaseline.types';
import { clamp01 } from './progress';

/** Qualitative confidence bands used to pick reassurance copy. */
export type ConfidenceBand = 'low' | 'moderate' | 'high';

/**
 * Estimates baseline confidence (0–1) from the generic capture signals only.
 * Weighted toward signal quality and stillness, which matter most. Retained for
 * callers that pre-date face-landmark signals; prefer {@link totalBaselineConfidence}.
 */
export function estimateConfidence(q: QualityMetrics): number {
  const stillness = 1 - clamp01(q.motion);
  const weighted =
    clamp01(q.sqi) * 0.4 +
    stillness * 0.3 +
    clamp01(q.coverage) * 0.2 +
    clamp01(q.brightness) * 0.1;
  return clamp01(weighted);
}

/**
 * Aggregate baseline confidence (0–1) across all enrollment signals — the
 * `totalBaselineConfidence` the founder spec calls for. Folds the generic
 * capture signals together with the face-landmark signals (landmark tracking,
 * head-pose range, lighting uniformity, eye visibility, neutral expression).
 * Weights sum to 1. A quality indicator only — never a score or judgement.
 */
export function totalBaselineConfidence(q: QualityMetrics): number {
  const stillness = 1 - clamp01(q.motion);
  const weighted =
    clamp01(q.sqi) * 0.18 +
    stillness * 0.14 +
    clamp01(q.coverage) * 0.12 +
    clamp01(q.brightness) * 0.06 +
    clamp01(q.landmarkConfidence) * 0.18 +
    clamp01(q.headPoseRange) * 0.1 +
    clamp01(q.lightingUniformity) * 0.06 +
    clamp01(q.eyeVisibility) * 0.06 +
    clamp01(q.neutralExpressionConfidence) * 0.1;
  return clamp01(weighted);
}

/** Maps a confidence value to a qualitative band. */
export function confidenceBand(confidence: number): ConfidenceBand {
  if (confidence >= 0.8) return 'high';
  if (confidence >= 0.55) return 'moderate';
  return 'low';
}
