/**
 * EWMA (Exponentially Weighted Moving Average) smoother.
 * Medical-grade smoothing with alpha = 0.05 for stable biometric display.
 *
 * Formula: smoothed = previous * (1 - alpha) + current * alpha
 * First value: jumps directly to target (no smoothing on init).
 */

/** Default medical-grade smoothing factor. */
export const EWMA_DEFAULT_ALPHA = 0.05;

/**
 * Maintains EWMA state for a single metric stream.
 */
export interface EwmaState {
    value: number | null;
    alpha: number;
    sampleCount: number;
}

/**
 * Creates a fresh EWMA state.
 *
 * @param alpha - Smoothing factor (0 < alpha <= 1). Defaults to 0.05.
 * @returns An initialized EwmaState with no value.
 */
export function createEwma(alpha: number = EWMA_DEFAULT_ALPHA): EwmaState {
    return { value: null, alpha, sampleCount: 0 };
}

/**
 * Updates the EWMA with a new observation.
 * First observation sets the value directly (no smoothing).
 * Subsequent observations apply exponential smoothing.
 *
 * @param state - Current EWMA state.
 * @param observation - New raw measurement.
 * @returns Updated EwmaState with the smoothed value.
 */
export function updateEwma(state: EwmaState, observation: number): EwmaState {
    if (state.value === null) {
        // First value: jump directly to target
        return {
            ...state,
            value: observation,
            sampleCount: 1,
        };
    }

    // EWMA: new = previous * (1 - alpha) + current * alpha
    const smoothed = state.value * (1 - state.alpha) + observation * state.alpha;

    return {
        ...state,
        value: smoothed,
        sampleCount: state.sampleCount + 1,
    };
}

/**
 * Returns the current smoothed value, or a fallback if no data has been observed.
 *
 * @param state - Current EWMA state.
 * @param fallback - Value to return if no observations yet. Defaults to 0.
 * @returns The smoothed value or fallback.
 */
export function getEwmaValue(state: EwmaState, fallback: number = 0): number {
    return state.value ?? fallback;
}

/**
 * Resets the EWMA state, preserving the alpha configuration.
 *
 * @param state - Current EWMA state.
 * @returns A fresh EwmaState with the same alpha.
 */
export function resetEwma(state: EwmaState): EwmaState {
    return createEwma(state.alpha);
}
