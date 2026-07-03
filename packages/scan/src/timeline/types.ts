/**
 * @module timeline/types
 * @description Timeline event types for FDCB decision sessions.
 * Each node captures biometric state + decision event at a point in time.
 */

/** Possible event types that can occur during a session */
export type NodeEventType =
  | 'session_start'
  | 'breathing_complete'
  | 'emotion_gate_check'
  | 'lock_applied'
  | 'lock_released'
  | 'entry_attempted'
  | 'stop_loss_set'
  | 'acceptance_prompt'
  | 'rule_violation'
  | 'session_complete'
  | 'session_abort'
  | 'manual_note';

/** Autonomic nervous system state classification */
export type AutonomicState = 'parasympathetic' | 'balanced' | 'sympathetic';

/** Timer FSM states */
export type TimerState =
  | 'IDLE'
  | 'PRE_CHECK'
  | 'BREATHING'
  | 'RUNNING'
  | 'LOCKED'
  | 'COMPLETE'
  | 'TIMEOUT'
  | 'ABORT';

/** A single point-in-time event within a session timeline */
export interface TimelineNode {
  /** Unique node identifier (UUID v4) */
  id: string;
  /** Parent session identifier */
  sessionId: string;
  /** Absolute timestamp in milliseconds */
  timestampMs: number;
  /** Seconds elapsed since session start */
  relativeTimeSec: number;
  /** Edge Score at this moment (0–100) */
  emotionScore: number;
  /** Emotional valence (-1 to 1) */
  valence: number;
  /** Emotional arousal (0 to 1) */
  arousal: number;
  /** Measurement confidence (0 to 1) */
  confidence: number;
  /** Current autonomic nervous system state */
  autonomicState: AutonomicState;
  /** Heart rate in BPM (null if unavailable) */
  hr: number | null;
  /** Heart rate variability RMSSD in ms (null if unavailable) */
  hrv: number | null;
  /** Respiratory rate in BrPM (null if unavailable) */
  rr: number | null;
  /** Type of event at this node */
  eventType: NodeEventType;
  /** Event-specific payload data */
  eventPayload: Record<string, unknown>;
  /** Current timer FSM state */
  timerState: TimerState;
  /** Whether a rule violation occurred at this node */
  ruleViolation: boolean;
  /** Details of the violation (null if none) */
  violationDetail: string | null;
}

/** A complete decision session with its timeline of events */
export interface TimelineSession {
  /** Unique session identifier */
  sessionId: string;
  /** Template used for this session */
  templateId: string;
  /** Session start timestamp in milliseconds */
  startMs: number;
  /** Session end timestamp (null if still active) */
  endMs: number | null;
  /** Ordered list of timeline events */
  nodes: TimelineNode[];
  /** Session outcome (null if still active) */
  outcome: 'WIN' | 'LOSS' | 'SCRATCH' | 'ABORTED' | null;
}

/** Session analytics summary */
export interface SessionAnalytics {
  /** Average emotion score across all nodes */
  avgEmotionScore: number;
  /** Minimum emotion score recorded */
  minEmotionScore: number;
  /** Emotion score at first entry attempt (null if none) */
  emotionAtEntry: number | null;
  /** Total number of rule violations */
  violationCount: number;
  /** Timestamps of each violation */
  violationTimestamps: number[];
  /** Number of lock events */
  lockCount: number;
  /** Discipline score 0–100 (higher = fewer violations) */
  disciplineScore: number;
}
