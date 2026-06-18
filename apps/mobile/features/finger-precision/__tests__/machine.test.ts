import {
  transition,
  canTransition,
  isFinal,
  INITIAL_STATE,
  FINAL_STATES,
  FINGER_PRECISION_TRANSITIONS,
} from '../machine/fingerPrecisionMachine';
import { RESUME_TARGET } from '../machine/transitions';
import type { MachineState } from '../machine/fingerPrecisionMachine';

describe('fingerPrecisionMachine — happy path', () => {
  it('walks intro → exit via the canonical events', () => {
    let s: MachineState = INITIAL_STATE;
    expect(s).toBe('intro');
    
    s = transition(s, 'START');
    expect(s).toBe('permission_check');
    
    s = transition(s, 'GRANTED');
    expect(s).toBe('readiness_check');
    
    s = transition(s, 'ALL_PASS');
    expect(s).toBe('placement_guide');
    
    s = transition(s, 'CONTACT_DETECTED');
    expect(s).toBe('signal_locking');
    
    s = transition(s, 'SIGNAL_ACQUIRED');
    expect(s).toBe('quick_estimate');
    
    s = transition(s, 'ESTIMATE_READY');
    expect(s).toBe('precision_build');
    
    s = transition(s, 'TARGET_REACHED');
    expect(s).toBe('processing');
    
    s = transition(s, 'COMPUTED');
    expect(s).toBe('scan_complete');
    
    s = transition(s, 'DONE');
    expect(s).toBe('exit');
  });
});

describe('fingerPrecisionMachine — branches & recovery', () => {
  it('routes quality failures to recovery and retry', () => {
    expect(transition('precision_build', 'QUALITY_DROP')).toBe('quality_recovery');
    expect(transition('quality_recovery', 'RECOVERED')).toBe('precision_build');
    expect(transition('quality_recovery', 'SUSTAINED_LOSS')).toBe('retry_needed');
    expect(transition('retry_needed', 'RETRY')).toBe('placement_guide');
  });

  it('routes contact loss back to placement guide during locking/estimation', () => {
    expect(transition('signal_locking', 'CONTACT_LOST')).toBe('placement_guide');
    expect(transition('quick_estimate', 'CONTACT_LOST')).toBe('placement_guide');
    expect(transition('precision_build', 'CONTACT_LOST')).toBe('quality_recovery');
  });

  it('handles permission denial and exit', () => {
    expect(transition('permission_check', 'DENIED_RETRY')).toBe('permission_check');
    expect(transition('permission_check', 'EXIT')).toBe('exit');
  });
});

describe('fingerPrecisionMachine — invariants', () => {
  it('unknown (state, event) pairs are no-ops (return same state)', () => {
    expect(transition('processing', 'ESTIMATE_READY')).toBe('processing');
    expect(transition('intro', 'COMPUTED')).toBe('intro');
    expect(canTransition('processing', 'ESTIMATE_READY')).toBe(false);
    expect(canTransition('intro', 'START')).toBe(true);
  });

  it('exit is the only final state and has no outgoing transitions', () => {
    expect(isFinal('exit')).toBe(true);
    expect(FINAL_STATES).toEqual(['exit']);
    expect(FINGER_PRECISION_TRANSITIONS.exit).toEqual({});
  });

  it('every transition target is itself a known state', () => {
    const known = new Set(Object.keys(FINGER_PRECISION_TRANSITIONS));
    for (const map of Object.values(FINGER_PRECISION_TRANSITIONS)) {
      for (const target of Object.values(map)) {
        expect(known.has(target as string)).toBe(true);
      }
    }
  });
});

describe('transitions — resume targets', () => {
  it('recovery/retry target is placement_guide for active phases', () => {
    expect(RESUME_TARGET.precision_build).toBe('placement_guide');
    expect(RESUME_TARGET.signal_locking).toBe('placement_guide');
    expect(RESUME_TARGET.quick_estimate).toBe('placement_guide');
  });
});
