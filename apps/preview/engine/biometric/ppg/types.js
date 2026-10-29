/**
 * ⚠️ GENERATED FILE — DO NOT EDIT.
 *
 * Compiled from packages/engine/src by scripts/build-preview-ppg.mjs so the
 * preview runs the engine's own pipeline instead of a hand-written mirror.
 * Edit the TypeScript, then run: node scripts/build-preview-ppg.mjs
 * The merge gate (scripts/preview-ppg-sync.mjs) fails if the two drift apart.
 */
/**
 * @module biometric/ppg/types
 * @description Vocabulary for the phone-camera PPG pipeline.
 *
 * TENKI's largest group of users owns a phone and nothing else, so the camera
 * path is a first-class measurement chain, not a fallback. Being first-class
 * means being honest about what an optical waveform can and cannot support:
 * every metric this pipeline can produce is nullable, and withholding one is a
 * normal outcome rather than an error.
 *
 * Two boundaries are structural:
 *
 *   1. **Frames never enter this module.** A `PpgFrame` is a frame already
 *      reduced to scalars on the capture side. Raw pixels are not persisted,
 *      not passed around, and not reachable from here — the privacy rule is
 *      enforced by the shape of the input, not by remembering to delete.
 *   2. **Nothing here is medical-grade.** A camera estimates beat timing from
 *      light passing through a fingertip. It is not an ECG and not equivalent
 *      to a chest strap, and the vocabulary below never lets it claim to be.
 *
 * @see docs/PHONE-PPG.md
 */
/**
 * Why a quality score came out where it did. Reasons are what the UI turns
 * into "hold your finger still" — a scan that fails without saying which of
 * eleven things went wrong is a scan the user cannot fix.
 *
 * Positive and negative reasons share one list on purpose: a report that can
 * only say what is wrong cannot tell a user that a scan was good.
 */
export const PPG_QUALITY_REASONS = [
    // Positive
    'stable_signal',
    'low_motion',
    'strong_pulse',
    'good_periodicity',
    'full_coverage',
    // Negative
    'motion_detected',
    'weak_pulse',
    'low_perfusion',
    'sensor_clipping',
    'unstable_coverage',
    'frame_drops',
    'irregular_periodicity',
    'insufficient_duration',
    'unstable_sampling',
    // Advisory — neither a verdict on the capture nor grounds for refusing it.
    // 🔴 founder decision, 2026-09-11: record a missing torch, do not reject on
    // it. iOS Safari has no torch API at all, so rejecting would refuse every
    // capture on a whole platform; and a bright enough ambient room genuinely
    // works. The quality gates already refuse a capture whose signal is too weak
    // — which is what a missing torch USUALLY causes, and the right place to
    // catch it. This reason exists so the cause is visible when that happens.
    'torch_unavailable',
];
/**
 * Metrics the pipeline may withhold, named so the UI can say which.
 *
 * 🔴 `prv` — pulse-rate variability — is NOT `hrv`. A camera infers beat times
 * from a light curve; RR-interval HRV is measured from the beats themselves.
 * They are different quantities with different error behaviour, and camera PRV
 * may never populate an HRV field or be labelled HRV in production (founder
 * rule, 2026-09-11). The vocabulary is the first place that has to hold.
 */
export const PPG_METRICS = ['heart_rate', 'prv', 'respiration'];
