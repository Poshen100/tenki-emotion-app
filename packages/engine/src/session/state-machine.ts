/**
 * @module session/state-machine
 * @description Session Governance state machine — 10-state lifecycle manager.
 * Enforces valid transitions and prevents illegal state changes.
 *
 * @version 3.0
 * @see ANTIGRAVITY.md v3.0 Section 5
 */

import { SessionState, SessionAction } from './types';

/** Valid state transition map. */
const TRANSITION_MAP: Record<SessionState, Partial<Record<SessionAction, SessionState>>> = {
  draft: {
    configure: 'configured',
    reset: 'draft',
  },
  configured: {
    start_precheck: 'precheck',
    reset: 'draft',
  },
  precheck: {
    start_scan: 'scanning',
    reset: 'draft',
  },
  scanning: {
    apply_gate: 'gated',
    reset: 'draft',
  },
  gated: {
    enter_session: 'active',
    reset: 'draft',
  },
  active: {
    pause: 'paused',
    complete: 'completed',
    reset: 'draft',
  },
  paused: {
    resume: 'active',
    complete: 'completed',
    reset: 'draft',
  },
  completed: {
    request_reflection: 'reflection_pending',
    archive: 'archived',
    reset: 'draft',
  },
  reflection_pending: {
    archive: 'archived',
    reset: 'draft',
  },
  archived: {
    reset: 'draft',
  },
};

/**
 * Calculates the next state for a given action.
 * Returns null if the transition is not valid.
 *
 * @param currentState - The current session state.
 * @param action - The action to apply.
 * @returns The next state, or null if transition is invalid.
 */
export function nextSessionState(
  currentState: SessionState,
  action: SessionAction
): SessionState | null {
  const transitions = TRANSITION_MAP[currentState];
  return transitions[action] ?? null;
}

/**
 * Checks whether a specific action is valid from the current state.
 *
 * @param currentState - The current session state.
 * @param action - The action to check.
 * @returns True if the transition is valid.
 */
export function canTransition(currentState: SessionState, action: SessionAction): boolean {
  return nextSessionState(currentState, action) !== null;
}

/**
 * Returns all valid actions from the current state.
 *
 * @param currentState - The current session state.
 * @returns Array of valid SessionAction values.
 */
export function getValidActions(currentState: SessionState): SessionAction[] {
  const transitions = TRANSITION_MAP[currentState];
  return Object.keys(transitions) as SessionAction[];
}

/**
 * Checks if a state is terminal (no further non-reset transitions).
 *
 * @param state - The session state to check.
 * @returns True if the state is terminal.
 */
export function isTerminalState(state: SessionState): boolean {
  return state === 'archived';
}

/**
 * Checks if a state is active (session is in progress).
 *
 * @param state - The session state to check.
 * @returns True if the session is actively running.
 */
export function isActiveState(state: SessionState): boolean {
  return state === 'active' || state === 'paused';
}

/**
 * Checks if a state requires user attention (reflection, etc.).
 *
 * @param state - The session state to check.
 * @returns True if user action is needed.
 */
export function needsUserAction(state: SessionState): boolean {
  return state === 'reflection_pending' || state === 'gated';
}
