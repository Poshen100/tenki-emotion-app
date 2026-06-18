/**
 * @module finger-precision/types
 * @description Shared domain types for the TENKI Finger PPG Precision Flow.
 *
 * @version 1.0
 */

export type FingerFlowStep =
  | 'intro'
  | 'permission_check'
  | 'readiness_check'
  | 'placement_guide'
  | 'signal_locking'
  | 'quick_estimate'
  | 'precision_build'
  | 'quality_recovery'
  | 'processing'
  | 'scan_complete'
  | 'retry_needed'
  | 'exit';

export type DotStatus = 'red' | 'yellow' | 'green';

export interface FingerQualityMetrics {
  /** Finger coverage ratio (0-1). Target: >= 0.85 */
  fingerCoverage: number;
  /** Flash/torch visibility ratio (0-1). Target: >= 0.70 */
  flashVisibility: number;
  /** Contact pressure confidence (0-1). Target: >= 0.75 */
  contactPressure: number;
  /** Motion stability ratio (0-1, where 1 is perfectly still). Target: >= 0.70 */
  motionStability: number;
  /** Pulse waveform validity (0-1). Target: >= 0.70 */
  pulseWaveform: number;
  /** Beat-to-beat interval regularity (0-1). Target: >= 0.70 */
  beatRegularity: number;
  /** Ambient light leakage (0-1, where 0 is no ambient light). Target: <= 0.25 */
  ambientLight: number;
  /** Weighted aggregate PPG confidence (0-1). Target: >= 0.65 */
  totalPpgConfidence: number;
}

export interface PrecisionProgress {
  validBeats: number;
  targetBeats: number;
  elapsedMs: number;
  currentTier: 'quick' | 'stable' | 'strong' | 'best';
  tierProgress: number;       // 0–1 within current tier
  overallProgress: number;    // 0–1 overall
  canStopEarly: boolean;      // true after 'stable' (60 beats)
}

export interface FingerPrecisionResult {
  bpm: number;
  hrvRmssdMs: number;
  rrBrpm: number;
  validBeats: number;
  signalQualityScore: number;
  confidenceUplift: number;
}

export type FingerRecoveryReason =
  | 'pressure_high'
  | 'finger_moved'
  | 'contact_lost'
  | 'ambient_light'
  | 'signal_unstable';
