/**
 * @module face-baseline/utils/progress
 * @description Phase-weighted capture progress math.
 * Neutral capture is weighted 60%, motion capture 40% of total capture progress.
 */

/** Relative weights of the two capture phases. Must sum to 1. */
export const PHASE_WEIGHTS = { neutral: 0.6, motion: 0.4 } as const;

/** Clamps a value into the [0, 1] range. */
export function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

/**
 * Combined capture progress (0–1) from the two phase progresses.
 * Used for the segmented bar that spans neutral → motion.
 */
export function captureProgress(neutral: number, motion: number): number {
  return clamp01(
    clamp01(neutral) * PHASE_WEIGHTS.neutral + clamp01(motion) * PHASE_WEIGHTS.motion,
  );
}
