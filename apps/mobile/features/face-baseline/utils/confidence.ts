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
 * Estimates baseline confidence (0–1) from mean capture quality.
 * Weighted toward signal quality and stillness, which matter most.
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

/** Maps a confidence value to a qualitative band. */
export function confidenceBand(confidence: number): ConfidenceBand {
  if (confidence >= 0.8) return 'high';
  if (confidence >= 0.55) return 'moderate';
  return 'low';
}
