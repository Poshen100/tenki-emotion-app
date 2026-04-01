import { TimelineRecorder } from '../src/timeline/recorder';
import { analyzeSession } from '../src/timeline/analytics';
import type { TimelineSession, TimelineNode } from '../src/timeline/types';
import type { NodeInput } from '../src/timeline/recorder';

/** Helper: creates a minimal valid node input */
function makeNodeInput(overrides: Partial<NodeInput> = {}): NodeInput {
  return {
    emotionScore: 72,
    valence: 0.3,
    arousal: 0.5,
    confidence: 0.8,
    autonomicState: 'balanced',
    hr: 68,
    hrv: 45,
    rr: 14,
    eventType: 'session_start',
    eventPayload: {},
    timerState: 'RUNNING',
    ruleViolation: false,
    violationDetail: null,
    ...overrides,
  };
}

describe('TimelineRecorder', () => {
  let recorder: TimelineRecorder;

  beforeEach(() => {
    recorder = new TimelineRecorder();
  });

  it('startSession returns a unique session ID', () => {
    const id1 = recorder.startSession('fbd');
    const id2 = recorder.startSession('canslim');
    expect(id1).toBeTruthy();
    expect(id2).toBeTruthy();
    expect(id1).not.toBe(id2);
  });

  it('getSession returns the session after start', () => {
    const id = recorder.startSession('fbd');
    const session = recorder.getSession(id);
    expect(session).not.toBeNull();
    expect(session!.templateId).toBe('fbd');
    expect(session!.endMs).toBeNull();
    expect(session!.outcome).toBeNull();
  });

  it('getSession returns null for unknown ID', () => {
    expect(recorder.getSession('nonexistent')).toBeNull();
  });

  it('addNode adds a node with auto-generated fields', () => {
    const id = recorder.startSession('fbd');
    const node = recorder.addNode(id, makeNodeInput());
    expect(node.id).toBeTruthy();
    expect(node.sessionId).toBe(id);
    expect(node.timestampMs).toBeGreaterThan(0);
    expect(node.relativeTimeSec).toBeGreaterThanOrEqual(0);
  });

  it('addNode throws for unknown session', () => {
    expect(() => recorder.addNode('bad-id', makeNodeInput())).toThrow('Session not found');
  });

  it('addNode throws for ended session', () => {
    const id = recorder.startSession('fbd');
    recorder.endSession(id, 'WIN');
    expect(() => recorder.addNode(id, makeNodeInput())).toThrow('already ended');
  });

  it('nodes are ordered by relativeTimeSec', () => {
    const id = recorder.startSession('fbd');
    recorder.addNode(id, makeNodeInput({ eventType: 'session_start' }));
    recorder.addNode(id, makeNodeInput({ eventType: 'breathing_complete' }));
    recorder.addNode(id, makeNodeInput({ eventType: 'entry_attempted' }));

    const session = recorder.getSession(id)!;
    for (let i = 1; i < session.nodes.length; i++) {
      expect(session.nodes[i].relativeTimeSec).toBeGreaterThanOrEqual(
        session.nodes[i - 1].relativeTimeSec
      );
    }
  });

  it('endSession sets outcome and endMs', () => {
    const id = recorder.startSession('canslim');
    recorder.addNode(id, makeNodeInput());
    const session = recorder.endSession(id, 'LOSS');
    expect(session.outcome).toBe('LOSS');
    expect(session.endMs).toBeGreaterThan(0);
  });

  it('endSession throws for already ended session', () => {
    const id = recorder.startSession('fbd');
    recorder.endSession(id, 'WIN');
    expect(() => recorder.endSession(id, 'LOSS')).toThrow('already ended');
  });

  it('exportSession returns valid JSON', () => {
    const id = recorder.startSession('mode2');
    recorder.addNode(id, makeNodeInput());
    const json = recorder.exportSession(id);
    const parsed = JSON.parse(json) as TimelineSession;
    expect(parsed.sessionId).toBe(id);
    expect(parsed.nodes).toHaveLength(1);
  });
});

describe('analyzeSession', () => {
  it('returns zeros for empty session', () => {
    const session: TimelineSession = {
      sessionId: 'test',
      templateId: 'fbd',
      startMs: 1000,
      endMs: 2000,
      nodes: [],
      outcome: 'SCRATCH',
    };
    const result = analyzeSession(session);
    expect(result.avgEmotionScore).toBe(0);
    expect(result.disciplineScore).toBe(100);
    expect(result.violationCount).toBe(0);
  });

  it('calculates average emotion score', () => {
    const nodes: TimelineNode[] = [
      { ...makeNodeInput({ emotionScore: 60 }), id: '1', sessionId: 's', timestampMs: 1000, relativeTimeSec: 0 },
      { ...makeNodeInput({ emotionScore: 80 }), id: '2', sessionId: 's', timestampMs: 2000, relativeTimeSec: 1 },
    ];
    const result = analyzeSession({ sessionId: 's', templateId: 'fbd', startMs: 1000, endMs: 3000, nodes, outcome: 'WIN' });
    expect(result.avgEmotionScore).toBe(70);
    expect(result.minEmotionScore).toBe(60);
  });

  it('captures emotion at first entry attempt', () => {
    const nodes: TimelineNode[] = [
      { ...makeNodeInput({ emotionScore: 55, eventType: 'session_start' }), id: '1', sessionId: 's', timestampMs: 1000, relativeTimeSec: 0 },
      { ...makeNodeInput({ emotionScore: 72, eventType: 'entry_attempted' }), id: '2', sessionId: 's', timestampMs: 2000, relativeTimeSec: 1 },
      { ...makeNodeInput({ emotionScore: 68, eventType: 'entry_attempted' }), id: '3', sessionId: 's', timestampMs: 3000, relativeTimeSec: 2 },
    ];
    const result = analyzeSession({ sessionId: 's', templateId: 'fbd', startMs: 1000, endMs: 4000, nodes, outcome: 'WIN' });
    expect(result.emotionAtEntry).toBe(72);
  });

  it('counts violations and computes discipline score', () => {
    const nodes: TimelineNode[] = Array.from({ length: 10 }, (_, i) => ({
      ...makeNodeInput({
        emotionScore: 50,
        eventType: 'session_start',
        ruleViolation: i < 3,
        violationDetail: i < 3 ? 'test violation' : null,
      }),
      id: String(i),
      sessionId: 's',
      timestampMs: 1000 + i * 1000,
      relativeTimeSec: i,
    }));
    const result = analyzeSession({ sessionId: 's', templateId: 'fbd', startMs: 1000, endMs: 11000, nodes, outcome: 'LOSS' });
    expect(result.violationCount).toBe(3);
    expect(result.violationTimestamps).toHaveLength(3);
    expect(result.disciplineScore).toBe(70);
  });

  it('counts lock events', () => {
    const nodes: TimelineNode[] = [
      { ...makeNodeInput({ eventType: 'lock_applied' }), id: '1', sessionId: 's', timestampMs: 1000, relativeTimeSec: 0 },
      { ...makeNodeInput({ eventType: 'lock_released' }), id: '2', sessionId: 's', timestampMs: 2000, relativeTimeSec: 1 },
      { ...makeNodeInput({ eventType: 'lock_applied' }), id: '3', sessionId: 's', timestampMs: 3000, relativeTimeSec: 2 },
    ];
    const result = analyzeSession({ sessionId: 's', templateId: 'canslim', startMs: 1000, endMs: 4000, nodes, outcome: 'WIN' });
    expect(result.lockCount).toBe(2);
  });
});
