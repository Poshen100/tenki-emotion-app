/**
 * TENKI TEIDisplayAdapter
 * ========================
 * 將 TenkiTEIResult (PR99 尺度) 轉換為三種用戶等級的 UI 顯示格式。
 *
 * 設計原則:
 * - 純函式 (Pure Function)，無副作用，無狀態
 * - 內部永遠使用 PR99 (1-99)，只有輸出層做轉換
 * - 支援三種用戶等級: consumer / trader / expert
 * - 所有顏色、Grade、標籤集中管理，禁止在 UI 組件中硬編碼
 *
 * 不可修改任何 LOCKED FILE:
 * - index.html / app.js / rpgg.js / expression.js / tenki-engine.js
 *
 * 用法:
 *   const display = window.TEIDisplayAdapter.format(teiResult, 'trader');
 *   document.getElementById('tei-score').textContent = display.primary;
 *
 * @version 2.0.0
 * @author  TENKI Core Team
 */

'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// Grade 系統 (PR99 → 4 個狀態等級)
// 與 Phase 5 Bio-Risk 4-State UI 完全對應
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} TEIGrade
 * @property {'PEAK'|'OPTIMAL'|'NEUTRAL'|'DEGRADED'} label
 * @property {string} color         - Hex 顏色代碼
 * @property {string} colorDim      - 低透明度版本（用於背景/環）
 * @property {string} action        - 交易員建議行動
 * @property {string} consumerText  - 消費者友善標籤
 * @property {string} emoji
 * @property {string} advice        - 消費者建議文字
 * @property {'pulse'|'none'|'gentle'|'breath'} haptic - 震動模式
 * @property {number} minPR99       - 此 Grade 的 PR99 下限
 * @property {number} maxPR99       - 此 Grade 的 PR99 上限
 */

/** @type {TEIGrade[]} 從高到低排列 */
const GRADE_TABLE = [
    {
        label: 'PEAK',
        minPR99: 80,
        maxPR99: 99,
        color: '#F5A623',   // 琥珀金
        colorDim: '#F5A62320',
        action: '標準倉位，嚴守風控',
        consumerText: '巔峰狀態',
        emoji: 'bolt',
        advice: '你的狀態超越 80% 的歷史記錄，保持節律',
        haptic: 'pulse',     // 脈衝震動 + 雙重確認
    },
    {
        label: 'OPTIMAL',
        minPR99: 55,
        maxPR99: 79,
        color: '#00CCFF',   // 青藍
        colorDim: '#00CCFF20',
        action: '正常操作，維持紀律',
        consumerText: '良好狀態',
        emoji: 'verified',
        advice: '狀態穩定，保持當前節奏',
        haptic: 'none',      // 無震動
    },
    {
        label: 'NEUTRAL',
        minPR99: 35,
        maxPR99: 54,
        color: '#9E9E9E',   // 淺灰
        colorDim: '#9E9E9E20',
        action: '降低倉位，挑高勝率',
        consumerText: '普通狀態',
        emoji: 'warning',
        advice: '建議稍作休息，調整呼吸',
        haptic: 'gentle',    // 輕震動
    },
    {
        label: 'DEGRADED',
        minPR99: 1,
        maxPR99: 34,
        color: '#7B4FD4',   // 深紫
        colorDim: '#7B4FD420',
        action: '建議暫停，等待恢復',
        consumerText: '需要休息',
        emoji: 'block',
        advice: '身心需要放鬆，嘗試深呼吸引導',
        haptic: 'breath',    // 呼吸引導震動
    },
];

// ─────────────────────────────────────────────────────────────────────────────
// 精度等級標籤
// ─────────────────────────────────────────────────────────────────────────────

const LEVEL_LABELS = {
    quick: { text: '2s', icon: 'electric_bolt', desc: '初步掃描' },
    standard: { text: '15s', icon: 'monitoring', desc: '標準精度' },
    precise: { text: '30s', icon: 'track_changes', desc: '高精度' },
    ultra: { text: '60s', icon: 'diamond', desc: '最高精度' },
};

// ─────────────────────────────────────────────────────────────────────────────
// 信心度 → 文字
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {number} confidence - 0–1
 * @returns {string}
 */
function confidenceToText(confidence) {
    if (confidence >= 0.85) return '非常可靠';
    if (confidence >= 0.65) return '可靠';
    if (confidence >= 0.40) return '參考';
    return '初步估算';
}

// ─────────────────────────────────────────────────────────────────────────────
// PR99 → 消費者友善百分比（非線性映射）
// ─────────────────────────────────────────────────────────────────────────────

