import { calculateTeiRaw, calculateTeiPr, getZone, TEI_WEIGHTS } from '../src/tei';
import { BaselineData, ScanMetrics } from '../src/types';

describe('TEI Engine Logic', () => {
    const mockBaseline: BaselineData = {
        windowDays: 7,
        hrMean: 70,
        hrStd: 5,
        hrvMean: 50,
        hrvStd: 10,
        rrMean: 16,
        rrStd: 2,
        sampleCount: 10,
    };

    describe('calculateTeiRaw', () => {
        it('returns a raw score around 50 for average metrics', () => {
            const metrics: ScanMetrics = { hrBpm: 70, hrvRmssdMs: 50, rrBrpm: 16 };
            const raw = calculateTeiRaw(metrics, mockBaseline);
            expect(raw).toBe(50);
        });

        it('returns a higher score for lower HR, higher HRV, and lower RR', () => {
            const metrics: ScanMetrics = { hrBpm: 60, hrvRmssdMs: 70, rrBrpm: 12 };
            const raw = calculateTeiRaw(metrics, mockBaseline);
            // hrZScore = -2 => -(-2 * 10 * 0.3) = +6
            // hrvZScore = 2 => +(2 * 10 * 0.5) = +10
            // rrZScore = -2 => -(-2 * 10 * 0.2) = +4
            // Raw = 50 + 6 + 10 + 4 = 70
            expect(raw).toBe(70);
        });

        it('handles extreme values appropriately', () => {
            const metrics: ScanMetrics = { hrBpm: 200, hrvRmssdMs: 0, rrBrpm: 30 };
            const raw = calculateTeiRaw(metrics, mockBaseline);
            // hrZScore = 130/5 = 26 => -(26 * 10 * 0.3) = -78
            // hrvZScore = -50/10 = -5 => +(-5 * 10 * 0.5) = -25
            // rrZScore = 14/2 = 7 => -(7 * 10 * 0.2) = -14
            // Raw = 50 - 78 - 25 - 14 = -67
            expect(raw).toBe(-67);
        });

        it('returns a fallback 50 if baseline has 0 sampleCount or any 0 std', () => {
            let metrics: ScanMetrics = { hrBpm: 60, hrvRmssdMs: 70, rrBrpm: 12 };
            expect(calculateTeiRaw(metrics, { ...mockBaseline, sampleCount: 0 })).toBe(50);
            expect(calculateTeiRaw(metrics, { ...mockBaseline, hrStd: 0 })).toBe(50);
            expect(calculateTeiRaw(metrics, { ...mockBaseline, hrvStd: 0 })).toBe(50);
            expect(calculateTeiRaw(metrics, { ...mockBaseline, rrStd: 0 })).toBe(50);
        });
    });

    describe('calculateTeiPr', () => {
        const history = Array.from({ length: 100 }, (_, i) => i); // 0 to 99

        it('bounds to 1 when percentile is 0', () => {
            expect(calculateTeiPr(-10, history)).toBe(1);
        });

        it('bounds to 99 when percentile is 100', () => {
            expect(calculateTeiPr(200, history)).toBe(99);
        });

        it('returns 50 when history array is empty', () => {
            expect(calculateTeiPr(75, [])).toBe(50);
        });

        it('handles single element history array correctly', () => {
            expect(calculateTeiPr(70, [60])).toBe(99); // 100% -> bounded to 99
            expect(calculateTeiPr(50, [60])).toBe(1);  // 0% -> bounded to 1
        });

        it('returns correct PR across standard boundaries', () => {
            // 34 is larger than 34 elements (0 to 33) => percentile 34, round to 34
            expect(calculateTeiPr(34, history)).toBe(34);
            expect(calculateTeiPr(35, history)).toBe(35);
            expect(calculateTeiPr(54, history)).toBe(54);
            expect(calculateTeiPr(55, history)).toBe(55);
            expect(calculateTeiPr(79, history)).toBe(79);
            expect(calculateTeiPr(80, history)).toBe(80);
        });

        it('produces stable PR across slightly different historical distributions', () => {
            const baseHistory = Array.from({ length: 100 }, (_, i) => i);
            const prResults: number[] = [];

            for (let i = 0; i < 100; i++) {
                const shuffled = [...baseHistory];
                // randomly replace one element with a random value
                shuffled[Math.floor(Math.random() * 100)] = Math.random() * 100;
                prResults.push(calculateTeiPr(75, shuffled));
            }

            const mean = prResults.reduce((a, b) => a + b) / prResults.length;
            const maxDeviation = Math.max(...prResults.map(v => Math.abs(v - mean)));
            expect(maxDeviation).toBeLessThanOrEqual(3);
        });
    });

    describe('getZone', () => {
        it('classifies PEAK correctly', () => {
            expect(getZone(80)).toBe('PEAK');
            expect(getZone(99)).toBe('PEAK');
        });

        it('classifies OPTIMAL correctly', () => {
            expect(getZone(55)).toBe('OPTIMAL');
            expect(getZone(79)).toBe('OPTIMAL');
        });

        it('classifies NEUTRAL correctly', () => {
            expect(getZone(35)).toBe('NEUTRAL');
            expect(getZone(54)).toBe('NEUTRAL');
        });

        it('classifies DEGRADED correctly', () => {
            expect(getZone(1)).toBe('DEGRADED');
            expect(getZone(34)).toBe('DEGRADED');
        });

        it('handles out of bounds boundary values appropriately', () => {
            expect(getZone(0)).toBe('DEGRADED');
            expect(getZone(-1)).toBe('DEGRADED');
            expect(getZone(100)).toBe('PEAK');
        });
    });
});
