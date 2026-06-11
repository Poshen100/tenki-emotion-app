import { calculateStress, getStressLevel, } from '../src/stress';
import type { BaselineData, ScanMetrics } from '../src/types';

describe('Stress Engine Logic', () => {
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

    describe('calculateStress', () => {
        it('returns score around 50 for average measurements', () => {
            const metrics: ScanMetrics = { hrBpm: 70, hrvRmssdMs: 50, rrBrpm: 16 };
            const res = calculateStress(metrics, mockBaseline);
            expect(res.hrvContribution).toBe(50);
            expect(res.hrContribution).toBe(50);
            expect(res.score).toBe(50);
            expect(res.level).toBe('LOW'); // 50 is in LOW [26,50]
        });

        it('returns REST level (< 25) for low HR and high HRV', () => {
            const metrics: ScanMetrics = { hrBpm: 60, hrvRmssdMs: 70, rrBrpm: 16 };
            const res = calculateStress(metrics, mockBaseline);
            // hrvZScore = 20 / 10 = 2. hrvStress = 50 - 50 = 0
            // hrZScore = -10 / 5 = -2. hrStress = 50 - 50 = 0
            // score = 0
            expect(res.hrvContribution).toBe(0);
            expect(res.hrContribution).toBe(0);
            expect(res.score).toBe(0);
            expect(res.level).toBe('REST');
        });

        it('returns HIGH level (> 75) for high HR and low HRV', () => {
            const metrics: ScanMetrics = { hrBpm: 80, hrvRmssdMs: 30, rrBrpm: 16 };
            const res = calculateStress(metrics, mockBaseline);
            // hrvZScore = -20 / 10 = -2. hrvStress = 50 - (-50) = 100
            // hrZScore = 10 / 5 = 2. hrStress = 50 + 50 = 100
            // score = 100
            expect(res.score).toBe(100);
            expect(res.level).toBe('HIGH');
        });

        it('returns fallback of 50 if baseline is invalid', () => {
            const invalid = { ...mockBaseline, sampleCount: 0 };
            const metrics = { hrBpm: 100, hrvRmssdMs: 10, rrBrpm: 20 };
            const res = calculateStress(metrics, invalid);
            expect(res.score).toBe(50);
            expect(res.level).toBe('LOW');
        });
    });

    describe('getStressLevel', () => {
        it('handles Garmin scales at boundaries', () => {
            expect(getStressLevel(25)).toBe('REST');
            expect(getStressLevel(26)).toBe('LOW');
            expect(getStressLevel(50)).toBe('LOW');
            expect(getStressLevel(51)).toBe('MEDIUM');
            expect(getStressLevel(75)).toBe('MEDIUM');
            expect(getStressLevel(76)).toBe('HIGH');
        });
    });
});
