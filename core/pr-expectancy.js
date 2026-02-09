/**
 * @fileoverview PR-Expectancy Engine - 績效報酬期望值計算
 * @description TENKI 核心護城河：根據歷史交易記錄計算各 TEI 區間的期望值。
 * @version 1.0.0
 */

(function (global) {
    'use strict';

    class PRExpectancyEngine {
        constructor() {
            this.trades = this.loadTrades();
        }

        /**
         * 新增交易記錄
         * @param {Object} record - 交易記錄
         * @param {number} record.tei - 交易時的 TEI
         * @param {string} record.template - 使用的模板
         * @param {number} record.decision_time - 決策耗時 (秒)
         * @param {string} record.result - 結果 (WIN/LOSS)
         * @param {string} record.entry_type - 進場類型 (EARLY/TIMEOUT/ABORT)
         * @param {number} [record.r_multiple] - R 倍數
         */
        addTrade(record) {
            const trade = {
                id: this.generateId(),
                timestamp: new Date().toISOString(),
                tei: record.tei,
                template: record.template,
                decision_time: record.decision_time || 0,
                result: record.result || 'UNKNOWN',
                entry_type: record.entry_type || 'UNKNOWN',
                r_multiple: record.r_multiple || 0
            };
            this.trades.push(trade);
            this.saveTrades();

            // 發送事件
            if (global.EventBridge) {
                global.EventBridge.notifyTradeRecorded(trade);
            }

            return trade;
        }

        /**
         * 計算 TEI 區間的期望值
         * @param {Array} range - [min, max] 例如 [55, 60]
         * @returns {Object} 統計結果
         */
        calculateExpectancy(range) {
            const [min, max] = range;
            const filtered = this.trades.filter(t => t.tei >= min && t.tei <= max);

            if (filtered.length < 10) {
                return {
                    teiRange: `${min}-${max}`,
                    confidence: 'LOW',
                    message: '樣本數不足 (需 ≥10 筆)',
                    sampleSize: filtered.length
                };
            }

            const wins = filtered.filter(t => t.result === 'WIN');
            const losses = filtered.filter(t => t.result === 'LOSS');

            if (wins.length === 0 || losses.length === 0) {
                return {
                    teiRange: `${min}-${max}`,
                    winRate: wins.length > 0 ? 100 : 0,
                    sampleSize: filtered.length,
                    confidence: this.getConfidence(filtered.length),
                    message: wins.length === 0 ? '全敗' : '全勝'
                };
            }

            const winRate = wins.length / filtered.length;
            const avgWin = wins.reduce((sum, t) => sum + Math.abs(t.r_multiple || 1), 0) / wins.length;
            const avgLoss = losses.reduce((sum, t) => sum + Math.abs(t.r_multiple || 1), 0) / losses.length;
            const expectancy = (winRate * avgWin) - ((1 - winRate) * avgLoss);

            return {
                teiRange: `${min}-${max}`,
                expectancy: expectancy.toFixed(2),
                winRate: Math.round(winRate * 100),
                avgWin: avgWin.toFixed(2),
                avgLoss: avgLoss.toFixed(2),
                sampleSize: filtered.length,
                confidence: this.getConfidence(filtered.length)
            };
        }

        /**
         * 自動分箱統計 (TEI 每 binSize 分一組)
         * @param {number} [binSize=5] - 區間大小
         * @returns {Array} 各區間統計
         */
        getBinStats(binSize = 5) {
            const bins = [];
            for (let start = 0; start < 100; start += binSize) {
                const stats = this.calculateExpectancy([start, start + binSize - 1]);
                if (stats.sampleSize > 0) bins.push(stats);
            }
            return bins;
        }

        /**
         * 找出最佳 TEI 區間
         * @returns {Object|null} 最佳區間資訊
         */
        findOptimalZone() {
            const bins = this.getBinStats().filter(b => b.expectancy !== undefined);
            if (bins.length === 0) return null;
            bins.sort((a, b) => parseFloat(b.expectancy) - parseFloat(a.expectancy));
            return {
                bestZone: bins[0].teiRange,
                expectancy: bins[0].expectancy,
                winRate: bins[0].winRate,
                sampleSize: bins[0].sampleSize
            };
        }

        /**
         * 取得模板統計
         * @param {string} template - 模板名稱
         * @returns {Object} 統計結果
         */
        getTemplateStats(template) {
            const filtered = this.trades.filter(t => t.template === template);
            if (filtered.length === 0) return { template, sampleSize: 0 };

            const wins = filtered.filter(t => t.result === 'WIN');
            return {
                template,
                sampleSize: filtered.length,
                winRate: Math.round((wins.length / filtered.length) * 100),
                avgDecisionTime: Math.round(filtered.reduce((s, t) => s + (t.decision_time || 0), 0) / filtered.length)
            };
        }

        /**
         * 信心度評估
         */
        getConfidence(sampleSize) {
            if (sampleSize < 10) return 'LOW';
            if (sampleSize < 30) return 'MEDIUM';
            return 'HIGH';
        }

        /**
         * 載入交易記錄
         */
        loadTrades() {
            try {
                const saved = localStorage.getItem('tenki_trades');
                return saved ? JSON.parse(saved) : [];
            } catch (e) {
                console.error('[PRExpectancy] Load error:', e);
                return [];
            }
        }

        /**
         * 儲存交易記錄
         */
        saveTrades() {
            try {
                localStorage.setItem('tenki_trades', JSON.stringify(this.trades));
            } catch (e) {
                console.error('[PRExpectancy] Save error:', e);
            }
        }

        /**
         * 匯出資料 (JSON)
         */
        exportData() {
            return JSON.stringify(this.trades, null, 2);
        }

        /**
         * 匯入資料
         * @param {string} jsonString - JSON 字串
         * @returns {boolean} 是否成功
         */
        importData(jsonString) {
            try {
                const data = JSON.parse(jsonString);
                if (!Array.isArray(data)) throw new Error('Invalid format');
                this.trades = data;
                this.saveTrades();
                return true;
            } catch (e) {
                console.error('[PRExpectancy] Import error:', e);
                return false;
            }
        }

        /**
         * 清除所有資料
         */
        clearAll() {
            this.trades = [];
            this.saveTrades();
        }

        /**
         * 生成唯一 ID
         */
        generateId() {
            return `trade_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        }

        /**
         * 取得總交易數
         */
        getTradeCount() {
            return this.trades.length;
        }
    }

    global.PRExpectancyEngine = PRExpectancyEngine;

})(typeof window !== 'undefined' ? window : this);
