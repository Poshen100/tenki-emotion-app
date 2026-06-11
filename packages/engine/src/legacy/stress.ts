import { type ScanMetrics, type BaselineData, type StressResult, type StressLevel, STRESS_LEVELS } from './types';

export const STRESS_WEIGHTS = { hrv: 0.60, hr: 0.40 } as const;

/**
 * Helper to clamp a number between min and max.
 */
function clamp(min: number, max: number, val: number): number {
    return Math.max(min, Math.min(max, val));
}

/**
 * Calculates current stress based on HR and HRV deviation from baseline.
 * 
 * @param metrics Current scan measurements
 * @param baseline User baseline measurements
 * @returns A computed StressResult object
 */
export function calculateStress(metrics: ScanMetrics, baseline: BaselineData): StressResult {
    if (
        baseline.sampleCount === 0 ||
        baseline.hrStd === 0 ||
        baseline.hrvStd === 0
    ) {
        const defaultScore = 50;
        return {
            score: defaultScore,
            level: getStressLevel(defaultScore),
            hrvContribution: 50,
            hrContribution: 50,
        };
    }

    const hrZScore = (metrics.hrBpm - baseline.hrMean) / baseline.hrStd;
    const hrvZScore = (metrics.hrvRmssdMs - baseline.hrvMean) / baseline.hrvStd;

    const hrvStress = clamp(0, 100, 50 - (hrvZScore * 25));
    const hrStress = clamp(0, 100, 50 + (hrZScore * 25));

    const score = clamp(0, 100, Math.round(hrvStress * STRESS_WEIGHTS.hrv + hrStress * STRESS_WEIGHTS.hr));

    return {
        score,
        level: getStressLevel(score),
        hrvContribution: hrvStress,
        hrContribution: hrStress,
    };
}

/**
 * Maps the 0-100 stress score to a categorical level.
 * 
 * @param score Stress score between 0 and 100
 * @returns Categorical StressLevel
 */
export function getStressLevel(score: number): StressLevel {
    const rounded = Math.round(score);
    if (rounded <= STRESS_LEVELS.REST[1]) return 'REST';
    if (rounded <= STRESS_LEVELS.LOW[1]) return 'LOW';
    if (rounded <= STRESS_LEVELS.MEDIUM[1]) return 'MEDIUM';
    return 'HIGH';
}
