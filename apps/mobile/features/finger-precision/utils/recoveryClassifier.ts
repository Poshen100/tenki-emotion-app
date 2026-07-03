// DORMANT: awaiting multi-modal-blend wiring (feature barrel not yet consumed). Not an orphan; do not delete.
/**
 * @module finger-precision/utils/recoveryClassifier
 * @description Classifies quality drop reasons to guide user correction.
 *
 * @version 1.0
 */

import type { FingerQualityMetrics, FingerRecoveryReason } from '../types';

export function classifyRecoveryReason(q: FingerQualityMetrics): FingerRecoveryReason | null {
  // 1. Loss of contact is highest priority
  if (q.fingerCoverage < 0.60) {
    return 'contact_lost';
  }

  // 2. Light leakage / ambient interference
  if (q.ambientLight > 0.45) {
    return 'ambient_light';
  }

  // 3. Significant motion
  if (q.motionStability < 0.50) {
    return 'finger_moved';
  }

  // 4. Contact pressure issues (high pressure is most common PPG failure, causing pulse flattening)
  if (q.contactPressure < 0.50) {
    return 'pressure_high';
  }

  // 5. Unstable signal (waveform or regularity issues)
  if (q.pulseWaveform < 0.45 || q.beatRegularity < 0.50) {
    return 'signal_unstable';
  }

  return null;
}
