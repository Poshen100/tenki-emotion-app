import {
  DEVICE_LINK_TRANSITIONS,
  type DeviceLinkEvent,
  canHandle,
  isReadable,
  primaryAction,
  transition,
} from '../machine/deviceLinkMachine';
import type { DeviceConnectionState } from '../types/devices.types';

const ALL_STATES = Object.keys(DEVICE_LINK_TRANSITIONS) as DeviceConnectionState[];

describe('transition', () => {
  it('walks the happy path from disconnected to connected', () => {
    const requesting = transition('disconnected', 'REQUEST');
    expect(requesting).toBe('requesting');
    expect(transition(requesting, 'GRANTED')).toBe('connected');
  });

  it('treats a partial grant as a connection, not a failure', () => {
    expect(transition('requesting', 'PARTIAL')).toBe('connected');
  });

  it('lands a denial in its own state, not in error', () => {
    expect(transition('requesting', 'DENIED')).toBe('denied');
    expect(transition('requesting', 'FAILED')).toBe('error');
  });

  it('always leaves a way back after a denial or an error', () => {
    expect(transition('denied', 'RETRY')).toBe('requesting');
    expect(transition('error', 'RETRY')).toBe('requesting');
  });

  it('lets the user disconnect a live connection', () => {
    expect(transition('connected', 'DISCONNECT')).toBe('disconnected');
  });

  it('ignores events that do not apply, rather than throwing', () => {
    expect(transition('disconnected', 'GRANTED')).toBe('disconnected');
    expect(transition('connected', 'REQUEST')).toBe('connected');
    expect(transition('unavailable', 'REQUEST')).toBe('unavailable');
  });

  it('accepts BLOCK from every state — an adapter can vanish under us', () => {
    for (const state of ALL_STATES) {
      if (state === 'unavailable') continue;
      expect(transition(state, 'BLOCK')).toBe('unavailable');
    }
  });

  it('only leaves unavailable when the environment says so', () => {
    const events: DeviceLinkEvent[] = ['REQUEST', 'GRANTED', 'PARTIAL', 'DENIED', 'RETRY'];
    for (const event of events) {
      expect(transition('unavailable', event)).toBe('unavailable');
    }
    expect(transition('unavailable', 'UNBLOCK')).toBe('disconnected');
  });

  it('never transitions into a state outside the table', () => {
    for (const state of ALL_STATES) {
      for (const next of Object.values(DEVICE_LINK_TRANSITIONS[state])) {
        expect(ALL_STATES).toContain(next);
      }
    }
  });
});

describe('canHandle', () => {
  it('reports whether an event applies', () => {
    expect(canHandle('disconnected', 'REQUEST')).toBe(true);
    expect(canHandle('disconnected', 'DISCONNECT')).toBe(false);
  });
});

describe('primaryAction', () => {
  it('gives each state its one action', () => {
    expect(primaryAction('disconnected')).toBe('REQUEST');
    expect(primaryAction('denied')).toBe('RETRY');
    expect(primaryAction('error')).toBe('RETRY');
    expect(primaryAction('connected')).toBe('DISCONNECT');
  });

  it('offers nothing while a request is in flight or the row is blocked', () => {
    expect(primaryAction('requesting')).toBeNull();
    expect(primaryAction('unavailable')).toBeNull();
  });

  it('only ever names an action the state can actually handle', () => {
    for (const state of ALL_STATES) {
      const action = primaryAction(state);
      if (action) expect(canHandle(state, action)).toBe(true);
    }
  });
});

describe('isReadable', () => {
  it('permits reading only from a live connection', () => {
    for (const state of ALL_STATES) {
      expect(isReadable(state)).toBe(state === 'connected');
    }
  });
});
