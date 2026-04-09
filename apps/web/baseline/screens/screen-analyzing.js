import { flags } from '../flags.js';

const ANALYZE_STEPS = ['檢查資料完整性', '估算訊號穩定度', '生成 baseline bootstrap'];

export function renderAnalyzing(container, { navigateTo }) {
  const screen = document.createElement('div');
  screen.className = 'bl-screen';

  screen.innerHTML = `
    <div class="bl-header">
      <span class="bl-header__label">ANALYZING</span>
    </div>
    <h1 class="bl-title" style="text-align:center;margin-top:60px;">正在建立你的基準狀態</h1>
    <p class="bl-subtitle" style="text-align:center;">Generating Baseline Bootstrap</p>
    <div class="bl-card" id="bl-analyze-steps" style="margin-top:32px;"></div>
  `;

  container.appendChild(screen);

  const stepsEl = screen.querySelector('#bl-analyze-steps');
  let currentIdx = 0;
  let cancelled = false;

  function renderSteps() {
    stepsEl.innerHTML = '';
    ANALYZE_STEPS.forEach((label, i) => {
      const row = document.createElement('div');
      let state = 'pending';
      if (i < currentIdx) state = 'done';
      else if (i === currentIdx) state = 'active';

      row.className = `bl-step-row bl-step-row--${state}`;
      if (i === ANALYZE_STEPS.length - 1) row.style.borderBottom = 'none';

      row.innerHTML = `
        <div class="bl-step-row__dot"></div>
        <div style="font-size:14px;">${label}</div>
        ${state === 'active' ? '<div style="margin-left:auto;"><span class="ferrari-icon" style="font-size:16px;color:#00B4D8;animation:spin 1s linear infinite;">sync</span></div>' : ''}
        ${state === 'done' ? '<div style="margin-left:auto;"><span class="ferrari-icon" style="font-size:16px;color:#34C759;">check_circle</span></div>' : ''}
      `;

      stepsEl.appendChild(row);
    });
  }

  renderSteps();

  const timer = setInterval(() => {
    if (cancelled) return;
    currentIdx++;
    renderSteps();

    if (currentIdx >= ANALYZE_STEPS.length) {
      clearInterval(timer);

      // Check mock_fail
      if (flags.mock_fail === 'analyzing') {
        setTimeout(() => navigateTo('retry_help', { reason: 'analysis_timeout' }), 800);
        return;
      }

      setTimeout(() => navigateTo('result'), 800);
    }
  }, 2000);

  return () => {
    cancelled = true;
    clearInterval(timer);
  };
}
