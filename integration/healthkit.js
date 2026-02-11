/**
 * @fileoverview HealthKit Source - Capacitor HealthKit Bridge
 * @description iPhone 上透過 Capacitor HealthKit 插件獲取心率和 HRV 數據。
 * @version 2.0.0
 */

(function (global) {
    'use strict';

    class HealthKitSource {
        constructor() {
            this.plugin = null;
            this._available = false;
        }

        /**
         * 檢查 HealthKit 是否可用
         * @returns {Promise<boolean>}
         */
        async isAvailable() {
            try {
                // 動態載入 Capacitor HealthKit Plugin
                if (typeof Capacitor !== 'undefined' && Capacitor.Plugins && Capacitor.Plugins.HealthKit) {
                    this.plugin = Capacitor.Plugins.HealthKit;
                } else {
                    // 嘗試 ES module import
                    try {
                        const { HealthKit } = await import('@nickardon/capacitor-healthkit');
                        this.plugin = HealthKit;
                    } catch {
                        return false;
                    }
                }

                const { available } = await this.plugin.isAvailable();
                this._available = available;
                return available;
            } catch (e) {
                console.warn('[HealthKit] Not available:', e.message);
                return false;
            }
        }

        /**
         * 請求授權
         * @returns {Promise<void>}
         */
        async requestAuthorization() {
            if (!this.plugin) return;

            await this.plugin.requestAuthorization({
                read: [
                    'HKQuantityTypeIdentifierHeartRate',
                    'HKQuantityTypeIdentifierHeartRateVariabilitySDNN',
                    'HKQuantityTypeIdentifierRestingHeartRate'
                ],
                write: []
            });
        }

        /**
         * 獲取最新的 HR/HRV 數據
         * @returns {Promise<Object|null>} { hr, hrv, confidence, timestamp }
         */
        async getData() {
            if (!this.plugin || !this._available) return null;

            try {
                const now = new Date();
                const hourAgo = new Date(now.getTime() - 3600000);

                const [hrSamples, hrvSamples] = await Promise.all([
                    this._querySamples('HKQuantityTypeIdentifierHeartRate', hourAgo, now),
                    this._querySamples('HKQuantityTypeIdentifierHeartRateVariabilitySDNN', hourAgo, now)
                ]);

                if (hrSamples.length === 0) return null;

                // 取最新樣本
                const latestHR = hrSamples[hrSamples.length - 1];
                const latestHRV = hrvSamples.length > 0 ?
                    hrvSamples[hrvSamples.length - 1] : null;

                return {
                    hr: latestHR.quantity,
                    hrv: latestHRV ? latestHRV.quantity * 1000 : 0, // 轉換為 ms
                    confidence: 0.95, // HealthKit 高信度
                    timestamp: new Date(latestHR.startDate).getTime(),
                    source: 'healthkit'
                };
            } catch (e) {
                console.warn('[HealthKit] getData failed:', e.message);
                return null;
            }
        }

        /**
         * 查詢 HealthKit 樣本
         * @private
         */
        async _querySamples(type, startDate, endDate) {
            try {
                const result = await this.plugin.querySampleType({
                    sampleType: type,
                    startDate: startDate.toISOString(),
                    endDate: endDate.toISOString(),
                    limit: 10
                });
                return result.samples || [];
            } catch {
                return [];
            }
        }
    }

    // ==================== EXPORT ====================

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { HealthKitSource };
    }

    global.TENKI_HEALTHKIT = {
        create: () => new HealthKitSource(),
        HealthKitSource
    };

    console.log('[HEALTHKIT] Module loaded ✓');

})(typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : this);
