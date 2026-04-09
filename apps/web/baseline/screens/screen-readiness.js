import { patchReadiness } from '../baseline-state.js';

const CHECK_ITEMS = [
  { key: 'lighting', label: '光線穩定', severity: 'required' },
  { key: 'visibility', label: '臉部清晰可見', severity: 'required' },
  { key: 'stability', label: '可保持穩定 30–60 秒', severity: 'required' },
  { key: 'environment', label: '非移動 / 非通勤環境', severity: 'required' },
  { key: 'emotional_settled', label: '無強烈情緒波動', severity: 'recommended' },
];

export function renderReadinessCheck(container, { navigateTo, getState }) {
  const state = getState();
  const sensorMode = state.sensor.selected;

  const screen = document.createElement('div');
  screen.className = 'bl-screen';

  screen.innerHTML = `
    <div class="bl-header">
      <button class="bl-btn bl-btn--ghost" id="bl-back" style="width:auto;padding:0;margin:0;">
        <span class="ferrari-icon" style="font-size:20px;">arrow_back</span>
      </button>
      <span class="bl-header__label">STEP 2 OF 3</span>
      <span style="width:28px;"></span>
    </div>
    <h1 class="bl-title">確認目前條件</h1>
    <p class="bl-subtitle">Readiness Check</p>
    <div id="bl-readiness-badge" style="margin-bottom:16px;"></div>
    <div class="bl-card" id="bl-checklist"></div>
    <div id="bl-blockers" style="margin-top:12px;"></div>
    <div style="flex:1;"></div>
    <button class="bl-btn bl-btn--primary" id="bl-ready-btn" disabled>我已準備好</button>
  `;

  container.appendChild(screen);

  const checklistEl = screen.querySelector('#bl-checklist');
  const readyBtn = screen.querySelector('#bl-ready-btn');
  const badgeEl = screen.querySelector('#bl-readiness-badge');
  const blockersEl = screen.querySelector('#bl-blockers');
  const backBtn = screen.querySelector('#bl-back');

  backBtn.addEventListener('click', () => navigateTo('sensor_choice'));

  let checks = CHECK_ITEMS.map(c => ({ ...c, passed: false }));
  let permissionGranted = false;
  let cameraInitialized = false;

  async function runChecks() {
    // Camera permission check (real)
    if (sensorMode === 'camera_guided') {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        stream.getTracks().forEach(t => t.stop());
        permissionGranted = true;
        cameraInitialized = true;
      } catch {
        permissionGranted = false;
        cameraInitialized = false;
      }
    } else {
      permissionGranted = true;
      cameraInitialized = true;
    }

    // Auto-pass environment checks (user confirms manually via UI)
    // For MVP, pass all by default; user unchecks if not ready
    checks = checks.map(c => ({ ...c, passed: true }));

    evaluate();
    renderChecklist();
  }

  function evaluate() {
    const blockers = [];
    const warnings = [];

    if (!permissionGranted) blockers.push('相機權限未允許');
    if (!cameraInitialized) blockers.push('相機尚未初始化');

    for (const check of checks) {
      if (!check.passed) {
        if (check.severity === 'required') blockers.push(check.label);
        else warnings.push(check.label);
      }
    }

    const requiredPassed = checks.filter(c => c.severity === 'required').every(c => c.passed);
    const score = Math.round((checks.filter(c => c.passed).length / checks.length) * 100);

    let level;
    if (!permissionGranted || !cameraInitialized || !requiredPassed) {
      level = 'not_ready';
    } else if (warnings.length > 0) {
      level = 'ready_with_caution';
    } else {
      level = 'ready';
    }

    patchReadiness({ level, score, checks, permissionGranted, cameraInitialized, warnings, blockers });

    // Badge
    const badgeClass = level === 'ready' ? 'bl-badge--ready' : level === 'ready_with_caution' ? 'bl-badge--caution' : 'bl-badge--not-ready';
    const badgeText = level === 'ready' ? 'READY' : level === 'ready_with_caution' ? 'CAUTION' : 'NOT READY';
    badgeEl.innerHTML = `<span class="bl-badge ${badgeClass}">${badgeText} — ${score}%</span>`;

    // Blockers
    if (blockers.length > 0) {
      blockersEl.innerHTML = `<div class="bl-error-banner">${blockers.map(b => '• ' + b).join('<br>')}</div>`;
    } else {
      blockersEl.innerHTML = '';
    }

    // CTA
    readyBtn.disabled = (level === 'not_ready');
    readyBtn.textContent = level === 'not_ready' ? '尚未準備好' : '我已準備好';
  }

  function renderChecklist() {
    checklistEl.innerHTML = '';
    checks.forEach((check, i) => {
      const row = document.createElement('div');
      row.className = 'bl-checklist-row';
      if (i === checks.length - 1) row.style.borderBottom = 'none';

      const iconClass = check.passed
        ? 'bl-checklist-row__icon--pass'
        : check.severity === 'required' ? 'bl-checklist-row__icon--fail' : 'bl-checklist-row__icon--warn';
      const iconName = check.passed ? 'check' : 'close';

      row.innerHTML = `
        <div class="bl-checklist-row__icon ${iconClass}">
          <span class="ferrari-icon" style="font-size:12px;">${iconName}</span>
        </div>
        <div style="flex:1;">
          <div style="font-size:14px;">${check.label}</div>
          ${check.severity === 'recommended' ? '<div style="font-size:11px;color:#8E8E93;margin-top:2px;">建議項目</div>' : ''}
        </div>
        <label style="cursor:pointer;">
          <input type="checkbox" ${check.passed ? 'checked' : ''} style="accent-color:#00B4D8;width:18px;height:18px;" />
        </label>
      `;

      const checkbox = row.querySelector('input');
      checkbox.addEventListener('change', () => {
        checks[i].passed = checkbox.checked;
        evaluate();
        // Re-render icon
        const icon = row.querySelector('.bl-checklist-row__icon');
        icon.className = 'bl-checklist-row__icon ' + (checks[i].passed ? 'bl-checklist-row__icon--pass' : checks[i].severity === 'required' ? 'bl-checklist-row__icon--fail' : 'bl-checklist-row__icon--warn');
        icon.querySelector('.ferrari-icon').textContent = checks[i].passed ? 'check' : 'close';
      });

      checklistEl.appendChild(row);
    });
  }

  readyBtn.addEventListener('click', () => navigateTo('guided_scan'));

  runChecks();
  return null;
}
