/**
 * TENKI PRO - Decision Dock Controller v1.1
 * 
 * FIXED: 使用獨立浮動卡片取代劫持 processing-dock
 * 計時器現在固定在畫面底部，不遮擋生理指標內容
 * 
 * 設計原則:
 * 1. 不修改原始 dock HTML/CSS
 * 2. 透過 EventBridge 與 DecisionTimer 通訊
 * 3. 所有新樣式用 overlay-dock- 前綴
 * 4. FIXED: 使用獨立浮動卡片，不覆蓋 dashboard 內容
 * 
 * @author TENKI Team
 * @version 1.1.0
 */

const DecisionDockController = (function () {
    'use strict';

    // =============================================================================
    // STATE
    // =============================================================================

    let isInitialized = false;
    let timer = null;
    let currentState = 'IDLE';
    let selectedTemplateId = null;
    let currentTEI = 50;

    // FIXED: 浮動卡片元素
    let floatingCard = null;

    // DOM 元素快取
    let elements = {
        dock: null,
        leftBtn: null,
        mainAction: null,
        rightBtn: null,
        timerDisplay: null,
        templateDropdown: null
    };

    // =============================================================================
    // TEMPLATES
    // =============================================================================

    const TEMPLATES = [
        { id: 'CANSILM_GROWTH', name: 'Cansilm 成長股', duration: 300, icon: '📈' },
        { id: 'CANSILM_HIGHRS', name: 'High RS Breakout', duration: 240, icon: '🚀' },
        { id: 'MANCINI_FBD', name: 'Mancini FBD', duration: 180, icon: '⚡' },
        { id: 'FOCUS_SESSION', name: '專注時段', duration: 1500, icon: '🎯' },
        { id: 'RECOVERY_BREAK', name: '恢復休息', duration: 300, icon: '🧘' }
    ];

    // =============================================================================
    // INITIALIZATION
    // =============================================================================

    function init() {
        if (isInitialized) return;

        console.log('[DecisionDock] Initializing v1.1 (floating card)...');

        // 等待 DOM 就緒
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', setup);
        } else {
            setup();
        }
    }

    function setup() {
        // FIXED: 不再需要取得 dock 元素，改用獨立浮動卡片
        elements.dock = document.getElementById('processing-dock');

        // 注入 CSS
        injectStyles();

        // FIXED: 建立獨立浮動卡片（不劫持 processing-dock）
        createFloatingCard();

        // 訂閱事件
        subscribeToEvents();

        // 初始化計時器
        initTimer();

        isInitialized = true;
        console.log('[DecisionDock] Initialized successfully (floating card mode)');
    }

    // =============================================================================
    // FIXED: FLOATING CARD UI (取代 enhanceDock)
    // =============================================================================

    function createFloatingCard() {
        // FIXED: 建立獨立的浮動卡片元素，不修改原始 dock
        floatingCard = document.createElement('div');
        floatingCard.id = 'decision-timer-float';
        floatingCard.className = 'decision-timer-float';

        floatingCard.innerHTML = `
            <div class="dtf-header">
                <span class="dtf-icon">⏱️</span>
                <span class="dtf-title">決策計時器</span>
                <button class="dtf-close" id="dtf-close-btn" aria-label="關閉">✕</button>
            </div>
            <div class="dtf-body">
                <!-- 模板選擇 -->
                <div class="dtf-template-area" id="dtf-template-area">
                    <button class="dtf-template-btn" id="dtf-template-btn">
                        <span class="dtf-template-icon">📈</span>
                        <span class="dtf-template-name">選擇模板</span>
                        <span class="dtf-chevron">▾</span>
                    </button>
                    <div class="dtf-dropdown hidden" id="dtf-dropdown">
                        ${TEMPLATES.map(t => `
                            <div class="dtf-dropdown-item" data-template-id="${t.id}">
                                <span class="dtf-dropdown-icon">${t.icon}</span>
                                <div class="dtf-dropdown-info">
                                    <div class="dtf-dropdown-name">${t.name}</div>
                                    <div class="dtf-dropdown-duration">${formatDuration(t.duration)}</div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <!-- 計時器顯示 (初始隱藏) -->
                <div class="dtf-timer hidden" id="dtf-timer">
                    <div class="dtf-time" id="dtf-time">05:00</div>
                    <div class="dtf-segment" id="dtf-segment">準備中</div>
                    <div class="dtf-progress">
                        <div class="dtf-progress-bar" id="dtf-progress-bar" style="width: 0%"></div>
                    </div>
                </div>

                <!-- 控制按鈕列 -->
                <div class="dtf-controls">
                    <button class="dtf-action-btn dtf-primary" id="dtf-main-btn">
                        <span class="dtf-btn-icon">▶</span>
                        <span class="dtf-btn-text">開始</span>
                    </button>
                    <button class="dtf-action-btn dtf-secondary hidden" id="dtf-pause-btn">
                        <span class="dtf-btn-icon">⏸</span>
                        <span class="dtf-btn-text">暫停</span>
                    </button>
                    <button class="dtf-action-btn dtf-success hidden" id="dtf-complete-btn">
                        <span class="dtf-btn-icon">✓</span>
                        <span class="dtf-btn-text">完成</span>
                    </button>
                    <button class="dtf-action-btn dtf-ghost hidden" id="dtf-reset-btn">
                        <span class="dtf-btn-icon">↺</span>
                        <span class="dtf-btn-text">重設</span>
                    </button>
                </div>

                <!-- TEI 顯示 -->
                <div class="dtf-tei" id="dtf-tei">
                    <span class="dtf-tei-label">TEI</span>
                    <span class="dtf-tei-value" id="dtf-tei-value">${currentTEI}</span>
                </div>
            </div>
        `;

        // FIXED: 初始隱藏，等到 dashboard 顯示時才出現
        floatingCard.style.display = 'none';

        document.body.appendChild(floatingCard);

        // 快取元素
        elements.mainAction = document.getElementById('dtf-main-btn');
        elements.timerDisplay = document.getElementById('dtf-timer');
        elements.templateDropdown = document.getElementById('dtf-dropdown');

        // 綁定事件
        bindEvents();

        // 重新初始化 Lucide 圖標
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }

    // FIXED: 顯示/隱藏浮動卡片
    function showFloatingCard() {
        if (floatingCard) {
            floatingCard.style.display = '';
            floatingCard.classList.add('show');
        }
    }

    function hideFloatingCard() {
        if (floatingCard) {
            floatingCard.classList.remove('show');
            setTimeout(() => {
                if (!floatingCard.classList.contains('show')) {
                    floatingCard.style.display = 'none';
                }
            }, 400);
        }
    }

    function bindEvents() {
        // 模板選擇按鈕
        const templateBtn = document.getElementById('dtf-template-btn');
        if (templateBtn) {
            templateBtn.addEventListener('click', toggleTemplateDropdown);
        }

        // 模板選項
        const dropdownItems = document.querySelectorAll('.dtf-dropdown-item');
        dropdownItems.forEach(item => {
            item.addEventListener('click', () => {
                const templateId = item.dataset.templateId;
                selectTemplate(templateId);
            });
        });

        // 主按鈕（開始/繼續）
        const mainBtn = document.getElementById('dtf-main-btn');
        if (mainBtn) {
            mainBtn.addEventListener('click', handleMainAction);
        }

        // 暫停按鈕
        const pauseBtn = document.getElementById('dtf-pause-btn');
        if (pauseBtn) {
            pauseBtn.addEventListener('click', () => {
                if (timer && timer.getState() === 'RUNNING') {
                    timer.pause();
                }
            });
        }

        // 完成按鈕
        const completeBtn = document.getElementById('dtf-complete-btn');
        if (completeBtn) {
            completeBtn.addEventListener('click', handleComplete);
        }

        // 重設按鈕
        const resetBtn = document.getElementById('dtf-reset-btn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                if (timer) timer.reset();
            });
        }

        // 關閉按鈕
        const closeBtn = document.getElementById('dtf-close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', hideFloatingCard);
        }

        // 點擊外部關閉下拉選單
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.dtf-template-area')) {
                hideTemplateDropdown();
            }
        });
    }

    // =============================================================================
    // TEMPLATE MANAGEMENT
    // =============================================================================

    function toggleTemplateDropdown() {
        const dropdown = elements.templateDropdown;
        if (dropdown) {
            dropdown.classList.toggle('hidden');
        }
    }

    function hideTemplateDropdown() {
        const dropdown = elements.templateDropdown;
        if (dropdown) {
            dropdown.classList.add('hidden');
        }
    }

    function selectTemplate(templateId) {
        selectedTemplateId = templateId;
        const template = TEMPLATES.find(t => t.id === templateId);

        if (template) {
            // 更新按鈕顯示
            const btn = document.getElementById('dtf-template-btn');
            if (btn) {
                btn.querySelector('.dtf-template-icon').textContent = template.icon;
                btn.querySelector('.dtf-template-name').textContent = template.name;
            }

            // 設定計時器模板
            if (timer) {
                timer.setTemplate(templateId);
            }

            console.log('[DecisionDock] Selected template:', template.name);
        }

        hideTemplateDropdown();
    }

    // =============================================================================
    // TIMER CONTROL
    // =============================================================================

    function initTimer() {
        if (typeof DecisionTimer === 'undefined') {
            console.warn('[DecisionDock] DecisionTimer not available');
            return;
        }

        timer = DecisionTimer.create({
            onStateChange: handleStateChange,
            onTick: handleTick,
            onSegmentChange: handleSegmentChange
        });

        // 預設選擇第一個模板
        selectTemplate(TEMPLATES[0].id);
    }

    function handleMainAction() {
        if (!timer) {
            console.error('[DecisionDock] Timer not initialized');
            return;
        }

        const state = timer.getState();

        switch (state) {
            case 'IDLE':
                // 開始計時
                if (!selectedTemplateId) {
                    alert('請先選擇模板');
                    return;
                }
                timer.setTEI(currentTEI);
                timer.start({ skipPreview: true });
                break;

            case 'RUNNING':
                // 暫停
                timer.pause();
                break;

            case 'PAUSED':
                // 繼續
                timer.resume();
                break;

            case 'COMPLETE':
            case 'TIMEOUT':
            case 'ABORT':
                // 重置
                timer.reset();
                break;
        }
    }

    function handleComplete() {
        if (timer) {
            timer.complete();
        }
    }

    // =============================================================================
    // EVENT HANDLERS
    // =============================================================================

    function handleStateChange(data) {
        currentState = data.currentState;
        console.log('[DecisionDock] State changed:', currentState);
        updateUI();
    }

    function handleTick(data) {
        // 更新時間顯示
        const timeEl = document.getElementById('dtf-time');
        if (timeEl && timer) {
            timeEl.textContent = timer.getFormattedTime();
        }

        // 更新進度條
        const progressBar = document.getElementById('dtf-progress-bar');
        if (progressBar) {
            progressBar.style.width = `${data.progress}%`;
        }
    }

    function handleSegmentChange(data) {
        const segmentEl = document.getElementById('dtf-segment');
        if (segmentEl && data.segment) {
            segmentEl.textContent = data.segment.label || '';
        }
    }

    // FIXED: 更新 UI — 使用橫排按鈕，不遮擋內容
    function updateUI() {
        const mainBtn = document.getElementById('dtf-main-btn');
        const pauseBtn = document.getElementById('dtf-pause-btn');
        const completeBtn = document.getElementById('dtf-complete-btn');
        const resetBtn = document.getElementById('dtf-reset-btn');
        const timerDisplay = document.getElementById('dtf-timer');
        const teiDisplay = document.getElementById('dtf-tei');
        const templateArea = document.getElementById('dtf-template-area');

        // 全部先隱藏
        pauseBtn?.classList.add('hidden');
        completeBtn?.classList.add('hidden');
        resetBtn?.classList.add('hidden');

        switch (currentState) {
            case 'IDLE':
                mainBtn?.classList.remove('hidden');
                timerDisplay?.classList.add('hidden');
                teiDisplay?.classList.remove('hidden');
                templateArea?.classList.remove('hidden');

                if (mainBtn) {
                    mainBtn.querySelector('.dtf-btn-icon').textContent = '▶';
                    mainBtn.querySelector('.dtf-btn-text').textContent = '開始';
                    mainBtn.className = 'dtf-action-btn dtf-primary';
                }
                break;

            case 'RUNNING':
                mainBtn?.classList.add('hidden');
                pauseBtn?.classList.remove('hidden');
                completeBtn?.classList.remove('hidden');
                timerDisplay?.classList.remove('hidden');
                teiDisplay?.classList.add('hidden');
                templateArea?.classList.add('hidden');
                break;

            case 'PAUSED':
                mainBtn?.classList.remove('hidden');
                resetBtn?.classList.remove('hidden');
                timerDisplay?.classList.remove('hidden');
                teiDisplay?.classList.add('hidden');
                templateArea?.classList.add('hidden');

                if (mainBtn) {
                    mainBtn.querySelector('.dtf-btn-icon').textContent = '▶';
                    mainBtn.querySelector('.dtf-btn-text').textContent = '繼續';
                    mainBtn.className = 'dtf-action-btn dtf-primary';
                }
                break;

            case 'COMPLETE':
            case 'TIMEOUT':
                mainBtn?.classList.remove('hidden');
                timerDisplay?.classList.add('hidden');
                teiDisplay?.classList.add('hidden');
                templateArea?.classList.remove('hidden');

                if (mainBtn) {
                    mainBtn.querySelector('.dtf-btn-icon').textContent = '🎉';
                    mainBtn.querySelector('.dtf-btn-text').textContent = currentState === 'TIMEOUT' ? '耐心完成！' : '已完成！';
                    mainBtn.className = 'dtf-action-btn dtf-success';
                }
                break;

            case 'ABORT':
                mainBtn?.classList.remove('hidden');
                timerDisplay?.classList.add('hidden');
                teiDisplay?.classList.remove('hidden');
                templateArea?.classList.remove('hidden');

                if (mainBtn) {
                    mainBtn.querySelector('.dtf-btn-icon').textContent = '↺';
                    mainBtn.querySelector('.dtf-btn-text').textContent = '重新開始';
                    mainBtn.className = 'dtf-action-btn dtf-primary';
                }
                break;
        }

        // 重新初始化 Lucide 圖標
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }

    // =============================================================================
    // EVENT SUBSCRIPTIONS
    // =============================================================================

    function subscribeToEvents() {
        if (typeof EventBridge === 'undefined') return;

        // 訂閱 TEI 更新
        EventBridge.onTEIUpdate((data) => {
            currentTEI = data.tei;
            const teiValue = document.getElementById('dtf-tei-value');
            if (teiValue) {
                teiValue.textContent = currentTEI;
            }
        });
    }

    // =============================================================================
    // STYLES — FIXED: 浮動卡片樣式（不遮擋內容）
    // =============================================================================

    function injectStyles() {
        if (document.getElementById('decision-dock-styles')) return;

        const style = document.createElement('style');
        style.id = 'decision-dock-styles';
        style.textContent = `
            /* FIXED: Decision Timer 浮動卡片 — 固定在底部，不遮擋內容 */
            
            .decision-timer-float {
                position: fixed;
                bottom: 80px;
                left: 50%;
                transform: translateX(-50%) translateY(150%);
                
                width: 90%;
                max-width: 400px;
                padding: 14px 18px;
                
                background: rgba(30, 30, 40, 0.85);
                backdrop-filter: blur(20px);
                -webkit-backdrop-filter: blur(20px);
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 24px;
                box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.3);
                
                z-index: 100;
                opacity: 0;
                transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1),
                            opacity 0.4s cubic-bezier(0.4, 0, 0.2, 1);
                pointer-events: none;
            }

            .decision-timer-float.show {
                transform: translateX(-50%) translateY(0);
                opacity: 1;
                pointer-events: auto;
            }

            /* 標題列 */
            .dtf-header {
                display: flex;
                align-items: center;
                gap: 8px;
                margin-bottom: 10px;
            }

            .dtf-icon {
                font-size: 16px;
            }

            .dtf-title {
                flex: 1;
                font-size: 13px;
                font-weight: 600;
                color: rgba(255, 255, 255, 0.9);
                letter-spacing: 0.5px;
            }

            .dtf-close {
                width: 24px;
                height: 24px;
                border: none;
                background: rgba(255, 255, 255, 0.08);
                border-radius: 50%;
                color: rgba(255, 255, 255, 0.5);
                font-size: 11px;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.2s;
            }

            .dtf-close:hover {
                background: rgba(255, 255, 255, 0.15);
                color: white;
            }

            /* 主體 */
            .dtf-body {
                display: flex;
                align-items: center;
                gap: 10px;
                flex-wrap: wrap;
            }

            /* 模板選擇 */
            .dtf-template-area {
                position: relative;
            }

            .dtf-template-area.hidden {
                display: none;
            }

            .dtf-template-btn {
                display: flex;
                align-items: center;
                gap: 6px;
                padding: 8px 12px;
                background: rgba(255, 255, 255, 0.08);
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 12px;
                color: #fff;
                font-size: 12px;
                cursor: pointer;
                transition: all 0.2s;
            }

            .dtf-template-btn:hover {
                background: rgba(255, 255, 255, 0.15);
            }

            .dtf-template-icon {
                font-size: 14px;
            }

            .dtf-template-name {
                max-width: 100px;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            .dtf-chevron {
                font-size: 10px;
                opacity: 0.5;
            }

            /* 下拉選單 */
            .dtf-dropdown {
                position: absolute;
                bottom: 100%;
                left: 0;
                margin-bottom: 8px;
                min-width: 200px;
                background: rgba(15, 15, 25, 0.98);
                border: 1px solid rgba(255, 255, 255, 0.15);
                border-radius: 12px;
                padding: 8px;
                box-shadow: 0 -8px 32px rgba(0, 0, 0, 0.5);
                backdrop-filter: blur(20px);
                z-index: 1000;
            }

            .dtf-dropdown.hidden {
                display: none;
            }

            .dtf-dropdown-item {
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 10px;
                border-radius: 8px;
                cursor: pointer;
                transition: background 0.2s;
            }

            .dtf-dropdown-item:hover {
                background: rgba(0, 240, 255, 0.1);
            }

            .dtf-dropdown-icon {
                font-size: 18px;
            }

            .dtf-dropdown-name {
                font-size: 13px;
                font-weight: 600;
                color: #fff;
            }

            .dtf-dropdown-duration {
                font-size: 10px;
                color: rgba(255, 255, 255, 0.5);
                margin-top: 1px;
            }

            /* 計時器顯示 */
            .dtf-timer {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 2px;
                flex: 1;
            }

            .dtf-timer.hidden {
                display: none;
            }

            .dtf-time {
                font-size: 28px;
                font-weight: 700;
                font-family: 'JetBrains Mono', monospace;
                font-variant-numeric: tabular-nums;
                background: linear-gradient(135deg, #00F0FF, #9966FF);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                background-clip: text;
                line-height: 1;
            }

            .dtf-segment {
                font-size: 10px;
                color: rgba(255, 255, 255, 0.6);
                font-weight: 500;
            }

            .dtf-progress {
                width: 100%;
                max-width: 120px;
                height: 3px;
                background: rgba(255, 255, 255, 0.1);
                border-radius: 2px;
                overflow: hidden;
                margin-top: 4px;
            }

            .dtf-progress-bar {
                height: 100%;
                background: linear-gradient(90deg, #00F0FF, #9966FF);
                border-radius: 2px;
                transition: width 0.3s ease;
            }

            /* 控制按鈕 — 橫排 */
            .dtf-controls {
                display: flex;
                gap: 6px;
            }

            .dtf-action-btn {
                display: flex;
                align-items: center;
                gap: 4px;
                padding: 8px 14px;
                border: none;
                border-radius: 12px;
                color: #fff;
                font-size: 12px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s;
            }

            .dtf-action-btn.hidden {
                display: none;
            }

            .dtf-btn-icon {
                font-size: 12px;
            }

            .dtf-primary {
                background: linear-gradient(135deg, #00F0FF, #0088FF);
                box-shadow: 0 2px 12px rgba(0, 240, 255, 0.3);
            }

            .dtf-primary:hover {
                box-shadow: 0 4px 18px rgba(0, 240, 255, 0.4);
            }

            .dtf-secondary {
                background: rgba(255, 255, 255, 0.1);
                border: 1px solid rgba(255, 255, 255, 0.15);
            }

            .dtf-secondary:hover {
                background: rgba(255, 255, 255, 0.18);
            }

            .dtf-success {
                background: linear-gradient(135deg, #6bcb77, #4ade80);
                box-shadow: 0 2px 12px rgba(107, 203, 119, 0.3);
            }

            .dtf-ghost {
                background: transparent;
                border: 1px solid rgba(255, 255, 255, 0.1);
                color: rgba(255, 255, 255, 0.7);
            }

            .dtf-ghost:hover {
                background: rgba(255, 255, 255, 0.06);
            }

            /* TEI 顯示 */
            .dtf-tei {
                display: flex;
                align-items: center;
                gap: 6px;
                margin-left: auto;
                padding: 6px 12px;
                background: rgba(255, 255, 255, 0.05);
                border-radius: 10px;
            }

            .dtf-tei.hidden {
                display: none;
            }

            .dtf-tei-label {
                font-size: 9px;
                color: rgba(255, 255, 255, 0.5);
                text-transform: uppercase;
                letter-spacing: 1px;
            }

            .dtf-tei-value {
                font-size: 18px;
                font-weight: 700;
                background: linear-gradient(135deg, #00d4ff, #6bcb77);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                background-clip: text;
                line-height: 1;
            }

            /* 響應式 */
            @media (max-width: 380px) {
                .decision-timer-float {
                    width: 95%;
                    padding: 12px 14px;
                    bottom: 70px;
                }

                .dtf-template-name {
                    display: none;
                }

                .dtf-time {
                    font-size: 22px;
                }

                .dtf-btn-text {
                    display: none;
                }
            }

            /* 橫屏模式 */
            @media (orientation: landscape) and (max-height: 500px) {
                .decision-timer-float {
                    bottom: 10px;
                    max-width: 500px;
                    padding: 10px 16px;
                }

                .dtf-header {
                    margin-bottom: 6px;
                }

                .dtf-time {
                    font-size: 22px;
                }
            }
        `;

        document.head.appendChild(style);
    }

    // =============================================================================
    // UTILITIES
    // =============================================================================

    function formatDuration(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        if (secs === 0) {
            return `${mins} 分鐘`;
        }
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    // =============================================================================
    // PUBLIC API
    // =============================================================================

    return {
        init,
        selectTemplate,
        getTimer: () => timer,
        getCurrentState: () => currentState,
        // FIXED: 公開顯示/隱藏方法
        show: showFloatingCard,
        hide: hideFloatingCard
    };

})();

// 自動初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', DecisionDockController.init);
} else {
    // 延遲初始化，確保 dock 元素已存在
    setTimeout(DecisionDockController.init, 100);
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DecisionDockController;
}
