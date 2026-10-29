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

/**
 * Where a physiological input came from.
 *
 * 🔴 This is what decides whether the evidence cap applies. It is NOT a quality
 * measure: a pristine camera capture is still camera evidence, and a mediocre
 * chest-strap reading is still sensor evidence. Quality and provenance answer
 * different questions and collapsing them is how a phone ends up claiming
 * medical-grade precision because the light happened to be good.
 */
export const PHYSIOLOGY_EVIDENCE_SOURCES = ['phone_camera', 'wearable', 'rr_sensor', 'none'] as const;
export type PhysiologyEvidenceSource = typeof PHYSIOLOGY_EVIDENCE_SOURCES[number];

/**
 * Where each physiological input for one reading came from.
 *
 * ⚠️ `hrv` deliberately cannot be `phone_camera`. Camera-derived pulse-rate
 * variability is a different quantity from RR-interval HRV and may never
 * populate an HRV field (founder rule, 2026-09-11). The type is the enforcement:
 * there is no value a caller could pass to claim otherwise.
 */
export interface PhysiologyEvidenceSources {
  /** Heart rate / resting pulse. */
  pulse: PhysiologyEvidenceSource;
  /** Respiratory rate. */
  breath: PhysiologyEvidenceSource;
  /** HRV — from an RR-interval series or a platform, never from a camera. */
  hrv: 'rr_sensor' | 'wearable' | 'none';
  /** Sleep and recovery. */
  sleep: 'wearable' | 'none';
}

/**
 * How far phone-derived physiology may move the Edge Score, per evidence item.
 *
 * 🔴 founder rule, 2026-09-11: **"沒有可用生理訊號 ≠ 自動加高其他分項權重
 * ≠ Edge Score 變高"**. A phone can produce real evidence, but not enough of it
 * to carry a readiness score on its own — so it moves the score within a
 * ceiling instead of inheriting the weight of everything that is missing.
 *
 * ⚠️ `coupling` and `regulation_response` are RESERVED. Neither is computed
 * yet, so 5 of the 15 points are unreachable today. That is deliberate: the
 * ceiling is the budget for the finished feature, and a later commit that
 * starts computing coupling must not have to argue for more room. A test
 * asserts the reserve stays unspent.
 */
export const PHONE_EVIDENCE_CAPS = {
  /** High-quality Pulse Anchor: resting, comparable, high signal integrity. */
  pulse: 6,
  /** Breath Lock: 45-60 s, high-quality periodic signal. */
  breath: 4,
  /** Breath-pulse coupling — RESERVED, not yet computed. */
  coupling: 3,
  /** Before/after regulation response — RESERVED, not yet computed. */
  regulation_response: 2,
} as const;

/** Total ceiling on phone-derived physiology, in Edge Score points. */
export const PHONE_ONLY_PHYSIOLOGY_CAP = 15;

/** The score every reading starts from before any evidence moves it. */
export const EDGE_SCORE_ANCHOR = 50;

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
  /**
   * True when nothing measured this driver, so it moved the score by zero.
   *
   * 🔴 Stated rather than inferred from a NaN. Analytics reads driver impacts,
   * and `impact || 0` silently turns "not measured" into "exactly neutral" —
   * which is how a phone-only user ends up in an insight about their HRV trend.
   */
  excluded: boolean;
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
  /**
   * Drivers left out because this reading produced no input for them. They move
   * the score by nothing; **no weight is redistributed** (see the aggregation
   * comment in `edge-score.ts`). Empty for a complete reading.
   */
  excludedDrivers?: ScoreDriverKey[];
  /**
   * Drivers whose movement hit the phone-evidence ceiling
   * (`PHONE_EVIDENCE_CAPS`). Present so the cap is auditable rather than an
   * invisible haircut: if a driver is here, the score is deliberately saying
   * less than the raw sub-score would.
   */
  cappedDrivers?: ScoreDriverKey[];
  /**
   * How many points phone-derived physiology actually moved the score, after
   * both ceilings. Signed: positive raised it, negative lowered it.
   *
   * 🔴 Reported rather than inferred. "How much of this number came from a
   * phone camera" is the question the cap exists to answer, and leaving it to
   * be reconstructed by differencing two readings is how it stops being
   * checkable — the sub-scores are not all centred on the anchor, so any such
   * difference measures a range, not a contribution.
   */
  phoneEvidenceMovement?: number;
  /** The ceiling that movement was held to (`PHONE_ONLY_PHYSIOLOGY_CAP`). */
  phoneEvidenceCap?: number;
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

/** Detected readiness state (safe vocabulary only). */
export type DetectedState =
  | 'calm'
  | 'focused'
  | 'balanced'
  | 'stable'
  | 'recovered'
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
  /** Daily alert cap. */
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
