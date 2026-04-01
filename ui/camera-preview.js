/**
 * @fileoverview Camera Preview UI - PPG 校準介面 DOM 建構器
 * @description 使用 TENKI_OVERLAY 掛載相機校準介面，
 *              監聽 EventBridge.onPPGCalibration 更新 UI 狀態。
 *              
 * 不修改 index.html — 所有 DOM 動態建立。
 * 
 * @version 2.0.0
 * @author TENKI PRO Team
 */

(function (global) {
    'use strict';

    // ==================== DOM TEMPLATE ====================

    /**
     * 建立相機覆蓋層 HTML
     * @returns {string} innerHTML
     */
    function buildCameraHTML() {
        return `
            <!-- 相機視頻 -->
            <video class="camera-overlay-video" id="ppg-video" playsinline autoplay muted></video>

            <!-- 目標框 -->
            <div class="camera-overlay-target" id="ppg-target"></div>

            <!-- 品質環 SVG -->
            <svg class="camera-overlay-quality-ring" viewBox="0 0 300 300">
                <defs>
                    <linearGradient id="qualityGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stop-color="#FF6B6B" />
                        <stop offset="50%" stop-color="#FFD700" />
                        <stop offset="100%" stop-color="#00FF88" />
                    </linearGradient>
                </defs>
                <circle class="ring-bg" cx="150" cy="150" r="135" />
                <circle class="ring-progress" id="ppg-quality-ring" cx="150" cy="150" r="135"
                    transform="rotate(-90 150 150)" />
            </svg>

            <!-- 分數顯示 -->
            <div class="camera-overlay-score" id="ppg-score-display">
                <div class="score-value" id="ppg-score-value">--</div>
                <div class="score-label" id="ppg-score-label">Signal Quality</div>
                <div class="score-bpm" id="ppg-bpm-value"></div>
            </div>

            <!-- 訊息列 -->
            <div class="camera-overlay-message" id="ppg-message">
                將手指放在相機鏡頭上
            </div>

            <!-- 進度條 -->
            <div class="camera-overlay-progress" id="ppg-progress-container" style="display: none;">
                <div class="camera-overlay-progress-bar" id="ppg-progress-bar"></div>
            </div>

            <!-- 關閉按鈕 -->
            <button class="camera-overlay-close" id="ppg-close-btn" aria-label="Close">✕</button>

            <!-- 狀態指示器 -->
            <div class="camera-overlay-status" id="ppg-status">
                <span class="camera-overlay-status-dot"></span>
                <span class="camera-overlay-status-text" id="ppg-status-text">初始化中...</span>
            </div>
        `;
    }

    // ==================== CAMERA PREVIEW CLASS ====================

    class CameraPreview {
        constructor() {
            this._overlayEl = null;
            this._cameraController = null;
            this._unsubscribe = null;
            this._active = false;

            // DOM 參考
            this._els = {};
        }

        /**
         * 啟動相機校準流程
         * 1. 使用 TENKI_OVERLAY 掛載 camera overlay
         * 2. 初始化 CameraController
         * 3. 監聽 EventBridge 更新 UI
         * 
         * @returns {Promise<boolean>} 是否成功啟動
         */
        async start() {
            if (this._active) {
                console.warn('[CameraPreview] Already active');
                return false;
            }

            // 檢查依賴
            if (!global.TENKI_OVERLAY) {
                console.error('[CameraPreview] TENKI_OVERLAY not available');
                return false;
            }

            // 1. 掛載 overlay
            this._overlayEl = global.TENKI_OVERLAY.mount('camera', {
                innerHTML: buildCameraHTML(),
                onMount: (el) => {
                    console.log('[CameraPreview] Overlay mounted');
                }
            });

            if (!this._overlayEl) return false;

            // 2. 快取 DOM 參考
            this._cacheElements();

            // 3. 綁定關閉按鈕
            if (this._els.closeBtn) {
                this._els.closeBtn.addEventListener('click', () => this.stop());
            }

            // 4. 訂閱 EventBridge
            if (global.EventBridge && typeof global.EventBridge.onPPGCalibration === 'function') {
                this._unsubscribe = global.EventBridge.onPPGCalibration((data) => {
                    this._handleCalibrationEvent(data);
                });
            }

            // 5. 初始化 CameraController
            this._active = true;
            try {
                if (global.TENKI_CAMERA) {
                    this._cameraController = global.TENKI_CAMERA.create({
                        videoElement: this._els.video,
                        calibrationDuration: 5000,
                        qualityThreshold: 50
                    });
                    await this._cameraController.init();
                } else {
                    console.error('[CameraPreview] TENKI_CAMERA not available');
                    this._updateMessage('相機模組未載入', 'hint-red');
                }
            } catch (err) {
                console.error('[CameraPreview] Camera init error:', err);
                this._updateMessage('相機初始化失敗: ' + err.message, 'hint-red');
            }

            return true;
        }

        /**
         * 停止並卸載
         */
        stop() {
            this._active = false;

            // 停止 CameraController
            if (this._cameraController) {
                this._cameraController.destroy();
                this._cameraController = null;
            }

            // 取消 EventBridge 訂閱
            if (this._unsubscribe) {
                this._unsubscribe();
                this._unsubscribe = null;
            }

            // 卸載 overlay
            if (global.TENKI_OVERLAY) {
                global.TENKI_OVERLAY.unmount('camera');
            }

            this._overlayEl = null;
            this._els = {};

            console.log('[CameraPreview] Stopped and unmounted');
        }

        // ==================== UI UPDATE ====================

        /**
         * 處理 EventBridge PPG 校準事件
         * @private
         */
        _handleCalibrationEvent(data) {
            if (!this._active) return;

            const { state, coverage, quality, bpm, hint, progress, error, message } = data;

            switch (state) {
                case 'INIT':
                    this._updateMessage('初始化相機...', '');
                    this._updateTarget('');
                    break;

                case 'CAMERA_READY':
                    this._updateMessage('將手指放在相機鏡頭上', '');
                    this._updateStatusText('相機就緒');
                    break;

                case 'RED':
                    this._updateTarget('red');
                    this._updateMessage(hint || '手指未偵測到 — 請覆蓋鏡頭', 'hint-red');
                    this._updateQualityRing(coverage || 0);
                    this._updateStatusText('偵測中...');
                    break;

                case 'YELLOW':
                    this._updateTarget('yellow');
                    this._updateMessage(hint || '手指位置偏移 — 請調整', 'hint-yellow');
                    this._updateQualityRing(coverage || 0);
                    this._updateStatusText('調整中...');
                    break;

                case 'GREEN':
                    this._updateTarget('green');
                    this._updateMessage(hint || '完美！保持穩定', 'hint-green');
                    this._updateQualityRing(coverage || 0);
                    this._updateStatusText('手指位置正確');
                    break;

                case 'SIGNAL_LOCK':
                    this._updateTarget('green');
                    if (quality != null) {
                        this._updateScore(quality);
                    }
                    if (bpm) {
                        this._updateBPM(bpm);
                    }
                    this._updateStatusText('信號鎖定');
                    break;

                case 'CALIBRATING':
                    this._updateMessage('校準中...保持穩定', 'hint-green');
                    this._showProgress(true);
                    if (progress != null) {
                        this._updateProgress(progress);
                    }
                    this._updateStatusText('校準中');
                    break;

                case 'COMPLETE':
                    this._showSuccess(data);
                    this._updateStatusText('校準完成');
                    break;

                case 'ERROR':
                    this._updateTarget('red');
                    this._updateMessage(message || error || '發生錯誤', 'hint-red');
                    this._updateStatusText('錯誤');
                    break;
            }
        }

        /**
         * 更新目標框狀態
         * @private
         */
        _updateTarget(colorClass) {
            if (!this._els.target) return;
            this._els.target.className = 'camera-overlay-target';
            if (colorClass) {
                this._els.target.classList.add(colorClass);
            }
        }

        /**
         * 更新訊息
         * @private
         */
        _updateMessage(text, hintClass) {
            if (!this._els.message) return;
            this._els.message.textContent = text;
            this._els.message.className = 'camera-overlay-message';
            if (hintClass) {
                this._els.message.classList.add(hintClass);
            }
        }

        /**
         * 更新品質環
         * @private
         */
        _updateQualityRing(value) {
            if (!this._els.qualityRing) return;
            const circumference = 2 * Math.PI * 135; // 848.23
            const offset = circumference * (1 - Math.min(1, Math.max(0, value)));
            this._els.qualityRing.style.strokeDashoffset = offset;
        }

        /**
         * 更新品質分數
         * @private
         */
        _updateScore(quality) {
            if (!this._els.scoreValue) return;
            this._els.scoreValue.textContent = Math.round(quality) + '%';
        }

        /**
         * 更新 BPM
         * @private
         */
        _updateBPM(bpm) {
            if (!this._els.bpmValue) return;
            this._els.bpmValue.textContent = `♥ ${Math.round(bpm)} BPM`;
        }

        /**
         * 更新狀態文字
         * @private
         */
        _updateStatusText(text) {
            if (!this._els.statusText) return;
            this._els.statusText.textContent = text;
        }

        /**
         * 顯示/隱藏進度條
         * @private
         */
        _showProgress(show) {
            if (!this._els.progressContainer) return;
            this._els.progressContainer.style.display = show ? 'block' : 'none';
        }

        /**
         * 更新進度條
         * @private
         */
        _updateProgress(value) {
            if (!this._els.progressBar) return;
            this._els.progressBar.style.width = (value * 100) + '%';
        }

        /**
         * 顯示成功畫面
         * @private
         */
        _showSuccess(data) {
            if (!this._overlayEl) return;

            const metrics = data.calibration || data.metrics || {};

            // 建立成功 overlay
            const successEl = document.createElement('div');
            successEl.className = 'camera-overlay-success';
            successEl.innerHTML = `
                <div class="success-icon"><span class="material-symbols-outlined ferrari-icon" style="font-size:48px;color:#34C759">verified</span></div>
                <h2>校準完成</h2>
                <p>PPG 信號已鎖定</p>
                <div class="metrics-row">
                    <div class="metric-item">
                        <div class="metric-value">${metrics.bpm || '--'}</div>
                        <div class="metric-label">BPM</div>
                    </div>
                    <div class="metric-item">
                        <div class="metric-value">${metrics.quality || '--'}%</div>
                        <div class="metric-label">Quality</div>
                    </div>
                    <div class="metric-item">
                        <div class="metric-value">${metrics.sampleCount || '--'}</div>
                        <div class="metric-label">Samples</div>
                    </div>
                </div>
            `;
            this._overlayEl.appendChild(successEl);

            // 隱藏其他元素
            this._showProgress(false);
            if (this._els.message) this._els.message.style.display = 'none';

            // 3秒後自動關閉
            setTimeout(() => {
                this.stop();
            }, 3000);
        }

        /**
         * 快取 DOM 元素
         * @private
         */
        _cacheElements() {
            this._els = {
                video: document.getElementById('ppg-video'),
                target: document.getElementById('ppg-target'),
                qualityRing: document.getElementById('ppg-quality-ring'),
                scoreValue: document.getElementById('ppg-score-value'),
                scoreLabel: document.getElementById('ppg-score-label'),
                bpmValue: document.getElementById('ppg-bpm-value'),
                message: document.getElementById('ppg-message'),
                progressContainer: document.getElementById('ppg-progress-container'),
                progressBar: document.getElementById('ppg-progress-bar'),
                closeBtn: document.getElementById('ppg-close-btn'),
                statusText: document.getElementById('ppg-status-text')
            };
        }
    }

    // ==================== SINGLETON & EXPORT ====================

    const instance = new CameraPreview();

    global.TENKI_CAMERA_PREVIEW = {
        start: () => instance.start(),
        stop: () => instance.stop(),
        isActive: () => instance._active,
        _instance: instance
    };

    console.log('[CameraPreview] Module loaded ✓');

})(typeof window !== 'undefined' ? window : this);
