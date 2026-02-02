/**
 * TENKI PRO - Event Bridge v1.0
 * 
 * 事件橋接器 - 連接 TENKI PRO 新功能與星塵靈魂視覺系統
 * 
 * 設計原則:
 * 1. 只發送事件，不修改原始碼
 * 2. 星塵靈魂選擇性監聽事件
 * 3. 雙向解耦，互不依賴
 * 4. 完全獨立，不依賴任何現有檔案
 * 
 * @author TENKI Team
 * @version 1.0.0
 * @license MIT
 */

const EventBridge = (function() {
    'use strict';

    // =============================================================================
    // CONSTANTS
    // =============================================================================

    /**
     * 事件命名空間
     * @constant {string}
     */
    const NAMESPACE = 'tenki';

    /**
     * 事件類型枚舉
     * @enum {string}
     */
    const EVENT_TYPES = {
        // TEI 相關事件
        TEI_UPDATED: `${NAMESPACE}:tei-updated`,
        TEI_CALIBRATED: `${NAMESPACE}:tei-calibrated`,
        
        // 決策計時器事件
        DECISION_STATE: `${NAMESPACE}:decision-state`,
        DECISION_START: `${NAMESPACE}:decision-start`,
        DECISION_PROGRESS: `${NAMESPACE}:decision-progress`,
        DECISION_COMPLETE: `${NAMESPACE}:decision-complete`,
        DECISION_TIMEOUT: `${NAMESPACE}:decision-timeout`,
        DECISION_ABORT: `${NAMESPACE}:decision-abort`,
        
        // 統計事件
        STATS_UPDATED: `${NAMESPACE}:stats-updated`,
        TRADE_RECORDED: `${NAMESPACE}:trade-recorded`,
        
        // 模板事件
        TEMPLATE_SELECTED: `${NAMESPACE}:template-selected`,
        TEMPLATE_LOADED: `${NAMESPACE}:template-loaded`,
        
        // 預覽事件
        PREVIEW_GENERATED: `${NAMESPACE}:preview-generated`,
        PREVIEW_DISMISSED: `${NAMESPACE}:preview-dismissed`,
        
        // AI 行為事件
        BEHAVIOR_ANALYZED: `${NAMESPACE}:behavior-analyzed`,
        CLUSTER_UPDATED: `${NAMESPACE}:cluster-updated`,
        
        // 系統事件
        SYSTEM_READY: `${NAMESPACE}:system-ready`,
        SYSTEM_ERROR: `${NAMESPACE}:system-error`,
        
        // 來自星塵靈魂的事件 (監聽用)
        STARDUST_STATE_CHANGED: 'stardust:state-changed',
        STARDUST_HR_UPDATED: 'stardust:hr-updated'
    };

    /**
     * 事件來源枚舉
     * @enum {string}
     */
    const SOURCES = {
        DECISION_TIMER: 'decision-timer',
        PR_EXPECTANCY: 'pr-expectancy',
        AI_BEHAVIOR: 'ai-behavior',
        DATABASE: 'database',
        UI_CONTROLLER: 'ui-controller',
        TEMPLATE_MANAGER: 'template-manager',
        STARDUST: 'stardust'
    };

    // =============================================================================
    // INTERNAL STATE
    // =============================================================================

    /**
     * 事件歷史記錄 (用於除錯)
     * @type {Array<Object>}
     */
    const eventHistory = [];

    /**
     * 歷史記錄最大長度
     * @constant {number}
     */
    const MAX_HISTORY = 100;

    /**
     * 是否啟用除錯模式
     * @type {boolean}
     */
    let debugMode = false;

    // =============================================================================
    // UTILITY FUNCTIONS
    // =============================================================================

    /**
     * 記錄事件到歷史
     * @private
     * @param {string} type - 事件類型
     * @param {string} direction - 'emit' 或 'receive'
     * @param {Object} detail - 事件資料
     */
    function logEvent(type, direction, detail) {
        const entry = {
            type,
            direction,
            detail,
            timestamp: Date.now()
        };

        eventHistory.push(entry);

        // 限制歷史記錄大小
        if (eventHistory.length > MAX_HISTORY) {
            eventHistory.shift();
        }

        // 除錯輸出
        if (debugMode) {
            console.log(`[EventBridge] ${direction.toUpperCase()}: ${type}`, detail);
        }
    }

    /**
     * 建立自訂事件
     * @private
     * @param {string} type - 事件類型
     * @param {Object} detail - 事件資料
     * @returns {CustomEvent} 自訂事件
     */
    function createEvent(type, detail) {
        return new CustomEvent(type, {
            detail: {
                ...detail,
                timestamp: Date.now()
            },
            bubbles: true,
            cancelable: true
        });
    }

    // =============================================================================
    // TEI EVENTS
    // =============================================================================

    /**
     * 發送 TEI 更新事件
     * 星塵靈魂可選擇監聽此事件來改變粒子顏色
     * 
     * @param {number} tei - TEI 值 (1-99)
     * @param {string} source - 事件來源
     * @param {Object} [metadata={}] - 額外資料
     * 
     * @example
     * EventBridge.notifyTEIUpdate(72, 'decision-timer', { phase: 'running' });
     */
    function notifyTEIUpdate(tei, source, metadata = {}) {
        if (typeof tei !== 'number' || tei < 1 || tei > 99) {
            console.warn('[EventBridge] Invalid TEI value:', tei);
            return false;
        }

        const detail = {
            tei: Math.round(tei),
            source: source || SOURCES.UI_CONTROLLER,
            ...metadata
        };

        const event = createEvent(EVENT_TYPES.TEI_UPDATED, detail);
        logEvent(EVENT_TYPES.TEI_UPDATED, 'emit', detail);
        window.dispatchEvent(event);
        return true;
    }

    /**
     * 訂閱 TEI 更新事件
     * 
     * @param {Function} callback - 回調函數，接收 { tei, source, timestamp } 
     * @returns {Function} 取消訂閱函數
     * 
     * @example
     * const unsubscribe = EventBridge.onTEIUpdate((data) => {
     *   console.log('TEI updated to:', data.tei);
     * });
     * // 之後取消訂閱
     * unsubscribe();
     */
    function onTEIUpdate(callback) {
        if (typeof callback !== 'function') {
            console.error('[EventBridge] Callback must be a function');
            return () => {};
        }

        const handler = (e) => {
            logEvent(EVENT_TYPES.TEI_UPDATED, 'receive', e.detail);
            callback(e.detail);
        };

        window.addEventListener(EVENT_TYPES.TEI_UPDATED, handler);

        // 返回取消訂閱函數
        return () => {
            window.removeEventListener(EVENT_TYPES.TEI_UPDATED, handler);
        };
    }

    // =============================================================================
    // DECISION STATE EVENTS
    // =============================================================================

    /**
     * 發送決策狀態變化事件
     * 
     * @param {string} state - 狀態 ('IDLE' | 'PREVIEW' | 'RUNNING' | 'COMPLETE' | 'TIMEOUT' | 'ABORT')
     * @param {Object} data - 狀態資料
     * 
     * @example
     * EventBridge.notifyDecisionState('RUNNING', {
     *   template: 'CANSILM_GROWTH',
     *   elapsed: 45,
     *   remaining: 255,
     *   segment: 'No chase'
     * });
     */
    function notifyDecisionState(state, data = {}) {
        const validStates = ['IDLE', 'PREVIEW', 'RUNNING', 'PAUSED', 'COMPLETE', 'TIMEOUT', 'ABORT'];
        
        if (!validStates.includes(state)) {
            console.warn('[EventBridge] Invalid decision state:', state);
            return false;
        }

        const detail = {
            state,
            data
        };

        const event = createEvent(EVENT_TYPES.DECISION_STATE, detail);
        logEvent(EVENT_TYPES.DECISION_STATE, 'emit', detail);
        window.dispatchEvent(event);
        return true;
    }

    /**
     * 訂閱決策狀態變化事件
     * 
     * @param {Function} callback - 回調函數
     * @returns {Function} 取消訂閱函數
     */
    function onDecisionStateChange(callback) {
        if (typeof callback !== 'function') {
            console.error('[EventBridge] Callback must be a function');
            return () => {};
        }

        const handler = (e) => {
            logEvent(EVENT_TYPES.DECISION_STATE, 'receive', e.detail);
            callback(e.detail);
        };

        window.addEventListener(EVENT_TYPES.DECISION_STATE, handler);

        return () => {
            window.removeEventListener(EVENT_TYPES.DECISION_STATE, handler);
        };
    }

    /**
     * 發送決策開始事件
     * 
     * @param {Object} data - 模板資訊
     */
    function notifyDecisionStart(data) {
        const detail = {
            template: data.template,
            templateId: data.templateId,
            duration: data.duration,
            tei: data.tei
        };

        const event = createEvent(EVENT_TYPES.DECISION_START, detail);
        logEvent(EVENT_TYPES.DECISION_START, 'emit', detail);
        window.dispatchEvent(event);
    }

    /**
     * 發送決策進度事件
     * 
     * @param {Object} progress - 進度資訊
     */
    function notifyDecisionProgress(progress) {
        const detail = {
            elapsed: progress.elapsed,
            remaining: progress.remaining,
            percentage: progress.percentage,
            segment: progress.segment,
            segmentLabel: progress.segmentLabel
        };

        const event = createEvent(EVENT_TYPES.DECISION_PROGRESS, detail);
        logEvent(EVENT_TYPES.DECISION_PROGRESS, 'emit', detail);
        window.dispatchEvent(event);
    }

    /**
     * 發送決策完成事件
     * 
     * @param {Object} result - 完成結果
     */
    function notifyDecisionComplete(result) {
        const detail = {
            template: result.template,
            elapsed: result.elapsed,
            entryType: result.entryType,
            tei: result.tei
        };

        const event = createEvent(EVENT_TYPES.DECISION_COMPLETE, detail);
        logEvent(EVENT_TYPES.DECISION_COMPLETE, 'emit', detail);
        window.dispatchEvent(event);
    }

    // =============================================================================
    // STATS EVENTS
    // =============================================================================

    /**
     * 發送統計更新事件
     * 
     * @param {Object} stats - 統計資料
     */
    function notifyStatsUpdate(stats) {
        const detail = { stats };
        const event = createEvent(EVENT_TYPES.STATS_UPDATED, detail);
        logEvent(EVENT_TYPES.STATS_UPDATED, 'emit', detail);
        window.dispatchEvent(event);
    }

    /**
     * 訂閱統計更新事件
     * 
     * @param {Function} callback - 回調函數
     * @returns {Function} 取消訂閱函數
     */
    function onStatsUpdate(callback) {
        if (typeof callback !== 'function') {
            return () => {};
        }

        const handler = (e) => {
            logEvent(EVENT_TYPES.STATS_UPDATED, 'receive', e.detail);
            callback(e.detail);
        };

        window.addEventListener(EVENT_TYPES.STATS_UPDATED, handler);

        return () => {
            window.removeEventListener(EVENT_TYPES.STATS_UPDATED, handler);
        };
    }

    /**
     * 發送交易記錄事件
     * 
     * @param {Object} trade - 交易記錄
     */
    function notifyTradeRecorded(trade) {
        const detail = { trade };
        const event = createEvent(EVENT_TYPES.TRADE_RECORDED, detail);
        logEvent(EVENT_TYPES.TRADE_RECORDED, 'emit', detail);
        window.dispatchEvent(event);
    }

    // =============================================================================
    // TEMPLATE EVENTS
    // =============================================================================

    /**
     * 發送模板選擇事件
     * 
     * @param {Object} template - 模板資訊
     */
    function notifyTemplateSelected(template) {
        const detail = { template };
        const event = createEvent(EVENT_TYPES.TEMPLATE_SELECTED, detail);
        logEvent(EVENT_TYPES.TEMPLATE_SELECTED, 'emit', detail);
        window.dispatchEvent(event);
    }

    /**
     * 訂閱模板選擇事件
     * 
     * @param {Function} callback - 回調函數
     * @returns {Function} 取消訂閱函數
     */
    function onTemplateSelected(callback) {
        if (typeof callback !== 'function') {
            return () => {};
        }

        const handler = (e) => {
            logEvent(EVENT_TYPES.TEMPLATE_SELECTED, 'receive', e.detail);
            callback(e.detail);
        };

        window.addEventListener(EVENT_TYPES.TEMPLATE_SELECTED, handler);

        return () => {
            window.removeEventListener(EVENT_TYPES.TEMPLATE_SELECTED, handler);
        };
    }

    // =============================================================================
    // PREVIEW EVENTS
    // =============================================================================

    /**
     * 發送預覽生成事件
     * 
     * @param {Object} preview - 預覽資料
     */
    function notifyPreviewGenerated(preview) {
        const detail = { preview };
        const event = createEvent(EVENT_TYPES.PREVIEW_GENERATED, detail);
        logEvent(EVENT_TYPES.PREVIEW_GENERATED, 'emit', detail);
        window.dispatchEvent(event);
    }

    /**
     * 訂閱預覽生成事件
     * 
     * @param {Function} callback - 回調函數
     * @returns {Function} 取消訂閱函數
     */
    function onPreviewGenerated(callback) {
        if (typeof callback !== 'function') {
            return () => {};
        }

        const handler = (e) => {
            callback(e.detail);
        };

        window.addEventListener(EVENT_TYPES.PREVIEW_GENERATED, handler);

        return () => {
            window.removeEventListener(EVENT_TYPES.PREVIEW_GENERATED, handler);
        };
    }

    // =============================================================================
    // AI BEHAVIOR EVENTS
    // =============================================================================

    /**
     * 發送行為分析事件
     * 
     * @param {Object} analysis - 分析結果
     */
    function notifyBehaviorAnalyzed(analysis) {
        const detail = { analysis };
        const event = createEvent(EVENT_TYPES.BEHAVIOR_ANALYZED, detail);
        logEvent(EVENT_TYPES.BEHAVIOR_ANALYZED, 'emit', detail);
        window.dispatchEvent(event);
    }

    /**
     * 訂閱行為分析事件
     * 
     * @param {Function} callback - 回調函數
     * @returns {Function} 取消訂閱函數
     */
    function onBehaviorAnalyzed(callback) {
        if (typeof callback !== 'function') {
            return () => {};
        }

        const handler = (e) => {
            callback(e.detail);
        };

        window.addEventListener(EVENT_TYPES.BEHAVIOR_ANALYZED, handler);

        return () => {
            window.removeEventListener(EVENT_TYPES.BEHAVIOR_ANALYZED, handler);
        };
    }

    // =============================================================================
    // STARDUST INTEGRATION (監聽星塵靈魂事件)
    // =============================================================================

    /**
     * 訂閱星塵靈魂的狀態變化事件
     * 這允許新模組對星塵的變化做出反應
     * 
     * @param {Function} callback - 回調函數
     * @returns {Function} 取消訂閱函數
     * 
     * @example
     * EventBridge.listenToStardust((data) => {
     *   console.log('Stardust state changed:', data);
     * });
     */
    function listenToStardust(callback) {
        if (typeof callback !== 'function') {
            return () => {};
        }

        const handler = (e) => {
            logEvent(EVENT_TYPES.STARDUST_STATE_CHANGED, 'receive', e.detail);
            callback(e.detail);
        };

        window.addEventListener(EVENT_TYPES.STARDUST_STATE_CHANGED, handler);

        return () => {
            window.removeEventListener(EVENT_TYPES.STARDUST_STATE_CHANGED, handler);
        };
    }

    /**
     * 訂閱星塵靈魂的心率更新事件
     * 
     * @param {Function} callback - 回調函數
     * @returns {Function} 取消訂閱函數
     */
    function listenToStardustHR(callback) {
        if (typeof callback !== 'function') {
            return () => {};
        }

        const handler = (e) => {
            logEvent(EVENT_TYPES.STARDUST_HR_UPDATED, 'receive', e.detail);
            callback(e.detail);
        };

        window.addEventListener(EVENT_TYPES.STARDUST_HR_UPDATED, handler);

        return () => {
            window.removeEventListener(EVENT_TYPES.STARDUST_HR_UPDATED, handler);
        };
    }

    // =============================================================================
    // SYSTEM EVENTS
    // =============================================================================

    /**
     * 發送系統就緒事件
     * 
     * @param {Object} info - 系統資訊
     */
    function notifySystemReady(info = {}) {
        const detail = {
            version: '1.0.0',
            modules: info.modules || [],
            ...info
        };

        const event = createEvent(EVENT_TYPES.SYSTEM_READY, detail);
        logEvent(EVENT_TYPES.SYSTEM_READY, 'emit', detail);
        window.dispatchEvent(event);
    }

    /**
     * 發送系統錯誤事件
     * 
     * @param {Error|string} error - 錯誤資訊
     * @param {string} source - 錯誤來源
     */
    function notifySystemError(error, source) {
        const detail = {
            error: error instanceof Error ? error.message : error,
            stack: error instanceof Error ? error.stack : null,
            source
        };

        const event = createEvent(EVENT_TYPES.SYSTEM_ERROR, detail);
        logEvent(EVENT_TYPES.SYSTEM_ERROR, 'emit', detail);
        window.dispatchEvent(event);
    }

    /**
     * 訂閱系統就緒事件
     * 
     * @param {Function} callback - 回調函數
     * @returns {Function} 取消訂閱函數
     */
    function onSystemReady(callback) {
        if (typeof callback !== 'function') {
            return () => {};
        }

        const handler = (e) => {
            callback(e.detail);
        };

        window.addEventListener(EVENT_TYPES.SYSTEM_READY, handler);

        return () => {
            window.removeEventListener(EVENT_TYPES.SYSTEM_READY, handler);
        };
    }

    // =============================================================================
    // GENERIC EVENT HELPERS
    // =============================================================================

    /**
     * 發送任意自訂事件
     * 用於擴展或特殊需求
     * 
     * @param {string} eventName - 事件名稱
     * @param {Object} detail - 事件資料
     */
    function emit(eventName, detail = {}) {
        const fullName = eventName.includes(':') ? eventName : `${NAMESPACE}:${eventName}`;
        const event = createEvent(fullName, detail);
        logEvent(fullName, 'emit', detail);
        window.dispatchEvent(event);
    }

    /**
     * 訂閱任意事件
     * 
     * @param {string} eventName - 事件名稱
     * @param {Function} callback - 回調函數
     * @returns {Function} 取消訂閱函數
     */
    function on(eventName, callback) {
        if (typeof callback !== 'function') {
            return () => {};
        }

        const fullName = eventName.includes(':') ? eventName : `${NAMESPACE}:${eventName}`;
        
        const handler = (e) => {
            logEvent(fullName, 'receive', e.detail);
            callback(e.detail);
        };

        window.addEventListener(fullName, handler);

        return () => {
            window.removeEventListener(fullName, handler);
        };
    }

    /**
     * 只訂閱一次事件
     * 
     * @param {string} eventName - 事件名稱
     * @param {Function} callback - 回調函數
     */
    function once(eventName, callback) {
        if (typeof callback !== 'function') {
            return;
        }

        const fullName = eventName.includes(':') ? eventName : `${NAMESPACE}:${eventName}`;
        
        const handler = (e) => {
            window.removeEventListener(fullName, handler);
            callback(e.detail);
        };

        window.addEventListener(fullName, handler);
    }

    // =============================================================================
    // DEBUG & UTILITIES
    // =============================================================================

    /**
     * 啟用/停用除錯模式
     * 
     * @param {boolean} enabled - 是否啟用
     */
    function setDebugMode(enabled) {
        debugMode = Boolean(enabled);
        console.log(`[EventBridge] Debug mode ${debugMode ? 'enabled' : 'disabled'}`);
    }

    /**
     * 取得事件歷史記錄
     * 
     * @param {number} [limit=50] - 返回的最大數目
     * @returns {Array<Object>} 事件歷史
     */
    function getEventHistory(limit = 50) {
        return eventHistory.slice(-limit);
    }

    /**
     * 清除事件歷史
     */
    function clearEventHistory() {
        eventHistory.length = 0;
    }

    // =============================================================================
    // PUBLIC API
    // =============================================================================

    return {
        // Constants
        EVENT_TYPES,
        SOURCES,

        // TEI Events
        notifyTEIUpdate,
        onTEIUpdate,

        // Decision Events
        notifyDecisionState,
        onDecisionStateChange,
        notifyDecisionStart,
        notifyDecisionProgress,
        notifyDecisionComplete,

        // Stats Events
        notifyStatsUpdate,
        onStatsUpdate,
        notifyTradeRecorded,

        // Template Events
        notifyTemplateSelected,
        onTemplateSelected,

        // Preview Events
        notifyPreviewGenerated,
        onPreviewGenerated,

        // AI Behavior Events
        notifyBehaviorAnalyzed,
        onBehaviorAnalyzed,

        // Stardust Integration
        listenToStardust,
        listenToStardustHR,

        // System Events
        notifySystemReady,
        notifySystemError,
        onSystemReady,

        // Generic Helpers
        emit,
        on,
        once,

        // Debug
        setDebugMode,
        getEventHistory,
        clearEventHistory
    };

})();

// =============================================================================
// USAGE EXAMPLES (For Reference Only)
// =============================================================================
/*

// ✅ 正確: 發送 TEI 更新 (星塵靈魂可選擇監聽)
EventBridge.notifyTEIUpdate(72, 'decision-timer');

// ✅ 正確: 訂閱 TEI 更新
const unsubscribe = EventBridge.onTEIUpdate((data) => {
    console.log('TEI:', data.tei, 'from:', data.source);
});

// ✅ 正確: 發送決策狀態
EventBridge.notifyDecisionState('RUNNING', {
    template: 'CANSILM_GROWTH',
    elapsed: 45,
    remaining: 255
});

// ✅ 正確: 監聽星塵靈魂的事件
EventBridge.listenToStardust((data) => {
    console.log('Stardust changed:', data);
});

// ❌ 錯誤: 直接調用星塵靈魂 (絕對不要這樣做!)
// StardustSoul.updateColor(72);  // NO!
// app.changeParticles(72);       // NO!

// 之後取消訂閱
// unsubscribe();

*/

// Export for module systems (if available)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = EventBridge;
}

// AMD support
if (typeof define === 'function' && define.amd) {
    define([], function() {
        return EventBridge;
    });
}
