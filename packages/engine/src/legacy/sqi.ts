export const SQI_THRESHOLD = 40;

/**
 * Calculates a generalized Signal Quality Index based on variance (SNR estimation via CV).
 * High variance / CV implies a noisy signal mapping to lower SQI.
 * 
 * @param rawSignal Array of raw collected amplitude points over a window.
 * @param sampleRate Frequency of the measurement device.
 * @returns An SQI score representing quality from 0 to 100.
 */
export function calculateSqi(rawSignal: number[], sampleRate: number): number {
    if (!rawSignal || rawSignal.length === 0) {
        return 0;
    }

    const mean = rawSignal.reduce((a, b) => a + b, 0) / rawSignal.length;
    if (mean === 0) {
        return 0; // Prevent divide by zero if completely flat line at 0
    }

    const sqDiffs = rawSignal.map(v => Math.pow(v - mean, 2));
    const variance = sqDiffs.reduce((a, b) => a + b, 0) / rawSignal.length;
    const std = Math.sqrt(variance);

    // Coefficient of Variation (CV)
    const cv = std / Math.abs(mean);

    // sqi = clamp(0, 100, 100 - (cv * 200))
    // A higher CV drastically degrades the score
    const sqiRaw = 100 - (cv * 200);
    const sqi = Math.max(0, Math.min(100, Math.round(sqiRaw)));

    return sqi;
}

/**
 * Maps the 0-100 SQI score to an alphabetic grading tier.
 * 
 * @param sqi The Signal Quality Index score.
 * @returns The associated grade 'A', 'B', 'C', 'D', or 'F'.
 */
export function getSqiGrade(sqi: number): 'A' | 'B' | 'C' | 'D' | 'F' {
    if (sqi >= 80) return 'A';
    if (sqi >= 60) return 'B';
    if (sqi >= 40) return 'C';
    if (sqi >= 20) return 'D';
    return 'F';
}
