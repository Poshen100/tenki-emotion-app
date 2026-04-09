import { closeBaselineFlow } from '../baseline-flow.js';

const FAILURE_COPY = {
  permission_denied: { title: '相機權限未允許', fix: '請前往瀏覽器設定，允許本網站存取相機。', steps: ['開啟瀏覽器設定', '找到相機權限', '允許本網站存取'] },
  camera_unavailable: { title: '找不到相機裝置', fix: '請確認裝置有可用的相機，或改用手動自評模式。', steps: ['確認相機未被其他 app 佔用', '嘗試重新整理頁面'] },
  low_light: { title: '光線不足', fix: '請移動至光線充足的環境，避免逆光或強烈陰影。', steps: ['開啟室內燈光', '面向光源', '避免背光'] },
  motion_too_high: { title: '動作過多', fix: '請找穩定的位置坐下或靠牆，保持上半身靜止。', steps: ['坐下或靠牆', '手機放穩或用支架', '保持上半身靜止'] },
  face_not_detected: { title: '無法偵測臉部', fix: '請確認臉部完整清晰，並處於畫面中央。', steps: ['確認臉部在畫面中央', '拿掉口罩或墨鏡', '確保光線充足'] },
  session_interrupted: { title: '流程中斷', fix: '請確保不切換分頁或鎖定螢幕，重新嘗試。', steps: ['確保螢幕保持開啟', '不要切換到其他 app', '保持網路連線穩定'] },
  analysis_timeout: { title: '分析逾時', fix: '請稍後再試，或改用手動模式。', steps: ['稍候數分鐘後重試', '考慮改用手動模式'] },
  signal_inconclusive: { title: '訊號不足以建立基準', fix: '請在更穩定的環境重試，確認光線與靜止度。', steps: ['找一個安靜穩定的環境', '確認光線充足', '保持完全靜止 30 秒以上'] },
  unknown: { title: '發生未知問題', fix: '請重新整理後再試，若問題持續，請聯絡支援。', steps: ['重新整理頁面', '嘗試重新開始'] },
};

export function renderRetryHelp(container, { navigateTo, getState, context }) {
  const state = getState();
  const reason = (context && context.reason) || state.scanSession?.failureReason || 'unknown';
  const copy = FAILURE_COPY[reason] || FAILURE_COPY.unknown;

  const screen = document.createElement('div');
  screen.className = 'bl-screen';

  const stepsHTML = copy.steps.map((s, i) =>
    `<div class="bl-checklist-row" ${i === copy.steps.length - 1 ? 'style="border-bottom:none;"' : ''}>
      <div class="bl-checklist-row__icon bl-checklist-row__icon--warn">
        <span style="font-size:11px;font-weight:600;">${i + 1}</span>
      </div>
      <div style="font-size:14px;">${s}</div>
    </div>`
  ).join('');

  screen.innerHTML = `
    <div class="bl-header">
      <span class="bl-header__label">RETRY GUIDANCE</span>
    </div>
    <h1 class="bl-title">本次未成功</h1>

    <div class="bl-card" style="border-color:rgba(255,59,48,0.2);">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
        <span class="ferrari-icon" style="font-size:24px;color:#FF6B6B;">error_outline</span>
        <div style="font-size:16px;font-weight:500;">${copy.title}</div>
      </div>
      <div style="font-size:13px;color:#8E8E93;line-height:1.6;">${copy.fix}</div>
    </div>

    <div class="bl-card">
      <div style="font-size:14px;font-weight:500;margin-bottom:8px;">建議步驟</div>
      ${stepsHTML}
    </div>

    <div style="flex:1;"></div>
    <button class="bl-btn bl-btn--primary" id="bl-retry-now">立即重試</button>
    <button class="bl-btn bl-btn--secondary" id="bl-switch-mode">改用其他模式</button>
    <button class="bl-btn bl-btn--ghost" id="bl-do-later">稍後再做</button>
  `;

  container.appendChild(screen);

  screen.querySelector('#bl-retry-now').addEventListener('click', () => navigateTo('readiness_check'));
  screen.querySelector('#bl-switch-mode').addEventListener('click', () => navigateTo('sensor_choice'));
  screen.querySelector('#bl-do-later').addEventListener('click', () => closeBaselineFlow());

  return null;
}
