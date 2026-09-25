/**
 * @module biometric/beat-series
 * @description HRV from a true inter-beat series — a chest strap's RR
 * intervals, or any sensor that times beats directly rather than inferring them.
 *
 * The distinction from the camera path is not quality, it is kind. A strap
 * reports the interval between two beats it detected electrically; the camera
 * infers beat times from a light curve. Both can produce RMSSD, and the two
 * numbers are not interchangeable evidence even when they agree — which is why
 * a value from here is `derived` and a value from the camera is `estimated`
 * (see `domain/contracts/wearable-sample.ts`).
 *
 * 🔴 The rule this module exists to enforce: HRV comes from RR intervals or it
 * does not come at all. A strap that reports only a heart rate improves
 * heart-rate quality and supports no HRV claim whatsoever
 * (`docs/WEARABLE-INTEGRATION.md` §5). There is no path here from a bpm number
 * to a variability number, and there must never be one.
 */

import {
  MAX_ARTIFACT_FRACTION,
  MIN_INTERVALS_FOR_HRV,
  computeRmssd,
  computeSdnn,
  heartRateFromIntervals,
  rejectArtifacts,
} from './ppg/beats';

/** Why a strap window produced no HRV. */
export type BeatSeriesRefusal =
  | 'no_rr_intervals'
  | 'too_few_beats'
  | 'too_many_artifacts'
  | 'poor_sensor_contact';

/** HRV computed from a window of inter-beat intervals. */
export interface BeatSeriesHrv {
  /** RMSSD in ms, or null when the window did not support one. */
  rmssdMs: number | null;
  /**
   * SDNN in ms, or null. Reported alongside RMSSD and NEVER converted into it:
   * they are different statistics, and no fixed ratio relates them for a given
   * person (see `biometric/hrv.ts`).
   */
  sdnnMs: number | null;
  /** Heart rate implied by the accepted intervals, or null. */
  heartRateBpm: number | null;
  /** Intervals that survived artifact rejection. */
  acceptedBeats: number;
  /** Rejected share of the candidate intervals, 0..1. */
  artifactFraction: number;
  /** Why nothing was reported, or null when HRV was produced. */
  refusedBecause: BeatSeriesRefusal | null;
}

/** Options for a strap window. */
export interface BeatSeriesOptions {
  /**
   * Skin-contact state the strap reported. `poor` contact means the electrodes
   * were not reading the heart reliably, and the intervals from that window
   * describe the contact, not the user. `not_supported` is not a failure —
   * plenty of straps cannot report it — so it does not block.
   */
  sensorContact?: 'good' | 'poor' | 'not_supported';
  /** Fewest accepted intervals required. */
  minIntervals?: number;
}

/**
 * Computes HRV from a window of inter-beat intervals.
 *
 * @param intervalsMs - Inter-beat intervals in milliseconds, in time order.
 *   Callers converting from the BLE Heart Rate Measurement characteristic must
 *   already have divided by 1024 — the unit there is 1/1024 s, not ms.
 * @param options - Contact state and interval-count floor.
 * @returns HRV and the beat statistics behind it, or a refusal.
 */
export function computeBeatSeriesHrv(
  intervalsMs: readonly number[],
  options: BeatSeriesOptions = {},
): BeatSeriesHrv {
  const minIntervals = options.minIntervals ?? MIN_INTERVALS_FOR_HRV;

  const empty = (refusedBecause: BeatSeriesRefusal): BeatSeriesHrv => ({
    rmssdMs: null,
    sdnnMs: null,
    heartRateBpm: null,
    acceptedBeats: 0,
    artifactFraction: 0,
    refusedBecause,
  });

  if (intervalsMs.length === 0) {
    return empty('no_rr_intervals');
  }
  if (options.sensorContact === 'poor') {
    return empty('poor_sensor_contact');
  }

  const series = rejectArtifacts(intervalsMs);
  const artifactFraction = Math.round(series.artifactFraction * 100) / 100;

  if (series.artifactFraction > MAX_ARTIFACT_FRACTION) {
    return { ...empty('too_many_artifacts'), artifactFraction };
  }
  if (series.accepted.length < minIntervals) {
    return {
      ...empty('too_few_beats'),
      acceptedBeats: series.accepted.length,
      artifactFraction,
    };
  }

  return {
    rmssdMs: computeRmssd(series.accepted, minIntervals),
    sdnnMs: computeSdnn(series.accepted, minIntervals),
    heartRateBpm: heartRateFromIntervals(series.accepted),
    acceptedBeats: series.accepted.length,
    artifactFraction,
    refusedBecause: null,
  };
}

/**
 * Accumulates intervals across BLE notifications into one analysis window.
 *
 * A strap notifies roughly once a second with one or two intervals, so a window
 * long enough for HRV is assembled over a minute of packets rather than
 * arriving whole.
 *
 * @param window - Intervals gathered so far, oldest first.
 * @param incoming - Intervals from the newest notification.
 * @param maxIntervals - Cap on the window, oldest dropped first.
 * @returns The extended window.
 */
export function extendBeatWindow(
  window: readonly number[],
  incoming: readonly number[],
  maxIntervals = 300,
): number[] {
  const extended = [...window, ...incoming];
  return extended.length > maxIntervals ? extended.slice(extended.length - maxIntervals) : extended;
}
