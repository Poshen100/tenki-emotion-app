/**
 * @fileoverview Decision Preview - 決策前的歷史統計分析
 * @description 在計時器啟動前，顯示類似情況的歷史表現統計。保持中性語言，只分析不建議。
 * @version 1.0.0
 */

(function (global) {
    'use strict';

    class DecisionPreview {
        constructor() {
            this.prExpectancy = null; // 可注入 PRExpectancyEngine
        }

        /**
         * 設定資料來源
         * @param {PRExpectancyEngine} prExpectancy - 期望值引擎實例
         */
        setDataSource(prExpectancy) {
            this.prExpectancy = prExpectancy;
        }

        /**
         * 分析當前情況的歷史表現
         * @param {Object} current - 當前狀態 { tei, template, time }
         * @param {Array} [historical] - 歷史記錄陣列 (若未提供則從 prExpectancy 取得)
         * @returns {Object} 統計結果
         */
        analyze(current, historical) {
            // 若無歷史資料，嘗試從 prExpectancy 取得
            if (!historical && this.prExpectancy) {
                historical = this.prExpectancy.trades || [];
            }
            if (!historical || !Array.isArray(historical)) {
                historical = [];
            }

            // 篩選相似記錄
            const similar = this.filterSimilar(current, historical);

            if (similar.length < 5) {
                return {
                    hasData: false,
                    message: '尚無足夠歷史資料 (需 ≥5 筆)',
                    sampleSize: similar.length
                };
            }

            // 計算統計
            const timeoutRecords = similar.filter(r => r.entry_type === 'TIMEOUT');
            const earlyRecords = similar.filter(r => r.entry_type === 'EARLY');

            return {
                hasData: true,
                sampleSize: similar.length,
                timeoutWinRate: this.calculateWinRate(timeoutRecords),
                earlyWinRate: this.calculateWinRate(earlyRecords),
                avgDecisionTime: this.calculateAvgTime(similar),
                bestBehavior: this.findBestBehavior(similar),
                teiRange: `${Math.max(1, current.tei - 5)} - ${Math.min(99, current.tei + 5)}`,
                timeoutCount: timeoutRecords.length,
                earlyCount: earlyRecords.length
            };
        }

        /**
         * 篩選相似的歷史記錄
         * @param {Object} current - 當前狀態
         * @param {Array} historical - 歷史記錄
         * @returns {Array} 相似記錄
         */
        filterSimilar(current, historical) {
            return historical.filter(record => {
                // 1. 相同模板
                if (record.template !== current.template) return false;
                // 2. TEI ±5 範圍
                if (Math.abs(record.tei - current.tei) > 5) return false;
                // 3. 時段 ±30 分鐘 (可選)
                if (current.time) {
                    try {
                        const currentHour = new Date(current.time).getHours() + new Date(current.time).getMinutes() / 60;
                        const recordHour = new Date(record.timestamp).getHours() + new Date(record.timestamp).getMinutes() / 60;
                        if (Math.abs(currentHour - recordHour) > 0.5) return false;
                    } catch (e) { /* 忽略時間比對錯誤 */ }
                }
                return true;
            }).slice(0, 200); // 最多 200 筆
        }

        /**
         * 計算勝率
         * @param {Array} records - 記錄陣列
         * @returns {number} 勝率百分比
         */
        calculateWinRate(records) {
            if (!records || records.length === 0) return 0;
            const wins = records.filter(r => r.result === 'WIN').length;
            return Math.round((wins / records.length) * 100);
        }

        /**
         * 計算平均決策時間
         * @param {Array} records - 記錄陣列
         * @returns {number} 平均秒數
         */
        calculateAvgTime(records) {
            if (!records || records.length === 0) return 0;
            const total = records.reduce((sum, r) => sum + (r.decision_time || 0), 0);
            return Math.round(total / records.length);
        }

        /**
         * 找出最佳行為模式 (中性描述)
         * @param {Array} records - 記錄陣列
         * @returns {string} 行為描述
         */
        findBestBehavior(records) {
            const timeout = records.filter(r => r.entry_type === 'TIMEOUT');
            const early = records.filter(r => r.entry_type === 'EARLY');

            const timeoutWR = this.calculateWinRate(timeout);
            const earlyWR = this.calculateWinRate(early);

            // 中性語言：只陳述事實，不給建議
            if (timeout.length === 0 && early.length === 0) {
                return '無足夠資料';
            }
            if (timeoutWR > earlyWR && timeout.length >= 3) {
                return `Wait ≥ ${Math.round(this.calculateAvgTime(timeout) / 60)} min`;
            } else if (earlyWR > timeoutWR && early.length >= 3) {
                return `Early entry pattern`;
            }
            return `Mixed pattern`;
        }

        /**
         * 生成 HTML (可插入 DOM)
         * @param {Object} stats - 統計結果
         * @param {Object} [options] - 選項
         * @returns {string} HTML 字串
         */
        generateHTML(stats, options = {}) {
            const template = options.template || 'Unknown';
            const tei = options.tei || 'N/A';

            if (!stats.hasData) {
                return `
          <div class="overlay-preview-panel">
            <h3>Decision Preview</h3>
            <p class="overlay-preview-message">${stats.message}</p>
            <p class="overlay-preview-sample">Sample: ${stats.sampleSize || 0}</p>
          </div>
        `;
            }

            return `
        <div class="overlay-preview-panel">
          <h3>Decision Preview</h3>
          <p class="overlay-preview-template">Template: ${template}</p>
          <p class="overlay-preview-tei">Current TEI: ${tei}</p>
          <div class="overlay-preview-tei-bar">
            <div class="overlay-preview-tei-fill" style="width: ${tei}%"></div>
          </div>
          <p class="overlay-preview-range">TEI Range: ${stats.teiRange}</p>
          <div class="overlay-preview-stats">
            <div class="overlay-preview-stat">
              <span class="overlay-preview-label">Timeout win-rate:</span>
              <span class="overlay-preview-value">${stats.timeoutWinRate}%</span>
              <span class="overlay-preview-count">(${stats.timeoutCount})</span>
            </div>
            <div class="overlay-preview-stat">
              <span class="overlay-preview-label">Early entry win:</span>
              <span class="overlay-preview-value">${stats.earlyWinRate}%</span>
              <span class="overlay-preview-count">(${stats.earlyCount})</span>
            </div>
          </div>
          <div class="overlay-preview-best">
            <span>Best you usually did:</span>
            <strong>→ ${stats.bestBehavior}</strong>
          </div>
          <p class="overlay-preview-sample">(Based on ${stats.sampleSize} similar trades)</p>
        </div>
      `;
        }
    }

    global.DecisionPreview = DecisionPreview;

})(typeof window !== 'undefined' ? window : this);
