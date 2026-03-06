class ResultsRenderer {
  constructor() { this.built = false; this.sparklines = {}; this.els = {}; }

  // ══════════════════════════════════════════════════
  // BUILD DOM
  // ══════════════════════════════════════════════════

  _build() {
    if (this.built) return;
    const root = document.getElementById('results-page');
    root.innerHTML = '';

    // ── Stardust Canvas ──
    const starCanvas = document.createElement('canvas');
    starCanvas.id = 'stardust-bg';
    root.appendChild(starCanvas);

    // ── Badge ──
    const badge = document.createElement('div');
    badge.className = 'scan-badge';
    badge.innerHTML = '<span class="scan-badge-inner"><span class="accent">✦</span> SCANNING · 0s</span>';
    root.appendChild(badge);
    this.els.badge = badge.querySelector('.scan-badge-inner');

    // ── Source Strip ──
    const strip = document.createElement('div');
    strip.className = 'source-strip';
    strip.innerHTML = '<span class="source-chip active">⌚ Garmin Forerunner</span><span class="source-chip secondary">📸 rPPG 眉心</span>';
    root.appendChild(strip);

    // ── TEI Ring (SVG) ──
    const outerR = 102, innerR = 80, cx = 110, cy = 110;
    this.outerCirc = 2 * Math.PI * outerR;
    this.innerCirc = 2 * Math.PI * innerR;
    const rc = document.createElement('div');
    rc.className = 'tei-ring-container';
    rc.innerHTML = `
      <svg class="tei-ring-svg" viewBox="0 0 220 220">
        <defs>
          <linearGradient id="sg" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#5E3A87"/>
            <stop offset="15%" stop-color="#00B4D8"/>
            <stop offset="30%" stop-color="#34C759"/>
            <stop offset="50%" stop-color="#A8D843"/>
            <stop offset="65%" stop-color="#F5A623"/>
            <stop offset="80%" stop-color="#FF6B35"/>
            <stop offset="100%" stop-color="#FF453A"/>
          </linearGradient>
          <linearGradient id="ig" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#34C759"/>
            <stop offset="100%" stop-color="#00B4D8"/>
          </linearGradient>
          <radialGradient id="cg" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="rgba(255,255,255,0.03)"/>
            <stop offset="100%" stop-color="rgba(255,255,255,0)"/>
          </radialGradient>
        </defs>
        <circle cx="${cx}" cy="${cy}" r="70" fill="url(#cg)"/>
        <circle cx="${cx}" cy="${cy}" r="${outerR}" fill="none" stroke="#1C1C1E" stroke-width="6"/>
        <circle cx="${cx}" cy="${cy}" r="${innerR}" fill="none" stroke="#1C1C1E" stroke-width="4"/>
        <circle id="ring-outer" cx="${cx}" cy="${cy}" r="${outerR}" fill="none"
          stroke="url(#sg)" stroke-width="6" stroke-linecap="round"
          stroke-dasharray="${this.outerCirc}" stroke-dashoffset="${this.outerCirc}"
          transform="rotate(-90 ${cx} ${cy})"/>
        <circle id="ring-inner" cx="${cx}" cy="${cy}" r="${innerR}" fill="none"
          stroke="url(#ig)" stroke-width="4" stroke-linecap="round"
          stroke-dasharray="${this.innerCirc}" stroke-dashoffset="${this.innerCirc}"
          transform="rotate(-90 ${cx} ${cy})"/>
        <circle id="ring-dot" cx="${cx}" cy="${cy - outerR}" r="5" fill="#F5A623" filter="url(#none)">
          <animate attributeName="r" values="4.5;5.5;4.5" dur="1.5s" repeatCount="indefinite"/>
        </circle>
      </svg>
      <div class="tei-number-wrap">
        <div class="tei-number bio-pulse" id="tei-num">--</div>
        <div class="tei-sub">TEI · PR99</div>
        <div class="tei-zone-name" id="zone-name">Scanning...</div>
      </div>`;
    root.appendChild(rc);

    // Glow dot shadow (JS because SVG filter is complex)
    const dot = document.getElementById('ring-dot');
    if (dot) dot.style.filter = 'drop-shadow(0 0 6px rgba(245,166,35,0.6))';

    // ── Coach ──
    const coach = document.createElement('div');
    coach.className = 'coach-card';
    coach.innerHTML = '<div class="coach-text" id="coach-text">正在分析你的生理狀態...</div>';
    root.appendChild(coach);

    // ── Bento Grid ──
    const bento = document.createElement('div');
    bento.className = 'bento-grid';
    const cards = [
      { key: 'hr', lbl: 'Heart Rate', pill: 'pill-garmin', pillTxt: 'Garmin Sync', color: '#FF453A', unit: 'BPM', hasSpark: true },
      { key: 'hrv', lbl: 'HRV', pill: 'pill-balanced', pillTxt: 'Balanced', color: '#34C759', unit: 'ms', unitSub: 'RMSSD', hasSpark: true },
      { key: 'rr', lbl: 'Respiratory', pill: null, pillTxt: null, color: '#00B4D8', unit: 'BrPM', hasSpark: true },
      { key: 'stress', lbl: 'Stress', pill: null, pillTxt: null, color: '#F5A623', unit: '/100', hasSpark: false },
    ];

    for (const c of cards) {
      const el = document.createElement('div');
      el.className = 'bio-card';
      el.innerHTML = `
        <div class="bio-card-header">
          <span class="bio-card-label">${c.lbl}</span>
          ${c.pill ? `<span class="bio-card-pill ${c.pill}">${c.pillTxt}</span>` : ''}
        </div>
        <div style="margin-top:6px">
          <span class="bio-card-value bio-pulse" id="val-${c.key}" style="color:${c.color}">--</span>
          <span class="bio-card-unit">${c.unit}</span>
          ${c.unitSub ? `<span class="bio-card-unit-sub">${c.unitSub}</span>` : ''}
          ${c.key === 'stress' ? '<span class="stress-pct" id="stress-pct">--%</span>' : ''}
        </div>
        ${c.hasSpark
          ? `<div class="bio-card-sparkline"><canvas id="spark-${c.key}"></canvas></div>`
          : `<div class="stress-bar-wrap">
              <div class="stress-bar" id="stress-bar">
                <div class="stress-seg filled" style="background:#34C759"></div>
                <div class="stress-seg empty"></div>
                <div class="stress-seg empty"></div>
                <div class="stress-seg empty"></div>
              </div>
            </div>`}`;
      bento.appendChild(el);
    }
    root.appendChild(bento);

    // Init sparklines
    requestAnimationFrame(() => {
      for (const c of cards.filter(x => x.hasSpark)) {
        const cv = document.getElementById(`spark-${c.key}`);
        if (cv) this.sparklines[c.key] = new Sparkline(cv, c.color);
      }
    });

    // ── Body Battery + ANS ──
    const bbSection = document.createElement('div');
    bbSection.className = 'bb-section';
    const bbData = [90, 95, 92, 85, 72, 55, 42, 48, 62, 70, 75, 78];
    let bbBarsHtml = '';
    bbData.forEach((v, i) => {
      const top = v >= 65 ? '#34C759' : v >= 40 ? '#00B4D8' : v >= 25 ? '#F5A623' : '#FF6B35';
      const bot = v >= 65 ? '#1A6B2E' : v >= 40 ? '#0E5A6F' : v >= 25 ? '#8A5E14' : '#7A3318';
      const op = i === bbData.length - 1 ? 1 : (0.25 + (i / 12) * 0.55).toFixed(2);
      const cls = i === bbData.length - 1 ? 'bb-bar current' : 'bb-bar';
      bbBarsHtml += `<div class="${cls}" data-h="${v}" style="height:0%;background:linear-gradient(180deg,${top},${bot});opacity:${op}"></div>`;
    });

    bbSection.innerHTML = `
      <div class="bb-header">
        <span class="bb-title">Body Battery Card</span>
        <div class="bb-score-wrap"><span class="bb-score" id="bb-score">78</span><span class="bb-score-sub"> / 100</span></div>
      </div>
      <div class="bb-chart" id="bb-chart">${bbBarsHtml}</div>
      <div class="ans-wrap">
        <div class="ans-title">ANS Balance</div>
        <div class="ans-bar-track">
          <div class="ans-bar-sns" id="ans-sns" style="width:38%"></div>
          <div class="ans-bar-divider" id="ans-div" style="left:38%"></div>
          <div class="ans-bar-pns" id="ans-pns" style="width:62%"></div>
        </div>
        <div class="ans-labels">
          <span class="sns-val" id="ans-sns-pct">38%</span>
          <div class="center-labels"><span class="sns-label">SNS</span><span class="pns-label">PNS</span></div>
          <span class="pns-val" id="ans-pns-pct">62%</span>
        </div>
      </div>`;
    root.appendChild(bbSection);

    // BB bar entrance animation
    setTimeout(() => {
      document.querySelectorAll('.bb-bar').forEach((bar, i) => {
        setTimeout(() => { bar.style.height = bar.dataset.h + '%'; }, 1200 + i * 80);
      });
    }, 100);

    // ── FDCB ──
    const fdcb = document.createElement('div');
    fdcb.className = 'fdcb-bar';
    fdcb.innerHTML = `
      <div class="fdcb-left">
        <span class="fdcb-icon">📊</span>
        <span class="fdcb-template-name">Canslim GS</span>
        <span class="fdcb-chevron">▾</span>
      </div>
      <div class="fdcb-center">
        <div class="fdcb-timer" id="fdcb-timer">--:--</div>
        <div class="fdcb-progress"><div class="fdcb-progress-fill" id="fdcb-fill" style="width:0%;background:#00B4D8"></div></div>
      </div>
      <div class="fdcb-right"><span class="fdcb-check">✓</span></div>`;
    root.appendChild(fdcb);

    // ── Start Stardust ──
    this._initStardust(starCanvas);
    this.built = true;
  }

  // ══════════════════════════════════════════════════
  // STARDUST CANVAS
  // ══════════════════════════════════════════════════

  _initStardust(canvas) {
    const dpr = window.devicePixelRatio || 1;
    const w = window.innerWidth, h = 560;
    canvas.width = w * dpr; canvas.height = h * dpr;
    canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    const stars = Array.from({ length: 60 }, () => ({
      x: Math.random() * w, y: Math.random() * h,
      r: 0.3 + Math.random() * 1.5,
      baseA: 0.03 + Math.random() * 0.37,
      speed: 2 + Math.random() * 3,
      phase: Math.random() * Math.PI * 2,
    }));

    const nebulae = [
      { cx: w * 0.5, cy: 80, r: 200, c: [0, 180, 216], a: 0.06, p: 8 },
      { cx: w * 0.15, cy: 200, r: 140, c: [52, 199, 89], a: 0.025, p: 11 },
      { cx: w * 0.85, cy: 50, r: 100, c: [245, 166, 35], a: 0.02, p: 0 },
      { cx: w * 0.08, cy: 30, r: 120, c: [0, 122, 255], a: 0.035, p: 14 },
    ];

    let t = 0;
    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      t += 0.016;

      for (const n of nebulae) {
        const s = n.p > 0 ? 1 + Math.sin(t * 2 * Math.PI / n.p) * 0.08 : 1;
        const g = ctx.createRadialGradient(n.cx, n.cy, 0, n.cx, n.cy, n.r * s);
        g.addColorStop(0, `rgba(${n.c.join(',')},${n.a})`);
        g.addColorStop(0.6, `rgba(${n.c.join(',')},${n.a * 0.3})`);
        g.addColorStop(1, `rgba(${n.c.join(',')},0)`);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      }

      for (const s of stars) {
        const a = s.baseA * (0.4 + 0.6 * Math.sin(t * s.speed + s.phase));
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${Math.max(0, a)})`;
        ctx.fill();
      }

      requestAnimationFrame(draw);
    };
    draw();
  }

  static initLandingParticles() {
    const canvas = document.getElementById('landing-particles');
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const w = window.innerWidth, h = window.innerHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    const ps = Array.from({ length: 40 }, () => ({
      x: Math.random() * w, y: Math.random() * h,
      r: 0.3 + Math.random() * 0.8, a: 0.04 + Math.random() * 0.18,
      vy: -(0.015 + Math.random() * 0.05), phase: Math.random() * Math.PI * 2,
    }));

    let t = 0;
    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      t += 0.016;

      // Central glow
      const bs = 1 + Math.sin(t * 0.4) * 0.06;
      const g = ctx.createRadialGradient(w / 2, h * 0.42, 0, w / 2, h * 0.42, 160 * bs);
      g.addColorStop(0, 'rgba(0,180,216,0.035)');
      g.addColorStop(0.5, 'rgba(94,58,135,0.012)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      for (const p of ps) {
        p.y += p.vy;
        if (p.y < -5) { p.y = h + 5; p.x = Math.random() * w; }
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${p.a * (0.4 + 0.6 * Math.sin(t * 1.2 + p.phase))})`;
        ctx.fill();
      }
      requestAnimationFrame(draw);
    };
    draw();
  }

  // ══════════════════════════════════════════════════
  // LIVE UPDATES (called by ScanUX every 350ms)
  // ══════════════════════════════════════════════════

  showWarmup() {
    this._build();
    document.getElementById('tei-num').textContent = '--';
    document.getElementById('zone-name').textContent = 'Calibrating...';
    document.getElementById('zone-name').style.color = '#636366';
  }

  updateBadge(phase, elapsed) {
    const labels = ['WARMUP', 'GLIMPSE', 'QUICK', 'STANDARD', 'DEEP'];
    this.els.badge.innerHTML = `<span class="accent">✦</span> ${labels[phase] || 'SCAN'} · ${elapsed}s`;
  }

  updatePhaseDots() { }

  updateAll(m, hist, ans, phase) {
    this._build();
    const tei = Math.round(m.tei), hr = Math.round(m.hr), hrv = Math.round(m.hrv);
    const rr = m.rr.toFixed(1), stress = Math.round(m.stress), sqi = Math.round(m.sqi);

    // TEI
    const el = document.getElementById('tei-num');
    if (tei > 0) { el.textContent = tei; el.style.opacity = '1'; }

    // Pulse
    if (hr > 30) document.documentElement.style.setProperty('--pulse-dur', (60 / hr) + 's');

    // Zone
    const zone = tei >= 80 ? 'peak' : tei >= 55 ? 'optimal' : tei >= 35 ? 'neutral' : 'degraded';
    const zi = {
      peak: { e: '⚠️', n: 'Peak Zone', z: '高能警戒', c: '#F5A623' },
      optimal: { e: '✅', n: 'Optimal Zone', z: '理想執行區', c: '#00B4D8' },
      neutral: { e: '⏸️', n: 'Neutral Zone', z: '中性區', c: '#8E8E93' },
      degraded: { e: '🔁', n: 'Degraded Zone', z: '低能區', c: '#5E3A87' }
    }[zone];

    document.getElementById('zone-name').textContent = zi.e + ' ' + zi.n;
    document.getElementById('zone-name').style.color = zi.c;

    // Rings
    document.getElementById('ring-outer')?.setAttribute('stroke-dashoffset', this.outerCirc * (1 - tei / 100));
    document.getElementById('ring-inner')?.setAttribute('stroke-dashoffset', this.innerCirc * (1 - Math.min(hrv / 80, 1)));

    // Dot
    const angle = -Math.PI / 2 + (tei / 100) * 2 * Math.PI;
    const dot = document.getElementById('ring-dot');
    if (dot) {
      dot.setAttribute('cx', 110 + 102 * Math.cos(angle));
      dot.setAttribute('cy', 110 + 102 * Math.sin(angle));
    }

    // Bio values
    document.getElementById('val-hr').textContent = hr;
    document.getElementById('val-hrv').textContent = hrv;
    document.getElementById('val-rr').textContent = rr;
    document.getElementById('val-stress').textContent = stress;

    // Stress bar segments
    const stressBar = document.getElementById('stress-bar');
    if (stressBar) {
      const segs = stressBar.querySelectorAll('.stress-seg');
      const colors = ['#34C759', '#00B4D8', '#F5A623', '#FF453A'];
      const idx = Math.min(Math.floor(stress / 25), 3);
      segs.forEach((s, i) => {
        if (i <= idx) { s.className = 'stress-seg filled'; s.style.background = colors[i]; }
        else { s.className = 'stress-seg empty'; s.style.background = 'rgba(255,255,255,0.06)'; }
      });
    }
    const sp = document.getElementById('stress-pct');
    if (sp) sp.textContent = stress + '%';

    // Sparklines
    if (this.sparklines.hr) this.sparklines.hr.push(hr);
    if (this.sparklines.hrv) this.sparklines.hrv.push(hrv);
    if (this.sparklines.rr) this.sparklines.rr.push(parseFloat(rr));

    // ANS
    document.getElementById('ans-sns').style.width = ans.sns + '%';
    document.getElementById('ans-pns').style.width = ans.pns + '%';
    document.getElementById('ans-div').style.left = ans.sns + '%';
    document.getElementById('ans-sns-pct').textContent = ans.sns + '%';
    document.getElementById('ans-pns-pct').textContent = ans.pns + '%';

    // Coach
    this._coach(zone, phase);
  }

  showComplete(m) {
    const tei = Math.round(m.tei);
    this.els.badge.innerHTML = '<span class="accent">✦</span> DEEP SCAN · 60s';
    const zone = tei >= 80 ? 'peak' : tei >= 55 ? 'optimal' : tei >= 35 ? 'neutral' : 'degraded';
    const msgs = {
      peak: '高能量狀態，自信充沛。提醒自己：自信是好的，過度自信需要留意。建議啟用雙重確認。',
      optimal: '保持專注，信任你的策略判斷，目前的生理狀態顯示你已處於最佳交易區間。',
      neutral: '中性狀態，專注力尚可。建議只選擇最高確信的機會，適度放慢節奏。',
      degraded: '身體發出需要休息的訊號。暫停是智慧的選擇。啟動呼吸校準，讓身心重新對齊。',
    };
    document.getElementById('coach-text').textContent = msgs[zone];
  }

  _coach(zone, phase) {
    const el = document.getElementById('coach-text');
    if (!el) return;
    if (phase < 2) el.textContent = '正在分析你的生理狀態...';
    else if (phase < 4) el.textContent = '數據收斂中，精度持續提升。保持放鬆，自然呼吸。';
    else {
      const h = {
        peak: '高能量狀態 — 注意過度自信風險，執行前多一次確認。',
        optimal: '保持專注，信任你的策略判斷。當前狀態適合全功能交易。',
        neutral: '適度放慢節奏。等待更好的時機，也是策略的一部分。',
        degraded: '身體建議你暫停。啟動呼吸校準，讓身心重新對齊。'
      };
      el.textContent = h[zone] || '';
    }
  }
}

document.addEventListener('DOMContentLoaded', () => ResultsRenderer.initLandingParticles());
