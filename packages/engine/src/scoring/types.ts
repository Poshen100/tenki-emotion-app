/**
 * @module scoring/types
 * @description Decision Edge Score v3 type definitions.
 * Edge Score is a 0-100 weighted multi-factor readiness score.
 *
 * @version 3.0
 * @see ANTIGRAVITY.md v3.0 Section 1.1
 */

import type { ConfidenceBreakdown, BiometricSource } from '../common/types';
import type { FusionSource } from '../types';

// ─────────────────────────────────────────────
// Edge Score Weights
// ─────────────────────────────────────────────

/** Weight configuration for 8-factor Edge Score calculation. */
export interface EdgeWeights {
  /** HRV vs personal baseline. */
  hrvVsBaseline: number;
  /** Heart-rate stability. */
  hrStability: number;
  /** Respiration stability. */
  respirationStability: number;
  /** Stress proxy vs baseline. */
  stressProxyVsBaseline: number;
  /** Sleep recovery input. */
  sleepRecovery: number;
  /** Recent trend consistency. */
  recentTrend: number;
  /** Baseline freshness. */
  baselineFreshness: number;
  /** Current signal quality. */
  signalQuality: number;
}

/**
 * Default Edge Score weights as specified in ANTIGRAVITY.md v3 Section 1.1.
 * Total must equal 100.
 */
export const EDGE_WEIGHTS: EdgeWeights = {
  hrvVsBaseline: 25,
  hrStability: 15,
  respirationStability: 10,
  stressProxyVsBaseline: 15,
  sleepRecovery: 15,
  recentTrend: 10,
  baselineFreshness: 5,
  signalQuality: 5,
} as const;

/** Verify weights sum to 100 at compile time. */
const _WEIGHT_SUM =
  EDGE_WEIGHTS.hrvVsBaseline +
  EDGE_WEIGHTS.hrStability +
  EDGE_WEIGHTS.respirationStability +
  EDGE_WEIGHTS.stressProxyVsBaseline +
  EDGE_WEIGHTS.sleepRecovery +
  EDGE_WEIGHTS.recentTrend +
  EDGE_WEIGHTS.baselineFreshness +
  EDGE_WEIGHTS.signalQuality;

// ─────────────────────────────────────────────
// Edge Score Zones
// ─────────────────────────────────────────────

/** Readiness zone classification (3 zones). */
export type EdgeZone = 'clear' | 'neutral' | 'strain';

/** Zone boundary definitions. */
export const EDGE_ZONE_BOUNDARIES = {
  CLEAR: { min: 70, max: 100 },
  NEUTRAL: { min: 40, max: 69 },
  STRAIN: { min: 0, max: 39 },
} as const;

/**
 * v0 — unvalidated heuristic. Directional subtype within the `strain` zone,
 * distinguishing overstimulation (HR up, HRV not elevated) from depletion
 * (HR flat/low, HRV down) relative to the user's personal baseline.
 * Resolves the open "which direction is strain?" question flagged in
 * docs/brand.md § 7 (Naming Migration) — not yet validated against real
 * user outcomes, treat as exploratory.
 */
export type StrainSubtype = 'overstimulated' | 'depleted' | 'unknown';

/** Zone display configuration. */
export interface EdgeZoneConfig {
  /** Zone identifier. */
  zone: EdgeZone;
  /** Display label (safe wording). */
  label: string;
  /** UI background color. */
  color: string;
  /** Score range. */
  min: number;
  max: number;
}

/** Zone configurations for UI rendering. */
// Zone tones kept in sync with @tenki/shared design-tokens brand spine
// (Neutral slate / Strain ember); engine can't import shared (would be circular).
export const EDGE_ZONE_CONFIGS: readonly EdgeZoneConfig[] = [
  { zone: 'clear', label: 'Clear state', color: '#00B4D8', min: 70, max: 100 },
  { zone: 'neutral', label: 'Neutral / mixed state', color: '#64748B', min: 40, max: 69 },
  { zone: 'strain', label: 'Elevated strain', color: '#C2703D', min: 0, max: 39 },
] as const;

// ─────────────────────────────────────────────
// Score Driver Types
// ─────────────────────────────────────────────

/** Key identifier for an Edge Score driver. */
export type ScoreDriverKey =
  | 'hrv_vs_baseline'
  | 'hr_stability'
  | 'respiration_stability'
  | 'stress_proxy_vs_baseline'
  | 'sleep_recovery'
  | 'recent_trend'
  | 'baseline_freshness'
  | 'signal_quality';

