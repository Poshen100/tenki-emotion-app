import { getEdgeBucket, aggregateSessions, } from '../src/analytics';
import type { DecisionSession, DecisionEvent } from '../src/types';

/**
 * Helper to create a mock completed session.
 */
function mockSession(
    overrides: Partial<DecisionSession> & { edgeScoreAtStart: number; templateId: DecisionSession['templateId'] }
): DecisionSession {
    return {
        id: Math.random().toString(36).substring(2),
        events: [],
        edgeScoreAtEnd: 70,
        startedAt: Date.now(),
        endedAt: Date.now(),
        durationSec: 300,
        result: null,
        completed: true,
        ...overrides,
    };
}

function mockEvent(type: DecisionEvent['type'], elapsedSec: number, edgeScoreAtEvent: number): DecisionEvent {
    return {
        id: Math.random().toString(36).substring(2),
        type,
        elapsedSec,
        edgeScoreAtEvent,
        timestamp: Date.now(),
    };
}

describe('FDCB Analytics', () => {
    describe('getEdgeBucket', () => {
        it('should classify top-bucket scores correctly', () => {
            expect(getEdgeBucket(99)).toBe('95-99');
            expect(getEdgeBucket(95)).toBe('95-99');
            expect(getEdgeBucket(94)).toBe('90-95');
            expect(getEdgeBucket(90)).toBe('90-95');
            expect(getEdgeBucket(89)).toBe('85-90');
            expect(getEdgeBucket(85)).toBe('85-90');
            expect(getEdgeBucket(84)).toBe('80-85');
            expect(getEdgeBucket(80)).toBe('80-85');
        });

        it('should classify upper-bucket scores correctly', () => {
            expect(getEdgeBucket(79)).toBe('75-80');
            expect(getEdgeBucket(75)).toBe('75-80');
            expect(getEdgeBucket(74)).toBe('70-75');
            expect(getEdgeBucket(70)).toBe('70-75');
            expect(getEdgeBucket(65)).toBe('65-70');
            expect(getEdgeBucket(60)).toBe('60-65');
            expect(getEdgeBucket(55)).toBe('55-60');
        });

        it('should classify mid-bucket scores correctly', () => {
            expect(getEdgeBucket(54)).toBe('35-54');
            expect(getEdgeBucket(35)).toBe('35-54');
        });

        it('should classify low-bucket scores correctly', () => {
            expect(getEdgeBucket(34)).toBe('01-34');
            expect(getEdgeBucket(1)).toBe('01-34');
        });

        it('should handle edge case: score = 0', () => {
            expect(getEdgeBucket(0)).toBe('01-34');
        });
    });

    describe('aggregateSessions', () => {
        it('should return empty for no sessions', () => {
            const result = aggregateSessions([]);
            expect(Object.keys(result)).toHaveLength(0);
        });

        it('should skip non-completed sessions', () => {
            const sessions: DecisionSession[] = [
                mockSession({ edgeScoreAtStart: 75, templateId: 'CANSLIM_GS', completed: false }),
            ];
            const result = aggregateSessions(sessions);
            expect(Object.keys(result)).toHaveLength(0);
        });

        it('should aggregate single session correctly', () => {
            const sessions: DecisionSession[] = [
                mockSession({
                    edgeScoreAtStart: 75,
                    templateId: 'CANSLIM_GS',
                    result: 'WIN',
                    events: [mockEvent('ENTRY', 90, 78)],
                }),
            ];
            const result = aggregateSessions(sessions);
            const key = '75-80::CANSLIM_GS';
            expect(result[key]).toBeDefined();
            expect(result[key].edgeBucket).toBe('75-80');
            expect(result[key].templateId).toBe('CANSLIM_GS');
            expect(result[key].avgEntrySec).toBe(90);
            expect(result[key].avgEventsPerSession).toBe(1);
            expect(result[key].winRate).toBe(1);
            expect(result[key].sampleCount).toBe(1);
        });

        it('should aggregate multiple sessions in same bucket', () => {
            const sessions: DecisionSession[] = [
                mockSession({
                    edgeScoreAtStart: 76,
                    templateId: 'CANSLIM_GS',
                    result: 'WIN',
                    events: [mockEvent('ENTRY', 80, 78)],
                }),
                mockSession({
                    edgeScoreAtStart: 77,
                    templateId: 'CANSLIM_GS',
                    result: 'LOSS',
                    events: [mockEvent('ENTRY', 100, 75), mockEvent('EXIT', 200, 70)],
                }),
            ];
            const result = aggregateSessions(sessions);
            const key = '75-80::CANSLIM_GS';
            expect(result[key].sampleCount).toBe(2);
            expect(result[key].avgEntrySec).toBe(90); // (80 + 100) / 2
            expect(result[key].avgEventsPerSession).toBe(1.5); // (1 + 2) / 2
            expect(result[key].winRate).toBe(0.5); // 1 / 2
        });

        it('should separate different buckets', () => {
            const sessions: DecisionSession[] = [
                mockSession({ edgeScoreAtStart: 75, templateId: 'CANSLIM_GS', result: 'WIN' }),
                mockSession({ edgeScoreAtStart: 60, templateId: 'CANSLIM_GS', result: 'LOSS' }),
            ];
            const result = aggregateSessions(sessions);
            expect(result['75-80::CANSLIM_GS']).toBeDefined();
            expect(result['60-65::CANSLIM_GS']).toBeDefined();
        });

        it('should separate different templates in same bucket', () => {
            const sessions: DecisionSession[] = [
                mockSession({ edgeScoreAtStart: 75, templateId: 'CANSLIM_GS' }),
                mockSession({ edgeScoreAtStart: 75, templateId: 'MANCINI_FBD' }),
            ];
            const result = aggregateSessions(sessions);
            expect(result['75-80::CANSLIM_GS']).toBeDefined();
            expect(result['75-80::MANCINI_FBD']).toBeDefined();
        });

        it('should handle sessions without ENTRY events', () => {
            const sessions: DecisionSession[] = [
                mockSession({
                    edgeScoreAtStart: 75,
                    templateId: 'CANSLIM_GS',
                    result: 'NO_TRADE',
                    events: [mockEvent('NO_TRADE', 300, 72)],
                }),
            ];
            const result = aggregateSessions(sessions);
            const key = '75-80::CANSLIM_GS';
            expect(result[key].avgEntrySec).toBe(0); // no entry events
            expect(result[key].avgEventsPerSession).toBe(1);
        });

        it('should calculate win rate correctly for BREAKEVEN and NO_TRADE', () => {
            const sessions: DecisionSession[] = [
                mockSession({ edgeScoreAtStart: 75, templateId: 'CANSLIM_GS', result: 'WIN' }),
                mockSession({ edgeScoreAtStart: 75, templateId: 'CANSLIM_GS', result: 'BREAKEVEN' }),
                mockSession({ edgeScoreAtStart: 75, templateId: 'CANSLIM_GS', result: 'NO_TRADE' }),
                mockSession({ edgeScoreAtStart: 75, templateId: 'CANSLIM_GS', result: 'LOSS' }),
            ];
            const result = aggregateSessions(sessions);
            expect(result['75-80::CANSLIM_GS'].winRate).toBe(0.25); // 1/4 wins
        });
    });
});
