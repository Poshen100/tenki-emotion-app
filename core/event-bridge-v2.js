/**
 * TENKI EventBridgeV2
 * =====================
 * 統一事件橋接器 V2，支援 canonical tenki:* 事件命名空間
 *
 * 設計原則:
 * - 繼承 EventTarget，可直接使用 addEventListener / dispatchEvent
 * - Phase 1: Dual Emission (新舊事件同時發送)
 * - Phase 2: Feature Flag (localStorage 控制模式)
 * - Phase 3: Deprecation (移除舊事件)
 * - 不修改任何 LOCKED FILES (index.html, app.js, rpgg.js, expression.js, tenki-engine.js)
 *
 * 用法:
 *   window.EventBridgeV2.emitTEIUpdate(teiResult);
 *   window.EventBridgeV2.addEventListener('tenki:tei-progressive', handler);
 *
 * @version 2.0.0
 * @author  TENKI Core Team
 */

'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// 常數
// ─────────────────────────────────────────────────────────────────────────────

/** 有效的事件模式 */
const VALID_MODES = ['dual', 'v2-only', 'legacy'];

/** localStorage key，用於 Phase 2 Feature Flag */
const LS_MODE_KEY = 'tenki:event-mode';

/** 感測器批次節流 (ms) — 10 Hz */
const DEFAULT_SENSOR_THROTTLE_MS = 100;

/** PPG 覆蓋率節流 (ms) — 10 Hz */
const DEFAULT_PPG_THROTTLE_MS = 100;

/** PPG 狀態機：有效狀態清單 */
const VALID_PPG_STATES = ['INIT', 'DETECTING', 'RED', 'YELLOW', 'GREEN', 'LOCKED', 'ERROR'];

/** 感測器資料來源白名單 */
const VALID_SOURCES = ['rppg', 'healthkit', 'watch', 'manual', 'sim'];

/** TEI 精度等級 */
const VALID_LEVELS = ['quick', 'standard', 'precise', 'ultra'];

/** 交易結果 */
const VALID_OUTCOMES = ['win', 'loss', 'breakeven', 'timeout', 'abort'];

/** 交易模板 */
const VALID_TEMPLATES = ['CANSLIM', 'DARVAS', 'FBD', 'CUSTOM'];

// PPG 覆蓋率 → 顏色 閾值
const COVERAGE_GREEN_THRESHOLD = 0.85;
const COVERAGE_YELLOW_THRESHOLD = 0.60;


// ─────────────────────────────────────────────────────────────────────────────
// 錯誤類別
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Payload 驗證失敗時拋出
 */
class ValidationError extends Error {
    /**
     * @param {string} field  - 出問題的欄位名稱
     * @param {string} code   - 錯誤代碼，例如 'ERR_TEI_RANGE'
     * @param {string} message - 人類可讀訊息
     */
    constructor(field, code, message) {
        super(`[EventBridgeV2] Validation failed → ${field}: ${message}`);
        this.name = 'ValidationError';
        this.field = field;
        this.code = code;
        this.userMessage = message;
    }
}


// ─────────────────────────────────────────────────────────────────────────────
// 工具函式
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 限制數值在 [min, max] 範圍內
 * @param {number} val
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function clamp(val, min, max) {
    return Math.min(max, Math.max(min, val));
}

/**
 * 根據覆蓋率取得 PPG 視覺顏色
 * @param {number} coverage - 0.0–1.0
 * @returns {'red'|'yellow'|'green'}
 */
function coverageToColor(coverage) {
    if (coverage >= COVERAGE_GREEN_THRESHOLD) return 'green';
    if (coverage >= COVERAGE_YELLOW_THRESHOLD) return 'yellow';
    return 'red';
}

/**
 * 根據覆蓋率顏色取得提示文字
 * @param {'red'|'yellow'|'green'} color
 * @returns {string}
 */
function coverageColorToHint(color) {
    switch (color) {
        case 'green': return '保持不動，正在讀取...';
        case 'yellow': return '繼續調整手指位置';
        default: return '請將手指完整覆蓋鏡頭';
    }
}

/**
 * 產生唯一 Session ID
 * @param {string} prefix - 例如 'ppg' | 'trade'
 * @returns {string}
 */
function generateSessionId(prefix) {
    const rand = Math.random().toString(36).slice(2, 6);
    return `${prefix}_${Date.now()}_${rand}`;
}


