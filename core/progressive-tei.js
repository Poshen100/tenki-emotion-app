/**
 * @fileoverview Progressive TEI Engine - 漸進式精度優化系統
 * @description 在 2 秒內給出初步 TEI，60 秒內達到 95% 信心度。
 *              使用 Bootstrap 方法計算誤差範圍。
 * @version 2.0.0
 */

(function (global) {
    'use strict';

    // ==================== PROGRESSIVE TEI CLASS ====================

    class ProgressiveTEI {
        /**
         * @param {Object} options
         * @param {number} [options.baselineHR=70] - 基線心率 (可由校準覆蓋)
         * @param {number} [options.bootstrapSamples=1000] - Bootstrap 重複次數
         */
        constructor(options = {}) {
            this.validDataPoints = [];
            this.baselineHR = options.baselineHR || 70;
            this.bootstrapSamples = options.bootstrapSamples || 1000;

            this.milestones = {
                quick:    { count: 4,  confidence: 0.40, time: '2s'  },
                standard: { count: 15, confidence: 0.70, time: '15s' },
                precise:  { count: 30, confidence: 0.85, time: '30s' },
                ultra:    { count: 60, confidence: 0.95, time: '60s' }
            };

            this.lastResult = null;
            this._startTime = null;
        }

        /**
         * 處理新的心率數據
         * @param {Object} sample - { hr: number, hrv: number, timestamp?: number }
         * @param {number} signalQuality - 0-1 信號品質
         * @returns {Object|null} TEI result or null if no milestone hit
         */
        onNewData(sample, signalQuality) {
            // 1. 驗證數據有效性
            if (!this.isValid(sample, signalQuality)) {
                return null;
            }

            // 記錄開始時間
            if (!this._startTime) {
                this._startTime = Date.now();
            }

            // 2. 加入緩衝區
            this.validDataPoints.push({
                hr: sample.hr,
                hrv: sample.hrv,
                quality: signalQuality,
                timestamp: sample.timestamp || Date.now()
            });

            // 3. 檢查是否達到里程碑
            const count = this.validDataPoints.length;

            if (count === this.milestones.quick.count) {
                return this._emitResult('quick');
            } else if (count === this.milestones.standard.count) {
                return this._emitResult('standard');
            } else if (count === this.milestones.precise.count) {
                return this._emitResult('precise');
            } else if (count === this.milestones.ultra.count) {
                return this._emitResult('ultra');
            }

            return null;
        }

        /**
         * 計算並發送 TEI 結果
         * @private
         */
        _emitResult(level) {
            const result = this.calculateTEI(level);
            this.lastResult = result;

            // 通知 EventBridge (如果存在)
            if (global.EventBridge && typeof global.EventBridge.notifyTEIUpdate === 'function') {
                global.EventBridge.notifyTEIUpdate(result.score, 'progressive-tei');
            }

            return result;
        }

        /**
         * 計算 TEI 分數
         * @param {string} level - 'quick'|'standard'|'precise'|'ultra'
         * @returns {Object} TEI result
         */
        calculateTEI(level) {
            const milestone = this.milestones[level];
            const data = this.validDataPoints.slice(0, milestone.count);
            const count = data.length;

            // 1. 計算 HR 基線偏差
            const avgHR = this.mean(data.map(d => d.hr));
            const hrDeviation = Math.abs(avgHR - this.baselineHR) / this.baselineHR;

            // 2. 計算 HRV 分數
            const avgHRV = this.mean(data.map(d => d.hrv));
            const hrvScore = this.normalizeHRV(avgHRV);

            // 3. 計算 SNR (信號品質)
            const snr = this.calculateSNR(data.map(d => d.hr));
            const normalizedSNR = Math.min(1, Math.max(0, snr / 30)); // SNR 歸一化

            // 4. 加權計算 TEI
            const rawTEI = (
                hrvScore * 0.4 +
                Math.max(0, 1 - hrDeviation) * 0.3 +
                normalizedSNR * 0.3
            ) * 100;

            const tei = Math.max(1, Math.min(99, Math.round(rawTEI)));

            // 5. 計算誤差範圍 (Bootstrap 方法)
            const errorMargin = this.estimateError(data, milestone.confidence);

            return {
                score: tei,
                confidence: milestone.confidence,
                errorMargin: Math.round(errorMargin * 10) / 10,
                range: [
                    Math.max(1, Math.round(tei - errorMargin)),
                    Math.min(99, Math.round(tei + errorMargin))
                ],
                dataPoints: count,
                level: level,
                elapsedMs: Date.now() - (this._startTime || Date.now()),
                timestamp: Date.now(),
                components: {
                    hrvScore: Math.round(hrvScore * 100) / 100,
                    hrDeviation: Math.round(hrDeviation * 100) / 100,
                    snr: Math.round(normalizedSNR * 100) / 100,
                    avgHR: Math.round(avgHR * 10) / 10,
                    avgHRV: Math.round(avgHRV * 10) / 10
                }
            };
        }

        /**
         * Bootstrap 誤差估計
         * @param {Array} data - 有效數據點
         * @param {number} confidence - 信心水平 (0-1)
         * @returns {number} 誤差範圍
         */
        estimateError(data, confidence) {
            if (data.length < 2) return 25; // 數據太少，高不確定性

            const teiSamples = [];

            for (let i = 0; i < this.bootstrapSamples; i++) {
                const resample = this._resample(data);
                const tei = this._quickTEI(resample);
                teiSamples.push(tei);
            }

            teiSamples.sort((a, b) => a - b);

            const lowerIdx = Math.floor(this.bootstrapSamples * (1 - confidence) / 2);
            const upperIdx = Math.floor(this.bootstrapSamples * (1 + confidence) / 2);

            const safeUpper = Math.min(upperIdx, teiSamples.length - 1);
            const safeLower = Math.max(lowerIdx, 0);

            return (teiSamples[safeUpper] - teiSamples[safeLower]) / 2;
        }

        /**
         * 數據有效性檢查
         * @param {Object} sample - { hr, hrv }
         * @param {number} quality - 信號品質 0-1
         * @returns {boolean}
         */
        isValid(sample, quality) {
            return (
                sample != null &&
                typeof sample.hr === 'number' &&
                typeof sample.hrv === 'number' &&
                sample.hr >= 40 && sample.hr <= 180 &&
                sample.hrv > 0 &&
                quality >= 0.6 &&
                !isNaN(sample.hr) &&
                !isNaN(sample.hrv)
            );
        }

        /**
         * 重置引擎，清空所有數據
         */
        reset() {
            this.validDataPoints = [];
            this.lastResult = null;
            this._startTime = null;
        }

        /**
         * 設定基線心率 (從校準獲得)
         * @param {number} hr - 基線心率
         */
        setBaselineHR(hr) {
            if (hr >= 40 && hr <= 120) {
                this.baselineHR = hr;
            }
        }

        /**
         * 取得目前進度資訊
         * @returns {Object}
         */
        getProgress() {
            const count = this.validDataPoints.length;
            let currentLevel = 'collecting';
            let nextMilestone = this.milestones.quick.count;
            let currentConfidence = 0;

            if (count >= 60) {
                currentLevel = 'ultra';
                nextMilestone = 60;
                currentConfidence = 0.95;
            } else if (count >= 30) {
                currentLevel = 'precise';
                nextMilestone = 60;
                currentConfidence = 0.85;
            } else if (count >= 15) {
                currentLevel = 'standard';
                nextMilestone = 30;
                currentConfidence = 0.70;
            } else if (count >= 4) {
                currentLevel = 'quick';
                nextMilestone = 15;
                currentConfidence = 0.40;
            }

            return {
                dataPoints: count,
                currentLevel,
                currentConfidence,
                nextMilestone,
                progress: Math.min(1, count / 60),
                lastResult: this.lastResult
            };
        }

        // ==================== 輔助函數 ====================

        mean(arr) {
            if (arr.length === 0) return 0;
            return arr.reduce((a, b) => a + b, 0) / arr.length;
        }

        calculateSNR(signal) {
            if (signal.length < 2) return 0;
            const m = this.mean(signal);
            const std = Math.sqrt(
                signal.reduce((sum, val) => sum + Math.pow(val - m, 2), 0) / signal.length
            );
            if (std === 0) return 100; // 完美一致信號
            return m / std;
        }

        normalizeHRV(hrv) {
            // HRV 通常 20-100ms，歸一化到 0-1
            return Math.min(1, Math.max(0, (hrv - 20) / 80));
        }

        /** @private */
        _resample(data) {
            const n = data.length;
            const sample = [];
            for (let i = 0; i < n; i++) {
                sample.push(data[Math.floor(Math.random() * n)]);
            }
            return sample;
        }

        /** @private */
        _quickTEI(data) {
            const avgHR = this.mean(data.map(d => d.hr));
            const avgHRV = this.mean(data.map(d => d.hrv));
            return this.normalizeHRV(avgHRV) * 50 +
                   Math.max(0, (1 - Math.abs(avgHR - this.baselineHR) / this.baselineHR)) * 50;
        }
    }

    // ==================== EXPORT ====================

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { ProgressiveTEI };
    }

    global.TENKI_PROGRESSIVE_TEI = {
        create: (options) => new ProgressiveTEI(options),
        ProgressiveTEI
    };

    console.log('[PROGRESSIVE-TEI] Module loaded ✓');

})(typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : this);
