import { closeBaselineFlow } from '../baseline-flow.js';

export function renderIntro(container, { navigateTo, getState }) {
  const state = getState();

  const screen = document.createElement('div');
  screen.className = 'bl-screen';

  let errorHTML = '';
  if (state.flow.blockingError) {
    errorHTML = `<div class="bl-error-banner">${state.flow.blockingError.message}</div>`;
  }

  screen.innerHTML = `
    <div class="bl-header">
      <span class="bl-header__label">TENKI CALIBRATION</span>
    </div>
    ${errorHTML}
    <h1 class="bl-title">建立你的初始基準</h1>
    <p class="bl-subtitle">Baseline Calibration — 透過一次短暫的掃描，讓 TENKI 了解你目前的生理狀態基準，作為未來所有分析的參考點。</p>

    <div class="bl-card">
      <div style="font-size:14px;font-weight:500;margin-bottom:14px;">準備事項</div>
      <div class="bl-checklist-row">
        <div class="bl-checklist-row__icon bl-checklist-row__icon--pass">
          <span class="ferrari-icon" style="font-size:14px">volume_off</span>
        </div>
        <div>
          <div style="font-size:14px;">安靜環境</div>
          <div style="font-size:12px;color:#8E8E93;margin-top:2px;">避免嘈雜或移動中的場景</div>
        </div>
      </div>
      <div class="bl-checklist-row">
        <div class="bl-checklist-row__icon bl-checklist-row__icon--pass">
          <span class="ferrari-icon" style="font-size:14px">accessibility_new</span>
        </div>
        <div>
          <div style="font-size:14px;">穩定姿勢</div>
          <div style="font-size:12px;color:#8E8E93;margin-top:2px;">坐下或站定，保持 30–60 秒</div>
        </div>
      </div>
      <div class="bl-checklist-row" style="border-bottom:none;">
        <div class="bl-checklist-row__icon bl-checklist-row__icon--pass">
          <span class="ferrari-icon" style="font-size:14px">do_not_disturb_on</span>
        </div>
        <div>
          <div style="font-size:14px;">不中斷</div>
          <div style="font-size:12px;color:#8E8E93;margin-top:2px;">過程中不切換 app 或鎖定螢幕</div>
        </div>
      </div>
    </div>

    <div style="margin-top:8px;font-size:12px;color:#8E8E93;text-align:center;line-height:1.6;">
      <span class="ferrari-icon" style="font-size:12px;vertical-align:middle;">lock</span>
      所有資料僅在本機處理，不上傳雲端
    </div>

    <div style="flex:1;"></div>

    <button class="bl-btn bl-btn--primary" id="bl-start-btn">開始建立 Baseline</button>
    <button class="bl-btn bl-btn--ghost" id="bl-later-btn">稍後再做</button>
  `;

  container.appendChild(screen);

  const startBtn = screen.querySelector('#bl-start-btn');
  const laterBtn = screen.querySelector('#bl-later-btn');

  startBtn.addEventListener('click', () => navigateTo('sensor_choice'));
  laterBtn.addEventListener('click', () => closeBaselineFlow());

  return null;
}
