/**
 * @module session/types
 * @description Session Governance Layer v3 type definitions.
 * Governs mode/template selection, pre-check, gating, timer, and violations.
 * Templates govern *process discipline*, NOT financial decisions.
 *
 * @version 3.0
 * @see ANTIGRAVITY.md v3.0 Section 5
 */

// ─────────────────────────────────────────────
// Mode Definitions
// ─────────────────────────────────────────────

/** Session mode identifier. */
export type SessionMode = 'health_reset' | 'focus' | 'performance' | 'trader';

/** Mode display configuration. */
export interface ModeConfig {
  /** Mode identifier. */
  id: SessionMode;
  /** Display name (English). */
  name: string;
  /** Display name (繁體中文). */
  nameZh: string;
  /** Icon (emoji). */
  icon: string;
  /** Short description (safe wording). */
  description: string;
  /** Whether this mode supports templates. */
  hasTemplates: boolean;
}

/** All available session modes. */
export const SESSION_MODES: Record<SessionMode, ModeConfig> = {
  health_reset: {
    id: 'health_reset',
    name: 'Health Reset',
    nameZh: '健康重置',
    icon: '🧘',
    description: 'Recovery and grounding after elevated strain.',
    hasTemplates: false,
  },
  focus: {
    id: 'focus',
    name: 'Focus',
    nameZh: '深度專注',
    icon: '🎯',
    description: 'Pre-check before deep work, study, or creation.',
    hasTemplates: false,
  },
  performance: {
    id: 'performance',
    name: 'Performance',
    nameZh: '高表現模式',
    icon: '⚡',
    description: 'Pre-check before presentations, meetings, or competitions.',
    hasTemplates: false,
  },
  trader: {
    id: 'trader',
    name: 'Decision Mode',
    nameZh: '決策紀律模式',
    icon: '📊',
    description: 'Process discipline for high-stakes decision-making.',
    hasTemplates: true,
  },
} as const;

// ─────────────────────────────────────────────
// Template Definitions (Trader Mode Only)
// ─────────────────────────────────────────────

/** Trader template identifier. */
export type TraderTemplateId = 'FBD' | 'CANSLIM' | 'MODE_2';

/** Template segment for progress visualization. */
export interface TemplateSegment {
  /** Segment start time (seconds, inclusive). */
  startSec: number;
  /** Segment end time (seconds, exclusive). */
  endSec: number;
  /** Segment UI color (hex). */
  color: string;
  /** Segment display label. */
  label: string;
}

/** Template rule set. */
export interface TemplateRules {
  /** Time segments covering the full template duration. */
  segments: TemplateSegment[];
  /** Optimal readiness window within the template. */
  readinessWindow?: { startSec: number; endSec: number };
  /** Whether early completion is prevented. */
  preventEarlyComplete: boolean;
  /** Lock event marking for the first N seconds. */
  lockEventSec?: number;
  /** Template primary UI color (hex). */
  barColor: string;
}

/** Trader template definition. */
export interface TraderTemplate {
  /** Template unique ID. */
  id: TraderTemplateId;
  /** Display name (English). */
  name: string;
  /** Display name (繁體中文). */
  nameZh: string;
  /** Template icon (emoji). */
  icon: string;
  /** Total duration in seconds. */
  durationSec: number;
  /** Template rules. */
  rules: TemplateRules;
}

// ─────────────────────────────────────────────
// Session State Machine
// ─────────────────────────────────────────────

/**
 * Session lifecycle states (10 states).
 * Flow: draft → configured → precheck → scanning → gated → active → paused → completed → reflection_pending → archived
 */
export type SessionState =
  | 'draft'
  | 'configured'
  | 'precheck'
  | 'scanning'
  | 'gated'
  | 'active'
  | 'paused'
  | 'completed'
  | 'reflection_pending'
  | 'archived';

/** Valid state transition actions. */
export type SessionAction =
  | 'configure'        // draft → configured
  | 'start_precheck'   // configured → precheck
  | 'start_scan'       // precheck → scanning
  | 'apply_gate'       // scanning → gated
  | 'enter_session'    // gated → active
  | 'pause'            // active → paused
  | 'resume'           // paused → active
  | 'complete'         // active → completed
  | 'request_reflection' // completed → reflection_pending
  | 'archive'          // reflection_pending → archived
  | 'reset';           // any → draft

// ─────────────────────────────────────────────
// Gate Types
// ─────────────────────────────────────────────

/** Gate result classification. */
export type GateResult = 'clear_pass' | 'soft_caution' | 'red_gate' | 'force_hold';

/** Gate threshold definitions. */
export const GATE_THRESHOLDS = {
  /** Clear pass: proceed with full confidence. */
  CLEAR_PASS: { minScore: 70, minConfidence: 0.70 },
  /** Red gate: elevated strain, consider reset. */
  RED_GATE: { maxScore: 39 },
  /** Force hold: 2 consecutive red gates → suggest Health Reset. */
  FORCE_HOLD_CONSECUTIVE_REDS: 2,
} as const;

/** Gate evaluation result. */
export interface GateEvaluation {
  /** Gate result. */
  result: GateResult;
  /** Edge Score at gate time. */
  scoreAtGate: number;
  /** Confidence at gate time. */
  confidenceAtGate: number;
  /** Safe wording message for the user. */
  message: string;
  /** Consecutive red gate count. */
  consecutiveRedGates: number;
}

