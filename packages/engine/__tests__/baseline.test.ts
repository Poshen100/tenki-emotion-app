import { createEmptyBaseline, updateBaseline, isBaselineReady, getBaselineAge } from '../src/baseline';

describe('Baseline Engine Logic', () => {

    describe('createEmptyBaseline', () => {
        it('creates a 7-day baseline initialized to zero', () => {
            const b = createEmptyBaseline(7);
            expect(b.windowDays).toBe(7);
            expect(b.sampleCount).toBe(0);
            expect(b.hrMean).toBe(0);
        });

        it('creates a 21-day baseline initialized to zero', () => {
            const b = createEmptyBaseline(21);
            expect(b.windowDays).toBe(21);
        });
    });

    describe('updateBaseline', () => {
        it('approximates running mean and variance for 10 consecutive scans', () => {
            let b = createEmptyBaseline(7);
            for (let i = 0; i < 10; i++) {
                const hr = 60 + i; // 60,61,62...69 -> mean = 64.5
                b = updateBaseline(b, { hrBpm: hr, hrvRmssdMs: 50, rrBrpm: 15 });
            }
            expect(b.sampleCount).toBe(10);
            expect(b.hrMean).toBeCloseTo(64.5, 1);

            // Std should stabilize to non-zero 
            expect(b.hrStd).toBeGreaterThan(0);
            expect(b.hrvStd).toBeLessThanOrEqual(0.01); // hrv was fixed at 50, var should be ~0
        });

        it('returns a non-zero std after 2 different readings', () => {
            let b = createEmptyBaseline(7);
            b = updateBaseline(b, { hrBpm: 60, hrvRmssdMs: 40, rrBrpm: 14 });
            expect(b.hrStd).toBe(0); // Only 1 sample -> std = 0

            b = updateBaseline(b, { hrBpm: 80, hrvRmssdMs: 60, rrBrpm: 20 });
            expect(b.hrStd).toBeGreaterThan(0);
            expect(b.hrvStd).toBeGreaterThan(0);
            expect(b.rrStd).toBeGreaterThan(0);
        });
    });

    describe('isBaselineReady', () => {
        it('returns false when sampleCount < windowDays', () => {
            let b = createEmptyBaseline(7);
            b.sampleCount = 6;
            expect(isBaselineReady(b)).toBe(false);
        });

        it('returns true when sampleCount >= windowDays', () => {
            let b = createEmptyBaseline(7);
            b.sampleCount = 7;
            expect(isBaselineReady(b)).toBe(true);

            b.sampleCount = 8;
            expect(isBaselineReady(b)).toBe(true);
        });
    });

    describe('getBaselineAge', () => {
        it('returns NEW when sampleCount is 0', () => {
            const b = createEmptyBaseline(7);
            expect(getBaselineAge(b, 7)).toBe('NEW');
        });

        it('returns BUILDING when sampleCount is < windowDays', () => {
            const b = createEmptyBaseline(7);
            b.sampleCount = 6;
            expect(getBaselineAge(b, 7)).toBe('BUILDING');
        });

        it('returns READY when windowDays <= sampleCount < windowDays * 3', () => {
            const b = createEmptyBaseline(7);
            b.sampleCount = 7;
            expect(getBaselineAge(b, 7)).toBe('READY');
            b.sampleCount = 20;
            expect(getBaselineAge(b, 7)).toBe('READY');
        });

        it('returns MATURE when sampleCount >= windowDays * 3', () => {
            const b = createEmptyBaseline(7);
            b.sampleCount = 21;
            expect(getBaselineAge(b, 7)).toBe('MATURE');
            b.sampleCount = 22;
            expect(getBaselineAge(b, 7)).toBe('MATURE');
        });
    });

});
