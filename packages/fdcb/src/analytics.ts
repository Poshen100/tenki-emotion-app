import { DecisionSession, TemplateId } from './types';

export function getTeiBucket(tei: number): string {
    if (tei >= 95) return '95-99';
    if (tei >= 90) return '90-95';
    if (tei >= 85) return '85-90';
    if (tei >= 80) return '80-85';
    if (tei >= 75) return '75-80';
    if (tei >= 70) return '70-75';
    if (tei >= 65) return '65-70';
    if (tei >= 60) return '60-65';
    if (tei >= 55) return '55-60';
    if (tei >= 35) return '35-54'; // Neutral zone
    return '01-34'; // Degraded zone
}

export interface SessionStats {
    templateId: TemplateId;
    avgEntrySec: number;
    avgEventsPerSession: number;
    winRate: number;
    sampleCount: number;
}

export function aggregateSessions(sessions: DecisionSession[]): Record<string, SessionStats> {
    const stats: Record<string, { entrySum: number; entries: number; events: number; wins: number; count: number }> = {};

    for (const session of sessions) {
        if (!session.completed) continue;

        // Using start TEI for bucket
        const bucket = getTeiBucket(session.teiAtStart);
        const key = `${bucket}_${session.templateId}`;

        if (!stats[key]) {
            stats[key] = { entrySum: 0, entries: 0, events: 0, wins: 0, count: 0 };
        }

        stats[key].count += 1;
        stats[key].events += session.events.length;

        if (session.result === 'WIN') {
            stats[key].wins += 1;
        }

        // Find first ENTRY event
        const firstEntry = session.events.find(e => e.type === 'ENTRY');
        if (firstEntry) {
            stats[key].entrySum += firstEntry.elapsedSec;
            stats[key].entries += 1;
        }
    }

    const result: Record<string, SessionStats> = {};
    for (const key of Object.keys(stats)) {
        const s = stats[key];
        const [_, templateId] = key.split('_') as [string, TemplateId]; // simple split for MVP

        result[key] = {
            templateId,
            avgEntrySec: s.entries > 0 ? s.entrySum / s.entries : 0,
            avgEventsPerSession: s.events / s.count,
            winRate: s.wins / s.count,
            sampleCount: s.count,
        };
    }

    return result;
}
