import {
    FDCB_HEIGHT, FDCB_EXPANDED_HEIGHT, FDCB_BLUR_RADIUS, FDCB_BACKGROUND,
    COMPLETE_FLASH_COLOR, COMPLETE_AUTO_RESET_MS,
    DOT_ACTIVE_COLOR, DOT_INACTIVE_COLOR, DOT_CHECKMARK_COLOR,
    TEMPLATE_IDS, TEI_BUCKET_BOUNDARIES,
    FDCB_TIMER_TYPOGRAPHY, FDCB_LABEL_TYPOGRAPHY,
} from '../src/constants';

describe('FDCB Constants', () => {
    describe('UI dimensions', () => {
        it('should define correct heights', () => {
            expect(FDCB_HEIGHT).toBe(72);
            expect(FDCB_EXPANDED_HEIGHT).toBe(200);
        });

        it('should define blur and background', () => {
            expect(FDCB_BLUR_RADIUS).toBe(20);
            expect(FDCB_BACKGROUND).toBe('rgba(28, 28, 30, 0.92)');
        });
    });

    describe('Complete state', () => {
        it('should define flash color and auto-reset timing', () => {
            expect(COMPLETE_FLASH_COLOR).toBe('#34C759');
            expect(COMPLETE_AUTO_RESET_MS).toBe(800);
        });
    });

    describe('Dot colors', () => {
        it('should define dot colors', () => {
            expect(DOT_ACTIVE_COLOR).toBe('#FFFFFF');
            expect(DOT_INACTIVE_COLOR).toBe('#48484A');
            expect(DOT_CHECKMARK_COLOR).toBe('#34C759');
        });
    });

    describe('TEMPLATE_IDS', () => {
        it('should have 6 template IDs', () => {
            expect(TEMPLATE_IDS).toHaveLength(6);
        });

        it('should contain all template IDs', () => {
            expect(TEMPLATE_IDS).toContain('CANSLIM_GS');
            expect(TEMPLATE_IDS).toContain('CANSLIM_HIGH_RS');
            expect(TEMPLATE_IDS).toContain('MANCINI_FBD');
            expect(TEMPLATE_IDS).toContain('WORK_FOCUS');
            expect(TEMPLATE_IDS).toContain('HEALTH_STRESS');
            expect(TEMPLATE_IDS).toContain('EXERCISE');
        });
    });

    describe('TEI_BUCKET_BOUNDARIES', () => {
        it('should have 11 boundaries', () => {
            expect(TEI_BUCKET_BOUNDARIES).toHaveLength(11);
        });

        it('should be sorted from highest to lowest min', () => {
            for (let i = 1; i < TEI_BUCKET_BOUNDARIES.length; i++) {
                expect(TEI_BUCKET_BOUNDARIES[i].min).toBeLessThan(TEI_BUCKET_BOUNDARIES[i - 1].min);
            }
        });

        it('first boundary should start at 95', () => {
            expect(TEI_BUCKET_BOUNDARIES[0].min).toBe(95);
        });

        it('last boundary should start at 1', () => {
            expect(TEI_BUCKET_BOUNDARIES[TEI_BUCKET_BOUNDARIES.length - 1].min).toBe(1);
        });
    });

    describe('Typography', () => {
        it('should define timer typography with tabular-nums', () => {
            expect(FDCB_TIMER_TYPOGRAPHY.fontSize).toBe(28);
            expect(FDCB_TIMER_TYPOGRAPHY.fontVariant).toContain('tabular-nums');
        });

        it('should define label typography', () => {
            expect(FDCB_LABEL_TYPOGRAPHY.fontSize).toBe(11);
        });
    });
});