// ─────────────────────────────────────────────────────────────────────────────
// 驗證器
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} ValidationResult
 * @property {boolean} valid
 * @property {Array<{field: string, code: string, message: string}>} errors
 */

const Validators = {
    /**
     * 驗證 TenkiSensorSample
     * @param {unknown} sample
     * @returns {ValidationResult}
     */
    sensorSample(sample) {
        const errors = [];

        if (!sample || typeof sample !== 'object') {
            errors.push({ field: 'root', code: 'ERR_TYPE', message: 'payload 必須是物件' });
            return { valid: false, errors };
        }

        if (sample.v !== 1) {
            errors.push({ field: 'v', code: 'ERR_VERSION', message: `schema version 必須是 1，收到 ${sample.v}` });
        }
        if (typeof sample.ts !== 'number' || sample.ts <= 0) {
            errors.push({ field: 'ts', code: 'ERR_TIMESTAMP', message: 'ts 必須是正整數 (Unix ms)' });
        }
        if (!VALID_SOURCES.includes(sample.source)) {
            errors.push({ field: 'source', code: 'ERR_SOURCE', message: `source 必須是 ${VALID_SOURCES.join('|')}，收到 "${sample.source}"` });
        }
        if (typeof sample.hr_bpm !== 'number' || sample.hr_bpm < 40 || sample.hr_bpm > 180) {
            errors.push({ field: 'hr_bpm', code: 'ERR_HR_RANGE', message: `hr_bpm 必須在 40–180 之間，收到 ${sample.hr_bpm}` });
        }
        if (typeof sample.hrv_ms !== 'number' || sample.hrv_ms < 5 || sample.hrv_ms > 200) {
            errors.push({ field: 'hrv_ms', code: 'ERR_HRV_RANGE', message: `hrv_ms 必須在 5–200 之間，收到 ${sample.hrv_ms}` });
        }
        if (typeof sample.quality !== 'number' || sample.quality < 0 || sample.quality > 1) {
            errors.push({ field: 'quality', code: 'ERR_QUALITY_RANGE', message: `quality 必須在 0–1 之間，收到 ${sample.quality}` });
        }

        return { valid: errors.length === 0, errors };
    },

    /**
     * 驗證 TenkiTEIResult
     * @param {unknown} result
     * @returns {ValidationResult}
     */
    teiResult(result) {
        const errors = [];

        if (!result || typeof result !== 'object') {
            errors.push({ field: 'root', code: 'ERR_TYPE', message: 'payload 必須是物件' });
            return { valid: false, errors };
        }

        if (result.v !== 1) {
            errors.push({ field: 'v', code: 'ERR_VERSION', message: `schema version 必須是 1，收到 ${result.v}` });
        }
        if (typeof result.ts !== 'number' || result.ts <= 0) {
            errors.push({ field: 'ts', code: 'ERR_TIMESTAMP', message: 'ts 必須是正整數 (Unix ms)' });
        }
        if (typeof result.tei_pr99 !== 'number' || result.tei_pr99 < 1 || result.tei_pr99 > 99) {
            errors.push({ field: 'tei_pr99', code: 'ERR_TEI_RANGE', message: `tei_pr99 必須在 1–99 之間，收到 ${result.tei_pr99}` });
        }
        if (typeof result.confidence !== 'number' || result.confidence < 0 || result.confidence > 1) {
            errors.push({ field: 'confidence', code: 'ERR_CONFIDENCE', message: `confidence 必須在 0–1 之間，收到 ${result.confidence}` });
        }
        if (!VALID_LEVELS.includes(result.level)) {
            errors.push({ field: 'level', code: 'ERR_LEVEL', message: `level 必須是 ${VALID_LEVELS.join('|')}，收到 "${result.level}"` });
        }
        if (typeof result.error_margin_pr99 !== 'number' || result.error_margin_pr99 < 0) {
            errors.push({ field: 'error_margin_pr99', code: 'ERR_MARGIN', message: `error_margin_pr99 必須是非負數，收到 ${result.error_margin_pr99}` });
        }
        if (!Array.isArray(result.range_pr99) || result.range_pr99.length !== 2) {
            errors.push({ field: 'range_pr99', code: 'ERR_RANGE', message: 'range_pr99 必須是長度 2 的陣列 [lower, upper]' });
        }
        if (!result.inputs || typeof result.inputs !== 'object') {
            errors.push({ field: 'inputs', code: 'ERR_INPUTS', message: 'inputs 欄位必填' });
        } else {
            if (!Array.isArray(result.inputs.sources) || result.inputs.sources.length === 0) {
                errors.push({ field: 'inputs.sources', code: 'ERR_SOURCES', message: 'inputs.sources 必須是非空陣列' });
            }
            if (typeof result.inputs.samples_used !== 'number' || result.inputs.samples_used < 0) {
                errors.push({ field: 'inputs.samples_used', code: 'ERR_SAMPLES', message: `inputs.samples_used 必須是非負整數，收到 ${result.inputs.samples_used}` });
            }
            if (typeof result.inputs.quality_avg !== 'number' || result.inputs.quality_avg < 0 || result.inputs.quality_avg > 1) {
                errors.push({ field: 'inputs.quality_avg', code: 'ERR_QUALITY_AVG', message: `inputs.quality_avg 必須在 0–1 之間，收到 ${result.inputs.quality_avg}` });
            }
        }

        return { valid: errors.length === 0, errors };
    },

    /**
     * 驗證 TenkiTradeRecord
     * @param {unknown} record
     * @returns {ValidationResult}
     */
    tradeRecord(record) {
        const errors = [];

        if (!record || typeof record !== 'object') {
            errors.push({ field: 'root', code: 'ERR_TYPE', message: 'payload 必須是物件' });
            return { valid: false, errors };
        }

        if (record.v !== 1) {
            errors.push({ field: 'v', code: 'ERR_VERSION', message: `schema version 必須是 1，收到 ${record.v}` });
        }
        if (typeof record.trade_id !== 'string' || record.trade_id.length === 0) {
            errors.push({ field: 'trade_id', code: 'ERR_TRADE_ID', message: 'trade_id 必須是非空字串' });
        }
        if (typeof record.ts !== 'number' || record.ts <= 0) {
            errors.push({ field: 'ts', code: 'ERR_TIMESTAMP', message: 'ts 必須是正整數 (Unix ms)' });
        }
        if (typeof record.symbol !== 'string' || record.symbol.length === 0) {
            errors.push({ field: 'symbol', code: 'ERR_SYMBOL', message: 'symbol 必須是非空字串' });
        }
        if (!['long', 'short'].includes(record.direction)) {
            errors.push({ field: 'direction', code: 'ERR_DIRECTION', message: `direction 必須是 long|short，收到 "${record.direction}"` });
        }
        if (!VALID_OUTCOMES.includes(record.outcome)) {
            errors.push({ field: 'outcome', code: 'ERR_OUTCOME', message: `outcome 必須是 ${VALID_OUTCOMES.join('|')}，收到 "${record.outcome}"` });
        }
        if (typeof record.pnl !== 'number') {
            errors.push({ field: 'pnl', code: 'ERR_PNL', message: `pnl 必須是數字，收到 ${typeof record.pnl}` });
        }
        if (typeof record.r_multiple !== 'number') {
            errors.push({ field: 'r_multiple', code: 'ERR_R_MULTIPLE', message: `r_multiple 必須是數字，收到 ${typeof record.r_multiple}` });
        }
        if (!VALID_TEMPLATES.includes(record.template)) {
            errors.push({ field: 'template', code: 'ERR_TEMPLATE', message: `template 必須是 ${VALID_TEMPLATES.join('|')}，收到 "${record.template}"` });
        }
        if (typeof record.decision_time_s !== 'number' || record.decision_time_s < 0) {
            errors.push({ field: 'decision_time_s', code: 'ERR_DECISION_TIME', message: `decision_time_s 必須是非負數，收到 ${record.decision_time_s}` });
        }
        if (!record.tei_at_entry || typeof record.tei_at_entry !== 'object') {
            errors.push({ field: 'tei_at_entry', code: 'ERR_TEI_ENTRY', message: 'tei_at_entry 欄位必填' });
        } else {
            if (typeof record.tei_at_entry.tei_pr99 !== 'number' ||
                record.tei_at_entry.tei_pr99 < 1 ||
                record.tei_at_entry.tei_pr99 > 99) {
                errors.push({ field: 'tei_at_entry.tei_pr99', code: 'ERR_TEI_RANGE', message: `tei_at_entry.tei_pr99 必須在 1–99，收到 ${record.tei_at_entry.tei_pr99}` });
            }
        }

        return { valid: errors.length === 0, errors };
    }
};


