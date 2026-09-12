/**
 * @module biometric/ppg/to-reading
 * @description Bridges a camera scan into the shapes the scoring and baseline
 * engines take.
 *
 * The engines were built around a `BiometricReading` whose three physiological
 * fields are all required numbers. A phone-only scan frequently establishes one
 * of them. Rather than reshape a type the whole engine depends on, this bridge
 * fills the unmeasured fields with `NaN` and hands over an availability record
 * saying which they are.
 *
 * 🔴 `NaN` is deliberate and is not a sentinel to be replaced with something
 * "safer". A resting-plausible placeholder — 50 ms of HRV, 15 breaths a minute
 * — is indistinguishable downstream from a measurement, which is the exact
 * failure this whole pipeline exists to prevent. NaN cannot be mistaken for
 * one: it fails loudly wherever it is used, and both consumers refuse it
 * structurally as well (`updateMetricBaseline` drops non-finite values;
 * `calculateEdgeScore` excludes the driver outright).
 */

import type { BiometricReading, SignalQuality } from '../../common/types';
import type { PpgAnalysis } from './types';

/** Which physiological fields of the built reading are real measurements. */
export interface PpgReadingAvailability {
  hrv: boolean;
  respiration: boolean;
}

/** Everything a camera scan hands the engines. */
export interface PpgEngineInput {
  reading: BiometricReading;
  /**
   * Pulse-rate variability in ms, or null.
   *
   * 🔴 Deliberately a sibling of `reading` rather than a field inside it. A
   * `BiometricReading` carries `hrvRmssdMs`, and anything that lives next to
   * that field eventually gets copied into it. Keeping PRV outside means a
   * caller has to write the confusion out by hand rather than fall into it.
   */
  prvRmssdMs: number | null;
  availability: PpgReadingAvailability;
  signalQuality: SignalQuality;
  /**
   * False when the scan established no heart rate at all. There is no reading
   * to score in that case, and the caller must show the quality reasons rather
   * than an Edge Score.
   */
  scorable: boolean;
}

/** Maps the 0-100 quality score onto the engine's letter grade. */
function toGrade(score: number): SignalQuality['grade'] {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 50) return 'D';
  return 'F';
}

/**
 * Converts a completed camera analysis into engine inputs.
 *
 * @param analysis - The analysis returned by `analyzePpgScan`.
 * @param observedAtMs - When the scan was taken (Unix ms).
 * @returns Reading, availability and signal quality for the engines.
 */
export function toEngineInput(analysis: PpgAnalysis, observedAtMs: number): PpgEngineInput {
  return {
    reading: {
      hrBpm: analysis.heartRateBpm ?? Number.NaN,
      // 🔴 ALWAYS absent. A camera produces pulse-rate variability, and PRV is
      // not HRV: it may not populate this field, feed the HRV score driver, or
      // be labelled HRV to a user (founder rule, 2026-09-11). The value is
      // still computed and still shown as PRV — it just never travels under
      // this name, which is the only way the two stay distinguishable
      // downstream.
      hrvRmssdMs: Number.NaN,
      rrBrpm: analysis.respiratoryRateBrpm ?? Number.NaN,
      timestamp: observedAtMs,
    },
    /** PRV as measured, kept out of `reading` on purpose — see above. */
    prvRmssdMs: analysis.prvRmssdMs,
    availability: {
      hrv: false,
      respiration: analysis.respiratoryRateBrpm !== null,
    },
    signalQuality: {
      score: analysis.quality.score,
      grade: toGrade(analysis.quality.score),
      coverage: analysis.quality.coverage,
      stability: analysis.quality.stability,
      acceptable: analysis.heartRateBpm !== null,
    },
    scorable: analysis.heartRateBpm !== null,
  };
}
