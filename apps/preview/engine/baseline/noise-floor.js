/**
 * ⚠️ GENERATED FILE — DO NOT EDIT.
 *
 * Compiled from packages/engine/src by scripts/build-preview-ppg.mjs so the
 * preview runs the engine's own pipeline instead of a hand-written mirror.
 * Edit the TypeScript, then run: node scripts/build-preview-ppg.mjs
 * The merge gate (scripts/preview-ppg-sync.mjs) fails if the two drift apart.
 */
/**
 * @module baseline/noise-floor
 * @description The user's own measurement noise, accumulated across scans.
 *
 * A baseline's spread is used as the denominator of every z-score, so it
 * decides how large a deviation has to be before it counts as a change of
 * state. That works only when the spread describes real physiological
 * variation. When it is smaller than the instrument's own error, the z-score
 * divides noise by noise and returns a confident number about nothing.
 *
 * 🔴 Measured, and the reason this module exists: sweeping real day-to-day
 * variation against measurement noise moved the score↔state correlation from
 * 0.33 to 0.97, while the score's spread on screen stayed at ~12 points in
 * every case. A user, and a founder, and this engine, all see the same picture
 * whether two thirds of the movement is noise or almost none of it is. The
 * only thing that separates those worlds is knowing how noisy the instrument
 * is — so the instrument has to measure itself.
 *
 * The floor is a MEDIAN, not a mean: one bad scan (a moving finger reads 7.6×
 * worse) must not raise the floor for every future reading. It is also only
 * ever fed by scans that actually produced HRV, because those are the only
 * ones that reach a baseline.
 *
 * ⚠️ This is a floor, not an estimate of the baseline's spread. Real spread is
 * measurement noise PLUS physiological variation and is therefore strictly
 * larger. Using the floor as the denominator when the baseline's own spread is
 * smaller says only: we cannot resolve a difference finer than this.
 */
/** Fewest contributing scans before a floor is trusted enough to apply. */
export const MIN_SCANS_FOR_NOISE_FLOOR = 3;
/**
 * Most recent contributions kept. Bounded so the floor tracks the user's
 * current phone and current habits rather than averaging over a year of them.
 */
export const NOISE_FLOOR_WINDOW = 20;
/**
 * Highest floor that may be applied, in ms. A user who only ever scans badly
 * would otherwise raise their own floor until nothing could register as a
 * change — the honest response to consistently poor scans is the quality
 * reasons the scan already reports, not a silently flattened score.
 */
export const MAX_APPLIED_NOISE_FLOOR_MS = 15;
/** An empty state, for a user who has never completed an HRV scan. */
export function createEmptyNoiseFloor() {
    return { samples: [] };
}
/**
 * Records one scan's repeatability.
 *
 * @param state - Current accumulated state.
 * @param repeatabilitySdMs - This scan's repeatability, or null to ignore it.
 * @returns The updated state; unchanged when there is nothing usable to add.
 */
export function recordRepeatability(state, repeatabilitySdMs) {
    if (repeatabilitySdMs === null || !Number.isFinite(repeatabilitySdMs) || repeatabilitySdMs <= 0) {
        return state;
    }
    const samples = [...state.samples, repeatabilitySdMs];
    return {
        samples: samples.length > NOISE_FLOOR_WINDOW ? samples.slice(samples.length - NOISE_FLOOR_WINDOW) : samples,
    };
}
/**
 * The floor to apply, or null while there is not yet enough evidence.
 *
 * @param state - Accumulated state.
 * @returns Floor in ms, capped by `MAX_APPLIED_NOISE_FLOOR_MS`, or null.
 */
export function resolveNoiseFloor(state) {
    if (state.samples.length < MIN_SCANS_FOR_NOISE_FLOOR) {
        return null;
    }
    const sorted = [...state.samples].sort((a, b) => a - b);
    const mid = sorted.length >> 1;
    const median = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
    return Math.min(median, MAX_APPLIED_NOISE_FLOOR_MS);
}
/**
 * The spread a z-score should actually divide by.
 *
 * Returns whichever is larger: what the baseline observed, or what the
 * instrument can resolve. A baseline spread below the noise floor does not
 * mean the user is remarkably steady — it means too few samples have been
 * gathered to have seen them move.
 *
 * @param baselineStd - Spread the baseline has observed.
 * @param noiseFloorMs - Applied floor, or null when not yet established.
 * @returns The denominator to use.
 */
export function resolveEffectiveStd(baselineStd, noiseFloorMs) {
    if (noiseFloorMs === null)
        return baselineStd;
    return Math.max(baselineStd, noiseFloorMs);
}
