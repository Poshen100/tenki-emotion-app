/**
 * @module face-baseline/machine/transitions
 * @description Higher-level transition helpers: where Recovery resumes to, and
 * which capture phase may be partially retried without re-capturing the rest.
 */

import type { MachineState } from './faceBaselineMachine';

/**
 * The nearest phase Recovery should resume into. Earlier captured phases are
 * preserved across a later-phase failure: an arc or stability failure resumes
 * at face detection but the store retains the captured neutral/arc fraction, so
 * the user never re-captures a phase they already cleared.
 */
export const RESUME_TARGET: Record<MachineState, MachineState> = {
  intro: 'intro',
  why_baseline: 'why_baseline',
  permission_rationale: 'permission_rationale',
  permission_prompt: 'permission_prompt',
  permission_denied: 'permission_prompt',
  environment_check: 'environment_check',
  face_detecting: 'face_detecting',
  face_locked: 'face_detecting',
  neutral_capture: 'face_detecting',
  arc_left: 'face_detecting',
  arc_right: 'face_detecting',
  stability_pass: 'face_detecting',
  processing: 'processing',
  success: 'success',
  retry_needed: 'face_detecting',
  maturity_progress: 'maturity_progress',
  exit: 'exit',
};

/** Capture phases that can be retried independently of the others. */
export type RetryablePhase = 'neutral' | 'arc' | 'stability';

/**
 * Which capture phase a failure in `state` should re-run. A stability failure
 * re-runs only stability (neutral + arc are kept); an arc failure re-runs only
 * the arc (neutral is kept); anything earlier re-runs neutral. Returns null
 * when the state has no capture phase to retry.
 */
export function partialRetryPhase(state: MachineState): RetryablePhase | null {
  if (state === 'stability_pass') return 'stability';
  if (state === 'arc_left' || state === 'arc_right') return 'arc';
  if (state === 'neutral_capture' || state === 'face_locked' || state === 'face_detecting') {
    return 'neutral';
  }
  return null;
}
