/**
 * @module face-baseline/utils/qualityThresholds
 * @description Capture quality gate + single-issue status derivation.
 */

import type { QualityMetrics, QualityStatus } from '../types/faceBaseline.types';

/**
 * Minimum quality required to keep capturing.
 * `motion` is an upper bound (lower is better); the rest are lower bounds.
 */
export const QUALITY_OK = {
  sqi: 0.7,
  motion: 0.35,
  coverage: 0.8,
  brightness: 0.45,
} as const;

/** Returns true when every quality dimension passes its threshold. */
export function isQualityOk(q: QualityMetrics): boolean {
  return (
    q.sqi >= QUALITY_OK.sqi &&
    q.motion <= QUALITY_OK.motion &&
    q.coverage >= QUALITY_OK.coverage &&
    q.brightness >= QUALITY_OK.brightness
  );
}

/**
 * Derives the single most important quality nudge to surface.
 * Priority: movement → low light → reframe. Exactly one status — never a list.
 */
export function deriveQualityStatus(q: QualityMetrics): QualityStatus {
  if (q.motion > QUALITY_OK.motion) return 'movement';
  if (q.brightness < QUALITY_OK.brightness) return 'lowLight';
  if (q.coverage < QUALITY_OK.coverage) return 'reframe';
  return 'good';
}
