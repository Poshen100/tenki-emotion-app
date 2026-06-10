/**
 * @module face-baseline/machine/transitions
 * @description Higher-level transition helpers: where Recovery resumes to, and
 * which capture phase may be partially retried without re-capturing the rest.
 */

import type { MachineState } from './faceBaselineMachine';

/**
 * The nearest phase Recovery should resume into. Neutral capture is preserved
 * across a motion-phase failure, so a motion failure resumes at face detection
 * but the store retains the captured neutral fraction.
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
  motion_capture: 'face_detecting',
  processing: 'processing',
  success: 'success',
  retry_needed: 'face_detecting',
  maturity_progress: 'maturity_progress',
  exit: 'exit',
};

/** Capture phases that can be retried independently of the other. */
export type RetryablePhase = 'neutral' | 'motion';

/**
 * Which capture phase a failure in `state` should re-run. A motion-capture
 * failure re-runs only motion (neutral is kept); anything earlier re-runs
 * neutral. Returns null when the state has no capture phase to retry.
 */
export function partialRetryPhase(state: MachineState): RetryablePhase | null {
  if (state === 'motion_capture') return 'motion';
  if (state === 'neutral_capture' || state === 'face_locked' || state === 'face_detecting') {
    return 'neutral';
  }
  return null;
}
