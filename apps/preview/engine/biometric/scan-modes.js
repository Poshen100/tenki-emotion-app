/**
 * ⚠️ GENERATED FILE — DO NOT EDIT.
 *
 * Compiled from packages/engine/src by scripts/build-preview-ppg.mjs so the
 * preview runs the engine's own pipeline instead of a hand-written mirror.
 * Edit the TypeScript, then run: node scripts/build-preview-ppg.mjs
 * The merge gate (scripts/preview-ppg-sync.mjs) fails if the two drift apart.
 */
/**
 * @module biometric/scan-modes
 * @description The three shapes a TENKI scan can take, and what each one is
 * allowed to report.
 *
 * The modes differ by how much evidence they gather, so they must also differ
 * by what they may claim. A twenty-second window holds enough beats for a heart
 * rate and nowhere near enough for beat-to-beat variability — so `quick_check`
 * does not list `hrv` at all, and the pipeline cannot be talked into producing
 * one by a good-looking quality score.
 *
 * A wearable feeding TENKI in the background is NOT a scan. It is a passive
 * source (see `docs/WEARABLE-INTEGRATION.md`); `precision` is the mode where
 * the user deliberately takes a reading with a beat sensor attached.
 */
/** Identifiers of the three scan modes. */
export const SCAN_MODES = ['quick_check', 'full_scan', 'precision'];
/**
 * Mode definitions.
 *
 * `precision` carries camera thresholds it does not use: its beat times come
 * from a sensor that measures them directly, so the quality gate that applies
 * is the strap's own contact status, not an optical quality score. It is listed
 * here so every mode is described in one table, not so the camera pipeline can
 * run it.
 */
export const SCAN_MODE_CONFIGS = {
    quick_check: {
        id: 'quick_check',
        minDurationSec: 15,
        targetDurationSec: 30,
        signalSource: 'phone_camera',
        reports: ['heart_rate'],
        minQualityForHeartRate: 45,
        minQualityForHrv: 101, // Unreachable by construction — see `reports`.
    },
    full_scan: {
        id: 'full_scan',
        minDurationSec: 45,
        targetDurationSec: 90,
        signalSource: 'phone_camera',
        reports: ['heart_rate', 'hrv', 'respiration'],
        minQualityForHeartRate: 45,
        minQualityForHrv: 65,
    },
    precision: {
        id: 'precision',
        minDurationSec: 60,
        targetDurationSec: 120,
        signalSource: 'external_beat_sensor',
        reports: ['heart_rate', 'hrv', 'respiration'],
        minQualityForHeartRate: 45,
        minQualityForHrv: 65,
    },
};
/**
 * Whether a mode may report a metric at all, before any quality is considered.
 *
 * @param mode - The scan mode.
 * @param metric - The metric in question.
 * @returns True when the mode's evidence can support the metric.
 */
export function modeReports(mode, metric) {
    return SCAN_MODE_CONFIGS[mode].reports.includes(metric);
}
/**
 * Whether a mode reads the phone camera.
 *
 * @param mode - The scan mode.
 * @returns True for the camera modes.
 */
export function isCameraMode(mode) {
    return SCAN_MODE_CONFIGS[mode].signalSource === 'phone_camera';
}
