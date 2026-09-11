/**
 * ⚠️ GENERATED FILE — DO NOT EDIT.
 *
 * Compiled from packages/engine/src by scripts/build-preview-ppg.mjs so the
 * preview runs the engine's own pipeline instead of a hand-written mirror.
 * Edit the TypeScript, then run: node scripts/build-preview-ppg.mjs
 * The merge gate (scripts/preview-ppg-sync.mjs) fails if the two drift apart.
 */
/**
 * @module biometric/ppg/signal-quality
 * @description The four-dimensional instrument a camera capture reports about
 * itself.
 *
 * 🔴 Signal quality IS the product. A camera that reports a pulse without
 * saying how well it saw it is indistinguishable from one that guessed, and the
 * user has no way to do better next time. So this module is the canonical
 * shape a surface renders: four dimensions, a frame count, a duration, whether
 * the capture was accepted, and — when it was not — exactly which limits it
 * missed.
 *
 * ⚠️ Nothing here measures anything new. Every dimension is one of the
 * normalised components `assessPpgQuality()` already weighted into the score
 * (`PpgQualityComponents`). That is deliberate: a second calculation would
 * eventually disagree with the score printed beside it, and this repo has paid
 * for that class of drift three times (PLAYBOOK §6).
 *
 * @see docs/PHONE-PPG.md
 */
/**
 * The negative subset of `PpgQualityReason` — the limits a capture can miss.
 *
 * A SUBSET rather than a new vocabulary. The positive reasons
 * (`strong_pulse`, `low_motion`, …) describe a capture that worked, and
 * nothing is ever rejected "because the pulse was strong".
 */
export const PPG_REJECTION_REASONS = [
    'motion_detected',
    'weak_pulse',
    'low_perfusion',
    'sensor_clipping',
    'unstable_coverage',
    'frame_drops',
    'irregular_periodicity',
    'insufficient_duration',
    'unstable_sampling',
];
/** Reasons that describe a capture that went well. */
export const PPG_POSITIVE_REASONS = [
    'stable_signal',
    'low_motion',
    'strong_pulse',
    'good_periodicity',
    'full_coverage',
];
/** True when this reason is one a capture can be rejected for. */
export function isRejectionReason(reason) {
    return PPG_REJECTION_REASONS.includes(reason);
}
/** Which way a dimension reads: `higher_is_better`, or the inverted one. */
export const SIGNAL_DIMENSION_DIRECTION = {
    contactCoverage: 'higher_is_better',
    lightStability: 'higher_is_better',
    motionArtifact: 'lower_is_better',
    rhythmicCoherence: 'higher_is_better',
};
/**
 * The dimension's value as a 0..1 "how good is this" bar, whichever way the
 * underlying number reads.
 *
 * @param quality - The capture's signal quality.
 * @param dimension - Which of the four dimensions to read.
 * @returns 0..1 where 1 is always good.
 */
export function dimensionGoodness(quality, dimension) {
    const value = quality[dimension];
    return SIGNAL_DIMENSION_DIRECTION[dimension] === 'lower_is_better' ? 1 - value : value;
}
/**
 * Derives the instrument from a completed analysis.
 *
 * @param analysis - The pipeline's own output for one capture.
 * @returns The four dimensions plus what was and was not accepted.
 */
export function toSignalQuality(analysis) {
    const { quality } = analysis;
    return {
        contactCoverage: quality.components.coverage,
        lightStability: quality.components.clipping,
        // The score's motion component is stillness (1 = still), so the contract's
        // artifact reading is its complement. Rounded after the flip so the two
        // never disagree by a rounding step.
        motionArtifact: Math.round((1 - quality.components.motion) * 100) / 100,
        rhythmicCoherence: quality.components.periodicity,
        usableFrameCount: quality.usableFrameCount,
        totalFrameCount: quality.frameCount,
        captureDurationMs: Math.round(analysis.durationSec * 1000),
        // 🔴 Accepted means a reading exists. Not "the score was high" — a capture
        // can score well and still fail to establish a pulse, and calling that
        // accepted would put a quality badge on an empty result.
        accepted: analysis.heartRateBpm !== null,
        rejectionReasons: quality.reasons.filter(isRejectionReason),
    };
}