// ─────────────────────────────────────────────────────────────────────────────
// EventBridgeV2 主類別
// ─────────────────────────────────────────────────────────────────────────────

class EventBridgeV2 extends EventTarget {
    /**
     * @param {Object} [options]
     * @param {'dual'|'v2-only'|'legacy'} [options.mode]
     *   - 'dual'    → 新舊事件同時發送 (Phase 1–2 預設)
     *   - 'v2-only' → 只發新 tenki:* 事件 (A/B 測試)
     *   - 'legacy'  → 只發舊事件 (緊急除錯)
     * @param {number}  [options.sensorThrottleMs=100]  感測器批次節流 ms
     * @param {number}  [options.ppgThrottleMs=100]     PPG 事件節流 ms
     * @param {boolean} [options.deprecationWarnings=true] 顯示 deprecation 警告
     */
    constructor(options = {}) {
        super();

        // ── 模式：優先用 localStorage，否則用 options，最後預設 'dual'
        const storedMode = this._readStoredMode();
        this._mode = storedMode || options.mode || 'dual';

        // ── 節流設定
        this._sensorThrottleMs = options.sensorThrottleMs ?? DEFAULT_SENSOR_THROTTLE_MS;
        this._ppgThrottleMs = options.ppgThrottleMs ?? DEFAULT_PPG_THROTTLE_MS;

        // ── 是否顯示 deprecation 警告
        this._deprecationWarnings = options.deprecationWarnings ?? true;

        // ── 感測器批次緩衝
        this._sensorBuffer = [];
        this._lastSensorEmit = 0;

        // ── PPG 節流計時器
        this._lastPPGCoverageEmit = 0;
        this._lastPPGSignalEmit = 0;

        // ── 統計計數器
        this._stats = {
            emitted: {},
            dropped: 0,
            validationErrors: 0,
            startedAt: Date.now()
        };

        // ── 已移除事件的警告集合 (避免重複 log)
        this._removedEventWarned = new Set();

        this._log(`EventBridgeV2 initialized (mode: ${this._mode})`);
    }


