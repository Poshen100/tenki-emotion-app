import {
  transition,
  canTransition,
  isFinal,
  INITIAL_STATE,
  FINAL_STATES,
  FACE_BASELINE_TRANSITIONS,
} from '../machine/faceBaselineMachine';
import { RESUME_TARGET, partialRetryPhase } from '../machine/transitions';
import type { MachineState } from '../machine/faceBaselineMachine';

describe('faceBaselineMachine — happy path', () => {
  it('walks intro → maturity_progress via the canonical events', () => {
    let s: MachineState = INITIAL_STATE;
    expect(s).toBe('intro');
    s = transition(s, 'BEGIN');
    expect(s).toBe('permission_rationale');
    s = transition(s, 'ENABLE');
    expect(s).toBe('permission_prompt');
    s = transition(s, 'GRANTED');
    expect(s).toBe('environment_check');
    s = transition(s, 'ALL_PASS');
    expect(s).toBe('face_detecting');
    s = transition(s, 'LOCKED');
    expect(s).toBe('face_locked');
    s = transition(s, 'STABLE');
    expect(s).toBe('neutral_capture');
    s = transition(s, 'NEUTRAL_DONE');
    expect(s).toBe('motion_capture');
    s = transition(s, 'MOTION_DONE');
    expect(s).toBe('processing');
    s = transition(s, 'COMPUTED');
    expect(s).toBe('success');
    s = transition(s, 'ENTER');
    expect(s).toBe('maturity_progress');
  });

  it('maturity_progress is re-entrant into the scan flow', () => {
    expect(transition('maturity_progress', 'START_SCAN')).toBe('face_detecting');
  });
});

describe('faceBaselineMachine — branches & recovery', () => {
  it('routes capture quality failures to recovery', () => {
    expect(transition('neutral_capture', 'QUALITY_FAIL')).toBe('retry_needed');
    expect(transition('motion_capture', 'QUALITY_FAIL')).toBe('retry_needed');
    expect(transition('processing', 'COMPUTE_ERROR')).toBe('retry_needed');
  });

  it('recovery resumes the nearest phase, restart returns to intro', () => {
    expect(transition('retry_needed', 'RESUME')).toBe('face_detecting');
    expect(transition('retry_needed', 'RESTART')).toBe('intro');
  });

  it('handles permission denial and re-prompt', () => {
    expect(transition('permission_prompt', 'DENIED')).toBe('permission_denied');
    expect(transition('permission_denied', 'RETRY_PERMISSION')).toBe('permission_prompt');
  });

  it('face_detecting times out into recovery; lost lock returns to detecting', () => {
    expect(transition('face_detecting', 'TIMEOUT')).toBe('retry_needed');
    expect(transition('face_locked', 'LOST')).toBe('face_detecting');
    expect(transition('neutral_capture', 'LOST')).toBe('face_detecting');
  });
});

describe('faceBaselineMachine — invariants', () => {
  it('unknown (state, event) pairs are no-ops (return same state)', () => {
    expect(transition('processing', 'BACK')).toBe('processing');
    expect(transition('intro', 'COMPUTED')).toBe('intro');
    expect(canTransition('processing', 'BACK')).toBe(false);
    expect(canTransition('intro', 'BEGIN')).toBe(true);
  });

  it('exit is the only final state and has no outgoing transitions', () => {
    expect(isFinal('exit')).toBe(true);
    expect(FINAL_STATES).toEqual(['exit']);
    expect(FACE_BASELINE_TRANSITIONS.exit).toEqual({});
  });

  it('every transition target is itself a known state', () => {
    const known = new Set(Object.keys(FACE_BASELINE_TRANSITIONS));
    for (const map of Object.values(FACE_BASELINE_TRANSITIONS)) {
      for (const target of Object.values(map)) {
        expect(known.has(target as string)).toBe(true);
      }
    }
  });
});

describe('transitions — resume targets & partial retry', () => {
  it('motion-phase failure resumes detection but keeps motion as the retry phase', () => {
    expect(RESUME_TARGET.motion_capture).toBe('face_detecting');
    expect(partialRetryPhase('motion_capture')).toBe('motion');
  });

  it('neutral/lock/detect failures retry the neutral phase', () => {
    expect(partialRetryPhase('neutral_capture')).toBe('neutral');
    expect(partialRetryPhase('face_locked')).toBe('neutral');
    expect(partialRetryPhase('face_detecting')).toBe('neutral');
  });

  it('non-capture states have no partial-retry phase', () => {
    expect(partialRetryPhase('intro')).toBeNull();
    expect(partialRetryPhase('processing')).toBeNull();
    expect(partialRetryPhase('maturity_progress')).toBeNull();
  });
});
