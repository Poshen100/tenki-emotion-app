/**
 * @fileoverview Event Bridge - 連接新舊系統的橋接器
 * @description 這是 TENKI PRO 的通訊中樞，所有新模組都必須透過這裡與星塵靈魂溝通。
 * 
 * 設計原則：
 * 1. 只發送事件，不修改原始碼
 * 2. 星塵靈魂選擇性監聽
 * 3. 雙向解耦
 * 
 * @version 1.0.0
 * @author TENKI PRO Team
 */

(function(global) {
  'use strict';

  /**
   * 事件類型常數
   * @readonly
   * @enum {string}
   */
  const EventTypes = {
    TEI_UPDATED: 'tenki:tei-updated',
    DECISION_STATE: 'tenki:decision-state',
    TRADE_RECORDED: 'tenki:trade-recorded',
    PREVIEW_REQUESTED: 'tenki:preview-requested',
    SYSTEM_ERROR: 'tenki:system-error',
    PPG_CALIBRATION: 'tenki:ppg-calibration',
    TEI_PROGRESS_UPDATE: 'tenki:tei-progress-update'
  };

  /**
   * 狀態常數
   * @readonly
   * @enum {string}
   */
  const DecisionStates = {
    IDLE: 'IDLE',
    PREVIEW: 'PREVIEW',
    RUNNING: 'RUNNING',
    PROGRESS: 'PROGRESS',
    COMPLETE: 'COMPLETE',
    TIMEOUT: 'TIMEOUT',
    ABORT: 'ABORT'
  };

  /**
   * PPG 校準狀態常數
   * @readonly
   * @enum {string}
   */
  const CalibrationStates = {
    INIT: 'INIT',
    CAMERA_READY: 'CAMERA_READY',
    DETECTING: 'DETECTING',
    PARTIAL: 'PARTIAL',
    ALIGNED: 'ALIGNED',
    SIGNAL_LOCK: 'SIGNAL_LOCK',
    CALIBRATING: 'CALIBRATING',
    COMPLETE: 'COMPLETE',
    ERROR: 'ERROR'
  };

  /**
   * 漸進式精度等級
   * @readonly
   * @enum {string}
   */
  const PrecisionLevels = {
    QUICK: 'quick',       // 2s
    STANDARD: 'standard', // 15s
    PRECISE: 'precise',   // 30s
    ULTRA: 'ultra'        // 60s
  };

  /**
   * Event Bridge 類別
   * 提供系統間事件通訊的統一介面
   */
  class EventBridge {
    /**
     * 建立 EventBridge 實例
     * @param {Object} options - 設定選項
     * @param {boolean} [options.debug=false] - 是否啟用除錯模式
     */
    constructor(options = {}) {
      this.debug = options.debug || false;
      this.listeners = new Map();
      this._eventHistory = [];
      this._maxHistorySize = 100;
    }

    /**
     * 記錄事件到歷史
     * @private
     * @param {string} type - 事件類型
     * @param {Object} detail - 事件資料
     */
    _logEvent(type, detail) {
      if (this._eventHistory.length >= this._maxHistorySize) {
        this._eventHistory.shift();
      }
      this._eventHistory.push({
        type,
        detail,
        timestamp: Date.now()
      });

      if (this.debug) {
        console.log(`[EventBridge] ${type}`, detail);
      }
    }

    /**
     * 發送 TEI 更新事件
     * 星塵靈魂可選擇監聽來改變粒子顏色
     * 
     * @param {number} tei - TEI 分數 (1-99)
     * @param {string} source - 事件來源模組名稱
     * @returns {boolean} 是否成功發送
     * 
     * @example
     * // 從決策計時器發送 TEI 更新
     * EventBridge.notifyTEIUpdate(72, 'decision-timer');
     */
    static notifyTEIUpdate(tei, source) {
      try {
        // 驗證 TEI 範圍
        if (typeof tei !== 'number' || tei < 1 || tei > 99) {
          console.warn('[EventBridge] TEI must be a number between 1-99');
          return false;
        }

        const detail = {
          tei: Math.round(tei),
          source: source || 'unknown',
          timestamp: Date.now()
        };

        window.dispatchEvent(new CustomEvent(EventTypes.TEI_UPDATED, { detail }));
        
        if (EventBridge._instance) {
          EventBridge._instance._logEvent(EventTypes.TEI_UPDATED, detail);
        }

        return true;
      } catch (error) {
        console.error('[EventBridge] Error in notifyTEIUpdate:', error);
        return false;
      }
    }

    /**
     * 發送決策狀態變化事件
     * 
     * @param {string} state - 決策狀態 (IDLE/PREVIEW/RUNNING/COMPLETE/TIMEOUT/ABORT)
     * @param {Object} data - 附加資料
     * @returns {boolean} 是否成功發送
     * 
     * @example
     * // 計時器開始
     * EventBridge.notifyDecisionState('RUNNING', { template: 'MANCINI_FBD', duration: 180 });
     * 
     * // 計時器進度更新
     * EventBridge.notifyDecisionState('PROGRESS', { elapsed: 60, remaining: 120, segment: 'Watch acceptance' });
     * 
     * // 計時器超時 (耐心等待成功)
     * EventBridge.notifyDecisionState('TIMEOUT', { template: 'MANCINI_FBD' });
     */
    static notifyDecisionState(state, data = {}) {
      try {
        // 驗證狀態
        if (!Object.values(DecisionStates).includes(state)) {
          console.warn(`[EventBridge] Invalid state: ${state}`);
          return false;
        }

        const detail = {
          state,
          data,
          timestamp: Date.now()
        };

        window.dispatchEvent(new CustomEvent(EventTypes.DECISION_STATE, { detail }));

        if (EventBridge._instance) {
          EventBridge._instance._logEvent(EventTypes.DECISION_STATE, detail);
        }

        return true;
      } catch (error) {
        console.error('[EventBridge] Error in notifyDecisionState:', error);
        return false;
      }
    }

    /**
     * 發送交易記錄事件
     * 
     * @param {Object} record - 交易記錄
     * @param {number} record.tei - 交易時的 TEI
     * @param {string} record.template - 使用的模板
     * @param {number} record.decision_time - 決策耗時 (秒)
     * @param {string} record.result - 結果 (WIN/LOSS)
     * @param {string} record.entry_type - 進場類型 (EARLY/TIMEOUT/ABORT)
     * @param {number} [record.r_multiple] - R 倍數
     * @returns {boolean} 是否成功發送
     * 
     * @example
     * EventBridge.notifyTradeRecorded({
     *   tei: 57,
     *   template: 'MANCINI_FBD',
     *   decision_time: 132,
     *   result: 'WIN',
     *   entry_type: 'TIMEOUT',
     *   r_multiple: 0.32
     * });
     */
    static notifyTradeRecorded(record) {
      try {
        const detail = {
          record,
          timestamp: Date.now()
        };

        window.dispatchEvent(new CustomEvent(EventTypes.TRADE_RECORDED, { detail }));

        if (EventBridge._instance) {
          EventBridge._instance._logEvent(EventTypes.TRADE_RECORDED, detail);
        }

        return true;
      } catch (error) {
        console.error('[EventBridge] Error in notifyTradeRecorded:', error);
        return false;
      }
    }

    /**
     * 發送預覽請求事件
     * 
     * @param {Object} context - 當前情境
     * @param {number} context.tei - 當前 TEI
     * @param {string} context.template - 選擇的模板
     * @param {Date} [context.time] - 當前時間
     * @returns {boolean} 是否成功發送
     */
    static notifyPreviewRequested(context) {
      try {
        const detail = {
          context: {
            ...context,
            time: context.time || new Date()
          },
          timestamp: Date.now()
        };

        window.dispatchEvent(new CustomEvent(EventTypes.PREVIEW_REQUESTED, { detail }));

        if (EventBridge._instance) {
          EventBridge._instance._logEvent(EventTypes.PREVIEW_REQUESTED, detail);
        }

        return true;
      } catch (error) {
        console.error('[EventBridge] Error in notifyPreviewRequested:', error);
        return false;
      }
    }

    /**
     * 發送系統錯誤事件
     * 
     * @param {string} source - 錯誤來源
     * @param {Error|string} error - 錯誤物件或訊息
     * @returns {boolean} 是否成功發送
     */
    static notifyError(source, error) {
      try {
        const detail = {
          source,
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : null,
          timestamp: Date.now()
        };

        window.dispatchEvent(new CustomEvent(EventTypes.SYSTEM_ERROR, { detail }));

        if (EventBridge._instance) {
          EventBridge._instance._logEvent(EventTypes.SYSTEM_ERROR, detail);
        }

        return true;
      } catch (err) {
        console.error('[EventBridge] Error in notifyError:', err);
        return false;
      }
    }

    /**
     * 發送 PPG 校準事件
     * 校準流程中每次狀態變化都會發送
     * 
     * @param {Object} data - 校準資料
     * @param {string} data.state - 校準狀態 (INIT/CAMERA_READY/DETECTING/ALIGNED/SIGNAL_LOCK/CALIBRATING/COMPLETE/ERROR)
     * @param {number} [data.coverage] - 手指覆蓋率 0-1
     * @param {number} [data.quality] - 信號品質 0-100
     * @param {number} [data.bpm] - 心率
     * @param {string} [data.hint] - 方向提示文字
     * @param {number} [data.progress] - 校準進度 0-1
     * @param {Object} [data.metrics] - 完成時的 metrics
     * @param {string} [data.error] - 錯誤類型
     * @param {string} [data.message] - 錯誤訊息
     * @returns {boolean} 是否成功發送
     * 
     * @example
     * EventBridge.notifyPPGCalibration({
     *   state: 'ALIGNED',
     *   coverage: 0.92,
     *   hint: '完美！保持穩定'
     * });
     */
    static notifyPPGCalibration(data) {
      try {
        if (!data || !data.state) {
          console.warn('[EventBridge] PPG calibration data must include state');
          return false;
        }

        const detail = {
          ...data,
          timestamp: data.timestamp || Date.now()
        };

        window.dispatchEvent(new CustomEvent(EventTypes.PPG_CALIBRATION, { detail }));

        if (EventBridge._instance) {
          EventBridge._instance._logEvent(EventTypes.PPG_CALIBRATION, detail);
        }

        return true;
      } catch (error) {
        console.error('[EventBridge] Error in notifyPPGCalibration:', error);
        return false;
      }
    }

    /**
     * 發送漸進式 TEI 掃描更新事件
     * 
     * @param {Object} data - TEI 掃描資料
     * @param {number} data.tei - TEI 分數 (1-99)
     * @param {number} data.confidence - 信心度 (0-1)
     * @param {string} data.precisionLevel - 精度等級 'quick'|'standard'|'precise'|'ultra'
     * @param {number} [data.errorMargin] - 誤差範圍 (±分)
     * @param {number} [data.dataPoints] - 已收集數據點
     * @param {Object} [data.snapshots] - 生理快照 { hr, hrv, rr, stress, sympathetic, parasympathetic }
     * @param {Object} [data.milestones] - 里程碑狀態
     * @returns {boolean} 是否成功發送
     * 
     * @example
     * EventBridge.notifyTEIProgressUpdate({
     *   tei: 68,
     *   confidence: 0.85,
     *   precisionLevel: 'standard',
     *   errorMargin: 4,
     *   snapshots: { hr: 70, hrv: 52, rr: 14, stress: 45 }
     * });
     */
    static notifyTEIProgressUpdate(data) {
      try {
        if (!data || typeof data.tei !== 'number') {
          console.warn('[EventBridge] TEI progress update must include tei number');
          return false;
        }

        const detail = {
          ...data,
          tei: Math.round(Math.max(1, Math.min(99, data.tei))),
          timestamp: data.timestamp || Date.now()
        };

        window.dispatchEvent(new CustomEvent(EventTypes.TEI_PROGRESS_UPDATE, { detail }));

        if (EventBridge._instance) {
          EventBridge._instance._logEvent(EventTypes.TEI_PROGRESS_UPDATE, detail);
        }

        return true;
      } catch (error) {
        console.error('[EventBridge] Error in notifyTEIProgressUpdate:', error);
        return false;
      }
    }

    // ========== 訂閱方法 ==========

    /**
     * 訂閱 TEI 更新事件
     * 
     * @param {Function} callback - 回呼函數，接收 { tei, source, timestamp }
     * @returns {Function} 取消訂閱的函數
     * 
     * @example
     * const unsubscribe = EventBridge.onTEIUpdate((data) => {
     *   console.log('TEI updated to:', data.tei);
     * });
     * 
     * // 稍後取消訂閱
     * unsubscribe();
     */
    static onTEIUpdate(callback) {
      const handler = (e) => callback(e.detail);
      window.addEventListener(EventTypes.TEI_UPDATED, handler);
      return () => window.removeEventListener(EventTypes.TEI_UPDATED, handler);
    }

    /**
     * 訂閱決策狀態變化事件
     * 
     * @param {Function} callback - 回呼函數，接收 { state, data, timestamp }
     * @returns {Function} 取消訂閱的函數
     * 
     * @example
     * const unsubscribe = EventBridge.onDecisionStateChange((data) => {
     *   console.log('State changed to:', data.state);
     *   if (data.state === 'TIMEOUT') {
     *     console.log('Patience win!');
     *   }
     * });
     */
    static onDecisionStateChange(callback) {
      const handler = (e) => callback(e.detail);
      window.addEventListener(EventTypes.DECISION_STATE, handler);
      return () => window.removeEventListener(EventTypes.DECISION_STATE, handler);
    }

    /**
     * 訂閱交易記錄事件
     * 
     * @param {Function} callback - 回呼函數
     * @returns {Function} 取消訂閱的函數
     */
    static onTradeRecorded(callback) {
      const handler = (e) => callback(e.detail);
      window.addEventListener(EventTypes.TRADE_RECORDED, handler);
      return () => window.removeEventListener(EventTypes.TRADE_RECORDED, handler);
    }

    /**
     * 訂閱預覽請求事件
     * 
     * @param {Function} callback - 回呼函數
     * @returns {Function} 取消訂閱的函數
     */
    static onPreviewRequested(callback) {
      const handler = (e) => callback(e.detail);
      window.addEventListener(EventTypes.PREVIEW_REQUESTED, handler);
      return () => window.removeEventListener(EventTypes.PREVIEW_REQUESTED, handler);
    }

    /**
     * 訂閱系統錯誤事件
     * 
     * @param {Function} callback - 回呼函數
     * @returns {Function} 取消訂閱的函數
     */
    static onError(callback) {
      const handler = (e) => callback(e.detail);
      window.addEventListener(EventTypes.SYSTEM_ERROR, handler);
      return () => window.removeEventListener(EventTypes.SYSTEM_ERROR, handler);
    }

    /**
     * 訂閱 PPG 校準事件
     * 
     * @param {Function} callback - 回呼函數，接收校準資料
     * @returns {Function} 取消訂閱的函數
     * 
     * @example
     * const unsubscribe = EventBridge.onPPGCalibration((data) => {
     *   console.log('Calibration state:', data.state, 'Coverage:', data.coverage);
     * });
     */
    static onPPGCalibration(callback) {
      const handler = (e) => callback(e.detail);
      window.addEventListener(EventTypes.PPG_CALIBRATION, handler);
      return () => window.removeEventListener(EventTypes.PPG_CALIBRATION, handler);
    }

    /**
     * 訂閱漸進式 TEI 掃描更新
     * 
     * @param {Function} callback - 回呼函數，接收 TEI 掃描資料
     * @returns {Function} 取消訂閱的函數
     * 
     * @example
     * const unsubscribe = EventBridge.onTEIProgressUpdate((data) => {
     *   console.log('TEI:', data.tei, 'Precision:', data.precisionLevel);
     * });
     */
    static onTEIProgressUpdate(callback) {
      const handler = (e) => callback(e.detail);
      window.addEventListener(EventTypes.TEI_PROGRESS_UPDATE, handler);
      return () => window.removeEventListener(EventTypes.TEI_PROGRESS_UPDATE, handler);
    }

    // ========== 工具方法 ==========

    /**
     * 取得事件歷史記錄
     * @returns {Array} 事件歷史
     */
    static getEventHistory() {
      if (EventBridge._instance) {
        return [...EventBridge._instance._eventHistory];
      }
      return [];
    }

    /**
     * 清除事件歷史
     */
    static clearEventHistory() {
      if (EventBridge._instance) {
        EventBridge._instance._eventHistory = [];
      }
    }

    /**
     * 初始化單例
     * @param {Object} options - 設定選項
     * @returns {EventBridge} 單例實例
     */
    static init(options = {}) {
      if (!EventBridge._instance) {
        EventBridge._instance = new EventBridge(options);
      }
      return EventBridge._instance;
    }
  }

  // 初始化單例
  EventBridge._instance = null;

  // 暴露常數
  EventBridge.EventTypes = EventTypes;
  EventBridge.DecisionStates = DecisionStates;
  EventBridge.CalibrationStates = CalibrationStates;
  EventBridge.PrecisionLevels = PrecisionLevels;

  // 暴露到全域
  global.EventBridge = EventBridge;

  // 自動初始化
  if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
      EventBridge.init({ debug: false });
      console.log('[EventBridge] Initialized');
    });
  }

})(typeof window !== 'undefined' ? window : this);


