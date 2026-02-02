/**
 * TENKI PRO - Decision Timer Engine v1.0
 * 
 * 決策計時器狀態機 - 管理交易決策的計時與狀態
 * 
 * 狀態流程: IDLE → PREVIEW → RUNNING → COMPLETE/TIMEOUT/ABORT
 * 
 * 設計原則:
 * 1. 純邏輯模組，不涉及 DOM 操作
 * 2. 透過 EventBridge 發送所有狀態更新
 * 3. 完全獨立，不修改任何現有檔案
 * 
 * @author TENKI Team
 * @version 1.0.0
 */

const DecisionTimer = (function () {
    'use strict';

    // =============================================================================
    // CONSTANTS
    // =============================================================================

    /**
     * 計時器狀態枚舉
     * @enum {string}
     */
    const STATES = {
        IDLE: 'IDLE',           // 閒置 - 計時器未啟動
        PREVIEW: 'PREVIEW',     // 預覽 - 顯示歷史統計
        RUNNING: 'RUNNING',     // 運行 - 計時中
        PAUSED: 'PAUSED',       // 暫停 - 計時暫停
        COMPLETE: 'COMPLETE',   // 完成 - 使用者提前決策
        TIMEOUT: 'TIMEOUT',     // 超時 - 耐心等待完成
        ABORT: 'ABORT'          // 中斷 - 使用者取消
    };

    /**
     * 進場類型枚舉
     * @enum {string}
     */
    const ENTRY_TYPES = {
        EARLY: 'EARLY',         // 提前進場
        TIMEOUT: 'TIMEOUT',     // 等到超時
        ABORT: 'ABORT'          // 中斷取消
    };

    /**
     * 交易模板 ID 枚舉
     * @enum {string}
     */
    const TEMPLATE_IDS = {
        CANSILM_GROWTH: 'CANSILM_GROWTH',
        CANSILM_HIGHRS: 'CANSILM_HIGHRS',
        MANCINI_FBD: 'MANCINI_FBD',
        FOCUS_SESSION: 'FOCUS_SESSION',
        RECOVERY_BREAK: 'RECOVERY_BREAK'
    };

    /**
     * 預設交易模板配置
     * @type {Object.<string, Object>}
     */
    const DEFAULT_TEMPLATES = {
        [TEMPLATE_IDS.CANSILM_GROWTH]: {
            id: TEMPLATE_IDS.CANSILM_GROWTH,
            name: 'Cansilm 通用成長股',
            duration: 300, // 5 分鐘
            segments: [
                { end: 90, label: 'No chase', hint: '不追高' },
                { end: 210, label: 'Watch EMA + volume', hint: '觀察均線與成交量' },
                { end: 300, label: 'Sweet zone', hint: '最佳進場區' }
            ],
            timeoutMessage: 'No FOMO today'
        },
        [TEMPLATE_IDS.CANSILM_HIGHRS]: {
            id: TEMPLATE_IDS.CANSILM_HIGHRS,
            name: 'Cansilm High RS Breakout',
            duration: 240, // 4 分鐘
            segments: [
                { end: 60, label: 'Hold', hint: '等待' },
                { end: 150, label: 'RS + Volume', hint: '相對強度與量' },
                { end: 240, label: 'Breakout ready', hint: '突破準備' }
            ],
            timeoutMessage: 'Patience pays'
        },
        [TEMPLATE_IDS.MANCINI_FBD]: {
            id: TEMPLATE_IDS.MANCINI_FBD,
            name: 'Mancini FBD',
            duration: 180, // 3 分鐘
            segments: [
                { end: 60, label: 'No entry', hint: '不進場' },
                { end: 140, label: 'Watch acceptance', hint: '觀察接受度' },
                { end: 180, label: 'Setup breathing', hint: '準備呼吸' }
            ],
            timeoutMessage: 'Boring = good'
        },
        [TEMPLATE_IDS.FOCUS_SESSION]: {
            id: TEMPLATE_IDS.FOCUS_SESSION,
            name: 'Focus Session',
            duration: 1500, // 25 分鐘
            segments: [
                { end: 300, label: 'Warm up', hint: '暖身' },
                { end: 900, label: 'Deep focus', hint: '深度專注' },
                { end: 1500, label: 'Finish strong', hint: '完成衝刺' }
            ],
            timeoutMessage: 'Well done!'
        },
        [TEMPLATE_IDS.RECOVERY_BREAK]: {
            id: TEMPLATE_IDS.RECOVERY_BREAK,
            name: 'Recovery Break',
            duration: 300, // 5 分鐘
            segments: [
                { end: 120, label: 'Breathe', hint: '呼吸' },
                { end: 300, label: 'Stretch', hint: '伸展' }
            ],
            timeoutMessage: 'Refreshed!'
        }
    };

    // =============================================================================
    // DECISION TIMER CLASS
    // =============================================================================

    /**
     * 決策計時器類別
     */
    class DecisionTimerEngine {
        /**
         * 建立新的決策計時器
         * 
         * @param {Object} [config={}] - 配置選項
         * @param {Object} [config.template] - 初始模板
         * @param {Function} [config.onStateChange] - 狀態變化回調
         * @param {Function} [config.onTick] - 每秒回調
         * @param {Function} [config.onSegmentChange] - 區段變化回調
         */
        constructor(config = {}) {
            // 模板配置
            this.template = config.template || null;
            this.duration = 0;
            this.segments = [];

            // 狀態管理
            this.state = STATES.IDLE;
            this.previousState = null;

            // 時間追蹤 (毫秒)
            this.startTime = null;
            this.pauseTime = null;
            this.pausedDuration = 0;
            this.endTime = null;

            // 區段追蹤
            this.currentSegmentIndex = -1;
            this.previousSegmentIndex = -1;

            // 計時器參考
            this._tickInterval = null;
            this._warningTimeout = null;

            // 元資料 (用於記錄)
            this.metadata = {
                tei: null,
                templateId: null,
                startTimestamp: null,
                endTimestamp: null,
                entryType: null,
                notes: ''
            };

            // 事件回調
            this._callbacks = {
                onStateChange: config.onStateChange || null,
                onTick: config.onTick || null,
                onSegmentChange: config.onSegmentChange || null
            };

            // 持久化 key
            this._storageKey = 'tenki_decision_timer_state';

            // 嘗試恢復狀態
            this._restoreState();
        }

        // =========================================================================
        // STATE MANAGEMENT
        // =========================================================================

        /**
         * 轉換到新狀態
         * @private
         * @param {string} newState - 新狀態
         * @param {Object} [data={}] - 額外資料
         */
        _setState(newState, data = {}) {
            if (!Object.values(STATES).includes(newState)) {
                console.error('[DecisionTimer] Invalid state:', newState);
                return false;
            }

            this.previousState = this.state;
            this.state = newState;

            const eventData = {
                previousState: this.previousState,
                currentState: this.state,
                template: this.template,
                timestamp: Date.now(),
                ...data
            };

            // 透過 EventBridge 發送事件 (如果可用)
            if (typeof EventBridge !== 'undefined') {
                EventBridge.notifyDecisionState(this.state, eventData);
            }

            // 呼叫回調
            if (this._callbacks.onStateChange) {
                this._callbacks.onStateChange(eventData);
            }

            // 持久化狀態
            this._persistState();

            return true;
        }

        /**
         * 檢查是否可以轉換到目標狀態
         * @private
         * @param {string} targetState - 目標狀態
         * @returns {boolean}
         */
        _canTransitionTo(targetState) {
            const validTransitions = {
                [STATES.IDLE]: [STATES.PREVIEW],
                [STATES.PREVIEW]: [STATES.RUNNING, STATES.ABORT, STATES.IDLE],
                [STATES.RUNNING]: [STATES.PAUSED, STATES.COMPLETE, STATES.TIMEOUT, STATES.ABORT],
                [STATES.PAUSED]: [STATES.RUNNING, STATES.ABORT],
                [STATES.COMPLETE]: [STATES.IDLE],
                [STATES.TIMEOUT]: [STATES.IDLE],
                [STATES.ABORT]: [STATES.IDLE]
            };

            return validTransitions[this.state]?.includes(targetState) || false;
        }

        /**
         * 取得當前狀態
         * @returns {string}
         */
        getState() {
            return this.state;
        }

        /**
         * 檢查是否正在運行
         * @returns {boolean}
         */
        isRunning() {
            return this.state === STATES.RUNNING;
        }

        /**
         * 檢查是否已完成 (包含 COMPLETE, TIMEOUT, ABORT)
         * @returns {boolean}
         */
        isFinished() {
            return [STATES.COMPLETE, STATES.TIMEOUT, STATES.ABORT].includes(this.state);
        }

        // =========================================================================
        // TEMPLATE MANAGEMENT
        // =========================================================================

        /**
         * 設定計時器模板
         * 
         * @param {Object|string} template - 模板物件或模板 ID
         * @returns {boolean} 是否成功
         */
        setTemplate(template) {
            if (this.state !== STATES.IDLE) {
                console.warn('[DecisionTimer] Cannot change template while timer is active');
                return false;
            }

            // 如果是字串，從預設模板取得
            if (typeof template === 'string') {
                template = DEFAULT_TEMPLATES[template];
                if (!template) {
                    console.error('[DecisionTimer] Unknown template ID:', template);
                    return false;
                }
            }

            this.template = template;
            this.duration = template.duration || 300;
            this.segments = template.segments || [];
            this.metadata.templateId = template.id;

            // 發送模板選擇事件
            if (typeof EventBridge !== 'undefined') {
                EventBridge.notifyTemplateSelected(template);
            }

            return true;
        }

        /**
         * 取得所有可用模板
         * @returns {Object}
         */
        static getTemplates() {
            return { ...DEFAULT_TEMPLATES };
        }

        /**
         * 取得單一模板
         * @param {string} id - 模板 ID
         * @returns {Object|null}
         */
        static getTemplate(id) {
            return DEFAULT_TEMPLATES[id] || null;
        }

        // =========================================================================
        // TIMER CONTROLS
        // =========================================================================

        /**
         * 設定當前 TEI 值
         * 
         * @param {number} tei - TEI 值 (1-99)
         */
        setTEI(tei) {
            this.metadata.tei = Math.max(1, Math.min(99, Math.round(tei)));
        }

        /**
         * 開始計時器 - 進入 PREVIEW 狀態
         * 
         * @param {Object} [options={}] - 選項
         * @param {number} [options.tei] - 當前 TEI 值
         * @param {boolean} [options.skipPreview=false] - 跳過預覽直接開始
         * @returns {boolean} 是否成功
         */
        start(options = {}) {
            if (!this.template) {
                console.error('[DecisionTimer] No template set');
                return false;
            }

            if (!this._canTransitionTo(STATES.PREVIEW)) {
                console.warn('[DecisionTimer] Cannot start from current state:', this.state);
                return false;
            }

            // 設定 TEI
            if (options.tei !== undefined) {
                this.setTEI(options.tei);
            }

            // 重置計時器值
            this.startTime = null;
            this.pauseTime = null;
            this.pausedDuration = 0;
            this.endTime = null;
            this.currentSegmentIndex = -1;
            this.previousSegmentIndex = -1;

            this.metadata.startTimestamp = Date.now();
            this.metadata.endTimestamp = null;
            this.metadata.entryType = null;

            // 發送決策開始事件
            if (typeof EventBridge !== 'undefined') {
                EventBridge.notifyDecisionStart({
                    template: this.template.name,
                    templateId: this.template.id,
                    duration: this.duration,
                    tei: this.metadata.tei
                });
            }

            // 轉換到 PREVIEW 狀態
            this._setState(STATES.PREVIEW);

            // 如果跳過預覽，直接確認
            if (options.skipPreview) {
                return this.confirm();
            }

            return true;
        }

        /**
         * 確認並開始實際計時 - 從 PREVIEW 轉換到 RUNNING
         * 
         * @returns {boolean} 是否成功
         */
        confirm() {
            if (!this._canTransitionTo(STATES.RUNNING)) {
                console.warn('[DecisionTimer] Cannot confirm from current state:', this.state);
                return false;
            }

            // 開始計時
            this.startTime = Date.now();
            this.currentSegmentIndex = 0;

            // 轉換狀態
            this._setState(STATES.RUNNING, {
                segment: this._getCurrentSegment()
            });

            // 開始每秒更新
            this._startTicking();

            return true;
        }

        /**
         * 暫停計時器
         * 
         * @returns {boolean} 是否成功
         */
        pause() {
            if (!this._canTransitionTo(STATES.PAUSED)) {
                console.warn('[DecisionTimer] Cannot pause from current state:', this.state);
                return false;
            }

            this.pauseTime = Date.now();
            this._stopTicking();
            this._setState(STATES.PAUSED);

            return true;
        }

        /**
         * 恢復計時器
         * 
         * @returns {boolean} 是否成功
         */
        resume() {
            if (!this._canTransitionTo(STATES.RUNNING)) {
                console.warn('[DecisionTimer] Cannot resume from current state:', this.state);
                return false;
            }

            // 計算暫停時長
            if (this.pauseTime) {
                this.pausedDuration += Date.now() - this.pauseTime;
                this.pauseTime = null;
            }

            this._setState(STATES.RUNNING);
            this._startTicking();

            return true;
        }

        /**
         * 提前完成 (使用者決策)
         * 
         * @param {Object} [data={}] - 完成資料
         * @returns {boolean} 是否成功
         */
        complete(data = {}) {
            if (!this._canTransitionTo(STATES.COMPLETE)) {
                console.warn('[DecisionTimer] Cannot complete from current state:', this.state);
                return false;
            }

            this._finalize(STATES.COMPLETE, ENTRY_TYPES.EARLY, data);
            return true;
        }

        /**
         * 中斷計時器
         * 
         * @returns {boolean} 是否成功
         */
        abort() {
            if (!this._canTransitionTo(STATES.ABORT)) {
                console.warn('[DecisionTimer] Cannot abort from current state:', this.state);
                return false;
            }

            this._finalize(STATES.ABORT, ENTRY_TYPES.ABORT);
            return true;
        }

        /**
         * 重置計時器到 IDLE
         * 
         * @returns {boolean} 是否成功
         */
        reset() {
            this._stopTicking();

            this.state = STATES.IDLE;
            this.previousState = null;
            this.startTime = null;
            this.pauseTime = null;
            this.pausedDuration = 0;
            this.endTime = null;
            this.currentSegmentIndex = -1;
            this.previousSegmentIndex = -1;

            this.metadata = {
                tei: this.metadata.tei, // 保留 TEI
                templateId: this.template?.id,
                startTimestamp: null,
                endTimestamp: null,
                entryType: null,
                notes: ''
            };

            this._clearPersistedState();

            if (typeof EventBridge !== 'undefined') {
                EventBridge.notifyDecisionState(STATES.IDLE, {});
            }

            return true;
        }

        // =========================================================================
        // TIMING
        // =========================================================================

        /**
         * 開始每秒更新
         * @private
         */
        _startTicking() {
            this._stopTicking(); // 確保沒有重複

            this._tickInterval = setInterval(() => {
                this._tick();
            }, 1000);

            // 立即執行一次
            this._tick();
        }

        /**
         * 停止每秒更新
         * @private
         */
        _stopTicking() {
            if (this._tickInterval) {
                clearInterval(this._tickInterval);
                this._tickInterval = null;
            }
            if (this._warningTimeout) {
                clearTimeout(this._warningTimeout);
                this._warningTimeout = null;
            }
        }

        /**
         * 每秒更新處理
         * @private
         */
        _tick() {
            if (this.state !== STATES.RUNNING) return;

            const elapsed = this.getElapsedSeconds();
            const remaining = this.getRemainingSeconds();
            const progress = this.getProgress();
            const segment = this._getCurrentSegment();

            // 檢查區段變化
            const newSegmentIndex = this._getSegmentIndex(elapsed);
            if (newSegmentIndex !== this.currentSegmentIndex) {
                this.previousSegmentIndex = this.currentSegmentIndex;
                this.currentSegmentIndex = newSegmentIndex;

                // 呼叫區段變化回調
                if (this._callbacks.onSegmentChange) {
                    this._callbacks.onSegmentChange({
                        previousIndex: this.previousSegmentIndex,
                        currentIndex: this.currentSegmentIndex,
                        segment: segment
                    });
                }
            }

            // 發送進度事件
            if (typeof EventBridge !== 'undefined') {
                EventBridge.notifyDecisionProgress({
                    elapsed,
                    remaining,
                    percentage: progress,
                    segment: this.currentSegmentIndex,
                    segmentLabel: segment?.label || ''
                });
            }

            // 呼叫 tick 回調
            if (this._callbacks.onTick) {
                this._callbacks.onTick({
                    elapsed,
                    remaining,
                    progress,
                    segment
                });
            }

            // 檢查是否超時
            if (remaining <= 0) {
                this._timeout();
            }
        }

        /**
         * 處理超時
         * @private
         */
        _timeout() {
            this._finalize(STATES.TIMEOUT, ENTRY_TYPES.TIMEOUT);
        }

        /**
         * 完成計時器 (通用)
         * @private
         * @param {string} state - 結束狀態
         * @param {string} entryType - 進場類型
         * @param {Object} [data={}] - 額外資料
         */
        _finalize(state, entryType, data = {}) {
            this._stopTicking();

            this.endTime = Date.now();
            this.metadata.endTimestamp = this.endTime;
            this.metadata.entryType = entryType;

            const elapsed = this.getElapsedSeconds();

            // 發送完成事件
            if (typeof EventBridge !== 'undefined') {
                EventBridge.notifyDecisionComplete({
                    template: this.template?.name,
                    templateId: this.template?.id,
                    elapsed,
                    entryType,
                    tei: this.metadata.tei,
                    ...data
                });
            }

            this._setState(state, {
                elapsed,
                entryType,
                ...data
            });
        }

        // =========================================================================
        // GETTERS
        // =========================================================================

        /**
         * 取得已經過的秒數
         * @returns {number}
         */
        getElapsedSeconds() {
            if (!this.startTime) return 0;

            const now = this.pauseTime || Date.now();
            const elapsed = now - this.startTime - this.pausedDuration;
            return Math.max(0, Math.floor(elapsed / 1000));
        }

        /**
         * 取得剩餘秒數
         * @returns {number}
         */
        getRemainingSeconds() {
            return Math.max(0, this.duration - this.getElapsedSeconds());
        }

        /**
         * 取得進度百分比 (0-100)
         * @returns {number}
         */
        getProgress() {
            if (this.duration === 0) return 0;
            return Math.min(100, (this.getElapsedSeconds() / this.duration) * 100);
        }

        /**
         * 取得當前區段
         * @private
         * @returns {Object|null}
         */
        _getCurrentSegment() {
            const index = this._getSegmentIndex(this.getElapsedSeconds());
            return this.segments[index] || null;
        }

        /**
         * 取得指定時間的區段索引
         * @private
         * @param {number} elapsed - 已經過秒數
         * @returns {number}
         */
        _getSegmentIndex(elapsed) {
            for (let i = 0; i < this.segments.length; i++) {
                if (elapsed < this.segments[i].end) {
                    return i;
                }
            }
            return this.segments.length - 1;
        }

        /**
         * 取得當前區段標籤
         * @returns {string}
         */
        getCurrentSegmentLabel() {
            const segment = this._getCurrentSegment();
            return segment?.label || '';
        }

        /**
         * 取得當前區段提示
         * @returns {string}
         */
        getCurrentSegmentHint() {
            const segment = this._getCurrentSegment();
            return segment?.hint || '';
        }

        /**
         * 取得格式化的剩餘時間
         * @returns {string} MM:SS 格式
         */
        getFormattedTime() {
            const remaining = this.getRemainingSeconds();
            const minutes = Math.floor(remaining / 60);
            const seconds = remaining % 60;
            return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }

        /**
         * 取得元資料 (用於記錄交易)
         * @returns {Object}
         */
        getMetadata() {
            return {
                ...this.metadata,
                elapsed: this.getElapsedSeconds()
            };
        }

        // =========================================================================
        // PERSISTENCE
        // =========================================================================

        /**
         * 持久化當前狀態到 localStorage
         * @private
         */
        _persistState() {
            try {
                const data = {
                    state: this.state,
                    templateId: this.template?.id,
                    startTime: this.startTime,
                    pauseTime: this.pauseTime,
                    pausedDuration: this.pausedDuration,
                    duration: this.duration,
                    metadata: this.metadata,
                    savedAt: Date.now()
                };
                localStorage.setItem(this._storageKey, JSON.stringify(data));
            } catch (e) {
                console.warn('[DecisionTimer] Failed to persist state:', e);
            }
        }

        /**
         * 從 localStorage 恢復狀態
         * @private
         */
        _restoreState() {
            try {
                const saved = localStorage.getItem(this._storageKey);
                if (!saved) return false;

                const data = JSON.parse(saved);

                // 檢查是否過期 (超過 1 小時)
                if (Date.now() - data.savedAt > 3600000) {
                    this._clearPersistedState();
                    return false;
                }

                // 只恢復運行中的狀態
                if (data.state === STATES.RUNNING || data.state === STATES.PAUSED) {
                    // 恢復模板
                    if (data.templateId && DEFAULT_TEMPLATES[data.templateId]) {
                        this.setTemplate(data.templateId);
                    }

                    // 恢復時間
                    this.startTime = data.startTime;
                    this.pauseTime = data.pauseTime;
                    this.pausedDuration = data.pausedDuration;
                    this.duration = data.duration;
                    this.metadata = data.metadata;

                    // 恢復狀態
                    this.state = data.state;

                    // 如果是運行中，重新開始 tick
                    if (this.state === STATES.RUNNING) {
                        this._startTicking();
                    }

                    console.log('[DecisionTimer] State restored:', this.state);
                    return true;
                }

                this._clearPersistedState();
                return false;

            } catch (e) {
                console.warn('[DecisionTimer] Failed to restore state:', e);
                return false;
            }
        }

        /**
         * 清除持久化狀態
         * @private
         */
        _clearPersistedState() {
            try {
                localStorage.removeItem(this._storageKey);
            } catch (e) {
                // 忽略
            }
        }

        // =========================================================================
        // CALLBACKS
        // =========================================================================

        /**
         * 設定狀態變化回調
         * @param {Function} callback
         */
        onStateChange(callback) {
            this._callbacks.onStateChange = callback;
        }

        /**
         * 設定每秒回調
         * @param {Function} callback
         */
        onTick(callback) {
            this._callbacks.onTick = callback;
        }

        /**
         * 設定區段變化回調
         * @param {Function} callback
         */
        onSegmentChange(callback) {
            this._callbacks.onSegmentChange = callback;
        }

        // =========================================================================
        // CLEANUP
        // =========================================================================

        /**
         * 銷毀計時器
         */
        destroy() {
            this._stopTicking();
            this._clearPersistedState();
            this._callbacks = {
                onStateChange: null,
                onTick: null,
                onSegmentChange: null
            };
        }
    }

    // =============================================================================
    // PUBLIC API
    // =============================================================================

    return {
        // Classes
        DecisionTimerEngine,

        // Constants
        STATES,
        ENTRY_TYPES,
        TEMPLATE_IDS,

        // Static Methods
        getTemplates: DecisionTimerEngine.getTemplates,
        getTemplate: DecisionTimerEngine.getTemplate,

        /**
         * 建立新的計時器實例
         * @param {Object} [config] - 配置
         * @returns {DecisionTimerEngine}
         */
        create(config = {}) {
            return new DecisionTimerEngine(config);
        }
    };

})();

// =============================================================================
// USAGE EXAMPLES
// =============================================================================
/*

// 建立計時器
const timer = DecisionTimer.create();

// 設定模板
timer.setTemplate('CANSILM_GROWTH');

// 設定 TEI
timer.setTEI(72);

// 設定回調
timer.onStateChange((data) => {
    console.log('State changed:', data.currentState);
});

timer.onTick((data) => {
    console.log('Time:', data.remaining, 'Segment:', data.segment?.label);
});

// 開始 (進入 PREVIEW)
timer.start();

// 確認開始計時 (進入 RUNNING)
timer.confirm();

// 或者跳過預覽直接開始
// timer.start({ skipPreview: true, tei: 72 });

// 提前完成
// timer.complete();

// 等待超時自動進入 TIMEOUT 狀態

// 中斷
// timer.abort();

// 重置
// timer.reset();

*/

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DecisionTimer;
}
