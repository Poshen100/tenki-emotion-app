/**
 * TENKI PPGCalibration
 * =====================
 * PPG 校準狀態機 — 整合 FingerDetector + SignalAnalyzer 的主協調器
 *
 * 狀態機:
 *   INIT → DETECTING → RED → YELLOW → GREEN → LOCKED → (COMPLETE)
 *                         ↑                   ↓
 *                         └───────────────────┘ (品質下降時回退)
 *
 * 狀態說明:
 *   INIT:      等待啟動
 *   DETECTING: 偵測手指（尚未有有效覆蓋率）
 *   RED:       覆蓋率 < 0.60，引導用戶調整
 *   YELLOW:    覆蓋率 0.60–0.85，信號建立中
 *   GREEN:     覆蓋率 ≥ 0.85，信號穩定
 *   LOCKED:    BPM 穩定 + 品質達標 → 完成校準
 *   ERROR:     超時或連續失敗
 *
 * 觸發 EventBridgeV2 事件:
 *   tenki:ppg-state     → 每次狀態轉換
 *   tenki:ppg-coverage  → 每幀（由 FingerDetector 發送）
 *   tenki:ppg-signal    → 每秒（由 SignalAnalyzer 發送）
 *   tenki:ppg-complete  → 校準成功一次
 *
 * 不可修改任何 LOCKED FILE
 *
 * @version 2.0.0
 * @author  TENKI Core Team
 */

'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// 常數
// ─────────────────────────────────────────────────────────────────────────────

const PPG_STATES = {
    INIT: 'INIT',
    DETECTING: 'DETECTING',
    RED: 'RED',
    YELLOW: 'YELLOW',
    GREEN: 'GREEN',
    LOCKED: 'LOCKED',
    ERROR: 'ERROR',
};

const COVERAGE_GREEN = 0.85;
const COVERAGE_YELLOW = 0.60;

const LOCK_QUALITY_THRESHOLD = 0.65;
const LOCK_STABLE_FRAMES = 10;
const LOCK_MIN_COVERAGE = 0.82;

const TIMEOUT_DETECT_MS = 15000;
const TIMEOUT_LOCK_MS = 60000;

const DEGRADATION_COVERAGE_THRESHOLD = 0.55;
const DEGRADATION_FRAMES = 5;

const ROI_FALLBACK_ORDER = ['glabella', 'forehead', 'center', 'full'];
const COVERAGE_HISTORY_INTERVAL_MS = 500;


// ─────────────────────────────────────────────────────────────────────────────
// PPGCalibration 主類別
// ─────────────────────────────────────────────────────────────────────────────

class PPGCalibration {
    constructor(options = {}) {
        this._fingerDetector = options.fingerDetector || null;
        this._signalAnalyzer = options.signalAnalyzer || null;
        this._timeoutMs = options.timeoutMs || TIMEOUT_LOCK_MS;
        this._enableROIFallback = options.enableROIFallback !== false;
        this._verbose = options.verbose || false;

        this._state = PPG_STATES.INIT;
        this._prevState = PPG_STATES.INIT;

        this._startTs = 0;
        this._stateEnteredTs = 0;
        this._detectTimeoutTimer = null;
        this._lockTimeoutTimer = null;

        this._lockFrameCount = 0;
        this._degradationFrameCount = 0;

        this._coverageHistory = [];
        this._lastCoverageHistoryTs = 0;

        this._stateTransitions = [];
        this._roiFallbackIdx = 0;
        this._sessionId = '';

        this._lastGoodBPM = 0;
        this._lastGoodQuality = 0;
    }

    // ── 公開 API ──

    start() {
        if (this._state !== PPG_STATES.INIT && this._state !== PPG_STATES.ERROR) {
            this._log('[WARN] 校準已在進行中，請先 stop()');
            return;
        }

        this._ensureDependencies();

        this._sessionId = this._generateSessionId();
        this._startTs = Date.now();
        this._stateEnteredTs = this._startTs;
        this._coverageHistory = [];
        this._stateTransitions = [];
        this._lockFrameCount = 0;
        this._degradationFrameCount = 0;
        this._roiFallbackIdx = 0;
        this._lastGoodBPM = 0;
        this._lastGoodQuality = 0;

        this._fingerDetector.reset();
        this._signalAnalyzer.reset();

        this._detectTimeoutTimer = setTimeout(() => {
            if (this._state === PPG_STATES.DETECTING || this._state === PPG_STATES.RED) {
                this._log('⏰ 偵測超時，嘗試 ROI 降級');
                this._tryROIFallback();
            }
        }, TIMEOUT_DETECT_MS);

        this._lockTimeoutTimer = setTimeout(() => {
            if (this._state !== PPG_STATES.LOCKED) {
                this._transitionTo(PPG_STATES.ERROR, '校準超時，請重試');
            }
        }, this._timeoutMs);

        this._transitionTo(PPG_STATES.DETECTING, '正在偵測手指...');
        this._log(`[OK] 校準開始 (session: ${this._sessionId})`);
    }

