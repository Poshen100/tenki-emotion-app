/**
 * TENKI PRO - Overlay UI Controller v1.0
 * 
 * 控制 Overlay UI 元件，透過 EventBridge 與核心模組溝通
 * 
 * @author TENKI Team
 * @version 1.0.0
 */

const OverlayController = (function () {
    'use strict';

    // =============================================================================
    // STATE
    // =============================================================================

    let isInitialized = false;
    let currentTimer = null;
    let currentTEI = 50;
    let elements = {};

    // =============================================================================
    // DOM HELPERS
    // =============================================================================

    function $(selector) {
        return document.querySelector(selector);
    }

    function $$(selector) {
        return document.querySelectorAll(selector);
    }

    function createElement(tag, attrs = {}, children = []) {
        const el = document.createElement(tag);
        for (const [key, value] of Object.entries(attrs)) {
            if (key === 'className') {
                el.className = value;
            } else if (key === 'dataset') {
                for (const [dataKey, dataValue] of Object.entries(value)) {
                    el.dataset[dataKey] = dataValue;
                }
            } else if (key.startsWith('on')) {
                el.addEventListener(key.slice(2).toLowerCase(), value);
            } else {
                el.setAttribute(key, value);
            }
        }
        for (const child of children) {
            if (typeof child === 'string') {
                el.appendChild(document.createTextNode(child));
            } else if (child) {
                el.appendChild(child);
            }
        }
        return el;
    }

    // =============================================================================
    // INITIALIZATION
    // =============================================================================

    function init() {
        if (isInitialized) return;

        createOverlayContainer();
        createPanels();
        setupEventListeners();
        subscribeToEvents();

        isInitialized = true;
        console.log('[OverlayController] Initialized');
    }

    function createOverlayContainer() {
        // 檢查是否已存在
        if ($('#tenki-pro-overlay')) return;

        const container = createElement('div', { id: 'tenki-pro-overlay' });
        document.body.appendChild(container);
        elements.container = container;
    }

    function createPanels() {
        // Decision Timer Panel
        elements.decisionPanel = createDecisionPanel();
        elements.container.appendChild(elements.decisionPanel);

        // Template Selector
        elements.templateSelector = createTemplateSelector();
        elements.container.appendChild(elements.templateSelector);

        // Preview Panel
        elements.previewPanel = createPreviewPanel();
        elements.container.appendChild(elements.previewPanel);

        // Floating Dot
        elements.floatingDot = createFloatingDot();
        elements.container.appendChild(elements.floatingDot);

        // 初始隱藏 panels
        elements.decisionPanel.classList.add('hidden');
        elements.previewPanel.classList.add('hidden');
    }

    function createDecisionPanel() {
        return createElement('div', {
            id: 'overlay-decision-panel',
            className: 'overlay-panel'
        }, [
            createElement('div', { className: 'overlay-timer-header' }, [
                createElement('h3', { className: 'overlay-timer-title' }, ['Decision Timer']),
                createElement('span', { className: 'overlay-timer-template', id: 'overlay-current-template' }, ['--'])
            ]),
            createElement('div', { className: 'overlay-tei-display' }, [
                createElement('span', { className: 'overlay-tei-value', id: 'overlay-tei-value' }, ['50']),
                createElement('div', { className: 'overlay-tei-bar' }, [
                    createElement('div', {
                        className: 'overlay-tei-bar-fill',
                        id: 'overlay-tei-bar',
                        style: 'width: 50%'
                    })
                ])
            ]),
            createElement('div', { className: 'overlay-timer-display' }, [
                createElement('div', { className: 'overlay-timer-time', id: 'overlay-timer-time' }, ['00:00']),
                createElement('div', { className: 'overlay-timer-segment', id: 'overlay-timer-segment' }, ['--']),
                createElement('div', { className: 'overlay-timer-hint', id: 'overlay-timer-hint' }, [''])
            ]),
            createElement('div', { className: 'overlay-timer-progress' }, [
                createElement('div', {
                    className: 'overlay-timer-progress-bar',
                    id: 'overlay-progress-bar',
                    style: 'width: 0%'
                })
            ]),
            createElement('div', { className: 'overlay-timer-actions' }, [
                createElement('button', {
                    className: 'overlay-btn overlay-btn-primary',
                    id: 'overlay-btn-start',
                    onClick: handleStartTimer
                }, ['開始計時']),
                createElement('button', {
                    className: 'overlay-btn overlay-btn-secondary',
                    id: 'overlay-btn-complete',
                    onClick: handleComplete,
                    style: 'display: none'
                }, ['我決定了']),
                createElement('button', {
                    className: 'overlay-btn overlay-btn-danger',
                    id: 'overlay-btn-abort',
                    onClick: handleAbort,
                    style: 'display: none'
                }, ['取消'])
            ])
        ]);
    }

    function createTemplateSelector() {
        const templates = [
            { id: 'CANSILM_GROWTH', name: 'Cansilm 成長股', duration: '5 min' },
            { id: 'CANSILM_HIGHRS', name: 'Cansilm High RS', duration: '4 min' },
            { id: 'MANCINI_FBD', name: 'Mancini FBD', duration: '3 min' }
        ];

        const templateItems = templates.map(t =>
            createElement('div', {
                className: 'overlay-template-item',
                dataset: { templateId: t.id },
                onClick: () => handleSelectTemplate(t.id)
            }, [
                createElement('div', { className: 'overlay-template-name' }, [t.name]),
                createElement('div', { className: 'overlay-template-duration' }, [t.duration])
            ])
        );

        return createElement('div', {
            id: 'overlay-template-selector',
            className: 'overlay-panel hidden'
        }, [
            createElement('h3', { className: 'overlay-timer-title' }, ['選擇模板']),
            createElement('div', { className: 'overlay-template-list' }, templateItems)
        ]);
    }

    function createPreviewPanel() {
        return createElement('div', {
            id: 'overlay-preview-panel',
            className: 'overlay-panel hidden'
        }, [
            createElement('div', { className: 'overlay-preview-header' }, [
                createElement('h3', { className: 'overlay-preview-title' }, ['Decision Preview'])
            ]),
            createElement('div', { id: 'overlay-preview-content' }, [
                createElement('div', { className: 'overlay-preview-stat' }, [
                    createElement('span', { className: 'overlay-preview-label' }, ['整體勝率:']),
                    createElement('span', { className: 'overlay-preview-value', id: 'overlay-preview-winrate' }, ['--'])
                ]),
                createElement('div', { className: 'overlay-preview-stat' }, [
                    createElement('span', { className: 'overlay-preview-label' }, ['耐心等待勝率:']),
                    createElement('span', { className: 'overlay-preview-value', id: 'overlay-preview-timeout-wr' }, ['--'])
                ]),
                createElement('div', { className: 'overlay-preview-stat' }, [
                    createElement('span', { className: 'overlay-preview-label' }, ['提前進場勝率:']),
                    createElement('span', { className: 'overlay-preview-value', id: 'overlay-preview-early-wr' }, ['--'])
                ]),
                createElement('div', { className: 'overlay-preview-behavior' }, [
                    createElement('div', { className: 'overlay-preview-behavior-label' }, ['歷史最佳行為:']),
                    createElement('div', { className: 'overlay-preview-behavior-value', id: 'overlay-preview-best' }, ['--'])
                ]),
                createElement('div', { className: 'overlay-preview-footer' }, [
                    createElement('span', { id: 'overlay-preview-samples' }, ['-- 筆記錄']),
                    createElement('span', {
                        className: 'overlay-preview-confidence',
                        id: 'overlay-preview-confidence'
                    }, ['信心度: --'])
                ])
            ])
        ]);
    }

    function createFloatingDot() {
        return createElement('div', {
            id: 'overlay-floating-dot',
            onClick: handleFloatingDotClick
        }, [
            createElement('svg', {
                className: 'overlay-dot-icon',
                fill: 'none',
                viewBox: '0 0 24 24',
                stroke: 'currentColor'
            }, [
                createElement('path', {
                    'stroke-linecap': 'round',
                    'stroke-linejoin': 'round',
                    'stroke-width': '2',
                    d: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z'
                })
            ])
        ]);
    }

    // =============================================================================
    // EVENT HANDLERS
    // =============================================================================

    function handleFloatingDotClick() {
        toggleTemplateSelector();
    }

    function handleSelectTemplate(templateId) {
        // 隱藏模板選擇器
        elements.templateSelector.classList.add('hidden');

        // 建立計時器
        if (typeof DecisionTimer !== 'undefined') {
            currentTimer = DecisionTimer.create();
            currentTimer.setTemplate(templateId);
            currentTimer.setTEI(currentTEI);

            // 更新 UI
            $('#overlay-current-template').textContent = templateId.replace(/_/g, ' ');

            // 顯示 decision panel
            elements.decisionPanel.classList.remove('hidden');

            // 更新模板時長
            const duration = currentTimer.duration;
            const minutes = Math.floor(duration / 60);
            const seconds = duration % 60;
            $('#overlay-timer-time').textContent =
                `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

            $('#overlay-timer-segment').textContent = '準備開始';
            $('#overlay-timer-hint').textContent = '點擊「開始計時」啟動';

            // 嘗試顯示預覽
            showPreview(templateId);
        }
    }

    function handleStartTimer() {
        if (!currentTimer) return;

        currentTimer.start({ skipPreview: true });

        // 更新按鈕
        $('#overlay-btn-start').style.display = 'none';
        $('#overlay-btn-complete').style.display = 'block';
        $('#overlay-btn-abort').style.display = 'block';

        // 設定回調
        currentTimer.onTick(handleTimerTick);
        currentTimer.onStateChange(handleTimerStateChange);
    }

    function handleTimerTick(data) {
        // 更新時間顯示
        const minutes = Math.floor(data.remaining / 60);
        const seconds = data.remaining % 60;
        $('#overlay-timer-time').textContent =
            `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        $('#overlay-timer-time').classList.add('running');

        // 更新進度條
        $('#overlay-progress-bar').style.width = `${data.progress}%`;

        // 更新區段
        if (data.segment) {
            $('#overlay-timer-segment').textContent = data.segment.label || '--';
            $('#overlay-timer-hint').textContent = data.segment.hint || '';
        }
    }

    function handleTimerStateChange(data) {
        console.log('[OverlayController] State changed:', data.currentState);

        if (['COMPLETE', 'TIMEOUT', 'ABORT'].includes(data.currentState)) {
            $('#overlay-timer-time').classList.remove('running');

            // 更新 UI
            let message = '';
            if (data.currentState === 'TIMEOUT') {
                message = currentTimer.template?.timeoutMessage || '計時完成';
            } else if (data.currentState === 'COMPLETE') {
                message = '決策完成';
            } else {
                message = '已取消';
            }

            $('#overlay-timer-segment').textContent = message;
            $('#overlay-timer-hint').textContent = '';
            $('#overlay-progress-bar').style.width = '100%';

            // 重置按鈕
            setTimeout(() => {
                resetTimerUI();
            }, 2000);
        }
    }

    function handleComplete() {
        if (currentTimer) {
            currentTimer.complete();
        }
    }

    function handleAbort() {
        if (currentTimer) {
            currentTimer.abort();
        }
    }

    function resetTimerUI() {
        $('#overlay-btn-start').style.display = 'block';
        $('#overlay-btn-complete').style.display = 'none';
        $('#overlay-btn-abort').style.display = 'none';
        $('#overlay-timer-time').textContent = '00:00';
        $('#overlay-timer-segment').textContent = '--';
        $('#overlay-timer-hint').textContent = '';
        $('#overlay-progress-bar').style.width = '0%';

        if (currentTimer) {
            currentTimer.reset();
            currentTimer = null;
        }

        elements.decisionPanel.classList.add('hidden');
        elements.previewPanel.classList.add('hidden');
    }

    function toggleTemplateSelector() {
        elements.templateSelector.classList.toggle('hidden');
    }

    // =============================================================================
    // PREVIEW
    // =============================================================================

    async function showPreview(templateId) {
        if (typeof PRExpectancy === 'undefined') return;
        if (typeof DecisionPreview === 'undefined') return;

        const engine = PRExpectancy.getInstance();
        const trades = engine.getTrades({ template: templateId });

        if (trades.length < 3) {
            elements.previewPanel.classList.add('hidden');
            return;
        }

        const preview = DecisionPreview.create();
        const stats = preview.analyze({
            tei: currentTEI,
            template: templateId,
            time: new Date()
        }, trades);

        if (stats.hasData) {
            $('#overlay-preview-winrate').textContent = `${stats.overallWinRate}%`;
            $('#overlay-preview-timeout-wr').textContent = `${stats.timeoutStats.winRate}%`;
            $('#overlay-preview-early-wr').textContent = `${stats.earlyStats.winRate}%`;
            $('#overlay-preview-best').textContent = `→ ${stats.bestBehavior.description}`;
            $('#overlay-preview-samples').textContent = `${stats.sampleSize} 筆記錄`;
            $('#overlay-preview-confidence').textContent = `信心度: ${stats.confidence.label}`;
            $('#overlay-preview-confidence').dataset.level = stats.confidence.level;

            elements.previewPanel.classList.remove('hidden');
        }
    }

    // =============================================================================
    // EVENT SUBSCRIPTIONS
    // =============================================================================

    function setupEventListeners() {
        // 點擊空白處關閉模板選擇器
        document.addEventListener('click', (e) => {
            if (!elements.templateSelector.contains(e.target) &&
                !elements.floatingDot.contains(e.target)) {
                elements.templateSelector.classList.add('hidden');
            }
        });
    }

    function subscribeToEvents() {
        if (typeof EventBridge === 'undefined') return;

        // 訂閱 TEI 更新
        EventBridge.onTEIUpdate((data) => {
            currentTEI = data.tei;
            updateTEIDisplay(data.tei);
        });

        // 訂閱決策狀態變化
        EventBridge.onDecisionStateChange((data) => {
            console.log('[OverlayController] External state change:', data.state);
        });
    }

    function updateTEIDisplay(tei) {
        const teiValueEl = $('#overlay-tei-value');
        const teiBarEl = $('#overlay-tei-bar');

        if (teiValueEl) teiValueEl.textContent = tei;
        if (teiBarEl) teiBarEl.style.width = `${tei}%`;
    }

    // =============================================================================
    // PUBLIC API
    // =============================================================================

    return {
        init,

        show() {
            if (elements.container) {
                elements.container.style.display = 'block';
            }
        },

        hide() {
            if (elements.container) {
                elements.container.style.display = 'none';
            }
        },

        updateTEI(tei) {
            currentTEI = tei;
            updateTEIDisplay(tei);
        },

        showTemplateSelector() {
            elements.templateSelector.classList.remove('hidden');
        },

        hideTemplateSelector() {
            elements.templateSelector.classList.add('hidden');
        }
    };

})();

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', OverlayController.init);
} else {
    OverlayController.init();
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = OverlayController;
}
