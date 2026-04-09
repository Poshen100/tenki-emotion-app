import { patchSensor } from '../baseline-state.js';
import { flags } from '../flags.js';

const SENSOR_COPY = {
  camera_guided: { name: '攝影機引導掃描', desc: '使用鏡頭進行非接觸式基準擷取', icon: 'photo_camera' },
  manual_checkin: { name: '手動狀態自評', desc: '以主觀量表建立初始基準', icon: 'edit_note' },
  demo_mock: { name: 'Demo 模式', desc: '僅供內部測試使用', icon: 'science' },
};

async function detectCameraCapability() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const hasCamera = devices.some(d => d.kind === 'videoinput');
    return { supported: hasCamera, reason: hasCamera ? null : 'no_camera_device' };
  } catch {
    return { supported: false, reason: 'api_unavailable' };
  }
}

export function renderSensorChoice(container, { navigateTo, getState, setState }) {
  const screen = document.createElement('div');
  screen.className = 'bl-screen';

  screen.innerHTML = `
    <div class="bl-header">
      <button class="bl-btn bl-btn--ghost" id="bl-back" style="width:auto;padding:0;margin:0;">
        <span class="ferrari-icon" style="font-size:20px;">arrow_back</span>
      </button>
      <span class="bl-header__label">STEP 1 OF 3</span>
      <span style="width:28px;"></span>
    </div>
    <h1 class="bl-title">選擇感測模式</h1>
    <p class="bl-subtitle">Choose Capture Mode</p>
    <div id="bl-mode-list"></div>
    <div style="flex:1;"></div>
    <button class="bl-btn bl-btn--primary" id="bl-continue" disabled>使用此模式繼續</button>
  `;

  container.appendChild(screen);

  const modeList = screen.querySelector('#bl-mode-list');
  const continueBtn = screen.querySelector('#bl-continue');
  const backBtn = screen.querySelector('#bl-back');
  let selectedMode = null;

  backBtn.addEventListener('click', () => navigateTo('intro'));

  async function init() {
    const camera = await detectCameraCapability();
    const modes = [
      { mode: 'camera_guided', supported: camera.supported, recommended: true, reasonIfUnavailable: camera.reason },
      { mode: 'manual_checkin', supported: true, recommended: false },
    ];
    if (flags.debug_sensor_mode) {
      modes.push({ mode: 'demo_mock', supported: true, recommended: false });
    }

    patchSensor({ availableModes: modes });
    renderModes(modes);
  }

  function renderModes(modes) {
    modeList.innerHTML = '';
    modes.forEach(m => {
      const copy = SENSOR_COPY[m.mode];
      const card = document.createElement('div');
      card.className = 'bl-card';
      card.dataset.mode = m.mode;
      card.style.cursor = m.supported ? 'pointer' : 'not-allowed';
      if (!m.supported) card.style.opacity = '0.45';

      let badges = '';
      if (m.recommended) badges += '<span class="bl-badge bl-badge--recommended">推薦</span> ';
      if (m.supported) badges += '<span class="bl-badge bl-badge--supported">可用</span>';
      else badges += '<span class="bl-badge bl-badge--unsupported">不可用</span>';

      card.innerHTML = `
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px;">
          <span class="ferrari-icon" style="font-size:28px;color:#00B4D8;">${copy.icon}</span>
          <div>
            <div style="font-size:15px;font-weight:500;">${copy.name}</div>
            <div style="font-size:12px;color:#8E8E93;margin-top:2px;">${copy.desc}</div>
          </div>
        </div>
        <div style="display:flex;gap:6px;">${badges}</div>
        ${!m.supported && m.reasonIfUnavailable ? `<div style="font-size:11px;color:#FF6B6B;margin-top:6px;">${m.reasonIfUnavailable}</div>` : ''}
      `;

      if (m.supported) {
        card.addEventListener('click', () => {
          modeList.querySelectorAll('.bl-card').forEach(c => c.classList.remove('bl-card--selected'));
          card.classList.add('bl-card--selected');
          selectedMode = m.mode;
          continueBtn.disabled = false;
        });
      }

      modeList.appendChild(card);
    });
  }

  continueBtn.addEventListener('click', () => {
    if (!selectedMode) return;
    patchSensor({ selected: selectedMode });
    navigateTo('readiness_check');
  });

  init();
  return null;
}
