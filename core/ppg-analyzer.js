/**
 * @fileoverview PPG Analyzer - 紅光脈搏容積波信號提取分析
 * @description 從手機相機影像中提取紅色通道 PPG 信號，
 *              計算 SNR、偵測 BPM 與評估信號品質。
 * @version 2.0.0
 */

(function (global) {
    'use strict';

    class PPGAnalyzer {
        /**
         * @param {Object} options
         * @param {number} [options.bufferSize=150] - 緩衝區大小 (frames)
         * @param {number} [options.fps=30] - 相機幀率
         */
        constructor(options = {}) {
            this.buffer = [];
            this.bufferSize = options.bufferSize || 150; // 5秒 @ 30fps
            this.fps = options.fps || 30;
            this.canvas = null;
            this.ctx = null;
            this._qualityHistory = [];

            // 延遲建立 canvas（避免 SSR 問題）
            if (typeof document !== 'undefined') {
                this.canvas = document.createElement('canvas');
                this.canvas.width = 100;
                this.canvas.height = 100;
                this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
            }
        }

        /**
         * 分析單幀視頻
         * @param {HTMLVideoElement} video
         * @returns {Object} { quality: 0-100, bpm: number, snr: number, message: string }
         */
        analyzeFrame(video) {
            if (!this.ctx || !video) {
                return { quality: 0, bpm: 0, snr: 0, message: '初始化中...' };
            }

            // 1. 繪製中心區域到 canvas
            const centerX = Math.max(0, video.videoWidth / 2 - 50);
            const centerY = Math.max(0, video.videoHeight / 2 - 50);

            this.ctx.drawImage(
                video,
                centerX, centerY, 100, 100,
                0, 0, 100, 100
            );

            // 2. 提取圖像數據
            const imageData = this.ctx.getImageData(0, 0, 100, 100);

            // 3. 計算紅光平均值
            const redMean = this.extractRedChannel(imageData);

            // 4. 加入緩衝區
            this.buffer.push(redMean);
            if (this.buffer.length > this.bufferSize) {
                this.buffer.shift();
            }

            // 5. 需要至少 2 秒數據
            const minFrames = Math.round(this.fps * 2);
            if (this.buffer.length < minFrames) {
                return {
                    quality: 0,
                    bpm: 0,
                    snr: 0,
                    message: `收集中... ${this.buffer.length}/${minFrames}`
                };
            }

            // 6. 計算 SNR
            const mean = this.mean(this.buffer);
            const std = this.std(this.buffer);
            const snr = std > 0 ? mean / std : 0;

            // 7. 偵測 BPM
            const bpm = this.detectBPM(this.buffer);

            // 8. 計算品質分數
            const quality = Math.min(100, Math.round(snr * 10));

            // 記錄品質歷史
            this._qualityHistory.push(quality);
            if (this._qualityHistory.length > 30) this._qualityHistory.shift();

            let message;
            if (quality >= 70) {
                message = '信號優秀';
            } else if (quality >= 50) {
                message = '信號穩定';
            } else if (quality >= 30) {
                message = '信號弱，請調整位置';
            } else {
                message = '信號不足，請重新放置手指';
            }

            return { quality, bpm, snr: Math.round(snr * 100) / 100, message };
        }

        /**
         * 提取紅色通道平均值
         * @param {ImageData} imageData
         * @returns {number}
         */
        extractRedChannel(imageData) {
            const data = imageData.data;
            let sum = 0;
            const pixelCount = data.length / 4;

            for (let i = 0; i < data.length; i += 4) {
                sum += data[i]; // 紅色通道
            }

            return sum / pixelCount;
        }

        /**
         * 透過峰值檢測偵測 BPM
         * @param {Array<number>} signal
         * @returns {number} BPM (0 if unreliable)
         */
        detectBPM(signal) {
            if (signal.length < 30) return 0;

            // 去趨勢化
            const detrended = this._detrend(signal);

            // 峰值檢測（帶最小間距）
            const minPeakDist = Math.round(this.fps * 0.4); // 最小 0.4 秒間距 (≈150 BPM)
            const peaks = this._findPeaks(detrended, minPeakDist);

            if (peaks.length < 2) return 0;

            // 計算平均峰間隔
            const intervals = [];
            for (let i = 1; i < peaks.length; i++) {
                intervals.push(peaks[i] - peaks[i - 1]);
            }

            // 去除離群值
            const medianInterval = this._median(intervals);
            const validIntervals = intervals.filter(iv =>
                Math.abs(iv - medianInterval) < medianInterval * 0.3
            );

            if (validIntervals.length === 0) return 0;

            const avgInterval = this.mean(validIntervals);
            const bpm = (60 * this.fps) / avgInterval;

            // 有效範圍檢查
            if (bpm < 40 || bpm > 180) return 0;

            return Math.round(bpm);
        }

        /**
         * 取得平均品質分數
         * @returns {number}
         */
        getAverageQuality() {
            if (this._qualityHistory.length === 0) return 0;
            return Math.round(this.mean(this._qualityHistory));
        }

        /**
         * 重置分析器
         */
        reset() {
            this.buffer = [];
            this._qualityHistory = [];
        }

        // ==================== 輔助函數 ====================

        mean(arr) {
            if (arr.length === 0) return 0;
            return arr.reduce((a, b) => a + b, 0) / arr.length;
        }

        std(arr) {
            if (arr.length < 2) return 0;
            const m = this.mean(arr);
            const variance = arr.reduce((sum, val) =>
                sum + Math.pow(val - m, 2), 0) / arr.length;
            return Math.sqrt(variance);
        }

        /** @private 去線性趨勢 */
        _detrend(signal) {
            const n = signal.length;
            const meanX = (n - 1) / 2;
            const meanY = this.mean(signal);

            let num = 0, den = 0;
            for (let i = 0; i < n; i++) {
                num += (i - meanX) * (signal[i] - meanY);
                den += (i - meanX) * (i - meanX);
            }

            const slope = den !== 0 ? num / den : 0;
            const intercept = meanY - slope * meanX;

            return signal.map((val, i) => val - (slope * i + intercept));
        }

        /** @private 帶最小間距的峰值檢測 */
        _findPeaks(signal, minDist) {
            const peaks = [];
            for (let i = 1; i < signal.length - 1; i++) {
                if (signal[i] > signal[i - 1] && signal[i] > signal[i + 1]) {
                    // 檢查與上一個峰的距離
                    if (peaks.length === 0 || i - peaks[peaks.length - 1] >= minDist) {
                        peaks.push(i);
                    } else if (signal[i] > signal[peaks[peaks.length - 1]]) {
                        // 如果這個峰更高，替換上一個
                        peaks[peaks.length - 1] = i;
                    }
                }
            }
            return peaks;
        }

        /** @private 中位數 */
        _median(arr) {
            const sorted = [...arr].sort((a, b) => a - b);
            const mid = Math.floor(sorted.length / 2);
            return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
        }
    }

    // ==================== EXPORT ====================

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { PPGAnalyzer };
    }

    global.TENKI_PPG_ANALYZER = {
        create: (options) => new PPGAnalyzer(options),
        PPGAnalyzer
    };

    console.log('[PPG-ANALYZER] Module loaded ✓');

})(typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : this);
