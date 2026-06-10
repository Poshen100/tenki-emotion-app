/**
 * @module face-baseline/types
 * @description Shared domain types for the TENKI Face Baseline system.
 * Imported by the store, the state machine, utils, hooks, and screens.
 *
 * @version 3.0
 * @see apps/mobile/features/face-baseline/SPEC.md
 */

/** Linear step the user is currently on within the flow. */
export type FlowStep =
  | 'intro'
  | 'why_baseline'
  | 'permission_rationale'
  | 'permission_prompt'
  | 'permission_denied'
  | 'environment_check'
  | 'face_detecting'
  | 'face_locked'
  | 'neutral_capture'
  | 'motion_capture'
  | 'processing'
  | 'success'
  | 'retry_needed'
  | 'maturity_progress'
  | 'exit';

/** Camera permission lifecycle state. */
export type PermissionState = 'unknown' | 'prompt' | 'granted' | 'denied' | 'blocked';

/** Face acquisition / lock state during detection and capture. */
export type FaceLockState = 'searching' | 'tracking' | 'locked' | 'lost';

/** Which capture phase is active. */
export type CapturePhase = 'idle' | 'neutral' | 'motion' | 'done';

/** Local on-device processing status. */
export type ProcessingStatus = 'idle' | 'running' | 'success' | 'error';

/** Long-term baseline maturity stage (grows with daily scans). */
export type MaturityStage = 'new' | 'building' | 'ready' | 'mature';

/** Why a capture could not complete — drives recovery copy. */
export type RetryReason =
  | 'lowLight'
  | 'tooClose'
  | 'tooFar'
  | 'movement'
  | 'noFace'
  | 'multipleFaces'
  | 'glasses'
  | 'lostLock'
  | 'timeout'
  | 'computeError';

/** Single-issue quality nudge shown during capture (never more than one). */
export type QualityStatus = 'good' | 'movement' | 'lowLight' | 'reframe';

/** Live environment readiness checks. */
export interface EnvironmentChecks {
  lighting: boolean;
  distance: boolean;
  stability: boolean;
}

/** Real-time signal quality metrics (all normalized 0–1). */
export interface QualityMetrics {
  /** Signal Quality Index — higher is better. */
  sqi: number;
  /** Motion magnitude — lower is better. */
  motion: number;
  /** Face-in-frame coverage — higher is better. */
  coverage: number;
  /** Scene brightness — higher is better, to a point. */
  brightness: number;
}

/** A single entry in the post-baseline refinement history. */
export interface RefinementEntry {
  /** Epoch milliseconds. */
  at: number;
  /** Human-readable label, e.g. "Baseline updated". */
  label: string;
  /** Whether this scan updated the baseline or refined the model. */
  type: 'updated' | 'refined';
}
