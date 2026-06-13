/**
 * TENKI CORE — Soul Scan Enrollment (preview)
 * ===========================================
 * A browser-walkable demonstration of the Face Baseline enrollment flow so the
 * founder can feel the Face ID-grade ceremony on a phone before the native
 * (vision-camera) session exists. All signals are SIMULATED — this mirrors the
 * React Native FSM (apps/mobile/features/face-baseline), not real detection.
 *
 * Flow (mirrors faceBaselineMachine.ts):
 *   environment_check → face_detecting → face_locked → neutral_capture →
 *   arc_left → arc_right → stability_pass → processing → baseline_confirmed
 *
 * Visual law (face-baseline/SPEC.md): cyan = ACTIVE (pre-baseline),
 * gold = SECURED (capture mesh + halo). Progress is ONE closing halo whose
 * weights match captureProgress() — neutral 0.5, arc 0.3, stability 0.2.
 */
'use strict';

(function () {
  // ── tokens ──
  const COLORS = {
    cyan: '#00F0FF',
    mint: '#00E699',
    gold: '#FFC85E',
    goldDeep: '#F3A92A',
    goldChampagne: '#FFE9B0',
  };

  // ── phase script (mirrors the FSM + per-screen copy) ──
  const PHASES = [
    {
      id: 'environment_check',
      instr: 'Find even light, look ahead',
      sub: 'We’ll confirm three things before we begin.',
      dur: 2800, accent: 'cyan', halo: [0, 0], meter: false, climb: true,
    },
    {
      id: 'face_detecting',
      instr: 'Center your face',
      sub: 'Hold the phone at eye level.',
      dur: 1700, accent: 'cyan', halo: [0, 0], meter: false, shape: 'searching',
    },
    {
      id: 'face_locked',
      instr: 'Locked',
      sub: '',
      dur: 750, accent: 'mint', halo: [0, 0], meter: false, shape: 'lock',
    },
    {
      id: 'neutral_capture',
      instr: 'Hold still',
      sub: 'Look naturally ahead — your steady state.',
      dur: 3600, accent: 'gold', halo: [0, 0.5], meter: true, secured: true,
    },
    {
      id: 'arc_left',
      instr: 'Turn slightly left',
      sub: 'Slow and gentle — small angles.',
      dur: 2200, accent: 'gold', halo: [0.5, 0.65], meter: true, secured: true, guide: -1,
    },
    {
      id: 'arc_right',
      instr: 'Turn slightly right',
      sub: 'Slow and gentle — small angles.',
      dur: 2600, accent: 'gold', halo: [0.65, 0.8], meter: true, secured: true, guide: 1,
      recenter: 'Return to center', // shown in the final stretch of the arc
    },
    {
      id: 'stability_pass',
      instr: 'Breathe naturally',
      sub: 'Relax your jaw and let your eyes settle.',
      dur: 3200, accent: 'gold', halo: [0.8, 1.0], meter: true, secured: true, settle: true,
    },
    {
      id: 'processing',
      instr: 'Securing your baseline…',
      sub: 'Processed and stored on-device.',
      dur: 1900, accent: 'gold', halo: [1, 1], meter: true, secured: true, processing: true,
    },
    {
      id: 'baseline_confirmed',
      instr: 'Baseline locked.',
      sub: 'Your future scans will compare against this personal reference.',
      dur: Infinity, accent: 'gold', halo: [1, 1], meter: false, secured: true, confirmed: true,
    },
  ];

  const INDICATORS = [
    { key: 'light', label: 'Light', at: 0.30 },
    { key: 'centered', label: 'Centered', at: 0.58 },
    { key: 'still', label: 'Still', at: 0.86 },
  ];

  // ── runtime state ──
  const state = {
    started: false,
    phase: -1,
    phaseStart: 0,
    halo: 0,        // 0–1, eased toward target
    secured: 0,     // 0 cyan → 1 gold blend
    settle: 0,      // particle convergence 0–1
    bloom: 0,       // confirmation core bloom 0–1
    raf: null,
  };

  let ctx, scanCanvas;
  let particles = [];
  const VIEW = 320; // logical units; canvas backing is 2×

  // ── helpers ──
  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);

  function hexToRgb(h) {
    const n = parseInt(h.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function mix(c1, c2, t) {
    const a = hexToRgb(c1); const b = hexToRgb(c2);
    return `rgb(${Math.round(lerp(a[0], b[0], t))},${Math.round(lerp(a[1], b[1], t))},${Math.round(lerp(a[2], b[2], t))})`;
  }
  function accentColor(name) {
    return name === 'cyan' ? COLORS.cyan : name === 'mint' ? COLORS.mint : COLORS.gold;
  }

  // ── build DOM bits ──
  function buildIndicators() {
    const wrap = document.getElementById('indicators');
    wrap.innerHTML = '';
    INDICATORS.forEach((ind) => {
      const pill = document.createElement('div');
      pill.className = 'pindicator';
      pill.id = 'pin-' + ind.key;
      pill.innerHTML = `<span class="pindot"></span><span>${ind.label}</span>`;
      wrap.appendChild(pill);
    });
  }

  function makeParticles() {
    particles = [];
    const count = 66;
    for (let i = 0; i < count; i++) {
      // distribute within a vertical face ellipse
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random());
      const x = Math.cos(a) * r * 62;
      const y = Math.sin(a) * r * 80;
      particles.push({
        bx: x, by: y,
        phase: Math.random() * Math.PI * 2,
        speed: 0.6 + Math.random() * 0.8,
        size: 1.1 + Math.random() * 1.9,
        gold: Math.random() > 0.45, // some specks are gold-leaning, some cyan
      });
    }
  }

  // ── starfield (separate static-ish layer) ──
  let stars = [];
  function initStarfield() {
    const cv = document.getElementById('starfield');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = cv.clientWidth * dpr;
    cv.height = cv.clientHeight * dpr;
    const c = cv.getContext('2d');
    c.scale(dpr, dpr);
    stars = [];
    const n = 90;
    for (let i = 0; i < n; i++) {
      stars.push({
        x: Math.random() * cv.clientWidth,
        y: Math.random() * cv.clientHeight,
        r: Math.random() * 1.3 + 0.2,
        tw: Math.random() * Math.PI * 2,
        sp: 0.5 + Math.random() * 1.5,
      });
    }
    cv._ctx = c;
  }
  function drawStarfield(now) {
    const cv = document.getElementById('starfield');
    const c = cv._ctx; if (!c) return;
    c.clearRect(0, 0, cv.clientWidth, cv.clientHeight);
    for (const s of stars) {
      const a = 0.25 + 0.55 * (0.5 + 0.5 * Math.sin(now * 0.001 * s.sp + s.tw));
      c.beginPath();
      c.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      c.fillStyle = `rgba(180,200,255,${a})`;
      c.fill();
    }
  }

  // ── scan canvas ──
  function initScanCanvas() {
    scanCanvas = document.getElementById('scan-canvas');
    scanCanvas.style.width = '300px';
    scanCanvas.style.height = '300px';
    const dpr = 2;
    scanCanvas.width = VIEW * dpr;
    scanCanvas.height = VIEW * dpr;
    ctx = scanCanvas.getContext('2d');
    ctx.scale(dpr, dpr);
  }

  function roundedRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  function drawCorners(c, cx, cy, half, color, alpha) {
    const len = 26; const off = half;
    c.save();
    c.strokeStyle = color; c.globalAlpha = alpha; c.lineWidth = 2.5;
    c.lineCap = 'round'; c.shadowColor = color; c.shadowBlur = 10;
    const corners = [
      [cx - off, cy - off, 1, 1], [cx + off, cy - off, -1, 1],
      [cx - off, cy + off, 1, -1], [cx + off, cy + off, -1, -1],
    ];
    for (const [x, y, sx, sy] of corners) {
      c.beginPath();
      c.moveTo(x, y + sy * len); c.lineTo(x, y); c.lineTo(x + sx * len, y);
      c.stroke();
    }
    c.restore();
  }

  function drawHalo(c, cx, cy, radius, progress, color) {
    if (progress <= 0.001) return;
    c.save();
    // faint full track
    c.beginPath(); c.arc(cx, cy, radius, 0, Math.PI * 2);
    c.strokeStyle = 'rgba(255,255,255,0.06)'; c.lineWidth = 4; c.stroke();
    // closing arc from top, clockwise
    const start = -Math.PI / 2;
    const end = start + Math.PI * 2 * clamp01(progress);
    c.beginPath(); c.arc(cx, cy, radius, start, end);
    c.strokeStyle = color; c.lineWidth = 4.5; c.lineCap = 'round';
    c.shadowColor = color; c.shadowBlur = 18; c.stroke();
    // leading bead
    c.beginPath();
    c.arc(cx + Math.cos(end) * radius, cy + Math.sin(end) * radius, 3.6, 0, Math.PI * 2);
    c.fillStyle = '#FFFFFF'; c.shadowBlur = 14; c.shadowColor = color; c.fill();
    c.restore();
  }

  function drawParticles(c, cx, cy, now, ph) {
    const secured = state.secured;
    const settle = state.settle;
    const bloom = state.bloom;
    for (const p of particles) {
      const drift = state.started ? 1 : 0.4;
      const dx = Math.sin(now * 0.001 * p.speed + p.phase) * 4 * drift;
      const dy = Math.cos(now * 0.0011 * p.speed + p.phase) * 4 * drift;
      // converge toward center as the baseline settles / confirms
      const k = clamp01(settle * 0.5 + bloom);
      const px = cx + lerp(p.bx + dx, 0, k);
      const py = cy + lerp(p.by + dy, 0, k);
      const pulse = 0.6 + 0.4 * Math.sin(now * 0.004 * p.speed + p.phase);
      const base = p.gold ? mix(COLORS.cyan, COLORS.gold, secured) : mix(COLORS.cyan, COLORS.goldChampagne, secured * 0.7);
      const size = p.size * (0.8 + pulse * 0.5) * (1 + bloom * 0.6);
      c.save();
      c.globalAlpha = 0.25 + 0.55 * pulse + bloom * 0.2;
      c.beginPath(); c.arc(px, py, size, 0, Math.PI * 2);
      c.fillStyle = base; c.shadowColor = base; c.shadowBlur = 6 + bloom * 14;
      c.fill();
      c.restore();
    }
    // confirmation core
    if (bloom > 0.01) {
      c.save();
      const g = c.createRadialGradient(cx, cy, 0, cx, cy, 60 * bloom + 8);
      g.addColorStop(0, `rgba(255,233,176,${0.9 * bloom})`);
      g.addColorStop(0.4, `rgba(255,200,94,${0.5 * bloom})`);
      g.addColorStop(1, 'rgba(255,200,94,0)');
      c.fillStyle = g;
      c.beginPath(); c.arc(cx, cy, 60 * bloom + 8, 0, Math.PI * 2); c.fill();
      c.restore();
    }
  }

  function drawGuide(c, cx, cy, dir, color) {
    // a soft arc-arrow nudging left/right under the frame
    c.save();
    c.translate(cx + dir * 120, cy);
    c.rotate(dir < 0 ? Math.PI : 0);
    c.strokeStyle = color; c.globalAlpha = 0.85; c.lineWidth = 3; c.lineCap = 'round';
    c.shadowColor = color; c.shadowBlur = 8;
    c.beginPath(); c.moveTo(-8, -8); c.lineTo(4, 0); c.lineTo(-8, 8); c.stroke();
    c.restore();
  }

  // ── frame ──
  function render(now) {
    drawStarfield(now);
    if (ctx) {
      ctx.clearRect(0, 0, VIEW, VIEW);
      const cx = VIEW / 2, cy = VIEW / 2;
      const ph = PHASES[state.phase] || PHASES[0];
      const accent = accentColor(ph.accent || 'cyan');
      const half = 92;

      // pre-lock subtle frame body
      ctx.save();
      roundedRect(ctx, cx - half, cy - half, half * 2, half * 2, 40);
      ctx.fillStyle = 'rgba(10,16,30,0.35)';
      ctx.fill();
      ctx.restore();

      drawParticles(ctx, cx, cy, now, ph);
      drawCorners(ctx, cx, cy, half, accent, state.started ? 0.95 : 0.5);
      drawHalo(ctx, cx, cy, half + 26, state.halo, accent);
      if (ph.guide !== undefined && state.halo < 0.82) drawGuide(ctx, cx, cy, ph.guide, accent);
    }
    state.raf = requestAnimationFrame(render);
  }

  // ── phase runner ──
  function setText(instr, sub) {
    document.getElementById('instruction').textContent = instr;
    document.getElementById('subtitle').textContent = sub || '';
  }

  function enterPhase(i) {
    state.phase = i;
    state.phaseStart = performance.now();
    const ph = PHASES[i];
    setText(ph.instr, ph.sub);
    document.getElementById('meter').style.opacity = ph.meter ? '1' : '0';
    document.getElementById('securedPill').classList.toggle('on', !!ph.secured);
    if (ph.confirmed) haptic([18, 40, 90]);
    else if (ph.id === 'face_locked') haptic(28);
  }

  function tick(now) {
    if (!state.started) return;
    const ph = PHASES[state.phase];
    const t = ph.dur === Infinity ? 1 : clamp01((now - state.phaseStart) / ph.dur);

    // halo eases toward the phase target
    const target = lerp(ph.halo[0], ph.halo[1], easeOut(t));
    state.halo += (target - state.halo) * 0.12;
    document.getElementById('meter-fill').style.width = (state.halo * 100).toFixed(1) + '%';

    // secured (cyan→gold) ramps on the first captured phase
    const securedTarget = ph.secured ? 1 : 0;
    state.secured += (securedTarget - state.secured) * 0.06;

    // settle + bloom
    state.settle += ((ph.settle || ph.processing || ph.confirmed ? 1 : 0) - state.settle) * 0.05;
    state.bloom += ((ph.confirmed ? 1 : 0) - state.bloom) * 0.08;

    // environment indicators climb in
    if (ph.climb) {
      INDICATORS.forEach((ind) => {
        const dot = document.querySelector('#pin-' + ind.key + ' .pindot');
        if (dot) dot.classList.toggle('on', t >= ind.at);
      });
    }

    // dynamic recenter copy near the end of the arc
    if (ph.recenter && t > 0.7) {
      const el = document.getElementById('instruction');
      if (el.textContent !== ph.recenter) el.textContent = ph.recenter;
    }

    // advance
    if (t >= 1 && state.phase < PHASES.length - 1) enterPhase(state.phase + 1);

    requestAnimationFrame(tick);
  }

  function haptic(pattern) {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try { navigator.vibrate(pattern); } catch (_) {}
    }
  }

  // ── public controls ──
  function begin() {
    if (state.started) return;
    state.started = true;
    document.getElementById('cta').classList.add('hidden');
    document.getElementById('indicators').style.opacity = '1';
    enterPhase(0);
    requestAnimationFrame(tick);
  }

  function restart() {
    Object.assign(state, {
      started: false, phase: -1, phaseStart: 0,
      halo: 0, secured: 0, settle: 0, bloom: 0,
    });
    INDICATORS.forEach((ind) => {
      const dot = document.querySelector('#pin-' + ind.key + ' .pindot');
      if (dot) dot.classList.remove('on');
    });
    document.getElementById('indicators').style.opacity = '0';
    document.getElementById('meter').style.opacity = '0';
    document.getElementById('meter-fill').style.width = '0%';
    document.getElementById('securedPill').classList.remove('on');
    document.getElementById('cta').classList.remove('hidden');
    setText('Create your Face Baseline.',
      'This helps TENKI recognize your natural steady state with higher precision.');
    makeParticles();
  }

  // ── boot ──
  function boot() {
    buildIndicators();
    initStarfield();
    initScanCanvas();
    makeParticles();
    window.addEventListener('resize', () => { initStarfield(); });
    requestAnimationFrame(render);
  }

  window.TENKI_ENROLL = { begin, restart };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
