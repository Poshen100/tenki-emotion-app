/**
 * TENKI Bootstrap — Integration Entry Point
 * ==========================================
 * 負責按正確順序初始化所有整合模組。
 *
 * [WARNING] 此檔案是唯一允許修改的入口點。
 *     LOCKED FILES (index.html, app.js, rpgg.js, expression.js, tenki-engine.js)
 *     絕對不可修改。
 *
 * 載入順序:
 *   1. EventBridgeV2  (事件橋接器，必須最先)
 *   2. EventBridgeAdapter (舊事件攔截，監聯舊事件並橋接到 V2)
 *   3. TEIDisplayAdapter (UI 格式化，依賴 EventBridgeV2)
 *   4. 其他模組...
 *
 * @version 2.0.0
 */

'use strict';

(function initTenkiBootstrap() {
    // ── 防重複初始化
    if (window.__TENKI_BOOTSTRAP_DONE__) {
        console.warn('[Bootstrap] 已初始化，跳過重複執行');
        return;
    }

    const startTs = performance.now();

    // ─────────────────────────────────────────────────────────────────────
    // Step 1: EventBridgeV2
    // 注意: event-bridge-v2.js 自動掛載 window.EventBridgeV2
    // 如果已透過 <script> 標籤載入，這裡只做確認
    // ─────────────────────────────────────────────────────────────────────
    function initEventBridgeV2() {
        if (!window.EventBridgeV2) {
            console.error(
                '[Bootstrap] [ERROR] EventBridgeV2 未載入！' +
                '請確認 event-bridge-v2.js 已在 bootstrap.js 之前載入。'
            );
            return false;
        }

        console.log(
            `[Bootstrap] [OK] EventBridgeV2 ready` +
            ` (mode: ${window.EventBridgeV2.mode})`
        );
        return true;
    }

    // ─────────────────────────────────────────────────────────────────────
    // Step 2: Feature Flag UI（Phase 2 開始啟用）
    // 開發者設定面板，讓用戶切換事件模式
    // ─────────────────────────────────────────────────────────────────────
    function initFeatureFlagUI() {
        // 只在開發者模式或 localhost 下顯示
        const isDevEnv = (
            location.hostname === 'localhost' ||
            location.hostname === '127.0.0.1' ||
            location.search.includes('tenki_dev=1')
        );

        if (!isDevEnv) return;

        // 避免重複插入
        if (document.getElementById('tenki-dev-panel')) return;

        const panel = document.createElement('div');
        panel.id = 'tenki-dev-panel';
        panel.style.cssText = [
            'position: fixed',
            'bottom: 12px',
            'right: 12px',
            'background: rgba(0,0,0,0.85)',
            'color: #00FF88',
            'font-family: monospace',
            'font-size: 11px',
            'padding: 10px 14px',
            'border-radius: 8px',
            'border: 1px solid #00FF8840',
            'z-index: 99999',
            'min-width: 200px',
            'backdrop-filter: blur(6px)'
        ].join(';');

        panel.innerHTML = `
            <div style="margin-bottom:6px;font-weight:bold;color:#00FF88">
                <span class="material-symbols-outlined ferrari-icon" style="font-size:14px">electric_bolt</span> TENKI Dev Panel
            </div>
            <div style="margin-bottom:4px">
                <label style="color:#aaa">Event Mode:</label>
                <select id="tenki-event-mode-select" style="
                    background:#111;color:#00FF88;border:1px solid #333;
                    border-radius:4px;padding:2px 6px;font-size:11px;
                    font-family:monospace;cursor:pointer;margin-left:4px
                ">
                    <option value="dual">dual (兼容)</option>
                    <option value="v2-only">v2-only (測試)</option>
                    <option value="legacy">legacy (除錯)</option>
                </select>
            </div>
            <div style="margin-bottom:4px">
                <label style="color:#aaa">Debug Log:</label>
                <input type="checkbox" id="tenki-debug-toggle" style="margin-left:4px;cursor:pointer">
            </div>
            <div id="tenki-stats-display" style="color:#666;font-size:10px;margin-top:6px"></div>
        `;

        document.body.appendChild(panel);

        // 設定當前模式
        const modeSelect = document.getElementById('tenki-event-mode-select');
        const currentMode = localStorage.getItem('tenki:event-mode') || 'dual';
        modeSelect.value = currentMode;

        modeSelect.addEventListener('change', (e) => {
            window.EventBridgeV2.setMode(e.target.value);
        });

        // Debug toggle
        const debugToggle = document.getElementById('tenki-debug-toggle');
        debugToggle.checked = localStorage.getItem('tenki:debug') === 'true';
        debugToggle.addEventListener('change', (e) => {
            localStorage.setItem('tenki:debug', e.target.checked ? 'true' : 'false');
        });

        // 每 2 秒更新統計
        setInterval(() => {
            const statsEl = document.getElementById('tenki-stats-display');
            if (!statsEl || !window.EventBridgeV2) return;

            const stats = window.EventBridgeV2.getEventStats();
            const topEvents = Object.entries(stats.emitted)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 3)
                .map(([k, v]) => `${k.replace('tenki:', '')}: ${v}`)
                .join('<br>');

            statsEl.innerHTML = [
                `uptime: ${Math.round(stats.uptime_ms / 1000)}s`,
                `dropped: ${stats.dropped}`,
                `valErr: ${stats.validationErrors}`,
                topEvents
            ].join('<br>');
        }, 2000);
    }

    // ─────────────────────────────────────────────────────────────────────
    // Step 3: 舊事件攔截橋（可選，當舊模組發出舊事件時，轉發給 EventBridgeV2）
    // 這讓 LOCKED FILES 中的舊事件也能流入新系統
    // ─────────────────────────────────────────────────────────────────────
    function initLegacyBridge() {
        const bridge = window.EventBridgeV2;
        if (!bridge) return;

        // 如果舊代碼（如 rpgg.js）直接 dispatchEvent('tei:update') 到 document，
        // 我們在這裡攔截並橋接到 EventBridgeV2
        document.addEventListener('tei:update', (e) => {
            // 不做 re-emit（避免循環），只是讓 console 知道有舊事件流過
            if (localStorage.getItem('tenki:debug') === 'true') {
                console.log('[Bootstrap] 攔截到舊事件 tei:update，已由 EventBridgeV2 dual emit 覆蓋');
            }
        });

        document.addEventListener('ppg:coverage-update', (e) => {
            // 攔截舊 PPG 事件，如果 V2 尚未發送，可選擇橋接
            // 目前僅記錄，不做轉發（由 ppg-calibration.js V2 版負責發送）
        });
    }

    // ─────────────────────────────────────────────────────────────────────
    // 初始化執行
    // ─────────────────────────────────────────────────────────────────────
    const v2ok = initEventBridgeV2();

    if (v2ok) {
        initLegacyBridge();
        initFeatureFlagUI();
    }

    window.__TENKI_BOOTSTRAP_DONE__ = true;

    const elapsed = (performance.now() - startTs).toFixed(1);
    console.log(`[Bootstrap] [OK] 初始化完成 (${elapsed}ms)`);

})();
