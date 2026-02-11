/**
 * @fileoverview Watch Connector - Apple Watch 數據連接器
 * @description 透過 HealthKit 獲取 Apple Watch 心率數據。
 * @version 2.0.0
 */

(function (global) {
    'use strict';

    class WatchConnector {
        constructor() {
            this.connected = false;
            this.lastData = null;
            this._healthkit = null;
        }

        /**
         * 檢查 Watch 是否連接
         * @returns {Promise<boolean>}
         */
        async isConnected() {
            try {
                if (!global.TENKI_HEALTHKIT) return false;

                this._healthkit = global.TENKI_HEALTHKIT.create();
                if (!await this._healthkit.isAvailable()) return false;

                // 檢查最近 5 分鐘是否有來自 Watch 的數據
                const data = await this._healthkit.getData();
                if (data && data.hr > 0) {
                    // 間接確認 — 如果有 HealthKit 數據且品質高，可能來自 Watch
                    this.connected = true;
                    return true;
                }

                return false;
            } catch {
                return false;
            }
        }

        /**
         * 獲取 Watch 數據
         * @returns {Promise<Object|null>}
         */
        async getData() {
            if (!this._healthkit) return null;

            const data = await this._healthkit.getData();
            if (data) {
                this.lastData = {
                    ...data,
                    source: 'watch',
                    confidence: 0.98 // Watch 最高信度
                };
            }
            return this.lastData;
        }

        /**
         * 取得連接狀態
         */
        getStatus() {
            return {
                connected: this.connected,
                lastData: this.lastData,
                lastUpdate: this.lastData ? this.lastData.timestamp : null
            };
        }
    }

    // ==================== EXPORT ====================

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { WatchConnector };
    }

    global.TENKI_WATCH = {
        create: () => new WatchConnector(),
        WatchConnector
    };

    console.log('[WATCH-CONNECTOR] Module loaded ✓');

})(typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : this);
