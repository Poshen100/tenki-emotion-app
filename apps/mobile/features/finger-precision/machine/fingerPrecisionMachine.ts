/**
 * @module finger-precision/machine/fingerPrecisionMachine
 * @description Typed, dependency-free state machine for the Finger PPG Precision Flow.
 *
 * @version 1.0
 */

import type { FingerFlowStep } from '../types';

export type MachineState = FingerFlowStep;

export type FingerPrecisionEvent =
  | 'START'
  | 'EXIT'
  | 'GRANTED'
  | 'DENIED_RETRY'
  | 'ALL_PASS'
  | 'CHECKING'
  | 'CONTACT_DETECTED'
  | 'SIGNAL_ACQUIRED'
  | 'CONTACT_LOST'
  | 'ESTIMATE_READY'
  | 'QUALITY_DROP'
  | 'TARGET_REACHED'
  | 'USER_STOP'
  | 'RECOVERED'
  | 'SUSTAINED_LOSS'
  | 'COMPUTED'
  | 'COMPUTE_ERROR'
  | 'RETRY'
  | 'DONE';

type TransitionMap = Partial<Record<FingerPrecisionEvent, MachineState>>;

export const FINGER_PRECISION_TRANSITIONS: Record<MachineState, TransitionMap> = {
  intro: {
    START: 'permission_check',
    EXIT: 'exit',
  },
  permission_check: {
    GRANTED: 'readiness_check',
    DENIED_RETRY: 'permission_check',
    EXIT: 'exit',
  },
  readiness_check: {
    ALL_PASS: 'placement_guide',
    CHECKING: 'readiness_check',
    EXIT: 'exit',
  },
  placement_guide: {
    CONTACT_DETECTED: 'signal_locking',
    EXIT: 'exit',
  },
  signal_locking: {
    SIGNAL_ACQUIRED: 'quick_estimate',
    CONTACT_LOST: 'placement_guide',
    EXIT: 'exit',
  },
  quick_estimate: {
    ESTIMATE_READY: 'precision_build',
    CONTACT_LOST: 'placement_guide',
    EXIT: 'exit',
  },
  precision_build: {
    QUALITY_DROP: 'quality_recovery',
    TARGET_REACHED: 'processing',
    USER_STOP: 'processing',
    CONTACT_LOST: 'quality_recovery', // lost contact is also a quality drop
    EXIT: 'exit',
  },
  quality_recovery: {
    RECOVERED: 'precision_build',
    SUSTAINED_LOSS: 'retry_needed',
    EXIT: 'exit',
  },
  processing: {
    COMPUTED: 'scan_complete',
    COMPUTE_ERROR: 'retry_needed',
    EXIT: 'exit',
  },
  scan_complete: {
    DONE: 'exit',
    EXIT: 'exit',
  },
  retry_needed: {
    RETRY: 'placement_guide',
    EXIT: 'exit',
  },
  exit: {},
};

export const INITIAL_STATE: MachineState = 'intro';

export const FINAL_STATES: readonly MachineState[] = ['exit'] as const;

export function transition(state: MachineState, event: FingerPrecisionEvent): MachineState {
  return FINGER_PRECISION_TRANSITIONS[state][event] ?? state;
}

export function canTransition(state: MachineState, event: FingerPrecisionEvent): boolean {
  const next = FINGER_PRECISION_TRANSITIONS[state][event];
  return next !== undefined && next !== state;
}

export function isFinal(state: MachineState): boolean {
  return FINAL_STATES.includes(state);
}
