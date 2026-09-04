/**
 * @module biometric/hrv
 * @description HRV (Heart Rate Variability) processing for Edge Score Layer A.
 * Provides baseline range calculation, status classification, and cross-source harmonization.
 *
 * @version 3.0 — Migrated from legacy/hrv.ts with v3 type alignment.
 */

import type { MetricBaseline } from '../common/types';

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

  const sqDiffs = samples.map(value => (value - mean) ** 2);
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
 * Determines HRV status based on the current HRV value and the personal
 * baseline range for the SAME HRV statistic (see `HrvMetric`).
 *
 * @param currentRmssd - Current HRV measurement in ms.
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
// Cross-Source Metric Tagging
// ─────────────────────────────────────────────

/** Biometric source for HRV readings. */
export type HrvSource = 'healthkit' | 'health_connect' | 'finger_scan' | 'ble_chest';

/**
 * Which HRV statistic a value actually is. SDNN and RMSSD are different
 * quantities computed over different time structure — they are NOT
 * interchangeable, and no fixed ratio converts one into the other for a given
 * person. Every HRV value therefore travels tagged with the statistic it is.
 */
export type HrvMetric = 'rmssd' | 'sdnn';

/** An HRV value together with the statistic it actually represents. */
export interface HrvObservation {
  /** Which HRV statistic this value is. */
  metric: HrvMetric;
  /** The value in milliseconds. */
  valueMs: number;
}

/**
 * The HRV statistic each platform reports natively.
 * Apple Health exposes HRV as SDNN; Health Connect defines its HRV type as
 * RMSSD; a chest strap and a finger scan both give us inter-beat intervals,
 * from which TENKI computes RMSSD directly.
 */
export const NATIVE_HRV_METRIC: Readonly<Record<HrvSource, HrvMetric>> = {
  healthkit: 'sdnn',
  health_connect: 'rmssd',
  ble_chest: 'rmssd',
  finger_scan: 'rmssd',
};

/**
 * Tags an incoming HRV value with the statistic it actually is, preferring the
 * source's native statistic and falling back to whichever value is present.
 * It never converts between SDNN and RMSSD: a value that cannot be labelled
 * honestly is dropped rather than reshaped into the other metric's units.
 *
 * @param source - Where the HRV value came from.
 * @param values - Whichever HRV values the adapter obtained.
 * @returns The tagged observation, or null when no usable value is available.
 */
export function buildHrvObservation(
  source: HrvSource,
  values: { rmssdMs?: number | null; sdnnMs?: number | null }
): HrvObservation | null {
  const byMetric: Record<HrvMetric, number | null | undefined> = {
    rmssd: values.rmssdMs,
    sdnn: values.sdnnMs,
  };

  const native = NATIVE_HRV_METRIC[source];
  const fallback: HrvMetric = native === 'rmssd' ? 'sdnn' : 'rmssd';

  for (const metric of [native, fallback]) {
    const value = byMetric[metric];
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
      return { metric, valueMs: value };
    }
  }

  return null;
}

/**
 * Computes the HRV z-score against a metric baseline.
 *
 * The caller is responsible for pairing the value with the baseline track for
 * the SAME HRV statistic — use `selectHrvBaseline()` in baseline/baseline.ts.
 * Scoring an SDNN value against an RMSSD baseline produces a number that looks
 * valid and means nothing.
 *
 * @param hrvValueMs - Current HRV value in ms (SDNN or RMSSD).
 * @param baseline - Metric baseline for that same HRV statistic.
 * @returns Z-score, or 0 if baseline is insufficient.
 */
export function computeHrvZScore(hrvValueMs: number, baseline: MetricBaseline): number {
  if (baseline.sampleCount === 0 || baseline.std === 0) {
    return 0;
  }
  return (hrvValueMs - baseline.mean) / baseline.std;
}