    stop() {
        this._clearTimers();
        this._transitionTo(PPG_STATES.INIT, '');
        this._log('[STOP] 校準已停止');
    }

    processFrame(frame, rMean = null, extraMeta = {}) {
        if (this._state === PPG_STATES.INIT ||
            this._state === PPG_STATES.ERROR ||
            this._state === PPG_STATES.LOCKED) {
            return;
        }

        let coverageResult;
        if (frame) {
            coverageResult = this._fingerDetector.processFrame(frame);
        } else {
            coverageResult = {
                coverage: extraMeta.coverage ?? 0,
                color: extraMeta.coverage >= COVERAGE_GREEN ? 'green' :
                    extraMeta.coverage >= COVERAGE_YELLOW ? 'yellow' : 'red',
                hint: ''
            };
        }

        const { coverage } = coverageResult;
        this._recordCoverageHistory(coverage);

        if (rMean !== null) {
            this._signalAnalyzer.ingestFrame(rMean, {
                coverage,
                motion: extraMeta.motion ?? 0,
                light: extraMeta.light ?? 0.5,
            });
        }

        const lastSample = this._signalAnalyzer.getLastResult();
        if (lastSample && lastSample.quality >= LOCK_QUALITY_THRESHOLD) {
            this._lastGoodBPM = lastSample.hr_bpm;
            this._lastGoodQuality = lastSample.quality;
        }

        this._updateState(coverage, lastSample);
    }

    get state() { return this._state; }
    get elapsedMs() { return this._startTs === 0 ? 0 : Date.now() - this._startTs; }

    // ── 私有：狀態機 ──

    _updateState(coverage, lastSample) {
        const quality = lastSample?.quality ?? 0;

        switch (this._state) {
            case PPG_STATES.DETECTING:
                if (coverage >= COVERAGE_GREEN) {
                    this._transitionTo(PPG_STATES.GREEN, '保持不動，正在讀取...');
                } else if (coverage >= COVERAGE_YELLOW) {
                    this._transitionTo(PPG_STATES.YELLOW, '繼續調整手指位置');
                } else if (coverage > 0.1) {
                    this._transitionTo(PPG_STATES.RED, '請將手指完整覆蓋鏡頭');
                }
                break;

            case PPG_STATES.RED:
                if (coverage >= COVERAGE_GREEN) {
                    this._transitionTo(PPG_STATES.GREEN, '保持不動，正在讀取...');
                } else if (coverage >= COVERAGE_YELLOW) {
                    this._transitionTo(PPG_STATES.YELLOW, '繼續調整手指位置');
                }
                break;

            case PPG_STATES.YELLOW:
                if (coverage >= COVERAGE_GREEN) {
                    this._transitionTo(PPG_STATES.GREEN, '保持不動，信號建立中...');
                } else if (coverage < COVERAGE_YELLOW - 0.05) {
                    this._transitionTo(PPG_STATES.RED, '手指位置偏移，請重新調整');
                }
                break;

            case PPG_STATES.GREEN:
                if (coverage < COVERAGE_YELLOW - 0.05) {
                    this._lockFrameCount = 0;
                    this._transitionTo(PPG_STATES.RED, '手指移開了，請重新放置');
                    break;
                }

                if (coverage >= LOCK_MIN_COVERAGE && quality >= LOCK_QUALITY_THRESHOLD) {
                    this._lockFrameCount++;
                    if (this._lockFrameCount >= LOCK_STABLE_FRAMES) {
                        this._transitionTo(PPG_STATES.LOCKED, '信號已鎖定 ✓');
                    }
                } else {
                    this._lockFrameCount = Math.max(0, this._lockFrameCount - 1);
                }
                break;

            case PPG_STATES.LOCKED:
                break;
        }

        if (coverage < DEGRADATION_COVERAGE_THRESHOLD &&
            this._state !== PPG_STATES.DETECTING &&
            this._state !== PPG_STATES.INIT) {
            this._degradationFrameCount++;
            if (this._degradationFrameCount >= DEGRADATION_FRAMES) {
                this._degradationFrameCount = 0;
                this._tryROIFallback();
            }
        } else {
            this._degradationFrameCount = Math.max(0, this._degradationFrameCount - 1);
        }
    }

    _transitionTo(newState, hint = '') {
        if (this._state === newState) return;

        this._prevState = this._state;
        this._state = newState;
        this._stateEnteredTs = Date.now();

        const timeMs = this.elapsedMs;

        this._stateTransitions.push({
            from: this._prevState,
            to: newState,
            time_ms: timeMs,
        });

        this._log(`🔄 ${this._prevState} → ${newState} (+${timeMs}ms)`);

        if (typeof window !== 'undefined' && window.EventBridgeV2) {
            window.EventBridgeV2.emitPPGState(newState, this._prevState, hint);
        }

        if (newState === PPG_STATES.LOCKED) {
            this._clearTimers();
            this._onCalibrationComplete();
        }

        if (newState === PPG_STATES.ERROR) {
            this._clearTimers();
        }
    }

