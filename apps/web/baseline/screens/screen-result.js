import { setState } from '../baseline-state.js';
import { closeBaselineFlow } from '../baseline-flow.js';
import { flags } from '../flags.js';

function mapResult(acceptance) {
  const base = {
    resultId: `baseline-${Date.now()}`,
    acceptance,
    createdAt: new Date().toISOString(),
  };
  if (acceptance === 'accepted') {
    return {
      ...base, baselineScore: 87, confidence: 'high', signalQuality: 'high', stability: 'stable',
      recommendedAction: 'accept',
      observations: [
        { key: 'signal', label: '訊號品質', value: '穩定', tone: 'good' },
        { key: 'motion', label: '動作干擾', value: '極低', tone: 'good' },
        { key: 'lighting', label: '環境光線', value: '充足', tone: 'good' },
      ],
    };
  }
  if (acceptance === 'provisional') {
    return {
      ...base, baselineScore: 61, confidence: 'medium', signalQuality: 'medium', stability: 'moderate',
      recommendedAction: 'accept',
      observations: [
        { key: 'signal', label: '訊號品質', value: '尚可', tone: 'caution' },
        { key: 'motion', label: '動作干擾', value: '輕微', tone: 'caution' },
        { key: 'lighting', label: '環境光線', value: '略暗', tone: 'caution' },
      ],
    };
  }
  return {
    ...base, confidence: 'low', signalQuality: 'low', stability: 'weak',
    recommendedAction: 'retry_now', retryReason: 'signal_inconclusive',
    observations: [
      { key: 'signal', label: '訊號品質', value: '不足', tone: 'caution' },
    ],
  };
}

export function renderResult(container, { navigateTo, getState }) {
  const acceptance = flags.mock_accept || 'accepted';
  const result = mapResult(acceptance);
  setState({ result });

  const screen = document.createElement('div');
  screen.className = 'bl-screen';

  const badgeClass = acceptance === 'accepted' ? 'bl-badge--accepted' : acceptance === 'provisional' ? 'bl-badge--provisional' : 'bl-badge--insufficient';
  const badgeText = acceptance === 'accepted' ? '基準已建立' : acceptance === 'provisional' ? '暫時性基準' : '品質不足';

  const obsHTML = result.observations.map(o =>
    `<div class="bl-observation-row">
      <span>${o.label}</span>
      <span class="bl-observation-row__tone--${o.tone}">${o.value}</span>
    </div>`
  ).join('');

  const metaHTML = `
    <div class="bl-quality-row"><span>信心度</span><span class="bl-quality-row__value">${result.confidence}</span></div>
    <div class="bl-quality-row"><span>訊號品質</span><span class="bl-quality-row__value">${result.signalQuality}</span></div>
    <div class="bl-quality-row"><span>穩定度</span><span class="bl-quality-row__value">${result.stability}</span></div>
    ${result.baselineScore ? `<div class="bl-quality-row"><span>基準分數</span><span class="bl-quality-row__value">${result.baselineScore}</span></div>` : ''}
  `;

  let primaryCTA, secondaryCTA;
  if (result.recommendedAction === 'accept') {
    primaryCTA = `<button class="bl-btn bl-btn--primary" id="bl-accept">採用此 Baseline</button>`;
    secondaryCTA = `<button class="bl-btn bl-btn--secondary" id="bl-retry">重新建立</button>`;
  } else {
    primaryCTA = `<button class="bl-btn bl-btn--primary" id="bl-retry">立即重試</button>`;
    secondaryCTA = `<button class="bl-btn bl-btn--ghost" id="bl-later">稍後再做</button>`;
  }

  screen.innerHTML = `
    <div class="bl-header">
      <span class="bl-header__label">BASELINE RESULT</span>
    </div>
    <h1 class="bl-title">基準建立結果</h1>

    <div class="bl-card" style="text-align:center;padding:24px;">
      <span class="bl-badge ${badgeClass}" style="font-size:13px;padding:5px 16px;">${badgeText}</span>
      ${result.baselineScore ? `<div style="font-size:48px;font-weight:700;margin:20px 0 4px;font-family:'JetBrains Mono',monospace;">${result.baselineScore}</div><div style="font-size:12px;color:#8E8E93;">Baseline Score</div>` : ''}
    </div>

    <div class="bl-card">
      <div style="font-size:14px;font-weight:500;margin-bottom:8px;">觀察指標</div>
      ${obsHTML}
    </div>

    <div class="bl-card">
      ${metaHTML}
    </div>

    <div style="flex:1;"></div>
    ${primaryCTA}
    ${secondaryCTA}
  `;

  container.appendChild(screen);

  const acceptBtn = screen.querySelector('#bl-accept');
  const retryBtn = screen.querySelector('#bl-retry');
  const laterBtn = screen.querySelector('#bl-later');

  if (acceptBtn) {
    acceptBtn.addEventListener('click', () => {
      localStorage.setItem('tenki_baseline_accepted', JSON.stringify(result));
      closeBaselineFlow();
    });
  }

  if (retryBtn) {
    retryBtn.addEventListener('click', () => navigateTo('retry_help'));
  }

  if (laterBtn) {
    laterBtn.addEventListener('click', () => closeBaselineFlow());
  }

  return null;
}
