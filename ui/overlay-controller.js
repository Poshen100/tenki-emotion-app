/**
 * @fileoverview TENKI PRO Overlay - 極簡版
 * @description 不使用容器，直接在 body 添加元素，避免阻擋觸控
 * @version 4.0.0
 */

(function (global) {
  'use strict';

  class TenkiProOverlay {
    constructor() {
      this.fab = null;
      this.panel = null;
      this.toast = null;
      this.isOpen = false;
      this.state = 'IDLE';
      this.timer = null;
      this.isResultsPage = false;
    }

    init() {
      // 取得計時器模組
      if (global.TENKI) {
        this.timer = global.TENKI.timer;
      }

      this.createElements();
      this.bindEvents();
      this.watchForResultsPage();

      console.log('[TenkiPro] v4.0 Ready - No container overlay');
    }

    /**
     * 直接在 body 創建元素，不使用容器
     */
    createElements() {
      // FAB 按鈕
      this.fab = document.createElement('button');
      this.fab.id = 'tenki-pro-fab';
      this.fab.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <circle cx="12" cy="12" r="10"/>
          <polyline points="12 6 12 12 16 14"/>
        </svg>
      `;
      document.body.appendChild(this.fab);

      // 面板
      this.panel = document.createElement('div');
      this.panel.id = 'tenki-pro-panel';
      this.panel.innerHTML = this.getIdleHTML();
      document.body.appendChild(this.panel);

      // Toast
      this.toast = document.createElement('div');
      this.toast.id = 'tenki-pro-toast';
      document.body.appendChild(this.toast);
    }

    /**
     * 監聽結果頁
     */
    watchForResultsPage() {
      // 監聽 TEI 更新事件
      window.addEventListener('tenki:tei-updated', () => {
        this.showFAB();
      });

      // 定期檢查 (backup)
      const checkInterval = setInterval(() => {
        if (this.checkResultsPage()) {
          // 找到結果頁後減少檢查頻率
          clearInterval(checkInterval);
          setInterval(() => this.checkResultsPage(), 2000);
        }
      }, 500);
    }

    /**
     * 檢查是否在結果頁
     */
    checkResultsPage() {
      // 檢查是否有 TEI 相關內容
      const hasScore = document.body.textContent.includes('TEI SCORE') ||
        document.body.textContent.includes('SYSTEM LOCKED') ||
        document.body.textContent.includes('Flow State');

      const appHasTEI = global.app?.state?.tei > 0;

      if (hasScore || appHasTEI) {
        if (!this.isResultsPage) {
          this.isResultsPage = true;
          this.showFAB();
          return true;
        }
      } else {
        if (this.isResultsPage) {
          this.isResultsPage = false;
          this.hideFAB();
        }
      }
      return this.isResultsPage;
    }

    showFAB() {
      this.fab.classList.add('visible');
    }

    hideFAB() {
      this.fab.classList.remove('visible');
      this.closePanel();
    }

    getIdleHTML() {
      return `
        <div class="tp-header">
          <div class="tp-title">決策計時器</div>
          <button class="tp-close" onclick="TENKI_PRO.closePanel()">✕</button>
        </div>
        <div class="tp-templates">
          <button class="tp-template" data-template="MANCINI_FBD">
            <span class="tp-template-name">Mancini FBD</span>
            <span class="tp-template-time">3 分鐘</span>
          </button>
          <button class="tp-template" data-template="CANSILM_GROWTH">
            <span class="tp-template-name">Cansilm 成長股</span>
            <span class="tp-template-time">5 分鐘</span>
          </button>
          <button class="tp-template" data-template="CANSILM_HIGHRS">
            <span class="tp-template-name">High RS Breakout</span>
            <span class="tp-template-time">4 分鐘</span>
          </button>
        </div>
      `;
    }

    getRunningHTML(remaining, segment, percent) {
      const mins = Math.floor(remaining / 60);
      const secs = remaining % 60;
      const timeStr = `${mins}:${secs.toString().padStart(2, '0')}`;

      return `
        <div class="tp-header">
          <div class="tp-title">計時中</div>
          <button class="tp-close" onclick="TENKI_PRO.closePanel()">✕</button>
        </div>
        <div class="tp-timer">
          <div class="tp-time">${timeStr}</div>
          <div class="tp-segment">${segment?.label || '準備中'}</div>
          <div class="tp-progress">
            <div class="tp-progress-bar" style="width: ${percent}%"></div>
          </div>
        </div>
        <div class="tp-actions">
          <button class="tp-btn tp-btn-danger" onclick="TENKI_PRO.abort()">中斷</button>
          <button class="tp-btn tp-btn-primary" onclick="TENKI_PRO.complete()">完成</button>
        </div>
      `;
    }

    bindEvents() {
      // FAB 點擊
      this.fab.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.togglePanel();
      });

      // 面板點擊 (模板選擇)
      this.panel.addEventListener('click', (e) => {
        const btn = e.target.closest('.tp-template');
        if (btn) {
          e.preventDefault();
          e.stopPropagation();
          this.startTimer(btn.dataset.template);
        }
      });

      // 點擊外部關閉
      document.addEventListener('click', (e) => {
        if (this.isOpen &&
          !this.panel.contains(e.target) &&
          !this.fab.contains(e.target)) {
          this.closePanel();
        }
      });

      // 計時器回調
      if (this.timer) {
        this.timer.onProgress?.((data) => {
          if (this.state === 'RUNNING') {
            this.panel.innerHTML = this.getRunningHTML(data.remaining, data.segment, data.percent);
          }
        });

        this.timer.onTimeout?.(() => {
          this.showToast('🎉 耐心等待成功！', 'timeout');
          this.resetToIdle();
        });

        this.timer.onComplete?.(() => {
          this.showToast('✓ 決策完成', 'complete');
          this.resetToIdle();
        });

        this.timer.onAbort?.(() => {
          this.showToast('✗ 已中斷', 'abort');
          this.resetToIdle();
        });
      }
    }

    togglePanel() {
      this.isOpen = !this.isOpen;
      this.panel.classList.toggle('show', this.isOpen);
    }

    closePanel() {
      this.isOpen = false;
      this.panel.classList.remove('show');
    }

    startTimer(template) {
      this.state = 'RUNNING';

      if (this.timer) {
        this.timer.preview?.(template, global.app?.state?.tei || 50);
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

      // 顯示計時
      this.panel.innerHTML = this.getRunningHTML(180, { label: '開始...' }, 0);
    }

    complete() {
      this.timer?.complete?.();
    }

    abort() {
      this.timer?.abort?.();
      this.resetToIdle();
    }

    resetToIdle() {
      this.state = 'IDLE';
      this.fab.classList.remove('running');
      this.fab.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <circle cx="12" cy="12" r="10"/>
          <polyline points="12 6 12 12 16 14"/>
        </svg>
      `;
      this.panel.innerHTML = this.getIdleHTML();
      this.closePanel();
      this.timer?.reset?.();
    }

    showToast(msg, type) {
      this.toast.textContent = msg;
      this.toast.className = `show ${type}`;
      setTimeout(() => {
        this.toast.className = '';
      }, 2500);
    }
  }

  // 全域實例
  const overlay = new TenkiProOverlay();
  global.TENKI_PRO = overlay;

  // 初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => overlay.init());
  } else {
    overlay.init();
  }

})(window);
