/**
 * @fileoverview Progressive TEI + Expectancy Unit Tests
 * @description 使用 Vitest 測試核心模組。
 * @version 2.0.0
 */

import { describe, it, expect, beforeEach } from 'vitest';

// ==================== PROGRESSIVE TEI TESTS ====================

describe('ProgressiveTEI', () => {
    let ProgressiveTEI;
    let tei;

    beforeEach(async () => {
        // 動態載入（支援 IIFE 格式）
        const globalObj = globalThis;
        await import('../core/progressive-tei.js');
        ProgressiveTEI = globalObj.TENKI_PROGRESSIVE_TEI.ProgressiveTEI;
        tei = new ProgressiveTEI();
    });

    it('should reject invalid data (HR too high)', () => {
        const result = tei.onNewData({ hr: 200, hrv: 50 }, 0.8);
        expect(result).toBeNull();
    });

    it('should reject invalid data (HR too low)', () => {
        const result = tei.onNewData({ hr: 30, hrv: 50 }, 0.8);
        expect(result).toBeNull();
    });

    it('should reject low quality signals', () => {
        const result = tei.onNewData({ hr: 70, hrv: 50 }, 0.3); // quality < 0.6
        expect(result).toBeNull();
    });

    it('should accept valid data', () => {
        const result = tei.isValid({ hr: 70, hrv: 50 }, 0.8);
        expect(result).toBe(true);
    });

    it('should return quick result at 4 data points', () => {
        let result = null;
        for (let i = 0; i < 4; i++) {
            result = tei.onNewData({ hr: 70, hrv: 50 }, 0.8);
        }

        expect(result).not.toBeNull();
        expect(result.level).toBe('quick');
        expect(result.confidence).toBe(0.40);
        expect(result.dataPoints).toBe(4);
    });

    it('should return standard result at 15 data points', () => {
        let result = null;
        for (let i = 0; i < 15; i++) {
            result = tei.onNewData({ hr: 70, hrv: 50 }, 0.8);
        }

        expect(result).not.toBeNull();
        expect(result.level).toBe('standard');
        expect(result.confidence).toBe(0.70);
    });

    it('should return ultra result at 60 data points', () => {
        let result = null;
        for (let i = 0; i < 60; i++) {
            result = tei.onNewData({
                hr: 68 + Math.random() * 4,
                hrv: 50 + Math.random() * 10
            }, 0.8);
        }

        expect(result).not.toBeNull();
        expect(result.level).toBe('ultra');
        expect(result.confidence).toBe(0.95);
    });

    it('should produce TEI scores between 1 and 99', () => {
        for (let i = 0; i < 60; i++) {
            tei.onNewData({ hr: 70, hrv: 50 }, 0.8);
        }

        const result = tei.lastResult;
        expect(result.score).toBeGreaterThanOrEqual(1);
        expect(result.score).toBeLessThanOrEqual(99);
    });

    it('should increase confidence with more data', () => {
        let results = [];
        for (let i = 0; i < 60; i++) {
            const r = tei.onNewData({ hr: 70, hrv: 50 }, 0.8);
            if (r) results.push(r);
        }

        expect(results.length).toBeGreaterThanOrEqual(3);
        for (let i = 1; i < results.length; i++) {
            expect(results[i].confidence).toBeGreaterThanOrEqual(results[i - 1].confidence);
        }
    });

    it('should report progress correctly', () => {
        for (let i = 0; i < 20; i++) {
            tei.onNewData({ hr: 70, hrv: 50 }, 0.8);
        }

        const progress = tei.getProgress();
        expect(progress.dataPoints).toBe(20);
        expect(progress.currentLevel).toBe('standard');
        expect(progress.nextMilestone).toBe(30);
    });

    it('should reset correctly', () => {
        for (let i = 0; i < 10; i++) {
            tei.onNewData({ hr: 70, hrv: 50 }, 0.8);
        }

        tei.reset();

        expect(tei.validDataPoints.length).toBe(0);
        expect(tei.lastResult).toBeNull();
    });

    it('error margin should increase with higher confidence', () => {
        const data = Array(30).fill(null).map(() => ({
            hr: 70 + Math.random() * 5,
            hrv: 50 + Math.random() * 10,
            quality: 0.8,
            timestamp: Date.now()
        }));

        const error70 = tei.estimateError(data, 0.70);
        const error95 = tei.estimateError(data, 0.95);

        expect(error95).toBeGreaterThanOrEqual(error70);
    });
});

// ==================== EXPECTANCY CALCULATOR TESTS ====================

describe('ExpectancyCalculator', () => {
    let ExpectancyCalculator;
    let calc;

    const mockTrades = [
        // PEAK tier (TEI ≥ 80)
        { teiScore: 85, outcome: 'win', pnl: 200, timestamp: '2024-01-15' },
        { teiScore: 90, outcome: 'win', pnl: 150, timestamp: '2024-01-16' },
        { teiScore: 82, outcome: 'loss', pnl: -50, timestamp: '2024-01-17' },

        // OPTIMAL tier (TEI 55-79)
        { teiScore: 65, outcome: 'win', pnl: 80, timestamp: '2024-01-18' },
        { teiScore: 70, outcome: 'loss', pnl: -60, timestamp: '2024-01-19' },

        // DEGRADED tier (TEI < 35)
        { teiScore: 25, outcome: 'loss', pnl: -150, timestamp: '2024-01-20' },
        { teiScore: 30, outcome: 'loss', pnl: -200, timestamp: '2024-01-21' }
    ];

    const mockStorage = {
        getTrades: async () => mockTrades
    };

    beforeEach(async () => {
        const globalObj = globalThis;
        await import('../core/expectancy-calculator.js');
        ExpectancyCalculator = globalObj.TENKI_EXPECTANCY.ExpectancyCalculator;
        calc = new ExpectancyCalculator(mockStorage);
    });

    it('should calculate tier-based expectancy', async () => {
        const results = await calc.calculate('2024-01-01', '2024-12-31');

        expect(results).not.toBeNull();
        expect(results.peak).not.toBeNull();
        expect(results.peak.totalTrades).toBe(3);
        expect(results.peak.wins).toBe(2);
        expect(results.peak.winRate).toBe(67);
    });

    it('peak tier should have higher expectancy than degraded', async () => {
        const results = await calc.calculate('2024-01-01', '2024-12-31');

        expect(results.peak.expectancy).toBeGreaterThan(results.degraded.expectancy);
    });

    it('what-if analysis should show improvement', () => {
        const result = calc.whatIfAnalysis(mockTrades, 55);

        expect(result.actual).toBeDefined();
        expect(result.whatIf).toBeDefined();
        expect(result.improvement).toBeDefined();
        expect(result.whatIf.trades).toBeLessThan(result.actual.trades);
    });

    it('t-test should work with enough data', () => {
        const group1 = [100, 200, 150, 80, 120]; // 高 TEI
        const group2 = [-50, -100, -150, -80, -60]; // 低 TEI

        const result = calc.tTest(group1, group2);

        expect(result.t).toBeGreaterThan(0);
        expect(result.significant).toBe(true);
    });

    it('t-test should handle insufficient data', () => {
        const result = calc.tTest([100], [50]);

        expect(result.significant).toBe(false);
        expect(result.message).toBe('樣本數不足');
    });

    it('optimizeThreshold should find optimal threshold', () => {
        const result = calc.optimizeThreshold(mockTrades);

        expect(result.optimal).toBeGreaterThanOrEqual(30);
        expect(result.optimal).toBeLessThanOrEqual(85);
        expect(result.allResults).toHaveLength(11);
    });
});
