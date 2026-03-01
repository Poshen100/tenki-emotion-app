import { canStart, canComplete, getCurrentSegment, isInSweetZone, isEntryLocked, isTimeout, shouldTriggerBreath } from '../src/timer';
import { TEMPLATES } from '../src/templates';

describe('FDCB Timer Logic', () => {
    const canslimTemplate = TEMPLATES['CANSLIM_GS'];
    const manciniTemplate = TEMPLATES['MANCINI_FBD'];

    describe('canStart', () => {
        it('should only start from READY state', () => {
            expect(canStart('READY')).toBe(true);
            expect(canStart('IDLE')).toBe(false);
            expect(canStart('RUNNING')).toBe(false);
        });
    });

    describe('canComplete', () => {
        it('should allow complete if RUNNING and no early complete prevention', () => {
            expect(canComplete('RUNNING', 10, canslimTemplate)).toBe(true);
        });

        it('should prevent early complete if required by template', () => {
            expect(canComplete('RUNNING', 10, manciniTemplate)).toBe(false);
            expect(canComplete('RUNNING', 180, manciniTemplate)).toBe(true);
        });

        it('should not complete if not RUNNING', () => {
            expect(canComplete('READY', 180, manciniTemplate)).toBe(false);
        });
    });

    describe('getCurrentSegment', () => {
        it('should return correct segment based on elapsedSec', () => {
            const seg1 = getCurrentSegment(canslimTemplate, 30);
            expect(seg1?.label).toBe('Observe');

            const seg2 = getCurrentSegment(canslimTemplate, 100);
            expect(seg2?.label).toBe('Sweet Zone');

            const seg3 = getCurrentSegment(canslimTemplate, 200);
            expect(seg3?.label).toBe('Extended');
        });

        it('should return last segment if elapsedSec exceeds duration', () => {
            const seg = getCurrentSegment(canslimTemplate, 400);
            expect(seg?.label).toBe('Extended');
        });
    });

    describe('isInSweetZone', () => {
        it('should correctly identify sweet zone', () => {
            expect(isInSweetZone(canslimTemplate, 30)).toBe(false);
            expect(isInSweetZone(canslimTemplate, 100)).toBe(true);
            expect(isInSweetZone(canslimTemplate, 180)).toBe(false);
        });
    });

    describe('isEntryLocked', () => {
        it('should lock entry for MANCINI_FBD for first 60s', () => {
            expect(isEntryLocked(manciniTemplate, 30)).toBe(true);
            expect(isEntryLocked(manciniTemplate, 60)).toBe(false);
        });

        it('should not lock entry for templates without lock', () => {
            expect(isEntryLocked(canslimTemplate, 0)).toBe(false);
        });
    });
});
