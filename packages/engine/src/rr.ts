import { BaselineData } from './types';

/** Normal adult resting respiratory rate range (BrPM). */
export const RR_NORMAL_MIN = 12;
export const RR_NORMAL_MAX = 20;

/** Absolute physiological bounds for BrPM clamping. */
export const RR_ABS_MIN = 4;
export const RR_ABS_MAX = 40;

/** EWMA smoothing factor for respiratory rate. */
export const RR_EWMA_ALPHA = 0.15;

/**
 * Respiratory rate status categories.
 */
export type RrStatus = 'NORMAL' | 'ELEVATED' | 'LOW' | 'CRITICAL';

/**
 * Result object for respiratory rate analysis.
 */
export interface RrResult {
    brpm: number;
    status: RrStatus;
    zScore: number;
    withinNormal: boolean;
}

/**
 * Clamps a BrPM value to physiologically valid bounds.
 *
 * @param brpm - Raw breaths-per-minute value.
 * @returns Clamped BrPM within [RR_ABS_MIN, RR_ABS_MAX].
 */
export function clampBrpm(brpm: number): number {
    return Math.max(RR_ABS_MIN, Math.min(RR_ABS_MAX, brpm));
}

/**
 * Estimates respiratory rate (BrPM) from an array of RR-intervals (ms).
 * Uses respiratory sinus arrhythmia (RSA): the low-frequency modulation
 * of heart rate that correlates with breathing cycles.
 *
 * Algorithm:
 *  1. Compute successive differences of RR-intervals.
 *  2. Detect zero-crossings (sign changes) in the differences — each pair
 *     of crossings approximates one breath cycle.
 *  3. Convert the average cycle duration to BrPM.
 *
 * @param rrIntervalsMs - Array of RR-intervals in milliseconds.
 * @returns Estimated BrPM, or null if insufficient data.
 */
export function estimateBrpmFromRRIntervals(rrIntervalsMs: number[]): number | null {
    if (!rrIntervalsMs || rrIntervalsMs.length < 6) {
        return null;
    }

    // Step 1: successive differences
    const diffs: number[] = [];
    for (let i = 1; i < rrIntervalsMs.length; i++) {
        diffs.push(rrIntervalsMs[i] - rrIntervalsMs[i - 1]);
    }

    // Step 2: zero-crossings
    let crossings = 0;
    for (let i = 1; i < diffs.length; i++) {
        if ((diffs[i - 1] > 0 && diffs[i] < 0) || (diffs[i - 1] < 0 && diffs[i] > 0)) {
            crossings++;
        }
    }

    if (crossings === 0) {
        return null;
    }

    // Step 3: total duration
    const totalDurationMs = rrIntervalsMs.reduce((a, b) => a + b, 0);
    const totalDurationSec = totalDurationMs / 1000;

    // Each pair of zero-crossings ≈ 1 breath cycle
    const breathCycles = crossings / 2;
    const brpm = (breathCycles / totalDurationSec) * 60;

    return clampBrpm(Math.round(brpm * 10) / 10);
}

/**
 * Applies EWMA smoothing to produce a stable BrPM reading.
 *
 * @param currentBrpm - Latest BrPM measurement.
 * @param previousSmoothed - Previous smoothed BrPM value (or null for first reading).
 * @param alpha - Smoothing factor (0 < α ≤ 1). Defaults to RR_EWMA_ALPHA.
 * @returns Smoothed BrPM value.
 */
export function smoothBrpm(
    currentBrpm: number,
    previousSmoothed: number | null,
    alpha: number = RR_EWMA_ALPHA
): number {
    if (previousSmoothed === null) {
        return currentBrpm;
    }
    return Math.round((alpha * currentBrpm + (1 - alpha) * previousSmoothed) * 10) / 10;
}

/**
 * Determines the respiratory rate status category.
 *
 * @param brpm - Current breaths-per-minute value.
 * @returns The RrStatus classification.
 */
export function getRrStatus(brpm: number): RrStatus {
    if (brpm < RR_ABS_MIN + 2) return 'CRITICAL';   // < 6 BrPM
    if (brpm < RR_NORMAL_MIN) return 'LOW';           // 6-11
    if (brpm > RR_NORMAL_MAX + 8) return 'CRITICAL';  // > 28 BrPM
    if (brpm > RR_NORMAL_MAX) return 'ELEVATED';       // 21-28
    return 'NORMAL';                                    // 12-20
}

/**
 * Computes a full respiratory rate analysis against the user's baseline.
 *
 * @param brpm - Current breaths-per-minute value.
 * @param baseline - User's biometric baseline (7 or 21 day).
 * @returns Full RrResult including z-score and status.
 */
export function analyzeRr(brpm: number, baseline: BaselineData): RrResult {
    const clamped = clampBrpm(brpm);
    const status = getRrStatus(clamped);

    let zScore = 0;
    if (baseline.sampleCount > 0 && baseline.rrStd > 0) {
        zScore = Math.round(((clamped - baseline.rrMean) / baseline.rrStd) * 100) / 100;
    }

    return {
        brpm: clamped,
        status,
        zScore,
        withinNormal: clamped >= RR_NORMAL_MIN && clamped <= RR_NORMAL_MAX,
    };
}
