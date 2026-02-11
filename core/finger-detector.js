/**
 * @fileoverview Finger Detector - MediaPipe Hands 手指覆蓋檢測
 * @description 使用 MediaPipe Hands 偵測手指位置和覆蓋率，
 *              提供紅/黃/綠狀態和方向提示。
 * @version 2.0.0
 */

(function (global) {
    'use strict';

    class FingerDetector {
        /**
         * @param {Object} options
         * @param {number} [options.videoWidth=640]
         * @param {number} [options.videoHeight=480]
         */
        constructor(options = {}) {
            this.videoWidth = options.videoWidth || 640;
            this.videoHeight = options.videoHeight || 480;
            this.hands = null;
            this._initialized = false;

            this.targetRect = {
                x: (this.videoWidth - 280) / 2,
                y: (this.videoHeight - 280) / 2,
                width: 280,
                height: 280,
                area: 280 * 280
            };
        }

        /**
         * 初始化 MediaPipe Hands
         * @returns {Promise<void>}
         */
        async init() {
            if (this._initialized) return;

            // 動態載入 MediaPipe Hands（如果可用）
            if (typeof Hands !== 'undefined') {
                this.hands = new Hands({
                    locateFile: (file) => {
                        return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
                    }
                });

                this.hands.setOptions({
                    maxNumHands: 1,
                    modelComplexity: 0,
                    minDetectionConfidence: 0.7,
                    minTrackingConfidence: 0.7
                });

                this._initialized = true;
            } else {
                console.warn('[FingerDetector] MediaPipe Hands not available, using fallback mode');
                this._initialized = true;
            }

            return this;
        }

        /**
         * 計算手指覆蓋率
         * @param {Object} results - MediaPipe 結果
         * @returns {Object} { coverage: 0-1, state: string, hint: string }
         */
        detect(results) {
            if (!results || !results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
                return {
                    coverage: 0,
                    state: 'RED',
                    hint: '請將手指放在鏡頭前',
                    landmarks: null
                };
            }

            const landmarks = results.multiHandLandmarks[0];

            // 計算手部邊界框
            const handBounds = this.getHandBounds(landmarks);

            // 計算與目標區域重疊
            const overlap = this.calculateOverlap(handBounds, this.targetRect);
            const coverage = Math.min(1, overlap / this.targetRect.area);

            // 判斷狀態
            let state, hint;
            if (coverage < 0.5) {
                state = 'RED';
                hint = this.generateDirectionHint(handBounds, this.targetRect);
            } else if (coverage < 0.85) {
                state = 'YELLOW';
                hint = '快到了，微調位置';
            } else {
                state = 'GREEN';
                hint = '完美！保持穩定';
            }

            return { coverage, state, hint, landmarks };
        }

        /**
         * 基於亮度的簡化覆蓋檢測（不需要 MediaPipe 的 fallback）
         * @param {CanvasRenderingContext2D} ctx
         * @param {number} width
         * @param {number} height
         * @returns {Object}
         */
        detectByBrightness(ctx, width, height) {
            const centerX = Math.floor(width / 2) - 50;
            const centerY = Math.floor(height / 2) - 50;

            const imageData = ctx.getImageData(centerX, centerY, 100, 100);
            const data = imageData.data;

            let redSum = 0;
            let greenSum = 0;
            let pixelCount = 0;

            for (let i = 0; i < data.length; i += 4) {
                redSum += data[i];
                greenSum += data[i + 1];
                pixelCount++;
            }

            const avgRed = redSum / pixelCount;
            const avgGreen = greenSum / pixelCount;

            // 手指覆蓋相機時，紅光通道值高且綠光低
            const isFingerCovering = avgRed > 100 && avgGreen < 80;
            const coverage = isFingerCovering ? Math.min(1, avgRed / 200) : 0;

            let state, hint;
            if (coverage < 0.3) {
                state = 'RED';
                hint = '請將手指覆蓋在鏡頭上';
            } else if (coverage < 0.7) {
                state = 'YELLOW';
                hint = '再靠近一點';
            } else {
                state = 'GREEN';
                hint = '完美！保持穩定';
            }

            return { coverage, state, hint, landmarks: null };
        }

        /**
         * 計算手部邊界框
         * @param {Array} landmarks
         * @returns {Object} { x, y, width, height }
         */
        getHandBounds(landmarks) {
            const xs = landmarks.map(l => l.x);
            const ys = landmarks.map(l => l.y);

            return {
                x: Math.min(...xs) * this.videoWidth,
                y: Math.min(...ys) * this.videoHeight,
                width: (Math.max(...xs) - Math.min(...xs)) * this.videoWidth,
                height: (Math.max(...ys) - Math.min(...ys)) * this.videoHeight
            };
        }

        /**
         * 計算兩個矩形的重疊面積
         */
        calculateOverlap(rect1, rect2) {
            const xOverlap = Math.max(0,
                Math.min(rect1.x + rect1.width, rect2.x + rect2.width) -
                Math.max(rect1.x, rect2.x)
            );

            const yOverlap = Math.max(0,
                Math.min(rect1.y + rect1.height, rect2.y + rect2.height) -
                Math.max(rect1.y, rect2.y)
            );

            return xOverlap * yOverlap;
        }

        /**
         * 生成方向提示
         */
        generateDirectionHint(hand, target) {
            const dx = (hand.x + hand.width / 2) - (target.x + target.width / 2);
            const dy = (hand.y + hand.height / 2) - (target.y + target.height / 2);

            let hint = '請移動 ';
            const parts = [];
            if (Math.abs(dy) > 30) parts.push(dy > 0 ? '↑ 上' : '↓ 下');
            if (Math.abs(dx) > 30) parts.push(dx > 0 ? '← 左' : '→ 右');

            if (parts.length === 0) {
                return '請將手指靠近鏡頭';
            }
            return hint + parts.join('、');
        }
    }

    // ==================== EXPORT ====================

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { FingerDetector };
    }

    global.TENKI_FINGER_DETECTOR = {
        create: (options) => new FingerDetector(options),
        FingerDetector
    };

    console.log('[FINGER-DETECTOR] Module loaded ✓');

})(typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : this);
