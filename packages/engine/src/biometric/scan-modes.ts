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

import type { PpgMetric } from './ppg/types';

/** Identifiers of the three scan modes. */
export const SCAN_MODES = ['quick_check', 'full_scan', 'precision'] as const;
export type ScanMode = typeof SCAN_MODES[number];

/** Where a mode's beat information comes from. */
export type ScanSignalSource = 'phone_camera' | 'external_beat_sensor';

/** What a mode gathers and what it is permitted to report. */
export interface ScanModeConfig {
  id: ScanMode;
  /** Below this the capture is not analysed at all. */
  minDurationSec: number;
  /** What the UI asks the user for. */
  targetDurationSec: number;
  signalSource: ScanSignalSource;
  /** Metrics this mode may report, given good enough signal. */
  reports: readonly PpgMetric[];
  /** Quality floor for reporting a heart rate, 0-100. */
  minQualityForHeartRate: number;
  /**
   * Quality floor for reporting HRV, 0-100. Higher than the heart-rate floor
   * because a rate survives noise that beat timing does not.
   */
  minQualityForHrv: number;
}

/**
 * Mode definitions.
 *
 * `precision` carries camera thresholds it does not use: its beat times come
 * from a sensor that measures them directly, so the quality gate that applies
 * is the strap's own contact status, not an optical quality score. It is listed
 * here so every mode is described in one table, not so the camera pipeline can
 * run it.
 */
export const SCAN_MODE_CONFIGS: Readonly<Record<ScanMode, ScanModeConfig>> = {
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
 * What the running build is allowed to derive, independent of signal quality.
 *
 * Separate from the mode table because it is a product decision, not an
 * evidence one: the mode says what 90 seconds of signal could support, this
 * says what TENKI is willing to claim from a camera today.
 */
export interface ScanCapabilityOptions {
  /**
   * Whether camera PPG may report HRV and respiratory rate.
   *
   * 🔴 Defaults to FALSE (founder decision 2026-09-11). See the
   * `camera_hrv_estimates` flag in `common/types.ts` for the measurements
   * behind that default. The pipeline is kept and tested so the decision can
   * be revisited with real-user data — not deleted.
   */
  cameraHrvEstimates?: boolean;
}

/** Metrics a camera may not derive while `cameraHrvEstimates` is off. */
const CAMERA_GATED_METRICS: readonly PpgMetric[] = ['hrv', 'respiration'];

/**
 * Whether a mode may report a metric at all, before any quality is considered.
 *
 * Two independent gates, and both have to pass:
 *   1. The mode's own `reports` list — what this much signal could support.
 *   2. The capability options — what TENKI is willing to claim from a camera.
 *
 * ⚠️ The second gate applies to CAMERA modes only. `precision` reads a beat
 * sensor whose RR intervals are a different provenance entirely, and gating it
 * on a camera decision would be a category error.
 *
 * @param mode - The scan mode.
 * @param metric - The metric in question.
 * @param options - What the build is willing to derive. Omit for the default,
 *   which withholds camera HRV and respiration.
 * @returns True when the metric may be reported.
 */
export function modeReports(
  mode: ScanMode,
  metric: PpgMetric,
  options: ScanCapabilityOptions = {},
): boolean {
  if (!SCAN_MODE_CONFIGS[mode].reports.includes(metric)) {
    return false;
  }

  if (
    isCameraMode(mode) &&
    CAMERA_GATED_METRICS.includes(metric) &&
    options.cameraHrvEstimates !== true
  ) {
    return false;
  }

  return true;
}

/**
 * Whether a mode reads the phone camera.
 *
 * @param mode - The scan mode.
 * @returns True for the camera modes.
 */
export function isCameraMode(mode: ScanMode): boolean {
  return SCAN_MODE_CONFIGS[mode].signalSource === 'phone_camera';
}
