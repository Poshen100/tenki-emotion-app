// DORMANT: awaiting multi-modal-blend wiring (feature barrel not yet consumed). Not an orphan; do not delete.
/**
 * @module finger-precision/utils/precisionProgress
 * @description Beat-counting progress and tier calculations.
 *
 * @version 1.0
 */

import type { PrecisionProgress } from '../types';

export const TIERS = {
  QUICK: { beats: 30, name: 'quick' },
  STABLE: { beats: 60, name: 'stable' },
  STRONG: { beats: 90, name: 'strong' },
  BEST: { beats: 150, name: 'best' },
} as const;

export function calculatePrecisionProgress(
  validBeats: number,
  elapsedMs: number
): PrecisionProgress {
  const targetBeats = TIERS.BEST.beats;
  const overallProgress = Math.min(1, validBeats / targetBeats);
  const canStopEarly = validBeats >= TIERS.STABLE.beats;

  let currentTier: PrecisionProgress['currentTier'] = 'quick';
  let tierProgress = 0;

  if (validBeats < TIERS.QUICK.beats) {
    currentTier = 'quick';
    tierProgress = validBeats / TIERS.QUICK.beats;
  } else if (validBeats < TIERS.STABLE.beats) {
    currentTier = 'stable';
    tierProgress = (validBeats - TIERS.QUICK.beats) / (TIERS.STABLE.beats - TIERS.QUICK.beats);
  } else if (validBeats < TIERS.STRONG.beats) {
    currentTier = 'strong';
    tierProgress = (validBeats - TIERS.STABLE.beats) / (TIERS.STRONG.beats - TIERS.STABLE.beats);
  } else {
    currentTier = 'best';
    tierProgress = Math.min(
      1,
      (validBeats - TIERS.STRONG.beats) / (TIERS.BEST.beats - TIERS.STRONG.beats)
    );
  }

  return {
    validBeats,
    targetBeats,
    elapsedMs,
    currentTier,
    tierProgress,
    overallProgress,
    canStopEarly,
  };
}
