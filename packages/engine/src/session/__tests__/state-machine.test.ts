/**
 * @module session/state-machine.test
 * @description Unit tests for the 10-state session governance machine.
 */

import {
  nextSessionState,
  canTransition,
  getValidActions,
  isTerminalState,
  isActiveState,
  needsUserAction,
} from '../state-machine';
import { SessionState } from '../types';

// ─── Happy Path ─────────────────────────────

describe('happy path transitions', () => {
  it('should complete full lifecycle: draft → archived', () => {
    let state: SessionState = 'draft';

    state = nextSessionState(state, 'configure')!;
    expect(state).toBe('configured');

    state = nextSessionState(state, 'start_precheck')!;
    expect(state).toBe('precheck');

    state = nextSessionState(state, 'start_scan')!;
    expect(state).toBe('scanning');

    state = nextSessionState(state, 'apply_gate')!;
    expect(state).toBe('gated');

    state = nextSessionState(state, 'enter_session')!;
    expect(state).toBe('active');

    state = nextSessionState(state, 'complete')!;
    expect(state).toBe('completed');

    state = nextSessionState(state, 'request_reflection')!;
    expect(state).toBe('reflection_pending');

    state = nextSessionState(state, 'archive')!;
    expect(state).toBe('archived');
  });

  it('should support pause/resume cycle', () => {
    let state: SessionState = 'active';

    state = nextSessionState(state, 'pause')!;
    expect(state).toBe('paused');

    state = nextSessionState(state, 'resume')!;
    expect(state).toBe('active');
  });

  it('should allow completing from paused', () => {
    const state = nextSessionState('paused', 'complete');
    expect(state).toBe('completed');
  });

  it('should allow skipping reflection (completed → archived)', () => {
    const state = nextSessionState('completed', 'archive');
    expect(state).toBe('archived');
  });
});

// ─── Invalid Transitions ────────────────────

describe('invalid transitions', () => {
  it('should return null for draft → complete', () => {
    expect(nextSessionState('draft', 'complete')).toBeNull();
  });

  it('should return null for archived → configure', () => {
    expect(nextSessionState('archived', 'configure')).toBeNull();
  });

  it('should return null for scanning → complete', () => {
    expect(nextSessionState('scanning', 'complete')).toBeNull();
  });

  it('should return null for gated → pause', () => {
    expect(nextSessionState('gated', 'pause')).toBeNull();
  });
});

// ─── Reset ──────────────────────────────────

describe('reset', () => {
  const allStates: SessionState[] = [
    'draft', 'configured', 'precheck', 'scanning', 'gated',
    'active', 'paused', 'completed', 'reflection_pending', 'archived',
  ];

  it('should reset from any state to draft', () => {
    for (const state of allStates) {
      expect(nextSessionState(state, 'reset')).toBe('draft');
    }
  });
});

// ─── canTransition ──────────────────────────

describe('canTransition', () => {
  it('should return true for valid transitions', () => {
    expect(canTransition('draft', 'configure')).toBe(true);
    expect(canTransition('active', 'pause')).toBe(true);
    expect(canTransition('active', 'complete')).toBe(true);
  });

  it('should return false for invalid transitions', () => {
    expect(canTransition('draft', 'complete')).toBe(false);
    expect(canTransition('archived', 'pause')).toBe(false);
  });
});

// ─── getValidActions ────────────────────────

describe('getValidActions', () => {
  it('should include configure for draft', () => {
    expect(getValidActions('draft')).toContain('configure');
  });

  it('should include pause and complete for active', () => {
    const actions = getValidActions('active');
    expect(actions).toContain('pause');
    expect(actions).toContain('complete');
  });

  it('should always include reset', () => {
    const allStates: SessionState[] = [
      'draft', 'configured', 'precheck', 'scanning', 'gated',
      'active', 'paused', 'completed', 'reflection_pending', 'archived',
    ];
    for (const state of allStates) {
      expect(getValidActions(state)).toContain('reset');
    }
  });
});

// ─── State Queries ──────────────────────────

describe('isTerminalState', () => {
  it('archived should be terminal', () => {
    expect(isTerminalState('archived')).toBe(true);
  });

  it('active should not be terminal', () => {
    expect(isTerminalState('active')).toBe(false);
  });
});

describe('isActiveState', () => {
  it('active should be active', () => {
    expect(isActiveState('active')).toBe(true);
  });

  it('paused should be active', () => {
    expect(isActiveState('paused')).toBe(true);
  });

  it('draft should not be active', () => {
    expect(isActiveState('draft')).toBe(false);
  });
});

describe('needsUserAction', () => {
  it('reflection_pending should need user action', () => {
    expect(needsUserAction('reflection_pending')).toBe(true);
  });

  it('gated should need user action', () => {
    expect(needsUserAction('gated')).toBe(true);
  });

  it('active should not need user action', () => {
    expect(needsUserAction('active')).toBe(false);
  });
});
