import { DecisionEvent, DecisionSession, EventType, TemplateId } from './types';

export function createSession(templateId: TemplateId, teiAtStart: number): DecisionSession {
    return {
        id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15),
        templateId,
        teiAtStart,
        teiAtEnd: null,
        events: [],
        startedAt: Date.now(),
        endedAt: null,
        durationSec: 0,
        result: null,
        completed: false,
    };
}

export function addEvent(
    session: DecisionSession,
    type: EventType,
    elapsedSec: number,
    teiAtEvent: number
): DecisionSession {
    const newEvent: DecisionEvent = {
        id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15),
        type,
        elapsedSec,
        teiAtEvent,
        timestamp: Date.now(),
    };

    return {
        ...session,
        events: [...session.events, newEvent],
    };
}

export function completeSession(
    session: DecisionSession,
    teiAtEnd: number,
    elapsedSec: number,
    result: DecisionSession['result'] = null
): DecisionSession {
    return {
        ...session,
        teiAtEnd,
        endedAt: Date.now(),
        durationSec: elapsedSec,
        result,
        completed: true,
    };
}
