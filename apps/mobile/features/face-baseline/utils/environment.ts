/**
 * @module face-baseline/utils/environment
 * @description Pure derivation of the three readiness checks from a normalized
 * raw environment signal. Library-agnostic: whatever camera/sensor stack Phase 2
 * adopts only needs to produce a `RawEnvironmentSignal`; this maps it to the
 * boolean checks the UI and store consume.
 */

import type { EnvironmentChecks } from '../types/faceBaseline.types';
import { clamp01 } from './progress';

/** Normalized (0–1) raw environment readings from a sensor/camera source. */
export interface RawEnvironmentSignal {
  /** Scene brightness — higher is brighter. */
  brightness: number;
  /** How well the face fills the ideal distance band — 1 = ideal. */
  distance: number;
  /** Movement jitter — lower is steadier. */
  stabilityJitter: number;
}

/** Thresholds gating each readiness check. `stabilityJitter` is an upper bound. */
export const ENV_THRESHOLDS = {
  brightness: 0.45,
  distance: 0.6,
  stabilityJitter: 0.35,
} as const;

/** Maps a raw environment signal to the three readiness checks. */
export function deriveEnvironmentChecks(raw: RawEnvironmentSignal): EnvironmentChecks {
  return {
    lighting: clamp01(raw.brightness) >= ENV_THRESHOLDS.brightness,
    distance: clamp01(raw.distance) >= ENV_THRESHOLDS.distance,
    stability: clamp01(raw.stabilityJitter) <= ENV_THRESHOLDS.stabilityJitter,
  };
}
