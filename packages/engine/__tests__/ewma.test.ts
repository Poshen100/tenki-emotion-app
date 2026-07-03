import {
    EWMA_DEFAULT_ALPHA,
    createEwma,
    updateEwma,
    getEwmaValue,
    resetEwma,
} from '../src/legacy/ewma';

describe('EWMA Smoother', () => {
    describe('createEwma', () => {
        it('creates state with default alpha 0.05', () => {
            const state = createEwma();
            expect(state.alpha).toBe(0.05);
            expect(state.value).toBeNull();
            expect(state.sampleCount).toBe(0);
        });

        it('creates state with custom alpha', () => {
            const state = createEwma(0.15);
            expect(state.alpha).toBe(0.15);
        });
    });

    describe('updateEwma', () => {
        it('first observation jumps directly to target', () => {
            const state = createEwma();
            const updated = updateEwma(state, 72);
            expect(updated.value).toBe(72);
            expect(updated.sampleCount).toBe(1);
        });

        it('second observation applies EWMA smoothing', () => {
            let state = createEwma();
            state = updateEwma(state, 72); // first: jump to 72
            state = updateEwma(state, 80); // smoothed: 72 * 0.95 + 80 * 0.05

            const expected = 72 * (1 - EWMA_DEFAULT_ALPHA) + 80 * EWMA_DEFAULT_ALPHA;
            expect(state.value).toBeCloseTo(expected, 10);
            expect(state.sampleCount).toBe(2);
        });

        it('converges slowly with alpha 0.05', () => {
            let state = createEwma(0.05);
            state = updateEwma(state, 50);

            // Push 100 observations of 100 — should converge toward 100 slowly
            for (let i = 0; i < 100; i++) {
                state = updateEwma(state, 100);
            }

            // After 100 updates, should be close to 100 but not quite
            expect(state.value).toBeGreaterThan(95);
            expect(state.value).toBeLessThanOrEqual(100);
        });

        it('handles identical values without drift', () => {
            let state = createEwma();
            state = updateEwma(state, 60);
            for (let i = 0; i < 50; i++) {
                state = updateEwma(state, 60);
            }
            expect(state.value).toBeCloseTo(60, 10);
        });
    });

    describe('getEwmaValue', () => {
        it('returns fallback when no data observed', () => {
            const state = createEwma();
            expect(getEwmaValue(state)).toBe(0);
            expect(getEwmaValue(state, 50)).toBe(50);
        });

        it('returns current smoothed value', () => {
            let state = createEwma();
            state = updateEwma(state, 72);
            expect(getEwmaValue(state)).toBe(72);
        });
    });

    describe('resetEwma', () => {
        it('clears value but preserves alpha', () => {
            let state = createEwma(0.10);
            state = updateEwma(state, 50);
            state = updateEwma(state, 60);

            const reset = resetEwma(state);
            expect(reset.value).toBeNull();
            expect(reset.sampleCount).toBe(0);
            expect(reset.alpha).toBe(0.10);
        });
    });

    describe('EWMA_DEFAULT_ALPHA', () => {
        it('is 0.05 (medical-grade)', () => {
            expect(EWMA_DEFAULT_ALPHA).toBe(0.05);
        });
    });
});