// ========== 使用範例 ==========

/*
// 範例 1: 發送 TEI 更新
EventBridge.notifyTEIUpdate(72, 'decision-timer');

// 範例 2: 訂閱 TEI 更新
const unsubscribeTEI = EventBridge.onTEIUpdate((data) => {
  console.log(`TEI: ${data.tei} from ${data.source}`);
});

// 範例 3: 發送決策狀態
EventBridge.notifyDecisionState('RUNNING', {
  template: 'MANCINI_FBD',
  duration: 180
});

// 範例 4: 訂閱決策狀態變化
const unsubscribeState = EventBridge.onDecisionStateChange((data) => {
  switch (data.state) {
    case 'RUNNING':
      console.log('Timer started for template:', data.data.template);
      break;
    case 'TIMEOUT':
      console.log('Patience win! 🎉');
      break;
    case 'COMPLETE':
      console.log('Decision made in', data.data.elapsed, 'seconds');
      break;
  }
});

// 範例 5: 記錄交易
EventBridge.notifyTradeRecorded({
  tei: 57,
  template: 'MANCINI_FBD',
  decision_time: 132,
  result: 'WIN',
  entry_type: 'TIMEOUT',
  r_multiple: 0.32
});

// 範例 6: 取消訂閱
unsubscribeTEI();
unsubscribeState();
*/


// ========== 簡單測試 ==========

/*
(function testEventBridge() {
  console.log('=== EventBridge Test ===');
  
  // 初始化
  EventBridge.init({ debug: true });
  
  // 訂閱 TEI
  const unsub1 = EventBridge.onTEIUpdate((data) => {
    console.log('✅ TEI received:', data.tei);
  });
  
  // 訂閱狀態
  const unsub2 = EventBridge.onDecisionStateChange((data) => {
    console.log('✅ State received:', data.state);
  });
  
  // 發送測試事件
  console.log('Sending TEI update...');
  EventBridge.notifyTEIUpdate(65, 'test');
  
  console.log('Sending decision state...');
  EventBridge.notifyDecisionState('RUNNING', { template: 'TEST' });
  
  // 檢查歷史
  console.log('Event history:', EventBridge.getEventHistory());
  
  // 清理
  unsub1();
  unsub2();
  
  console.log('=== Test Complete ===');
})();
*/
