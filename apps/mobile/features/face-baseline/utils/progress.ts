/**
 * @module face-baseline/utils/progress
 * @description Phase-weighted capture progress math. The enrollment capture has
 * three phases: neutral anchor (the most important), guided arc, and stability
 * pass. Weights bias toward the neutral anchor while keeping a single, smoothly
 * closing progress halo across all three.
 */

/** Relative weights of the three capture phases. Must sum to 1. */
export const PHASE_WEIGHTS = { neutral: 0.5, arc: 0.3, stability: 0.2 } as const;

/** Clamps a value into the [0, 1] range. */
export function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

/**
 * Combined capture progress (0–1) from the three phase progresses.
 * Used for the segmented bar / halo that spans neutral → arc → stability.
 */
export function captureProgress(neutral: number, arc: number, stability: number): number {
  return clamp01(
    clamp01(neutral) * PHASE_WEIGHTS.neutral +
      clamp01(arc) * PHASE_WEIGHTS.arc +
      clamp01(stability) * PHASE_WEIGHTS.stability,
  );
}
