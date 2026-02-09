/**
 * @fileoverview TENKI PRO System - 系統載入器
 * @description 整合所有 TENKI PRO 模組的主進入點。
 * @version 1.0.0
 */

(function (global) {
    'use strict';

    /**
     * TENKI PRO 系統主類別
     */
    class TenkiPro {
        constructor() {
            this.timer = null;
            this.preview = null;
            this.expectancy = null;
            this.aiBehavior = null;
            this._initialized = false;
        }

        /**
         * 初始化所有模組
         * @param {Object} [options] - 設定選項
         * @returns {TenkiPro} 自身實例 (支援鏈式呼叫)
         */
        init(options = {}) {
            if (this._initialized) {
                console.warn('[TenkiPro] Already initialized');
                return this;
            }

            // 初始化 EventBridge
            if (global.EventBridge) {
                global.EventBridge.init({ debug: options.debug || false });
            }

            // 初始化 Decision Timer
            if (global.DecisionTimer) {
                this.timer = new global.DecisionTimer({
                    autoSave: true,
                    debug: options.debug || false
                });
            }

            // 初始化 PR Expectancy Engine
            if (global.PRExpectancyEngine) {
                this.expectancy = new global.PRExpectancyEngine();
            }

            // 初始化 Decision Preview
            if (global.DecisionPreview) {
                this.preview = new global.DecisionPreview();
                if (this.expectancy) {
                    this.preview.setDataSource(this.expectancy);
                }
            }

            // 初始化 AI Behavior
            if (global.AIBehavior) {
                this.aiBehavior = new global.AIBehavior();
            }

            this._initialized = true;
            console.log('[TenkiPro] System initialized');

            return this;
        }

        /**
         * 開始交易決策流程
         * @param {string} template - 模板名稱
         * @param {number} tei - 當前 TEI
         * @returns {Object} 預覽統計
         */
        startDecision(template, tei) {
            if (!this._initialized) this.init();

            // 1. 分析歷史資料
            let stats = null;
            if (this.preview && this.expectancy) {
                stats = this.preview.analyze({ template, tei, time: new Date() }, this.expectancy.trades);
            }

            // 2. 進入預覽模式
            if (this.timer) {
                this.timer.preview(template, tei);
            }

            return stats;
        }

        /**
         * 確認啟動計時器
         */
        confirmStart() {
            if (this.timer && this.timer.getState() === 'PREVIEW') {
                return this.timer.start();
            }
            return false;
        }

        /**
         * 完成決策
         * @param {string} result - 結果 (WIN/LOSS)
         * @param {number} [rMultiple] - R 倍數
         */
        completeDecision(result, rMultiple = 0) {
            if (!this.timer) return null;

            const timerResult = this.timer.complete();
            if (!timerResult) return null;

            // 記錄交易
            if (this.expectancy) {
                this.expectancy.addTrade({
                    tei: timerResult.tei,
                    template: timerResult.template,
                    decision_time: timerResult.elapsed,
                    result: result,
                    entry_type: timerResult.entryType,
                    r_multiple: rMultiple
                });
            }

            return timerResult;
        }

        /**
         * 取得 AI 洞察
         * @returns {Array<string>} 洞察陣列
         */
        getInsights() {
            if (!this.aiBehavior || !this.expectancy) return [];

            const trades = this.expectancy.trades;
            if (trades.length < 10) return ['尚無足夠資料產生洞察'];

            // 取得最近的交易模式
            const recentTrades = trades.slice(-50);
            const clusterResult = this.aiBehavior.cluster(recentTrades, 3);

            if (clusterResult.error) return [clusterResult.error];

            // 生成洞察
            const insights = [];
            clusterResult.clusterStats.forEach((stat, i) => {
                insights.push(
                    `群組 ${i + 1}: ${stat.count} 筆交易, 平均 TEI ${stat.avgTEI}, 勝率 ${stat.winRate}%`
                );
            });

            return insights;
        }

        /**
         * 匯出所有資料
         */
        exportData() {
            if (this.expectancy) {
                return this.expectancy.exportData();
            }
            return '{}';
        }

        /**
         * 匯入資料
         */
        importData(jsonString) {
            if (this.expectancy) {
                return this.expectancy.importData(jsonString);
            }
            return false;
        }
    }

    // 建立全域單例
    global.TenkiPro = TenkiPro;
    global.TENKI = new TenkiPro();

    // DOM 載入後自動初始化
    if (typeof document !== 'undefined') {
        document.addEventListener('DOMContentLoaded', () => {
            global.TENKI.init();
        });
    }

})(typeof window !== 'undefined' ? window : this);


/*
========== 使用範例 ==========

// 1. 開始決策流程
const stats = TENKI.startDecision('MANCINI_FBD', 57);
console.log('Preview stats:', stats);

// 2. 確認啟動計時器
TENKI.confirmStart();

// 3. 監聽計時器進度
TENKI.timer.onProgress((data) => {
  console.log(`${data.remaining}s remaining - ${data.segment.label}`);
});

// 4. 計時器超時/完成後記錄結果
TENKI.timer.onTimeout((result) => {
  // 等待使用者輸入結果
  // TENKI.completeDecision('WIN', 0.5);
});

// 5. 取得 AI 洞察
const insights = TENKI.getInsights();
console.log('Insights:', insights);

// 6. 匯出資料
const backup = TENKI.exportData();
console.log('Backup:', backup);
*/
