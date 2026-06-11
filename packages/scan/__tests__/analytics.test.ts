import { getTeiBucket, aggregateSessions, } from '../src/analytics';
import type { DecisionSession, DecisionEvent } from '../src/types';

/**
 * Helper to create a mock completed session.
 */
function mockSession(
    overrides: Partial<DecisionSession> & { teiAtStart: number; templateId: DecisionSession['templateId'] }
): DecisionSession {
    return {
        id: Math.random().toString(36).substring(2),
        events: [],
        teiAtEnd: 70,
        startedAt: Date.now(),
        endedAt: Date.now(),
        durationSec: 300,
        result: null,
        completed: true,
        ...overrides,
    };
}

function mockEvent(type: DecisionEvent['type'], elapsedSec: number, teiAtEvent: number): DecisionEvent {
    return {
        id: Math.random().toString(36).substring(2),
        type,
        elapsedSec,
        teiAtEvent,
        timestamp: Date.now(),
    };
}

describe('FDCB Analytics', () => {
    describe('getTeiBucket', () => {
        it('should classify Peak Zone TEI correctly', () => {
            expect(getTeiBucket(99)).toBe('95-99');
            expect(getTeiBucket(95)).toBe('95-99');
            expect(getTeiBucket(94)).toBe('90-95');
            expect(getTeiBucket(90)).toBe('90-95');
            expect(getTeiBucket(89)).toBe('85-90');
            expect(getTeiBucket(85)).toBe('85-90');
            expect(getTeiBucket(84)).toBe('80-85');
            expect(getTeiBucket(80)).toBe('80-85');
        });

        it('should classify Optimal Zone TEI correctly', () => {
            expect(getTeiBucket(79)).toBe('75-80');
            expect(getTeiBucket(75)).toBe('75-80');
            expect(getTeiBucket(74)).toBe('70-75');
            expect(getTeiBucket(70)).toBe('70-75');
            expect(getTeiBucket(65)).toBe('65-70');
            expect(getTeiBucket(60)).toBe('60-65');
            expect(getTeiBucket(55)).toBe('55-60');
        });

        it('should classify Neutral Zone TEI correctly', () => {
            expect(getTeiBucket(54)).toBe('35-54');
            expect(getTeiBucket(35)).toBe('35-54');
        });

        it('should classify Degraded Zone TEI correctly', () => {
            expect(getTeiBucket(34)).toBe('01-34');
            expect(getTeiBucket(1)).toBe('01-34');
        });

        it('should handle edge case: TEI = 0', () => {
            expect(getTeiBucket(0)).toBe('01-34');
        });
    });

    describe('aggregateSessions', () => {
        it('should return empty for no sessions', () => {
            const result = aggregateSessions([]);
            expect(Object.keys(result)).toHaveLength(0);
        });

        it('should skip non-completed sessions', () => {
            const sessions: DecisionSession[] = [
                mockSession({ teiAtStart: 75, templateId: 'CANSLIM_GS', completed: false }),
            ];
            const result = aggregateSessions(sessions);
            expect(Object.keys(result)).toHaveLength(0);
        });

        it('should aggregate single session correctly', () => {
            const sessions: DecisionSession[] = [
                mockSession({
                    teiAtStart: 75,
                    templateId: 'CANSLIM_GS',
                    result: 'WIN',
                    events: [mockEvent('ENTRY', 90, 78)],
                }),
            ];
            const result = aggregateSessions(sessions);
            const key = '75-80::CANSLIM_GS';
            expect(result[key]).toBeDefined();
            expect(result[key].teiBucket).toBe('75-80');
            expect(result[key].templateId).toBe('CANSLIM_GS');
            expect(result[key].avgEntrySec).toBe(90);
            expect(result[key].avgEventsPerSession).toBe(1);
            expect(result[key].winRate).toBe(1);
            expect(result[key].sampleCount).toBe(1);
        });

        it('should aggregate multiple sessions in same bucket', () => {
            const sessions: DecisionSession[] = [
                mockSession({
                    teiAtStart: 76,
                    templateId: 'CANSLIM_GS',
                    result: 'WIN',
                    events: [mockEvent('ENTRY', 80, 78)],
                }),
                mockSession({
                    teiAtStart: 77,
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
                mockSession({ teiAtStart: 75, templateId: 'CANSLIM_GS', result: 'WIN' }),
                mockSession({ teiAtStart: 60, templateId: 'CANSLIM_GS', result: 'LOSS' }),
            ];
            const result = aggregateSessions(sessions);
            expect(result['75-80::CANSLIM_GS']).toBeDefined();
            expect(result['60-65::CANSLIM_GS']).toBeDefined();
        });

        it('should separate different templates in same bucket', () => {
            const sessions: DecisionSession[] = [
                mockSession({ teiAtStart: 75, templateId: 'CANSLIM_GS' }),
                mockSession({ teiAtStart: 75, templateId: 'MANCINI_FBD' }),
            ];
            const result = aggregateSessions(sessions);
            expect(result['75-80::CANSLIM_GS']).toBeDefined();
            expect(result['75-80::MANCINI_FBD']).toBeDefined();
        });

        it('should handle sessions without ENTRY events', () => {
            const sessions: DecisionSession[] = [
                mockSession({
                    teiAtStart: 75,
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
                mockSession({ teiAtStart: 75, templateId: 'CANSLIM_GS', result: 'WIN' }),
                mockSession({ teiAtStart: 75, templateId: 'CANSLIM_GS', result: 'BREAKEVEN' }),
                mockSession({ teiAtStart: 75, templateId: 'CANSLIM_GS', result: 'NO_TRADE' }),
                mockSession({ teiAtStart: 75, templateId: 'CANSLIM_GS', result: 'LOSS' }),
            ];
            const result = aggregateSessions(sessions);
            expect(result['75-80::CANSLIM_GS'].winRate).toBe(0.25); // 1/4 wins
        });
    });
});
