/**
 * TENKI CORE — Soul Scan Enrollment (preview, live-camera)
 * ========================================================
 * A browser-walkable Face Baseline enrollment that reacts to the user's REAL
 * front camera, so the founder can feel the Face ID-grade ceremony on a phone
 * before the native (vision-camera) session exists.
 *
 * This is an event-driven FSM (not a time-script): capture phases advance on
 * live quality-gate passes, pause (never reset) on transient drops, and route
 * to a recovery state on sustained loss — mirroring the React Native machine in
 *   apps/mobile/features/face-baseline/machine/faceBaselineMachine.ts
 * and the per-phase gates in
 *   apps/mobile/features/face-baseline/utils/qualityThresholds.ts
 *
 * Detection is tiered, because iOS Safari has no FaceDetector:
 *   Tier A (FaceDetector present): real centering / coverage / face-lock + arc.
 *   Tier B (fallback): lighting + stillness gates are still real (frame sampling);
 *     centering uses a central-detail heuristic; lock + arc are guided/timed.
 *
 * PRIVACY: every frame is analyzed in-canvas, on-device. No frame, no pixel, no
 * derived biometric ever leaves the phone or touches the network. (CLAUDE.md hard rule.)
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
    caution: '#FFB81C',
  };

  // ── quality thresholds (preview-scaled; mirror the SPIRIT of qualityThresholds.ts) ──
  // First-baseline enrollment is STRICT on purpose (cf. STRICT_DELTA in mobile):
  // we would rather take a few extra seconds than lock a loose reference.
  const T = {
    brightnessMin: 0.34,
    brightnessMax: 0.97,
    uniformityMin: 0.50,
    motionStill: 0.16, // env / detect / neutral stillness ceiling
    motionNeutral: 0.15,
    motionArc: 0.36, // arc tolerates a gentle head turn
    motionStability: 0.13,
    centerOffsetMax: 0.30, // Tier A: normalized box-center offset
    coverageMin: 0.14, // Tier A: face box area fraction
    detailMin: 0.20, // Tier B: central-detail heuristic floor
  };

  // ── timing ──
  const ENV_HOLD_MS = 1500; // all three indicators must hold this long
  const DETECT_HOLD_MS = 900; // stable face/stillness before lock
  const LOCK_DWELL_MS = 700; // "Locked" beat before capture
  const NEUTRAL_MS = 3600; // full neutral progress at continuous pass
  const ARC_MS = 4200; // full arc (left+right) progress
  const STABILITY_MS = 3200;
  const PROCESSING_MS = 2800;
  const LOSS_MS = 2600; // sustained gate loss in a capture → retry
  const DETECT_LOSS_MS = 7000;

  // ── phase copy + visual flags (keyed by FSM step) ──
  const STEP = {
    intro: {
      instr: 'Create your Face Baseline.',
      sub: 'This helps TENKI recognize your natural steady state with higher precision.',
      accent: 'cyan',
    },
    permission_check: {
      instr: 'Enable your camera',
      sub: 'Frames are analyzed on-device and never leave your phone.',
      accent: 'cyan',
    },
    permission_denied: {
      instr: 'Camera access needed',
      sub: 'TENKI reads your steady state from the front camera. Nothing is uploaded.',
      accent: 'caution',
    },
    environment_check: {
      instr: 'Find even light, look ahead',
      sub: 'We’ll confirm three things before we begin.',
      accent: 'cyan',
    },
    face_detecting: {
      instr: 'Center your face',
      sub: 'Hold the phone at eye level.',
      accent: 'cyan',
    },
    face_locked: { instr: 'Locked', sub: '', accent: 'mint' },
    neutral_capture: {
      instr: 'Hold still',
      sub: 'Look naturally ahead — your steady state.',
      accent: 'gold', secured: true, meter: true,
    },
    arc_left: {
      instr: 'Turn slightly left',
      sub: 'Slow and gentle — small angles.',
      accent: 'gold', secured: true, meter: true, guide: -1,
    },
    arc_right: {
      instr: 'Turn slightly right',
      sub: 'Slow and gentle — small angles.',
      accent: 'gold', secured: true, meter: true, guide: 1,
      recenter: 'Return to center',
    },
    stability_pass: {
      instr: 'Breathe naturally',
      sub: 'Relax your jaw and let your eyes settle.',
      accent: 'gold', secured: true, meter: true, settle: true,
    },
    processing: {
      instr: 'Securing your unique baseline…',
      sub: 'All data is processed and stored locally for maximum privacy.',
      accent: 'gold', secured: true, processing: true,
    },
    baseline_confirmed: {
      instr: 'Baseline locked.',
      sub: 'Your future scans will compare against this personal reference.',
      accent: 'gold', secured: true, confirmed: true,
    },
    baseline_data: {
      instr: 'Baseline established',
      sub: 'This is your personal reference — not a score. Your daily scans compare against it.',
      accent: 'gold', secured: true, keepCore: true,
    },
    retry_needed: {
      instr: 'Let’s realign',
      sub: '',
      accent: 'caution',
    },
  };

  // FSM order for the linear happy path (capture progression).
  const ORDER = [
    'neutral_capture', 'arc_left', 'arc_right', 'stability_pass', 'processing', 'baseline_confirmed',
  ];

  const INDICATORS = [
    { key: 'lighting', label: 'Lighting' },
    { key: 'centering', label: 'Centering' },
    { key: 'stillness', label: 'Stillness' },
  ];

  // ── runtime state ──
  const state = {
    step: 'intro',
    stepStart: 0,
    started: false,
    stream: null,
    tierA: false, // FaceDetector available
    detector: null,
    face: null, // { cx, cy, area, ts } in normalized [0,1] frame coords (Tier A)
    // live quality signals (0–1)
    q: { brightness: 0, uniformity: 0, motion: 1, detail: 0, coverage: 0, centerOffset: 1 },
    gates: { lighting: false, centering: false, stillness: false },
    envHoldStart: 0,
    detectHoldStart: 0,
    lossStart: 0,
    // capture progress (0–1 each)
    neutral: 0, arc: 0, stability: 0,
    confSum: 0, confN: 0, // running aggregate for qualitative confidence band
    // visuals
    halo: 0, secured: 0, settle: 0, bloom: 0,
    raf: null, lastT: 0,
  };

  let ctx, scanCanvas;
  let particles = [];
  const VIEW = 320;

  // offscreen sampler for frame analysis
  const SAMP = 80;
  let sampler, sctx, prevLuma = null;

  // ── helpers ──
  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  const now = () => performance.now();

  function hexToRgb(h) {
    const n = parseInt(h.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function mix(c1, c2, t) {
    const a = hexToRgb(c1); const b = hexToRgb(c2);
    return `rgb(${Math.round(lerp(a[0], b[0], t))},${Math.round(lerp(a[1], b[1], t))},${Math.round(lerp(a[2], b[2], t))})`;
  }
  function accentColor(name) {
    return name === 'cyan' ? COLORS.cyan
      : name === 'mint' ? COLORS.mint
      : name === 'caution' ? COLORS.caution
      : COLORS.gold;
  }
  function haptic(pattern) {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try { navigator.vibrate(pattern); } catch (_) {}
    }
  }

  // ── weighted overall progress (mirrors captureProgress(): 0.5 / 0.3 / 0.2) ──
  function captureProgress() {
    return clamp01(state.neutral) * 0.5 + clamp01(state.arc) * 0.3 + clamp01(state.stability) * 0.2;
  }

  // ── qualitative confidence band (never a number/score — compliance) ──
  function confidenceBand() {
    const c = state.confN ? state.confSum / state.confN : 0;
    return c >= 0.8 ? 'strong' : c >= 0.6 ? 'steady' : 'usable';
  }

  // ── DOM bits ──
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
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random());
      particles.push({
        bx: Math.cos(a) * r * 62,
        by: Math.sin(a) * r * 80,
        phase: Math.random() * Math.PI * 2,
        speed: 0.6 + Math.random() * 0.8,
        size: 1.1 + Math.random() * 1.9,
        gold: Math.random() > 0.45,
      });
    }
  }

  // ── starfield ──
  let stars = [];
  function initStarfield() {
    const cv = document.getElementById('starfield');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = cv.clientWidth * dpr;
    cv.height = cv.clientHeight * dpr;
    const c = cv.getContext('2d');
    c.scale(dpr, dpr);
    stars = [];
    for (let i = 0; i < 90; i++) {
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
  function drawStarfield(t) {
    const cv = document.getElementById('starfield');
    const c = cv._ctx; if (!c) return;
    c.clearRect(0, 0, cv.clientWidth, cv.clientHeight);
    for (const s of stars) {
      const a = 0.25 + 0.55 * (0.5 + 0.5 * Math.sin(t * 0.001 * s.sp + s.tw));
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
    c.beginPath(); c.arc(cx, cy, radius, 0, Math.PI * 2);
    c.strokeStyle = 'rgba(255,255,255,0.06)'; c.lineWidth = 4; c.stroke();
    const start = -Math.PI / 2;
    const end = start + Math.PI * 2 * clamp01(progress);
    c.beginPath(); c.arc(cx, cy, radius, start, end);
    c.strokeStyle = color; c.lineWidth = 4.5; c.lineCap = 'round';
    c.shadowColor = color; c.shadowBlur = 18; c.stroke();
    c.beginPath();
    c.arc(cx + Math.cos(end) * radius, cy + Math.sin(end) * radius, 3.6, 0, Math.PI * 2);
    c.fillStyle = '#FFFFFF'; c.shadowBlur = 14; c.shadowColor = color; c.fill();
    c.restore();
  }

  function drawParticles(c, cx, cy, t) {
    const secured = state.secured;
    const settle = state.settle;
    const bloom = state.bloom;
    // anchor the mesh to the detected face center when we have one (Tier A)
    let ax = 0, ay = 0;
    if (state.face && now() - state.face.ts < 800) {
      ax = (state.face.cx - 0.5) * 120;
      ay = (state.face.cy - 0.5) * 150;
    }
    for (const p of particles) {
      const drift = state.started ? 1 : 0.4;
      const dx = Math.sin(t * 0.001 * p.speed + p.phase) * 4 * drift;
      const dy = Math.cos(t * 0.0011 * p.speed + p.phase) * 4 * drift;
      const k = clamp01(settle * 0.5 + bloom);
      const px = cx + lerp(p.bx + dx + ax, 0, k);
      const py = cy + lerp(p.by + dy + ay, 0, k);
      const pulse = 0.6 + 0.4 * Math.sin(t * 0.004 * p.speed + p.phase);
      const base = p.gold ? mix(COLORS.cyan, COLORS.gold, secured) : mix(COLORS.cyan, COLORS.goldChampagne, secured * 0.7);
      const size = p.size * (0.8 + pulse * 0.5) * (1 + bloom * 0.6);
      c.save();
      c.globalAlpha = 0.25 + 0.55 * pulse + bloom * 0.2;
      c.beginPath(); c.arc(px, py, size, 0, Math.PI * 2);
      c.fillStyle = base; c.shadowColor = base; c.shadowBlur = 6 + bloom * 14;
      c.fill();
      c.restore();
    }
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

  // gold orbital sphere for the "Securing your unique baseline…" processing screen
  function drawProcessingOrb(c, cx, cy, t) {
    c.save();
    const R = 74;
    // glass sphere body
    const sphere = c.createRadialGradient(cx - 18, cy - 22, 6, cx, cy, R);
    sphere.addColorStop(0, 'rgba(60,46,20,0.38)');
    sphere.addColorStop(0.7, 'rgba(20,14,6,0.22)');
    sphere.addColorStop(1, 'rgba(0,0,0,0)');
    c.beginPath(); c.arc(cx, cy, R, 0, Math.PI * 2); c.fillStyle = sphere; c.fill();
    c.beginPath(); c.arc(cx, cy, R, 0, Math.PI * 2);
    c.strokeStyle = 'rgba(255,200,94,0.18)'; c.lineWidth = 1.5; c.stroke();
    // 3 tilted orbiting gold rings, each with a travelling bright bead
    for (let k = 0; k < 3; k++) {
      const rot = t * 0.0006 * (k + 1) + k * 2.1;
      const rx = 66 - k * 6;
      const ry = 22 + k * 9;
      c.save();
      c.translate(cx, cy); c.rotate(rot);
      c.beginPath(); c.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
      c.strokeStyle = `rgba(255,200,94,${0.5 - k * 0.1})`;
      c.lineWidth = 2; c.shadowColor = COLORS.gold; c.shadowBlur = 12; c.stroke();
      const a = t * 0.002 * (k + 1.5);
      c.beginPath(); c.arc(Math.cos(a) * rx, Math.sin(a) * ry, 2.8, 0, Math.PI * 2);
      c.fillStyle = '#FFF0D0'; c.shadowBlur = 14; c.shadowColor = COLORS.gold; c.fill();
      c.restore();
    }
    // bright core
    const core = c.createRadialGradient(cx, cy, 0, cx, cy, 26);
    core.addColorStop(0, 'rgba(255,240,208,0.95)');
    core.addColorStop(0.5, 'rgba(255,200,94,0.6)');
    core.addColorStop(1, 'rgba(255,200,94,0)');
    c.beginPath(); c.arc(cx, cy, 26, 0, Math.PI * 2); c.fillStyle = core; c.fill();
    c.restore();
  }

  function drawGuide(c, cx, cy, dir, color) {
    c.save();
    c.translate(cx + dir * 120, cy);
    c.rotate(dir < 0 ? Math.PI : 0);
    c.strokeStyle = color; c.globalAlpha = 0.85; c.lineWidth = 3; c.lineCap = 'round';
    c.shadowColor = color; c.shadowBlur = 8;
    c.beginPath(); c.moveTo(-8, -8); c.lineTo(4, 0); c.lineTo(-8, 8); c.stroke();
    c.restore();
  }

  // ── render loop (visual only; logic lives in update()) ──
  function render(t) {
    drawStarfield(t);
    if (ctx) {
      ctx.clearRect(0, 0, VIEW, VIEW);
      const cx = VIEW / 2, cy = VIEW / 2;
      const ph = STEP[state.step] || STEP.intro;
      const accent = accentColor(ph.accent || 'cyan');
      const half = 92;

      ctx.save();
      roundedRect(ctx, cx - half, cy - half, half * 2, half * 2, 40);
      ctx.fillStyle = 'rgba(10,16,30,0.30)';
      ctx.fill();
      ctx.restore();

      drawParticles(ctx, cx, cy, t);
      if (ph.processing) drawProcessingOrb(ctx, cx, cy, t);
      drawCorners(ctx, cx, cy, half, accent, state.started ? 0.95 : 0.5);
      drawHalo(ctx, cx, cy, half + 26, state.halo, accent);
      if (ph.guide !== undefined && state.halo < 0.82) drawGuide(ctx, cx, cy, ph.guide, accent);
    }
    state.raf = requestAnimationFrame(render);
  }

  // ── camera + frame analysis ───────────────────────────────────────────────
  async function startCamera() {
    const video = document.getElementById('cam-video');
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 640 } },
      audio: false,
    });
    state.stream = stream;
    video.srcObject = stream;
    await video.play().catch(() => {});
    document.getElementById('cam-wrap').classList.add('live');

    // Tier detection (FaceDetector is Chrome/Edge-only; iOS Safari falls to Tier B)
    if ('FaceDetector' in window) {
      try {
        state.detector = new window.FaceDetector({ fastMode: true, maxDetectedFaces: 1 });
        state.tierA = true;
        runDetectLoop(video);
      } catch (_) { state.tierA = false; }
    }
  }

  function stopCamera() {
    if (state.stream) {
      state.stream.getTracks().forEach((tk) => tk.stop());
      state.stream = null;
    }
    document.getElementById('cam-wrap').classList.remove('live');
  }

  // Tier A: throttled async face detection → normalized box center + area.
  async function runDetectLoop(video) {
    if (!state.tierA || !state.stream) return;
    try {
      const faces = await state.detector.detect(video);
      if (faces && faces.length) {
        const b = faces[0].boundingBox;
        const vw = video.videoWidth || 640;
        const vh = video.videoHeight || 640;
        state.face = {
          cx: (b.x + b.width / 2) / vw,
          cy: (b.y + b.height / 2) / vh,
          area: (b.width * b.height) / (vw * vh),
          ts: now(),
        };
      }
    } catch (_) { /* detector hiccup — ignore this frame */ }
    if (state.stream) setTimeout(() => runDetectLoop(video), 150);
  }

  // Sample the video each frame → brightness, uniformity, motion, detail.
  function sampleFrame() {
    const video = document.getElementById('cam-video');
    if (!video || video.readyState < 2) return;
    try {
      sctx.drawImage(video, 0, 0, SAMP, SAMP);
    } catch (_) { return; }
    const data = sctx.getImageData(0, 0, SAMP, SAMP).data;
    const luma = new Float32Array(SAMP * SAMP);
    let sum = 0;
    // quadrant sums for uniformity
    const quad = [0, 0, 0, 0]; const quadN = (SAMP / 2) * (SAMP / 2);
    for (let y = 0; y < SAMP; y++) {
      for (let x = 0; x < SAMP; x++) {
        const i = (y * SAMP + x) * 4;
        const l = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        luma[y * SAMP + x] = l;
        sum += l;
        const qi = (y < SAMP / 2 ? 0 : 2) + (x < SAMP / 2 ? 0 : 1);
        quad[qi] += l;
      }
    }
    const mean = sum / (SAMP * SAMP);
    state.q.brightness = clamp01(mean / 255);

    const qm = quad.map((s) => s / quadN);
    const qMean = (qm[0] + qm[1] + qm[2] + qm[3]) / 4;
    const qSd = Math.sqrt(qm.reduce((a, v) => a + (v - qMean) * (v - qMean), 0) / 4);
    state.q.uniformity = clamp01(1 - qSd / 60);

    // motion: mean abs luma delta vs previous frame
    if (prevLuma) {
      let diff = 0;
      for (let i = 0; i < luma.length; i++) diff += Math.abs(luma[i] - prevLuma[i]);
      state.q.motion = clamp01((diff / luma.length) / 40);
    }
    prevLuma = luma;

    // central detail (Tier B centering heuristic): horizontal gradient in the middle box
    let grad = 0; let gN = 0;
    for (let y = 20; y < 60; y++) {
      for (let x = 20; x < 59; x++) {
        grad += Math.abs(luma[y * SAMP + x + 1] - luma[y * SAMP + x]);
        gN++;
      }
    }
    state.q.detail = clamp01((grad / gN) / 18);

    // centering / coverage
    if (state.tierA && state.face && now() - state.face.ts < 800) {
      const off = Math.hypot(state.face.cx - 0.5, state.face.cy - 0.5) * 2; // 0=centered
      state.q.centerOffset = clamp01(off);
      state.q.coverage = clamp01(state.face.area * 6); // box area → coarse coverage
    } else {
      state.q.centerOffset = 1;
      state.q.coverage = 0;
    }
  }

  // ── gate evaluation ─────────────────────────────────────────────────────
  function evalGates() {
    const q = state.q;
    const lighting = q.brightness >= T.brightnessMin && q.brightness <= T.brightnessMax
      && q.uniformity >= T.uniformityMin;
    const stillness = q.motion <= T.motionStill;
    let centering;
    if (state.tierA) {
      centering = q.centerOffset <= T.centerOffsetMax && q.coverage >= T.coverageMin;
    } else {
      // Tier B honest heuristic: something with facial structure sits in the center,
      // under good light. Not ML — guides the user toward a centered, framed pose.
      centering = q.detail >= T.detailMin && lighting;
    }
    state.gates = { lighting, centering, stillness };
    return state.gates;
  }

  // accumulate a coarse aggregate for the qualitative confidence band
  function sampleConfidence(motionCeil) {
    const q = state.q;
    const still = 1 - clamp01(q.motion / Math.max(0.01, motionCeil));
    const agg = 0.35 * still + 0.25 * q.brightness + 0.2 * q.uniformity
      + 0.2 * (state.tierA ? clamp01(1 - q.centerOffset) : q.detail);
    state.confSum += clamp01(agg);
    state.confN += 1;
  }

  // ── FSM transitions ───────────────────────────────────────────────────────
  function go(step) {
    state.step = step;
    state.stepStart = now();
    const ph = STEP[step];
    setText(ph.instr, ph.sub);
    document.getElementById('meter').style.opacity = ph.meter ? '1' : '0';
    document.getElementById('securedPill').classList.toggle('on', !!ph.secured);
    // baseline data snapshot panel (qualitative reference, Model B-honest)
    document.getElementById('proc-pct').classList.toggle('on', step === 'processing');
    const showBx = step === 'baseline_data';
    document.getElementById('baseline-extra').classList.toggle('on', showBx);
    if (showBx) {
      document.getElementById('bx-band-text').textContent = 'New baseline · signal ' + confidenceBand();
      document.getElementById('securedPill').textContent = '🔒 SECURED · NEW BASELINE';
    }
    setCta(ctaForStep(step));
    if (ph.confirmed) haptic([18, 40, 90]);
    else if (step === 'face_locked') haptic(28);
    else if (step === 'retry_needed') haptic([12, 30, 12]);
  }

  function ctaForStep(step) {
    if (step === 'permission_denied') return { label: 'Enable Camera', action: 'permission' };
    if (step === 'retry_needed') return { label: 'Resume', action: 'resume' };
    if (step === 'baseline_confirmed') return { label: 'See your baseline', action: 'baselineData' };
    if (step === 'baseline_data') return { label: 'Start your first scan', action: 'firstScan' };
    return null; // hidden — the camera drives progress
  }

  function setText(instr, sub) {
    document.getElementById('instruction').textContent = instr;
    document.getElementById('subtitle').textContent = sub || '';
  }
  function setCta(spec) {
    const cta = document.getElementById('cta');
    if (!spec) { cta.classList.add('hidden'); return; }
    cta.textContent = spec.label;
    cta.dataset.action = spec.action;
    cta.classList.remove('hidden');
  }

  // partial-retry: which phase to resume to (neutral restarts; arc/stability keep progress)
  let lastCaptureStep = 'neutral_capture';
  function toRetry(reason) {
    setText(STEP.retry_needed.instr, reason);
    go('retry_needed');
  }
  function resume() {
    if (lastCaptureStep === 'neutral_capture') state.neutral = 0;
    state.lossStart = 0;
    go(lastCaptureStep);
  }

  // ── logic update (per frame) ──────────────────────────────────────────────
  function update(t) {
    const dt = state.lastT ? t - state.lastT : 16;
    state.lastT = t;

    // visual easing toward step targets (always runs)
    const ph = STEP[state.step] || STEP.intro;
    const coreHeld = ph.confirmed || ph.keepCore;
    const isCapture = ph.secured && !coreHeld;
    const haloTarget = coreHeld ? 1
      : isCapture || ph.processing ? captureProgress()
      : state.step === 'face_locked' ? 0.04 : 0;
    state.halo += (haloTarget - state.halo) * 0.12;
    document.getElementById('meter-fill').style.width = (state.halo * 100).toFixed(1) + '%';
    state.secured += ((ph.secured ? 1 : 0) - state.secured) * 0.06;
    state.settle += ((ph.settle || ph.processing || coreHeld ? 1 : 0) - state.settle) * 0.05;
    state.bloom += ((coreHeld ? 1 : 0) - state.bloom) * 0.08;

    if (!state.started || !state.stream) return;

    sampleFrame();
    const g = evalGates();
    // live precision indicators reflect REAL gate state every frame
    INDICATORS.forEach((ind) => {
      const dot = document.querySelector('#pin-' + ind.key + ' .pindot');
      if (dot) dot.classList.toggle('on', !!g[ind.key]);
    });

    switch (state.step) {
      case 'environment_check': {
        const allPass = g.lighting && g.centering && g.stillness;
        if (allPass) {
          if (!state.envHoldStart) state.envHoldStart = t;
          if (t - state.envHoldStart >= ENV_HOLD_MS) { state.detectHoldStart = 0; go('face_detecting'); }
        } else {
          state.envHoldStart = 0;
        }
        break;
      }
      case 'face_detecting': {
        // Tier A: need a centered face; Tier B: stable, well-lit, still pose.
        const ok = state.tierA
          ? (g.centering && g.lighting)
          : (g.lighting && g.stillness && g.centering);
        if (ok) {
          if (!state.detectHoldStart) state.detectHoldStart = t;
          state.lossStart = 0;
          if (t - state.detectHoldStart >= DETECT_HOLD_MS) go('face_locked');
        } else {
          state.detectHoldStart = 0;
          if (!state.lossStart) state.lossStart = t;
          if (t - state.lossStart >= DETECT_LOSS_MS) { state.lossStart = 0; go('environment_check'); state.envHoldStart = 0; }
        }
        break;
      }
      case 'face_locked': {
        if (t - state.stepStart >= LOCK_DWELL_MS) { lastCaptureStep = 'neutral_capture'; go('neutral_capture'); }
        break;
      }
      case 'neutral_capture': {
        lastCaptureStep = 'neutral_capture';
        const pass = g.lighting && g.stillness && (state.tierA ? g.centering : true) && state.q.motion <= T.motionNeutral;
        captureTick(pass, 'neutral', NEUTRAL_MS, dt, T.motionNeutral, () => { go('arc_left'); });
        break;
      }
      case 'arc_left': {
        lastCaptureStep = 'arc_left';
        const pass = g.lighting && state.q.motion <= T.motionArc && (state.tierA ? state.q.coverage >= T.coverageMin : g.centering);
        // arc_left fills the first half of arcProgress
        captureTick(pass, 'arc', ARC_MS, dt, T.motionArc, () => { go('arc_right'); }, 0.5);
        break;
      }
      case 'arc_right': {
        lastCaptureStep = 'arc_right';
        const pass = g.lighting && state.q.motion <= T.motionArc && (state.tierA ? state.q.coverage >= T.coverageMin : g.centering);
        if (STEP.arc_right.recenter && state.arc > 0.9) {
          const el = document.getElementById('instruction');
          if (el.textContent !== STEP.arc_right.recenter) el.textContent = STEP.arc_right.recenter;
        }
        captureTick(pass, 'arc', ARC_MS, dt, T.motionArc, () => { go('stability_pass'); }, 1.0);
        break;
      }
      case 'stability_pass': {
        lastCaptureStep = 'stability_pass';
        const pass = g.lighting && g.stillness && state.q.motion <= T.motionStability && (state.tierA ? g.centering : true);
        captureTick(pass, 'stability', STABILITY_MS, dt, T.motionStability, () => { go('processing'); });
        break;
      }
      case 'processing': {
        const pp = clamp01((t - state.stepStart) / PROCESSING_MS);
        const numEl = document.getElementById('proc-pct-num');
        if (numEl) numEl.textContent = String(Math.round(pp * 100));
        if (pp >= 1) {
          stopCamera();
          updateConfidenceCopy();
          go('baseline_confirmed');
        }
        break;
      }
      default: break; // intro / permission_* / face? handled by controls; confirmed/retry idle
    }
  }

  // accrue one capture phase's progress while `pass`, pause (not reset) otherwise,
  // and route to retry on sustained loss. `cap` bounds arc sub-phases (0.5 / 1.0).
  function captureTick(pass, key, fullMs, dt, motionCeil, onDone, cap) {
    if (pass) {
      state.lossStart = 0;
      sampleConfidence(motionCeil);
      const next = Math.min(cap || 1, clamp01(state[key] + dt / fullMs));
      state[key] = next;
      if (next >= (cap || 1) - 1e-3) onDone();
    } else {
      if (!state.lossStart) state.lossStart = now();
      if (now() - state.lossStart >= LOSS_MS) {
        state.lossStart = 0;
        toRetry(retryReason());
      }
    }
  }

  function retryReason() {
    const q = state.q;
    if (q.brightness < T.brightnessMin) return 'A little more light, then we’ll continue.';
    if (q.motion > T.motionStill) return 'Hold steady — we’ll pick up right where you were.';
    return 'Re-center your face and we’ll resume.';
  }

  function updateConfidenceCopy() {
    // qualitative only — never a numeric score (compliance)
    const pill = document.getElementById('securedPill');
    if (pill) pill.textContent = '🔒 SECURED · SIGNAL ' + confidenceBand().toUpperCase();
  }

  // ── public controls ──
  async function begin() {
    if (state.started) return;
    state.started = true;
    document.getElementById('cta').classList.add('hidden');
    document.getElementById('indicators').style.opacity = '1';
    go('permission_check');
    try {
      await startCamera();
      state.envHoldStart = 0;
      go('environment_check');
    } catch (_) {
      go('permission_denied');
    }
  }

  function onCta() {
    const action = document.getElementById('cta').dataset.action;
    if (action === 'permission') { state.started = false; begin(); }
    else if (action === 'resume') { resume(); }
    else if (action === 'baselineData') { go('baseline_data'); }
    else if (action === 'firstScan') {
      // Model B: face baseline done → hand off to the v6 stardust Soul Scan + Today reveal
      stopCamera();
      window.location.href = '/preview/v6/?from=baseline';
    }
    else { begin(); }
  }

  function restart() {
    stopCamera();
    Object.assign(state, {
      step: 'intro', stepStart: 0, started: false, tierA: false, detector: null, face: null,
      q: { brightness: 0, uniformity: 0, motion: 1, detail: 0, coverage: 0, centerOffset: 1 },
      gates: { lighting: false, centering: false, stillness: false },
      envHoldStart: 0, detectHoldStart: 0, lossStart: 0,
      neutral: 0, arc: 0, stability: 0, confSum: 0, confN: 0,
      halo: 0, secured: 0, settle: 0, bloom: 0, lastT: 0,
    });
    prevLuma = null;
    INDICATORS.forEach((ind) => {
      const dot = document.querySelector('#pin-' + ind.key + ' .pindot');
      if (dot) dot.classList.remove('on');
    });
    document.getElementById('indicators').style.opacity = '0';
    document.getElementById('meter').style.opacity = '0';
    document.getElementById('meter-fill').style.width = '0%';
    const pill = document.getElementById('securedPill');
    pill.classList.remove('on');
    pill.textContent = '🔒 PRIVACY SECURED · ON-DEVICE';
    document.getElementById('baseline-extra').classList.remove('on');
    document.getElementById('proc-pct').classList.remove('on');
    setText(STEP.intro.instr, STEP.intro.sub);
    setCta({ label: 'Begin', action: 'begin' });
    makeParticles();
  }

  // ── boot ──
  function loop(t) {
    update(t);
    requestAnimationFrame(loop);
  }

  function boot() {
    buildIndicators();
    initStarfield();
    initScanCanvas();
    makeParticles();
    sampler = document.createElement('canvas');
    sampler.width = SAMP; sampler.height = SAMP;
    sctx = sampler.getContext('2d', { willReadFrequently: true });
    // route the static HTML CTA through the state-aware handler
    const cta = document.getElementById('cta');
    cta.dataset.action = 'begin';
    cta.onclick = onCta;
    window.addEventListener('resize', () => { initStarfield(); });
    requestAnimationFrame(render);
    requestAnimationFrame(loop);
  }

  window.TENKI_ENROLL = { begin, restart };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
