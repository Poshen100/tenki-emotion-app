/**
 * @module domain/contracts/wearable-sample
 * @description Canonical, brand-independent contract for every biometric
 * sample that enters TENKI — camera scan, finger scan, BLE chest strap, Apple
 * Health (HealthKit), Android Health Connect, or a vendor cloud API.
 *
 * Why this exists: the repo already carries four parallel source vocabularies
 * (`BiometricSource` and `FusionSource` in packages/engine, `HrvSource` in
 * biometric/hrv, `AutonomicSource` in the mobile store). Every new device
 * otherwise adds a fifth. Adapters normalize INTO this contract; nothing
 * downstream of the adapter layer should know which brand of watch produced a
 * number.
 *
 * Three rules are structural, not stylistic:
 *   1. SDNN and RMSSD are DIFFERENT metrics and never share a field.
 *      Apple Health reports HRV as SDNN; Health Connect reports RMSSD.
 *   2. Every sample carries its own provenance, quality and freshness. A bare
 *      number with no source and no timestamp cannot be arbitrated later.
 *   3. Raw inter-beat series stay on the device (`LOCAL_ONLY_METRICS`) —
 *      CLAUDE.md privacy rule, enforced here rather than remembered.
 *
 * Language stays measurement-only: no diagnosis, no emotion detection, no
 * financial framing ever enters this contract.
 * @see docs/WEARABLE-INTEGRATION.md
 */

/**
 * Metrics TENKI accepts from any source. Scalar by design — a summary
 * (a night of sleep, a workout) enters as its derived scalars so that
 * arbitration, freshness and baselines work uniformly across every metric.
 */
export const BIOMETRIC_METRICS = [
  'heart_rate_bpm',
  'resting_heart_rate_bpm',
  'rr_interval_ms',
  'hrv_sdnn_ms',
  'hrv_rmssd_ms',
  'respiratory_rate_brpm',
  'spo2_pct',
  'sleep_duration_hours',
  'sleep_quality_pct',
  'steps_count',
  'active_energy_kcal',
] as const;
export type BiometricMetric = typeof BIOMETRIC_METRICS[number];

/**
 * Where a sample physically came from. `healthkit` / `health_connect` are the
 * two system health hubs (an Apple Watch, a Garmin syncing into Apple Health,
 * and a Fitbit syncing into Health Connect all arrive this way); `garmin_api`
 * is the vendor cloud, reserved for metrics no health hub exposes.
 */
export const BIOMETRIC_SOURCE_PLATFORMS = [
  'camera',
  'finger_scan',
  'ble_chest',
  'healthkit',
  'health_connect',
  'garmin_api',
  'manual',
] as const;
export type BiometricSourcePlatform = typeof BIOMETRIC_SOURCE_PLATFORMS[number];

/**
 * Consent bucket the sample was collected under. Permission is requested per
 * bucket and contextually (after a scan, never at cold start), so a user who
 * grants `scan` alone never has history read.
 */
export const BIOMETRIC_PERMISSION_SCOPES = ['scan', 'context', 'history'] as const;
export type BiometricPermissionScope = typeof BIOMETRIC_PERMISSION_SCOPES[number];

/**
 * Coarse quality grade, 0 (unusable) to 5 (reference-grade). Deliberately
 * coarse: every platform reports quality differently, and an adapter can map
 * honestly onto six buckets where it could not onto a percentage.
 */
export const SAMPLE_QUALITY_GRADES = [0, 1, 2, 3, 4, 5] as const;
export type SampleQualityGrade = typeof SAMPLE_QUALITY_GRADES[number];

/** Minimum quality an adapter's sample must reach to enter arbitration. */
export const MIN_USABLE_QUALITY: SampleQualityGrade = 2;

/**
 * Metrics that must never leave the device. `rr_interval_ms` is a raw
 * inter-beat series — the highest-resolution biometric TENKI touches — and is
 * local-only under the CLAUDE.md privacy rule. Derived values computed FROM it
 * (RMSSD, SDNN) are not raw and are not listed here.
 */
export const LOCAL_ONLY_METRICS: readonly BiometricMetric[] = ['rr_interval_ms'];

/** One normalized reading from any source. */
export interface BiometricSample {
  /** What was measured. */
  metric: BiometricMetric;
  /** Value in the metric's own unit (the unit is part of the metric name). */
  value: number;
  /** When the measurement was taken, not when it was read (Unix ms). */
  observedAt: number;
  /** Which platform produced it. */
  sourcePlatform: BiometricSourcePlatform;
  /** Device model as reported by the platform, when known ("Polar H10"). */
  sourceDevice: string | null;
  /** Writing app as reported by the platform, when known ("Garmin Connect"). */
  sourceApp: string | null;
  /** Adapter's honest quality grade. */
  quality: SampleQualityGrade;
  /** How much the adapter trusts this value, 0..1. */
  confidence: number;
  /** Consent bucket this sample was collected under. */
  permissionScope: BiometricPermissionScope;
}

/** True when `metric` is one of the two HRV metrics. */
export function isHrvMetric(metric: BiometricMetric): boolean {
  return metric === 'hrv_sdnn_ms' || metric === 'hrv_rmssd_ms';
}

/**
 * Whether a derived form of this metric may be synced off-device at all.
 * Returns false for raw series regardless of user consent — consent widens
 * what TENKI reads, never what leaves the device.
 */
export function mayLeaveDevice(metric: BiometricMetric): boolean {
  return !LOCAL_ONLY_METRICS.includes(metric);
}
