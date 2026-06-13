/**
 * @module face-baseline/machine
 * @description Typed, dependency-free state machine for the Face Baseline
 * system. A plain transition table keeps it portable and unit-testable; a
 * thin XState/hook adapter can wrap it later without changing this contract.
 *
 * Key behaviours:
 *   - Recovery resumes the NEAREST failed phase, not a full restart.
 *   - `maturity_progress` is re-entrant (the daily-scan home).
 *   - Capture progress is paused (never reset) on transient quality drops; that
 *     is enforced in the store/UI, not by a state transition.
 *
 * @version 3.0
 * @see apps/mobile/features/face-baseline/SPEC.md
 */

import type { FlowStep } from '../types/faceBaseline.types';

/** States the machine can occupy (mirrors FlowStep, the user-visible step). */
export type MachineState = FlowStep;

/** Events that drive transitions. */
export type FaceBaselineEvent =
  | 'BEGIN'
  | 'WHY'
  | 'DONE'
  | 'ENABLE'
  | 'LEARN'
  | 'GRANTED'
  | 'DENIED'
  | 'RETRY_PERMISSION'
  | 'SETTINGS'
  | 'ALL_PASS'
  | 'LOCKED'
  | 'STABLE'
  | 'LOST'
  | 'NEUTRAL_DONE'
  | 'ARC_LEFT_DONE'
  | 'ARC_RIGHT_DONE'
  | 'STABILITY_DONE'
  | 'QUALITY_FAIL'
  | 'COMPUTED'
  | 'COMPUTE_ERROR'
  | 'ENTER'
  | 'RESUME'
  | 'RESTART'
  | 'HELP'
  | 'START_SCAN'
  | 'TIMEOUT'
  | 'CANCEL'
  | 'BACK'
  | 'LEAVE'
  | 'EXIT';

type TransitionMap = Partial<Record<FaceBaselineEvent, MachineState>>;

/**
 * Full transition table. Absent (state, event) pairs are no-ops, which the
 * `transition` function reports by returning the same state.
 */
export const FACE_BASELINE_TRANSITIONS: Record<MachineState, TransitionMap> = {
  intro: { BEGIN: 'permission_rationale', WHY: 'why_baseline', EXIT: 'exit' },
  why_baseline: { DONE: 'permission_rationale', BACK: 'intro' },
  permission_rationale: { ENABLE: 'permission_prompt', LEARN: 'why_baseline', BACK: 'intro' },
  permission_prompt: { GRANTED: 'environment_check', DENIED: 'permission_denied' },
  permission_denied: { RETRY_PERMISSION: 'permission_prompt', SETTINGS: 'permission_denied', EXIT: 'exit' },
  environment_check: { ALL_PASS: 'face_detecting', CANCEL: 'exit' },
  face_detecting: { LOCKED: 'face_locked', TIMEOUT: 'retry_needed', CANCEL: 'exit' },
  face_locked: { STABLE: 'neutral_capture', LOST: 'face_detecting' },
  neutral_capture: {
    NEUTRAL_DONE: 'arc_left',
    QUALITY_FAIL: 'retry_needed',
    LOST: 'face_detecting',
    CANCEL: 'exit',
  },
  arc_left: {
    ARC_LEFT_DONE: 'arc_right',
    QUALITY_FAIL: 'retry_needed',
    LOST: 'face_detecting',
    CANCEL: 'exit',
  },
  arc_right: {
    ARC_RIGHT_DONE: 'stability_pass',
    QUALITY_FAIL: 'retry_needed',
    LOST: 'face_detecting',
    CANCEL: 'exit',
  },
  stability_pass: {
    STABILITY_DONE: 'processing',
    QUALITY_FAIL: 'retry_needed',
    LOST: 'face_detecting',
    CANCEL: 'exit',
  },
  processing: { COMPUTED: 'success', COMPUTE_ERROR: 'retry_needed' },
  success: { ENTER: 'maturity_progress' },
  retry_needed: { RESUME: 'face_detecting', RESTART: 'intro', HELP: 'retry_needed', EXIT: 'exit' },
  maturity_progress: { START_SCAN: 'face_detecting', LEAVE: 'exit' },
  exit: {},
};

/** Initial state of the flow. */
export const INITIAL_STATE: MachineState = 'intro';

/** Terminal states from which no further transition occurs. */
export const FINAL_STATES: readonly MachineState[] = ['exit'] as const;

/**
 * Computes the next state for a (state, event) pair.
 * Returns the current state unchanged when the event is not handled.
 */
export function transition(state: MachineState, event: FaceBaselineEvent): MachineState {
  return FACE_BASELINE_TRANSITIONS[state][event] ?? state;
}

/** Whether an event is handled (causes a real transition) from a state. */
export function canTransition(state: MachineState, event: FaceBaselineEvent): boolean {
  const next = FACE_BASELINE_TRANSITIONS[state][event];
  return next !== undefined && next !== state;
}

/** Whether a state is terminal. */
export function isFinal(state: MachineState): boolean {
  return FINAL_STATES.includes(state);
}