/** Direction of a score driver's influence. */
export type DriverDirection = 'positive' | 'neutral' | 'negative';

/** Individual score driver breakdown. */
export interface ScoreDriver {
  /** Factor key. */
  key: ScoreDriverKey;
  /** Direction of influence. */
  direction: DriverDirection;
  /** Weighted impact contribution (-1 to 1). */
  impact: number;
  /** Raw sub-score before weighting (0-100). */
  rawSubScore: number;
}

// ─────────────────────────────────────────────
// Edge Score Result
// ─────────────────────────────────────────────

/** Complete Edge Score output. */
export interface EdgeScoreResult {
  /** Final weighted score 0-100. */
  score: number;
  /** Readiness zone. */
  zone: EdgeZone;
  /** Confidence breakdown. */
  confidence: ConfidenceBreakdown;
  /** Individual driver contributions. */
  drivers: ScoreDriver[];
  /** Human-readable copy (safe wording, compliance-checked). */
  copy: {
    /** Short headline. */
    headline: string;
    /** Longer explanation body. */
    body: string;
  };
  /** Metadata for debugging and audit. */
  metadata: EdgeScoreMetadata;
}

/** Edge Score computation metadata. */
export interface EdgeScoreMetadata {
  /** Baseline version used. */
  baselineVersion: string;
  /** Scan quality score 0-100. */
  scanQuality: number;
  /** Data completeness ratio 0-1. */
  dataCompleteness: number;
  /** Sources used for this score (BiometricSource, or a FusionSource when stamped by the fusion pipeline). */
  sourceMix: (BiometricSource | FusionSource)[];
  /** Timestamp of computation (Unix ms). */
  computedAt: number;
}

// ─────────────────────────────────────────────
// Edge Detector Types
// ─────────────────────────────────────────────

/**
 * Detected readiness state (safe vocabulary only).
 *
 * Note there is no 'recovered' member, and deliberately so. Recovery is a
 * statement about having come back from something worse, which a pure function
 * of the current score cannot express — you would need the previous state to
 * know whether this one counts as a recovery. The detector also only engages
 * above 68, so every state it ever sees is already a good one.
 *
 * The recovery narrative lives in the EDGE STATUS chip instead
 * (`resolveEdgeStatus()` in `shared/growth/edge-status.ts`, driven by zone).
 * Keeping it in one place avoids two recovery concepts computed different ways.
 */
export type DetectedState =
  | 'calm'
  | 'focused'
  | 'balanced'
  | 'stable'
  | 'clear';

/** Edge Detector detection thresholds. */
export const EDGE_DETECTOR_THRESHOLDS = {
  /** Soft detect: initial signal. */
  SOFT: { minScore: 68, minConfidence: 0.70 },
  /** Strong detect: confirmed readiness. */
  STRONG: { minScore: 78, minConfidence: 0.80 },
  /** Hold duration before alert (seconds). */
  HOLD_DURATION_SEC: 180,
  /** Minimum consecutive accepted windows. */
  MIN_CONSECUTIVE_WINDOWS: 2,
  /**
   * Daily alert cap.
   *
   * @deprecated Delivery is not the engine's job. The authority on whether a
   * detection reaches the user is `evaluateEdgeNotification()` in
   * `domain/src/policies/edge-notification-policy.ts`, which also owns quiet
   * hours, cooldown and the tier check. This constant stays so the detector's
   * own suppression flag keeps working, but callers must not treat it as the
   * delivery limit.
   */
  DAILY_ALERT_CAP: 5,
} as const;

/** Edge Detector state. */
export interface EdgeDetectorState {
  /** Whether a readiness window is currently detected. */
  isDetected: boolean;
  /** Detection strength. */
  strength: 'none' | 'soft' | 'strong';
  /** Detected state label. */
  detectedState: DetectedState | null;
  /** Duration held so far (seconds). */
  heldDurationSec: number;
  /** Consecutive accepted windows. */
  consecutiveWindows: number;
  /** Alerts fired today. */
  alertsFiredToday: number;
  /** Whether alert was suppressed (cap reached, quiet hours, etc.). */
  suppressed: boolean;
  /** Suppression reason, if applicable. */
  suppressionReason: string | null;
}
