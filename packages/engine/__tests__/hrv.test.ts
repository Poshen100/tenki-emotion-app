import { calculateHrvBaselineRange, getHrvStatus, harmonizeHrv } from '../src/legacy/hrv';

describe('HRV Engine Logic', () => {

    describe('calculateHrvBaselineRange', () => {
        it('returns 0 for empty array', () => {
            expect(calculateHrvBaselineRange([])).toEqual({ low: 0, high: 0, mean: 0 });
        });

        it('handles single element array', () => {
            expect(calculateHrvBaselineRange([50])).toEqual({ low: 50, high: 50, mean: 50 });
        });

        it('calculates mean and std correctly for normal array', () => {
            const range = calculateHrvBaselineRange([40, 50, 60]);
            // mean = 50. variance = 200 / 3 = 66.66. std = 8.16
            expect(range.mean).toBe(50);
            expect(range.low).toBeCloseTo(41.835, 2);
            expect(range.high).toBeCloseTo(58.165, 2);
        });
    });

    describe('getHrvStatus', () => {
        const range = { low: 40, high: 60, mean: 50 };

        it('returns BALANCED if baseline mean is 0', () => {
            expect(getHrvStatus(100, { low: 0, high: 0, mean: 0 })).toBe('BALANCED');
        });

        it('returns ELEVATED if > high * 1.1', () => {
            expect(getHrvStatus(67, range)).toBe('ELEVATED'); // 60 * 1.1 = 66
        });

        it('returns BALANCED if >= low and <= high * 1.1', () => {
            expect(getHrvStatus(40, range)).toBe('BALANCED');
            expect(getHrvStatus(66, range)).toBe('BALANCED');
        });

        it('returns UNBALANCED if >= low * 0.85 and < low', () => {
            // low = 40. 40 * 0.85 = 34
            expect(getHrvStatus(34, range)).toBe('UNBALANCED');
            expect(getHrvStatus(39, range)).toBe('UNBALANCED');
        });

        it('returns LOW if >= low * 0.70 and < low * 0.85', () => {
            // 40 * 0.70 = 28
            expect(getHrvStatus(28, range)).toBe('LOW');
            expect(getHrvStatus(33, range)).toBe('LOW');
        });

        it('returns POOR if < low * 0.70', () => {
            expect(getHrvStatus(27, range)).toBe('POOR');
            expect(getHrvStatus(10, range)).toBe('POOR');
        });
    });

    describe('harmonizeHrv', () => {
        it('approximates RMSSD as SDNN * 0.75 for watch_healthkit + sdnnMs', () => {
            expect(harmonizeHrv('watch_healthkit', 0, 100)).toBe(75);
        });

        it('returns rmssdMs for watch_healthkit if sdnnMs is null', () => {
            expect(harmonizeHrv('watch_healthkit', 42, null)).toBe(42);
        });

        it('returns rmssdMs directly for ble_chest', () => {
            expect(harmonizeHrv('ble_chest', 55, 100)).toBe(55);
        });

        it('returns rmssdMs directly for rppg sources', () => {
            expect(harmonizeHrv('rppg_glabella', 30, null)).toBe(30);
            expect(harmonizeHrv('rppg_forehead', 35, null)).toBe(35);
            expect(harmonizeHrv('rppg_cheek', 40, null)).toBe(40);
        });
    });
});
