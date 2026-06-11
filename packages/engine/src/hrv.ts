import type { HrvBaselineRange, HrvStatus, FusionSource } from './types';

/**
 * Calculates the baseline boundaries for HRV.
 * Defaults to 0 if the input array is empty.
 * Range is defined as mean ± 1 standard deviation.
 * 
 * @param samples Array of historical HRV RMSSD values
 * @returns Object containing the calculated low, high, and mean values
 */
export function calculateHrvBaselineRange(samples: number[]): HrvBaselineRange {
    if (!samples || samples.length === 0) {
        return { low: 0, high: 0, mean: 0 };
    }

    const mean = samples.reduce((a, b) => a + b, 0) / samples.length;

    if (samples.length === 1) {
        return { low: mean, high: mean, mean };
    }

    const sqDiffs = samples.map(value => (value - mean) ** 2);
    const variance = sqDiffs.reduce((a, b) => a + b, 0) / samples.length;
    const std = Math.sqrt(variance);

    return {
        low: mean - std,
        high: mean + std,
        mean
    };
}

/**
 * Determines the HRV status based on current RMSSD and baseline range.
 * 
 * @param currentRmssd The current HRV RMSSD measurement
 * @param baselineRange The user's baseline HRV range
 * @returns The associated HrvStatus category
 */
export function getHrvStatus(currentRmssd: number, baselineRange: HrvBaselineRange): HrvStatus {
    if (baselineRange.mean === 0) {
        return 'BALANCED';
    }

    if (currentRmssd > baselineRange.high * 1.1) {
        return 'ELEVATED';
    } else if (currentRmssd >= baselineRange.low) {
        return 'BALANCED';
    } else if (currentRmssd >= baselineRange.low * 0.85) {
        return 'UNBALANCED';
    } else if (currentRmssd >= baselineRange.low * 0.70) {
        return 'LOW';
    } else {
        return 'POOR';
    }
}

/**
 * Harmonizes HRV computation across different device sources.
 * If source is watch_healthkit and sdnnMs is provided, RMSSD is approximated as SDNN * 0.75
 * 
 * @param source The origin of the HRV measurement
 * @param rmssdMs The provided RMSSD value (if any)
 * @param sdnnMs The provided SDNN value (from HealthKit/Apple Watch, if any)
 * @returns The harmonized RMSSD value
 */
export function harmonizeHrv(source: FusionSource, rmssdMs: number, sdnnMs: number | null): number {
    if (source === 'watch_healthkit' && sdnnMs !== null) {
        return sdnnMs * 0.75;
    }
    return rmssdMs;
}
