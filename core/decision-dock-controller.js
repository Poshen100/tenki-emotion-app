/**
 * TENKI PRO - Decision Dock Controller v1.0
 * 
 * 將現有 processing-dock 動態增強為決策計時器 UI
 * 
 * 設計原則:
 * 1. 不修改原始 dock HTML/CSS
 * 2. 透過 EventBridge 與 DecisionTimer 通訊
 * 3. 所有新樣式用 overlay-dock- 前綴
 * 
 * @author TENKI Team
 * @version 1.0.0
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

        console.log('[DecisionDock] Initializing...');

        // 等待 DOM 就緒
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', setup);
        } else {
            setup();
        }
    }

    function setup() {
        // 取得原始 dock 元素
        elements.dock = document.getElementById('processing-dock');
        if (!elements.dock) {
            console.warn('[DecisionDock] Dock not found, retrying in 500ms...');
            setTimeout(setup, 500);
            return;
        }

        // 注入 CSS
        injectStyles();

        // 增強 dock UI
        enhanceDock();

        // 訂閱事件
        subscribeToEvents();

        // 初始化計時器
        initTimer();

        isInitialized = true;
        console.log('[DecisionDock] Initialized successfully');
    }

    // =============================================================================
    // DOCK UI ENHANCEMENT
    // =============================================================================

    function enhanceDock() {
        const dock = elements.dock;

        // 清除原始內容
        dock.innerHTML = '';

        // 建立新的 dock 結構
        dock.innerHTML = `
            <!-- 左按鈕: 模板選擇 -->
            <div class="overlay-dock-left" id="dock-left-btn">
                <button class="overlay-dock-btn overlay-dock-template-btn" id="dock-template-btn">
                    <span class="overlay-dock-template-icon">📈</span>
                    <span class="overlay-dock-template-name">選擇模板</span>
                    <i data-lucide="chevron-down" class="w-3 h-3 opacity-60"></i>
                </button>
                <!-- 模板下拉選單 -->
                <div class="overlay-dock-dropdown hidden" id="dock-template-dropdown">
                    ${TEMPLATES.map(t => `
                        <div class="overlay-dock-dropdown-item" data-template-id="${t.id}">
                            <span class="overlay-dock-dropdown-icon">${t.icon}</span>
                            <div class="overlay-dock-dropdown-info">
                                <div class="overlay-dock-dropdown-name">${t.name}</div>
                                <div class="overlay-dock-dropdown-duration">${formatDuration(t.duration)}</div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>

            <!-- 中間: 主要動作區 -->
            <div class="overlay-dock-center" id="dock-center">
                <!-- IDLE 狀態 -->
                <button class="overlay-dock-main-btn" id="dock-main-btn">
                    <i data-lucide="play" class="w-5 h-5"></i>
                    <span>開始決策計時</span>
                </button>
                
                <!-- RUNNING 狀態的計時器顯示 (初始隱藏) -->
                <div class="overlay-dock-timer hidden" id="dock-timer">
                    <div class="overlay-dock-time" id="dock-time">05:00</div>
                    <div class="overlay-dock-segment" id="dock-segment">準備中</div>
                    <div class="overlay-dock-progress">
                        <div class="overlay-dock-progress-bar" id="dock-progress-bar" style="width: 0%"></div>
                    </div>
                </div>
            </div>

            <!-- 右按鈕: TEI 顯示 / 動作按鈕 -->
            <div class="overlay-dock-right" id="dock-right-btn">
                <!-- IDLE: 顯示 TEI -->
                <div class="overlay-dock-tei" id="dock-tei">
                    <div class="overlay-dock-tei-value">${currentTEI}</div>
                    <div class="overlay-dock-tei-label">TEI</div>
                </div>
                
                <!-- RUNNING: 完成按鈕 (初始隱藏) -->
                <button class="overlay-dock-btn overlay-dock-complete-btn hidden" id="dock-complete-btn">
                    <i data-lucide="check" class="w-5 h-5"></i>
                    <span>完成</span>
                </button>
            </div>
        `;

        // 快取元素
        elements.leftBtn = document.getElementById('dock-left-btn');
        elements.mainAction = document.getElementById('dock-main-btn');
        elements.timerDisplay = document.getElementById('dock-timer');
        elements.rightBtn = document.getElementById('dock-right-btn');
        elements.templateDropdown = document.getElementById('dock-template-dropdown');

        // 綁定事件
        bindEvents();

        // 重新初始化 Lucide 圖標
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }

    function bindEvents() {
        // 模板選擇按鈕
        const templateBtn = document.getElementById('dock-template-btn');
        if (templateBtn) {
            templateBtn.addEventListener('click', toggleTemplateDropdown);
        }

        // 模板選項
        const dropdownItems = document.querySelectorAll('.overlay-dock-dropdown-item');
        dropdownItems.forEach(item => {
            item.addEventListener('click', () => {
                const templateId = item.dataset.templateId;
                selectTemplate(templateId);
            });
        });

        // 主按鈕
        const mainBtn = document.getElementById('dock-main-btn');
        if (mainBtn) {
            mainBtn.addEventListener('click', handleMainAction);
        }

        // 完成按鈕
        const completeBtn = document.getElementById('dock-complete-btn');
        if (completeBtn) {
            completeBtn.addEventListener('click', handleComplete);
        }

        // 點擊外部關閉下拉選單
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.overlay-dock-left')) {
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
            const btn = document.getElementById('dock-template-btn');
            if (btn) {
                btn.querySelector('.overlay-dock-template-icon').textContent = template.icon;
                btn.querySelector('.overlay-dock-template-name').textContent = template.name;
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
        const timeEl = document.getElementById('dock-time');
        if (timeEl && timer) {
            timeEl.textContent = timer.getFormattedTime();
        }

        // 更新進度條
        const progressBar = document.getElementById('dock-progress-bar');
        if (progressBar) {
            progressBar.style.width = `${data.progress}%`;
        }
    }

    function handleSegmentChange(data) {
        const segmentEl = document.getElementById('dock-segment');
        if (segmentEl && data.segment) {
            segmentEl.textContent = data.segment.label || '';
        }
    }

    function updateUI() {
        const mainBtn = document.getElementById('dock-main-btn');
        const timerDisplay = document.getElementById('dock-timer');
        const teiDisplay = document.getElementById('dock-tei');
        const completeBtn = document.getElementById('dock-complete-btn');
        const templateBtn = document.getElementById('dock-template-btn');

        switch (currentState) {
            case 'IDLE':
                // 顯示開始按鈕
                mainBtn?.classList.remove('hidden');
                timerDisplay?.classList.add('hidden');
                teiDisplay?.classList.remove('hidden');
                completeBtn?.classList.add('hidden');
                templateBtn?.classList.remove('disabled');

                if (mainBtn) {
                    mainBtn.innerHTML = `
                        <i data-lucide="play" class="w-5 h-5"></i>
                        <span>開始決策計時</span>
                    `;
                }
                break;

            case 'RUNNING':
                // 顯示計時器
                mainBtn?.classList.add('hidden');
                timerDisplay?.classList.remove('hidden');
                teiDisplay?.classList.add('hidden');
                completeBtn?.classList.remove('hidden');
                templateBtn?.classList.add('disabled');
                break;

            case 'PAUSED':
                // 暫停狀態
                mainBtn?.classList.remove('hidden');
                timerDisplay?.classList.remove('hidden');
                teiDisplay?.classList.add('hidden');
                completeBtn?.classList.remove('hidden');

                if (mainBtn) {
                    mainBtn.innerHTML = `
                        <i data-lucide="play" class="w-5 h-5"></i>
                        <span>繼續</span>
                    `;
                }
                break;

            case 'COMPLETE':
            case 'TIMEOUT':
                // 完成狀態
                mainBtn?.classList.remove('hidden');
                timerDisplay?.classList.add('hidden');
                teiDisplay?.classList.add('hidden');
                completeBtn?.classList.add('hidden');

                if (mainBtn) {
                    mainBtn.innerHTML = `
                        <i data-lucide="check-circle" class="w-5 h-5"></i>
                        <span>${currentState === 'TIMEOUT' ? '耐心完成！' : '🎉 已完成！'}</span>
                    `;
                    mainBtn.classList.add('success');
                }
                break;

            case 'ABORT':
                // 中止狀態
                mainBtn?.classList.remove('hidden');
                timerDisplay?.classList.add('hidden');
                teiDisplay?.classList.remove('hidden');
                completeBtn?.classList.add('hidden');

                if (mainBtn) {
                    mainBtn.innerHTML = `
                        <i data-lucide="rotate-ccw" class="w-5 h-5"></i>
                        <span>重新開始</span>
                    `;
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
            const teiValue = document.querySelector('.overlay-dock-tei-value');
            if (teiValue) {
                teiValue.textContent = currentTEI;
            }
        });
    }

    // =============================================================================
    // STYLES
    // =============================================================================

    function injectStyles() {
        if (document.getElementById('decision-dock-styles')) return;

        const style = document.createElement('style');
        style.id = 'decision-dock-styles';
        style.textContent = `
            /* Decision Dock 專用樣式 */
            
            .overlay-dock-left,
            .overlay-dock-right {
                position: relative;
            }

            .overlay-dock-center {
                flex: 1;
                display: flex;
                justify-content: center;
                align-items: center;
            }

            /* 按鈕基礎樣式 */
            .overlay-dock-btn {
                display: flex;
                align-items: center;
                gap: 6px;
                padding: 10px 16px;
                background: rgba(255, 255, 255, 0.08);
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 12px;
                color: #fff;
                font-size: 13px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s ease;
            }

            .overlay-dock-btn:hover {
                background: rgba(255, 255, 255, 0.15);
                border-color: rgba(255, 255, 255, 0.2);
            }

            .overlay-dock-btn.disabled {
                opacity: 0.5;
                pointer-events: none;
            }

            /* 模板選擇按鈕 */
            .overlay-dock-template-btn {
                min-width: 140px;
            }

            .overlay-dock-template-icon {
                font-size: 16px;
            }

            .overlay-dock-template-name {
                flex: 1;
                text-align: left;
            }

            /* 下拉選單 */
            .overlay-dock-dropdown {
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

            .overlay-dock-dropdown.hidden {
                display: none;
            }

            .overlay-dock-dropdown-item {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 12px;
                border-radius: 8px;
                cursor: pointer;
                transition: background 0.2s ease;
            }

            .overlay-dock-dropdown-item:hover {
                background: rgba(255, 20, 147, 0.15);
            }

            .overlay-dock-dropdown-icon {
                font-size: 20px;
            }

            .overlay-dock-dropdown-info {
                flex: 1;
            }

            .overlay-dock-dropdown-name {
                font-size: 14px;
                font-weight: 600;
                color: #fff;
            }

            .overlay-dock-dropdown-duration {
                font-size: 11px;
                color: rgba(255, 255, 255, 0.5);
                margin-top: 2px;
            }

            /* 主按鈕 */
            .overlay-dock-main-btn {
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
                padding: 14px 28px;
                background: linear-gradient(135deg, #ff1493, #ff69b4);
                border: none;
                border-radius: 50px;
                color: #fff;
                font-size: 15px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.3s ease;
                box-shadow: 0 4px 20px rgba(255, 20, 147, 0.4);
            }

            .overlay-dock-main-btn:hover {
                transform: translateY(-2px);
                box-shadow: 0 6px 28px rgba(255, 20, 147, 0.5);
            }

            .overlay-dock-main-btn:active {
                transform: translateY(0);
            }

            .overlay-dock-main-btn.success {
                background: linear-gradient(135deg, #6bcb77, #4ade80);
                box-shadow: 0 4px 20px rgba(107, 203, 119, 0.4);
            }

            .overlay-dock-main-btn.hidden {
                display: none;
            }

            /* 計時器顯示 */
            .overlay-dock-timer {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 4px;
            }

            .overlay-dock-timer.hidden {
                display: none;
            }

            .overlay-dock-time {
                font-size: 36px;
                font-weight: 700;
                font-family: 'JetBrains Mono', monospace;
                font-variant-numeric: tabular-nums;
                background: linear-gradient(135deg, #ff1493, #00d4ff);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                background-clip: text;
                line-height: 1;
            }

            .overlay-dock-segment {
                font-size: 12px;
                color: rgba(255, 255, 255, 0.7);
                font-weight: 500;
            }

            .overlay-dock-progress {
                width: 120px;
                height: 3px;
                background: rgba(255, 255, 255, 0.1);
                border-radius: 2px;
                overflow: hidden;
                margin-top: 4px;
            }

            .overlay-dock-progress-bar {
                height: 100%;
                background: linear-gradient(90deg, #ff1493, #00d4ff);
                border-radius: 2px;
                transition: width 0.3s ease;
            }

            /* TEI 顯示 */
            .overlay-dock-tei {
                display: flex;
                flex-direction: column;
                align-items: center;
                padding: 8px 16px;
                background: rgba(255, 255, 255, 0.05);
                border-radius: 12px;
            }

            .overlay-dock-tei.hidden {
                display: none;
            }

            .overlay-dock-tei-value {
                font-size: 24px;
                font-weight: 700;
                background: linear-gradient(135deg, #00d4ff, #6bcb77);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                background-clip: text;
                line-height: 1;
            }

            .overlay-dock-tei-label {
                font-size: 9px;
                color: rgba(255, 255, 255, 0.5);
                text-transform: uppercase;
                letter-spacing: 1px;
            }

            /* 完成按鈕 */
            .overlay-dock-complete-btn {
                background: linear-gradient(135deg, #6bcb77, #4ade80);
                box-shadow: 0 4px 16px rgba(107, 203, 119, 0.3);
            }

            .overlay-dock-complete-btn:hover {
                box-shadow: 0 6px 24px rgba(107, 203, 119, 0.4);
            }

            .overlay-dock-complete-btn.hidden {
                display: none;
            }

            /* 響應式 */
            @media (max-width: 480px) {
                .overlay-dock-template-name {
                    display: none;
                }

                .overlay-dock-template-btn {
                    min-width: auto;
                }

                .overlay-dock-main-btn {
                    padding: 12px 20px;
                    font-size: 14px;
                }

                .overlay-dock-time {
                    font-size: 28px;
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
        getCurrentState: () => currentState
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
