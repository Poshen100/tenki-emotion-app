import { ScanMetrics, BaselineData, TeiZone, TENKI_ZONES } from './types';

export const TEI_WEIGHTS = { hr: 0.30, hrv: 0.50, rr: 0.20 } as const;

/**
 * Calculates the raw TEI score by comparing the current metrics against the user's baseline.
 * Lower HR and higher HRV generally contribute to a higher raw score.
 * 
 * @param metrics Current scan metrics.
 * @param baseline User's 7-day or 21-day biometric baseline.
 * @returns A raw floating-point TEI score.
 */
export function calculateTeiRaw(metrics: ScanMetrics, baseline: BaselineData): number {
    if (
        baseline.sampleCount === 0 ||
        baseline.hrStd === 0 ||
        baseline.hrvStd === 0 ||
        baseline.rrStd === 0
    ) {
        // Fallback if baseline is uninitialized
        return 50.0;
    }

    const hrZScore = (metrics.hrBpm - baseline.hrMean) / baseline.hrStd;
    const hrvZScore = (metrics.hrvRmssdMs - baseline.hrvMean) / baseline.hrvStd;
    const rrZScore = (metrics.rrBrpm - baseline.rrMean) / baseline.rrStd;

    // HR is inversely proportional to TEI, HRV is directly proportional, RR is inversely proportional
    const rawScore = 50
        - (hrZScore * 10 * TEI_WEIGHTS.hr)
        + (hrvZScore * 10 * TEI_WEIGHTS.hrv)
        - (rrZScore * 10 * TEI_WEIGHTS.rr);

    return rawScore;
}

/**
 * Transforms the raw TEI score into a PR99 percent rank based on historical distribution.
 * 
 * @param teiRaw The raw TEI score of the current scan.
 * @param historicalScores Array of historical raw TEI scores to calculate percentile.
 * @returns The PR99 ranking from 1 to 99.
 */
export function calculateTeiPr(teiRaw: number, historicalScores: number[]): number {
    if (!historicalScores || historicalScores.length === 0) {
        // Default to a neutral middle PR if no history
        return 50;
    }

    let countBelow = 0;
    for (const score of historicalScores) {
        if (score < teiRaw) {
            countBelow++;
        }
    }

    // Calculate percentile
    const percentile = (countBelow / historicalScores.length) * 100;

    // Round and bound to PR 1-99
    const pr = Math.max(1, Math.min(99, Math.round(percentile)));

    return pr;
}

/**
 * Maps a TEI PR score to its corresponding physiological zone.
 * 
 * @param teiPr The calculated TEI PR99 score (1-99).
 * @returns The corresponding TeiZone classification.
 */
export function getZone(teiPr: number): TeiZone {
    if (teiPr >= TENKI_ZONES.PEAK.min) return 'PEAK';
    if (teiPr >= TENKI_ZONES.OPTIMAL.min) return 'OPTIMAL';
    if (teiPr >= TENKI_ZONES.NEUTRAL.min) return 'NEUTRAL';
    return 'DEGRADED';
}