    // ───────────────────────────────────────────────────────────────────────
    // 公開 Getter / Setter
    // ───────────────────────────────────────────────────────────────────────

    /** 目前事件模式 */
    get mode() {
        return this._mode;
    }

    /**
     * 動態切換事件模式（無需重新整理）
     * @param {'dual'|'v2-only'|'legacy'} mode
     */
    setMode(mode) {
        if (!VALID_MODES.includes(mode)) {
            console.error(`[EventBridgeV2] 無效的模式: "${mode}"，有效值: ${VALID_MODES.join(', ')}`);
            return;
        }
        this._mode = mode;
        localStorage.setItem(LS_MODE_KEY, mode);
        this._log(`模式切換為: ${mode}`);
    }


    // ───────────────────────────────────────────────────────────────────────
    // Emit 方法 — 感測器
    // ───────────────────────────────────────────────────────────────────────

    /**
     * 發送原始感測器樣本（已內建 10 Hz 節流，批次發送）
     *
     * @param {Object} sample - TenkiSensorSample
     * @param {1}        sample.v
     * @param {number}   sample.ts
     * @param {string}   sample.source
     * @param {number}   sample.hr_bpm
     * @param {number}   sample.hrv_ms
     * @param {number}   sample.quality
     * @param {Object}  [sample.meta]
     */
    emitSensorSample(sample) {
        // 1. 驗證
        const validation = Validators.sensorSample(sample);
        if (!validation.valid) {
            this._handleValidationErrors('TenkiSensorSample', validation.errors);
            return;
        }

        // 2. legacy-only 模式：只發舊事件（此情境無舊事件，跳過）
        if (this._mode === 'legacy') {
            this._stats.dropped++;
            return;
        }

        // 3. 加入緩衝
        this._sensorBuffer.push(sample);

        // 4. 節流檢查
        const now = Date.now();
        if (now - this._lastSensorEmit < this._sensorThrottleMs) {
            // 尚未到節流時間，先暫存
            return;
        }

        // 5. 批次發送
        this._flushSensorBuffer(now);
    }

