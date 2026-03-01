import { TEMPLATES } from '../src/templates';

describe('FDCB Templates', () => {
    it('should have 6 predefined templates', () => {
        expect(Object.keys(TEMPLATES)).toHaveLength(6);
    });

    it('CANSLIM_GS template should have correct rules', () => {
        const template = TEMPLATES['CANSLIM_GS'];
        expect(template.durationSec).toBe(300);
        expect(template.rules.segments).toHaveLength(3);
        expect(template.rules.sweetZone).toEqual({ startSec: 60, endSec: 180 });
        expect(template.rules.preventEarlyComplete).toBe(false);
    });

    it('MANCINI_FBD template should enforce entry locking', () => {
        const template = TEMPLATES['MANCINI_FBD'];
        expect(template.rules.preventEarlyComplete).toBe(true);
        expect(template.rules.lockEntrySec).toBe(60);
        expect(template.rules.barColor).toBe('#5E3A87');
    });

    it('HEALTH_STRESS template should have breath triggers', () => {
        const template = TEMPLATES['HEALTH_STRESS'];
        expect(template.rules.breathTriggerSec).toBe(0);
        expect(template.category).toBe('lifestyle');
    });
});
