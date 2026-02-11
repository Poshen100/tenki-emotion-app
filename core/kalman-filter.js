/**
 * @fileoverview Kalman Filter - 2D 狀態估計 (HR/HRV)
 * @description 卡爾曼濾波器，用於平滑多來源心率和 HRV 數據。
 * @version 2.0.0
 */

(function (global) {
    'use strict';

    class KalmanFilter {
        /**
         * @param {Object} options
         * @param {Array} [options.initialState=[70, 50]] - 初始 [HR, HRV]
         * @param {number} [options.processNoise=0.1] - 過程噪聲
         */
        constructor(options = {}) {
            // 狀態: [HR, HRV]
            this.state = options.initialState ? [...options.initialState] : [70, 50];

            const pn = options.processNoise || 0.1;

            // 協方差矩陣
            this.P = [
                [10, 0],
                [0, 10]
            ];

            // 過程噪聲
            this.Q = [
                [pn, 0],
                [0, pn]
            ];

            this._initialized = false;
        }

        /**
         * 預測步驟 (隨機遊走模型)
         */
        predict() {
            // 假設狀態不變: x_k = x_{k-1} + w_k
            // 更新協方差: P = P + Q
            this.P = this._matrixAdd(this.P, this.Q);
        }

        /**
         * 更新步驟
         * @param {Object} measurement - { hr: number, hrv: number }
         * @param {Object} measurementNoise - { hr: number, hrv: number }
         * @returns {Object} 濾波後的 { hr, hrv }
         */
        update(measurement, measurementNoise) {
            // 首次使用測量值初始化
            if (!this._initialized) {
                this.state = [measurement.hr, measurement.hrv || 50];
                this._initialized = true;
            }

            // 預測
            this.predict();

            // 測量噪聲矩陣
            const R = [
                [measurementNoise.hr || 1, 0],
                [0, measurementNoise.hrv || 1]
            ];

            // 卡爾曼增益: K = P / (P + R)
            const K = this._calculateKalmanGain(this.P, R);

            // 創新 (測量殘差)
            const innovation = [
                measurement.hr - this.state[0],
                (measurement.hrv || this.state[1]) - this.state[1]
            ];

            // 更新狀態: x = x + K * (z - x)
            this.state[0] += K[0][0] * innovation[0] + K[0][1] * innovation[1];
            this.state[1] += K[1][0] * innovation[0] + K[1][1] * innovation[1];

            // 更新協方差: P = (I - K) * P
            this.P = this._updateCovariance(K, this.P);

            return {
                hr: this.state[0],
                hrv: this.state[1]
            };
        }

        /**
         * 取得目前狀態
         */
        getState() {
            return {
                hr: this.state[0],
                hrv: this.state[1],
                uncertainty: [this.P[0][0], this.P[1][1]]
            };
        }

        /**
         * 重置
         */
        reset() {
            this.state = [70, 50];
            this.P = [[10, 0], [0, 10]];
            this._initialized = false;
        }

        // ==================== 矩陣運算 ====================

        /** @private */
        _calculateKalmanGain(P, R) {
            const S = this._matrixAdd(P, R);
            const S_inv = this._matrixInvert(S);
            return this._matrixMultiply(P, S_inv);
        }

        /** @private */
        _matrixAdd(A, B) {
            return [
                [A[0][0] + B[0][0], A[0][1] + B[0][1]],
                [A[1][0] + B[1][0], A[1][1] + B[1][1]]
            ];
        }

        /** @private */
        _matrixInvert(M) {
            const det = M[0][0] * M[1][1] - M[0][1] * M[1][0];
            if (Math.abs(det) < 1e-10) {
                return [[1, 0], [0, 1]]; // 退化時返回單位矩陣
            }
            return [
                [M[1][1] / det, -M[0][1] / det],
                [-M[1][0] / det, M[0][0] / det]
            ];
        }

        /** @private */
        _matrixMultiply(A, B) {
            return [
                [
                    A[0][0] * B[0][0] + A[0][1] * B[1][0],
                    A[0][0] * B[0][1] + A[0][1] * B[1][1]
                ],
                [
                    A[1][0] * B[0][0] + A[1][1] * B[1][0],
                    A[1][0] * B[0][1] + A[1][1] * B[1][1]
                ]
            ];
        }

        /** @private */
        _updateCovariance(K, P) {
            const I_K = [
                [1 - K[0][0], -K[0][1]],
                [-K[1][0], 1 - K[1][1]]
            ];
            return this._matrixMultiply(I_K, P);
        }
    }

    // ==================== EXPORT ====================

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { KalmanFilter };
    }

    global.TENKI_KALMAN = {
        create: (options) => new KalmanFilter(options),
        KalmanFilter
    };

    console.log('[KALMAN-FILTER] Module loaded ✓');

})(typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : this);
