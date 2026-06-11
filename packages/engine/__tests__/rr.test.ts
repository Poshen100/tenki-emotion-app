import {
    clampBrpm,
    estimateBrpmFromRRIntervals,
    smoothBrpm,
    getRrStatus,
    analyzeRr,
    RR_ABS_MIN,
    RR_ABS_MAX,
} from '../src/rr';
import type { BaselineData } from '../src/types';

// --- Helper ---
function makeBaseline(overrides: Partial<BaselineData> = {}): BaselineData {
    return {
        windowDays: 7,
        hrMean: 70, hrStd: 5,
        hrvMean: 45, hrvStd: 10,
        rrMean: 16, rrStd: 2,
        sampleCount: 30,
        ...overrides,
    };
}

describe('rr.ts — Respiratory Rate', () => {

    // ===================== clampBrpm =====================
    describe('clampBrpm', () => {
        it('should pass through normal values', () => {
            expect(clampBrpm(16)).toBe(16);
        });

        it('should clamp below absolute min', () => {
            expect(clampBrpm(2)).toBe(RR_ABS_MIN);
            expect(clampBrpm(-5)).toBe(RR_ABS_MIN);
        });

        it('should clamp above absolute max', () => {
            expect(clampBrpm(50)).toBe(RR_ABS_MAX);
            expect(clampBrpm(100)).toBe(RR_ABS_MAX);
        });
    });

    // ============= estimateBrpmFromRRIntervals ==============
    describe('estimateBrpmFromRRIntervals', () => {
        it('should return null for insufficient data (< 6 intervals)', () => {
            expect(estimateBrpmFromRRIntervals([])).toBeNull();
            expect(estimateBrpmFromRRIntervals([800, 810, 790])).toBeNull();
        });

        it('should return null for null/undefined input', () => {
            expect(estimateBrpmFromRRIntervals(null as unknown as number[])).toBeNull();
        });

        it('should return null for flat intervals (no crossings)', () => {
            // All identical → no successive diff sign changes
            const flat = [800, 800, 800, 800, 800, 800, 800, 800];
            expect(estimateBrpmFromRRIntervals(flat)).toBeNull();
        });

        it('should estimate a reasonable BrPM from oscillating RR intervals', () => {
            // Simulate ~15 BrPM breathing: RR intervals oscillate with period ~4s
            // At 60 bpm HR, RR interval ≈ 1000ms, oscillation ± 30ms
            const intervals: number[] = [];
            for (let i = 0; i < 60; i++) {
                intervals.push(1000 + 30 * Math.sin(2 * Math.PI * i / 4));
            }
            const result = estimateBrpmFromRRIntervals(intervals);
            expect(result).not.toBeNull();
            // Should be in a physiologically plausible range
            expect(result!).toBeGreaterThanOrEqual(RR_ABS_MIN);
            expect(result!).toBeLessThanOrEqual(RR_ABS_MAX);
        });

        it('should clamp extreme results', () => {
            // Very rapid oscillations → should still clamp
            const rapid = [500, 600, 500, 600, 500, 600, 500, 600, 500, 600];
            const result = estimateBrpmFromRRIntervals(rapid);
            if (result !== null) {
                expect(result).toBeLessThanOrEqual(RR_ABS_MAX);
                expect(result).toBeGreaterThanOrEqual(RR_ABS_MIN);
            }
        });
    });

    // ================= smoothBrpm =================
    describe('smoothBrpm', () => {
        it('should return current value when no previous smoothed', () => {
            expect(smoothBrpm(16, null)).toBe(16);
        });

        it('should apply EWMA smoothing', () => {
            const result = smoothBrpm(20, 16);
            // α=0.15: 0.15*20 + 0.85*16 = 3 + 13.6 = 16.6
            expect(result).toBe(16.6);
        });

        it('should converge slowly with low alpha', () => {
            let smoothed: number | null = null;
            const readings = [16, 16, 16, 20, 20, 20, 20, 20, 20, 20];
            for (const r of readings) {
                smoothed = smoothBrpm(r, smoothed);
            }
            // After several 20s, should approach but not reach 20
            expect(smoothed!).toBeGreaterThan(16);
            expect(smoothed!).toBeLessThan(20);
        });

        it('should accept custom alpha', () => {
            const result = smoothBrpm(20, 16, 0.5);
            // 0.5*20 + 0.5*16 = 18
            expect(result).toBe(18);
        });
    });

    // ================ getRrStatus ================
    describe('getRrStatus', () => {
        it('should return NORMAL for 12-20 BrPM', () => {
            expect(getRrStatus(12)).toBe('NORMAL');
            expect(getRrStatus(16)).toBe('NORMAL');
            expect(getRrStatus(20)).toBe('NORMAL');
        });

        it('should return LOW for 6-11 BrPM', () => {
            expect(getRrStatus(8)).toBe('LOW');
            expect(getRrStatus(11)).toBe('LOW');
        });

        it('should return ELEVATED for 21-28 BrPM', () => {
            expect(getRrStatus(21)).toBe('ELEVATED');
            expect(getRrStatus(28)).toBe('ELEVATED');
        });

        it('should return CRITICAL for extremes', () => {
            expect(getRrStatus(5)).toBe('CRITICAL');
            expect(getRrStatus(4)).toBe('CRITICAL');
            expect(getRrStatus(30)).toBe('CRITICAL');
            expect(getRrStatus(35)).toBe('CRITICAL');
        });
    });

    // ================ analyzeRr ================
    describe('analyzeRr', () => {
        const baseline = makeBaseline();

        it('should compute correct z-score', () => {
            const result = analyzeRr(18, baseline);
            // z = (18 - 16) / 2 = 1.0
            expect(result.zScore).toBe(1.0);
            expect(result.status).toBe('NORMAL');
            expect(result.withinNormal).toBe(true);
        });

        it('should return 0 z-score when baseline has no data', () => {
            const emptyBaseline = makeBaseline({ sampleCount: 0 });
            const result = analyzeRr(22, emptyBaseline);
            expect(result.zScore).toBe(0);
        });

        it('should return 0 z-score when rrStd is 0', () => {
            const zeroStd = makeBaseline({ rrStd: 0 });
            const result = analyzeRr(22, zeroStd);
            expect(result.zScore).toBe(0);
        });

        it('should clamp extreme input values', () => {
            const result = analyzeRr(50, baseline);
            expect(result.brpm).toBe(RR_ABS_MAX);
        });

        it('should flag elevated breathing as not within normal range', () => {
            const result = analyzeRr(24, baseline);
            expect(result.withinNormal).toBe(false);
            expect(result.status).toBe('ELEVATED');
        });

        it('should handle negative z-scores for low BrPM', () => {
            const result = analyzeRr(10, baseline);
            // z = (10 - 16) / 2 = -3.0
            expect(result.zScore).toBe(-3.0);
            expect(result.status).toBe('LOW');
        });
    });
});
