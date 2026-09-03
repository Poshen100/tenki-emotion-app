/**
 * @module domain/policies/wearable-source-policy
 * @description Arbitration rules for biometric samples: which source wins when
 * two devices report the same metric, how long a sample stays usable, and how
 * legacy per-package source names map onto the canonical platform vocabulary.
 *
 * The same heartbeat can arrive three ways at once — a chest strap over BLE, an
 * Apple Watch through the health hub, and the camera scan itself. Picking one
 * has to be a rule, not whichever adapter resolved first.
 *
 * @see domain/contracts/wearable-sample.ts
 * @see docs/WEARABLE-INTEGRATION.md
 */

import {
  BIOMETRIC_SOURCE_PLATFORMS,
  type BiometricMetric,
  type BiometricSample,
  type BiometricSourcePlatform,
  MIN_USABLE_QUALITY,
} from '../contracts/wearable-sample';

/**
 * Source ranking, highest first. Ordered by how directly the platform measures
 * the beat: a chest strap reports true inter-beat intervals, a health hub
 * reports a watch's already-processed summary, the camera estimates from a
 * pulse signal, and a typed-in number is a last resort.
 *
 * Mirrors the ranking already used by the engine's fusion layer
 * (`packages/engine/src/fusion.ts`) so the two never disagree.
 */
export const SOURCE_PLATFORM_PRIORITY: Readonly<Record<BiometricSourcePlatform, number>> = {
  ble_chest: 100,
  healthkit: 80,
  health_connect: 80,
  garmin_api: 75,
  finger_scan: 60,
  camera: 45,
  manual: 20,
};

/**
 * How long a sample of each metric stays usable. Live metrics expire in
 * minutes because they describe the body right now; context metrics hold for
 * more than a day because that is their natural cadence — last night's sleep is
 * still the relevant sleep at 6pm.
 */
export const METRIC_FRESHNESS_MS: Readonly<Record<BiometricMetric, number>> = {
  heart_rate_bpm: 5 * 60_000,
  rr_interval_ms: 5 * 60_000,
  hrv_rmssd_ms: 60 * 60_000,
  hrv_sdnn_ms: 60 * 60_000,
  respiratory_rate_brpm: 60 * 60_000,
  spo2_pct: 6 * 60 * 60_000,
  resting_heart_rate_bpm: 36 * 60 * 60_000,
  sleep_duration_hours: 36 * 60 * 60_000,
  sleep_quality_pct: 36 * 60 * 60_000,
  steps_count: 12 * 60 * 60_000,
  active_energy_kcal: 12 * 60 * 60_000,
};

/** Age of a sample in ms; negative values (clock skew) are clamped to 0. */
export function sampleAgeMs(sample: BiometricSample, now: number): number {
  return Math.max(0, now - sample.observedAt);
}

/** Whether a sample is still inside its metric's freshness window. */
export function isSampleFresh(sample: BiometricSample, now: number): boolean {
  return sampleAgeMs(sample, now) <= METRIC_FRESHNESS_MS[sample.metric];
}

/** Whether a sample is good enough to be considered at all. */
export function isUsableSample(sample: BiometricSample, now: number): boolean {
  return sample.quality >= MIN_USABLE_QUALITY && isSampleFresh(sample, now);
}

/**
 * Compares two samples of the same metric. Platform rank decides first,
 * then quality, then confidence, then recency — so a stale chest-strap reading
 * never beats a fresh one from the same strap, but a chest strap does beat a
 * watch even when the watch is a few seconds newer.
 *
 * @returns Negative when `a` should be preferred over `b`, as Array#sort wants.
 */
function compareSamples(a: BiometricSample, b: BiometricSample): number {
  const rank = SOURCE_PLATFORM_PRIORITY[b.sourcePlatform] - SOURCE_PLATFORM_PRIORITY[a.sourcePlatform];
  if (rank !== 0) return rank;

  if (b.quality !== a.quality) return b.quality - a.quality;
  if (b.confidence !== a.confidence) return b.confidence - a.confidence;

  return b.observedAt - a.observedAt;
}

/**
 * Picks the one sample of a metric TENKI should act on.
 *
 * @param samples - Candidate samples; entries for other metrics are ignored.
 * @param metric - The metric being resolved.
 * @param now - Current time (Unix ms).
 * @returns The winning sample, or null when nothing usable is available.
 */
export function selectPreferredSample(
  samples: readonly BiometricSample[],
  metric: BiometricMetric,
  now: number,
): BiometricSample | null {
  const candidates = samples
    .filter((sample) => sample.metric === metric && isUsableSample(sample, now))
    .sort(compareSamples);

  return candidates[0] ?? null;
}

/**
 * Reduces a mixed batch to at most one sample per metric.
 * The two HRV metrics resolve independently and are never merged: an SDNN
 * reading from Apple Health and an RMSSD reading from a chest strap are
 * different quantities, and collapsing them would silently invent a number.
 *
 * @param samples - Samples from every connected source.
 * @param now - Current time (Unix ms).
 * @returns One winning sample per metric that had a usable candidate.
 */
export function resolveLatestByMetric(
  samples: readonly BiometricSample[],
  now: number,
): Map<BiometricMetric, BiometricSample> {
  const resolved = new Map<BiometricMetric, BiometricSample>();

  for (const sample of samples) {
    if (!isUsableSample(sample, now)) continue;

    const incumbent = resolved.get(sample.metric);
    if (!incumbent || compareSamples(sample, incumbent) < 0) {
      resolved.set(sample.metric, sample);
    }
  }

  return resolved;
}

/**
 * Legacy source names still in the codebase, mapped onto canonical platforms.
 * Lets adapters and stores converge on this contract without a breaking rename
 * of `BiometricSource` / `FusionSource` / `AutonomicSource` in one go.
 */
const LEGACY_SOURCE_ALIASES: Readonly<Record<string, BiometricSourcePlatform>> = {
  watch_healthkit: 'healthkit',
  finger_ppg: 'finger_scan',
  face_estimate: 'camera',
  rppg_glabella: 'camera',
  rppg_forehead: 'camera',
  rppg_cheek: 'camera',
};

/**
 * Resolves any known source name — canonical or legacy — to a canonical
 * platform.
 *
 * @param source - A canonical platform or a legacy per-package source name.
 * @returns The canonical platform, or null when the name is unknown.
 */
export function resolveSourcePlatform(source: string): BiometricSourcePlatform | null {
  const canonical = BIOMETRIC_SOURCE_PLATFORMS.find((platform) => platform === source);
  if (canonical) {
    return canonical;
  }
  // Own-property check only: an inherited key like "toString" is not an alias.
  return Object.hasOwn(LEGACY_SOURCE_ALIASES, source) ? LEGACY_SOURCE_ALIASES[source] : null;
}
