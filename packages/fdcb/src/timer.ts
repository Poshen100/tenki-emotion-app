import { DecisionTemplate, FdcbState, TemplateSegment } from './types';

export function canStart(state: FdcbState): boolean {
    return state === 'READY';
}

export function canComplete(state: FdcbState, elapsedSec: number, template: DecisionTemplate): boolean {
    if (state !== 'RUNNING') return false;
    if (template.rules.preventEarlyComplete && elapsedSec < template.durationSec) {
        return false;
    }
    return true;
}

export function getCurrentSegment(template: DecisionTemplate, elapsedSec: number): TemplateSegment | null {
    for (const segment of template.rules.segments) {
        if (elapsedSec >= segment.startSec && elapsedSec < segment.endSec) {
            return segment;
        }
    }
    // If at the exact end or beyond, return the last segment
    if (elapsedSec >= template.durationSec && template.rules.segments.length > 0) {
        return template.rules.segments[template.rules.segments.length - 1];
    }
    return null;
}

export function isInSweetZone(template: DecisionTemplate, elapsedSec: number): boolean {
    if (!template.rules.sweetZone) return false;
    return elapsedSec >= template.rules.sweetZone.startSec && elapsedSec < template.rules.sweetZone.endSec;
}

export function isEntryLocked(template: DecisionTemplate, elapsedSec: number): boolean {
    if (template.rules.lockEntrySec === undefined) return false;
    return elapsedSec < template.rules.lockEntrySec;
}

export function shouldTriggerBreath(template: DecisionTemplate, elapsedSec: number): boolean {
    if (template.rules.breathTriggerSec === undefined) return false;
    return elapsedSec === template.rules.breathTriggerSec;
}

export function isTimeout(template: DecisionTemplate, elapsedSec: number): boolean {
    return elapsedSec >= template.durationSec;
}
