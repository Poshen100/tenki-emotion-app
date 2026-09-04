/**
 * @module baseline/baseline
 * @description Baseline engine — Welford's online algorithm with time-bucket segmentation.
 * Manages personal biometric baselines for Edge Score normalization.
 *
 * @version 3.0 — Extended from legacy/baseline.ts with time buckets + maturity.
 */

import {
  type MetricBaseline,
  type BaselineProfile,
  type BaselineMaturity,
  type TimeBucket,
  type BiometricReading,
  BASELINE_THRESHOLDS,
} from '../common/types';
import type { HrvMetric } from '../biometric/hrv';

// ─────────────────────────────────────────────
// Welford's Online Algorithm
// ─────────────────────────────────────────────

/** Maximum sample count before applying decay. */
export const MAX_SAMPLE_COUNT = 100;

/** Decay factor when sample count exceeds MAX. */
export const DECAY_FACTOR = 0.95;

/**
 * Updates a metric baseline with a new observation using Welford's online algorithm.
 * Applies heuristic decay when sample count exceeds MAX_SAMPLE_COUNT.
 *
 * @param baseline - Current metric baseline.
 * @param value - New observation value.
 * @param timestamp - Observation timestamp (Unix ms).
 * @returns Updated MetricBaseline.
 */
export function updateMetricBaseline(
  baseline: MetricBaseline,
  value: number,
  timestamp: number
): MetricBaseline {
  let { mean, std, sampleCount } = baseline;

  // Apply decay if at cap
  if (sampleCount >= MAX_SAMPLE_COUNT) {
    sampleCount = Math.floor(sampleCount * DECAY_FACTOR);
  }

  const newCount = sampleCount + 1;
  const delta = value - mean;
  const newMean = mean + delta / newCount;
  const delta2 = value - newMean;

  // Running M2 (sum of squared differences from mean)
  // Reconstruct M2 from current std and count
  const oldM2 = std * std * sampleCount;
  const newM2 = oldM2 + delta * delta2;

  const newStd = newCount > 1 ? Math.sqrt(newM2 / newCount) : 0;

  return {
    mean: newMean,
    std: newStd,
    sampleCount: newCount,
    lastUpdatedAt: timestamp,
  };
}

// ─────────────────────────────────────────────
// Empty Baseline Factories
// ─────────────────────────────────────────────

/**
 * Creates an empty metric baseline.
 *
 * @returns Fresh MetricBaseline with zero values.
 */
export function createEmptyMetricBaseline(): MetricBaseline {
  return {
    mean: 0,
    std: 0,
    sampleCount: 0,
    lastUpdatedAt: 0,
  };
}

/**
 * Creates an empty baseline profile.
 *
 * @returns Fresh BaselineProfile with empty baselines for all buckets.
 */
export function createEmptyBaselineProfile(): BaselineProfile {
  const empty = () => createEmptyMetricBaseline();
  return {
    hr: { morning: empty(), midday: empty(), evening: empty() },
    hrv: { morning: empty(), midday: empty(), evening: empty() },
    hrvSdnn: { morning: empty(), midday: empty(), evening: empty() },
    rr: { morning: empty(), midday: empty(), evening: empty() },
    stressProxy: empty(),
    maturity: 'new',
    totalScanCount: 0,
    version: '3.0.0',
  };
}

// ─────────────────────────────────────────────
// Time Bucket Resolution
// ─────────────────────────────────────────────

/**
 * Resolves the time bucket for a given timestamp.
 *
 * @param timestamp - Unix ms timestamp.
 * @returns The corresponding TimeBucket.
 */
export function resolveTimeBucket(timestamp: number): TimeBucket {
  const hour = new Date(timestamp).getHours();
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 18) return 'midday';
  return 'evening';
}

// ─────────────────────────────────────────────
// Maturity Assessment
// ─────────────────────────────────────────────

/**
 * Determines baseline maturity based on total scan count.
 *
 * @param totalScanCount - Total accepted scans across all buckets.
 * @param distinctDays - Number of unique days with scans (optional).
 * @returns BaselineMaturity classification.
 */
