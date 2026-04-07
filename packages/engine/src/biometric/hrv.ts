/**
 * @module biometric/hrv
 * @description HRV (Heart Rate Variability) processing for Edge Score Layer A.
 * Provides baseline range calculation, status classification, and cross-source harmonization.
 *
 * @version 3.0 — Migrated from legacy/hrv.ts with v3 type alignment.
 */

import { MetricBaseline } from '../common/types';

// ─────────────────────────────────────────────
// HRV Status
// ─────────────────────────────────────────────

/** HRV status relative to personal baseline. */
export type HrvStatus = 'ELEVATED' | 'BALANCED' | 'UNBALANCED' | 'LOW' | 'POOR';

/** HRV baseline range (mean ± 1 SD). */
export interface HrvBaselineRange {
  low: number;
  high: number;
  mean: number;
}

// ─────────────────────────────────────────────
// Baseline Range
// ─────────────────────────────────────────────

/**
 * Calculates HRV baseline boundaries from historical samples.
 * Range is defined as mean ± 1 standard deviation.
 *
 * @param samples - Array of historical HRV RMSSD values.
 * @returns Object containing the calculated low, high, and mean values.
 */
export function calculateHrvBaselineRange(samples: number[]): HrvBaselineRange {
  if (!samples || samples.length === 0) {
    return { low: 0, high: 0, mean: 0 };
  }

  const mean = samples.reduce((a, b) => a + b, 0) / samples.length;

  if (samples.length === 1) {
    return { low: mean, high: mean, mean };
  }

  const sqDiffs = samples.map(value => Math.pow(value - mean, 2));
  const variance = sqDiffs.reduce((a, b) => a + b, 0) / samples.length;
  const std = Math.sqrt(variance);

  return {
    low: mean - std,
    high: mean + std,
    mean,
  };
}

// ─────────────────────────────────────────────
// Status Classification
// ─────────────────────────────────────────────

/**
 * Determines HRV status based on current RMSSD and personal baseline range.
 *
 * @param currentRmssd - Current HRV RMSSD measurement in ms.
 * @param baselineRange - The user's calculated baseline HRV range.
 * @returns The HrvStatus classification.
 */
export function getHrvStatus(currentRmssd: number, baselineRange: HrvBaselineRange): HrvStatus {
  if (baselineRange.mean === 0) {
    return 'BALANCED'; // No baseline yet — neutral
  }

  if (currentRmssd > baselineRange.high * 1.1) {
    return 'ELEVATED';
  } else if (currentRmssd >= baselineRange.low) {
    return 'BALANCED';
  } else if (currentRmssd >= baselineRange.low * 0.85) {
    return 'UNBALANCED';
  } else if (currentRmssd >= baselineRange.low * 0.70) {
    return 'LOW';
  } else {
    return 'POOR';
  }
}

// ─────────────────────────────────────────────
// Cross-Source Harmonization
// ─────────────────────────────────────────────

/** Biometric source for HRV harmonization. */
export type HrvSource = 'healthkit' | 'health_connect' | 'finger_scan' | 'ble_chest';

/**
 * Harmonizes HRV across different device sources.
 * HealthKit provides SDNN; we approximate RMSSD as SDNN × 0.75.
 *
 * @param source - The origin of the HRV measurement.
 * @param rmssdMs - The provided RMSSD value (if directly available).
 * @param sdnnMs - The provided SDNN value (from HealthKit, if available).
 * @returns The harmonized RMSSD value in ms.
 */
export function harmonizeHrv(
  source: HrvSource,
  rmssdMs: number,
  sdnnMs: number | null
): number {
  if (source === 'healthkit' && sdnnMs !== null) {
    return sdnnMs * 0.75;
  }
  return rmssdMs;
}

/**
 * Computes the HRV z-score against a metric baseline.
 *
 * @param hrvRmssd - Current HRV RMSSD in ms.
 * @param baseline - Metric baseline for HRV.
 * @returns Z-score, or 0 if baseline is insufficient.
 */
export function computeHrvZScore(hrvRmssd: number, baseline: MetricBaseline): number {
  if (baseline.sampleCount === 0 || baseline.std === 0) {
    return 0;
  }
  return (hrvRmssd - baseline.mean) / baseline.std;
}
