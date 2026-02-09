/**
 * @fileoverview Overlay Controller - 固定底部導航欄版本
 * @description Decision Timer 以固定底部導航欄形式呈現
 * @version 2.0.0
 */

(function (global) {
  'use strict';

  class OverlayController {
    constructor() {
      this.container = null;
      this.bottomBar = null;
      this.panel = null;
      this.mainBtn = null;
      this.isOpen = false;
      this.state = 'IDLE'; // IDLE, PREVIEW, RUNNING
      this.timer = null;
      this.preview = null;
      this.expectancy = null;
      this.currentTemplate = null;
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
      this.createBottomBar();
      this.createPanel();
      this.bindEvents();

      // 延遲顯示底部導航欄，避免在星塵靈魂載入前閃現
      setTimeout(() => {
        this.bottomBar.classList.add('ready');
      }, 800);

      console.log('[OverlayController] v2.0 Bottom Bar initialized');
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
     * 建立底部導航欄
     */
    createBottomBar() {
      this.bottomBar = document.createElement('div');
      this.bottomBar.className = 'overlay-bottom-bar';
      this.bottomBar.innerHTML = `
        <div class="overlay-nav-item" data-nav="stats">
          <div class="overlay-nav-icon">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 20V10M12 20V4M6 20v-6"/>
            </svg>
          </div>
          <span class="overlay-nav-label">統計</span>
        </div>
        
        <div class="overlay-nav-item" data-nav="history">
          <div class="overlay-nav-icon">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 8v4l3 3"/>
              <circle cx="12" cy="12" r="10"/>
            </svg>
          </div>
          <span class="overlay-nav-label">歷史</span>
        </div>
        
        <button class="overlay-main-btn" id="overlay-main-btn">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <polygon points="5 3 19 12 5 21 5 3"/>
          </svg>
        </button>
        
        <div class="overlay-nav-item" data-nav="insights">
          <div class="overlay-nav-icon">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <path d="M12 16v-4M12 8h.01"/>
            </svg>
          </div>
          <span class="overlay-nav-label">洞察</span>
        </div>
        
        <div class="overlay-nav-item" data-nav="settings">
          <div class="overlay-nav-icon">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
          </div>
          <span class="overlay-nav-label">設定</span>
        </div>
      `;
      this.container.appendChild(this.bottomBar);
      this.mainBtn = this.bottomBar.querySelector('#overlay-main-btn');
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
          <div class="overlay-panel-title">選擇決策模板</div>
          <button class="overlay-panel-close" onclick="TENKI_OVERLAY.closePanel()">✕</button>
        </div>
        <div class="overlay-template-list">
          <button class="overlay-template-btn" data-template="MANCINI_FBD">
            <div class="overlay-template-info">
              <div class="overlay-template-name">Mancini FBD</div>
              <div class="overlay-template-duration">3 分鐘 · 耐心等待</div>
            </div>
            <span class="overlay-template-arrow">→</span>
          </button>
          <button class="overlay-template-btn" data-template="CANSILM_GROWTH">
            <div class="overlay-template-info">
              <div class="overlay-template-name">Cansilm 成長股</div>
              <div class="overlay-template-duration">5 分鐘 · 不追高</div>
            </div>
            <span class="overlay-template-arrow">→</span>
          </button>
          <button class="overlay-template-btn" data-template="CANSILM_HIGHRS">
            <div class="overlay-template-info">
              <div class="overlay-template-name">High RS Breakout</div>
              <div class="overlay-template-duration">4 分鐘 · 突破確認</div>
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
          <div class="overlay-panel-title overlay-pulse">計時中...</div>
          <button class="overlay-panel-close" onclick="TENKI_OVERLAY.abortTimer()">✕</button>
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
          <button class="overlay-btn overlay-btn-primary" onclick="TENKI_OVERLAY.completeTimer()">完成決策</button>
        </div>
      `;
    }

    /**
     * 綁定事件
     */
    bindEvents() {
      // 主按鈕點擊
      this.mainBtn.addEventListener('click', () => {
        if (this.state === 'RUNNING') {
          // 運行中點擊打開面板
          this.togglePanel();
        } else {
          // 閒置時打開模板選擇
          this.togglePanel();
        }
      });

      // 模板選擇
      this.panel.addEventListener('click', (e) => {
        const btn = e.target.closest('.overlay-template-btn');
        if (btn) {
          const template = btn.dataset.template;
          this.startTimer(template);
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
          this.showToast('🎉 耐心等待成功！', 'timeout');
          this.resetToIdle();
        });

        this.timer.onComplete((result) => {
          this.showToast('✓ 決策完成', 'complete');
          this.resetToIdle();
        });

        this.timer.onAbort(() => {
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
     * 開始計時
     */
    startTimer(template) {
      this.currentTemplate = template;
      this.state = 'RUNNING';

      // 取得當前 TEI
      const currentTEI = global.app?.state?.tei || 50;

      // 啟動計時器
      if (this.timer) {
        this.timer.preview(template, currentTEI);
        this.timer.start();
      }

      // 更新 UI
      this.mainBtn.classList.add('running');
      this.mainBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <rect x="6" y="4" width="4" height="16"/>
          <rect x="14" y="4" width="4" height="16"/>
        </svg>
      `;

      // 顯示計時面板
      const config = global.DecisionTimer?.Templates?.[template];
      this.panel.innerHTML = this.getRunningHTML(config?.duration || 180, { label: '開始...' }, 0);

      // 保持面板開啟
      if (!this.isOpen) {
        this.togglePanel();
      }
    }

    /**
     * 完成計時
     */
    completeTimer() {
      if (this.timer) {
        this.timer.complete();
      }
    }

    /**
     * 中斷計時
     */
    abortTimer() {
      if (this.timer) {
        this.timer.abort();
      }
    }

    /**
     * 重置為閒置狀態
     */
    resetToIdle() {
      this.state = 'IDLE';
      this.currentTemplate = null;

      // 重置主按鈕
      this.mainBtn.classList.remove('running');
      this.mainBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <polygon points="5 3 19 12 5 21 5 3"/>
        </svg>
      `;

      // 重置面板
      this.panel.innerHTML = this.getIdleHTML();

      // 關閉面板
      this.closePanel();

      // 重置計時器
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
