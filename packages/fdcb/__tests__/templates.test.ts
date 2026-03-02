import { TEMPLATES, getTemplate, getTradingTemplates, getLifestyleTemplates } from '../src/templates';
import { TemplateId } from '../src/types';

describe('FDCB Templates', () => {
    it('should have exactly 6 predefined templates', () => {
        expect(Object.keys(TEMPLATES)).toHaveLength(6);
    });

    it('should have correct template IDs', () => {
        const ids: TemplateId[] = [
            'CANSLIM_GS', 'CANSLIM_HIGH_RS', 'MANCINI_FBD',
            'WORK_FOCUS', 'HEALTH_STRESS', 'EXERCISE',
        ];
        for (const id of ids) {
            expect(TEMPLATES[id]).toBeDefined();
            expect(TEMPLATES[id].id).toBe(id);
        }
    });

    describe('CANSLIM_GS', () => {
        const t = TEMPLATES['CANSLIM_GS'];
        it('should be 5min trading template', () => {
            expect(t.durationSec).toBe(300);
            expect(t.category).toBe('trading');
        });
        it('should have 3 segments: Observe/Sweet Zone/Extended', () => {
            expect(t.rules.segments).toHaveLength(3);
            expect(t.rules.segments[0].label).toBe('Observe');
            expect(t.rules.segments[1].label).toBe('Sweet Zone');
            expect(t.rules.segments[2].label).toBe('Extended');
        });
        it('should have sweetZone 60-180s', () => {
            expect(t.rules.sweetZone).toEqual({ startSec: 60, endSec: 180 });
        });
        it('should NOT prevent early complete', () => {
            expect(t.rules.preventEarlyComplete).toBe(false);
        });
    });

    describe('CANSLIM_HIGH_RS', () => {
        const t = TEMPLATES['CANSLIM_HIGH_RS'];
        it('should be 4min trading template', () => {
            expect(t.durationSec).toBe(240);
            expect(t.category).toBe('trading');
        });
        it('should have 3 segments: Quick Read/Sweet Zone/Patience', () => {
            expect(t.rules.segments).toHaveLength(3);
            expect(t.rules.segments[0].label).toBe('Quick Read');
            expect(t.rules.segments[1].label).toBe('Sweet Zone');
            expect(t.rules.segments[2].label).toBe('Patience');
        });
        it('should have sweetZone 45-150s', () => {
            expect(t.rules.sweetZone).toEqual({ startSec: 45, endSec: 150 });
        });
        it('should NOT prevent early complete', () => {
            expect(t.rules.preventEarlyComplete).toBe(false);
        });
    });

    describe('MANCINI_FBD', () => {
        const t = TEMPLATES['MANCINI_FBD'];
        it('should be 3min trading template', () => {
            expect(t.durationSec).toBe(180);
            expect(t.category).toBe('trading');
        });
        it('should have lockEntrySec=60', () => {
            expect(t.rules.lockEntrySec).toBe(60);
        });
        it('should have preventEarlyComplete=true', () => {
            expect(t.rules.preventEarlyComplete).toBe(true);
        });
        it('should have timeoutAction=log_patience', () => {
            expect(t.rules.timeoutAction).toBe('log_patience');
        });
        it('should have barColor=#5E3A87', () => {
            expect(t.rules.barColor).toBe('#5E3A87');
        });
    });

    describe('WORK_FOCUS', () => {
        const t = TEMPLATES['WORK_FOCUS'];
        it('should be 25min lifestyle template', () => {
            expect(t.durationSec).toBe(1500);
            expect(t.category).toBe('lifestyle');
        });
        it('should have single Focus segment', () => {
            expect(t.rules.segments).toHaveLength(1);
            expect(t.rules.segments[0].label).toBe('Focus');
        });
        it('should NOT have sweetZone', () => {
            expect(t.rules.sweetZone).toBeUndefined();
        });
    });

    describe('HEALTH_STRESS', () => {
        const t = TEMPLATES['HEALTH_STRESS'];
        it('should be 3min lifestyle template', () => {
            expect(t.durationSec).toBe(180);
            expect(t.category).toBe('lifestyle');
        });
        it('should have breathTriggerSec=0', () => {
            expect(t.rules.breathTriggerSec).toBe(0);
        });
        it('should have barColor=#34C759', () => {
            expect(t.rules.barColor).toBe('#34C759');
        });
    });

    describe('EXERCISE', () => {
        const t = TEMPLATES['EXERCISE'];
        it('should be 10min lifestyle template', () => {
            expect(t.durationSec).toBe(600);
            expect(t.category).toBe('lifestyle');
        });
        it('should have 3 segments: Warm Up/Active/Cool Down', () => {
            expect(t.rules.segments).toHaveLength(3);
            expect(t.rules.segments[0].label).toBe('Warm Up');
            expect(t.rules.segments[1].label).toBe('Active');
            expect(t.rules.segments[2].label).toBe('Cool Down');
        });
        it('should have barColor=#FF6B35', () => {
            expect(t.rules.barColor).toBe('#FF6B35');
        });
    });

    describe('getTemplate', () => {
        it('should return template by ID', () => {
            expect(getTemplate('CANSLIM_GS')).toBe(TEMPLATES['CANSLIM_GS']);
        });
    });

    describe('getTradingTemplates', () => {
        it('should return 3 trading templates', () => {
            const trading = getTradingTemplates();
            expect(trading).toHaveLength(3);
            trading.forEach(t => expect(t.category).toBe('trading'));
        });
    });

    describe('getLifestyleTemplates', () => {
        it('should return 3 lifestyle templates', () => {
            const lifestyle = getLifestyleTemplates();
            expect(lifestyle).toHaveLength(3);
            lifestyle.forEach(t => expect(t.category).toBe('lifestyle'));
        });
    });

    describe('Segment coverage validation', () => {
        it('all templates should have segments covering full duration', () => {
            for (const id of Object.keys(TEMPLATES) as TemplateId[]) {
                const t = TEMPLATES[id];
                const firstSeg = t.rules.segments[0];
                const lastSeg = t.rules.segments[t.rules.segments.length - 1];
                expect(firstSeg.startSec).toBe(0);
                expect(lastSeg.endSec).toBe(t.durationSec);
            }
        });

        it('all template segments should be contiguous (no gaps)', () => {
            for (const id of Object.keys(TEMPLATES) as TemplateId[]) {
                const t = TEMPLATES[id];
                for (let i = 1; i < t.rules.segments.length; i++) {
                    expect(t.rules.segments[i].startSec).toBe(t.rules.segments[i - 1].endSec);
                }
            }
        });
    });
});
