/**
 * @fileoverview Camera Controller - PPG 相機校準流程控制器
 * @description 管理相機生命週期：初始化 → 手指偵測 → PPG 校準 → 完成。
 *              透過 EventBridge 發送狀態事件。
 * @version 2.0.0
 */

(function (global) {
    'use strict';

    // 狀態常數
    const CAMERA_STATES = {
        INIT: 'INIT',
        CAMERA_READY: 'CAMERA_READY',
        RED: 'RED',
        YELLOW: 'YELLOW',
        GREEN: 'GREEN',
        CALIBRATING: 'CALIBRATING',
        COMPLETE: 'COMPLETE',
        ERROR: 'ERROR'
    };

    class CameraController {
        /**
         * @param {Object} options
         * @param {HTMLVideoElement} options.videoElement - 視頻元素
         * @param {number} [options.calibrationDuration=5000] - 校準持續時間 (ms)
         * @param {number} [options.qualityThreshold=50] - 品質門檻
         */
        constructor(options = {}) {
            this.state = CAMERA_STATES.INIT;
            this.videoElement = options.videoElement || null;
            this.stream = null;
            this.calibrationDuration = options.calibrationDuration || 5000;
            this.qualityThreshold = options.qualityThreshold || 50;

            // 子模組（延遲初始化）
            this.fingerDetector = null;
            this.ppgAnalyzer = null;

            // 校準指標
            this.metrics = {
                startTime: null,
                timeToGreen: 0,
                timeToSignal: 0,
                finalQuality: 0,
                calibrationData: []
            };

            this._processingLoop = null;
            this._destroyed = false;
        }

        /**
         * 初始化相機和偵測模組
         * @returns {Promise<void>}
         */
        async init() {
            try {
                // 初始化子模組
                if (global.TENKI_FINGER_DETECTOR) {
                    this.fingerDetector = global.TENKI_FINGER_DETECTOR.create();
                    await this.fingerDetector.init();
                }

                if (global.TENKI_PPG_ANALYZER) {
                    this.ppgAnalyzer = global.TENKI_PPG_ANALYZER.create();
                }

                // 請求後置相機
                this.stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        facingMode: 'environment',
                        width: { ideal: 640 },
                        height: { ideal: 480 }
                    }
                });

                if (this.videoElement) {
                    this.videoElement.srcObject = this.stream;
                    await this.videoElement.play();
                }

                this.state = CAMERA_STATES.CAMERA_READY;
                this.metrics.startTime = Date.now();

                this._emit('ppg:camera-ready', { timestamp: Date.now() });

                // 啟動處理循環
                this._startProcessing();

            } catch (error) {
                this._handleError(error);
            }
        }

        /**
         * 啟動幀處理循環
         * @private
         */
        _startProcessing() {
            const fps = 30;
            const interval = 1000 / fps;
            let lastFrameTime = 0;

            const process = async (timestamp) => {
                if (this._destroyed || this.state === CAMERA_STATES.COMPLETE || this.state === CAMERA_STATES.ERROR) {
                    return;
                }

                // 控制幀率
                if (timestamp - lastFrameTime < interval) {
                    this._processingLoop = requestAnimationFrame(process);
                    return;
                }
                lastFrameTime = timestamp;

                try {
                    // 使用亮度 fallback 偵測手指覆蓋
                    if (this.ppgAnalyzer && this.videoElement && this.ppgAnalyzer.ctx) {
                        // 繪製到 canvas
                        this.ppgAnalyzer.ctx.drawImage(
                            this.videoElement, 0, 0,
                            this.ppgAnalyzer.canvas.width,
                            this.ppgAnalyzer.canvas.height
                        );

                        // 手指偵測
                        if (this.fingerDetector && this.state !== CAMERA_STATES.CALIBRATING) {
                            const detection = this.fingerDetector.detectByBrightness(
                                this.ppgAnalyzer.ctx,
                                this.ppgAnalyzer.canvas.width,
                                this.ppgAnalyzer.canvas.height
                            );
                            this._updateCoverage(detection);
                        }

                        // PPG 分析（手指位置正確時）
                        if (this.state === CAMERA_STATES.GREEN || this.state === CAMERA_STATES.CALIBRATING) {
                            const signal = this.ppgAnalyzer.analyzeFrame(this.videoElement);
                            this._updateSignal(signal);

                            if (signal.quality >= this.qualityThreshold && this.state === CAMERA_STATES.GREEN) {
                                this._startCalibration();
                            }
                        }
                    }
                } catch (err) {
                    console.error('[CameraController] Processing error:', err);
                }

                this._processingLoop = requestAnimationFrame(process);
            };

            this._processingLoop = requestAnimationFrame(process);
        }

        /**
         * 更新覆蓋率 UI
         * @private
         */
        _updateCoverage(detection) {
            this._emit('ppg:coverage-update', detection);

            if (detection.state === 'GREEN' && this.state !== CAMERA_STATES.GREEN &&
                this.state !== CAMERA_STATES.CALIBRATING) {
                this.state = CAMERA_STATES.GREEN;
                this.metrics.timeToGreen = Date.now() - this.metrics.startTime;
            } else if (detection.state === 'YELLOW') {
                if (this.state !== CAMERA_STATES.GREEN && this.state !== CAMERA_STATES.CALIBRATING) {
                    this.state = CAMERA_STATES.YELLOW;
                }
            } else if (detection.state === 'RED') {
                if (this.state !== CAMERA_STATES.CALIBRATING) {
                    this.state = CAMERA_STATES.RED;
                }
            }
        }

        /**
         * 更新信號 UI
         * @private
         */
        _updateSignal(signal) {
            this._emit('ppg:signal-update', signal);

            if (signal.quality >= this.qualityThreshold && !this.metrics.timeToSignal) {
                this.metrics.timeToSignal = Date.now() - this.metrics.startTime;
            }

            // 在校準期間收集數據
            if (this.state === CAMERA_STATES.CALIBRATING && signal.bpm > 0) {
                this.metrics.calibrationData.push({
                    bpm: signal.bpm,
                    quality: signal.quality,
                    timestamp: Date.now()
                });
            }
        }

        /**
         * 啟動校準
         * @private
         */
        async _startCalibration() {
            this.state = CAMERA_STATES.CALIBRATING;

            this._emit('ppg:calibration-start', { timestamp: Date.now() });

            // 收集指定時間的數據
            await new Promise(resolve => setTimeout(resolve, this.calibrationDuration));

            // 校準完成
            this._complete();
        }

        /**
         * 完成校準
         * @private
         */
        _complete() {
            this.state = CAMERA_STATES.COMPLETE;
            this.metrics.finalQuality = this.ppgAnalyzer ? this.ppgAnalyzer.getAverageQuality() : 0;

            // 計算校準結果
            const calibrationResult = this._processCalibrationData();

            this._emit('ppg:complete', {
                metrics: this.metrics,
                calibration: calibrationResult,
                timestamp: Date.now()
            });

            this.stop();
        }

        /**
         * 處理校準數據
         * @private
         * @returns {Object}
         */
        _processCalibrationData() {
            const data = this.metrics.calibrationData;
            if (data.length === 0) {
                return { bpm: 0, quality: 0, sampleCount: 0 };
            }

            const bpms = data.map(d => d.bpm).filter(b => b > 0);
            const qualities = data.map(d => d.quality);

            const mean = arr => arr.reduce((a, b) => a + b, 0) / arr.length;

            return {
                bpm: Math.round(mean(bpms)),
                quality: Math.round(mean(qualities)),
                sampleCount: data.length,
                baselineHR: Math.round(mean(bpms))
            };
        }

        /**
         * 停止相機
         */
        stop() {
            if (this._processingLoop) {
                cancelAnimationFrame(this._processingLoop);
                this._processingLoop = null;
            }

            if (this.stream) {
                this.stream.getTracks().forEach(track => track.stop());
                this.stream = null;
            }
        }

        /**
         * 銷毀實例
         */
        destroy() {
            this._destroyed = true;
            this.stop();

            if (this.ppgAnalyzer) this.ppgAnalyzer.reset();
        }

        /**
         * 取得目前狀態
         */
        getState() {
            return {
                state: this.state,
                metrics: { ...this.metrics },
                elapsed: this.metrics.startTime ? Date.now() - this.metrics.startTime : 0
            };
        }

        /**
         * @private 發送事件
         */
        _emit(event, data) {
            // 嘗試使用全域 EventBridge
            if (global.EventBridge) {
                if (typeof global.EventBridge.emit === 'function') {
                    global.EventBridge.emit(event, data);
                } else if (typeof global.EventBridge.notifyTEIUpdate === 'function' && event === 'ppg:complete') {
                    // Fallback: 使用現有的 notifyTEIUpdate
                    const cal = data.calibration;
                    if (cal && cal.bpm) {
                        global.EventBridge.notifyTEIUpdate(cal.quality, 'camera-controller');
                    }
                }
            }

            // 也發送到 CustomEvent（向下兼容）
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent(event, { detail: data }));
            }
        }

        /**
         * @private 處理錯誤
         */
        _handleError(error) {
            this.state = CAMERA_STATES.ERROR;

            let message = '相機初始化失敗';
            if (error.name === 'NotAllowedError') {
                message = '請允許相機權限';
            } else if (error.name === 'NotFoundError') {
                message = '找不到相機';
            } else if (error.name === 'NotReadableError') {
                message = '相機被其他應用佔用';
            }

            console.error('[CameraController] Error:', error);

            this._emit('ppg:error', {
                error: error.name || 'UnknownError',
                message
            });
        }
    }

    // ==================== EXPORT ====================

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { CameraController, CAMERA_STATES };
    }

    global.TENKI_CAMERA = {
        create: (options) => new CameraController(options),
        CameraController,
        STATES: CAMERA_STATES
    };

    console.log('[CAMERA-CONTROLLER] Module loaded ✓');

})(typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : this);