    _onCalibrationComplete() {
        const lastSample = this._signalAnalyzer.getLastResult();
        const bpm = this._lastGoodBPM || lastSample?.hr_bpm || 72;
        const quality = this._lastGoodQuality || lastSample?.quality || 0;

        const greenTransition = this._stateTransitions.find(t => t.to === 'GREEN');
        const lockedTransition = this._stateTransitions.find(t => t.to === 'LOCKED');

        const metrics = {
            v: 1,
            ts: Date.now(),
            session_id: this._sessionId,
            time_to_aligned_ms: greenTransition?.time_ms ?? this.elapsedMs,
            time_to_signal_lock_ms: lockedTransition?.time_ms ?? this.elapsedMs,
            final_quality: Math.round(quality * 1000) / 1000,
            bpm_estimate: Math.round(bpm * 10) / 10,
            state_transitions: this._stateTransitions.slice(),
            coverage_history: this._coverageHistory.slice(),
        };

        this._log(`[OK] 校準完成！BPM=${bpm}, quality=${quality.toFixed(2)}`);

        if (typeof window !== 'undefined' && window.EventBridgeV2) {
            window.EventBridgeV2.emitPPGComplete(metrics);
        }
    }

    // ── 私有：ROI 降級 ──

    _tryROIFallback() {
        if (!this._enableROIFallback) return;

        this._roiFallbackIdx++;
        if (this._roiFallbackIdx >= ROI_FALLBACK_ORDER.length) {
            this._log('[WARN] 所有 ROI 策略均已嘗試，進入 ERROR 狀態');
            this._transitionTo(PPG_STATES.ERROR, '無法偵測有效信號，請確保光線充足');
            return;
        }

        const nextROI = ROI_FALLBACK_ORDER[this._roiFallbackIdx];
        if (this._fingerDetector) {
            this._fingerDetector.setROIStrategy(nextROI);
        }
        this._log(`🔄 ROI 降級: ${ROI_FALLBACK_ORDER[this._roiFallbackIdx - 1]} → ${nextROI}`);

        if (typeof window !== 'undefined' && window.EventBridgeV2) {
            window.EventBridgeV2.dispatchEvent(
                new CustomEvent('tenki:ppg-roi-fallback', {
                    detail: {
                        from: ROI_FALLBACK_ORDER[this._roiFallbackIdx - 1],
                        to: nextROI,
                        ts: Date.now(),
                    }
                })
            );
        }
    }

    // ── 私有：工具 ──

    _recordCoverageHistory(coverage) {
        const now = Date.now();
        if (now - this._lastCoverageHistoryTs >= COVERAGE_HISTORY_INTERVAL_MS) {
            this._coverageHistory.push({
                time_ms: this.elapsedMs,
                coverage: Math.round(coverage * 1000) / 1000,
            });
            this._lastCoverageHistoryTs = now;
        }
    }

    _ensureDependencies() {
        if (!this._fingerDetector) {
            if (typeof FingerDetector !== 'undefined') {
                this._fingerDetector = new FingerDetector({ verbose: this._verbose });
            } else if (typeof window !== 'undefined' && window.FingerDetector) {
                this._fingerDetector = new window.FingerDetector({ verbose: this._verbose });
            } else {
                throw new Error('[PPGCalibration] FingerDetector 未載入');
            }
        }

        if (!this._signalAnalyzer) {
            if (typeof SignalAnalyzer !== 'undefined') {
                this._signalAnalyzer = new SignalAnalyzer({ verbose: this._verbose });
            } else if (typeof window !== 'undefined' && window.SignalAnalyzer) {
                this._signalAnalyzer = new window.SignalAnalyzer({ verbose: this._verbose });
            } else {
                throw new Error('[PPGCalibration] SignalAnalyzer 未載入');
            }
        }
    }

    _clearTimers() {
        if (this._detectTimeoutTimer) {
            clearTimeout(this._detectTimeoutTimer);
            this._detectTimeoutTimer = null;
        }
        if (this._lockTimeoutTimer) {
            clearTimeout(this._lockTimeoutTimer);
            this._lockTimeoutTimer = null;
        }
    }

    _generateSessionId() {
        const rand = Math.random().toString(36).slice(2, 6);
        return `ppg_${Date.now()}_${rand}`;
    }

    _log(msg) {
        if (this._verbose) {
            console.log(`[PPGCalibration] ${msg}`);
        }
    }
}


// ─────────────────────────────────────────────────────────────────────────────
// Export
// ─────────────────────────────────────────────────────────────────────────────

if (typeof window !== 'undefined') {
    window.PPGCalibration = PPGCalibration;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        PPGCalibration,
        PPG_STATES,
        COVERAGE_GREEN,
        COVERAGE_YELLOW,
        LOCK_QUALITY_THRESHOLD,
        LOCK_STABLE_FRAMES,
        ROI_FALLBACK_ORDER,
    };
}
