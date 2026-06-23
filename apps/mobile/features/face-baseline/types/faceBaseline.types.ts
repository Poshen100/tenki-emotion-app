/**
 * @module face-baseline/types
 * @description Shared domain types for the TENKI Face Baseline system.
 * Imported by the store, the state machine, utils, hooks, and screens.
 *
 * @version 3.0
 * @see apps/mobile/features/face-baseline/SPEC.md
 */

/**
 * Linear step the user is currently on within the flow.
 *
 * The guided-arc capture is split into two precise sub-states (`arc_left`,
 * `arc_right`) so each head-turn side has its own quality gate, and a dedicated
 * `stability_pass` follows to anchor the emotional (not just geometric) baseline
 * — mirroring iPhone Face ID's multi-angle enrollment.
 */
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
  | 'arc_left'
  | 'arc_right'
  | 'stability_pass'
  | 'processing'
  | 'success'
  | 'retry_needed'
  | 'maturity_progress'
  | 'exit';

/** Context in which the face-baseline ceremony was entered. */
export type EntryContext = 'onboarding' | 'standalone';

/** Camera permission lifecycle state. */
export type PermissionState = 'unknown' | 'prompt' | 'granted' | 'denied' | 'blocked';

/** Face acquisition / lock state during detection and capture. */
export type FaceLockState = 'searching' | 'tracking' | 'locked' | 'lost';

/**
 * Which capture phase is active. `arc` spans both arc_left and arc_right (one
 * continuous closing halo); `stability` is the relaxed one-breath pass.
 */
export type CapturePhase = 'idle' | 'neutral' | 'arc' | 'stability' | 'done';

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
  | 'poseOutOfRange'
  | 'timeout'
  | 'computeError';

/** Single-issue quality nudge shown during capture (never more than one). */
export type QualityStatus = 'good' | 'movement' | 'lowLight' | 'reframe' | 'poseRange';

/** Live environment readiness checks. */
export interface EnvironmentChecks {
  lighting: boolean;
  distance: boolean;
  stability: boolean;
}

/**
 * Real-time signal quality metrics (all normalized 0–1).
 *
 * The first four are the generic capture signals shared with finger PPG; the
 * six face-specific signals below require on-device face detection / landmarks
 * (wired in the native session). Per-phase gates in `utils/qualityThresholds`
 * read different subsets — capture quality is never a single score.
 */
export interface QualityMetrics {
  /** Signal Quality Index — higher is better. */
  sqi: number;
  /** Motion magnitude — lower is better. */
  motion: number;
  /** Face-in-frame coverage — higher is better. */
  coverage: number;
  /** Scene brightness — higher is better, to a point. */
  brightness: number;
  /** Face landmark tracking confidence — higher is better. */
  landmarkConfidence: number;
  /** How much of the target head-pose arc has been covered — higher is better. */
  headPoseRange: number;
  /** Evenness of lighting across the face (no harsh shadow/backlight) — higher is better. */
  lightingUniformity: number;
  /** Eye/blink visibility confidence (eyes open and trackable) — higher is better. */
  eyeVisibility: number;
  /** Confidence the expression is at rest (relaxed, neutral) — higher is better. */
  neutralExpressionConfidence: number;
  /** Aggregate confidence the captured signal supports a reliable baseline — higher is better. */
  totalBaselineConfidence: number;
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
