/**
 * TENKI CORE — Results Page Controller
 * ui/results-page.js
 *
 * EventBridge wiring → live TEI/HR/HRV data → show/hide page
 * Rule: DO NOT touch Stardust (app.js / rpgg.js / expression.js)
 * All UI via EventBridge pub/sub only.
 *
 * @version 1.0.0
 */

const TenkiResultsPage = (function () {
    'use strict';

    // ─── State ───────────────────────────────────────────────
    let _visible = false;
    let _pageEl = null;
    let _timerInterval = null;
    let _timerSec = 0;
    let _timerRunning = false;

    const _data = {
        teiScore: 82,
        teiStatus: 'OPTIMAL',
        hr: 68,
        stress: 50,
        respiratory: 14,
        ansSnsPct: 48,
        ansPnsPct: 52,
        currentTime: '9:41',
    };

    // Heart-rate bar heights (percentages, 12 bars)
    const _barHeights = [52, 68, 74, 60, 88, 64, 70, 55, 78, 66, 72, 58];
    const _activeBar  = 4; // 0-indexed

    // ─── Public API ───────────────────────────────────────────
    function init() {
        _buildPage();
        _subscribeEvents();
        _startClock();
        console.log('[ResultsPage] Initialized ✓');
    }

    function show(data) {
        if (data) Object.assign(_data, data);
        if (_visible) return;
        _visible = true;
        _syncData();
        _pageEl.style.display = 'flex';
        _pageEl.classList.remove('rp-closing');
        // kick animation
        void _pageEl.offsetWidth;
    }

    function hide() {
        if (!_visible) return;
        _visible = false;
        _pageEl.classList.add('rp-closing');
        setTimeout(() => { _pageEl.style.display = 'none'; }, 380);
        _stopTimer();
    }

    // ─── EventBridge Subscriptions ────────────────────────────
    function _subscribeEvents() {
        if (typeof EventBridge === 'undefined') return;

        // Scan complete → show page
        EventBridge.on('scan:complete', (d) => {
            show({
                teiScore: (d && d.tei) || _data.teiScore,
                hr:       (d && d.hr)  || _data.hr,
            });
        });

        // Progressive TEI updates
        EventBridge.on('tei:progressive', (d) => {
            if (!_visible) return;
            if (d.score != null) {
                _data.teiScore  = Math.round(d.score);
                _data.teiStatus = _scoreToBadge(d.score);
                _setText('rp-tei-score', _data.teiScore);
                _setText('rp-tei-status', _data.teiStatus);
                _setStyle('rp-ring-outer', 'filter',
                    `blur(${d.confidence > 0.7 ? 1 : 2}px) brightness(1.15)`);
            }
        });

        // Live metrics updates
        EventBridge.on('tei:updated', (d) => {
            if (!_visible) return;
            if (d.hr)    { _data.hr = Math.round(d.hr);     _setText('rp-hr-num', _data.hr); }
            if (d.hrv)   { /* HRV could feed ANS balance */  }
            if (d.stress){ _data.stress = Math.round(d.stress * 100);
                           _setText('rp-stress-label', `Stress: ${_data.stress}`);
                           _setStyle('rp-progbar-fill', 'width', `${_data.stress}%`); }
        });

        // Decision timer events from DecisionDock
        EventBridge.on('timer:state', (d) => {
            if (!_visible) return;
            if (d.state === 'RUNNING') _startTimer();
            if (d.state === 'IDLE' || d.state === 'COMPLETE' || d.state === 'ABORT') _stopTimer();
        });

        EventBridge.on('timer:tick', (d) => {
            if (!_visible) return;
            if (d.elapsed != null) _updateTimerDisplay(d.elapsed);
        });
    }

    // ─── Page Build ──────────────────────────────────────────
    function _buildPage() {
        const el = document.createElement('div');
        el.id = 'tenki-results-page';
        el.style.display = 'none';
        el.innerHTML = _html();
        document.body.appendChild(el);
        _pageEl = el;

        // bind close
        el.querySelector('#rp-close').addEventListener('click', hide);

        // spawn stars
        _spawnStars(el);
    }

    function _html() {
        const bars = _barHeights.map((h, i) =>
            `<div class="rp-bar${i === _activeBar ? ' active' : ''}" style="height:${h}%"></div>`
        ).join('');

        // Grid lines at 100% 80% 60% of 100px height
        const grids = [0, 33, 66].map(pct =>
            `<div class="rp-grid-line" style="bottom:${pct}%"></div>`
        ).join('');

        const ecgPath = `M0,18 Q8,6 16,18 Q20,24 24,18 L28,18 L32,4 L36,30 L40,18 Q48,6 56,18 Q60,22 64,18 L72,18 Q80,6 88,18 Q92,24 96,18 L100,18 L104,4 L108,30 L112,18 Q120,6 128,18`;

        return `
<!-- Status Bar -->
<div class="rp-statusbar">
  <span class="rp-time" id="rp-clock">${_data.currentTime}</span>
  <div class="rp-icons">
    <svg viewBox="0 0 24 24"><path d="M1 9l2 2c4.97-4.97 13.03-4.97 18 0l2-2C16.93 2.93 7.08 2.93 1 9zm8 8l3 3 3-3a4.237 4.237 0 0 0-6 0zm-4-4 2 2a7.074 7.074 0 0 1 10 0l2-2C15.14 9.14 8.87 9.14 5 13z"/></svg>
    <svg viewBox="0 0 24 24"><rect x="2" y="7" width="18" height="11" rx="2" ry="2"/><path d="M22 11v2"/></svg>
  </div>
</div>

<!-- Top Row -->
<div class="rp-toprow">
  <div class="rp-live-pill">
    <div class="rp-live-dot"></div>
    <span class="rp-live-text">Live Market Data</span>
  </div>
  <button class="rp-close-btn" id="rp-close">✕</button>
</div>

<!-- Title -->
<div class="rp-title-section">
  <h1 class="rp-main-title">Biometric Decision Readiness</h1>
  <p class="rp-sub-title">Analyzing neuro-stability for high-risk action.</p>
</div>

<!-- TEI Ring -->
<div class="rp-tei-wrapper">
  <div class="rp-ring-outer"></div>
  <div class="rp-ring-inner"></div>
  <div class="rp-disc">
    <span class="rp-tei-label">TEI Score</span>
    <span class="rp-tei-score" id="rp-tei-score">${_data.teiScore}</span>
    <span class="rp-tei-status" id="rp-tei-status">${_data.teiStatus}</span>
  </div>
</div>

<!-- Heart Rate Activity Chart -->
<div class="rp-card rp-chart-card">
  <p class="rp-chart-title">Heart Rate Activity</p>
  <div class="rp-chart-body">
    <div class="rp-chart-yaxis">
      <span>100</span><span>80</span><span>60</span>
    </div>
    <div class="rp-bars-wrap">
      ${grids}
      ${bars}
    </div>
  </div>
  <p class="rp-chart-label">BPM</p>
</div>

<!-- Dual Row -->
<div class="rp-dual-row">

  <!-- Heart Rate -->
  <div class="rp-half-card">
    <div class="rp-hr-header">
      <span class="rp-hr-header-title">Heart Rate</span>
      <div class="rp-card-icon rp-icon-pink">♡</div>
    </div>
    <div class="rp-hr-value">
      <span class="rp-hr-num" id="rp-hr-num">${_data.hr}</span>
      <span class="rp-hr-unit">bpm</span>
      <span class="rp-hr-arrow">↗</span>
    </div>
    <div class="rp-ecg-wrap">
      <svg class="rp-ecg-svg" viewBox="0 0 128 36" preserveAspectRatio="none">
        <path d="${ecgPath}" fill="none" stroke="rgba(91,163,245,0.8)" stroke-width="2" stroke-linecap="round"/>
        <path d="${ecgPath}" transform="translate(128,0)" fill="none" stroke="rgba(91,163,245,0.8)" stroke-width="2" stroke-linecap="round"/>
      </svg>
    </div>
  </div>

  <!-- ANS Balance -->
  <div class="rp-half-card">
    <div class="rp-ans-header">
      <span class="rp-ans-header-title">ANS Balance</span>
      <div class="rp-card-icon rp-icon-cyan">⚖</div>
    </div>
    <div class="rp-ans-values">
      <span class="rp-ans-sns" id="rp-ans-sns">${_data.ansSnsPct}%</span>
      <span class="rp-ans-sep">/</span>
      <span class="rp-ans-pns" id="rp-ans-pns">${_data.ansPnsPct}%</span>
    </div>
    <div class="rp-ans-bar-row">
      <span class="rp-ans-bar-label sns">SNS</span>
      <span class="rp-ans-bar-label pns">PNS</span>
    </div>
    <div class="rp-ans-specbar">
      <div class="rp-ans-dot"></div>
    </div>
    <div class="rp-ans-badge">Balanced</div>
  </div>
</div>

<!-- Stress + Respiratory -->
<div class="rp-card rp-stress-card">
  <div class="rp-stress-header">
    <div class="rp-card-icon rp-icon-purple">🌬</div>
  </div>
  <div class="rp-wave-canvas-wrap">
    ${_waveSVG('slow', '#9f7aea', 3, 14, 0.8)}
    ${_waveSVG('fast', '#4cc9f0', 2,  8, 0.6)}
  </div>
  <div class="rp-stress-footer">
    <div class="rp-stress-left">
      <span class="rp-metric-label" id="rp-stress-label">Stress: <span>${_data.stress}</span></span>
      <div class="rp-progbar-wrap">
        <div class="rp-progbar-fill" id="rp-progbar-fill" style="width:${_data.stress}%"></div>
        <div class="rp-progbar-dot"></div>
      </div>
    </div>
    <div class="rp-stress-right">
      <span class="rp-metric-label">Respiratory: <span>${_data.respiratory} br/min</span></span>
      <span><span class="rp-breath-dot"></span></span>
    </div>
  </div>
</div>

<!-- Decision Timer -->
<div class="rp-timer-card">
  <div class="rp-timer-header">
    <div class="rp-timer-title">
      <span class="rp-timer-lightning">⚡</span>
      Decision Timer
    </div>
    <div class="rp-timer-session">
      <span class="rp-timer-check">✓</span>
      Session
    </div>
  </div>
  <div class="rp-timer-body">
    <div class="rp-timer-display" id="rp-timer-display">00:00</div>
    <div class="rp-timer-dots">
      <div class="rp-tdot"></div>
      <div class="rp-tdot"></div>
      <div class="rp-tdot"></div>
    </div>
  </div>
</div>

<!-- Footer -->
<p class="rp-footer">TENKI CORE · BUILD 1.0</p>
        `;
    }

    function _waveSVG(cls, color, strokeW, amp, opacity) {
        // Generate sinusoidal path for the stress/respiratory wave
        const pts = [];
        const W = 256, H = 52, cy = H / 2;
        for (let x = 0; x <= W; x += 4) {
            const y = cy + Math.sin((x / W) * Math.PI * 6) * amp;
            pts.push(`${x === 0 ? 'M' : 'L'}${x},${y.toFixed(1)}`);
        }
        const path = pts.join(' ');
        return `<svg class="rp-wave-svg ${cls}" viewBox="0 0 256 52" style="position:absolute;top:0;left:0;opacity:${opacity}">
          <path d="${path} ${path.replace(/M|L/g, 'L').replace('0,', `${W},`)}" fill="none"
                stroke="${color}" stroke-width="${strokeW}" stroke-linecap="round"/>
        </svg>`;
    }

    // ─── Stars ────────────────────────────────────────────────
    function _spawnStars(parent) {
        for (let i = 0; i < 60; i++) {
            const s = document.createElement('div');
            s.className = 'rp-star';
            const sz = Math.random() * 2.5 + 0.5;
            s.style.cssText = `
              width:${sz}px; height:${sz}px;
              left:${Math.random()*100}%;
              top:${Math.random()*100}%;
              opacity:${(Math.random()*0.5+0.2).toFixed(2)};
              animation-duration:${(Math.random()*3+2).toFixed(1)}s;
              animation-delay:-${(Math.random()*3).toFixed(1)}s;
            `;
            parent.appendChild(s);
        }
    }

    // ─── Clock ───────────────────────────────────────────────
    function _startClock() {
        setInterval(() => {
            const now = new Date();
            const hh = now.getHours(), mm = now.getMinutes();
            const str = `${hh}:${mm < 10 ? '0' + mm : mm}`;
            const el = document.getElementById('rp-clock');
            if (el) el.textContent = str;
        }, 10000);
    }

    // ─── Decision Timer ──────────────────────────────────────
    function _startTimer() {
        if (_timerRunning) return;
        _timerRunning = true;
        _timerInterval = setInterval(() => {
            _timerSec++;
            _updateTimerDisplay(_timerSec);
        }, 1000);
    }

    function _stopTimer() {
        _timerRunning = false;
        clearInterval(_timerInterval);
    }

    function _updateTimerDisplay(sec) {
        const mm = String(Math.floor(sec / 60)).padStart(2, '0');
        const ss = String(sec % 60).padStart(2, '0');
        const el = document.getElementById('rp-timer-display');
        if (el) el.textContent = `${mm}:${ss}`;
    }

    // ─── Helpers ──────────────────────────────────────────────
    function _scoreToBadge(score) {
        if (score >= 80) return 'OPTIMAL';
        if (score >= 60) return 'GOOD';
        if (score >= 40) return 'MODERATE';
        return 'LOW';
    }

    function _syncData() {
        _setText('rp-tei-score',  _data.teiScore);
        _setText('rp-tei-status', _data.teiStatus);
        _setText('rp-hr-num',     _data.hr);
        _setText('rp-ans-sns',    `${_data.ansSnsPct}%`);
        _setText('rp-ans-pns',    `${_data.ansPnsPct}%`);
        _timerSec = 0;
        _updateTimerDisplay(0);
    }

    function _setText(id, val) {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
    }
    function _setStyle(cls, prop, val) {
        const el = document.querySelector('.' + cls);
        if (el) el.style[prop] = val;
    }

    // ─── Export ───────────────────────────────────────────────
    return { init, show, hide };

}());

// Auto-init after DOM
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => TenkiResultsPage.init());
} else {
    TenkiResultsPage.init();
}

console.log('[ResultsPage] Module loaded ✓');