    /**
     * 強制沖出感測器緩衝（可在掃描結束時調用）
     */
    flushSensorBuffer() {
        if (this._sensorBuffer.length > 0) {
            this._flushSensorBuffer(Date.now());
        }
    }


    // ───────────────────────────────────────────────────────────────────────
    // Emit 方法 — TEI
    // ───────────────────────────────────────────────────────────────────────

    /**
     * 發送 TEI 計算結果（不節流，立即發送）
     *
     * @param {Object}           result - TenkiTEIResult
     * @param {1}                result.v
     * @param {number}           result.ts
     * @param {number}           result.tei_pr99      - 1–99
     * @param {number}           result.confidence    - 0–1
     * @param {string}           result.level         - 'quick'|'standard'|'precise'|'ultra'
     * @param {number}           result.error_margin_pr99
     * @param {[number, number]} result.range_pr99
     * @param {Object}           result.inputs
     * @param {Object}          [result.baseline]
     *
     * @throws {ValidationError} 當 payload 驗證失敗時
     */
    emitTEIUpdate(result) {
        // 1. 驗證（驗證失敗記錄錯誤並中止，不拋出以避免破壞呼叫端）
        const validation = Validators.teiResult(result);
        if (!validation.valid) {
            this._handleValidationErrors('TenkiTEIResult', validation.errors, false);
            return;
        }

        // 2. v2-only 或 dual → 發 canonical 事件
        if (this._mode !== 'legacy') {
            this._dispatch('tenki:tei-progressive', result);
        }

        // 3. dual 或 legacy → 發舊事件
        if (this._mode !== 'v2-only') {
            this._emitLegacyTEIEvents(result);
        }
    }


    // ───────────────────────────────────────────────────────────────────────
    // Emit 方法 — PPG
    // ───────────────────────────────────────────────────────────────────────

    /**
     * 發送 PPG 校準狀態變化
     *
     * @param {'INIT'|'DETECTING'|'RED'|'YELLOW'|'GREEN'|'LOCKED'|'ERROR'} state
     * @param {string} prev - 前一個狀態
     * @param {string} [hint] - 給用戶的提示文字（可選，自動生成）
     */
    emitPPGState(state, prev, hint) {
        if (!VALID_PPG_STATES.includes(state)) {
            console.error(`[EventBridgeV2] 無效 PPG 狀態: "${state}"`);
            return;
        }

        const payload = {
            state,
            prev: prev || 'UNKNOWN',
            time_ms: Date.now(),
            hint: hint || this._defaultPPGHint(state)
        };

        if (this._mode !== 'legacy') {
            this._dispatch('tenki:ppg-state', payload);
        }
    }

    /**
     * 發送手指覆蓋率更新（已內建 10 Hz 節流）
     *
     * @param {number} coverage - 0.0–1.0
     */
    emitPPGCoverage(coverage) {
        if (typeof coverage !== 'number') {
            console.error('[EventBridgeV2] coverage 必須是數字');
            return;
        }

        coverage = clamp(coverage, 0, 1);

        // 節流
        const now = Date.now();
        if (now - this._lastPPGCoverageEmit < this._ppgThrottleMs) {
            this._stats.dropped++;
            return;
        }
        this._lastPPGCoverageEmit = now;

        const color = coverageToColor(coverage);
        const hint = coverageColorToHint(color);

        const payload = { coverage, color, hint, ts: now };

        // 新事件
        if (this._mode !== 'legacy') {
            this._dispatch('tenki:ppg-coverage', payload);
        }

        // 舊事件（dual）
        if (this._mode !== 'v2-only') {
            this._dispatchDeprecated('ppg:coverage-update', {
                coverage,
                color,
                _deprecated: true
            }, 'tenki:ppg-coverage');
        }
    }

    /**
     * 發送 PPG 信號品質更新（已內建 10 Hz 節流）
     *
     * @param {number} quality - 0.0–1.0
     * @param {number} bpm
     */
    emitPPGSignal(quality, bpm) {
        quality = clamp(quality, 0, 1);

        // 節流
        const now = Date.now();
        if (now - this._lastPPGSignalEmit < this._ppgThrottleMs) {
            this._stats.dropped++;
            return;
        }
        this._lastPPGSignalEmit = now;

        const payload = { quality, bpm, ts: now };

        if (this._mode !== 'legacy') {
            this._dispatch('tenki:ppg-signal', payload);
        }

        if (this._mode !== 'v2-only') {
            this._dispatchDeprecated('ppg:signal-update', {
                quality,
                bpm,
                _deprecated: true
            }, 'tenki:ppg-signal');
        }
    }

