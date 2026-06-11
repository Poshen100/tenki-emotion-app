import type { FusionSource, FusionLog } from './types';

/**
 * Priority mapping for fusion sources from highest confidence (chest) to lowest (rppg).
 */
export const SOURCE_PRIORITY: Record<FusionSource, number> = {
    ble_chest: 100,
    watch_healthkit: 80,
    rppg_glabella: 60,
    rppg_forehead: 50,
    rppg_cheek: 40,
};

export const SQI_THRESHOLD = 40;

/**
 * Information payload mapping a source to its assessed quality score.
 */
export interface SourceQuality {
    source: FusionSource;
    sqiScore: number;
}

/**
 * Builds a FusionLog object reflecting the selected source.
 * 
 * @param source The chosen measurement source.
 * @param sqiScore The associated Signal Quality Index.
 * @param degraded Indicates whether the system reverted to a lower-confidence state.
 * @param fallbackReason Description conveying why the choice degraded or fell back.
 * @returns An initialized FusionLog.
 */
export function buildFusionLog(
    source: FusionSource,
    sqiScore: number,
    degraded: boolean = false,
    fallbackReason: string | null = null
): FusionLog {
    // Base confidence on hardware rank
    let confidence = SOURCE_PRIORITY[source] / 100;

    if (degraded) {
        confidence = 0.3; // Hard override for explicitly degraded logs
    }

    return {
        source,
        confidence,
        sqiScore,
        fallbackReason,
        degraded
    };
}

/**
 * Selects the highest priority source that passes the SQI minimum threshold.
 * 
 * @param available The list of connected/available sensors with their instantaneous SQI.
 * @returns A computed FusionLog representing the best choice.
 */
export function selectSource(available: SourceQuality[]): FusionLog {
    if (!available || available.length === 0) {
        return buildFusionLog('rppg_cheek', 0, true, 'No sources available');
    }

    // Filter sources passing the threshold
    const qualified = available.filter(s => s.sqiScore >= SQI_THRESHOLD);

    if (qualified.length === 0) {
        // None passed threshold. We must degrade and take the highest rank available
        const sorted = [...available].sort((a, b) => SOURCE_PRIORITY[b.source] - SOURCE_PRIORITY[a.source]);
        const bestFailing = sorted[0];
        return buildFusionLog(bestFailing.source, bestFailing.sqiScore, true, 'No source passed SQI threshold');
    }

    const sortedQualified = [...qualified].sort((a, b) => SOURCE_PRIORITY[b.source] - SOURCE_PRIORITY[a.source]);
    const best = sortedQualified[0];

    return buildFusionLog(best.source, best.sqiScore, false, null);
}

/**
 * Evaluates whether the system is experiencing signal degradation requiring user warning.
 * 
 * @param fusionLog The latest fusion engine choice.
 * @returns True if the source is considered degraded.
 */
export function shouldDegrade(fusionLog: FusionLog): boolean {
    return fusionLog.degraded === true || fusionLog.confidence < 0.5;
}
