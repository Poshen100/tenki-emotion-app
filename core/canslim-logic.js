/**
 * TENKI CORE — canslim-logic.js
 * T3 CANSLIM 三段邏輯 + T4 High RS 兩段邏輯
 *
 * T3 CANSLIM Growth (300s):
 *   段1 [  0- 90s] No chase       🔴 — 不追高，等待回調
 *   段2 [ 90-210s] Watch EMA+Vol  🟡 — 觀察均線與成交量
 *   段3 [210-300s] Sweet zone     🟢 — 最佳進場區
 *
 * T4 High RS Breakout (240s):
 *   段1 [  0- 60s] Hold           🔴 — 等待，不急進
 *   段2 [ 60-240s] Breakout ready 🟢 — 突破位置已就緒
 *
 * 通訊: EventBridge only.
 * 不直接操作 Stardust DOM.
 *
 * @author Antigravity AI
 * @version 1.0.0
 */

(function (global) {
    'use strict';

    // =========================================================================
    // T3 CANSLIM 三段定義
    // =========================================================================

    const T3_CANSLIM = {
        id: 'CANSILM_GROWTH',
        name: 'CANSLIM 成長股',
        icon: '📈',
        duration: 300,
        segments: [
            {
                index: 0,
                startSec: 0,
                endSec: 90,
                label: 'No Chase',
                hint: '不追高，等待回調',
                color: '#ff6b6b',
                colorAlpha: 'rgba(255,107,107,0.18)',
                action: '❌ 等待',
                riskLevel: 'HIGH',
                bioCriteria: {
                    maxTEI: 100,          // 任何 TEI 都禁止進場
                    description: '情緒仍在啟動期，觀察市場節奏'
                }
            },
            {
                index: 1,
                startSec: 90,
                endSec: 210,
                label: 'Watch EMA + Volume',
                hint: '觀察均線與成交量',
                color: '#ffd93d',
                colorAlpha: 'rgba(255,217,61,0.18)',
                action: '👁 觀察',
                riskLevel: 'MEDIUM',
                bioCriteria: {
                    minTEI: 40,           // TEI ≥ 40 才考慮
                    description: '均線對齊 + 量能確認，TEI ≥ 40'
                }
            },
            {
                index: 2,
                startSec: 210,
                endSec: 300,
                label: 'Sweet Zone',
                hint: '最佳進場區，紀律執行',
                color: '#6bcb77',
                colorAlpha: 'rgba(107,203,119,0.18)',
                action: '✅ 執行',
                riskLevel: 'LOW',
                bioCriteria: {
                    minTEI: 55,           // TEI ≥ 55 進場
                    description: '生物信號穩定，可執行決策'
                }
            }
        ],
        timeoutMessage: 'No FOMO today 🎯',
        timeoutHint: '已超過觀察窗口，等待下一個機會'
    };

    // =========================================================================
    // T4 High RS 兩段定義
    // =========================================================================

    const T4_HIGHRS = {
        id: 'CANSILM_HIGHRS',
        name: 'High RS Breakout',
        icon: '🚀',
        duration: 240,
        segments: [
            {
                index: 0,
                startSec: 0,
                endSec: 60,
                label: 'Hold',
                hint: '等待，不急進場',
                color: '#ff6b6b',
                colorAlpha: 'rgba(255,107,107,0.18)',
                action: '🛑 Hold',
                riskLevel: 'HIGH',
                bioCriteria: {
                    maxTEI: 100,
                    description: '首60秒禁止進場，評估突破強度'
                }
            },
            {
                index: 1,
                startSec: 60,
                endSec: 240,
                label: 'Breakout Ready',
                hint: '突破位置已就緒，確認RS強度',
                color: '#6bcb77',
                colorAlpha: 'rgba(107,203,119,0.18)',
                action: '🚀 執行',
                riskLevel: 'LOW',
                bioCriteria: {
                    minTEI: 50,
                    description: 'RS強度確認 + 量能放大，TEI ≥ 50'
                }
            }
        ],
        timeoutMessage: 'Patience pays 💎',
        timeoutHint: '突破窗口已關閉，等待下次機會'
    };

    // =========================================================================
    // CANSLIM Logic Engine
    // =========================================================================

    const CANSLIMLogic = {

        // 模板映射
        templates: {
            CANSILM_GROWTH: T3_CANSLIM,
            CANSILM_HIGHRS: T4_HIGHRS
        },

        /**
         * 取得指定模板
         * @param {string} templateId
         * @returns {Object|null}
         */
        getTemplate(templateId) {
            return this.templates[templateId] || null;
        },

        /**
         * 根據已過時間取得當前段落
         * @param {string} templateId
         * @param {number} elapsedSec - 已過秒數
         * @returns {Object} 段落資訊 + 進度
         */
        getSegment(templateId, elapsedSec) {
            const tmpl = this.getTemplate(templateId);
            if (!tmpl) return null;

            const elapsed = Math.max(0, elapsedSec);
            let seg = tmpl.segments[tmpl.segments.length - 1]; // 預設最後段

            for (const s of tmpl.segments) {
                if (elapsed < s.endSec) {
                    seg = s;
                    break;
                }
            }

            // 段落內進度 (0~1)
            const segDuration = seg.endSec - seg.startSec;
            const segElapsed = Math.max(0, elapsed - seg.startSec);
            const segProgress = Math.min(1, segElapsed / segDuration);

            // 整體進度 (0~1)
            const totalProgress = Math.min(1, elapsed / tmpl.duration);

            return {
                ...seg,
                segProgress,        // 本段進度 0~1
                totalProgress,      // 全體進度 0~1
                elapsed,
                remaining: Math.max(0, tmpl.duration - elapsed),
                isComplete: elapsed >= tmpl.duration
            };
        },

        /**
         * TEI 是否滿足進場條件
         * @param {string} templateId
         * @param {number} elapsedSec
         * @param {number} tei
         * @returns {{ canEnter: boolean, reason: string }}
         */
        checkBioCriteria(templateId, elapsedSec, tei) {
            const segInfo = this.getSegment(templateId, elapsedSec);
            if (!segInfo) return { canEnter: false, reason: '模板不存在' };

            const crit = segInfo.bioCriteria;

            if (crit.minTEI !== undefined && tei < crit.minTEI) {
                return {
                    canEnter: false,
                    reason: `TEI ${tei} < 門檻 ${crit.minTEI}，${crit.description}`
                };
            }

            if (segInfo.riskLevel === 'HIGH' && segInfo.index === 0) {
                return {
                    canEnter: false,
                    reason: `段落「${segInfo.label}」— ${crit.description}`
                };
            }

            return {
                canEnter: true,
                reason: `✓ ${crit.description}`
            };
        },

        /**
         * 生成段落 HTML (用於 Results Page 顯示)
         * @param {string} templateId
         * @param {number} elapsedSec
         * @returns {string} HTML string
         */
        renderSegmentUI(templateId, elapsedSec) {
            const tmpl = this.getTemplate(templateId);
            if (!tmpl) return '';

            const current = this.getSegment(templateId, elapsedSec);

            const segHTML = tmpl.segments.map((seg, i) => {
                const isActive = current && current.index === seg.index;
                const isPast = current && seg.index < current.index;
                const segProgress = isActive ? current.segProgress : (isPast ? 1 : 0);

                return `
<div class="cl-seg ${isActive ? 'active' : ''} ${isPast ? 'past' : ''}" data-index="${i}">
  <div class="cl-seg-header">
    <span class="cl-seg-dot" style="background:${seg.color}"></span>
    <span class="cl-seg-label">${seg.label}</span>
    <span class="cl-seg-time">${_fmtTime(seg.startSec)}–${_fmtTime(seg.endSec)}</span>
    <span class="cl-seg-action" style="color:${seg.color}">${isActive ? seg.action : (isPast ? '✓' : '—')}</span>
  </div>
  <div class="cl-seg-hint">${seg.hint}</div>
  <div class="cl-seg-bar">
    <div class="cl-seg-fill" style="width:${Math.round(segProgress * 100)}%; background:${seg.color}; box-shadow:0 0 8px ${seg.color}66"></div>
  </div>
</div>`;
            }).join('');

            return `
<div class="cl-template-panel" data-template="${templateId}">
  <div class="cl-template-header">
    <span class="cl-template-icon">${tmpl.icon}</span>
    <span class="cl-template-name">${tmpl.name}</span>
    <span class="cl-template-stages">${tmpl.segments.length} 段</span>
  </div>
  <div class="cl-segments">
    ${segHTML}
  </div>
</div>`;
        }
    };

    // =========================================================================
    // 內部 helpers
    // =========================================================================

    function _fmtTime(sec) {
        const m = Math.floor(sec / 60);
        const s = sec % 60;
        return m > 0 ? `${m}m${s > 0 ? s + 's' : ''}` : `${s}s`;
    }

    // =========================================================================
    // EventBridge 整合
    // =========================================================================

    function _wireEventBridge() {
        if (typeof EventBridge === 'undefined') {
            // 等待 EventBridge 就緒
            setTimeout(_wireEventBridge, 500);
            return;
        }

        // 監聽計時器進度，更新段落 UI
        EventBridge.on('timer:progress', function (d) {
            if (!d || !d.template || !d.elapsed) return;
            _updateSegmentPanel(d.template, d.elapsed, d.tei || 50);
        });

        // 監聽 scan:complete，重置段落顯示
        EventBridge.on('scan:complete', function (d) {
            const templateId = (d && d.template) || 'CANSILM_GROWTH';
            _updateSegmentPanel(templateId, 0, (d && d.tei) || 50);
        });

        console.log('[CANSLIMLogic] EventBridge wired ✓');
    }

    function _updateSegmentPanel(templateId, elapsedSec, tei) {
        const container = document.getElementById('rp-canslim-panel');
        if (!container) return;

        container.innerHTML = CANSLIMLogic.renderSegmentUI(templateId, elapsedSec);

        // Bio check badge
        const bio = CANSLIMLogic.checkBioCriteria(templateId, elapsedSec, tei);
        const bioEl = document.getElementById('rp-bio-check');
        if (bioEl) {
            bioEl.textContent = bio.reason;
            bioEl.className = `rp-bio-check ${bio.canEnter ? 'ok' : 'warn'}`;
        }
    }

    // =========================================================================
    // CSS Injection
    // =========================================================================

    function _injectStyles() {
        if (document.getElementById('canslim-logic-styles')) return;

        const style = document.createElement('style');
        style.id = 'canslim-logic-styles';
        style.textContent = `
/* ═══════════════════════════════════════════
   CANSLIM Logic — Segment Panel Styles
   ═══════════════════════════════════════════ */

.cl-template-panel {
    font-family: 'JetBrains Mono', monospace;
}

.cl-template-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;
}

.cl-template-icon {
    font-size: 18px;
}

.cl-template-name {
    font-size: 13px;
    font-weight: 700;
    color: rgba(255,255,255,0.9);
    letter-spacing: 0.5px;
    flex: 1;
}

.cl-template-stages {
    font-size: 10px;
    color: rgba(255,255,255,0.4);
    padding: 2px 8px;
    background: rgba(255,255,255,0.06);
    border-radius: 99px;
    border: 1px solid rgba(255,255,255,0.08);
}

.cl-segments {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

/* 單個段落卡 */
.cl-seg {
    padding: 10px 12px;
    border-radius: 10px;
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.06);
    transition: all 0.3s ease;
    opacity: 0.5;
}

.cl-seg.past {
    opacity: 0.6;
}

.cl-seg.active {
    opacity: 1;
    background: rgba(255,255,255,0.06);
    border-color: rgba(255,255,255,0.12);
    box-shadow: 0 2px 12px rgba(0,0,0,0.3);
}

.cl-seg-header {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 4px;
}

.cl-seg-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
}

.cl-seg.active .cl-seg-dot {
    box-shadow: 0 0 6px currentColor;
}

.cl-seg-label {
    font-size: 11px;
    font-weight: 600;
    color: rgba(255,255,255,0.8);
    flex: 1;
}

.cl-seg-time {
    font-size: 9px;
    color: rgba(255,255,255,0.35);
    font-variant-numeric: tabular-nums;
}

.cl-seg-action {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.3px;
}

.cl-seg-hint {
    font-size: 9px;
    color: rgba(255,255,255,0.4);
    margin-bottom: 6px;
    line-height: 1.4;
}

.cl-seg.active .cl-seg-hint {
    color: rgba(255,255,255,0.6);
}

/* 進度條 */
.cl-seg-bar {
    height: 3px;
    background: rgba(255,255,255,0.08);
    border-radius: 2px;
    overflow: hidden;
}

.cl-seg-fill {
    height: 100%;
    border-radius: 2px;
    transition: width 0.5s ease;
}

/* Bio Check Badge */
.rp-bio-check {
    font-size: 10px;
    font-weight: 600;
    padding: 6px 10px;
    border-radius: 8px;
    margin-top: 10px;
    line-height: 1.4;
    display: block;
}

.rp-bio-check.ok {
    background: rgba(107,203,119,0.15);
    color: #6bcb77;
    border: 1px solid rgba(107,203,119,0.25);
}

.rp-bio-check.warn {
    background: rgba(255,107,107,0.12);
    color: #ff8c8c;
    border: 1px solid rgba(255,107,107,0.2);
}
        `;
        document.head.appendChild(style);
    }

    // =========================================================================
    // Bootstrap
    // =========================================================================

    function _init() {
        _injectStyles();
        _wireEventBridge();
        console.log('[CANSLIMLogic] T3 (3-stage) + T4 (2-stage) engine ready ✓');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', _init);
    } else {
        _init();
    }

    // =========================================================================
    // Public export
    // =========================================================================

    global.CANSLIMLogic = CANSLIMLogic;

})(typeof window !== 'undefined' ? window : this);