// ─────────────────────────────────────────────
// Session Event Types
// ─────────────────────────────────────────────

/**
 * Session event type using process-neutral language.
 * These mark decision PROCESS milestones, not financial actions.
 */
export type SessionEventType =
  | 'mark'        // General checkpoint marker
  | 'add_mark'    // Additional marker
  | 'reduce'      // Scaled back
  | 'close'       // Closed out
  | 'cancel'      // Cancelled process
  | 'no_action';  // Decided not to act

/**
 * Single session event record — a candidate Turning Point
 * ("a moment where behavior shifts from reactive to intentional", SYSTEM.md section 4).
 *
 * The `type` vocabulary above stays frozen (docs/TRADINGVIEW-ALERT-SPEC.md section 9);
 * what varies per template is the human-readable `label`, not the type.
 */
export interface SessionEvent {
  /** Event unique ID. */
  id: string;
  /** Event type. */
  type: SessionEventType;
  /** Seconds elapsed since session start. */
  elapsedSec: number;
  /**
   * Edge Score at event time.
   *
   * @deprecated DO NOT write a browser-tier readiness reading here. A reading is
   * qualitative by contract — band + confidence, never a 0-100 number
   * (domain/src/contracts/readiness-reading.ts, domain/src/policies/readiness-band.ts).
   * This field predates that contract, from when Edge Score was assumed to be a real
   * measurement on every surface. Filling it from a scan would fabricate the exact
   * number two prior sessions removed from the UI. Attach `AttachedReadinessReading`
   * to the decision record instead. Kept only so existing records keep parsing.
   */
  edgeScoreAtEvent: number;
  /** Timestamp (Unix ms). */
  timestamp: number;
  /**
   * Preset id the label came from, or null when the user just marked the moment
   * without choosing one. Absent on records written before typed marks existed.
   */
  labelId?: string | null;
  /**
   * Human-readable label, snapshotted at mark time so renaming a template later
   * cannot rewrite history.
   *
   * WARNING: user-authored labels are user-facing copy and MUST be checked with
   * `findProhibitedTerms()` (../compliance/safe-copy) before being stored.
   */
  label?: string | null;
}

// ─────────────────────────────────────────────
// Outcome & Reflection Types
// ─────────────────────────────────────────────

/** Session outcome tag (process-oriented, not result-oriented). */
export type OutcomeTag =
  | 'stayed_disciplined'
  | 'broke_discipline'
  | 'no_action_taken'
  | 'reflection_only'
  | 'timed_out'
  | null;

/** Reflection record attached to a completed session. */
export interface ReflectionRecord {
  /** Reflection unique ID. */
  id: string;
  /** Parent session ID. */
  sessionId: string;
  /** Self-rated clarity 1-5. */
  clarityRating: number;
  /** Emotional state tag. */
  emotionalState: string;
  /** Context tag (user-defined). */
  contextTag: string;
  /** Free-form reflection note (stored locally only). */
  note: string;
  /** Outcome tag. */
  outcomeTag: OutcomeTag;
  /** Timestamp (Unix ms). */
  timestamp: number;
}

// ─────────────────────────────────────────────
// Violation Types
// ─────────────────────────────────────────────

/** Types of session discipline violations. */
export type ViolationType =
  | 'skipped_precheck'
  | 'early_exit'
  | 'background_exceeded'
  | 'red_gate_override'
  | 'missed_reflection'
  | 'impulsive_restart';

/** Single violation event. */
export interface ViolationEvent {
  /** Violation type. */
  type: ViolationType;
  /** When it occurred (Unix ms). */
  timestamp: number;
  /** Seconds into session. */
  elapsedSec: number;
  /** Edge Score at violation time. */
  edgeScoreAtViolation: number;
}

// ─────────────────────────────────────────────
// Complete Session Record
// ─────────────────────────────────────────────

/** Full session record (stored locally in encrypted SQLite). */
export interface SessionRecord {
  /** Session unique ID. */
  id: string;
  /** Session mode. */
  mode: SessionMode;
  /** Trader template ID (null if non-trader mode). */
  templateId: TraderTemplateId | null;
  /** Current lifecycle state. */
  state: SessionState;
  /** Edge Score at session start. */
  edgeScoreAtStart: number;
  /** Edge Score at session end (null if not completed). */
  edgeScoreAtEnd: number | null;
  /** Gate evaluation result. */
  gateResult: GateEvaluation | null;
  /** Session events (process markers). */
  events: SessionEvent[];
  /** Violations detected during session. */
  violations: ViolationEvent[];
  /** Post-session reflection (null if not yet reflected). */
  reflection: ReflectionRecord | null;
  /** Session start timestamp (Unix ms). */
  startedAt: number;
  /** Session end timestamp (Unix ms, null if active). */
  endedAt: number | null;
  /** Total session duration (seconds). */
  durationSec: number;
  /** Outcome tag. */
  outcomeTag: OutcomeTag;
  /**
   * ID of the external alert record that opened this session, when the
   * session was entered from an alert (docs/TRADINGVIEW-ALERT-SPEC.md §9).
   * The full chain alert → decision → events → outcome is reconstructed by
   * joining the alert record with this session record.
   */
  originAlertId?: string | null;
}
