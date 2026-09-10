/**
 * @module features/devices/adapters/bleHrv
 * @description Turns a chest strap's Heart Rate Measurement notifications into
 * canonical `BiometricSample`s.
 *
 * Two rules are enforced structurally rather than remembered:
 *
 *   1. **HRV comes from RR intervals or it does not come.** A strap reporting
 *      only a heart rate yields a heart-rate sample and nothing else. There is
 *      no code path from bpm to variability (`docs/WEARABLE-INTEGRATION.md` §5).
 *   2. **The raw RR series never becomes a sample.** `rr_interval_ms` is in
 *      `LOCAL_ONLY_METRICS`: it is the highest-resolution biometric TENKI
 *      touches and stays on the device. RMSSD and SDNN computed FROM it are
 *      derived values and may sync. This module emits only the derived ones.
 *
 * @see packages/engine/src/biometric/beat-series.ts
 */

import {
  type BiometricPermissionScope,
  type BiometricSample,
  type SampleQualityGrade,
  mayLeaveDevice,
  validateBiometricSample,
} from '@tenki/domain';
import { computeBeatSeriesHrv } from '@tenki/engine';
import type { HeartRateMeasurement } from './bleHeartRate';

/**
 * A strap times beats electrically, so its values are the highest-fidelity
 * TENKI accepts — but only when the electrodes are actually reading.
 */
const STRAP_QUALITY: SampleQualityGrade = 5;
const STRAP_QUALITY_UNKNOWN_CONTACT: SampleQualityGrade = 4;
const STRAP_CONFIDENCE = 0.95;
const STRAP_CONFIDENCE_UNKNOWN_CONTACT = 0.85;

/** What one strap window produced. */
export interface BleStrapSamples {
  /** Samples ready for arbitration. Never contains `rr_interval_ms`. */
  samples: BiometricSample[];
  /** Why no HRV sample was produced, or null when one was. */
  hrvRefusedBecause: string | null;
  /** Entries the domain validator rejected, with its reasons. */
  rejected: string[][];
}

/**
 * Builds samples from an accumulated strap window.
 *
 * @param latest - The most recent decoded notification (for HR and contact).
 * @param windowIntervalsMs - Intervals accumulated over the window, in ms.
 * @param scope - Consent bucket this read was made under.
 * @param observedAtMs - When the window closed (Unix ms).
 * @param now - Current time, for the validator's clock check.
 * @returns Samples plus an account of anything withheld or rejected.
 */
export function buildStrapSamples(
  latest: HeartRateMeasurement,
  windowIntervalsMs: readonly number[],
  scope: BiometricPermissionScope,
  observedAtMs: number,
  now: number = Date.now(),
): BleStrapSamples {
  const contactKnown = latest.sensorContact !== 'not_supported';
  const quality = contactKnown ? STRAP_QUALITY : STRAP_QUALITY_UNKNOWN_CONTACT;
  const confidence = contactKnown ? STRAP_CONFIDENCE : STRAP_CONFIDENCE_UNKNOWN_CONTACT;

  const samples: BiometricSample[] = [];
  const rejected: string[][] = [];

  const push = (
    metric: BiometricSample['metric'],
    value: number,
    derivation: BiometricSample['derivation'],
  ): void => {
    // The privacy rule as a runtime check, not a convention. A future edit that
    // adds `rr_interval_ms` here fails loudly instead of quietly syncing a raw
    // beat series.
    if (!mayLeaveDevice(metric)) {
      throw new Error(`${metric} is local-only and must never become a sample`);
    }

    const result = validateBiometricSample(
      {
        metric,
        value,
        observedAt: observedAtMs,
        sourcePlatform: 'ble_chest',
        sourceDevice: null,
        sourceApp: null,
        quality: latest.sensorContact === 'poor' ? 2 : quality,
        confidence: latest.sensorContact === 'poor' ? 0.4 : confidence,
        derivation,
        permissionScope: scope,
      },
      now,
    );

    if (result.success) samples.push(result.value);
    else rejected.push(result.errors);
  };

  // The strap reports heart rate directly — that is an observation.
  push('heart_rate_bpm', latest.heartRateBpm, 'observed');

  const hrv = computeBeatSeriesHrv(windowIntervalsMs, {
    sensorContact: latest.sensorContact,
  });

  if (hrv.rmssdMs !== null) {
    // Computed by TENKI from intervals the strap really measured: derived, not
    // observed, and not an estimate either.
    push('hrv_rmssd_ms', hrv.rmssdMs, 'derived');
  }
  if (hrv.sdnnMs !== null) {
    push('hrv_sdnn_ms', hrv.sdnnMs, 'derived');
  }

  return {
    samples,
    hrvRefusedBecause: hrv.refusedBecause,
    rejected,
  };
}
