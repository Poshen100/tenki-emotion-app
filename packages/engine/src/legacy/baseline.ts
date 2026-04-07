import { BaselineData, ScanMetrics } from './types';

/**
 * Creates an empty baseline data structure.
 * 
 * @param windowDays The length of the rolling window (7 or 21 days).
 * @returns An initialized BaselineData object with zeros.
 */
export function createEmptyBaseline(windowDays: 7 | 21): BaselineData {
    return {
        windowDays,
        hrMean: 0,
        hrStd: 0,
        hrvMean: 0,
        hrvStd: 0,
        rrMean: 0,
        rrStd: 0,
        sampleCount: 0,
    };
}

/**
 * Updates the existing baseline with a new scan using Welford's online algorithm.
 * Implements a heuristic form of exponential decay when sample count exceeds 3 * windowDays.
 * 
 * @param current The existing baseline data.
 * @param newScan The latest collected biometrics.
 * @returns The updated BaselineData object.
 */
export function updateBaseline(current: BaselineData, newScan: ScanMetrics): BaselineData {
    const result: BaselineData = { ...current };

    // Heuristic decay: if we have more than 3 scans/day times the window length,
    // we effectively cap the sample size to allow newer values to weigh more.
    const maxSamples = current.windowDays * 3;
    if (result.sampleCount >= maxSamples) {
        // Reduce sample count artificially to simulate decay
        result.sampleCount = maxSamples - 1;
    }

    result.sampleCount++;
    const n = result.sampleCount;

    // Welford's algorithm step for HR
    const oldHrMean = result.hrMean;
    const hrDelta = newScan.hrBpm - oldHrMean;
    result.hrMean = oldHrMean + hrDelta / n;
    // Variance tracking. Storing raw variance sum internally is complex without changing the interface,
    // so we approximate or reconstruct based on std
    const hrM2 = (result.hrStd * result.hrStd) * (n - 1) + hrDelta * (newScan.hrBpm - result.hrMean);
    result.hrStd = n > 1 ? Math.sqrt(hrM2 / n) : 0;

    // Welford's algorithm step for HRV
    const oldHrvMean = result.hrvMean;
    const hrvDelta = newScan.hrvRmssdMs - oldHrvMean;
    result.hrvMean = oldHrvMean + hrvDelta / n;
    const hrvM2 = (result.hrvStd * result.hrvStd) * (n - 1) + hrvDelta * (newScan.hrvRmssdMs - result.hrvMean);
    result.hrvStd = n > 1 ? Math.sqrt(hrvM2 / n) : 0;

    // Welford's algorithm step for RR
    const oldRrMean = result.rrMean;
    const rrDelta = newScan.rrBrpm - oldRrMean;
    result.rrMean = oldRrMean + rrDelta / n;
    const rrM2 = (result.rrStd * result.rrStd) * (n - 1) + rrDelta * (newScan.rrBrpm - result.rrMean);
    result.rrStd = n > 1 ? Math.sqrt(rrM2 / n) : 0;

    return result;
}

/**
 * Determines if the baseline has accumulated enough samples to be used reliably.
 * 
 * @param baseline The baseline context.
 * @returns True if sample count >= window size.
 */
export function isBaselineReady(baseline: BaselineData): boolean {
    return baseline.sampleCount >= baseline.windowDays;
}

/**
 * Returns the categorical maturity state of the baseline.
 * 
 * @param baseline The baseline data.
 * @param windowDays The expected window length definition.
 * @returns 'NEW', 'BUILDING', 'READY', or 'MATURE'.
 */
export function getBaselineAge(baseline: BaselineData, windowDays: 7 | 21): 'NEW' | 'BUILDING' | 'READY' | 'MATURE' {
    if (baseline.sampleCount === 0) return 'NEW';
    if (baseline.sampleCount < windowDays) return 'BUILDING';
    if (baseline.sampleCount < windowDays * 3) return 'READY';
    return 'MATURE';
}
