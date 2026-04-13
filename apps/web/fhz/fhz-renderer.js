// TENKI FIX v5.2 - added modular FHZ overlay renderer with purpose switcher and baseline countdown UI
(function (global) {
    'use strict';

    var refs = null;

    function ensureStyles() {
        var styleEl = document.getElementById('tenki-fhz-style');

        if (styleEl) return;

        styleEl = document.createElement('style');
        styleEl.id = 'tenki-fhz-style';
        styleEl.textContent = [
            '#tenki-fhz-overlay {',
            '  position: fixed;',
            '  inset: 0;',
            '  z-index: 460;',
            '  display: none;',
            '  align-items: center;',
            '  justify-content: center;',
            '  padding: 18px;',
            '  background: rgba(4, 10, 20, 0.82);',
            '  backdrop-filter: blur(18px);',
            '  -webkit-backdrop-filter: blur(18px);',
            '}',
            '#tenki-fhz-overlay.is-open { display: flex; }',
            '.tenki-fhz-shell {',
            '  width: min(100%, 440px);',
            '  border-radius: 28px;',
            '  overflow: hidden;',
            '  background: linear-gradient(180deg, rgba(5, 15, 30, 0.98), rgba(5, 12, 22, 0.96));',
            '  border: 1px solid rgba(255,255,255,0.08);',
            '  box-shadow: 0 24px 80px rgba(0,0,0,0.48);',
            '  color: #f4fbff;',
            '  font-family: Inter, -apple-system, BlinkMacSystemFont, sans-serif;',
            '}',
            '.tenki-fhz-header {',
            '  display: flex;',
            '  align-items: flex-start;',
            '  justify-content: space-between;',
            '  padding: 20px 20px 14px;',
            '}',
            '.tenki-fhz-kicker {',
            '  font-size: 11px;',
            '  letter-spacing: 0.18em;',
            '  text-transform: uppercase;',
            '  color: rgba(150, 226, 255, 0.84);',
            '  margin-bottom: 6px;',
            '}',
            '.tenki-fhz-title { margin: 0; font-size: 24px; font-weight: 700; }',
            '.tenki-fhz-subtitle { margin-top: 6px; color: rgba(213, 233, 245, 0.72); font-size: 13px; line-height: 1.5; }',
            '.tenki-fhz-close {',
            '  border: 0;',
            '  background: rgba(255,255,255,0.08);',
            '  color: #ffffff;',
            '  border-radius: 999px;',
            '  padding: 10px 12px;',
            '  font-size: 12px;',
            '  cursor: pointer;',
            '}',
            '.tenki-fhz-purpose-row {',
            '  display: grid;',
            '  grid-template-columns: repeat(3, 1fr);',
            '  gap: 8px;',
            '  padding: 0 20px 16px;',
            '}',
            '.tenki-fhz-purpose-btn {',
            '  border: 1px solid rgba(255,255,255,0.08);',
            '  background: rgba(255,255,255,0.03);',
            '  color: rgba(233, 247, 255, 0.8);',
            '  border-radius: 16px;',
            '  padding: 12px 10px;',
            '  cursor: pointer;',
            '  text-align: left;',
            '}',
            '.tenki-fhz-purpose-btn.is-active {',
            '  border-color: rgba(53, 202, 255, 0.5);',
            '  background: rgba(0, 163, 255, 0.16);',
            '  box-shadow: inset 0 0 0 1px rgba(87, 218, 255, 0.12);',
            '}',
            '.tenki-fhz-purpose-label { display: block; font-size: 14px; font-weight: 700; }',
            '.tenki-fhz-purpose-copy { display: block; margin-top: 4px; font-size: 11px; color: rgba(220, 239, 248, 0.68); }',
            '.tenki-fhz-preview {',
            '  position: relative;',
            '  margin: 0 20px;',
            '  border-radius: 24px;',
            '  overflow: hidden;',
            '  background: radial-gradient(circle at 50% 30%, rgba(255,120,120,0.35), rgba(18,16,28,0.92));',
            '  min-height: 320px;',
            '}',
            '.tenki-fhz-video { width: 100%; height: 320px; object-fit: cover; }',
            '.tenki-fhz-preview-frame {',
            '  position: absolute;',
            '  inset: 22% 18%;',
            '  border: 2px solid rgba(255,255,255,0.55);',
            '  border-radius: 32px;',
            '  box-shadow: 0 0 0 999px rgba(0,0,0,0.18);',
            '}',
            '.tenki-fhz-state-pill {',
            '  position: absolute;',
            '  top: 16px;',
            '  left: 16px;',
            '  padding: 10px 14px;',
            '  border-radius: 999px;',
            '  background: rgba(8, 18, 30, 0.76);',
            '  border: 1px solid rgba(255,255,255,0.14);',
            '  font-size: 11px;',
            '  letter-spacing: 0.12em;',
            '  text-transform: uppercase;',
            '}',
            '.tenki-fhz-instruction {',
            '  position: absolute;',
            '  left: 16px;',
            '  right: 16px;',
            '  bottom: 16px;',
            '  padding: 14px 16px;',
            '  border-radius: 18px;',
            '  background: rgba(8, 18, 30, 0.78);',
            '  color: rgba(239, 247, 255, 0.92);',
            '  font-size: 13px;',
            '  line-height: 1.5;',
            '}',
            '.tenki-fhz-panel { padding: 18px 20px 0; }',
            '.tenki-fhz-meter { margin-bottom: 14px; }',
            '.tenki-fhz-meter-label { display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 6px; color: rgba(217, 235, 246, 0.78); }',
            '.tenki-fhz-meter-bar { height: 8px; border-radius: 999px; background: rgba(255,255,255,0.08); overflow: hidden; }',
            '.tenki-fhz-meter-fill { height: 100%; border-radius: 999px; background: linear-gradient(90deg, #ff7a6f, #ffd46a, #31d7c6); width: 0%; transition: width 120ms ease; }',
            '.tenki-fhz-checklist {',
            '  display: grid;',
            '  grid-template-columns: repeat(2, 1fr);',
            '  gap: 10px;',
            '  padding: 6px 20px 0;',
            '}',
            '.tenki-fhz-check {',
            '  border: 1px solid rgba(255,255,255,0.08);',
            '  border-radius: 16px;',
            '  padding: 12px;',
            '  background: rgba(255,255,255,0.03);',
            '  font-size: 12px;',
            '  color: rgba(221, 238, 246, 0.78);',
            '}',
            '.tenki-fhz-check strong { display: block; color: #ffffff; margin-bottom: 4px; font-size: 12px; }',
            '.tenki-fhz-check.is-ready { border-color: rgba(48, 214, 175, 0.42); background: rgba(25, 157, 116, 0.12); }',
            '.tenki-fhz-baseline-panel {',
            '  margin: 18px 20px 0;',
            '  padding: 18px;',
            '  border-radius: 20px;',
            '  border: 1px solid rgba(255,255,255,0.08);',
            '  background: rgba(255,255,255,0.04);',
            '}',
            '.tenki-fhz-baseline-panel[hidden] { display: none; }',
            '.tenki-fhz-baseline-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; }',
            '.tenki-fhz-baseline-time { font-size: 34px; font-weight: 700; letter-spacing: -0.04em; }',
            '.tenki-fhz-baseline-copy { margin-top: 12px; font-size: 13px; color: rgba(222, 240, 248, 0.78); }',
            '.tenki-fhz-progress { height: 10px; border-radius: 999px; overflow: hidden; background: rgba(255,255,255,0.08); margin-top: 16px; }',
            '.tenki-fhz-progress-fill { height: 100%; width: 0%; background: linear-gradient(90deg, #31d7c6, #59a7ff); transition: width 150ms ease; }',
            '.tenki-fhz-baseline-stats { display: flex; gap: 10px; margin-top: 14px; }',
            '.tenki-fhz-baseline-chip { flex: 1; border-radius: 14px; padding: 12px; background: rgba(255,255,255,0.04); font-size: 12px; color: rgba(221,238,246,0.78); }',
            '.tenki-fhz-baseline-chip strong { display: block; color: #ffffff; margin-bottom: 3px; font-size: 14px; }',
            '.tenki-fhz-summary { margin: 18px 20px 0; padding: 18px; border-radius: 22px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); }',
            '.tenki-fhz-summary[hidden] { display: none; }',
            '.tenki-fhz-summary-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-top: 14px; }',
            '.tenki-fhz-summary-item { padding: 12px; border-radius: 16px; background: rgba(255,255,255,0.04); color: rgba(220, 239, 248, 0.76); font-size: 12px; }',
            '.tenki-fhz-summary-item strong { display: block; color: #ffffff; font-size: 16px; margin-bottom: 4px; }',
            '.tenki-fhz-actions { display: flex; gap: 10px; padding: 20px; }',
            '.tenki-fhz-btn { flex: 1; border: 0; border-radius: 18px; padding: 15px 16px; font-size: 14px; font-weight: 700; cursor: pointer; }',
            '.tenki-fhz-btn-secondary { background: rgba(255,255,255,0.08); color: rgba(240,247,252,0.86); }',
            '.tenki-fhz-btn-primary { background: linear-gradient(90deg, #33d4d2, #4a90ff); color: #03101e; }',
            '.tenki-fhz-btn-primary[disabled] { opacity: 0.42; cursor: not-allowed; }',
            '@media (max-width: 520px) {',
            '  .tenki-fhz-purpose-row { grid-template-columns: 1fr; }',
            '  .tenki-fhz-checklist { grid-template-columns: 1fr; }',
            '  .tenki-fhz-baseline-stats { flex-direction: column; }',
            '}'
        ].join('\n');

        document.head.appendChild(styleEl);
    }

    function ensureShell() {
        var overlay;

        if (refs) return refs;

        ensureStyles();

        overlay = document.createElement('div');
        overlay.id = 'tenki-fhz-overlay';
        overlay.innerHTML = [
            '<div class="tenki-fhz-shell" role="dialog" aria-modal="true" aria-labelledby="tenki-fhz-title">',
            '  <div class="tenki-fhz-header">',
            '    <div>',
            '      <div class="tenki-fhz-kicker">Finger Heat Zone</div>',
            '      <h2 class="tenki-fhz-title" id="tenki-fhz-title">Rear Camera Readiness Gate</h2>',
            '      <div class="tenki-fhz-subtitle" id="tenki-fhz-subtitle">Lock a stable finger signal before the scan flow continues.</div>',
            '    </div>',
            '    <button class="tenki-fhz-close" id="tenki-fhz-close" type="button">Close</button>',
            '  </div>',
            '  <div class="tenki-fhz-purpose-row" id="tenki-fhz-purpose-row"></div>',
            '  <div class="tenki-fhz-preview">',
            '    <video class="tenki-fhz-video" id="tenki-fhz-video" playsinline autoplay muted></video>',
            '    <div class="tenki-fhz-preview-frame"></div>',
            '    <div class="tenki-fhz-state-pill" id="tenki-fhz-state-pill">Not detected</div>',
            '    <div class="tenki-fhz-instruction" id="tenki-fhz-instruction">Cover the rear camera fully and hold still.</div>',
            '  </div>',
            '  <div class="tenki-fhz-panel">',
            '    <div class="tenki-fhz-meter">',
            '      <div class="tenki-fhz-meter-label"><span>Coverage</span><span id="tenki-fhz-coverage-value">0%</span></div>',
            '      <div class="tenki-fhz-meter-bar"><div class="tenki-fhz-meter-fill" id="tenki-fhz-coverage-fill"></div></div>',
            '    </div>',
            '    <div class="tenki-fhz-meter">',
            '      <div class="tenki-fhz-meter-label"><span>Stability</span><span id="tenki-fhz-stability-value">0%</span></div>',
            '      <div class="tenki-fhz-meter-bar"><div class="tenki-fhz-meter-fill" id="tenki-fhz-stability-fill"></div></div>',
            '    </div>',
            '    <div class="tenki-fhz-meter">',
            '      <div class="tenki-fhz-meter-label"><span>Signal quality</span><span id="tenki-fhz-quality-value">0%</span></div>',
            '      <div class="tenki-fhz-meter-bar"><div class="tenki-fhz-meter-fill" id="tenki-fhz-quality-fill"></div></div>',
            '    </div>',
            '  </div>',
            '  <div class="tenki-fhz-checklist" id="tenki-fhz-checklist">',
            '    <div class="tenki-fhz-check" data-check="signal"><strong>Signal quality</strong><span>Waiting for a usable pulse window.</span></div>',
            '    <div class="tenki-fhz-check" data-check="coverage"><strong>Coverage</strong><span>Rear lens needs full finger coverage.</span></div>',
            '    <div class="tenki-fhz-check" data-check="stability"><strong>Stability</strong><span>Keep the phone and finger still.</span></div>',
            '    <div class="tenki-fhz-check" data-check="permission"><strong>Camera ready</strong><span>Rear stream must stay active for commit.</span></div>',
            '  </div>',
            '  <div class="tenki-fhz-baseline-panel" id="tenki-fhz-baseline-panel" hidden>',
            '    <div class="tenki-fhz-baseline-head">',
            '      <div>',
            '        <div class="tenki-fhz-kicker">Baseline Capture</div>',
            '        <div class="tenki-fhz-baseline-time" id="tenki-fhz-baseline-time">03:00</div>',
            '      </div>',
            '      <div id="tenki-fhz-baseline-quality">Signal --</div>',
            '    </div>',
            '    <div class="tenki-fhz-baseline-copy" id="tenki-fhz-baseline-copy">Stay calm and keep the rear camera covered for the full 3 minute capture.</div>',
            '    <div class="tenki-fhz-progress"><div class="tenki-fhz-progress-fill" id="tenki-fhz-baseline-progress"></div></div>',
            '    <div class="tenki-fhz-baseline-stats">',
            '      <div class="tenki-fhz-baseline-chip"><strong id="tenki-fhz-live-hr">--</strong><span>Live HR</span></div>',
            '      <div class="tenki-fhz-baseline-chip"><strong id="tenki-fhz-live-rmssd">--</strong><span>Live RMSSD</span></div>',
            '    </div>',
            '  </div>',
            '  <div class="tenki-fhz-summary" id="tenki-fhz-summary" hidden>',
            '    <div class="tenki-fhz-kicker">Baseline Complete</div>',
            '    <div class="tenki-fhz-title" style="font-size:20px;">Stored Resting Anchor</div>',
            '    <div class="tenki-fhz-subtitle" id="tenki-fhz-summary-copy">Your rear camera baseline has been saved locally on this device.</div>',
            '    <div class="tenki-fhz-summary-grid">',
            '      <div class="tenki-fhz-summary-item"><strong id="tenki-fhz-summary-hr">--</strong><span>Mean HR</span></div>',
            '      <div class="tenki-fhz-summary-item"><strong id="tenki-fhz-summary-rmssd">--</strong><span>RMSSD</span></div>',
            '      <div class="tenki-fhz-summary-item"><strong id="tenki-fhz-summary-sdnn">--</strong><span>SDNN</span></div>',
            '      <div class="tenki-fhz-summary-item"><strong id="tenki-fhz-summary-sqi">--</strong><span>Mean SQI</span></div>',
            '    </div>',
            '  </div>',
            '  <div class="tenki-fhz-actions">',
            '    <button class="tenki-fhz-btn tenki-fhz-btn-secondary" id="tenki-fhz-cancel-btn" type="button">Cancel</button>',
            '    <button class="tenki-fhz-btn tenki-fhz-btn-primary" id="tenki-fhz-commit-btn" type="button" disabled>Start Quick Scan</button>',
            '  </div>',
            '</div>'
        ].join('');

        document.body.appendChild(overlay);

        refs = {
            overlay: overlay,
            purposeRow: overlay.querySelector('#tenki-fhz-purpose-row'),
            closeBtn: overlay.querySelector('#tenki-fhz-close'),
            cancelBtn: overlay.querySelector('#tenki-fhz-cancel-btn'),
            commitBtn: overlay.querySelector('#tenki-fhz-commit-btn'),
            subtitle: overlay.querySelector('#tenki-fhz-subtitle'),
            video: overlay.querySelector('#tenki-fhz-video'),
            statePill: overlay.querySelector('#tenki-fhz-state-pill'),
            instruction: overlay.querySelector('#tenki-fhz-instruction'),
            coverageFill: overlay.querySelector('#tenki-fhz-coverage-fill'),
            coverageValue: overlay.querySelector('#tenki-fhz-coverage-value'),
            stabilityFill: overlay.querySelector('#tenki-fhz-stability-fill'),
            stabilityValue: overlay.querySelector('#tenki-fhz-stability-value'),
            qualityFill: overlay.querySelector('#tenki-fhz-quality-fill'),
            qualityValue: overlay.querySelector('#tenki-fhz-quality-value'),
            checklist: overlay.querySelector('#tenki-fhz-checklist'),
            baselinePanel: overlay.querySelector('#tenki-fhz-baseline-panel'),
            baselineTime: overlay.querySelector('#tenki-fhz-baseline-time'),
            baselineQuality: overlay.querySelector('#tenki-fhz-baseline-quality'),
            baselineCopy: overlay.querySelector('#tenki-fhz-baseline-copy'),
            baselineProgress: overlay.querySelector('#tenki-fhz-baseline-progress'),
            liveHr: overlay.querySelector('#tenki-fhz-live-hr'),
            liveRmssd: overlay.querySelector('#tenki-fhz-live-rmssd'),
            summary: overlay.querySelector('#tenki-fhz-summary'),
            summaryCopy: overlay.querySelector('#tenki-fhz-summary-copy'),
            summaryHr: overlay.querySelector('#tenki-fhz-summary-hr'),
            summaryRmssd: overlay.querySelector('#tenki-fhz-summary-rmssd'),
            summarySdnn: overlay.querySelector('#tenki-fhz-summary-sdnn'),
            summarySqi: overlay.querySelector('#tenki-fhz-summary-sqi')
        };

        return refs;
    }

    function toPercent(value) {
        return Math.round((value || 0) * 100) + '%';
    }

    function renderPurposeButtons(purposes, activePurposeId) {
        var shell = ensureShell();
        var html = [];
        var i;

        for (i = 0; i < purposes.length; i++) {
            html.push(
                '<button class="tenki-fhz-purpose-btn' + (purposes[i].id === activePurposeId ? ' is-active' : '') + '" ' +
                'type="button" data-purpose="' + purposes[i].id + '">' +
                '<span class="tenki-fhz-purpose-label">' + purposes[i].label + '</span>' +
                '<span class="tenki-fhz-purpose-copy">' + purposes[i].subtitle + '</span>' +
                '</button>'
            );
        }

        shell.purposeRow.innerHTML = html.join('');
    }

    function updateChecklist(checklist) {
        var shell = ensureShell();
        var checkEls = shell.checklist.querySelectorAll('[data-check]');
        var mapping = {
            signal: checklist.signalQualityReady,
            coverage: checklist.coverageReady,
            stability: checklist.stabilityReady,
            permission: checklist.cameraPermissionReady
        };
        var i;
        var key;

        for (i = 0; i < checkEls.length; i++) {
            key = checkEls[i].getAttribute('data-check');
            if (mapping[key]) {
                checkEls[i].classList.add('is-ready');
            } else {
                checkEls[i].classList.remove('is-ready');
            }
        }
    }

    function renderMetrics(viewModel) {
        var shell = ensureShell();

        shell.statePill.textContent = viewModel.stateLabel;
        shell.instruction.textContent = viewModel.instruction;
        shell.subtitle.textContent = viewModel.subtitle;
        shell.coverageFill.style.width = toPercent(viewModel.coverage);
        shell.coverageValue.textContent = toPercent(viewModel.coverage);
        shell.stabilityFill.style.width = toPercent(viewModel.stability);
        shell.stabilityValue.textContent = toPercent(viewModel.stability);
        shell.qualityFill.style.width = toPercent(viewModel.quality);
        shell.qualityValue.textContent = toPercent(viewModel.quality);
        updateChecklist(viewModel.checklist);
    }

    function setCommitState(enabled, label) {
        var shell = ensureShell();

        shell.commitBtn.disabled = !enabled;
        shell.commitBtn.textContent = label;
    }

    function showBaselinePanel(payload) {
        var shell = ensureShell();

        shell.baselinePanel.hidden = false;
        shell.summary.hidden = true;
        shell.baselineTime.textContent = payload.timeLabel || '03:00';
        shell.baselineQuality.textContent = payload.signalLabel || 'Signal --';
        shell.baselineCopy.textContent = payload.message || 'Capture is running.';
        shell.baselineProgress.style.width = payload.progressPercent || '0%';
        shell.liveHr.textContent = payload.liveHr || '--';
        shell.liveRmssd.textContent = payload.liveRmssd || '--';
    }

    function hideBaselinePanel() {
        ensureShell().baselinePanel.hidden = true;
    }

    function showBaselineSummary(result) {
        var shell = ensureShell();

        shell.summary.hidden = false;
        shell.baselinePanel.hidden = true;
        shell.summaryHr.textContent = formatNumber(result.meanHR, 1) + ' bpm';
        shell.summaryRmssd.textContent = formatNumber(result.rmssd, 1) + ' ms';
        shell.summarySdnn.textContent = formatNumber(result.sdnn, 1) + ' ms';
        shell.summarySqi.textContent = formatNumber(result.sqi_avg, 1);
    }

    function hideBaselineSummary() {
        ensureShell().summary.hidden = true;
    }

    function formatNumber(value, precision) {
        if (value === null || value === undefined || isNaN(value)) return '--';
        return Number(value).toFixed(precision);
    }

    function open() {
        ensureShell().overlay.classList.add('is-open');
    }

    function close() {
        var shell = ensureShell();

        shell.overlay.classList.remove('is-open');
        hideBaselinePanel();
        hideBaselineSummary();
    }

    global.TENKI_FHZ_RENDERER = {
        ensureShell: ensureShell,
        renderPurposeButtons: renderPurposeButtons,
        renderMetrics: renderMetrics,
        setCommitState: setCommitState,
        showBaselinePanel: showBaselinePanel,
        hideBaselinePanel: hideBaselinePanel,
        showBaselineSummary: showBaselineSummary,
        hideBaselineSummary: hideBaselineSummary,
        open: open,
        close: close
    };
})(window);
