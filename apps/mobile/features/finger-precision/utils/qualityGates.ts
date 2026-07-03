// DORMANT: awaiting multi-modal-blend wiring (feature barrel not yet consumed). Not an orphan; do not delete.
/**
 * @module finger-precision/utils/qualityGates
 * @description Quality gate evaluation and readiness score calculation.
 *
 * @version 1.0
 */

import type { FingerQualityMetrics, DotStatus } from '../types';

export const QUALITY_THRESHOLDS = {
  fingerCoverage: { green: 0.85, yellow: 0.60 },
  flashVisibility: { green: 0.70, yellow: 0.40 },
  contactPressure: { green: 0.75, yellow: 0.50 },
  motionStability: { green: 0.30, yellow: 0.50 }, // lower motion is better
  pulseWaveform: { green: 0.70, yellow: 0.45 },
  beatRegularity: { green: 0.70, yellow: 0.50 },
  ambientLight: { green: 0.25, yellow: 0.45 }, // lower ambient light is better
  totalPpgConfidence: { green: 0.65, yellow: 0.40 },
} as const;

/**
 * Maps metric values to DotStatus.
 */
export function deriveDotStatuses(q: FingerQualityMetrics): {
  cover: DotStatus;
  still: DotStatus;
  pressure: DotStatus;
} {
  // 1. Cover Dot
  let cover: DotStatus = 'yellow';
  if (
    q.fingerCoverage >= QUALITY_THRESHOLDS.fingerCoverage.green &&
    q.flashVisibility >= QUALITY_THRESHOLDS.flashVisibility.green
  ) {
    cover = 'green';
  } else if (
    q.fingerCoverage < QUALITY_THRESHOLDS.fingerCoverage.yellow ||
    q.flashVisibility < QUALITY_THRESHOLDS.flashVisibility.yellow
  ) {
    cover = 'red';
  }

  // 2. Still Dot
  let still: DotStatus = 'yellow';
  if (
    q.motionStability <= QUALITY_THRESHOLDS.motionStability.green &&
    q.contactPressure >= QUALITY_THRESHOLDS.contactPressure.green
  ) {
    still = 'green';
  } else if (
    q.motionStability > QUALITY_THRESHOLDS.motionStability.yellow ||
    q.contactPressure < QUALITY_THRESHOLDS.contactPressure.yellow
  ) {
    still = 'red';
  }

  // 3. Pressure Dot
  let pressure: DotStatus = 'yellow';
  if (
    q.pulseWaveform >= QUALITY_THRESHOLDS.pulseWaveform.green &&
    q.beatRegularity >= QUALITY_THRESHOLDS.beatRegularity.green
  ) {
    pressure = 'green';
  } else if (
    q.pulseWaveform < QUALITY_THRESHOLDS.pulseWaveform.yellow ||
    q.beatRegularity < QUALITY_THRESHOLDS.beatRegularity.yellow
  ) {
    pressure = 'red';
  }

  return { cover, still, pressure };
}

/**
 * Calculates weighted aggregate PPG confidence.
 */
export function calculatePpgConfidence(q: Omit<FingerQualityMetrics, 'totalPpgConfidence'>): number {
  const stabilityFactor = Math.max(0, 1 - q.motionStability); // 1 is stable, 0 is unstable
  const ambientFactor = Math.max(0, 1 - q.ambientLight);

  const weighted =
    q.fingerCoverage * 0.20 +
    q.flashVisibility * 0.10 +
    q.contactPressure * 0.15 +
    stabilityFactor * 0.20 +
    q.pulseWaveform * 0.15 +
    q.beatRegularity * 0.10 +
    ambientFactor * 0.10;

  return Math.min(1, Math.max(0, weighted));
}

/**
 * Determines if a quality metrics snapshot passes minimum thresholds to start or continue scanning.
 * Readiness check requires all dots to be at least yellow, and at least two green.
 */
export function isReadinessPassed(cover: DotStatus, still: DotStatus, pressure: DotStatus): boolean {
  const statuses = [cover, still, pressure];
  const allAtLeastYellow = statuses.every((s) => s === 'green' || s === 'yellow');
  const greenCount = statuses.filter((s) => s === 'green').length;
  return allAtLeastYellow && greenCount >= 2;
}
