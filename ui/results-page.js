/**
 * TENKI CORE — Results Page Controller v2.0
 * ui/results-page.js
 *
 * Pixel-perfect UI spec implementation.
 * EventBridge wiring → live TEI/HR/HRV/ANS → show/hide page
 * Medical-grade Snapshot section with Canvas waveforms.
 *
 * Rule: DO NOT touch Stardust (app.js / rpgg.js / expression.js)
 * All UI via EventBridge pub/sub only.
 *
 * @version 2.0.0
 */

const TenkiResultsPage = (function () {
  'use strict';

  // ─── State ───────────────────────────────────────────────
  let _visible = false;
  let _pageEl = null;
  let _timerInterval = null;
  let _timerSec = 0;
  let _timerRunning = false;
  let _waveformRAF = null;

  const _data = {
    teiScore: 82,
    teiStatus: 'OPTIMAL',
    hr: 68,
    stress: 50,
    respiratory: 14,
    ansSnsPct: 48,
    ansPnsPct: 52,
    rmssd: 45,
    currentTime: '',
  };

  // Waveform history buffers (Canvas rendering)
  const _waveHistory = {
    sns: [],
    pns: [],
    hr: [],
    rr: [],
    stress: [],
    maxLen: 200,
  };

  // Heart-rate bar heights (percentages, 12 bars)
  const _barHeights = [52, 68, 74, 60, 88, 64, 70, 55, 78, 66, 72, 58];
  const _activeBar = 4; // 0-indexed

  // ─── Public API ───────────────────────────────────────────
  function init() {
    _buildPage();
    _subscribeEvents();
    _watchDashboard();
    console.log('[ResultsPage] v2.0 Initialized ✓');
  }

  function show(data) {
    if (data) {
      if (data.tei != null) { _data.teiScore = Math.round(data.tei); _data.teiStatus = _scoreToBadge(data.tei); }
      if (data.teiScore != null) { _data.teiScore = data.teiScore; _data.teiStatus = _scoreToBadge(data.teiScore); }
      if (data.hr != null) _data.hr = Math.round(data.hr);
      if (data.hrDelta != null) _data.hrDelta = data.hrDelta;
      if (data.restingHr != null) _data.restingHr = Math.round(data.restingHr);
    }
    if (_visible) return;
    _visible = true;
    _syncData();
    _pageEl.style.display = 'flex';
    _pageEl.classList.remove('rp-closing');
    void _pageEl.offsetWidth; // kick animation
    // Hide tier badge on Results Page
    var tierBadge = document.getElementById('tier-indicator-float');
    if (tierBadge) tierBadge.style.setProperty('display', 'none', 'important');
    // Start waveform rendering
    _startWaveformLoop();
    _startTimer();
    // Hide old app.js dashboard to prevent bleed-through
    var dashLayer = document.getElementById('dashboard-layer');
    if (dashLayer) dashLayer.style.setProperty('display', 'none', 'important');
  }

  function hide() {
    if (!_visible) return;
    _visible = false;
    _pageEl.classList.add('rp-closing');
    setTimeout(() => { _pageEl.style.display = 'none'; }, 380);
    _stopTimer();
    _stopWaveformLoop();
    // Restore tier badge
    var tierBadge = document.getElementById('tier-indicator-float');
    if (tierBadge) tierBadge.style.removeProperty('display');
    // Restore old dashboard
    var dashLayer = document.getElementById('dashboard-layer');
    if (dashLayer) dashLayer.style.removeProperty('display');
  }

  // ─── EventBridge Subscriptions ────────────────────────────
  function _subscribeEvents() {
    if (typeof EventBridge === 'undefined') return;

    // Scan complete → show page (desktop 2.5s hold trigger)
    try {
      EventBridge.on('scan:complete', (d) => { show(d); });
    } catch (e) { /* emit/on may not exist yet */ }

    // Progressive TEI updates (from tenki-2-bootstrap)
    try {
      EventBridge.on('tei:progressive', (d) => {
        if (!_visible) return;
        if (d && d.score != null) {
          _data.teiScore = Math.round(d.score);
          _updateZoneUI(_data.teiScore);
          _setText('rp-tei-score', _data.teiScore);
        }
      });
    } catch (e) { }

    // Live metrics from app.js via typed EventBridge methods
    if (typeof EventBridge.onTEIUpdate === 'function') {
      EventBridge.onTEIUpdate((d) => {
        if (!_visible) return;
        if (d.tei) {
          _data.teiScore = Math.round(d.tei);
          _updateZoneUI(_data.teiScore);
          _setText('rp-tei-score', _data.teiScore);
        }
      });
    }

    // Live metrics updates via generic on()
    try {
      EventBridge.on('tei:updated', (d) => {
        if (!_visible) return;
        if (d.hr) { _data.hr = Math.round(d.hr); _setText('rp-hr-num', _data.hr); _setText('rp-snap-hr-val', _data.hr); }
        if (d.hrv) { _data.rmssd = Math.round(d.hrv); }
        if (d.stress) { _data.stress = Math.round(d.stress * 100); _setText('rp-stress-val', _data.stress); _setStyle('rp-progbar-fill', 'width', `${_data.stress}%`); }
        if (d.rr) { _data.respiratory = Math.round(d.rr); _setText('rp-rr-val', _data.respiratory); _setText('rp-snap-rr-val', _data.respiratory); }
        if (d.sns) { _data.ansSnsPct = Math.round(d.sns); _setText('rp-ans-sns', `${_data.ansSnsPct}%`); _setText('rp-snap-sns-val', _data.ansSnsPct); }
        if (d.pns) { _data.ansPnsPct = Math.round(d.pns); _setText('rp-ans-pns', `${_data.ansPnsPct}%`); _setText('rp-snap-pns-val', _data.ansPnsPct); }
      });
    } catch (e) { }

    // Decision timer events
    try {
      EventBridge.on('timer:state', (d) => {
        if (!_visible) return;
        if (d.state === 'RUNNING') _startTimer();
        if (d.state === 'IDLE' || d.state === 'COMPLETE' || d.state === 'ABORT') _stopTimer();
        // T3/T4: 更新 CANSLIM badge
        if (d.template) _updateCanslimBadge(d.template);
      });
      EventBridge.on('timer:tick', (d) => {
        if (!_visible) return;
        if (d.elapsed != null) _updateTimerDisplay(d.elapsed);
      });
      // T3/T4: 計時進度 → 更新段落面板
      EventBridge.on('timer:progress', (d) => {
        if (!_visible || !d) return;
        _refreshCanslimPanel(d.template, d.elapsed, _data.teiScore);
      });
    } catch (e) { }
  }

  // ─── Mobile Trigger: Watch dashboard-layer ─────────────────
  // On mobile, app.js shows its own dashboard via dashboard-layer.show.
  // We use MutationObserver to detect this and overlay Results Page on top.
  function _watchDashboard() {
    var dashLayer = document.getElementById('dashboard-layer');
    if (!dashLayer) return;

    var observer = new MutationObserver(function (mutations) {
      mutations.forEach(function (m) {
        if (m.target.classList.contains('show') && !_visible) {
          // Immediate overlay — no delay to prevent old dashboard flash
          show({});
        }
      });
    });
    observer.observe(dashLayer, { attributes: true, attributeFilter: ['class'] });
    console.log('[ResultsPage] Dashboard observer attached ✓');
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
    const barH = 100; // container height in px
    const bars = _barHeights.map((h, i) => {
      const px = Math.round((h / 100) * barH);
      return `<div class="rp-bar${i === _activeBar ? ' active' : ''}" style="height:${px}px"></div>`;
    }).join('');

    const grids = [0, 33, 66].map(pct =>
      `<div class="rp-grid-line" style="bottom:${pct}%"></div>`
    ).join('');

    const ecgPath = `M0,18 Q8,6 16,18 Q20,24 24,18 L28,18 L32,4 L36,30 L40,18 Q48,6 56,18 Q60,22 64,18 L72,18 Q80,6 88,18 Q92,24 96,18 L100,18 L104,4 L108,30 L112,18 Q120,6 128,18`;

    return `

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
  <div class="rp-ring-outer" id="rp-ring-outer"></div>
  <div class="rp-ring-inner" id="rp-ring-inner"></div>
  <div class="rp-disc">
    <span class="rp-tei-label">TEI Score</span>
    <span class="rp-tei-score" id="rp-tei-score">${_data.teiScore}</span>
    <span class="rp-tei-status" id="rp-tei-status">${_data.teiStatus}</span>
  </div>
</div>

<!-- Heart Rate Activity Chart -->
<div class="rp-card rp-chart-card">
  <div class="rp-chart-header">
    <span class="rp-chart-title">Heart Rate Activity</span>
    <span class="rp-chart-delta" id="rp-hr-delta">${_data.hrDelta} vs last session</span>
  </div>
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

<!-- Dual Row: HR + ANS -->
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
      <svg class="rp-ecg-svg" viewBox="0 0 256 36" preserveAspectRatio="none">
        <path d="${ecgPath}" fill="none" stroke="rgba(91,163,245,0.8)" stroke-width="2" stroke-linecap="round"/>
        <path d="${ecgPath}" transform="translate(128,0)" fill="none" stroke="rgba(91,163,245,0.8)" stroke-width="2" stroke-linecap="round"/>
      </svg>
    </div>
    <div class="rp-hr-baseline" id="rp-hr-baseline">Resting avg: ${_data.restingHr}</div>
  </div>

<!-- ANS Balance -->
  <div class="rp-half-card">
    <div class="rp-ans-header">
      <span class="rp-ans-header-title">ANS Balance</span>
      <div class="rp-card-icon rp-icon-cyan">⚖</div>
    </div>
    <div class="rp-ans-specbar">
      <div class="rp-ans-dot"></div>
    </div>
    <div class="rp-ans-values" style="display:flex; justify-content:space-between; align-items:center;">
      <span class="rp-ans-label">SNS</span>
      <span class="rp-ans-nums" id="rp-ans-nums">${_data.ansSnsPct}% / ${_data.ansPnsPct}%</span>
      <span class="rp-ans-label">PNS</span>
    </div>
    <div class="rp-ans-badge">Balanced</div>
  </div>
</div>

<!-- Bio-Sync -->
<div class="rp-card rp-stress-card">
  <div class="rp-stress-header">
    <span class="rp-chart-title" style="margin:0;">Bio-Sync</span>
  </div>
  <div class="rp-wave-canvas-wrap">
    ${_waveSVG('slow', '#9f7aea', 3, 14, 0.7)}
    ${_waveSVG('fast', '#4cc9f0', 2, 8, 0.5)}
  </div>
  <div class="rp-stress-footer">
    <div class="rp-stress-left">
      <span class="rp-metric-label" style="font-size:20px;">💪 <span id="rp-stress-val" style="color:white; font-weight:700;">${_data.stress}</span></span>
      <div class="rp-progbar-wrap" style="margin-top:4px;">
        <div class="rp-progbar-fill" id="rp-progbar-fill" style="width:${_data.stress}%"></div>
        <div class="rp-progbar-dot"></div>
      </div>
    </div>
    <div class="rp-stress-right" style="text-align:right;">
      <div class="rp-metric-label" style="display:flex; align-items:center; gap:6px; justify-content:flex-end;">
        <div class="rp-wind-icon"><span></span></div>
        <span id="rp-rr-val" style="color:white; font-weight:700; font-size:18px;">${_data.respiratory}</span>
      </div>
      <div style="font-size:10px; color:var(--rp-text-secondary); margin-top:2px;">Synchronized</div>
    </div>
  </div>
</div>

<!-- Decision Timer -->
<div class="rp-timer-card">
  <div class="rp-timer-header">
    <div class="rp-timer-title">
      <span class="rp-timer-lightning material-symbols-outlined ferrari-icon">electric_bolt</span>
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

<!-- ============================================ -->
<!-- T3 CANSLIM / T4 High RS 策略段落面板        -->
<!-- ============================================ -->
<div class="rp-card rp-canslim-card" id="rp-canslim-card">
  <div class="rp-canslim-header">
    <span class="rp-chart-title" style="margin:0;">策略段落</span>
    <span class="rp-canslim-badge" id="rp-canslim-badge">CANSLIM</span>
  </div>
  <!-- 段落面板 (由 canslim-logic.js 渲染) -->
  <div id="rp-canslim-panel">
    <div style="font-size:11px;color:rgba(255,255,255,0.3);padding:8px 0;">等待計時器啟動…</div>
  </div>
  <!-- Bio 進場條件判定 -->
  <span class="rp-bio-check warn" id="rp-bio-check">— 尚未開始計時</span>
</div>

<!-- Behavior Timeline -->
<div class="rp-timeline-card">
  <div class="rp-timeline-header">
    <div class="rp-timeline-title">
      <span class="rp-timeline-icon">🕒</span>
      Behavior Timeline
    </div>
  </div>
  <div class="rp-timeline-body" id="rp-timeline-body">
    <!-- Events injected by logBehavior() -->
    <div class="rp-timeline-empty">Waiting for decision node...</div>
  </div>
</div>

<!-- ============================================ -->
<!-- MEDICAL-GRADE SNAPSHOT SECTION               -->
<!-- ============================================ -->
<div class="rp-snapshot-section">

  <div class="rp-snapshot-header">
    <div class="rp-snapshot-title">Biometric Snapshot</div>
    <div class="rp-snapshot-badge">LIVE</div>
  </div>

  <!-- ANS Waveform: SNS / PNS synchronized -->
  <div class="rp-snapshot-card">
    <div class="rp-snapshot-card-title">
      <span class="rp-snapshot-card-label"><span class="material-symbols-outlined ferrari-icon" style="font-size:14px">electric_bolt</span> Autonomic Nervous System</span>
      <span class="rp-snapshot-card-live">SYNC</span>
    </div>
    <div class="rp-waveform-container">
      <div class="rp-waveform-grid"></div>
      <canvas class="rp-waveform-canvas" id="rp-canvas-ans" width="600" height="160"></canvas>
    </div>
    <div class="rp-waveform-legend">
      <div class="rp-legend-item"><div class="rp-legend-dot sns"></div>Sympathetic</div>
      <div class="rp-legend-item"><div class="rp-legend-dot pns"></div>Parasympathetic</div>
    </div>
    <div class="rp-snapshot-stats">
      <div class="rp-snapshot-stat">
        <div class="rp-snapshot-stat-val" id="rp-snap-sns-val" style="color:#ff8c69">${_data.ansSnsPct}</div>
        <div class="rp-snapshot-stat-unit">SNS %</div>
      </div>
      <div class="rp-snapshot-stat">
        <div class="rp-snapshot-stat-val" id="rp-snap-pns-val" style="color:#4cc9f0">${_data.ansPnsPct}</div>
        <div class="rp-snapshot-stat-unit">PNS %</div>
      </div>
    </div>
  </div>

  <!-- Vital Signs Waveform: HR / RR / Stress -->
  <div class="rp-snapshot-card">
    <div class="rp-snapshot-card-title">
      <span class="rp-snapshot-card-label">❤️ Vital Signs Monitor</span>
      <span class="rp-snapshot-card-live">LIVE</span>
    </div>
    <div class="rp-waveform-container">
      <div class="rp-waveform-grid"></div>
      <canvas class="rp-waveform-canvas" id="rp-canvas-vitals" width="600" height="160"></canvas>
    </div>
    <div class="rp-waveform-legend">
      <div class="rp-legend-item"><div class="rp-legend-dot hr"></div>Heart Rate</div>
      <div class="rp-legend-item"><div class="rp-legend-dot rr"></div>Respiratory</div>
      <div class="rp-legend-item"><div class="rp-legend-dot stress"></div>Stress</div>
    </div>
    <div class="rp-snapshot-stats">
      <div class="rp-snapshot-stat">
        <div class="rp-snapshot-stat-val" id="rp-snap-hr-val" style="color:#ff4444">${_data.hr}</div>
        <div class="rp-snapshot-stat-unit">BPM</div>
      </div>
      <div class="rp-snapshot-stat">
        <div class="rp-snapshot-stat-val" id="rp-snap-rr-val" style="color:#00ff88">${_data.respiratory}</div>
        <div class="rp-snapshot-stat-unit">BR/MIN</div>
      </div>
      <div class="rp-snapshot-stat">
        <div class="rp-snapshot-stat-val" id="rp-snap-stress-val" style="color:#9f7aea">${_data.stress}</div>
        <div class="rp-snapshot-stat-unit">STRESS</div>
      </div>
    </div>
  </div>

</div>

<!-- Footer -->
<p class="rp-footer">TENKI CORE · BUILD 1.0</p>
        `;
  }

  // ─── Wave SVG Helper ─────────────────────────────────────
  function _waveSVG(cls, color, strokeW, amp, opacity) {
    const pts = [];
    const W = 256, H = 52, cy = H / 2;
    for (let x = 0; x <= W; x += 4) {
      const y = cy + Math.sin((x / W) * Math.PI * 6) * amp;
      pts.push(`${x === 0 ? 'M' : 'L'}${x},${y.toFixed(1)}`);
    }
    const path = pts.join(' ');
    return `<svg class="rp-wave-svg ${cls}" viewBox="0 0 512 52" style="position:absolute;top:0;left:0;opacity:${opacity}">
          <path d="${path}" fill="none" stroke="${color}" stroke-width="${strokeW}" stroke-linecap="round"/>
          <path d="${path}" transform="translate(256,0)" fill="none" stroke="${color}" stroke-width="${strokeW}" stroke-linecap="round"/>
        </svg>`;
  }

  // ─── Stars ────────────────────────────────────────────────
  function _spawnStars(parent) {
    for (let i = 0; i < 70; i++) {
      const s = document.createElement('div');
      s.className = 'rp-star';
      const sz = Math.random() * 2.5 + 0.5;
      s.style.cssText = `
              width:${sz}px; height:${sz}px;
              left:${Math.random() * 100}%;
              top:${Math.random() * 100}%;
              opacity:${(Math.random() * 0.4 + 0.15).toFixed(2)};
              animation-duration:${(Math.random() * 3 + 2).toFixed(1)}s;
              animation-delay:-${(Math.random() * 3).toFixed(1)}s;
            `;
      parent.appendChild(s);
    }
  }

  // ─── Clock ───────────────────────────────────────────────
  function _getNow() {
    const now = new Date();
    return `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`;
  }

  function _startClock() {
    setInterval(() => {
      const el = document.getElementById('rp-clock');
      if (el) el.textContent = _getNow();
    }, 10000);
  }

  // ─── Decision Timer ──────────────────────────────────────
  function _startTimer() {
    if (_timerRunning) return;
    _timerRunning = true;
    _timerSec = 0;
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

  // ============================================================
  // MEDICAL-GRADE CANVAS WAVEFORM RENDERING
  // ============================================================

  function _startWaveformLoop() {
    if (_waveformRAF) return;
    const ansCanvas = document.getElementById('rp-canvas-ans');
    const vitalsCanvas = document.getElementById('rp-canvas-vitals');
    if (!ansCanvas || !vitalsCanvas) return;

    const ansCtx = ansCanvas.getContext('2d');
    const vitCtx = vitalsCanvas.getContext('2d');

    // Set canvas resolution for retina
    const dpr = window.devicePixelRatio || 1;
    [ansCanvas, vitalsCanvas].forEach(c => {
      const rect = c.getBoundingClientRect();
      c.width = rect.width * dpr;
      c.height = rect.height * dpr;
      c.getContext('2d').scale(dpr, dpr);
    });

    let frame = 0;

    function render() {
      frame++;
      const t = frame * 0.03;

      // Generate simulated data (will be replaced by real EventBridge data)
      const sns = 48 + Math.sin(t * 0.5) * 8 + Math.sin(t * 1.3) * 3 + (Math.random() - 0.5) * 2;
      const pns = 52 + Math.sin(t * 0.4 + 1) * 6 + Math.sin(t * 1.1 + 0.5) * 4 + (Math.random() - 0.5) * 2;
      const hr = _data.hr + Math.sin(t * 0.8) * 3 + Math.sin(t * 2.1) * 1.5 + (Math.random() - 0.5) * 1;
      const rr = _data.respiratory + Math.sin(t * 0.3) * 2 + (Math.random() - 0.5) * 0.5;
      const stress = _data.stress + Math.sin(t * 0.6) * 5 + Math.sin(t * 1.5) * 2 + (Math.random() - 0.5) * 1;

      _pushWave('sns', sns);
      _pushWave('pns', pns);
      _pushWave('hr', hr);
      _pushWave('rr', rr);
      _pushWave('stress', stress);

      // Draw ANS canvas
      _drawWaveform(ansCtx, ansCanvas, [
        { data: _waveHistory.sns, color: '#ff8c69', lineWidth: 2.5, glow: 'rgba(255,140,105,0.3)' },
        { data: _waveHistory.pns, color: '#4cc9f0', lineWidth: 2.5, glow: 'rgba(76,201,240,0.3)' },
      ]);

      // Draw Vitals canvas
      _drawWaveform(vitCtx, vitalsCanvas, [
        { data: _waveHistory.hr, color: '#ff4444', lineWidth: 2, glow: 'rgba(255,68,68,0.25)' },
        { data: _waveHistory.rr, color: '#00ff88', lineWidth: 1.8, glow: 'rgba(0,255,136,0.2)' },
        { data: _waveHistory.stress, color: '#9f7aea', lineWidth: 1.5, glow: 'rgba(159,122,234,0.2)' },
      ]);

      // Update stat values periodically
      if (frame % 15 === 0) {
        _setText('rp-snap-stress-val', Math.round(stress));
      }

      _waveformRAF = requestAnimationFrame(render);
    }

    _waveformRAF = requestAnimationFrame(render);
  }

  function _stopWaveformLoop() {
    if (_waveformRAF) {
      cancelAnimationFrame(_waveformRAF);
      _waveformRAF = null;
    }
  }

  function _pushWave(key, value) {
    _waveHistory[key].push(value);
    if (_waveHistory[key].length > _waveHistory.maxLen) {
      _waveHistory[key].shift();
    }
  }

  function _drawWaveform(ctx, canvas, series) {
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;

    ctx.clearRect(0, 0, w, h);

    series.forEach(({ data, color, lineWidth, glow }) => {
      if (data.length < 2) return;

      // Find min/max for normalization
      let min = Infinity, max = -Infinity;
      data.forEach(v => { if (v < min) min = v; if (v > max) max = v; });
      const range = max - min || 1;
      const pad = 8;

      // Glow layer
      ctx.save();
      ctx.shadowColor = glow;
      ctx.shadowBlur = 12;
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';

      ctx.beginPath();
      for (let i = 0; i < data.length; i++) {
        const x = (i / (data.length - 1)) * w;
        const y = pad + ((max - data[i]) / range) * (h - pad * 2);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.restore();

      // Crisp layer (no glow)
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth * 0.7;
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      for (let i = 0; i < data.length; i++) {
        const x = (i / (data.length - 1)) * w;
        const y = pad + ((max - data[i]) / range) * (h - pad * 2);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    });
  }

  // ─── Helpers ──────────────────────────────────────────────
  function _updateZoneUI(score) {
    if (typeof window.TEI_PR99_Engine !== 'undefined') {
      const zone = window.TEI_PR99_Engine.getZone(score);
      _data.teiStatus = zone.label;
      _setText('rp-tei-status', _data.teiStatus);

      const statusEl = document.getElementById('rp-tei-status');
      if (statusEl) {
        statusEl.style.color = zone.color;
        // Hex to rgba for border
        if (zone.color.startsWith('var')) {
          statusEl.style.borderColor = zone.color;
        } else {
          statusEl.style.borderColor = zone.color;
        }
      }

      // Update TEI ring gradients
      const ringOuter = document.getElementById('rp-ring-outer');
      const ringInner = document.getElementById('rp-ring-inner');
      if (ringOuter && zone.gradientOuter) ringOuter.style.background = zone.gradientOuter;
      if (ringInner && zone.gradientInner) ringInner.style.background = zone.gradientInner;
    } else {
      // Fallback if engine missing
      let status = 'LOW';
      let color = 'var(--rp-violet)';
      if (score >= 80) { status = 'Peak'; color = 'var(--rp-yellow)'; }
      else if (score >= 55) { status = 'Optimal'; color = 'var(--rp-cyan)'; }
      else if (score >= 35) { status = 'Neutral'; color = 'var(--rp-text-secondary)'; }
      else { status = 'Degraded'; color = 'var(--rp-violet)'; }

      _data.teiStatus = status;
      _setText('rp-tei-status', status);
      const statusEl = document.getElementById('rp-tei-status');
      if (statusEl) {
        statusEl.style.color = color;
        statusEl.style.borderColor = color;
      }
    }
  }

  function _syncData() {
    _setText('rp-tei-score', _data.teiScore);
    _updateZoneUI(_data.teiScore);
    _setText('rp-hr-num', _data.hr);
    _setText('rp-hr-delta', `${_data.hrDelta} vs last session`);
    _setText('rp-hr-baseline', `Resting avg: ${_data.restingHr}`);
    _setText('rp-ans-nums', `${_data.ansSnsPct}% / ${_data.ansPnsPct}%`);
    _setText('rp-stress-val', _data.stress);
    _setText('rp-rr-val', _data.respiratory);
    _setText('rp-snap-hr-val', _data.hr);
    _setText('rp-snap-rr-val', _data.respiratory);
    _setText('rp-snap-sns-val', _data.ansSnsPct);
    _setText('rp-snap-pns-val', _data.ansPnsPct);
    _setText('rp-snap-stress-val', _data.stress);
    _timerSec = 0;
    _updateTimerDisplay(0);
    // Reset waveform buffers
    Object.keys(_waveHistory).forEach(k => {
      if (k !== 'maxLen') _waveHistory[k] = [];
    });
    // T3/T4: 初始化 CANSLIM 面板（預設 CANSLIM_GROWTH）
    _refreshCanslimPanel('CANSILM_GROWTH', 0, _data.teiScore);
  }

  function _setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }
  function _setStyle(id, prop, val) {
    const el = document.getElementById(id);
    if (el) el.style[prop] = val;
  }

  // ─── T3/T4 CANSLIM Panel ──────────────────────────────────────

  /**
   * 刷新 CANSLIM 段落面板
   * @param {string} templateId - 'CANSILM_GROWTH' | 'CANSILM_HIGHRS'
   * @param {number} elapsedSec
   * @param {number} tei
   */
  function _refreshCanslimPanel(templateId, elapsedSec, tei) {
    // 依賴 CANSLIMLogic (canslim-logic.js)
    if (typeof CANSLIMLogic === 'undefined') return;

    const container = document.getElementById('rp-canslim-panel');
    if (!container) return;

    container.innerHTML = CANSLIMLogic.renderSegmentUI(templateId, elapsedSec);

    // 更新生物進場條件
    const bio = CANSLIMLogic.checkBioCriteria(templateId, elapsedSec, tei || _data.teiScore);
    const bioEl = document.getElementById('rp-bio-check');
    if (bioEl) {
      bioEl.textContent = bio.reason;
      bioEl.className = `rp-bio-check ${bio.canEnter ? 'ok' : 'warn'}`;
    }

    // badge
    _updateCanslimBadge(templateId);
  }

  function _updateCanslimBadge(templateId) {
    const badgeEl = document.getElementById('rp-canslim-badge');
    if (!badgeEl) return;
    const BADGE_MAP = {
      'CANSILM_GROWTH': 'T3 · 3段',
      'CANSILM_HIGHRS': 'T4 · 2段',
      'MANCINI_FBD': 'Mancini'
    };
    badgeEl.textContent = BADGE_MAP[templateId] || templateId;
  }

  // CSS for the CANSLIM card
  (function _injectCanslimCardCSS() {
    if (document.getElementById('rp-canslim-card-styles')) return;
    const s = document.createElement('style');
    s.id = 'rp-canslim-card-styles';
    s.textContent = `
      .rp-canslim-card {
        padding: 16px 16px 12px;
        margin-bottom: 0;
      }
      .rp-canslim-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 14px;
      }
      .rp-canslim-badge {
        font-size: 10px;
        font-weight: 700;
        color: rgba(0,240,255,0.9);
        background: rgba(0,240,255,0.1);
        border: 1px solid rgba(0,240,255,0.2);
        border-radius: 99px;
        padding: 2px 10px;
        letter-spacing: 0.5px;
      }
    `;
    document.head.appendChild(s);
  })();

  // ─── Timeline ───────────────────────────────────────────────
  function logBehavior(eventStr, hr, pr, isAlert) {
    const timelineEl = document.getElementById('rp-timeline-body');
    if (!timelineEl) return;

    // Remove empty placeholder
    const emptyEl = timelineEl.querySelector('.rp-timeline-empty');
    if (emptyEl) emptyEl.remove();

    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });

    const item = document.createElement('div');
    item.className = 'rp-timeline-item';

    let alertHtml = isAlert ? `<span class="rp-timeline-alert material-symbols-outlined ferrari-icon" style="font-size:14px;color:#dc2626">warning</span>` : '';

    item.innerHTML = `
      <div class="rp-timeline-time">${timeStr}</div>
      <div class="rp-timeline-content">
        <div class="rp-timeline-event">${eventStr}</div>
        <div class="rp-timeline-metrics">
          <span>HR ${hr}</span>
          <span>→</span>
          <span>PR ${pr}</span>
          ${alertHtml}
        </div>
      </div>
    `;

    // Add to top
    timelineEl.insertBefore(item, timelineEl.firstChild);
  }

  // ─── Export ───────────────────────────────────────────────
  return { init, show, hide, logBehavior, refreshCanslimPanel: _refreshCanslimPanel };

}());

// Auto-init after DOM
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => TenkiResultsPage.init());
} else {
  TenkiResultsPage.init();
}

console.log('[ResultsPage] v2.0 Module loaded ✓');
