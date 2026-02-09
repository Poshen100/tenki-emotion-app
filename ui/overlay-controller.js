/**
 * @fileoverview Overlay Controller - Decision Timer UI 控制器
 * @description 在星塵靈魂之上顯示 Decision Timer 介面
 * @version 1.0.0
 */

(function (global) {
    'use strict';

    class OverlayController {
        constructor() {
            this.container = null;
            this.panel = null;
            this.fab = null;
            this.isOpen = false;
            this.state = 'IDLE'; // IDLE, PREVIEW, RUNNING
            this.timer = null;
            this.preview = null;
            this.expectancy = null;
        }

        /**
         * 初始化 Overlay
         */
        init() {
            // 取得模組實例
            if (global.TENKI) {
                this.timer = global.TENKI.timer;
                this.preview = global.TENKI.preview;
                this.expectancy = global.TENKI.expectancy;
            } else if (global.DecisionTimer) {
                this.timer = new global.DecisionTimer();
            }

            this.createContainer();
            this.createFAB();
            this.createPanel();
            this.bindEvents();

            console.log('[OverlayController] Initialized');
        }

        /**
         * 建立主容器
         */
        createContainer() {
            this.container = document.createElement('div');
            this.container.id = 'tenki-pro-overlay';
            document.body.appendChild(this.container);
        }

        /**
         * 建立浮動按鈕
         */
        createFAB() {
            this.fab = document.createElement('div');
            this.fab.className = 'overlay-fab';
            this.fab.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <polyline points="12 6 12 12 16 14"/>
        </svg>
      `;
            this.fab.onclick = () => this.togglePanel();
            this.container.appendChild(this.fab);
        }

        /**
         * 建立面板
         */
        createPanel() {
            this.panel = document.createElement('div');
            this.panel.className = 'overlay-timer-panel hide';
            this.panel.innerHTML = this.getIdleHTML();
            this.container.appendChild(this.panel);
        }

        /**
         * 取得閒置狀態 HTML
         */
        getIdleHTML() {
            return `
        <div class="overlay-panel-header">
          <div class="overlay-panel-title">Decision Timer</div>
          <button class="overlay-panel-close" onclick="TENKI_OVERLAY.closePanel()">✕</button>
        </div>
        <div class="overlay-template-list">
          <button class="overlay-template-btn" data-template="MANCINI_FBD">
            <div class="overlay-template-name">Mancini FBD</div>
            <div class="overlay-template-duration">3 分鐘 · 耐心等待模式</div>
          </button>
          <button class="overlay-template-btn" data-template="CANSILM_GROWTH">
            <div class="overlay-template-name">Cansilm 成長股</div>
            <div class="overlay-template-duration">5 分鐘 · 不追高模式</div>
          </button>
          <button class="overlay-template-btn" data-template="CANSILM_HIGHRS">
            <div class="overlay-template-name">High RS Breakout</div>
            <div class="overlay-template-duration">4 分鐘 · 突破確認模式</div>
          </button>
        </div>
      `;
        }

        /**
         * 取得預覽狀態 HTML
         */
        getPreviewHTML(template, stats) {
            const config = global.DecisionTimer?.Templates?.[template] || { name: template, duration: 180 };
            const previewHTML = stats?.hasData ? `
        <div class="overlay-preview-panel">
          <h3>歷史統計</h3>
          <div class="overlay-preview-stats">
            <div class="overlay-preview-stat">
              <span class="overlay-preview-label">等待勝率</span>
              <span class="overlay-preview-value">${stats.timeoutWinRate}%</span>
            </div>
            <div class="overlay-preview-stat">
              <span class="overlay-preview-label">早進勝率</span>
              <span class="overlay-preview-value">${stats.earlyWinRate}%</span>
            </div>
          </div>
          <div class="overlay-preview-best">
            你通常的最佳做法：<strong>${stats.bestBehavior}</strong>
          </div>
          <div class="overlay-preview-sample">基於 ${stats.sampleSize} 筆類似交易</div>
        </div>
      ` : `
        <div class="overlay-preview-panel">
          <p style="color: rgba(255,255,255,0.5); font-size: 11px;">尚無足夠歷史資料</p>
        </div>
      `;

            return `
        <div class="overlay-panel-header">
          <div class="overlay-panel-title">${config.name}</div>
          <button class="overlay-panel-close" onclick="TENKI_OVERLAY.closePanel()">✕</button>
        </div>
        ${previewHTML}
        <div class="overlay-action-row">
          <button class="overlay-btn overlay-btn-secondary" onclick="TENKI_OVERLAY.backToIdle()">返回</button>
          <button class="overlay-btn overlay-btn-primary" onclick="TENKI_OVERLAY.startTimer()">開始計時</button>
        </div>
      `;
        }

        /**
         * 取得運行狀態 HTML
         */
        getRunningHTML(remaining, segment, percent) {
            const mins = Math.floor(remaining / 60);
            const secs = remaining % 60;
            const timeStr = `${mins}:${secs.toString().padStart(2, '0')}`;

            return `
        <div class="overlay-panel-header">
          <div class="overlay-panel-title overlay-pulse">計時中</div>
          <button class="overlay-panel-close" onclick="TENKI_OVERLAY.abortTimer()">✕</button>
        </div>
        <div class="overlay-timer-display">
          <div class="overlay-timer-time">${timeStr}</div>
          <div class="overlay-timer-segment">${segment?.label || ''}</div>
          <div class="overlay-timer-progress">
            <div class="overlay-timer-progress-bar" style="width: ${percent}%"></div>
          </div>
        </div>
        <div class="overlay-action-row">
          <button class="overlay-btn overlay-btn-danger" onclick="TENKI_OVERLAY.abortTimer()">中斷</button>
          <button class="overlay-btn overlay-btn-primary" onclick="TENKI_OVERLAY.completeTimer()">完成決策</button>
        </div>
      `;
        }

        /**
         * 綁定事件
         */
        bindEvents() {
            // 模板選擇
            this.panel.addEventListener('click', (e) => {
                const btn = e.target.closest('.overlay-template-btn');
                if (btn) {
                    const template = btn.dataset.template;
                    this.selectTemplate(template);
                }
            });

            // 監聽計時器進度
            if (this.timer) {
                this.timer.onProgress((data) => {
                    if (this.state === 'RUNNING') {
                        this.panel.innerHTML = this.getRunningHTML(data.remaining, data.segment, data.percent);
                    }
                });

                this.timer.onTimeout((result) => {
                    this.showToast('🎉 Patience Win!', 'timeout');
                    this.backToIdle();
                });

                this.timer.onComplete((result) => {
                    this.showToast('✓ Decision Made', 'complete');
                    this.backToIdle();
                });

                this.timer.onAbort(() => {
                    this.showToast('✗ Aborted', 'abort');
                    this.backToIdle();
                });
            }
        }

        /**
         * 切換面板顯示
         */
        togglePanel() {
            this.isOpen = !this.isOpen;
            if (this.isOpen) {
                this.panel.classList.remove('hide');
                this.panel.classList.add('show');
            } else {
                this.panel.classList.remove('show');
                this.panel.classList.add('hide');
            }
        }

        /**
         * 關閉面板
         */
        closePanel() {
            this.isOpen = false;
            this.panel.classList.remove('show');
            this.panel.classList.add('hide');
        }

        /**
         * 選擇模板
         */
        selectTemplate(template) {
            this.state = 'PREVIEW';
            this.currentTemplate = template;

            // 取得當前 TEI (從 app.js 或預設值)
            const currentTEI = global.app?.state?.tei || 50;

            // 分析歷史數據
            let stats = null;
            if (this.preview && this.expectancy) {
                stats = this.preview.analyze({
                    template,
                    tei: currentTEI,
                    time: new Date()
                }, this.expectancy.trades);
            }

            // 進入預覽模式
            if (this.timer) {
                this.timer.preview(template, currentTEI);
            }

            this.panel.innerHTML = this.getPreviewHTML(template, stats);
        }

        /**
         * 開始計時
         */
        startTimer() {
            if (!this.timer) return;

            this.state = 'RUNNING';
            this.timer.start();

            // 初始顯示
            const config = global.DecisionTimer?.Templates?.[this.currentTemplate];
            this.panel.innerHTML = this.getRunningHTML(config?.duration || 180, { label: 'Starting...' }, 0);

            // FAB 發光效果
            this.fab.classList.add('overlay-glow');
        }

        /**
         * 完成計時
         */
        completeTimer() {
            if (this.timer) {
                this.timer.complete();
            }
            this.fab.classList.remove('overlay-glow');
        }

        /**
         * 中斷計時
         */
        abortTimer() {
            if (this.timer) {
                this.timer.abort();
            }
            this.fab.classList.remove('overlay-glow');
        }

        /**
         * 返回閒置狀態
         */
        backToIdle() {
            this.state = 'IDLE';
            this.currentTemplate = null;
            this.panel.innerHTML = this.getIdleHTML();
            this.fab.classList.remove('overlay-glow');
            if (this.timer) {
                this.timer.reset();
            }
        }

        /**
         * 顯示 Toast
         */
        showToast(message, type = 'default') {
            const toast = document.createElement('div');
            toast.className = `overlay-toast ${type}`;
            toast.textContent = message;
            this.container.appendChild(toast);

            setTimeout(() => toast.classList.add('show'), 10);
            setTimeout(() => {
                toast.classList.remove('show');
                setTimeout(() => toast.remove(), 300);
            }, 2500);
        }
    }

    // 建立全域實例
    const controller = new OverlayController();
    global.TENKI_OVERLAY = controller;

    // DOM 載入後初始化
    if (typeof document !== 'undefined') {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => controller.init());
        } else {
            controller.init();
        }
    }

})(typeof window !== 'undefined' ? window : this);