    /**
     * 發送 PPG 校準完成（不節流，每 session 只發一次）
     *
     * @param {Object} metrics - TenkiPPGCalibrationMetrics
     */
    emitPPGComplete(metrics) {
        // 基本防呆
        if (!metrics || typeof metrics !== 'object') {
            console.error('[EventBridgeV2] emitPPGComplete: metrics 必須是物件');
            return;
        }
        if (!metrics.session_id) {
            metrics = { ...metrics, session_id: generateSessionId('ppg') };
        }

        if (this._mode !== 'legacy') {
            this._dispatch('tenki:ppg-complete', metrics);
        }
    }


    // ───────────────────────────────────────────────────────────────────────
    // Emit 方法 — 交易
    // ───────────────────────────────────────────────────────────────────────

    /**
     * 發送交易記錄
     *
     * @param {Object} record - TenkiTradeRecord
     */
    emitTradeRecord(record) {
        const validation = Validators.tradeRecord(record);
        if (!validation.valid) {
            this._handleValidationErrors('TenkiTradeRecord', validation.errors);
            return;
        }

        // 確保 trade_id 存在
        if (!record.trade_id) {
            record = { ...record, trade_id: generateSessionId('trade') };
        }

        if (this._mode !== 'legacy') {
            this._dispatch('tenki:trade-recorded', record);
        }

        if (this._mode !== 'v2-only') {
            this._dispatchDeprecated('trade:completed', {
                ...record,
                _deprecated: true
            }, 'tenki:trade-recorded');
        }
    }


    // ───────────────────────────────────────────────────────────────────────
    // 公開 Validation 方法（不發送事件，只回傳結果）
    // ───────────────────────────────────────────────────────────────────────

    /** @returns {ValidationResult} */
    validateSensorSample(sample) { return Validators.sensorSample(sample); }

    /** @returns {ValidationResult} */
    validateTEIResult(result) { return Validators.teiResult(result); }

    /** @returns {ValidationResult} */
    validateTradeRecord(record) { return Validators.tradeRecord(record); }


    // ───────────────────────────────────────────────────────────────────────
    // 工具方法
    // ───────────────────────────────────────────────────────────────────────

    /**
     * 取得事件發送統計
     * @returns {{emitted: Object, dropped: number, validationErrors: number, uptime_ms: number}}
     */
    getEventStats() {
        return {
            emitted: { ...this._stats.emitted },
            dropped: this._stats.dropped,
            validationErrors: this._stats.validationErrors,
            uptime_ms: Date.now() - this._stats.startedAt
        };
    }

    /**
     * 清空感測器緩衝（測試用）
     */
    clearBuffer() {
        this._sensorBuffer = [];
        this._log('感測器緩衝已清空');
    }

    /**
     * 重設統計計數器（測試用）
     */
    resetStats() {
        this._stats.emitted = {};
        this._stats.dropped = 0;
        this._stats.validationErrors = 0;
        this._stats.startedAt = Date.now();
    }


    // ───────────────────────────────────────────────────────────────────────
    // 私有方法
    // ───────────────────────────────────────────────────────────────────────

    /**
     * 從 localStorage 讀取事件模式
     * @returns {'dual'|'v2-only'|'legacy'|null}
     * @private
     */
    _readStoredMode() {
        try {
            const stored = localStorage.getItem(LS_MODE_KEY);
            return VALID_MODES.includes(stored) ? stored : null;
        } catch {
            return null;
        }
    }

    /**
     * 沖出感測器批次緩衝
     * @param {number} now - Date.now()
     * @private
     */
    _flushSensorBuffer(now) {
        if (this._sensorBuffer.length === 0) return;

        const samples = this._sensorBuffer.slice();
        this._sensorBuffer = [];
        this._lastSensorEmit = now;

        const batchPayload = {
            samples,
            count: samples.length,
            timeRange: {
                start: samples[0].ts,
                end: samples[samples.length - 1].ts
            }
        };

        this._dispatch('tenki:sensor-samples-batch', batchPayload);
    }

