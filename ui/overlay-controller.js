/**
 * @fileoverview Overlay Controller - 小浮動按鈕版本
 * @description 只在星塵靈魂結果頁顯示的 Decision Timer FAB
 * @version 3.0.0
 */

(function (global) {
  'use strict';

  class OverlayController {
    constructor() {
      this.container = null;
      this.fab = null;
      this.panel = null;
      this.isOpen = false;
      this.state = 'IDLE';
      this.timer = null;
      this.currentTemplate = null;
      this.isResultsPage = false;
    }

    /**
     * 初始化 Overlay
     */
    init() {
      // 取得模組實例
      if (global.TENKI) {
        this.timer = global.TENKI.timer;
      } else if (global.DecisionTimer) {
        this.timer = new global.DecisionTimer();
      }

      this.createContainer();
      this.createFAB();
      this.createPanel();
      this.bindEvents();
      this.watchForResultsPage();

      console.log('[OverlayController] v3.0 FAB initialized - waiting for results page');
    }

    /**
     * 監聽是否進入結果頁
     */
    watchForResultsPage() {
      // 方法1: 監聽 EventBridge 的 TEI 更新事件
      window.addEventListener('tenki:tei-updated', () => {
        this.showFAB();
      });

      // 方法2: 使用 MutationObserver 監聯 DOM 變化
      const observer = new MutationObserver(() => {
        this.checkResultsPage();
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'style']
      });

      // 方法3: 定期檢查 (backup)
      setInterval(() => {
        this.checkResultsPage();
      }, 1000);
    }

    /**
     * 檢查是否在結果頁
     */
    checkResultsPage() {
      // 檢查是否有 TEI 分數顯示 (表示在結果頁)
      const teiScore = document.querySelector('.tei-score, .score-value, [class*="tei"], [class*="score"]');
      const flowState = document.querySelector('[class*="flow"], [class*="state"]');
      const systemLocked = document.body.textContent.includes('SYSTEM LOCKED') ||
        document.body.textContent.includes('Flow State');

      // 檢查 app 狀態
      const appHasTEI = global.app?.state?.tei > 0;

      if ((teiScore && flowState) || systemLocked || appHasTEI) {
        if (!this.isResultsPage) {
          this.isResultsPage = true;
          this.showFAB();
        }
      }
    }

    /**
     * 顯示 FAB
     */
    showFAB() {
      if (this.fab && !this.fab.classList.contains('visible')) {
        this.fab.classList.add('visible');
        console.log('[OverlayController] FAB shown - results page detected');
      }
    }

    /**
     * 隱藏 FAB
     */
    hideFAB() {
      if (this.fab) {
        this.fab.classList.remove('visible');
        this.closePanel();
      }
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
      this.fab = document.createElement('button');
      this.fab.className = 'overlay-fab';
      this.fab.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <circle cx="12" cy="12" r="10"/>
          <polyline points="12 6 12 12 16 14"/>
        </svg>
      `;
      this.container.appendChild(this.fab);
    }

    /**
     * 建立面板
     */
    createPanel() {
      this.panel = document.createElement('div');
      this.panel.className = 'overlay-timer-panel';
      this.panel.innerHTML = this.getIdleHTML();
      this.container.appendChild(this.panel);
    }

    /**
     * 取得閒置狀態 HTML
     */
    getIdleHTML() {
      return `
        <div class="overlay-panel-header">
          <div class="overlay-panel-title">決策計時器</div>
          <button class="overlay-panel-close" onclick="TENKI_OVERLAY.closePanel()">✕</button>
        </div>
        <div class="overlay-template-list">
          <button class="overlay-template-btn" data-template="MANCINI_FBD">
            <div class="overlay-template-info">
              <div class="overlay-template-name">Mancini FBD</div>
              <div class="overlay-template-duration">3 分鐘</div>
            </div>
            <span class="overlay-template-arrow">→</span>
          </button>
          <button class="overlay-template-btn" data-template="CANSILM_GROWTH">
            <div class="overlay-template-info">
              <div class="overlay-template-name">Cansilm 成長股</div>
              <div class="overlay-template-duration">5 分鐘</div>
            </div>
            <span class="overlay-template-arrow">→</span>
          </button>
          <button class="overlay-template-btn" data-template="CANSILM_HIGHRS">
            <div class="overlay-template-info">
              <div class="overlay-template-name">High RS Breakout</div>
              <div class="overlay-template-duration">4 分鐘</div>
            </div>
            <span class="overlay-template-arrow">→</span>
          </button>
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
          <button class="overlay-panel-close" onclick="TENKI_OVERLAY.closePanel()">✕</button>
        </div>
        <div class="overlay-timer-display">
          <div class="overlay-timer-time">${timeStr}</div>
          <div class="overlay-timer-segment">${segment?.label || '準備中'}</div>
          <div class="overlay-timer-progress">
            <div class="overlay-timer-progress-bar" style="width: ${percent}%"></div>
          </div>
        </div>
        <div class="overlay-action-row">
          <button class="overlay-btn overlay-btn-danger" onclick="TENKI_OVERLAY.abortTimer()">中斷</button>
          <button class="overlay-btn overlay-btn-primary" onclick="TENKI_OVERLAY.completeTimer()">完成</button>
        </div>
      `;
    }

    /**
     * 綁定事件
     */
    bindEvents() {
      // FAB 點擊
      this.fab.addEventListener('click', (e) => {
        e.stopPropagation();
        this.togglePanel();
      });

      // 模板選擇
      this.panel.addEventListener('click', (e) => {
        const btn = e.target.closest('.overlay-template-btn');
        if (btn) {
          e.stopPropagation();
          const template = btn.dataset.template;
          this.startTimer(template);
        }
      });

      // 點擊外部關閉面板
      document.addEventListener('click', (e) => {
        if (this.isOpen &&
          !this.panel.contains(e.target) &&
          !this.fab.contains(e.target)) {
          this.closePanel();
        }
      });

      // 監聽計時器進度
      if (this.timer) {
        this.timer.onProgress?.((data) => {
          if (this.state === 'RUNNING') {
            this.panel.innerHTML = this.getRunningHTML(data.remaining, data.segment, data.percent);
          }
        });

        this.timer.onTimeout?.((result) => {
          this.showToast('🎉 耐心等待成功！', 'timeout');
          this.resetToIdle();
        });

        this.timer.onComplete?.((result) => {
          this.showToast('✓ 決策完成', 'complete');
          this.resetToIdle();
        });

        this.timer.onAbort?.(() => {
          this.showToast('✗ 已中斷', 'abort');
          this.resetToIdle();
        });
      }
    }

    /**
     * 切換面板顯示
     */
    togglePanel() {
      this.isOpen = !this.isOpen;
      if (this.isOpen) {
        this.panel.classList.add('show');
      } else {
        this.panel.classList.remove('show');
      }
    }

    /**
     * 關閉面板
     */
    closePanel() {
      this.isOpen = false;
      this.panel.classList.remove('show');
    }

    /**
     * 開始計時
     */
    startTimer(template) {
      this.currentTemplate = template;
      this.state = 'RUNNING';

      const currentTEI = global.app?.state?.tei || 50;

      if (this.timer) {
        this.timer.preview?.(template, currentTEI);
        this.timer.start?.();
      }

      // 更新 FAB
      this.fab.classList.add('running');
      this.fab.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <rect x="6" y="4" width="4" height="16" rx="1"/>
          <rect x="14" y="4" width="4" height="16" rx="1"/>
        </svg>
      `;

      // 顯示計時面板
      const config = global.DecisionTimer?.Templates?.[template];
      this.panel.innerHTML = this.getRunningHTML(config?.duration || 180, { label: '開始...' }, 0);
    }

    /**
     * 完成計時
     */
    completeTimer() {
      if (this.timer) {
        this.timer.complete?.();
      }
    }

    /**
     * 中斷計時
     */
    abortTimer() {
      if (this.timer) {
        this.timer.abort?.();
      }
      this.resetToIdle();
    }

    /**
     * 重置為閒置狀態
     */
    resetToIdle() {
      this.state = 'IDLE';
      this.currentTemplate = null;

      this.fab.classList.remove('running');
      this.fab.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <circle cx="12" cy="12" r="10"/>
          <polyline points="12 6 12 12 16 14"/>
        </svg>
      `;

      this.panel.innerHTML = this.getIdleHTML();
      this.closePanel();

      if (this.timer) {
        this.timer.reset?.();
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