export function assessMaturity(
  totalScanCount: number,
  distinctDays: number = 0
): BaselineMaturity {
  if (totalScanCount >= BASELINE_THRESHOLDS.MATURE && distinctDays >= BASELINE_THRESHOLDS.MATURE_DAYS) {
    return 'mature';
  }
  if (totalScanCount >= BASELINE_THRESHOLDS.READY) {
    return 'ready';
  }
  if (totalScanCount >= BASELINE_THRESHOLDS.BUILDING) {
    return 'building';
  }
  return 'new';
}

// ─────────────────────────────────────────────
// Full Baseline Update
// ─────────────────────────────────────────────

/**
 * Updates the full baseline profile with a new biometric reading.
 * Routes the reading to the correct time bucket and updates all relevant metrics.
 *
 * `reading.hrvRmssdMs` feeds the RMSSD track only. An SDNN value (Apple
 * Health) is passed separately so the two statistics keep their own baselines.
 *
 * @param profile - Current baseline profile.
 * @param reading - New biometric reading.
 * @param stressScore - Stress proxy score for this reading (0-100).
 * @param distinctDays - Number of unique days with scans (for maturity).
 * @param hrvSdnnMs - SDNN value for this reading, when the source reports one.
 * @returns Updated BaselineProfile.
 */
export function updateBaselineProfile(
  profile: BaselineProfile,
  reading: BiometricReading,
  stressScore: number,
  distinctDays: number = 0,
  hrvSdnnMs: number | null = null
): BaselineProfile {
  const bucket = resolveTimeBucket(reading.timestamp);
  const ts = reading.timestamp;

  return {
    hr: {
      ...profile.hr,
      [bucket]: updateMetricBaseline(profile.hr[bucket], reading.hrBpm, ts),
    },
    hrv: {
      ...profile.hrv,
      [bucket]: updateMetricBaseline(profile.hrv[bucket], reading.hrvRmssdMs, ts),
    },
    hrvSdnn: updateSdnnTrack(profile.hrvSdnn, bucket, hrvSdnnMs, ts),
    rr: {
      ...profile.rr,
      [bucket]: updateMetricBaseline(profile.rr[bucket], reading.rrBrpm, ts),
    },
    stressProxy: updateMetricBaseline(profile.stressProxy, stressScore, ts),
    maturity: assessMaturity(profile.totalScanCount + 1, distinctDays),
    totalScanCount: profile.totalScanCount + 1,
    version: profile.version,
  };
}

/**
 * Updates the SDNN track, creating it on a profile persisted before the track
 * existed. Returns the track unchanged when this reading carries no SDNN — an
 * absent statistic must not be imputed from the RMSSD one.
 */
function updateSdnnTrack(
  track: Record<TimeBucket, MetricBaseline> | undefined,
  bucket: TimeBucket,
  hrvSdnnMs: number | null,
  ts: number
): Record<TimeBucket, MetricBaseline> | undefined {
  if (hrvSdnnMs === null || !Number.isFinite(hrvSdnnMs) || hrvSdnnMs <= 0) {
    return track;
  }

  const existing: Record<TimeBucket, MetricBaseline> = track ?? {
    morning: createEmptyMetricBaseline(),
    midday: createEmptyMetricBaseline(),
    evening: createEmptyMetricBaseline(),
  };

  return {
    ...existing,
    [bucket]: updateMetricBaseline(existing[bucket], hrvSdnnMs, ts),
  };
}

/**
 * Returns the baseline track for one HRV statistic, or null when that
 * statistic has no baseline yet. Pair a value with its OWN track before
 * scoring — an SDNN value scored against an RMSSD baseline yields a number
 * that looks valid and means nothing.
 *
 * @param profile - The user's baseline profile.
 * @param metric - Which HRV statistic the value to be scored is.
 * @param bucket - Time bucket the value falls in.
 * @returns The matching baseline, or null when it holds no samples.
 */
export function selectHrvBaseline(
  profile: BaselineProfile,
  metric: HrvMetric,
  bucket: TimeBucket
): MetricBaseline | null {
  const track = metric === 'rmssd' ? profile.hrv : profile.hrvSdnn;
  const baseline = track?.[bucket];

  return baseline && baseline.sampleCount > 0 ? baseline : null;
}
