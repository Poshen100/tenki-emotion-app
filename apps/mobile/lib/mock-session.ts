import { useSessionStore } from '../stores/session-store';

const TIMEOUT_HANDLES: { current: ReturnType<typeof setTimeout>[] } = { current: [] };

/** Cancel any in-flight mock session progression. */
export function cancelMockSessionProgress(): void {
  TIMEOUT_HANDLES.current.forEach(clearTimeout);
  TIMEOUT_HANDLES.current = [];
}

/**
 * Simulates the session lifecycle from precheck → scanning → gated → active.
 *
 * Mock gate evaluation picks a plausible edgeScore. In the real flow this will
 * come from the scan pipeline; for now it lets the timer start so the wired
 * elapsed-seconds tick is visible in the UI.
 */
export function startMockPrecheck(): void {
  cancelMockSessionProgress();

  const store = useSessionStore.getState();
  store.setState('precheck');

  const schedule = (delay: number, fn: () => void) => {
    TIMEOUT_HANDLES.current.push(setTimeout(fn, delay));
  };

  schedule(800, () => useSessionStore.getState().setState('scanning'));
  schedule(2400, () => {
    const edgeScore = 60 + Math.floor(Math.random() * 30);
    const gate = edgeScore >= 70 ? 'clear_pass' : edgeScore >= 40 ? 'soft_caution' : 'red_gate';
    useSessionStore.getState().setEdgeScore(edgeScore);
    useSessionStore.getState().setGateResult(gate);
    useSessionStore.getState().setState('gated');
  });
  schedule(3600, () => useSessionStore.getState().setState('active'));
}
