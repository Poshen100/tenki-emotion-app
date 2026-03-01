import { createSession, addEvent, completeSession } from '../src/events';

describe('FDCB Events', () => {
    it('should create a valid session', () => {
        const session = createSession('CANSLIM_GS', 75);
        expect(session.templateId).toBe('CANSLIM_GS');
        expect(session.teiAtStart).toBe(75);
        expect(session.events).toHaveLength(0);
        expect(session.completed).toBe(false);
        expect(session.result).toBeNull();
    });

    it('should add events correctly', () => {
        let session = createSession('CANSLIM_GS', 75);
        session = addEvent(session, 'ENTRY', 90, 78);

        expect(session.events).toHaveLength(1);
        expect(session.events[0].type).toBe('ENTRY');
        expect(session.events[0].elapsedSec).toBe(90);
        expect(session.events[0].teiAtEvent).toBe(78);

        session = addEvent(session, 'ADD', 150, 80);
        expect(session.events).toHaveLength(2);
        expect(session.events[1].type).toBe('ADD');
    });

    it('should complete session correctly', () => {
        let session = createSession('MANCINI_FBD', 60);
        session = addEvent(session, 'ENTRY', 70, 62);

        session = completeSession(session, 65, 120, 'WIN');

        expect(session.completed).toBe(true);
        expect(session.teiAtEnd).toBe(65);
        expect(session.durationSec).toBe(120);
        expect(session.result).toBe('WIN');
    });
});
