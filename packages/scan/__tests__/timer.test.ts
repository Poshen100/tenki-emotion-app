import {
    canStart, canComplete, getCurrentSegment, isInSweetZone,
    isEntryLocked, isTimeout, shouldTriggerBreath, nextState,
} from '../src/timer';
import { TEMPLATES } from '../src/templates';
import { FdcbState } from '../src/types';

describe('FDCB Timer Logic', () => {
    const canslimTemplate = TEMPLATES['CANSLIM_GS'];
    const manciniTemplate = TEMPLATES['MANCINI_FBD'];
    const healthTemplate = TEMPLATES['HEALTH_STRESS'];
    const workTemplate = TEMPLATES['WORK_FOCUS'];
    const exerciseTemplate = TEMPLATES['EXERCISE'];

    describe('canStart', () => {
        it('should only start from READY state', () => {
            expect(canStart('READY')).toBe(true);
            expect(canStart('IDLE')).toBe(false);
            expect(canStart('RUNNING')).toBe(false);
            expect(canStart('COMPLETE')).toBe(false);
        });
    });

    describe('canComplete', () => {
        it('should allow complete if RUNNING and no early complete prevention', () => {
            expect(canComplete('RUNNING', 10, canslimTemplate)).toBe(true);
        });

        it('should prevent early complete for MANCINI_FBD before duration', () => {
            expect(canComplete('RUNNING', 10, manciniTemplate)).toBe(false);
            expect(canComplete('RUNNING', 179, manciniTemplate)).toBe(false);
            expect(canComplete('RUNNING', 180, manciniTemplate)).toBe(true);
        });

        it('should not complete from non-RUNNING states', () => {
            expect(canComplete('IDLE', 180, manciniTemplate)).toBe(false);
            expect(canComplete('READY', 180, manciniTemplate)).toBe(false);
            expect(canComplete('COMPLETE', 180, manciniTemplate)).toBe(false);
        });

        it('should allow early complete for templates without prevention', () => {
            expect(canComplete('RUNNING', 1, canslimTemplate)).toBe(true);
            expect(canComplete('RUNNING', 0, workTemplate)).toBe(true);
        });
    });

    describe('getCurrentSegment', () => {
        it('should return correct segment for CANSLIM_GS', () => {
            expect(getCurrentSegment(canslimTemplate, 0)?.label).toBe('Observe');
            expect(getCurrentSegment(canslimTemplate, 30)?.label).toBe('Observe');
            expect(getCurrentSegment(canslimTemplate, 59)?.label).toBe('Observe');
            expect(getCurrentSegment(canslimTemplate, 60)?.label).toBe('Sweet Zone');
            expect(getCurrentSegment(canslimTemplate, 100)?.label).toBe('Sweet Zone');
            expect(getCurrentSegment(canslimTemplate, 179)?.label).toBe('Sweet Zone');
            expect(getCurrentSegment(canslimTemplate, 180)?.label).toBe('Extended');
            expect(getCurrentSegment(canslimTemplate, 200)?.label).toBe('Extended');
            expect(getCurrentSegment(canslimTemplate, 299)?.label).toBe('Extended');
        });

        it('should return last segment when elapsed exceeds duration', () => {
            expect(getCurrentSegment(canslimTemplate, 300)?.label).toBe('Extended');
            expect(getCurrentSegment(canslimTemplate, 400)?.label).toBe('Extended');
        });

        it('should return correct segments for EXERCISE', () => {
            expect(getCurrentSegment(exerciseTemplate, 0)?.label).toBe('Warm Up');
            expect(getCurrentSegment(exerciseTemplate, 119)?.label).toBe('Warm Up');
            expect(getCurrentSegment(exerciseTemplate, 120)?.label).toBe('Active');
            expect(getCurrentSegment(exerciseTemplate, 479)?.label).toBe('Active');
            expect(getCurrentSegment(exerciseTemplate, 480)?.label).toBe('Cool Down');
            expect(getCurrentSegment(exerciseTemplate, 599)?.label).toBe('Cool Down');
        });

        it('should return single segment for WORK_FOCUS at any point', () => {
            expect(getCurrentSegment(workTemplate, 0)?.label).toBe('Focus');
            expect(getCurrentSegment(workTemplate, 750)?.label).toBe('Focus');
            expect(getCurrentSegment(workTemplate, 1499)?.label).toBe('Focus');
        });
    });

    describe('isInSweetZone', () => {
        it('should correctly identify sweet zone for CANSLIM_GS (60-180)', () => {
            expect(isInSweetZone(canslimTemplate, 0)).toBe(false);
            expect(isInSweetZone(canslimTemplate, 59)).toBe(false);
            expect(isInSweetZone(canslimTemplate, 60)).toBe(true);
            expect(isInSweetZone(canslimTemplate, 100)).toBe(true);
            expect(isInSweetZone(canslimTemplate, 179)).toBe(true);
            expect(isInSweetZone(canslimTemplate, 180)).toBe(false);
        });

        it('should return false for templates without sweetZone', () => {
            expect(isInSweetZone(workTemplate, 0)).toBe(false);
            expect(isInSweetZone(workTemplate, 750)).toBe(false);
        });
    });

    describe('isEntryLocked', () => {
        it('should lock entry for MANCINI_FBD for first 60s', () => {
            expect(isEntryLocked(manciniTemplate, 0)).toBe(true);
            expect(isEntryLocked(manciniTemplate, 30)).toBe(true);
            expect(isEntryLocked(manciniTemplate, 59)).toBe(true);
            expect(isEntryLocked(manciniTemplate, 60)).toBe(false);
            expect(isEntryLocked(manciniTemplate, 120)).toBe(false);
        });

        it('should not lock entry for templates without lockEntrySec', () => {
            expect(isEntryLocked(canslimTemplate, 0)).toBe(false);
            expect(isEntryLocked(workTemplate, 0)).toBe(false);
            expect(isEntryLocked(healthTemplate, 0)).toBe(false);
        });
    });

    describe('shouldTriggerBreath', () => {
        it('should trigger for HEALTH_STRESS at breathTriggerSec=0', () => {
            expect(shouldTriggerBreath(healthTemplate, 0)).toBe(true);
            expect(shouldTriggerBreath(healthTemplate, 1)).toBe(false);
        });

        it('should not trigger for templates without breathTriggerSec', () => {
            expect(shouldTriggerBreath(canslimTemplate, 0)).toBe(false);
            expect(shouldTriggerBreath(manciniTemplate, 0)).toBe(false);
        });
    });

    describe('isTimeout', () => {
        it('should detect timeout when elapsed >= duration', () => {
            expect(isTimeout(canslimTemplate, 299)).toBe(false);
            expect(isTimeout(canslimTemplate, 300)).toBe(true);
            expect(isTimeout(canslimTemplate, 301)).toBe(true);
        });

        it('should detect timeout for MANCINI_FBD at 180s', () => {
            expect(isTimeout(manciniTemplate, 179)).toBe(false);
            expect(isTimeout(manciniTemplate, 180)).toBe(true);
        });

        it('should detect timeout for WORK_FOCUS at 1500s', () => {
            expect(isTimeout(workTemplate, 1499)).toBe(false);
            expect(isTimeout(workTemplate, 1500)).toBe(true);
        });
    });

    describe('nextState', () => {
        it('should transition IDLE → READY on SELECT_TEMPLATE', () => {
            expect(nextState('IDLE', 'SELECT_TEMPLATE')).toBe('READY');
        });

        it('should transition READY → RUNNING on START_TIMER', () => {
            expect(nextState('READY', 'START_TIMER')).toBe('RUNNING');
        });

        it('should transition RUNNING → COMPLETE on COMPLETE', () => {
            expect(nextState('RUNNING', 'COMPLETE')).toBe('COMPLETE');
        });

        it('should transition RUNNING → COMPLETE on TIMEOUT', () => {
            expect(nextState('RUNNING', 'TIMEOUT')).toBe('COMPLETE');
        });

        it('should transition any state → IDLE on RESET', () => {
            const states: FdcbState[] = ['IDLE', 'READY', 'RUNNING', 'COMPLETE'];
            for (const s of states) {
                expect(nextState(s, 'RESET')).toBe('IDLE');
            }
        });

        it('should stay in current state on invalid transitions', () => {
            expect(nextState('IDLE', 'START_TIMER')).toBe('IDLE');
            expect(nextState('IDLE', 'COMPLETE')).toBe('IDLE');
            expect(nextState('READY', 'SELECT_TEMPLATE')).toBe('READY');
            expect(nextState('READY', 'COMPLETE')).toBe('READY');
            expect(nextState('RUNNING', 'SELECT_TEMPLATE')).toBe('RUNNING');
            expect(nextState('COMPLETE', 'START_TIMER')).toBe('COMPLETE');
        });

        it('should support full state machine path: IDLE → READY → RUNNING → COMPLETE → IDLE', () => {
            let state: FdcbState = 'IDLE';
            state = nextState(state, 'SELECT_TEMPLATE');
            expect(state).toBe('READY');
            state = nextState(state, 'START_TIMER');
            expect(state).toBe('RUNNING');
            state = nextState(state, 'COMPLETE');
            expect(state).toBe('COMPLETE');
            state = nextState(state, 'RESET');
            expect(state).toBe('IDLE');
        });
    });
});