/**
 * PR99 (1–99) → 顯示用百分比 (1–99)
 * 目前為 1:1 映射（保留非線性擴展介面）
 *
 * @param {number} pr99
 * @returns {number} 整數 1–99
 */
function pr99ToDisplayPct(pr99) {
    return Math.round(Math.min(99, Math.max(1, pr99)));
}

// ─────────────────────────────────────────────────────────────────────────────
// TEIDisplayAdapter 主類別
// ─────────────────────────────────────────────────────────────────────────────

class TEIDisplayAdapter {

    // ───────────────────────────────────────────────────────────────────────
    // 主要公開方法
    // ───────────────────────────────────────────────────────────────────────

    /**
     * 將 TenkiTEIResult 格式化為 UI 可用的顯示物件
     *
     * @param {Object}  teiResult            - TenkiTEIResult (canonical)
     * @param {number}  teiResult.tei_pr99   - 1–99
     * @param {number}  teiResult.confidence - 0–1
     * @param {string}  teiResult.level      - 'quick'|'standard'|'precise'|'ultra'
     * @param {number}  teiResult.error_margin_pr99
     * @param {number[]} teiResult.range_pr99
     * @param {Object}  teiResult.inputs
     * @param {'consumer'|'trader'|'expert'} [userLevel='consumer']
     * @returns {ConsumerDisplay|TraderDisplay|ExpertDisplay}
     */
    format(teiResult, userLevel = 'consumer') {
        this._assertValidTEIResult(teiResult);

        const grade = this.getGrade(teiResult.tei_pr99);
        const levelMeta = LEVEL_LABELS[teiResult.level] || LEVEL_LABELS.quick;

        switch (userLevel) {
            case 'expert': return this._formatExpert(teiResult, grade, levelMeta);
            case 'trader': return this._formatTrader(teiResult, grade, levelMeta);
            case 'consumer':
            default: return this._formatConsumer(teiResult, grade, levelMeta);
        }
    }

    /**
     * 取得 PR99 對應的 Grade（不需要完整 TenkiTEIResult）
     *
     * @param {number} pr99 - 1–99
     * @returns {TEIGrade}
     */
    getGrade(pr99) {
        for (const grade of GRADE_TABLE) {
            if (pr99 >= grade.minPR99 && pr99 <= grade.maxPR99) {
                return grade;
            }
        }
        // fallback: 邊界外一律返回 DEGRADED
        return GRADE_TABLE[GRADE_TABLE.length - 1];
    }

    /**
     * 取得完整 Grade 表（UI 設定頁、圖例用）
     * @returns {TEIGrade[]}
     */
    getAllGrades() {
        return GRADE_TABLE.map(g => ({ ...g }));
    }

    /**
     * 取得精度等級元數據
     * @param {'quick'|'standard'|'precise'|'ultra'} level
     * @returns {{text: string, icon: string, desc: string}}
     */
    getLevelMeta(level) {
        return { ...(LEVEL_LABELS[level] || LEVEL_LABELS.quick) };
    }

    /**
     * 比較兩個 TEI 結果，回傳趨勢
     *
     * @param {Object} prev - 舊 TenkiTEIResult
     * @param {Object} curr - 新 TenkiTEIResult
     * @returns {{ direction: 'up'|'down'|'stable', delta: number, significant: boolean }}
     */
    compareTrend(prev, curr) {
        const delta = curr.tei_pr99 - prev.tei_pr99;
        const prevGrade = this.getGrade(prev.tei_pr99);
        const currGrade = this.getGrade(curr.tei_pr99);

        return {
            direction: delta > 1 ? 'up' : delta < -1 ? 'down' : 'stable',
            delta: Math.round(delta),
            significant: prevGrade.label !== currGrade.label,
            arrow: delta > 1 ? '↑' : delta < -1 ? '↓' : '→',
        };
    }

    /**
     * 產生適合螢幕閱讀器的無障礙文字描述
     *
     * @param {Object} teiResult
     * @returns {string}
     */
    toAriaLabel(teiResult) {
        const grade = this.getGrade(teiResult.tei_pr99);
        const pct = pr99ToDisplayPct(teiResult.tei_pr99);
        return (
            `當前狀態：${grade.consumerText}，` +
            `TEI 值 ${pct}，信心度 ${Math.round(teiResult.confidence * 100)}%`
        );
    }


    // ───────────────────────────────────────────────────────────────────────
    // 私有格式化方法
    // ───────────────────────────────────────────────────────────────────────

