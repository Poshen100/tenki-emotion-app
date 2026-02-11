/**
 * @fileoverview Trade Logger - TEI 增強交易記錄器
 * @description 記錄交易時自動關聯 TEI 狀態和生理指標。
 * @version 2.0.0
 */

(function (global) {
    'use strict';

    class TradeLogger {
        /**
         * @param {Object} options
         * @param {Object} [options.storage] - 儲存介面
         * @param {Object} [options.teiEngine] - TEI 引擎實例
         */
        constructor(options = {}) {
            this.storage = options.storage || null;
            this.teiEngine = options.teiEngine || null;
            this._trades = [];

            // 嘗試從 localStorage 載入歷史數據
            this._loadFromLocalStorage();
        }

        /**
         * 記錄一筆交易
         * @param {Object} trade
         * @param {string} trade.symbol - 交易標的
         * @param {string} trade.direction - 'long' | 'short'
         * @param {string} trade.outcome - 'win' | 'loss'
         * @param {number} trade.pnl - 損益
         * @param {number} [trade.r_multiple] - R 倍數
         * @param {string} [trade.template] - 使用的模板
         * @param {string} [trade.notes] - 備註
         * @returns {Object} 增強後的交易記錄
         */
        logTrade(trade) {
            // 獲取當前掃描狀態
            const scanState = this._getCurrentScanState();

            const enrichedTrade = {
                id: this._generateId(),
                timestamp: new Date().toISOString(),

                // TEI 狀態
                teiScore: scanState.tei || 0,
                teiGrade: this._getGrade(scanState.tei || 0),
                confidence: scanState.confidence || 0,

                // 生理指標
                hr: scanState.hr || 0,
                hrv: scanState.hrv || 0,

                // 交易資訊
                symbol: trade.symbol || 'UNKNOWN',
                direction: trade.direction || 'unknown',
                outcome: trade.outcome || 'unknown',
                result: (trade.outcome || '').toUpperCase(),
                pnl: trade.pnl || 0,
                r_multiple: trade.r_multiple || 0,
                template: trade.template || '',
                notes: trade.notes || '',

                // 情境
                timeOfDay: new Date().getHours(),
                dayOfWeek: new Date().getDay(),
                entry_type: trade.entry_type || 'MANUAL'
            };

            this._trades.push(enrichedTrade);
            this._saveToLocalStorage();

            // 儲存到 storage (如果有)
            if (this.storage && typeof this.storage.save === 'function') {
                this.storage.save('trades', enrichedTrade).catch(e =>
                    console.warn('[TradeLogger] Storage save failed:', e)
                );
            }

            // 通知 EventBridge
            if (global.EventBridge && typeof global.EventBridge.notifyTradeRecorded === 'function') {
                global.EventBridge.notifyTradeRecorded(enrichedTrade);
            }

            return enrichedTrade;
        }

        /**
         * 取得所有交易
         * @param {Date} [startDate] - 起始日期
         * @param {Date} [endDate] - 結束日期
         * @returns {Array}
         */
        getTrades(startDate, endDate) {
            let filtered = [...this._trades];

            if (startDate) {
                const start = new Date(startDate).getTime();
                filtered = filtered.filter(t => new Date(t.timestamp).getTime() >= start);
            }

            if (endDate) {
                const end = new Date(endDate).getTime();
                filtered = filtered.filter(t => new Date(t.timestamp).getTime() <= end);
            }

            return filtered;
        }

        /**
         * 取得統計摘要
         * @returns {Object}
         */
        getSummary() {
            const trades = this._trades;
            if (trades.length === 0) return { totalTrades: 0 };

            const wins = trades.filter(t => t.outcome === 'win' || t.result === 'WIN');
            const losses = trades.filter(t => t.outcome === 'loss' || t.result === 'LOSS');

            return {
                totalTrades: trades.length,
                wins: wins.length,
                losses: losses.length,
                winRate: Math.round((wins.length / trades.length) * 100),
                totalPnL: trades.reduce((sum, t) => sum + (t.pnl || 0), 0),
                avgTEI: Math.round(trades.reduce((sum, t) => sum + (t.teiScore || 0), 0) / trades.length)
            };
        }

        /**
         * 匯出資料
         * @returns {string} JSON
         */
        exportData() {
            return JSON.stringify(this._trades, null, 2);
        }

        /**
         * 匯入資料
         * @param {string} jsonString
         * @returns {boolean}
         */
        importData(jsonString) {
            try {
                const data = JSON.parse(jsonString);
                if (!Array.isArray(data)) return false;
                this._trades = data;
                this._saveToLocalStorage();
                return true;
            } catch {
                return false;
            }
        }

        // ==================== Private ====================

        _getCurrentScanState() {
            // 嘗試從各種來源取得當前 TEI 狀態
            if (this.teiEngine && this.teiEngine.lastResult) {
                return {
                    tei: this.teiEngine.lastResult.score,
                    confidence: this.teiEngine.lastResult.confidence,
                    hr: this.teiEngine.lastResult.components?.avgHR || 0,
                    hrv: this.teiEngine.lastResult.components?.avgHRV || 0
                };
            }

            if (global.TENKI_SENSOR_FUSION) {
                const fusion = global.TENKI_SENSOR_FUSION.create();
                const last = fusion.getLastResult();
                if (last) {
                    return { tei: 0, confidence: last.confidence, hr: last.hr, hrv: last.hrv };
                }
            }

            return { tei: 0, confidence: 0, hr: 0, hrv: 0 };
        }

        _getGrade(tei) {
            if (tei >= 80) return 'PEAK';
            if (tei >= 55) return 'OPTIMAL';
            if (tei >= 35) return 'NEUTRAL';
            return 'DEGRADED';
        }

        _generateId() {
            return `trade_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        }

        _loadFromLocalStorage() {
            try {
                const saved = localStorage.getItem('tenki_trades');
                if (saved) this._trades = JSON.parse(saved);
            } catch (e) {
                console.warn('[TradeLogger] Load error:', e);
            }
        }

        _saveToLocalStorage() {
            try {
                localStorage.setItem('tenki_trades', JSON.stringify(this._trades));
            } catch (e) {
                console.warn('[TradeLogger] Save error:', e);
            }
        }
    }

    // ==================== EXPORT ====================

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { TradeLogger };
    }

    global.TENKI_TRADE_LOGGER = {
        create: (options) => new TradeLogger(options),
        TradeLogger
    };

    console.log('[TRADE-LOGGER] Module loaded ✓');

})(typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : this);
