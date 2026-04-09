import { flags } from './flags.js';

function toggle(id, label, desc, checked, onChange) {
  return `
    <div class="bl-settings-row">
      <div>
        <div class="bl-settings-row__label">${label}</div>
        <div class="bl-settings-row__desc">${desc}</div>
      </div>
      <div class="bl-settings-row__control">
        <label class="bl-toggle">
          <input type="checkbox" id="${id}" ${checked ? 'checked' : ''}>
          <span class="bl-toggle__slider"></span>
        </label>
      </div>
    </div>
  `;
}

function select(id, label, desc, options, selected) {
  const opts = options.map(o =>
    `<option value="${o.value}" ${o.value === selected ? 'selected' : ''}>${o.label}</option>`
  ).join('');
  return `
    <div class="bl-settings-row">
      <div>
        <div class="bl-settings-row__label">${label}</div>
        <div class="bl-settings-row__desc">${desc}</div>
      </div>
      <div class="bl-settings-row__control">
        <select class="bl-select" id="${id}">${opts}</select>
      </div>
    </div>
  `;
}

function infoRow(label, value, badge) {
  return `
    <div class="bl-settings-row">
      <div class="bl-settings-row__label">${label}</div>
      <div class="bl-settings-row__control">
        ${badge ? `<span class="bl-badge ${badge.class}">${badge.text}</span>` : `<span style="font-size:14px;color:#FFFFFF;">${value}</span>`}
      </div>
    </div>
  `;
}

export function renderCalibrationSettings(container) {
  const stored = localStorage.getItem('tenki_baseline_accepted');
  const baseline = stored ? JSON.parse(stored) : null;

  const hasBaseline = !!baseline;
  const quality = baseline?.confidence || 'N/A';
  const lastCal = baseline?.createdAt ? new Date(baseline.createdAt).toLocaleDateString('zh-TW') : '尚未建立';
  const qualityBadge = quality === 'high'
    ? { class: 'bl-badge--ready', text: 'HIGH' }
    : quality === 'medium'
    ? { class: 'bl-badge--caution', text: 'MEDIUM' }
    : { class: 'bl-badge--not-ready', text: 'N/A' };

  const prefs = JSON.parse(localStorage.getItem('tenki_baseline_prefs') || '{}');
  const preferredMode = prefs.preferredMode || 'camera_guided';
  const reminderEnabled = prefs.reminderEnabled !== false;
  const recalInterval = prefs.recalInterval || '30';
  const autoProvisional = prefs.autoProvisional || false;
  const minQuality = prefs.minQuality || 'medium';
  const debugSensor = prefs.debugSensor || false;
  const analysisTimeout = prefs.analysisTimeout || 45;

  let advancedHTML = '';
  if (flags.show_advanced_calibration) {
    advancedHTML = `
      <div class="bl-settings-section">
        <div class="bl-settings-section__title">Advanced</div>
        <div class="bl-card">
          ${toggle('bl-pref-auto-prov', 'Auto-use Provisional Result', '自動採用暫時性基準', autoProvisional)}
          ${select('bl-pref-min-quality', 'Minimum Accepted Quality', '最低可接受品質', [
            { value: 'high', label: 'High' },
            { value: 'medium', label: 'Medium' },
            { value: 'low', label: 'Low' },
          ], minQuality)}
          ${toggle('bl-pref-debug', 'Debug Sensor Mode', '啟用 demo_mock 模式', debugSensor)}
          <div class="bl-settings-row" style="border-bottom:none;">
            <div>
              <div class="bl-settings-row__label">Analysis Timeout</div>
              <div class="bl-settings-row__desc">分析逾時秒數</div>
            </div>
            <div class="bl-settings-row__control">
              <input type="number" id="bl-pref-timeout" value="${analysisTimeout}" min="10" max="120" style="background:#2C2C2E;color:#FFF;border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:6px 10px;font-size:13px;width:60px;text-align:center;">
            </div>
          </div>
        </div>
      </div>
    `;
  }

  container.innerHTML = `
    <div class="bl-screen" style="padding-top:16px;">
      <h1 class="bl-title">Calibration Settings</h1>

      <div class="bl-settings-section">
        <div class="bl-settings-section__title">Current Baseline</div>
        <div class="bl-card">
          ${infoRow('Status', hasBaseline ? '已建立' : '尚未建立', hasBaseline ? { class: 'bl-badge--ready', text: '已建立' } : { class: 'bl-badge--not-ready', text: '未建立' })}
          ${infoRow('Last Calibration', lastCal)}
          ${infoRow('Quality', quality, qualityBadge)}
        </div>
      </div>

      <div class="bl-settings-section">
        <div class="bl-settings-section__title">Capture Preferences</div>
        <div class="bl-card">
          ${select('bl-pref-mode', 'Preferred Sensor Mode', '偏好的感測模式', [
            { value: 'camera_guided', label: '攝影機引導掃描' },
            { value: 'manual_checkin', label: '手動狀態自評' },
          ], preferredMode)}
          <div class="bl-settings-row" style="border-bottom:none;">
            <div>
              <div class="bl-settings-row__label">重新建立 Baseline</div>
              <div class="bl-settings-row__desc">重新進行校正流程</div>
            </div>
            <div class="bl-settings-row__control">
              <button class="bl-btn bl-btn--secondary" id="bl-recalibrate" style="width:auto;padding:8px 16px;margin:0;font-size:13px;">重新校正</button>
            </div>
          </div>
        </div>
      </div>

      <div class="bl-settings-section">
        <div class="bl-settings-section__title">Recalibration</div>
        <div class="bl-card">
          ${toggle('bl-pref-reminder', 'Calibration Reminder', '定期提醒重新校正', reminderEnabled)}
          ${select('bl-pref-interval', 'Recalibration Interval', '校正提醒間隔', [
            { value: '7', label: '7 天' },
            { value: '14', label: '14 天' },
            { value: '30', label: '30 天' },
            { value: '60', label: '60 天' },
          ], recalInterval)}
        </div>
      </div>

      ${advancedHTML}
    </div>
  `;

  // Save preferences on change
  function savePrefs() {
    const p = {
      preferredMode: container.querySelector('#bl-pref-mode')?.value || 'camera_guided',
      reminderEnabled: container.querySelector('#bl-pref-reminder')?.checked ?? true,
      recalInterval: container.querySelector('#bl-pref-interval')?.value || '30',
    };
    if (flags.show_advanced_calibration) {
      p.autoProvisional = container.querySelector('#bl-pref-auto-prov')?.checked || false;
      p.minQuality = container.querySelector('#bl-pref-min-quality')?.value || 'medium';
      p.debugSensor = container.querySelector('#bl-pref-debug')?.checked || false;
      p.analysisTimeout = parseInt(container.querySelector('#bl-pref-timeout')?.value || '45', 10);
    }
    localStorage.setItem('tenki_baseline_prefs', JSON.stringify(p));
  }

  container.querySelectorAll('input, select').forEach(el => {
    el.addEventListener('change', savePrefs);
  });

  // Recalibrate button
  const recalBtn = container.querySelector('#bl-recalibrate');
  if (recalBtn) {
    recalBtn.addEventListener('click', () => {
      localStorage.removeItem('tenki_baseline_accepted');
      const flowContainer = document.getElementById('baseline-flow-container');
      if (flowContainer) {
        flowContainer.style.display = 'flex';
        import('./baseline-flow.js').then(m => m.initBaselineFlow(flowContainer));
      }
    });
  }
}
