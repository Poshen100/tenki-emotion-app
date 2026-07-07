import { useSessionStore } from '../session-store';
import { useTimelineStore } from '../timeline-store';

const reset = (): void => {
  useSessionStore.getState().reset();
  useTimelineStore.getState().clearAll();
};

describe('session-store — lifecycle', () => {
  beforeEach(reset);

  it('starts in draft with empty session data', () => {
    const s = useSessionStore.getState();
    expect(s.mode).toBeNull();
    expect(s.state).toBe('draft');
    expect(s.gateResult).toBeNull();
    expect(s.edgeScore).toBeNull();
    expect(s.elapsedSec).toBe(0);
    expect(s.reflection).toBe('');
  });

  it('setMode advances draft → configured', () => {
    useSessionStore.getState().setMode('focus');
    const s = useSessionStore.getState();
    expect(s.mode).toBe('focus');
    expect(s.state).toBe('configured');
  });

  it('tick increments elapsedSec one second at a time', () => {
    const { tick } = useSessionStore.getState();
    tick();
    tick();
    tick();
    expect(useSessionStore.getState().elapsedSec).toBe(3);
  });

  it('setGateResult and setEdgeScore store gate outcome', () => {
    useSessionStore.getState().setGateResult('soft_caution');
    useSessionStore.getState().setEdgeScore(58);
    const s = useSessionStore.getState();
    expect(s.gateResult).toBe('soft_caution');
    expect(s.edgeScore).toBe(58);
  });

  it('completeSession archives the run into timeline-store', () => {
    const store = useSessionStore.getState();
    store.setMode('performance');
    store.setEdgeScore(82);
    store.tick();
    store.tick();
    useSessionStore.getState().completeSession();

    expect(useSessionStore.getState().state).toBe('completed');
    const sessions = useTimelineStore.getState().sessions;
    expect(sessions).toHaveLength(1);
    expect(sessions[0]).toMatchObject({
      mode: 'performance',
      edgeScore: 82,
      durationSec: 2,
    });
  });

  it('completeSession without a mode does not write to timeline', () => {
    useSessionStore.getState().completeSession();
    expect(useTimelineStore.getState().sessions).toHaveLength(0);
    expect(useSessionStore.getState().state).toBe('completed');
  });

  it('completeSession defaults missing edgeScore to 0', () => {
    useSessionStore.getState().setMode('trader');
    useSessionStore.getState().completeSession();
    expect(useTimelineStore.getState().sessions[0]?.edgeScore).toBe(0);
  });

  it('reset returns every field to draft defaults', () => {
    const store = useSessionStore.getState();
    store.setMode('health_reset');
    store.setGateResult('red_gate');
    store.setEdgeScore(31);
    store.tick();
    store.setReflection('note');
    useSessionStore.getState().reset();

    const s = useSessionStore.getState();
    expect(s).toMatchObject({
      mode: null,
      state: 'draft',
      gateResult: null,
      edgeScore: null,
      elapsedSec: 0,
      reflection: '',
    });
  });
});

describe('timeline-store', () => {
  beforeEach(reset);

  it('addSession prepends newest first', () => {
    const { addSession } = useTimelineStore.getState();
    addSession({ id: 'a', mode: 'focus', edgeScore: 70, durationSec: 60, completedAt: 1 });
    addSession({ id: 'b', mode: 'trader', edgeScore: 50, durationSec: 90, completedAt: 2 });
    const ids = useTimelineStore.getState().sessions.map((s) => s.id);
    expect(ids).toEqual(['b', 'a']);
  });
});
