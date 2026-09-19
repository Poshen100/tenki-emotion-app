/**
 * @module features/devices/machine
 * @description Typed, dependency-free connection machine for one provider.
 * Same shape as the Face Baseline machine: a plain transition table, so the
 * whole flow is unit-testable before any native module exists.
 *
 * The flow it encodes:
 *   disconnected → requesting → connected | denied | error
 * with `unavailable` as an absorbing entry state that only a changed
 * environment (OS, hub installed, adapter shipped) can leave.
 *
 * Two rules worth stating, because they are what make this honest:
 *   - A PARTIAL grant is a connection, not a failure. A user who gives only
 *     heart rate is connected for heart rate; the screen says which scopes.
 *   - DENIED is not an error state and not a dead end: the camera scan keeps
 *     working, and RETRY is always available.
 *
 * @see apps/mobile/features/devices/types/devices.types.ts
 */

import type { DeviceConnectionState } from '../types/devices.types';

/** Events that drive one provider's connection. */
export type DeviceLinkEvent =
  /** The environment says this provider cannot be connected. */
  | 'BLOCK'
  /** The environment changed and the provider became connectable. */
  | 'UNBLOCK'
  /** User tapped connect; the OS permission sheet is going up. */
  | 'REQUEST'
  /** Every requested scope was granted. */
  | 'GRANTED'
  /** Some scopes were granted — still a connection. */
  | 'PARTIAL'
  /** The user declined. */
  | 'DENIED'
  /** The request or a sync failed for a technical reason. */
  | 'FAILED'
  /** Try the permission request again after a denial or an error. */
  | 'RETRY'
  /** User disconnected the provider. */
  | 'DISCONNECT';

type TransitionMap = Partial<Record<DeviceLinkEvent, DeviceConnectionState>>;

/**
 * Full transition table. Absent (state, event) pairs are no-ops — `transition`
 * reports that by returning the state unchanged.
 *
 * BLOCK is accepted from every state: an adapter can disappear under us (the
 * user uninstalls Health Connect), and that must not strand a "connected" row.
 */
export const DEVICE_LINK_TRANSITIONS: Record<DeviceConnectionState, TransitionMap> = {
  unavailable: { UNBLOCK: 'disconnected' },
  disconnected: { REQUEST: 'requesting', BLOCK: 'unavailable' },
  requesting: {
    GRANTED: 'connected',
    PARTIAL: 'connected',
    DENIED: 'denied',
    FAILED: 'error',
    BLOCK: 'unavailable',
  },
  denied: { RETRY: 'requesting', BLOCK: 'unavailable' },
  connected: { DISCONNECT: 'disconnected', FAILED: 'error', BLOCK: 'unavailable' },
  error: { RETRY: 'requesting', DISCONNECT: 'disconnected', BLOCK: 'unavailable' },
};

/**
 * Applies one event to a connection state.
 *
 * @param state - Current connection state.
 * @param event - Event to apply.
 * @returns The next state, or the same state when the event does not apply.
 */
export function transition(
  state: DeviceConnectionState,
  event: DeviceLinkEvent,
): DeviceConnectionState {
  return DEVICE_LINK_TRANSITIONS[state][event] ?? state;
}

/** Whether an event would change the state — useful for guarding UI actions. */
export function canHandle(state: DeviceConnectionState, event: DeviceLinkEvent): boolean {
  return DEVICE_LINK_TRANSITIONS[state][event] !== undefined;
}

/**
 * The single action a row offers in each state, or null when the row is not
 * actionable. Keeps the screen from inventing its own state-to-button rules.
 */
export function primaryAction(state: DeviceConnectionState): DeviceLinkEvent | null {
  switch (state) {
    case 'disconnected':
      return 'REQUEST';
    case 'denied':
    case 'error':
      return 'RETRY';
    case 'connected':
      return 'DISCONNECT';
    default:
      return null;
  }
}

/**
 * Whether TENKI may read data from this provider right now. Only a connection
 * counts: a pending request is not consent, and a denial is not a soft yes.
 */
export function isReadable(state: DeviceConnectionState): boolean {
  return state === 'connected';
}
