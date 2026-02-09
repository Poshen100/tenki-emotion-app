/**
 * TENKI PRO - 決策計時功能條控制器
 * 只在結果頁顯示，固定在底部
 * @version 5.0.0
 */

(function (global) {
  'use strict';

  class TimerBarController {
    constructor() {
      this.bar = null;
      this.popup = null;
      this.toast = null;
      this.state = 'IDLE'; // IDLE, RUNNING
      this.timer = null;
      this.startTime = 0;
      this.duration = 180;
      this.intervalId = null;
      this.events = []; // 事件紀錄
    }

    init() {
      // 取得計時器模組
      if (global.TENKI) {
        this.timer = global.TENKI.timer;
      }

      this.createElements();
      this.bindEvents();
      this.watchForResultsPage();

      console.log('[TimerBar] v5.0 Ready');
    }

    /**
     * 創建 DOM 元素
     */
    createElements() {
      // 底部功能條
      this.bar = document.createElement('div');
      this.bar.id = 'tenki-timer-bar';
      this.bar.innerHTML = this.getIdleBarHTML();
      document.body.appendChild(this.bar);

      // 模板選擇彈窗
      this.popup = document.createElement('div');
      this.popup.id = 'tenki-template-popup';
      this.popup.innerHTML = `
        <div class="popup-title">選擇決策模板</div>
        <div class="popup-templates">
          <button class="popup-template" data-template="MANCINI_FBD" data-duration="180">
            <span class="popup-template-name">Mancini FBD</span>
            <span class="popup-template-time">3 分鐘</span>
          </button>
          <button class="popup-template" data-template="CANSILM_GROWTH" data-duration="300">
            <span class="popup-template-name">Cansilm 成長股</span>
            <span class="popup-template-time">5 分鐘</span>
          </button>
          <button class="popup-template" data-template="CANSILM_HIGHRS" data-duration="240">
            <span class="popup-template-name">High RS Breakout</span>
            <span class="popup-template-time">4 分鐘</span>
          </button>
        </div>
      `;
      document.body.appendChild(this.popup);

      // Toast
      this.toast = document.createElement('div');
      this.toast.id = 'tenki-toast';
      document.body.appendChild(this.toast);
    }

    getIdleBarHTML() {
      return `
        <button class="timer-main-btn" id="timer-start-btn">
          <span>開始決策計時</span>
        </button>
        <button class="timer-clock-btn" id="timer-clock-btn">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
          </svg>
        </button>
      `;
    }

    getRunningBarHTML(timeStr) {
      return `
        <button class="timer-record-btn" id="timer-record-btn" title="記錄事件">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </button>
        <button class="timer-main-btn running" id="timer-complete-btn">
          <span>${timeStr}</span>
        </button>
        <button class="timer-clock-btn" id="timer-abort-btn" title="中斷">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      `;
    }

    /**
     * 監聽結果頁
     */
    watchForResultsPage() {
      const check = () => {
        const hasScore = document.body.textContent.includes('TEI SCORE') ||
          document.body.textContent.includes('SYSTEM LOCKED') ||
          document.body.textContent.includes('Flow State') ||
          document.body.textContent.includes('Optimal State');

        const appHasTEI = global.app?.state?.tei > 0;

        if (hasScore || appHasTEI) {
          this.showBar();
        } else {
          this.hideBar();
        }
      };

      // 初始檢查
      setTimeout(check, 1000);

      // 持續檢查
      setInterval(check, 1500);

      // 監聽事件
      window.addEventListener('tenki:tei-updated', () => this.showBar());
    }

    showBar() {
      this.bar.classList.add('visible');
    }

    hideBar() {
      this.bar.classList.remove('visible');
      this.popup.classList.remove('show');
    }

    /**
     * 綁定事件
     */
    bindEvents() {
      // 事件委託
      this.bar.addEventListener('click', (e) => {
        const target = e.target.closest('button');
        if (!target) return;

        if (target.id === 'timer-start-btn' || target.id === 'timer-clock-btn') {
          this.togglePopup();
        } else if (target.id === 'timer-complete-btn') {
          this.complete();
        } else if (target.id === 'timer-abort-btn') {
          this.abort();
        } else if (target.id === 'timer-record-btn') {
          this.recordEvent();
        }
      });

      // 模板選擇
      this.popup.addEventListener('click', (e) => {
        const btn = e.target.closest('.popup-template');
        if (btn) {
          const template = btn.dataset.template;
          const duration = parseInt(btn.dataset.duration) || 180;
          this.start(template, duration);
        }
      });

      // 點擊外部關閉彈窗
      document.addEventListener('click', (e) => {
        if (!this.popup.contains(e.target) &&
          !e.target.closest('#timer-start-btn') &&
          !e.target.closest('#timer-clock-btn')) {
          this.popup.classList.remove('show');
        }
      });
    }

    togglePopup() {
      this.popup.classList.toggle('show');
    }

    /**
     * 開始計時
     */
    start(template, duration) {
      this.state = 'RUNNING';
      this.startTime = Date.now();
      this.duration = duration;
      this.events = [];
      this.popup.classList.remove('show');

      // 更新 UI
      this.updateTimerDisplay();
      this.intervalId = setInterval(() => this.updateTimerDisplay(), 1000);

      // 使用核心計時器模組
      if (this.timer) {
        this.timer.preview?.(template, global.app?.state?.tei || 50);
        this.timer.start?.();
      }

      this.showToast(`開始計時 ${Math.floor(duration / 60)} 分鐘`);
    }

    updateTimerDisplay() {
      const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
      const remaining = Math.max(0, this.duration - elapsed);
      const mins = Math.floor(remaining / 60);
      const secs = remaining % 60;
      const timeStr = `${mins}:${secs.toString().padStart(2, '0')}`;

      this.bar.innerHTML = this.getRunningBarHTML(timeStr);

      if (remaining <= 0) {
        this.timeout();
      }
    }

    /**
     * 記錄事件
     */
    recordEvent() {
      const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
      this.events.push({
        time: elapsed,
        timestamp: new Date().toISOString()
      });

      // 視覺反饋
      const btn = document.getElementById('timer-record-btn');
      if (btn) {
        btn.classList.add('recorded');
        setTimeout(() => btn.classList.remove('recorded'), 500);
      }

      this.showToast(`✓ 事件已記錄 (${this.events.length})`);
    }

    /**
     * 時間到
     */
    timeout() {
      this.stopTimer();
      this.showToast('🎉 耐心等待成功！');
      this.resetToIdle();
    }

    /**
     * 完成
     */
    complete() {
      this.stopTimer();
      this.timer?.complete?.();
      this.showToast('✓ 決策完成');
      this.resetToIdle();
    }

    /**
     * 中斷
     */
    abort() {
      this.stopTimer();
      this.timer?.abort?.();
      this.showToast('✗ 已中斷');
      this.resetToIdle();
    }

    stopTimer() {
      if (this.intervalId) {
        clearInterval(this.intervalId);
        this.intervalId = null;
      }
    }

    resetToIdle() {
      this.state = 'IDLE';
      this.bar.innerHTML = this.getIdleBarHTML();
      this.timer?.reset?.();
    }

    showToast(msg) {
      this.toast.textContent = msg;
      this.toast.classList.add('show');
      setTimeout(() => this.toast.classList.remove('show'), 2500);
    }
  }

  // 全域實例
  const controller = new TimerBarController();
  global.TENKI_TIMER = controller;

  // 初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => controller.init());
  } else {
    controller.init();
  }

})(window);
