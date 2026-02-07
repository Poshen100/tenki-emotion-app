/**
 * TENKI PRO - Dashboard Patch v1.0
 * 
 * 修復 Dashboard 顯示問題：
 * 1. 防止 NaN 顯示
 * 2. 確保所有卡片有預設值
 * 3. 透過 Event Bridge 接收更新
 * 
 * @author TENKI Team
 * @version 1.0.0
 */

(function () {
    'use strict';

    // =============================================================================
    // CONFIGURATION
    // =============================================================================

    const CONFIG = {
        // 更新間隔 (ms)
        UPDATE_INTERVAL: 200,

        // 預設值
        DEFAULTS: {
            hr: 72,
            hrv: 45,
            rr: 14,
            stress: 50,
            quality: 0,
            snsRatio: 50,
            pnsRatio: 50
        },

        // 元素 ID 對應
        ELEMENTS: {
            // Bio Cards
            bioHrVal: 'bio-hr-val',
            bioHrvVal: 'bio-hrv-val',
            bioRrVal: 'bio-rr-val',
            bioStressPr: 'bio-stress-pr',
            bioQualityVal: 'bio-quality-val',

            // Status badges
            hrvStatusBadge: 'hrv-status-badge',
            hrvStatusIcon: 'hrv-status-icon',
            hrvStatusText: 'hrv-status-text',
            stressZoneBadge: 'stress-zone-badge',

            // ANS Balance
            snsVal: 'sns-val',
            pnsVal: 'pns-val',
            ansSnsBar: 'ans-sns-bar',
            ansPnsBar: 'ans-pns-bar'
        }
    };

    // =============================================================================
    // STATE
    // =============================================================================

    const state = {
        isPatched: false,
        lastUpdate: 0,
        metrics: { ...CONFIG.DEFAULTS }
    };

    // =============================================================================
    // UTILITY FUNCTIONS
    // =============================================================================

    /**
     * 安全取得數值，防止 NaN
     */
    function safeNumber(value, fallback = 0) {
        const num = Number(value);
        return isNaN(num) || !isFinite(num) ? fallback : num;
    }

    /**
     * 安全設置元素文字
     */
    function safeSetText(elementId, value, fallback = '--') {
        const el = document.getElementById(elementId);
        if (!el) return;

        const displayValue = (value === null || value === undefined || (typeof value === 'number' && isNaN(value)))
            ? fallback
            : value;

        el.innerText = displayValue;
    }

    /**
     * 取得 HRV 狀態
     */
    function getHrvStatus(rmssd, baseline = 50) {
        const deviation = (rmssd - baseline) / baseline;

        if (deviation >= -0.10 && deviation <= 0.15) {
            return { label: 'Balanced', icon: '✅', cssClass: 'balanced' };
        }
        if (deviation > 0.15 || (deviation < -0.10 && deviation >= -0.25)) {
            return { label: 'Unbalanced', icon: '⚠️', cssClass: 'unbalanced' };
        }
        if (deviation < -0.25) {
            return { label: 'Poor', icon: '🔴', cssClass: 'poor' };
        }
        return { label: 'Low', icon: '🟣', cssClass: 'low' };
    }

    /**
     * 取得壓力區域
     */
    function getStressZone(teiPr) {
        if (teiPr >= 80) return { label: 'Peak', cssClass: 'peak' };
        if (teiPr >= 60) return { label: 'Optimal', cssClass: 'optimal' };
        if (teiPr >= 40) return { label: 'Neutral', cssClass: 'neutral' };
        return { label: 'Degraded', cssClass: 'degraded' };
    }

    // =============================================================================
    // DASHBOARD UPDATE
    // =============================================================================

    /**
     * 更新 Dashboard 顯示
     */
    function updateDashboard() {
        const m = state.metrics;

        // Card A: Live HR
        safeSetText(CONFIG.ELEMENTS.bioHrVal, safeNumber(m.hr, CONFIG.DEFAULTS.hr));

        // Card B: HRV Status
        const rmssd = safeNumber(m.hrv, CONFIG.DEFAULTS.hrv);
        safeSetText(CONFIG.ELEMENTS.bioHrvVal, Math.round(rmssd));

        const hrvStatus = getHrvStatus(rmssd);
        const hrvBadge = document.getElementById(CONFIG.ELEMENTS.hrvStatusBadge);
        const hrvIcon = document.getElementById(CONFIG.ELEMENTS.hrvStatusIcon);
        const hrvText = document.getElementById(CONFIG.ELEMENTS.hrvStatusText);

        if (hrvBadge) hrvBadge.className = 'hrv-status-badge ' + hrvStatus.cssClass;
        if (hrvIcon) hrvIcon.innerText = hrvStatus.icon;
        if (hrvText) hrvText.innerText = hrvStatus.label;

        // Card C: Respiratory Rate
        safeSetText(CONFIG.ELEMENTS.bioRrVal, safeNumber(m.rr, CONFIG.DEFAULTS.rr));

        // Card E: Stress Load (PR)
        const stressPr = safeNumber(m.stress, CONFIG.DEFAULTS.stress);
        safeSetText(CONFIG.ELEMENTS.bioStressPr, Math.round(stressPr));

        const stressZoneBadge = document.getElementById(CONFIG.ELEMENTS.stressZoneBadge);
        if (stressZoneBadge) {
            const zone = getStressZone(stressPr);
            stressZoneBadge.className = 'stress-zone ' + zone.cssClass;
            stressZoneBadge.innerText = zone.label;
        }

        // Card F: Signal Quality
        const quality = safeNumber(m.quality, 0);
        safeSetText(CONFIG.ELEMENTS.bioQualityVal, Math.round(quality * 100));

        // ANS Balance
        const sns = safeNumber(m.snsRatio, 50);
        const pns = safeNumber(m.pnsRatio, 50);

        safeSetText(CONFIG.ELEMENTS.snsVal, Math.round(sns) + '%');
        safeSetText(CONFIG.ELEMENTS.pnsVal, Math.round(pns) + '%');

        const snsBar = document.getElementById(CONFIG.ELEMENTS.ansSnsBar);
        const pnsBar = document.getElementById(CONFIG.ELEMENTS.ansPnsBar);

        if (snsBar) snsBar.style.width = sns + '%';
        if (pnsBar) pnsBar.style.width = pns + '%';
    }

    // =============================================================================
    // DATA COLLECTION
    // =============================================================================

    /**
     * 從 app 收集 metrics
     */
    function collectMetricsFromApp() {
        if (typeof app === 'undefined' || !app.state) return;

        const lm = app.state.liveMetrics || {};
        const rppg = app.state.rppg ? app.state.rppg.metrics : {};
        const teiPRs = app.state.teiPRs || {};

        state.metrics.hr = safeNumber(lm.hr, rppg.bpm || CONFIG.DEFAULTS.hr);
        state.metrics.hrv = safeNumber(lm.rmssd, rppg.rmssd || CONFIG.DEFAULTS.hrv);
        state.metrics.rr = safeNumber(lm.rr, CONFIG.DEFAULTS.rr);
        state.metrics.quality = safeNumber(rppg.quality, 0);
        state.metrics.snsRatio = safeNumber(lm.sns, 50);
        state.metrics.pnsRatio = safeNumber(lm.pns, 50);

        // Stress from TEI PR or derived from SNS
        if (teiPRs.tei_pr !== undefined && !isNaN(teiPRs.tei_pr)) {
            state.metrics.stress = safeNumber(teiPRs.tei_pr * 100, 50);
        } else {
            // Derive from SNS - higher SNS = higher stress
            state.metrics.stress = safeNumber(state.metrics.snsRatio, 50);
        }
    }

    // =============================================================================
    // EVENT BRIDGE INTEGRATION
    // =============================================================================

    /**
     * 監聽 Event Bridge 事件
     */
    function setupEventListeners() {
        // 監聽 TEI 更新
        if (typeof EventBridge !== 'undefined') {
            EventBridge.onTEIUpdate((data) => {
                if (data && data.tei !== undefined) {
                    state.metrics.stress = safeNumber(data.tei, 50);
                }
            });
        }

        // 監聯 HRV 更新 (from fusion controller)
        document.addEventListener('tenki:hrv-updated', (e) => {
            if (e.detail) {
                state.metrics.hr = safeNumber(e.detail.hr, state.metrics.hr);
                state.metrics.hrv = safeNumber(e.detail.rmssd, state.metrics.hrv);
            }
        });

        // 監聽 Fusion 更新
        document.addEventListener('tenki:fusion-updated', (e) => {
            if (e.detail) {
                state.metrics.stress = safeNumber(e.detail.teiEquivalent, state.metrics.stress);
            }
        });
    }

    // =============================================================================
    // INITIALIZATION
    // =============================================================================

    /**
     * 啟動 patch
     */
    function init() {
        if (state.isPatched) return;

        console.log('[DASHBOARD-PATCH] Initializing...');

        setupEventListeners();

        // 定期更新 (收集資料 + 更新顯示)
        setInterval(() => {
            collectMetricsFromApp();
            updateDashboard();
        }, CONFIG.UPDATE_INTERVAL);

        // 立即執行一次
        collectMetricsFromApp();
        updateDashboard();

        state.isPatched = true;
        console.log('[DASHBOARD-PATCH] Initialized ✓');
    }

    // 自動初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        // 稍微延遲以確保 app 已載入
        setTimeout(init, 500);
    }

    // 暴露 API
    window.TENKI_DASHBOARD_PATCH = {
        update: updateDashboard,
        getMetrics: () => ({ ...state.metrics }),
        setMetrics: (m) => Object.assign(state.metrics, m)
    };

})();
