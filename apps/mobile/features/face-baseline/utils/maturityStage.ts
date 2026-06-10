/**
 * @module face-baseline/utils/maturityStage
 * @description Maps completed-scan counts to baseline maturity stages and the
 * per-stage scan targets shown on the Maturity Progress screen.
 */

import type { MaturityStage } from '../types/faceBaseline.types';

/** Minimum completed scans required to reach each stage. */
export const STAGE_THRESHOLDS = {
  new: 0,
  building: 1,
  ready: 5,
  mature: 15,
} as const;

/** Ordered stages, lowest → highest. */
export const STAGE_ORDER: readonly MaturityStage[] = ['new', 'building', 'ready', 'mature'] as const;

/** Returns the maturity stage for a given number of completed scans. */
export function maturityStage(scans: number): MaturityStage {
  if (scans >= STAGE_THRESHOLDS.mature) return 'mature';
  if (scans >= STAGE_THRESHOLDS.ready) return 'ready';
  if (scans >= STAGE_THRESHOLDS.building) return 'building';
  return 'new';
}

/**
 * Scans required to reach the NEXT stage from the current scan count.
 * At `mature` (terminal) this returns the mature threshold itself.
 */
export function scansRequiredForNextStage(scans: number): number {
  if (scans < STAGE_THRESHOLDS.building) return STAGE_THRESHOLDS.building;
  if (scans < STAGE_THRESHOLDS.ready) return STAGE_THRESHOLDS.ready;
  if (scans < STAGE_THRESHOLDS.mature) return STAGE_THRESHOLDS.mature;
  return STAGE_THRESHOLDS.mature;
}

/**
 * Progress (0–1) toward the next stage boundary, measured from the current
 * stage's lower threshold. Returns 1 once `mature` is reached.
 */
export function stageProgress(scans: number): number {
  const stage = maturityStage(scans);
  if (stage === 'mature') return 1;
  const lower = STAGE_THRESHOLDS[stage];
  const upper = scansRequiredForNextStage(scans);
  const span = upper - lower;
  if (span <= 0) return 1;
  const ratio = (scans - lower) / span;
  return Math.max(0, Math.min(1, ratio));
}
