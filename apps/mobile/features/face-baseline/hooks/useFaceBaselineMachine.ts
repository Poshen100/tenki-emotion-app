/**
 * @module face-baseline/hooks/useFaceBaselineMachine
 * @description Thin bridge between the typed state machine and the Zustand
 * store. Screens dispatch semantic events; the bridge computes the next state
 * via the (already unit-tested) `transition` reducer and syncs the store.
 *
 * Keeping this delegating-only means the flow logic stays covered by the pure
 * machine tests — no React renderer is needed to trust it.
 */
import { useCallback } from 'react';
import {
  transition,
  canTransition,
  isFinal,
  type FaceBaselineEvent,
  type MachineState,
} from '../machine/faceBaselineMachine';
import { useFaceBaselineStore } from '../store/faceBaselineStore';

export interface FaceBaselineMachineApi {
  /** Current machine state (mirrors the store's `step`). */
  state: MachineState;
  /** Dispatch an event; returns the resulting state. No-op events return the same state. */
  send: (event: FaceBaselineEvent) => MachineState;
  /** Whether an event would cause a real transition from the current state. */
  canSend: (event: FaceBaselineEvent) => boolean;
  /** Whether the current state is terminal. */
  isFinal: boolean;
}

export function useFaceBaselineMachine(): FaceBaselineMachineApi {
  const state = useFaceBaselineStore((s) => s.step) as MachineState;
  const goTo = useFaceBaselineStore((s) => s.goTo);

  const send = useCallback(
    (event: FaceBaselineEvent): MachineState => {
      const current = useFaceBaselineStore.getState().step as MachineState;
      const next = transition(current, event);
      if (next !== current) goTo(next);
      return next;
    },
    [goTo],
  );

  const canSend = useCallback((event: FaceBaselineEvent): boolean => canTransition(state, event), [state]);

  return { state, send, canSend, isFinal: isFinal(state) };
}
