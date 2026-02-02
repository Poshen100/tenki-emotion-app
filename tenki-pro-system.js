/**
 * TENKI PRO - System Integration v1.0
 * 
 * 主入口整合檔案
 * 初始化所有模組並設定模組間事件訂閱
 * 
 * 使用方式:
 * 1. 在 HTML 的 SAFE ZONE 區域載入此檔案
 * 2. 在所有 core 模組之後載入
 * 3. 呼叫 TenkiProSystem.init()
 * 
 * @author TENKI Team
 * @version 1.0.0
 */

const TenkiProSystem = (function () {
    'use strict';

    // =============================================================================
    // STATE
    // =============================================================================

    let isInitialized = false;
    let modules = {};

    // =============================================================================
    // INITIALIZATION
    // =============================================================================

    /**
     * 初始化 TENKI PRO 系統
     * 
     * @param {Object} [config={}] - 配置選項
     * @returns {Promise<boolean>}
     */
    async function init(config = {}) {
        if (isInitialized) {
            console.warn('[TenkiProSystem] Already initialized');
            return true;
        }

        console.log('[TenkiProSystem] Initializing...');

        try {
            // 1. 檢查必要模組
            checkModules();

            // 2. 初始化資料庫
            if (typeof TenkiDatabase !== 'undefined') {
                modules.database = await TenkiDatabase.getInstance();
                console.log('[TenkiProSystem] Database initialized');
            }

            // 3. 初始化 PR-Expectancy
            if (typeof PRExpectancy !== 'undefined') {
                modules.expectancy = PRExpectancy.getInstance();
                console.log('[TenkiProSystem] PR-Expectancy initialized');
            }

            // 4. 初始化 AI Behavior
            if (typeof AIBehavior !== 'undefined') {
                modules.aiBehavior = AIBehavior.getInstance();
                console.log('[TenkiProSystem] AI Behavior initialized');
            }

            // 5. 初始化 Overlay Controller
            if (typeof OverlayController !== 'undefined') {
                OverlayController.init();
                modules.overlay = OverlayController;
                console.log('[TenkiProSystem] Overlay Controller initialized');
            }

            // 6. 設定事件訂閱
            setupEventSubscriptions();

            // 7. 發送系統就緒事件
            if (typeof EventBridge !== 'undefined') {
                EventBridge.notifySystemReady({
                    version: '1.0.0',
                    modules: Object.keys(modules)
                });
            }

            isInitialized = true;
            console.log('[TenkiProSystem] Initialization complete!');

            return true;

        } catch (error) {
            console.error('[TenkiProSystem] Initialization failed:', error);

            if (typeof EventBridge !== 'undefined') {
                EventBridge.notifySystemError(error, 'system-init');
            }

            return false;
        }
    }

    /**
     * 檢查必要模組
     */
    function checkModules() {
        const required = ['EventBridge'];
        const missing = required.filter(m => typeof window[m] === 'undefined');

        if (missing.length > 0) {
            throw new Error(`Missing required modules: ${missing.join(', ')}`);
        }

        const optional = [
            'DecisionTimer',
            'DecisionPreview',
            'PRExpectancy',
            'AIBehavior',
            'TenkiDatabase',
            'OverlayController'
        ];

        const available = optional.filter(m => typeof window[m] !== 'undefined');
        console.log('[TenkiProSystem] Available modules:', available.join(', '));
    }

    /**
     * 設定事件訂閱
     */
    function setupEventSubscriptions() {
        // 訂閱決策完成事件，自動記錄交易
        EventBridge.on('decision-complete', async (data) => {
            if (modules.expectancy && data.entryType !== 'ABORT') {
                // 延遲詢問結果 (實際應用中會有 UI)
                console.log('[TenkiProSystem] Trade decision completed:', data);
            }
        });

        // 訂閱交易記錄事件，觸發統計更新
        EventBridge.on('trade-recorded', (data) => {
            if (modules.expectancy) {
                const summary = modules.expectancy.getSummary();
                EventBridge.notifyStatsUpdate(summary);
            }
        });

        // 訂閱 TEI 更新，通知 Overlay
        EventBridge.onTEIUpdate((data) => {
            if (modules.overlay) {
                modules.overlay.updateTEI(data.tei);
            }
        });

        console.log('[TenkiProSystem] Event subscriptions set up');
    }

    // =============================================================================
    // API
    // =============================================================================

    /**
     * 建立新的計時器
     * 
     * @param {string} templateId - 模板 ID
     * @param {number} [tei] - 當前 TEI
     * @returns {Object|null} 計時器實例
     */
    function createTimer(templateId, tei) {
        if (typeof DecisionTimer === 'undefined') {
            console.error('[TenkiProSystem] DecisionTimer not available');
            return null;
        }

        const timer = DecisionTimer.create();
        timer.setTemplate(templateId);

        if (tei !== undefined) {
            timer.setTEI(tei);
        }

        return timer;
    }

    /**
     * 記錄交易結果
     * 
     * @param {Object} trade - 交易資料
     * @returns {Object|null} 新增的記錄
     */
    function recordTrade(trade) {
        if (!modules.expectancy) {
            console.error('[TenkiProSystem] PRExpectancy not available');
            return null;
        }

        return modules.expectancy.addTrade(trade);
    }

    /**
     * 取得統計摘要
     * 
     * @returns {Object}
     */
    function getStats() {
        if (!modules.expectancy) {
            return { hasData: false, message: 'PRExpectancy not available' };
        }

        return modules.expectancy.getSummary();
    }

    /**
     * 分析行為模式
     * 
     * @returns {Object}
     */
    function analyzeBehavior() {
        if (!modules.expectancy || !modules.aiBehavior) {
            return { hasData: false, message: 'Modules not available' };
        }

        const trades = modules.expectancy.getTrades();
        return modules.aiBehavior.analyzeBehavior(trades);
    }

    /**
     * 匯出所有資料
     * 
     * @returns {string} JSON
     */
    function exportData() {
        if (!modules.expectancy) {
            return '{}';
        }

        return modules.expectancy.exportData();
    }

    /**
     * 匯入資料
     * 
     * @param {string} jsonString - JSON 字串
     * @param {Object} [options] - 選項
     * @returns {Object} 匯入結果
     */
    function importData(jsonString, options) {
        if (!modules.expectancy) {
            return { success: false, error: 'PRExpectancy not available' };
        }

        return modules.expectancy.importData(jsonString, options);
    }

    /**
     * 更新 TEI (通知系統)
     * 
     * @param {number} tei - TEI 值
     * @param {string} [source] - 來源
     */
    function updateTEI(tei, source = 'external') {
        EventBridge.notifyTEIUpdate(tei, source);
    }

    // =============================================================================
    // PUBLIC API
    // =============================================================================

    return {
        // Lifecycle
        init,

        // Core API
        createTimer,
        recordTrade,
        getStats,
        analyzeBehavior,
        updateTEI,

        // Data management
        exportData,
        importData,

        // Module access
        getModules() {
            return { ...modules };
        },

        // Status
        isReady() {
            return isInitialized;
        },

        // Version
        version: '1.0.0'
    };

})();

// Auto-initialize when DOM is ready (optional)
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        TenkiProSystem.init();
    });
} else {
    // DOM already loaded
    TenkiProSystem.init();
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TenkiProSystem;
}
