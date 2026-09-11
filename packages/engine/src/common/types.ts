/**
 * @module common/types
 * @description TENKI CORE v3 — common type definitions shared across all engine layers.
 * This file defines the foundational types for the privacy-first cognitive wellness system.
 *
 * @version 3.0
 * @see ANTIGRAVITY.md v3.0 Section 1
 */

// ─────────────────────────────────────────────
// Biometric Input Types
// ─────────────────────────────────────────────

/** Normalized biometric reading from any supported source. */
export interface BiometricReading {
  /** Heart rate in beats per minute. */
  hrBpm: number;
  /**
   * HRV RMSSD in milliseconds. RMSSD ONLY — an SDNN value (Apple Health) must
   * never be converted into this field; it belongs on its own baseline track.
   * @see packages/engine/src/biometric/hrv.ts — `HrvMetric`
   */
  hrvRmssdMs: number;
  /** Respiratory rate in breaths per minute. */
  rrBrpm: number;
  /** Timestamp of this reading (Unix ms). */
  timestamp: number;
}

/** Data source for biometric readings. */
export type BiometricSource =
  | 'healthkit'
  | 'health_connect'
  | 'finger_scan'
  | 'ble_chest'
  | 'manual';

/** Signal quality assessment for a biometric reading. */
export interface SignalQuality {
  /** Overall quality score 0-100. */
  score: number;
  /** Quality grade. */
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  /** Coverage ratio 0-1 (portion of scan window with usable signal). */
  coverage: number;
  /** Stability ratio 0-1 (inverse of motion artifact intensity). */
  stability: number;
  /** Whether the signal meets minimum acceptance threshold. */
  acceptable: boolean;
}

/** Sleep recovery input (from HealthKit, Health Connect, or manual). */
export interface SleepRecoveryInput {
  /** Sleep duration in hours. */
  durationHours: number | null;
  /** Sleep quality score 0-100 (if available). */
  qualityScore: number | null;
  /** Source of sleep data. */
  source: 'healthkit' | 'health_connect' | 'manual' | 'none';
  /** Staleness: how many hours ago was this data collected. */
  stalenessHours: number;
}

// ─────────────────────────────────────────────
// Baseline Types
// ─────────────────────────────────────────────

/** Time-of-day bucket for baseline segmentation. */
export type TimeBucket = 'morning' | 'midday' | 'evening';

/** Baseline data for a single metric, within a time bucket. */
export interface MetricBaseline {
  /** Running mean. */
  mean: number;
  /** Running standard deviation. */
  std: number;
  /** Number of accepted samples. */
  sampleCount: number;
  /** Last update timestamp (Unix ms). */
  lastUpdatedAt: number;
}

/** Complete baseline profile for a user. */
export interface BaselineProfile {
  /** HR baseline per time bucket. */
  hr: Record<TimeBucket, MetricBaseline>;
  /** HRV RMSSD baseline per time bucket. */
  hrv: Record<TimeBucket, MetricBaseline>;
  /**
   * HRV SDNN baseline per time bucket — a SEPARATE track, because SDNN and
   * RMSSD are different statistics and cannot share a baseline. Absent on
   * profiles persisted before the track existed; treat that as "no SDNN
   * baseline yet" rather than backfilling it from the RMSSD track.
   */
  hrvSdnn?: Record<TimeBucket, MetricBaseline>;
  /** Respiratory rate baseline per time bucket. */
  rr: Record<TimeBucket, MetricBaseline>;
  /** Stress proxy baseline (overall, not bucketed). */
  stressProxy: MetricBaseline;
  /** Overall baseline maturity. */
  maturity: BaselineMaturity;
  /** Total accepted scan count across all buckets. */
  totalScanCount: number;
  /** Baseline version identifier. */
  version: string;
}

/** Baseline maturity level. */
export type BaselineMaturity = 'new' | 'building' | 'ready' | 'mature';

/** Minimum accepted scans for baseline thresholds. */
export const BASELINE_THRESHOLDS = {
  /** Minimum scans to transition from 'new' to 'building'. */
  BUILDING: 1,
  /** Minimum scans to transition from 'building' to 'ready'. */
  READY: 5,
  /** Minimum scans across at least 3 days for 'mature'. */
  MATURE: 15,
  /** Minimum distinct days for 'mature'. */
  MATURE_DAYS: 3,
} as const;

// ─────────────────────────────────────────────
// Confidence Types
// ─────────────────────────────────────────────

/** Confidence band classification. */
export type ConfidenceBand = 'high' | 'moderate' | 'low';

/** Confidence band thresholds. */
export const CONFIDENCE_BANDS = {
  HIGH: { min: 0.80, max: 1.00 },
  MODERATE: { min: 0.55, max: 0.79 },
  LOW: { min: 0.00, max: 0.54 },
} as const;

/** Multi-dimensional confidence breakdown. */
export interface ConfidenceBreakdown {
  /** Overall confidence score 0-1. */
  overall: number;
  /** Confidence band. */
  band: ConfidenceBand;
  /** Individual factor confidences. */
  factors: {
    baselineMaturity: number;
    inputCompleteness: number;
    signalQuality: number;
    recency: number;
    crossSourceAgreement: number;
  };
}

// ─────────────────────────────────────────────
// Feature Flag Types
// ─────────────────────────────────────────────

/** All feature flag identifiers. */
export type FeatureFlagId =
  | 'edge_score_v3'
  | 'session_governance_v3'
  | 'scan_pipeline_v1'
  | 'lab_prediction'
  | 'benchmark_opt_in'
  | 'reviewer_demo_mode'
  | 'tradingview_alerts_v1'
  /**
   * Camera-derived pulse-rate variability.
   *
   * Default ON — but the flag is a kill switch, not the gate. PRV reaches a
   * user only through `ppg/beat-template.ts`, whose threshold was calibrated
   * against PRV's actual error: the quality score is blind to sensor noise, so
   * a capture it rates **99** can carry a **156%** PRV error, and only
   * beat-shape stability separates the two. This exists so that finding can be
   * acted on remotely if real devices disagree with the synthetic calibration.
   *
   * 🔴 Whatever this flag says, camera PRV is NOT HRV: it never populates
   * `BiometricReading.hrvRmssdMs`, never feeds the HRV score driver, and is
   * never labelled HRV in production (founder rule, 2026-09-11).
   *
   * @see docs/PHONE-PPG.md
   */
  | 'camera_prv_estimates'
  /**
   * Camera-derived respiratory rate, as a standalone Breath Lock measurement.
   *
   * 🔴 Default OFF, and not as a caution setting. founder rule, 2026-09-11:
   * camera respiratory rate *may be released only* as Breath Lock — its own
   * 45-60 s capture protocol, its own independent signal-quality gates,
   * persisted provenance and rejection reasons, and validation against a
   * reference source. None of that exists yet, so the metric may not appear
   * at all. Turning this on before `ppg/breath-lock.ts` has a capture layer
   * and a device validation behind it would ship exactly the claim the rule
   * forbids.
   *
   * ⚠️ Both flags govern the CAMERA path only. A chest strap's RR intervals
   * are a different provenance with a different quality path, and
   * `biometric/beat-series.ts` is not affected.
   *
   * @see docs/PHONE-PPG.md
   */
  | 'camera_breath_lock';

// ─────────────────────────────────────────────
// Subscription Types
// ─────────────────────────────────────────────

/** Subscription tier (v3: two tiers only). */
export type SubscriptionTier = 'free' | 'premium';

/** Billing cadence for premium tier. */
export type BillingCadence = 'monthly' | 'yearly';
