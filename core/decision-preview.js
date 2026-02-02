/**
 * TENKI PRO - Decision Preview Layer v1.0
 * 
 * 決策預覽層 - 在計時器啟動前顯示歷史統計分析
 * 
 * 設計原則:
 * 1. 只分析，不建議 - 呈現數據讓使用者自行判斷
 * 2. 中性語言 - 不帶情緒或方向性的措辭
 * 3. 純邏輯模組 - 不涉及 DOM 操作
 * 4. 透過 EventBridge 發送結果
 * 
 * @author TENKI Team
 * @version 1.0.0
 */

const DecisionPreview = (function () {
    'use strict';

    // =============================================================================
    // CONSTANTS
    // =============================================================================

    /**
     * 預設配置
     * @constant {Object}
     */
    const DEFAULTS = {
        TEI_RANGE: 5,           // TEI ±5 的範圍
        TIME_RANGE_MINUTES: 30, // 時段 ±30 分鐘
        MAX_SAMPLES: 200,       // 最多取 200 筆樣本
        MIN_SAMPLES: 3,         // 最少需要 3 筆才顯示統計
        CONFIDENCE_THRESHOLDS: {
            LOW: 10,
            MEDIUM: 30,
            HIGH: 50
        }
    };

    // =============================================================================
    // DECISION PREVIEW CLASS
    // =============================================================================

    /**
     * 決策預覽分析器
     */
    class DecisionPreviewEngine {
        /**
         * 建立決策預覽分析器
         * 
         * @param {Object} [config={}] - 配置選項
         * @param {number} [config.teiRange=5] - TEI 範圍
         * @param {number} [config.timeRangeMinutes=30] - 時段範圍 (分鐘)
         * @param {number} [config.maxSamples=200] - 最大樣本數
         */
        constructor(config = {}) {
            this.teiRange = config.teiRange || DEFAULTS.TEI_RANGE;
            this.timeRangeMinutes = config.timeRangeMinutes || DEFAULTS.TIME_RANGE_MINUTES;
            this.maxSamples = config.maxSamples || DEFAULTS.MAX_SAMPLES;
        }

        // =========================================================================
        // CORE ANALYSIS
        // =========================================================================

        /**
         * 分析當前情況的歷史表現
         * 
         * @param {Object} current - 當前狀態
         * @param {number} current.tei - 當前 TEI 值 (1-99)
         * @param {string} current.template - 模板 ID
         * @param {Date|string} [current.time] - 當前時間
         * @param {Array<Object>} historical - 歷史交易記錄
         * @returns {Object} 分析結果
         * 
         * @example
         * const result = preview.analyze({
         *   tei: 57,
         *   template: 'MANCINI_FBD',
         *   time: new Date()
         * }, historicalTrades);
         */
        analyze(current, historical) {
            // 驗證輸入
            if (!current || typeof current.tei !== 'number') {
                return this._createEmptyResult('無效的輸入參數');
            }

            if (!Array.isArray(historical) || historical.length === 0) {
                return this._createEmptyResult('尚無歷史交易資料');
            }

            // 篩選相似記錄
            const similar = this.filterSimilar(current, historical);

            if (similar.length < DEFAULTS.MIN_SAMPLES) {
                return this._createEmptyResult(
                    `相似情況樣本不足 (${similar.length}/${DEFAULTS.MIN_SAMPLES} 筆)`
                );
            }

            // 計算統計
            const stats = this._calculateStatistics(similar, current);

            // 發送預覽事件
            if (typeof EventBridge !== 'undefined') {
                EventBridge.notifyPreviewGenerated(stats);
            }

            return stats;
        }

        /**
         * 篩選相似的歷史記錄
         * 
         * 篩選條件:
         * 1. 相同模板
         * 2. TEI ±5 範圍內
         * 3. 時段 ±30 分鐘內 (可選)
         * 
         * @param {Object} current - 當前狀態
         * @param {Array<Object>} historical - 歷史記錄
         * @returns {Array<Object>} 篩選後的記錄
         */
        filterSimilar(current, historical) {
            const currentTime = current.time ? new Date(current.time) : new Date();
            const currentHour = currentTime.getHours() + currentTime.getMinutes() / 60;

            return historical
                .filter(record => {
                    // 1. 必須有結果
                    if (!record.result) return false;

                    // 2. 相同模板
                    if (record.template !== current.template) return false;

                    // 3. TEI 在範圍內
                    if (Math.abs(record.tei - current.tei) > this.teiRange) return false;

                    // 4. 時段在範圍內 (可選，如果記錄有時間戳)
                    if (record.timestamp) {
                        const recordTime = new Date(record.timestamp);
                        const recordHour = recordTime.getHours() + recordTime.getMinutes() / 60;
                        const hourDiff = Math.abs(currentHour - recordHour);
                        // 處理跨午夜的情況
                        const adjustedDiff = Math.min(hourDiff, 24 - hourDiff);

                        if (adjustedDiff > this.timeRangeMinutes / 60) return false;
                    }

                    return true;
                })
                .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
                .slice(0, this.maxSamples);
        }

        /**
         * 計算統計資料
         * @private
         * @param {Array<Object>} records - 篩選後的記錄
         * @param {Object} current - 當前狀態
         * @returns {Object} 統計結果
         */
        _calculateStatistics(records, current) {
            // 按進場類型分組
            const timeoutRecords = records.filter(r => r.entry_type === 'TIMEOUT');
            const earlyRecords = records.filter(r => r.entry_type === 'EARLY');
            const abortRecords = records.filter(r => r.entry_type === 'ABORT');

            // 計算勝率
            const overallWinRate = this._calculateWinRate(records);
            const timeoutWinRate = this._calculateWinRate(timeoutRecords);
            const earlyWinRate = this._calculateWinRate(earlyRecords);

            // 計算平均決策時間
            const avgDecisionTime = this._calculateAvgTime(records);
            const avgTimeoutTime = this._calculateAvgTime(timeoutRecords);
            const avgEarlyTime = this._calculateAvgTime(earlyRecords);

            // 找出最佳行為模式
            const bestBehavior = this._findBestBehavior(timeoutRecords, earlyRecords);

            // 計算期望值 (如果有 R 值)
            const expectancy = this._calculateExpectancy(records);

            // 信心度評估
            const confidence = this._getConfidence(records.length);

            return {
                hasData: true,
                sampleSize: records.length,
                teiRange: `${current.tei - this.teiRange} - ${current.tei + this.teiRange}`,
                template: current.template,

                // 整體統計
                overallWinRate,
                avgDecisionTime,

                // 按進場類型
                timeoutStats: {
                    count: timeoutRecords.length,
                    winRate: timeoutWinRate,
                    avgTime: avgTimeoutTime
                },
                earlyStats: {
                    count: earlyRecords.length,
                    winRate: earlyWinRate,
                    avgTime: avgEarlyTime
                },
                abortCount: abortRecords.length,

                // 分析結果
                bestBehavior,
                expectancy,
                confidence,

                // 用於 UI 顯示的中性訊息
                insights: this._generateInsights(overallWinRate, timeoutWinRate, earlyWinRate, avgDecisionTime)
            };
        }

        /**
         * 計算勝率
         * @private
         * @param {Array<Object>} records - 記錄
         * @returns {number} 勝率百分比 (0-100)
         */
        _calculateWinRate(records) {
            if (records.length === 0) return 0;
            const wins = records.filter(r => r.result === 'WIN').length;
            return Math.round((wins / records.length) * 100);
        }

        /**
         * 計算平均決策時間
         * @private
         * @param {Array<Object>} records - 記錄
         * @returns {number} 平均秒數
         */
        _calculateAvgTime(records) {
            if (records.length === 0) return 0;
            const validRecords = records.filter(r => typeof r.decision_time === 'number');
            if (validRecords.length === 0) return 0;

            const total = validRecords.reduce((sum, r) => sum + r.decision_time, 0);
            return Math.round(total / validRecords.length);
        }

        /**
         * 找出最佳行為模式
         * @private
         * @param {Array<Object>} timeoutRecords - 超時記錄
         * @param {Array<Object>} earlyRecords - 提前記錄
         * @returns {Object} 最佳行為
         */
        _findBestBehavior(timeoutRecords, earlyRecords) {
            const timeoutWR = this._calculateWinRate(timeoutRecords);
            const earlyWR = this._calculateWinRate(earlyRecords);

            // 需要足夠的樣本才能比較
            if (timeoutRecords.length < 3 && earlyRecords.length < 3) {
                return {
                    type: 'INSUFFICIENT_DATA',
                    description: '樣本不足以判斷',
                    winRateDiff: 0
                };
            }

            const avgTimeoutTime = this._calculateAvgTime(timeoutRecords);
            const avgEarlyTime = this._calculateAvgTime(earlyRecords);

            if (timeoutWR > earlyWR) {
                const waitMinutes = Math.round(avgTimeoutTime / 60);
                return {
                    type: 'PATIENCE',
                    description: `等待 ≥ ${waitMinutes} 分鐘`,
                    winRate: timeoutWR,
                    winRateDiff: timeoutWR - earlyWR,
                    avgTime: avgTimeoutTime
                };
            } else if (earlyWR > timeoutWR) {
                return {
                    type: 'EARLY_ENTRY',
                    description: '提前進場有效',
                    winRate: earlyWR,
                    winRateDiff: earlyWR - timeoutWR,
                    avgTime: avgEarlyTime
                };
            } else {
                return {
                    type: 'NEUTRAL',
                    description: '無顯著差異',
                    winRate: timeoutWR,
                    winRateDiff: 0
                };
            }
        }

        /**
         * 計算期望值
         * @private
         * @param {Array<Object>} records - 記錄
         * @returns {Object|null} 期望值資訊
         */
        _calculateExpectancy(records) {
            // 過濾有 R 值的記錄
            const recordsWithR = records.filter(r => typeof r.r_multiple === 'number');

            if (recordsWithR.length < 5) {
                return null;
            }

            const wins = recordsWithR.filter(r => r.result === 'WIN');
            const losses = recordsWithR.filter(r => r.result === 'LOSS');

            if (wins.length === 0 || losses.length === 0) {
                return null;
            }

            const winRate = wins.length / recordsWithR.length;
            const avgWin = wins.reduce((sum, r) => sum + r.r_multiple, 0) / wins.length;
            const avgLoss = Math.abs(
                losses.reduce((sum, r) => sum + r.r_multiple, 0) / losses.length
            );

            const expectancy = (winRate * avgWin) - ((1 - winRate) * avgLoss);

            return {
                value: expectancy.toFixed(3),
                isPositive: expectancy > 0,
                avgWin: avgWin.toFixed(2),
                avgLoss: avgLoss.toFixed(2),
                sampleSize: recordsWithR.length
            };
        }

        /**
         * 評估信心度
         * @private
         * @param {number} sampleSize - 樣本數
         * @returns {Object} 信心度資訊
         */
        _getConfidence(sampleSize) {
            const thresholds = DEFAULTS.CONFIDENCE_THRESHOLDS;

            if (sampleSize < thresholds.LOW) {
                return { level: 'LOW', label: '低', percentage: 25 };
            } else if (sampleSize < thresholds.MEDIUM) {
                return { level: 'MEDIUM', label: '中', percentage: 50 };
            } else if (sampleSize < thresholds.HIGH) {
                return { level: 'HIGH', label: '高', percentage: 75 };
            } else {
                return { level: 'VERY_HIGH', label: '非常高', percentage: 95 };
            }
        }

        /**
         * 生成中性洞察訊息
         * @private
         * @returns {Array<string>} 洞察訊息列表
         */
        _generateInsights(overallWinRate, timeoutWinRate, earlyWinRate, avgDecisionTime) {
            const insights = [];

            // 中性語言，只陳述事實
            insights.push(`整體勝率: ${overallWinRate}%`);

            if (timeoutWinRate > 0) {
                insights.push(`耐心等待勝率: ${timeoutWinRate}%`);
            }

            if (earlyWinRate > 0) {
                insights.push(`提前進場勝率: ${earlyWinRate}%`);
            }

            if (avgDecisionTime > 0) {
                const minutes = Math.floor(avgDecisionTime / 60);
                const seconds = avgDecisionTime % 60;
                insights.push(`平均決策時間: ${minutes}分${seconds}秒`);
            }

            return insights;
        }

        /**
         * 建立空結果
         * @private
         * @param {string} message - 訊息
         * @returns {Object}
         */
        _createEmptyResult(message) {
            return {
                hasData: false,
                message,
                sampleSize: 0
            };
        }

        // =========================================================================
        // HTML GENERATION
        // =========================================================================

        /**
         * 生成預覽面板 HTML
         * 
         * 注意: 這只是生成 HTML 字串，不直接操作 DOM
         * 調用者負責將 HTML 插入適當的容器
         * 
         * @param {Object} stats - 分析結果
         * @param {Object} [options={}] - 選項
         * @returns {string} HTML 字串
         */
        generateHTML(stats, options = {}) {
            if (!stats.hasData) {
                return `
                    <div class="overlay-preview-panel overlay-panel-empty">
                        <p class="overlay-preview-message">${this._escapeHTML(stats.message)}</p>
                    </div>
                `;
            }

            const timeoutSection = stats.timeoutStats.count > 0 ? `
                <div class="overlay-preview-stat">
                    <span class="overlay-preview-label">耐心等待勝率:</span>
                    <span class="overlay-preview-value">${stats.timeoutStats.winRate}%</span>
                    <span class="overlay-preview-count">(${stats.timeoutStats.count} 筆)</span>
                </div>
            ` : '';

            const earlySection = stats.earlyStats.count > 0 ? `
                <div class="overlay-preview-stat">
                    <span class="overlay-preview-label">提前進場勝率:</span>
                    <span class="overlay-preview-value">${stats.earlyStats.winRate}%</span>
                    <span class="overlay-preview-count">(${stats.earlyStats.count} 筆)</span>
                </div>
            ` : '';

            const expectancySection = stats.expectancy ? `
                <div class="overlay-preview-expectancy">
                    <span class="overlay-preview-label">期望值:</span>
                    <span class="overlay-preview-value ${stats.expectancy.isPositive ? 'positive' : 'negative'}">
                        ${stats.expectancy.value}R
                    </span>
                </div>
            ` : '';

            return `
                <div class="overlay-preview-panel">
                    <div class="overlay-preview-header">
                        <h3 class="overlay-preview-title">Decision Preview</h3>
                        <span class="overlay-preview-template">${this._escapeHTML(stats.template)}</span>
                    </div>

                    <div class="overlay-preview-tei">
                        <span class="overlay-preview-label">TEI 區間:</span>
                        <span class="overlay-preview-value">${stats.teiRange}</span>
                    </div>

                    <div class="overlay-preview-stats">
                        <div class="overlay-preview-stat overlay-preview-overall">
                            <span class="overlay-preview-label">整體勝率:</span>
                            <span class="overlay-preview-value">${stats.overallWinRate}%</span>
                        </div>
                        ${timeoutSection}
                        ${earlySection}
                    </div>

                    ${expectancySection}

                    <div class="overlay-preview-behavior">
                        <span class="overlay-preview-label">歷史最佳行為:</span>
                        <span class="overlay-preview-value">→ ${this._escapeHTML(stats.bestBehavior.description)}</span>
                    </div>

                    <div class="overlay-preview-footer">
                        <span class="overlay-preview-sample">
                            基於 ${stats.sampleSize} 筆相似交易
                        </span>
                        <span class="overlay-preview-confidence" data-level="${stats.confidence.level}">
                            信心度: ${stats.confidence.label}
                        </span>
                    </div>
                </div>
            `;
        }

        /**
         * HTML 轉義
         * @private
         * @param {string} str - 要轉義的字串
         * @returns {string}
         */
        _escapeHTML(str) {
            if (!str) return '';
            const div = document.createElement('div');
            div.textContent = str;
            return div.innerHTML;
        }

        // =========================================================================
        // STATIC HELPERS
        // =========================================================================

        /**
         * 快速分析 (靜態方法)
         * 
         * @param {Object} current - 當前狀態
         * @param {Array<Object>} historical - 歷史記錄
         * @returns {Object} 分析結果
         */
        static quickAnalyze(current, historical) {
            const preview = new DecisionPreviewEngine();
            return preview.analyze(current, historical);
        }
    }

    // =============================================================================
    // PUBLIC API
    // =============================================================================

    return {
        // Classes
        DecisionPreviewEngine,

        // Constants
        DEFAULTS,

        /**
         * 建立新的預覽分析器實例
         * @param {Object} [config] - 配置
         * @returns {DecisionPreviewEngine}
         */
        create(config = {}) {
            return new DecisionPreviewEngine(config);
        },

        /**
         * 快速分析
         */
        analyze: DecisionPreviewEngine.quickAnalyze
    };

})();

// =============================================================================
// USAGE EXAMPLES
// =============================================================================
/*

// 建立預覽分析器
const preview = DecisionPreview.create();

// 準備當前狀態
const current = {
    tei: 57,
    template: 'MANCINI_FBD',
    time: new Date()
};

// 取得歷史記錄 (從 TenkiDatabase)
const historical = await TenkiDatabase.getAll('trades');

// 分析
const result = preview.analyze(current, historical);

if (result.hasData) {
    console.log('勝率:', result.overallWinRate);
    console.log('最佳行為:', result.bestBehavior.description);
    console.log('樣本數:', result.sampleSize);
    
    // 生成 HTML
    const html = preview.generateHTML(result);
    document.getElementById('preview-container').innerHTML = html;
} else {
    console.log('無數據:', result.message);
}

// 或使用快速分析
const quickResult = DecisionPreview.analyze(current, historical);

*/

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DecisionPreview;
}
