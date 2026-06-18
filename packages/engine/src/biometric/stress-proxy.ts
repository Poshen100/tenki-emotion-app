/**
 * @module biometric/stress-proxy
 * @description Stress proxy calculation for Edge Score Layer A.
 * Derives a stress indicator from HR elevation + HRV depression relative to baseline.
 *
 * @version 3.0 — Migrated from legacy/stress.ts with v3 type alignment.
 */

import type { BiometricReading, MetricBaseline, } from '../common/types';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

/** Stress level categories. */
export type StressLevel = 'REST' | 'LOW' | 'MEDIUM' | 'HIGH';

/** Stress level score boundaries. */
export const STRESS_LEVELS: Record<StressLevel, readonly [number, number]> = {
  REST: [0, 25],
  LOW: [26, 50],
  MEDIUM: [51, 75],
  HIGH: [76, 100],
} as const;

/** Stress proxy result. */
export interface StressProxyResult {
  /** Stress score 0-100 (higher = more stressed). */
  score: number;
  /** Stress level classification. */
  level: StressLevel;
  /** HRV contribution to stress (0-100). */
  hrvContribution: number;
  /** HR contribution to stress (0-100). */
  hrContribution: number;
}

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

/** Stress weight distribution (HRV is primary indicator). */
export const STRESS_WEIGHTS = { hrv: 0.60, hr: 0.40 } as const;

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

/**
 * Clamps a number between min and max.
 *
 * @param min - Lower bound.
 * @param max - Upper bound.
 * @param val - Value to clamp.
 * @returns Clamped value.
 */
function clamp(min: number, max: number, val: number): number {
  return Math.max(min, Math.min(max, val));
}

// ─────────────────────────────────────────────
// Core
// ─────────────────────────────────────────────

/**
 * Calculates stress proxy from current biometrics and baseline.
 *
 * Lower HRV and higher HR relative to baseline = higher stress.
 *
 * @param reading - Current biometric reading.
 * @param hrBaseline - HR baseline for current time bucket.
 * @param hrvBaseline - HRV baseline for current time bucket.
 * @returns StressProxyResult with score and level.
 */
export function calculateStressProxy(
  reading: BiometricReading,
  hrBaseline: MetricBaseline,
  hrvBaseline: MetricBaseline
): StressProxyResult {
  // Insufficient baseline — return neutral
  if (
    hrBaseline.sampleCount === 0 ||
    hrBaseline.std === 0 ||
    hrvBaseline.sampleCount === 0 ||
    hrvBaseline.std === 0
  ) {
    const defaultScore = 50;
    return {
      score: defaultScore,
      level: getStressLevel(defaultScore),
      hrvContribution: 50,
      hrContribution: 50,
    };
  }

  const hrZScore = (reading.hrBpm - hrBaseline.mean) / hrBaseline.std;
  const hrvZScore = (reading.hrvRmssdMs - hrvBaseline.mean) / hrvBaseline.std;

  // Lower HRV = more stress (invert HRV z-score)
  const hrvStress = clamp(0, 100, 50 - (hrvZScore * 25));
  // Higher HR = more stress
  const hrStress = clamp(0, 100, 50 + (hrZScore * 25));

  const score = clamp(0, 100, Math.round(
    hrvStress * STRESS_WEIGHTS.hrv + hrStress * STRESS_WEIGHTS.hr
  ));

  return {
    score,
    level: getStressLevel(score),
    hrvContribution: Math.round(hrvStress),
    hrContribution: Math.round(hrStress),
  };
}

/**
 * Maps a 0-100 stress score to a categorical level.
 *
 * @param score - Stress score between 0 and 100.
 * @returns StressLevel classification.
 */
export function getStressLevel(score: number): StressLevel {
  const rounded = Math.round(score);
  if (rounded <= STRESS_LEVELS.REST[1]) return 'REST';
  if (rounded <= STRESS_LEVELS.LOW[1]) return 'LOW';
  if (rounded <= STRESS_LEVELS.MEDIUM[1]) return 'MEDIUM';
  return 'HIGH';
}
