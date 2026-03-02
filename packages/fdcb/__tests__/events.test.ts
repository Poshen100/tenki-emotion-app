import { createSession, addEvent, completeSession } from '../src/events';
import { TEMPLATES } from '../src/templates';

describe('FDCB Events', () => {
    const canslimTemplate = TEMPLATES['CANSLIM_GS'];
    const manciniTemplate = TEMPLATES['MANCINI_FBD'];
    const healthTemplate = TEMPLATES['HEALTH_STRESS'];

    describe('createSession', () => {
        it('should create a valid session with correct fields', () => {
            const session = createSession('CANSLIM_GS', 75);
            expect(session.templateId).toBe('CANSLIM_GS');
            expect(session.teiAtStart).toBe(75);
            expect(session.events).toHaveLength(0);
            expect(session.completed).toBe(false);
            expect(session.result).toBeNull();
            expect(session.teiAtEnd).toBeNull();
            expect(session.endedAt).toBeNull();
            expect(session.durationSec).toBe(0);
            expect(session.id).toBeDefined();
            expect(typeof session.startedAt).toBe('number');
        });

        it('should generate unique IDs', () => {
            const s1 = createSession('CANSLIM_GS', 75);
            const s2 = createSession('CANSLIM_GS', 75);
            expect(s1.id).not.toBe(s2.id);
        });
    });

    describe('addEvent — normal flow', () => {
        it('should add ENTRY event correctly', () => {
            let session = createSession('CANSLIM_GS', 75);
            const result = addEvent(session, 'ENTRY', 90, 78, canslimTemplate);

            expect(result.accepted).toBe(true);
            expect(result.session.events).toHaveLength(1);
            expect(result.session.events[0].type).toBe('ENTRY');
            expect(result.session.events[0].elapsedSec).toBe(90);
            expect(result.session.events[0].teiAtEvent).toBe(78);
        });

        it('should add multiple events sequentially', () => {
            let session = createSession('CANSLIM_GS', 75);
            const r1 = addEvent(session, 'ENTRY', 90, 78, canslimTemplate);
            expect(r1.accepted).toBe(true);

            const r2 = addEvent(r1.session, 'ADD', 150, 80, canslimTemplate);
            expect(r2.accepted).toBe(true);
            expect(r2.session.events).toHaveLength(2);
            expect(r2.session.events[0].type).toBe('ENTRY');
            expect(r2.session.events[1].type).toBe('ADD');
        });

        it('should snapshot TEI at each event', () => {
            let session = createSession('CANSLIM_GS', 75);
            const r1 = addEvent(session, 'ENTRY', 60, 78, canslimTemplate);
            const r2 = addEvent(r1.session, 'EXIT', 200, 65, canslimTemplate);

            expect(r2.session.events[0].teiAtEvent).toBe(78);
            expect(r2.session.events[1].teiAtEvent).toBe(65);
        });

        it('should allow all event types for templates without lock', () => {
            let session = createSession('CANSLIM_GS', 75);

            const types: Array<'ENTRY' | 'ADD' | 'REDUCE' | 'EXIT' | 'CANCEL' | 'NO_TRADE'> = [
                'ENTRY', 'ADD', 'REDUCE', 'EXIT', 'CANCEL', 'NO_TRADE',
            ];

            for (const type of types) {
                const r = addEvent(session, type, 0, 75, canslimTemplate);
                expect(r.accepted).toBe(true);
            }
        });
    });

    describe('addEvent — Entry Lock (Mancini FBD)', () => {
        it('should REJECT ENTRY events within lockEntrySec (60s)', () => {
            const session = createSession('MANCINI_FBD', 70);

            // 0 秒 — 被拒
            const r0 = addEvent(session, 'ENTRY', 0, 70, manciniTemplate);
            expect(r0.accepted).toBe(false);
            expect(r0.session.events).toHaveLength(0);

            // 30 秒 — 被拒
            const r30 = addEvent(session, 'ENTRY', 30, 72, manciniTemplate);
            expect(r30.accepted).toBe(false);
            expect(r30.session.events).toHaveLength(0);

            // 59 秒 — 被拒
            const r59 = addEvent(session, 'ENTRY', 59, 73, manciniTemplate);
            expect(r59.accepted).toBe(false);
            expect(r59.session.events).toHaveLength(0);
        });

        it('should ALLOW ENTRY events at or after lockEntrySec (60s)', () => {
            const session = createSession('MANCINI_FBD', 70);

            // 60 秒 — 允許
            const r60 = addEvent(session, 'ENTRY', 60, 74, manciniTemplate);
            expect(r60.accepted).toBe(true);
            expect(r60.session.events).toHaveLength(1);
            expect(r60.session.events[0].type).toBe('ENTRY');

            // 120 秒 — 允許
            const r120 = addEvent(session, 'ENTRY', 120, 75, manciniTemplate);
            expect(r120.accepted).toBe(true);
        });

        it('should NOT lock non-ENTRY event types during lock period', () => {
            const session = createSession('MANCINI_FBD', 70);

            // ADD, REDUCE, EXIT etc. should always be allowed
            const r1 = addEvent(session, 'ADD', 10, 70, manciniTemplate);
            expect(r1.accepted).toBe(true);

            const r2 = addEvent(session, 'CANCEL', 30, 70, manciniTemplate);
            expect(r2.accepted).toBe(true);

            const r3 = addEvent(session, 'NO_TRADE', 50, 70, manciniTemplate);
            expect(r3.accepted).toBe(true);
        });

        it('should return original session unchanged on rejection', () => {
            const session = createSession('MANCINI_FBD', 70);
            const result = addEvent(session, 'ENTRY', 30, 72, manciniTemplate);

            expect(result.accepted).toBe(false);
            expect(result.session).toBe(session); // same reference
        });
    });

    describe('addEvent — templates without lockEntrySec', () => {
        it('CANSLIM_GS should allow ENTRY at any time', () => {
            const session = createSession('CANSLIM_GS', 75);
            const r = addEvent(session, 'ENTRY', 0, 75, canslimTemplate);
            expect(r.accepted).toBe(true);
        });

        it('HEALTH_STRESS should allow ENTRY at any time', () => {
            const session = createSession('HEALTH_STRESS', 50);
            const r = addEvent(session, 'ENTRY', 0, 50, healthTemplate);
            expect(r.accepted).toBe(true);
        });
    });

    describe('completeSession', () => {
        it('should complete session with all fields', () => {
            let session = createSession('MANCINI_FBD', 60);
            const r = addEvent(session, 'ENTRY', 70, 62, manciniTemplate);

            const completed = completeSession(r.session, 65, 180, 'WIN');

            expect(completed.completed).toBe(true);
            expect(completed.teiAtEnd).toBe(65);
            expect(completed.durationSec).toBe(180);
            expect(completed.result).toBe('WIN');
            expect(completed.endedAt).toBeDefined();
            expect(typeof completed.endedAt).toBe('number');
        });

        it('should default result to null if not provided', () => {
            const session = createSession('CANSLIM_GS', 75);
            const completed = completeSession(session, 70, 200);
            expect(completed.result).toBeNull();
            expect(completed.completed).toBe(true);
        });

        it('should accept NO_TRADE as result', () => {
            const session = createSession('CANSLIM_GS', 75);
            const completed = completeSession(session, 70, 300, 'NO_TRADE');
            expect(completed.result).toBe('NO_TRADE');
        });

        it('should accept all result types', () => {
            const results: Array<'WIN' | 'LOSS' | 'BREAKEVEN' | 'NO_TRADE'> = [
                'WIN', 'LOSS', 'BREAKEVEN', 'NO_TRADE',
            ];
            for (const r of results) {
                const session = createSession('CANSLIM_GS', 75);
                const completed = completeSession(session, 70, 300, r);
                expect(completed.result).toBe(r);
            }
        });

        it('should preserve existing events on completion', () => {
            let session = createSession('CANSLIM_GS', 75);
            const r1 = addEvent(session, 'ENTRY', 90, 78, canslimTemplate);
            const r2 = addEvent(r1.session, 'ADD', 150, 80, canslimTemplate);
            const completed = completeSession(r2.session, 70, 300, 'WIN');

            expect(completed.events).toHaveLength(2);
            expect(completed.events[0].type).toBe('ENTRY');
            expect(completed.events[1].type).toBe('ADD');
        });
    });
});
