/**
 * TENKI PRO - PR-Expectancy Engine v1.0
 * 
 * 期望值引擎 - 計算交易績效與報酬期望值
 * 這是 TENKI 最核心的護城河！
 * 
 * 設計原則:
 * 1. 只計算，不建議 - 呈現數據讓使用者自行判斷
 * 2. 支援 TEI 分箱統計
 * 3. 資料匯入/匯出功能
 * 4. 完全獨立，不修改任何現有檔案
 * 
 * @author TENKI Team
 * @version 1.0.0
 */

const PRExpectancy = (function () {
    'use strict';

    // =============================================================================
    // CONSTANTS
    // =============================================================================

    /**
     * 儲存鍵
     * @constant {string}
     */
    const STORAGE_KEY = 'tenki_trades';

    /**
     * 預設配置
     * @constant {Object}
     */
    const DEFAULTS = {
        BIN_SIZE: 5,                    // TEI 分箱大小
        MIN_SAMPLE_SIZE: 10,            // 最小樣本數
        CONFIDENCE_THRESHOLDS: {
            LOW: 10,
            MEDIUM: 30,
            HIGH: 50
        }
    };

    /**
     * 交易結果枚舉
     * @enum {string}
     */
    const RESULTS = {
        WIN: 'WIN',
        LOSS: 'LOSS',
        BREAKEVEN: 'BREAKEVEN'
    };

    // =============================================================================
    // PR-EXPECTANCY ENGINE CLASS
    // =============================================================================

    /**
     * PR-Expectancy 引擎類別
     */
    class PRExpectancyEngine {
        /**
         * 建立期望值引擎
         * 
         * @param {Object} [config={}] - 配置選項
         * @param {number} [config.binSize=5] - 分箱大小
         * @param {number} [config.minSampleSize=10] - 最小樣本數
         */
        constructor(config = {}) {
            this.binSize = config.binSize || DEFAULTS.BIN_SIZE;
            this.minSampleSize = config.minSampleSize || DEFAULTS.MIN_SAMPLE_SIZE;

            // 載入交易記錄
            this.trades = this._loadTrades();
        }

        // =========================================================================
        // TRADE MANAGEMENT
        // =========================================================================

        /**
         * 新增交易記錄
         * 
         * @param {Object} record - 交易記錄
         * @param {number} record.tei - TEI 值 (1-99)
         * @param {string} record.template - 模板 ID
         * @param {number} record.decision_time - 決策時間 (秒)
         * @param {string} record.result - 結果 ('WIN' | 'LOSS' | 'BREAKEVEN')
         * @param {string} record.entry_type - 進場類型 ('EARLY' | 'TIMEOUT' | 'ABORT')
         * @param {number} [record.r_multiple] - R 倍數 (盈虧)
         * @param {string} [record.notes] - 備註
         * @returns {Object} 新增的記錄
         */
        addTrade(record) {
            const trade = {
                id: this._generateId(),
                timestamp: new Date().toISOString(),
                tei: Math.round(record.tei),
                template: record.template,
                decision_time: record.decision_time,
                result: record.result,
                entry_type: record.entry_type,
                r_multiple: record.r_multiple || 0,
                notes: record.notes || ''
            };

            this.trades.push(trade);
            this._saveTrades();

            // 發送事件
            if (typeof EventBridge !== 'undefined') {
                EventBridge.notifyTradeRecorded(trade);
            }

            return trade;
        }

        /**
         * 更新交易記錄
         * 
         * @param {string} id - 交易 ID
         * @param {Object} updates - 更新內容
         * @returns {boolean} 是否成功
         */
        updateTrade(id, updates) {
            const index = this.trades.findIndex(t => t.id === id);
            if (index === -1) return false;

            this.trades[index] = {
                ...this.trades[index],
                ...updates,
                updatedAt: new Date().toISOString()
            };

            this._saveTrades();
            return true;
        }

        /**
         * 刪除交易記錄
         * 
         * @param {string} id - 交易 ID
         * @returns {boolean} 是否成功
         */
        deleteTrade(id) {
            const index = this.trades.findIndex(t => t.id === id);
            if (index === -1) return false;

            this.trades.splice(index, 1);
            this._saveTrades();
            return true;
        }

        /**
         * 取得所有交易記錄
         * 
         * @param {Object} [query={}] - 查詢條件
         * @param {string} [query.template] - 模板篩選
         * @param {string} [query.result] - 結果篩選
         * @param {Array<number>} [query.teiRange] - TEI 範圍 [min, max]
         * @param {Date|string} [query.startDate] - 開始日期
         * @param {Date|string} [query.endDate] - 結束日期
         * @returns {Array<Object>} 交易記錄
         */
        getTrades(query = {}) {
            let result = [...this.trades];

            // 模板篩選
            if (query.template) {
                result = result.filter(t => t.template === query.template);
            }

            // 結果篩選
            if (query.result) {
                result = result.filter(t => t.result === query.result);
            }

            // TEI 範圍
            if (query.teiRange && Array.isArray(query.teiRange)) {
                const [min, max] = query.teiRange;
                result = result.filter(t => t.tei >= min && t.tei <= max);
            }

            // 日期範圍
            if (query.startDate) {
                const start = new Date(query.startDate);
                result = result.filter(t => new Date(t.timestamp) >= start);
            }
            if (query.endDate) {
                const end = new Date(query.endDate);
                result = result.filter(t => new Date(t.timestamp) <= end);
            }

            // 排序 (最新在前)
            result.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

            return result;
        }

        /**
         * 取得交易數量
         * @returns {number}
         */
        getTradeCount() {
            return this.trades.length;
        }

        // =========================================================================
        // EXPECTANCY CALCULATIONS
        // =========================================================================

        /**
         * 計算指定 TEI 區間的期望值
         * 
         * 期望值公式: E[R] = (Win Rate × Avg Win) - (Loss Rate × Avg Loss)
         * 
         * @param {Array<number>} range - [min, max] 例如 [55, 60]
         * @returns {Object} 統計結果
         */
        calculateExpectancy(range) {
            const [min, max] = range;
            const filtered = this.trades.filter(t =>
                t.tei >= min && t.tei <= max &&
                t.result !== RESULTS.BREAKEVEN
            );

            if (filtered.length < this.minSampleSize) {
                return {
                    hasData: false,
                    confidence: 'LOW',
                    message: `樣本數不足 (${filtered.length}/${this.minSampleSize} 筆)`,
                    sampleSize: filtered.length
                };
            }

            // 分離勝負
            const wins = filtered.filter(t => t.result === RESULTS.WIN);
            const losses = filtered.filter(t => t.result === RESULTS.LOSS);

            // 計算基本統計
            const winRate = wins.length / filtered.length;
            const lossRate = losses.length / filtered.length;

            // 計算 R 值統計
            const avgWin = wins.length > 0
                ? wins.reduce((sum, t) => sum + Math.abs(t.r_multiple || 1), 0) / wins.length
                : 0;
            const avgLoss = losses.length > 0
                ? losses.reduce((sum, t) => sum + Math.abs(t.r_multiple || 1), 0) / losses.length
                : 0;

            // 期望值
            const expectancy = (winRate * avgWin) - (lossRate * avgLoss);

            // 風險調整報酬比
            const profitFactor = avgLoss > 0 ? (winRate * avgWin) / (lossRate * avgLoss) : 0;

            return {
                hasData: true,
                teiRange: `${min}-${max}`,
                sampleSize: filtered.length,

                // 勝率統計
                wins: wins.length,
                losses: losses.length,
                winRate: Math.round(winRate * 100),
                lossRate: Math.round(lossRate * 100),

                // R 值統計
                avgWin: avgWin.toFixed(2),
                avgLoss: avgLoss.toFixed(2),

                // 期望值
                expectancy: expectancy.toFixed(3),
                isPositive: expectancy > 0,

                // 進階統計
                profitFactor: profitFactor.toFixed(2),

                // 信心度
                confidence: this._getConfidenceLevel(filtered.length)
            };
        }

        /**
         * 自動分箱統計 (TEI 每 binSize 分一組)
         * 
         * @param {Object} [options={}] - 選項
         * @param {number} [options.binSize] - 分箱大小
         * @param {string} [options.template] - 篩選特定模板
         * @returns {Array<Object>} 各箱的統計
         */
        getBinStats(options = {}) {
            const binSize = options.binSize || this.binSize;
            const bins = [];

            for (let start = 1; start <= 99; start += binSize) {
                const end = Math.min(start + binSize - 1, 99);

                // 如果有指定模板，先篩選
                let trades = this.trades;
                if (options.template) {
                    trades = trades.filter(t => t.template === options.template);
                }

                const binTrades = trades.filter(t =>
                    t.tei >= start && t.tei <= end
                );

                if (binTrades.length > 0) {
                    const stats = this.calculateExpectancy([start, end]);
                    if (stats.hasData) {
                        bins.push({
                            ...stats,
                            binStart: start,
                            binEnd: end
                        });
                    }
                }
            }

            return bins;
        }

        /**
         * 找出最佳 TEI 區間
         * 
         * @param {Object} [options={}] - 選項
         * @returns {Object|null} 最佳區間資訊
         */
        findOptimalZone(options = {}) {
            const bins = this.getBinStats(options);

            if (bins.length === 0) {
                return null;
            }

            // 按期望值排序
            const sorted = [...bins].sort(
                (a, b) => parseFloat(b.expectancy) - parseFloat(a.expectancy)
            );

            // 最佳區間
            const best = sorted[0];

            // 最差區間 (用於對比)
            const worst = sorted[sorted.length - 1];

            return {
                best: {
                    teiRange: best.teiRange,
                    expectancy: best.expectancy,
                    winRate: best.winRate,
                    sampleSize: best.sampleSize,
                    confidence: best.confidence
                },
                worst: {
                    teiRange: worst.teiRange,
                    expectancy: worst.expectancy,
                    winRate: worst.winRate,
                    sampleSize: worst.sampleSize
                },
                totalBins: bins.length
            };
        }

        // =========================================================================
        // ENTRY TYPE ANALYSIS
        // =========================================================================

        /**
         * 按進場類型分析
         * 
         * @returns {Object} 各進場類型的統計
         */
        analyzeByEntryType() {
            const types = ['EARLY', 'TIMEOUT', 'ABORT'];
            const result = {};

            for (const type of types) {
                const trades = this.trades.filter(t => t.entry_type === type);

                if (trades.length === 0) {
                    result[type] = { count: 0, hasData: false };
                    continue;
                }

                const wins = trades.filter(t => t.result === RESULTS.WIN);
                const losses = trades.filter(t => t.result === RESULTS.LOSS);

                result[type] = {
                    count: trades.length,
                    hasData: true,
                    winRate: Math.round((wins.length / trades.length) * 100),
                    wins: wins.length,
                    losses: losses.length,
                    avgDecisionTime: this._calculateAvgTime(trades)
                };
            }

            return result;
        }

        /**
         * 按模板分析
         * 
         * @returns {Object} 各模板的統計
         */
        analyzeByTemplate() {
            const templates = [...new Set(this.trades.map(t => t.template))];
            const result = {};

            for (const template of templates) {
                const trades = this.trades.filter(t => t.template === template);

                if (trades.length === 0) continue;

                const wins = trades.filter(t => t.result === RESULTS.WIN);
                const losses = trades.filter(t => t.result === RESULTS.LOSS);

                result[template] = {
                    count: trades.length,
                    winRate: Math.round((wins.length / trades.length) * 100),
                    wins: wins.length,
                    losses: losses.length,
                    avgDecisionTime: this._calculateAvgTime(trades),
                    expectancy: this._calculateSimpleExpectancy(trades)
                };
            }

            return result;
        }

        // =========================================================================
        // DATA EXPORT/IMPORT
        // =========================================================================

        /**
         * 匯出資料為 JSON
         * 
         * @returns {string} JSON 字串
         */
        exportData() {
            return JSON.stringify({
                version: '1.0',
                exportedAt: new Date().toISOString(),
                trades: this.trades
            }, null, 2);
        }

        /**
         * 匯入資料
         * 
         * @param {string} jsonString - JSON 字串
         * @param {Object} [options={}] - 選項
         * @param {boolean} [options.merge=false] - 是否合併 (true) 或覆蓋 (false)
         * @returns {Object} 匯入結果
         */
        importData(jsonString, options = {}) {
            try {
                const data = JSON.parse(jsonString);

                if (!data.trades || !Array.isArray(data.trades)) {
                    return {
                        success: false,
                        error: '無效的資料格式'
                    };
                }

                if (options.merge) {
                    // 合併模式：避免重複
                    const existingIds = new Set(this.trades.map(t => t.id));
                    const newTrades = data.trades.filter(t => !existingIds.has(t.id));
                    this.trades.push(...newTrades);

                    this._saveTrades();

                    return {
                        success: true,
                        imported: newTrades.length,
                        skipped: data.trades.length - newTrades.length,
                        total: this.trades.length
                    };
                } else {
                    // 覆蓋模式
                    this.trades = data.trades;
                    this._saveTrades();

                    return {
                        success: true,
                        imported: data.trades.length,
                        total: this.trades.length
                    };
                }

            } catch (e) {
                console.error('[PRExpectancy] Import failed:', e);
                return {
                    success: false,
                    error: e.message
                };
            }
        }

        /**
         * 清除所有資料
         * 
         * @returns {boolean}
         */
        clearAllData() {
            this.trades = [];
            this._saveTrades();
            return true;
        }

        // =========================================================================
        // SUMMARY STATISTICS
        // =========================================================================

        /**
         * 取得整體統計摘要
         * 
         * @returns {Object} 摘要統計
         */
        getSummary() {
            if (this.trades.length === 0) {
                return {
                    hasData: false,
                    message: '尚無交易記錄'
                };
            }

            const wins = this.trades.filter(t => t.result === RESULTS.WIN);
            const losses = this.trades.filter(t => t.result === RESULTS.LOSS);

            // 整體勝率
            const totalWithResult = wins.length + losses.length;
            const winRate = totalWithResult > 0
                ? Math.round((wins.length / totalWithResult) * 100)
                : 0;

            // 整體期望值
            const expectancy = this._calculateSimpleExpectancy(this.trades);

            // 最佳區間
            const optimalZone = this.findOptimalZone();

            // 時間統計
            const avgDecisionTime = this._calculateAvgTime(this.trades);

            // 日期範圍
            const timestamps = this.trades.map(t => new Date(t.timestamp));
            const firstTrade = new Date(Math.min(...timestamps));
            const lastTrade = new Date(Math.max(...timestamps));

            return {
                hasData: true,
                totalTrades: this.trades.length,
                wins: wins.length,
                losses: losses.length,
                winRate,
                expectancy,
                optimalZone: optimalZone?.best || null,
                avgDecisionTime,
                dateRange: {
                    first: firstTrade.toISOString(),
                    last: lastTrade.toISOString()
                }
            };
        }

        // =========================================================================
        // PRIVATE HELPERS
        // =========================================================================

        /**
         * 載入交易記錄
         * @private
         * @returns {Array<Object>}
         */
        _loadTrades() {
            try {
                const saved = localStorage.getItem(STORAGE_KEY);
                return saved ? JSON.parse(saved) : [];
            } catch (e) {
                console.error('[PRExpectancy] Failed to load trades:', e);
                return [];
            }
        }

        /**
         * 儲存交易記錄
         * @private
         */
        _saveTrades() {
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(this.trades));
            } catch (e) {
                console.error('[PRExpectancy] Failed to save trades:', e);
            }
        }

        /**
         * 生成唯一 ID
         * @private
         * @returns {string}
         */
        _generateId() {
            return `trade_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        }

        /**
         * 計算平均時間
         * @private
         * @param {Array<Object>} trades
         * @returns {number}
         */
        _calculateAvgTime(trades) {
            const validTrades = trades.filter(t => typeof t.decision_time === 'number');
            if (validTrades.length === 0) return 0;
            const total = validTrades.reduce((sum, t) => sum + t.decision_time, 0);
            return Math.round(total / validTrades.length);
        }

        /**
         * 計算簡單期望值
         * @private
         * @param {Array<Object>} trades
         * @returns {string}
         */
        _calculateSimpleExpectancy(trades) {
            const validTrades = trades.filter(t =>
                t.result !== RESULTS.BREAKEVEN &&
                typeof t.r_multiple === 'number'
            );

            if (validTrades.length < 5) return 'N/A';

            const wins = validTrades.filter(t => t.result === RESULTS.WIN);
            const losses = validTrades.filter(t => t.result === RESULTS.LOSS);

            const winRate = wins.length / validTrades.length;
            const avgWin = wins.length > 0
                ? wins.reduce((sum, t) => sum + Math.abs(t.r_multiple), 0) / wins.length
                : 0;
            const avgLoss = losses.length > 0
                ? losses.reduce((sum, t) => sum + Math.abs(t.r_multiple), 0) / losses.length
                : 0;

            const expectancy = (winRate * avgWin) - ((1 - winRate) * avgLoss);
            return expectancy.toFixed(3);
        }

        /**
         * 取得信心度等級
         * @private
         * @param {number} sampleSize
         * @returns {string}
         */
        _getConfidenceLevel(sampleSize) {
            const thresholds = DEFAULTS.CONFIDENCE_THRESHOLDS;
            if (sampleSize < thresholds.LOW) return 'LOW';
            if (sampleSize < thresholds.MEDIUM) return 'MEDIUM';
            if (sampleSize < thresholds.HIGH) return 'HIGH';
            return 'VERY_HIGH';
        }
    }

    // =============================================================================
    // PUBLIC API
    // =============================================================================

    // 單例實例
    let instance = null;

    return {
        // Classes
        PRExpectancyEngine,

        // Constants
        RESULTS,
        DEFAULTS,

        /**
         * 取得單例實例
         * @returns {PRExpectancyEngine}
         */
        getInstance() {
            if (!instance) {
                instance = new PRExpectancyEngine();
            }
            return instance;
        },

        /**
         * 建立新實例
         * @param {Object} [config] - 配置
         * @returns {PRExpectancyEngine}
         */
        create(config = {}) {
            return new PRExpectancyEngine(config);
        }
    };

})();

// =============================================================================
// USAGE EXAMPLES
// =============================================================================
/*

// 取得單例實例
const engine = PRExpectancy.getInstance();

// 新增交易記錄
engine.addTrade({
    tei: 57,
    template: 'MANCINI_FBD',
    decision_time: 132,
    result: 'WIN',
    entry_type: 'TIMEOUT',
    r_multiple: 0.32
});

// 計算特定 TEI 區間的期望值
const stats = engine.calculateExpectancy([55, 60]);
console.log('期望值:', stats.expectancy);
console.log('勝率:', stats.winRate);

// 取得分箱統計
const bins = engine.getBinStats({ binSize: 5 });
console.log('各區間統計:', bins);

// 找出最佳區間
const optimal = engine.findOptimalZone();
console.log('最佳區間:', optimal.best);

// 按進場類型分析
const entryAnalysis = engine.analyzeByEntryType();
console.log('TIMEOUT 勝率:', entryAnalysis.TIMEOUT.winRate);

// 取得摘要
const summary = engine.getSummary();
console.log('總交易數:', summary.totalTrades);

// 匯出資料
const json = engine.exportData();
console.log(json);

// 匯入資料 (合併模式)
const result = engine.importData(jsonString, { merge: true });
console.log('匯入結果:', result);

*/

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PRExpectancy;
}