    /**
     * Consumer 模式 — 最友善，百分比 + 文字 + Emoji
     * @private
     */
    _formatConsumer(teiResult, grade, levelMeta) {
        const pct = pr99ToDisplayPct(teiResult.tei_pr99);

        return {
            mode: 'consumer',
            primary: `${pct}%`,
            label: `${grade.emoji} ${grade.consumerText}`,
            advice: grade.advice,
            emoji: grade.emoji,
            color: grade.color,
            colorDim: grade.colorDim,
            haptic: grade.haptic,
            levelBadge: `${levelMeta.icon} ${levelMeta.text}`,
            ariaLabel: this.toAriaLabel(teiResult),
        };
    }

    /**
     * Trader 模式 — 保留技術細節 + 行動建議
     * @private
     */
    _formatTrader(teiResult, grade, levelMeta) {
        const sources = teiResult.inputs.sources
            .map(s => this._sourceLabel(s))
            .join(' + ');

        return {
            mode: 'trader',
            primary: `TEI ${teiResult.tei_pr99}`,
            grade: grade.label,
            errorMargin: `±${teiResult.error_margin_pr99}`,
            rangeText: `[${teiResult.range_pr99[0]}, ${teiResult.range_pr99[1]}]`,
            action: grade.action,
            color: grade.color,
            colorDim: grade.colorDim,
            haptic: grade.haptic,
            sources: `${sources} · ${teiResult.inputs.samples_used} samples`,
            qualityPct: Math.round(teiResult.inputs.quality_avg * 100),
            levelBadge: `${levelMeta.icon} ${levelMeta.text} ${levelMeta.desc}`,
            confidencePct: Math.round(teiResult.confidence * 100),
            confidenceText: confidenceToText(teiResult.confidence),
        };
    }

    /**
     * Expert 模式 — 完整技術細節 + 原始 payload
     * @private
     */
    _formatExpert(teiResult, grade, levelMeta) {
        return {
            mode: 'expert',
            primary: `TEI ${teiResult.tei_pr99}/99`,
            subtitle: `信心度 ${Math.round(teiResult.confidence * 100)}% · ${confidenceToText(teiResult.confidence)}`,
            rangeDetail: `區間 [${teiResult.range_pr99[0]}, ${teiResult.range_pr99[1]}] ±${teiResult.error_margin_pr99} PR`,
            tooltip: (
                `Percentile Rank: 你目前的狀態優於自己歷史上 ${teiResult.tei_pr99}% 的時刻。\n` +
                `掃描精度: ${levelMeta.desc} (${teiResult.inputs.samples_used} 個樣本)\n` +
                `信號品質: ${Math.round(teiResult.inputs.quality_avg * 100)}%\n` +
                `資料來源: ${teiResult.inputs.sources.join(', ')}`
            ),
            color: grade.color,
            colorDim: grade.colorDim,
            gradeLabel: grade.label,
            haptic: grade.haptic,
            levelBadge: `${levelMeta.icon} ${levelMeta.text}`,
            raw: { ...teiResult },
            gradeRaw: { ...grade },
        };
    }

    /**
     * 資料來源 → 友善標籤
     * @private
     */
    _sourceLabel(source) {
        const labels = {
            rppg: 'rPPG',
            healthkit: 'HealthKit',
            watch: 'Apple Watch',
            manual: '手動輸入',
            sim: '模擬',
        };
        return labels[source] || source;
    }

    /**
     * 基本防呆：確認 teiResult 有必要欄位
     * @private
     */
    _assertValidTEIResult(r) {
        if (!r || typeof r !== 'object') {
            throw new TypeError('[TEIDisplayAdapter] teiResult 必須是物件');
        }
        if (typeof r.tei_pr99 !== 'number' || r.tei_pr99 < 1 || r.tei_pr99 > 99) {
            throw new RangeError(`[TEIDisplayAdapter] tei_pr99 必須在 1–99，收到 ${r.tei_pr99}`);
        }
        if (!r.inputs || !Array.isArray(r.inputs.sources)) {
            throw new TypeError('[TEIDisplayAdapter] teiResult.inputs.sources 必填');
        }
    }
}


// ─────────────────────────────────────────────────────────────────────────────
// 全域單例
// ─────────────────────────────────────────────────────────────────────────────

if (typeof window !== 'undefined') {
    if (window.TEIDisplayAdapter) {
        console.warn('[TEIDisplayAdapter] 偵測到重複載入，跳過初始化');
    } else {
        window.TEIDisplayAdapter = new TEIDisplayAdapter();
    }
}

// ES Module export（供測試及 bundler 使用）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        TEIDisplayAdapter,
        GRADE_TABLE,
        LEVEL_LABELS,
        pr99ToDisplayPct,
        confidenceToText,
    };
}
