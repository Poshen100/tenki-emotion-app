/**
 * ⚠️ GENERATED FILE — DO NOT EDIT.
 *
 * Compiled from packages/engine/src by scripts/build-preview-ppg.mjs so the
 * preview runs the engine's own pipeline instead of a hand-written mirror.
 * Edit the TypeScript, then run: node scripts/build-preview-ppg.mjs
 * The merge gate (scripts/preview-ppg-sync.mjs) fails if the two drift apart.
 */
/**
 * @module biometric/ppg/to-reading
 * @description Bridges a camera scan into the shapes the scoring and baseline
 * engines take.
 *
 * The engines were built around a `BiometricReading` whose three physiological
 * fields are all required numbers. A phone-only scan frequently establishes one
 * of them. Rather than reshape a type the whole engine depends on, this bridge
 * fills the unmeasured fields with `NaN` and hands over an availability record
 * saying which they are.
 *
 * 🔴 `NaN` is deliberate and is not a sentinel to be replaced with something
 * "safer". A resting-plausible placeholder — 50 ms of HRV, 15 breaths a minute
 * — is indistinguishable downstream from a measurement, which is the exact
 * failure this whole pipeline exists to prevent. NaN cannot be mistaken for
 * one: it fails loudly wherever it is used, and both consumers refuse it
 * structurally as well (`updateMetricBaseline` drops non-finite values;
 * `calculateEdgeScore` excludes the driver outright).
 */
/** Maps the 0-100 quality score onto the engine's letter grade. */
function toGrade(score) {
    if (score >= 90)
        return 'A';
    if (score >= 80)
        return 'B';
    if (score >= 70)
        return 'C';
    if (score >= 50)
        return 'D';
    return 'F';
}
/**
 * Converts a completed camera analysis into engine inputs.
 *
 * @param analysis - The analysis returned by `analyzePpgScan`.
 * @param observedAtMs - When the scan was taken (Unix ms).
 * @returns Reading, availability and signal quality for the engines.
 */
export function toEngineInput(analysis, observedAtMs) {
    return {
        reading: {
            hrBpm: analysis.heartRateBpm ?? Number.NaN,
            hrvRmssdMs: analysis.hrvRmssdMs ?? Number.NaN,
            rrBrpm: analysis.respiratoryRateBrpm ?? Number.NaN,
            timestamp: observedAtMs,
        },
        availability: {
            hrv: analysis.hrvRmssdMs !== null,
            respiration: analysis.respiratoryRateBrpm !== null,
        },
        signalQuality: {
            score: analysis.quality.score,
            grade: toGrade(analysis.quality.score),
            coverage: analysis.quality.coverage,
            stability: analysis.quality.stability,
            acceptable: analysis.heartRateBpm !== null,
        },
        scorable: analysis.heartRateBpm !== null,
    };
}