    /**
     * 發送舊版 TEI 事件（dual mode）
     * @param {Object} teiResult - TenkiTEIResult
     * @private
     */
    _emitLegacyTEIEvents(teiResult) {
        // Alias：tenki:tei-updated (保留至 Phase 3)
        this._dispatchDeprecated('tenki:tei-updated', {
            tei: teiResult.tei_pr99,
            source: 'progressive-v2',
            timestamp: teiResult.ts,
            confidence: teiResult.confidence,
            _deprecated: true,
            _message: 'Use tenki:tei-progressive instead'
        }, 'tenki:tei-progressive');

        // 超舊事件：tei:update (Phase 3 移除)
        this._dispatchDeprecated('tei:update', {
            score: teiResult.tei_pr99,
            _deprecated: true,
            _message: 'Use tenki:tei-progressive instead'
        }, 'tenki:tei-progressive');

        // 舊事件：tei:updated
        this._dispatchDeprecated('tei:updated', {
            tei: teiResult.tei_pr99,
            _deprecated: true
        }, 'tenki:tei-progressive');
    }

    /**
     * 核心發送：dispatch CustomEvent 並更新統計
     * @param {string} eventName
     * @param {Object} detail
     * @private
     */
    _dispatch(eventName, detail) {
        this.dispatchEvent(new CustomEvent(eventName, { detail, bubbles: false }));
        this._stats.emitted[eventName] = (this._stats.emitted[eventName] || 0) + 1;
    }

    /**
     * 發送帶有 deprecation warning 的舊事件
     * @param {string} eventName    - 舊事件名稱
     * @param {Object} detail
     * @param {string} replacement  - 建議改用的新事件
     * @private
     */
    _dispatchDeprecated(eventName, detail, replacement) {
        if (this._deprecationWarnings && !this._removedEventWarned.has(eventName)) {
            console.warn(
                `[EventBridgeV2] [DEPRECATED] "${eventName}" 已過時，` +
                `請改用 "${replacement}"。將在 v2.1.0 移除。`
            );
        }
        this._dispatch(eventName, detail);
    }

    /**
     * 處理驗證錯誤
     * @param {string}  schemaName  - Payload 類型名稱
     * @param {Array}   errors      - ValidationResult.errors
     * @param {boolean} [throws=false] - 是否拋出例外
     * @private
     */
    _handleValidationErrors(schemaName, errors, throws = false) {
        this._stats.validationErrors++;

        const messages = errors.map(e => `  • ${e.field} (${e.code}): ${e.message}`).join('\n');
        const fullMsg = `[EventBridgeV2] ${schemaName} 驗證失敗:\n${messages}`;

        if (throws) {
            throw new ValidationError(errors[0].field, errors[0].code, errors[0].message);
        } else {
            console.error(fullMsg);
        }
    }

    /**
     * 根據 PPG 狀態產生預設提示文字
     * @param {string} state
     * @returns {string}
     * @private
     */
    _defaultPPGHint(state) {
        const hints = {
            INIT: '準備開始掃描',
            DETECTING: '偵測手指中...',
            RED: '請將手指完整覆蓋鏡頭',
            YELLOW: '繼續調整手指位置',
            GREEN: '保持不動，正在讀取...',
            LOCKED: '信號鎖定，掃描進行中',
            ERROR: '偵測失敗，請重試'
        };
        return hints[state] || '';
    }

    /**
     * 內部 log（可被 debug flag 控制）
     * @param {string} msg
     * @private
     */
    _log(msg) {
        try {
            if (localStorage.getItem('tenki:debug') === 'true') {
                console.log(`[EventBridgeV2] ${msg}`);
            }
        } catch {
            // localStorage 不可用時靜默忽略
        }
    }
}


// ─────────────────────────────────────────────────────────────────────────────
// 掛載全域單例（透過 bootstrap.js 調用，或直接 <script> 載入）
// ─────────────────────────────────────────────────────────────────────────────

if (typeof window !== 'undefined') {
    if (window.EventBridgeV2) {
        console.warn('[EventBridgeV2] 偵測到重複載入，跳過初始化');
    } else {
        window.EventBridgeV2 = new EventBridgeV2();
    }
}

// ES Module export（供測試及未來 bundler 使用）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { EventBridgeV2, ValidationError, Validators, coverageToColor };
}
