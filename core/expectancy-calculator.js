/**
 * @fileoverview Expectancy Calculator - 績效期望值分析引擎
 * @description 分層計算各 TEI 區間的交易期望值，
 *              支援反事實分析、t-test、Sharpe Ratio 和門檻優化。
 * @version 2.0.0
 */

(function (global) {
    'use strict';

    // TEI 層級定義
    const TEI_TIERS = {
        peak: { min: 80, max: 99, label: 'PEAK', color: '#00FF88' },
        optimal: { min: 55, max: 79, label: 'OPTIMAL', color: '#64C8FF' },
        neutral: { min: 35, max: 54, label: 'NEUTRAL', color: '#FFD700' },
        degraded: { min: 1, max: 34, label: 'DEGRADED', color: '#FF6B6B' }
    };

    class ExpectancyCalculator {
        /**
         * @param {Object} storage - 儲存介面 (需有 getTrades 方法)
         */
        constructor(storage) {
            this.storage = storage;
        }

        /**
         * 計算 TEI 分層績效
         * @param {Date|number} startDate
         * @param {Date|number} endDate
         * @returns {Promise<Object>} 各 TEI 層級的期望值
         */
        async calculate(startDate, endDate) {
            const trades = await this._getTrades(startDate, endDate);

            if (trades.length === 0) return null;

            // 按 TEI 分層
            const results = {};

            for (const [tier, range] of Object.entries(TEI_TIERS)) {
                const tierTrades = trades.filter(t =>
                    t.teiScore >= range.min && t.teiScore <= range.max
                );

                if (tierTrades.length === 0) {
                    results[tier] = null;
                    continue;
                }

                const wins = tierTrades.filter(t => t.outcome === 'win' || t.result === 'WIN');
                const losses = tierTrades.filter(t => t.outcome === 'loss' || t.result === 'LOSS');

                const winRate = wins.length / tierTrades.length;
                const avgWin = wins.length > 0 ?
                    this._mean(wins.map(t => Math.abs(t.pnl || t.r_multiple || 1))) : 0;
                const avgLoss = losses.length > 0 ?
                    this._mean(losses.map(t => Math.abs(t.pnl || t.r_multiple || 1))) : 0;

                const expectancy = (winRate * avgWin) - ((1 - winRate) * avgLoss);

                results[tier] = {
                    tier: range.label,
                    color: range.color,
                    totalTrades: tierTrades.length,
                    wins: wins.length,
                    losses: losses.length,
                    winRate: Math.round(winRate * 100),
                    avgWin: Math.round(avgWin * 100) / 100,
                    avgLoss: Math.round(avgLoss * 100) / 100,
                    expectancy: Math.round(expectancy * 100) / 100,
                    totalPnL: Math.round(this._sum(tierTrades.map(t => t.pnl || 0)) * 100) / 100,
                    sharpeRatio: Math.round(this._calculateSharpe(tierTrades) * 100) / 100
                };
            }

            return results;
        }

        /**
         * 反事實分析
         * "如果只在 TEI >= threshold 時交易會如何?"
         * @param {Array} trades - 交易記錄
         * @param {number} threshold - TEI 門檻
         * @returns {Object}
         */
        whatIfAnalysis(trades, threshold) {
            const actualPnL = this._sum(trades.map(t => t.pnl || 0));
            const actualTrades = trades.length;

            // 假設遵循建議
            const filteredTrades = trades.filter(t =>
                (t.teiScore || t.tei || 0) >= threshold
            );
            const whatIfPnL = this._sum(filteredTrades.map(t => t.pnl || 0));
            const whatIfTrades = filteredTrades.length;

            // 避免的虧損交易
            const avoidedTrades = trades.filter(t =>
                (t.teiScore || t.tei || 0) < threshold &&
                (t.outcome === 'loss' || t.result === 'LOSS')
            );
            const avoidedLoss = this._sum(avoidedTrades.map(t => Math.abs(t.pnl || 0)));

            return {
                actual: {
                    pnl: Math.round(actualPnL * 100) / 100,
                    trades: actualTrades,
                    avgPnL: actualTrades > 0 ? Math.round((actualPnL / actualTrades) * 100) / 100 : 0
                },
                whatIf: {
                    pnl: Math.round(whatIfPnL * 100) / 100,
                    trades: whatIfTrades,
                    avgPnL: whatIfTrades > 0 ? Math.round((whatIfPnL / whatIfTrades) * 100) / 100 : 0
                },
                improvement: {
                    pnl: Math.round((whatIfPnL - actualPnL) * 100) / 100,
                    percentage: actualPnL !== 0 ?
                        Math.round(((whatIfPnL - actualPnL) / Math.abs(actualPnL)) * 10000) / 100 : 0,
                    tradesAvoided: actualTrades - whatIfTrades,
                    lossAvoided: Math.round(avoidedLoss * 100) / 100
                }
            };
        }

        /**
         * Welch's t-test 統計顯著性檢定
         * @param {Array<number>} group1 - 高 TEI 組 PnL
         * @param {Array<number>} group2 - 低 TEI 組 PnL
         * @returns {Object} { t, df, pValue, significant }
         */
        tTest(group1, group2) {
            if (group1.length < 2 || group2.length < 2) {
                return { t: 0, df: 0, pValue: 1, significant: false, message: '樣本數不足' };
            }

            const mean1 = this._mean(group1);
            const mean2 = this._mean(group2);
            const var1 = this._variance(group1);
            const var2 = this._variance(group2);
            const n1 = group1.length;
            const n2 = group2.length;

            const denominator = Math.sqrt(var1 / n1 + var2 / n2);
            if (denominator === 0) {
                return { t: 0, df: 0, pValue: 1, significant: false, message: '變異數為零' };
            }

            const t = (mean1 - mean2) / denominator;
            const df = Math.floor(
                Math.pow(var1 / n1 + var2 / n2, 2) /
                (Math.pow(var1 / n1, 2) / (n1 - 1) + Math.pow(var2 / n2, 2) / (n2 - 1))
            );

            const pValue = this._estimatePValue(Math.abs(t), df);

            return {
                t: Math.round(t * 1000) / 1000,
                df,
                pValue,
                significant: pValue < 0.05,
                message: pValue < 0.01 ? '高度顯著 (***)' :
                    pValue < 0.05 ? '顯著 (**)' :
                        pValue < 0.10 ? '邊緣顯著 (*)' : '不顯著'
            };
        }

        /**
         * Sharpe Ratio 計算
         * @param {Array} trades
         * @returns {number}
         */
        _calculateSharpe(trades) {
            if (trades.length < 2) return 0;

            const returns = trades.map(t => t.pnl || t.r_multiple || 0);
            const meanReturn = this._mean(returns);
            const stdReturn = this._std(returns);

            if (stdReturn === 0) return 0;

            // 年化 Sharpe (假設每天 1 筆交易)
            return (meanReturn / stdReturn) * Math.sqrt(252);
        }

        /**
         * 優化 TEI 門檻
         * @param {Array} trades
         * @returns {Object}
         */
        optimizeThreshold(trades) {
            const thresholds = [30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80];
            const results = [];

            for (const threshold of thresholds) {
                const whatIf = this.whatIfAnalysis(trades, threshold);
                results.push({
                    threshold,
                    expectancy: whatIf.whatIf.avgPnL,
                    trades: whatIf.whatIf.trades,
                    improvement: whatIf.improvement.percentage
                });
            }

            // 找最佳門檻
            const optimal = results.reduce((best, current) =>
                current.expectancy > best.expectancy ? current : best,
                results[0]
            );

            return {
                optimal: optimal.threshold,
                optimalExpectancy: optimal.expectancy,
                allResults: results
            };
        }

        // ==================== 輔助函數 ====================

        async _getTrades(startDate, endDate) {
            if (this.storage && typeof this.storage.getTrades === 'function') {
                return await this.storage.getTrades(startDate, endDate);
            }
            // Fallback: 從 localStorage 讀取
            try {
                const trades = JSON.parse(localStorage.getItem('tenki_trades') || '[]');
                const start = new Date(startDate).getTime();
                const end = new Date(endDate).getTime();

                return trades.filter(t => {
                    const ts = new Date(t.timestamp).getTime();
                    return ts >= start && ts <= end;
                });
            } catch {
                return [];
            }
        }

        _mean(arr) {
            if (arr.length === 0) return 0;
            return arr.reduce((a, b) => a + b, 0) / arr.length;
        }

        _sum(arr) {
            return arr.reduce((a, b) => a + b, 0);
        }

        _variance(arr) {
            if (arr.length < 2) return 0;
            const m = this._mean(arr);
            return arr.reduce((sum, val) =>
                sum + Math.pow(val - m, 2), 0) / (arr.length - 1);
        }

        _std(arr) {
            return Math.sqrt(this._variance(arr));
        }

        _estimatePValue(t, df) {
            // 簡化 p-value 估算 (查表近似)
            if (df < 1) return 1;
            if (t > 3.5) return 0.001;
            if (t > 2.9) return 0.005;
            if (t > 2.5) return 0.01;
            if (t > 2.0) return 0.05;
            if (t > 1.7) return 0.10;
            if (t > 1.3) return 0.20;
            return 0.30;
        }
    }

    // ==================== EXPORT ====================

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { ExpectancyCalculator, TEI_TIERS };
    }

    global.TENKI_EXPECTANCY = {
        create: (storage) => new ExpectancyCalculator(storage),
        ExpectancyCalculator,
        TEI_TIERS
    };

    console.log('[EXPECTANCY] Module loaded ✓');

})(typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : this);
