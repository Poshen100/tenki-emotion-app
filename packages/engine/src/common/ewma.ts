/**
 * @module common/ewma
 * @description EWMA (Exponentially Weighted Moving Average) smoother.
 * Medical-grade smoothing with configurable alpha for stable biometric display.
 *
 * @version 3.0 — Migrated from legacy/ewma.ts (unchanged logic).
 */

/** Default medical-grade smoothing factor. */
export const EWMA_DEFAULT_ALPHA = 0.05;

/** EWMA state for a single metric stream. */
export interface EwmaState {
  /** Current smoothed value (null if no observations). */
  value: number | null;
  /** Smoothing factor (0 < alpha <= 1). */
  alpha: number;
  /** Number of observations processed. */
  sampleCount: number;
}

/**
 * Creates a fresh EWMA state.
 *
 * @param alpha - Smoothing factor. Defaults to 0.05.
 * @returns An initialized EwmaState.
 */
export function createEwma(alpha: number = EWMA_DEFAULT_ALPHA): EwmaState {
  return { value: null, alpha, sampleCount: 0 };
}

/**
 * Updates the EWMA with a new observation.
 * First observation sets the value directly (no smoothing).
 *
 * @param state - Current EWMA state.
 * @param observation - New raw measurement.
 * @returns Updated EwmaState.
 */
export function updateEwma(state: EwmaState, observation: number): EwmaState {
  if (state.value === null) {
    return { ...state, value: observation, sampleCount: 1 };
  }
  const smoothed = state.value * (1 - state.alpha) + observation * state.alpha;
  return { ...state, value: smoothed, sampleCount: state.sampleCount + 1 };
}

/**
 * Returns the current smoothed value, or a fallback if no data.
 *
 * @param state - Current EWMA state.
 * @param fallback - Fallback value. Defaults to 0.
 * @returns The smoothed value or fallback.
 */
export function getEwmaValue(state: EwmaState, fallback: number = 0): number {
  return state.value ?? fallback;
}

/**
 * Resets the EWMA state, preserving the alpha configuration.
 *
 * @param state - Current EWMA state.
 * @returns Fresh EwmaState with the same alpha.
 */
export function resetEwma(state: EwmaState): EwmaState {
  return createEwma(state.alpha);
}
