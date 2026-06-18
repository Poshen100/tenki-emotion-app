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
    motionStill: 0.40, // env / detect stillness ceiling (handheld-realistic)
    motionNeutral: 0.36,
    motionArc: 0.62, // arc tolerates a gentle head turn
    motionStability: 0.30,
    centerOffsetMax: 0.30, // Tier A: normalized box-center offset
    coverageMin: 0.14, // Tier A: face box area fraction
    detailMin: 0.20, // Tier B: central-detail heuristic floor
  };

  // ── timing ──
  const ENV_HOLD_MS = 1100; // all three indicators must hold this long
  const ENV_FALLBACK_MS = 6000; // safety: with Lighting OK, proceed even if a gate stays noisy
  const DETECT_HOLD_MS = 900; // stable face/stillness before lock
  const LOCK_DWELL_MS = 700; // "Locked" beat before capture
  const NEUTRAL_MS = 3600; // full neutral progress at continuous pass
  const ARC_MS = 4200; // full arc (left+right) progress
  const STABILITY_MS = 3200;
  const PROCESSING_MS = 2800;
  const LOSS_MS = 2600; // sustained gate loss in a capture → retry
  const DETECT_LOSS_MS = 7000;

  // ── Guided Lock-On alignment (face_detecting): generous, magnetic, never dead-ends ──
  const ALIGN = {
    distMin: 0.085, distMax: 0.22, // inter-ocular dist (frame frac): closer/back band
    centerMax: 0.26, // centroid offset tolerance
    rollMax: 9, yawMax: 0.18, pitchMax: 12, // head level: tilt (deg) + frontal yaw + nod (deg)
    eyeOpenMin: 0.45, holdMs: 350, // eyes open; each target must hold this long to lock
  };
  const ALIGN_KEYS = ['distance', 'center', 'level', 'eyes'];
  const ALIGN_FALLBACK_MS = 9000; // safety: proceed if present+centered this long

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
    mpActive: false, // MediaPipe landmarks driving centering this frame
    lm: { present: false, yaw: 0, centerOffset: 1, coverage: 0, cx: 0.5, cy: 0.5, dist: 0, roll: 0, pitch: 0, eyeOpen: 1 },
    // Guided Lock-On alignment: per-target hold/lock, progress, nudge debounce, reward flash
    alignHold: {}, alignLocked: {}, alignProg: 0, shownNudge: '', candNudge: '', candSince: 0, alignFlash: 0,
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

  // ── 3D landmark model (MediaPipe FaceLandmarker + Three.js) ──────────────
  // Progressive enhancement of the capture phases: when the depth engine is
  // ready we render the user as an abstract glowing 3D point cloud + mesh
  // (never the real face) and drive centering from real landmarks. If it can't
  // load (e.g. CDN blocked), the proven 2D stardust flow remains unchanged.
  const M3D_PHASES = new Set([
    'face_detecting', 'face_locked', 'neutral_capture', 'arc_left', 'arc_right', 'stability_pass',
  ]);
  const M3D = { SCALE: 2.4, DEPTH: 1.5, SMOOTH: 0.4, K: 2 };
  const MP_WASM = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.12/wasm';
  const MP_MODEL =
    'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
  // "Ghost Protocol" particle lattice: ~6k bloom-lit diamond data-nodes densified
  // along the face tessellation, with a cyberpunk shader (rim + scanlines + glitch).
  const m3d = {
    ready: false, booting: false, landmarker: null, lastVideoTime: -1, seen: false, N: 478,
    renderer: null, scene: null, camera: null, group: null, points: null, pmat: null, composer: null,
    P: 0, pPos: null, pScatter: null, pRnd: null, aIdx: null, bIdx: null, tArr: null,
    lmCur: null, lmTarget: null, glitch: 0, prevYaw: 0,
  };

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

  // gold orbital sphere for the "Securing your unique baseline…" processing screen.
  // Volumetric glass look: single virtual light (upper-left) drives a lit body, a
  // lower-right inner shadow, a fresnel rim, a specular hotspot + glass crescent;
  // the three orbit rings are depth-sorted (far arcs dim & behind the core, near
  // arcs bright & over it) with depth-scaled travelling beads.
  function drawProcessingOrb(c, cx, cy, t) {
    c.save();
    const R = 76;
    const lx = cx - R * 0.4, ly = cy - R * 0.45; // virtual light source (upper-left)
    const rings = [[70, 24], [61, 32], [52, 17]];
    const ringRot = (k) => t * 0.00055 * (k + 1) + k * 2.1;
    const drawArc = (k, front) => {
      const [rx, ry] = rings[k];
      c.save(); c.translate(cx, cy); c.rotate(ringRot(k));
      c.beginPath();
      if (front) c.ellipse(0, 0, rx, ry, 0, 0, Math.PI);
      else c.ellipse(0, 0, rx, ry, 0, Math.PI, Math.PI * 2);
      c.strokeStyle = front ? `rgba(255,212,128,${0.62 - k * 0.08})` : `rgba(255,190,90,${0.18 - k * 0.03})`;
      c.lineWidth = front ? 2.4 : 1.3;
      c.lineCap = 'round'; c.shadowColor = COLORS.gold; c.shadowBlur = front ? 14 : 6;
      c.stroke();
      c.restore();
    };

    // outer bloom behind the glass
    const glow = c.createRadialGradient(cx, cy, R * 0.35, cx, cy, R * 1.7);
    glow.addColorStop(0, 'rgba(255,200,94,0.22)');
    glow.addColorStop(1, 'rgba(255,200,94,0)');
    c.fillStyle = glow; c.beginPath(); c.arc(cx, cy, R * 1.7, 0, Math.PI * 2); c.fill();

    // volumetric glass body — lit upper-left, falling to transparent at the rim
    const body = c.createRadialGradient(lx, ly, R * 0.1, cx, cy, R * 1.04);
    body.addColorStop(0, 'rgba(92,70,32,0.44)');
    body.addColorStop(0.55, 'rgba(34,24,10,0.30)');
    body.addColorStop(0.9, 'rgba(10,7,3,0.16)');
    body.addColorStop(1, 'rgba(0,0,0,0)');
    c.beginPath(); c.arc(cx, cy, R, 0, Math.PI * 2); c.fillStyle = body; c.fill();

    // contain the interior (orbits, core, highlights) inside the glass
    c.save();
    c.beginPath(); c.arc(cx, cy, R, 0, Math.PI * 2); c.clip();

    // lower-right inner shadow → spherical volume
    const shade = c.createRadialGradient(cx + R * 0.4, cy + R * 0.45, R * 0.1, cx, cy, R);
    shade.addColorStop(0, 'rgba(0,0,0,0.32)');
    shade.addColorStop(0.7, 'rgba(0,0,0,0)');
    c.fillStyle = shade; c.beginPath(); c.arc(cx, cy, R, 0, Math.PI * 2); c.fill();

    for (let k = 0; k < 3; k++) drawArc(k, false); // far arcs (behind core)

    // hot core
    const core = c.createRadialGradient(cx, cy, 0, cx, cy, 30);
    core.addColorStop(0, 'rgba(255,255,246,0.98)');
    core.addColorStop(0.35, 'rgba(255,236,180,0.85)');
    core.addColorStop(0.7, 'rgba(255,196,90,0.42)');
    core.addColorStop(1, 'rgba(255,196,90,0)');
    c.beginPath(); c.arc(cx, cy, 30, 0, Math.PI * 2); c.fillStyle = core; c.fill();

    for (let k = 0; k < 3; k++) drawArc(k, true); // near arcs (over core)

    // travelling beads, scaled/faded by orbit depth (front brighter & larger)
    for (let k = 0; k < 3; k++) {
      const [rx, ry] = rings[k];
      const a = t * 0.0019 * (k + 1.4);
      c.save(); c.translate(cx, cy); c.rotate(ringRot(k));
      const bx = Math.cos(a) * rx, by = Math.sin(a) * ry;
      const depth = (by / ry) * 0.5 + 0.5; // 0 = far, 1 = near
      c.globalAlpha = 0.45 + depth * 0.55;
      c.beginPath(); c.arc(bx, by, 2.2 + depth * 1.6, 0, Math.PI * 2);
      c.fillStyle = '#FFF6E2'; c.shadowBlur = 12; c.shadowColor = COLORS.gold; c.fill();
      c.restore();
    }

    // specular hotspot (glossy reflection of the light)
    const spec = c.createRadialGradient(lx, ly, 0, lx, ly, R * 0.5);
    spec.addColorStop(0, 'rgba(255,255,255,0.5)');
    spec.addColorStop(0.5, 'rgba(255,245,220,0.1)');
    spec.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = spec; c.beginPath(); c.arc(lx, ly, R * 0.5, 0, Math.PI * 2); c.fill();

    // thin glass crescent along the upper-left edge
    c.beginPath(); c.arc(cx, cy, R * 0.84, Math.PI * 1.04, Math.PI * 1.52);
    c.strokeStyle = 'rgba(255,255,255,0.42)'; c.lineWidth = 2.2; c.lineCap = 'round';
    c.shadowColor = 'rgba(255,255,255,0.6)'; c.shadowBlur = 6; c.stroke();
    c.restore(); // end clip

    // fresnel rim (bright glass edge), drawn over the clip boundary
    c.beginPath(); c.arc(cx, cy, R, 0, Math.PI * 2);
    c.strokeStyle = 'rgba(255,224,152,0.32)'; c.lineWidth = 1.4;
    c.shadowColor = COLORS.gold; c.shadowBlur = 8; c.stroke();
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

  // round glow sprite for the 3D points / core
  // lazily boot the WebGL scene + load the landmarker once the ESM bundles are on window
  function ensureModel3D() {
    if (m3d.ready || m3d.booting) return;
    if (!(window.THREE && window.TENKI_MP)) { setTimeout(ensureModel3D, 200); return; }
    m3d.booting = true;
    try {
      initModel3D();
      loadLandmarker();
    } catch (_) { m3d.booting = false; }
  }

  // densify the face tessellation into ~6k particles (edge-interpolated data nodes)
  function buildM3DParticles() {
    const tess = window.TENKI_MP.FaceLandmarker.FACE_LANDMARKS_TESSELATION || [];
    const a = [], b = [], tt = [];
    for (let i = 0; i < m3d.N; i++) { a.push(i); b.push(i); tt.push(0); }
    for (const e of tess) for (let k = 0; k < M3D.K; k++) { a.push(e.start); b.push(e.end); tt.push((k + 1) / (M3D.K + 1)); }
    m3d.P = a.length;
    m3d.aIdx = new Uint16Array(a); m3d.bIdx = new Uint16Array(b); m3d.tArr = new Float32Array(tt);
    m3d.pPos = new Float32Array(m3d.P * 3); m3d.pRnd = new Float32Array(m3d.P);
    for (let i = 0; i < m3d.P; i++) m3d.pRnd[i] = Math.random();
  }

  // cyberpunk particle shader: diamond nodes + edge rim + sweeping scanlines + glitch.
  // Honors the visual law (cyan = ACTIVE → gold = SECURED via uMix = state.secured).
  function m3dMaterial(THREE, pr) {
    return new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 }, uSize: { value: 8.5 * pr }, uScanY: { value: 0 }, uMix: { value: 0 }, uGlitch: { value: 0 },
        uColorA: { value: new THREE.Color(COLORS.cyan) }, uColorB: { value: new THREE.Color(COLORS.gold) },
        uScanCol: { value: new THREE.Color('#FF6A00') }, uRim: { value: new THREE.Color('#9bf6ff') },
      },
      vertexShader: `
        attribute float aRnd;
        uniform float uTime, uSize, uScanY, uMix, uGlitch;
        uniform vec3 uColorA, uColorB, uScanCol, uRim;
        varying vec3 vColor; varying float vA;
        float hash(float n){ return fract(sin(n) * 43758.5453); }
        void main() {
          vec3 p = position;
          if (uGlitch > 0.001) {
            float h = hash(dot(p.xy, vec2(12.9898, 78.233)) + floor(uTime * 28.0));
            p.x += (h - 0.5) * uGlitch * 0.26;
            p.y += (hash(h * 7.0) - 0.5) * uGlitch * 0.18;
          }
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          float depth = clamp(p.z * 0.6 + 0.5, 0.0, 1.0);
          float lit = 0.45 + 0.55 * depth;
          float twk = 0.8 + 0.2 * sin(uTime * 3.0 + aRnd * 6.283);
          float rim = smoothstep(0.55, 1.05, length(p.xy));
          float band = 0.0;
          for (int i = 0; i < 3; i++) {
            float yk = -1.4 + fract(uScanY + float(i) * 0.34) * 2.8;
            band = max(band, smoothstep(0.05, 0.0, abs(p.y - yk)));
          }
          vec3 base = mix(uColorA, uColorB, uMix) * lit * twk + uRim * rim * 0.55;
          vColor = mix(base, uScanCol, band * 0.9);
          vA = (0.4 + 0.6 * depth) * (1.0 + band * 0.8);
          gl_PointSize = uSize * (1.0 / -mv.z) * (0.6 + 0.7 * depth) * (1.0 + band * 1.6 + rim * 0.4);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        varying vec3 vColor; varying float vA;
        void main() {
          vec2 q = abs(gl_PointCoord - 0.5);
          float dd = q.x + q.y;
          float edge = smoothstep(0.5, 0.12, dd);
          float core = smoothstep(0.16, 0.0, dd);
          gl_FragColor = vec4(vColor + core * 0.7, max(edge * 0.7, core) * vA);
        }`,
    });
  }

  function initModel3D() {
    const THREE = window.THREE;
    const host = document.getElementById('model3d');
    const w = host.clientWidth || 300;
    const h = host.clientHeight || 300;
    const pr = Math.min(window.devicePixelRatio || 1, 2);
    m3d.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    m3d.renderer.setPixelRatio(pr);
    m3d.renderer.setSize(w, h);
    m3d.renderer.setClearColor(0x000000, 0);
    host.appendChild(m3d.renderer.domElement);

    m3d.scene = new THREE.Scene();
    m3d.camera = new THREE.PerspectiveCamera(46, w / h, 0.1, 100);
    m3d.camera.position.set(0, 0, 3);
    m3d.group = new THREE.Group();
    m3d.scene.add(m3d.group);

    m3d.lmCur = new Float32Array(m3d.N * 3);
    m3d.lmTarget = new Float32Array(m3d.N * 3);
    buildM3DParticles();
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(m3d.pPos, 3));
    geo.setAttribute('aRnd', new THREE.BufferAttribute(m3d.pRnd, 1));
    m3d.pmat = m3dMaterial(THREE, pr);
    m3d.points = new THREE.Points(geo, m3d.pmat);
    m3d.points.frustumCulled = false;
    m3d.group.add(m3d.points);

    // bloom postprocessing if the addons loaded; otherwise plain render (still upgraded)
    const POST = window.TENKI_POST;
    if (POST && POST.EffectComposer) {
      try {
        m3d.composer = new POST.EffectComposer(m3d.renderer);
        m3d.composer.setPixelRatio(Math.min(pr, 1.5));
        m3d.composer.setSize(w, h);
        m3d.composer.addPass(new POST.RenderPass(m3d.scene, m3d.camera));
        m3d.composer.addPass(new POST.UnrealBloomPass(new THREE.Vector2(w, h), 0.95, 0.3, 0.2));
      } catch (_) { m3d.composer = null; }
    }
    m3d.ready = true;
  }

  async function loadLandmarker() {
    const { FaceLandmarker, FilesetResolver } = window.TENKI_MP;
    const fileset = await FilesetResolver.forVisionTasks(MP_WASM);
    const mk = (delegate) =>
      FaceLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MP_MODEL, delegate },
        runningMode: 'VIDEO', numFaces: 1,
        outputFaceBlendshapes: true, // eye-openness / blink → alignment + liveness
        outputFacialTransformationMatrixes: true, // 4×4 head pose → true pitch (chin up/down)
      });
    try { m3d.landmarker = await mk('GPU'); } catch (_) { m3d.landmarker = await mk('CPU'); }
  }

  // run inference + derive centering/yaw signals (called during capture phases)
  function detectLandmarks(video, t) {
    if (!m3d.landmarker || !video || video.readyState < 2) return;
    if (video.currentTime === m3d.lastVideoTime) return;
    m3d.lastVideoTime = video.currentTime;
    let res;
    try { res = m3d.landmarker.detectForVideo(video, t); } catch (_) { return; }
    if (res && res.faceLandmarks && res.faceLandmarks.length) {
      ingestLandmarks(res.faceLandmarks[0], res);
      state.lm.present = true;
    } else {
      state.lm.present = false;
    }
  }

  function ingestLandmarks(L, res) {
    const N = L.length;
    m3d.N = N;
    let cx = 0, cy = 0, cz = 0, minx = 1, maxx = 0, miny = 1, maxy = 0;
    for (let i = 0; i < N; i++) {
      cx += L[i].x; cy += L[i].y; cz += L[i].z;
      if (L[i].x < minx) minx = L[i].x; if (L[i].x > maxx) maxx = L[i].x;
      if (L[i].y < miny) miny = L[i].y; if (L[i].y > maxy) maxy = L[i].y;
    }
    cx /= N; cy /= N; cz /= N;
    const tgt = m3d.lmTarget;
    for (let i = 0; i < N; i++) {
      const j = i * 3;
      tgt[j] = -(L[i].x - cx) * M3D.SCALE; // mirror X (selfie)
      tgt[j + 1] = -(L[i].y - cy) * M3D.SCALE;
      tgt[j + 2] = -(L[i].z - cz) * M3D.SCALE * M3D.DEPTH;
    }
    if (!m3d.seen) { for (let i = 0; i < N * 3; i++) m3d.lmCur[i] = tgt[i]; m3d.seen = true; }
    const nose = L[1], le = L[33], re = L[263];
    const span = Math.abs(re.x - le.x) || 1e-3;
    const yaw = (nose.x - (le.x + re.x) / 2) / span;
    m3d.glitch = Math.min(1, m3d.glitch + Math.abs(yaw - m3d.prevYaw) * 9); // head-turn → glitch pulse
    m3d.prevYaw = yaw;
    state.lm.yaw = yaw;
    state.lm.centerOffset = clamp01(Math.hypot(cx - 0.5, cy - 0.5) * 2);
    state.lm.coverage = clamp01((maxx - minx) * (maxy - miny) * 4);
    // ── alignment signals (Guided Lock-On) ──
    state.lm.cx = cx; state.lm.cy = cy;
    state.lm.dist = Math.hypot(re.x - le.x, re.y - le.y); // inter-ocular dist (frame frac) → distance
    state.lm.roll = (Math.atan2(re.y - le.y, re.x - le.x) * 180) / Math.PI; // head tilt, 0 = level
    // eye-openness from blendshapes (1 = open) — eyes-open gate + liveness
    let eyeOpen = 1;
    const bs = res && res.faceBlendshapes && res.faceBlendshapes[0];
    if (bs && bs.categories) {
      let bl = 0, br = 0;
      for (const c of bs.categories) {
        if (c.categoryName === 'eyeBlinkLeft') bl = c.score;
        else if (c.categoryName === 'eyeBlinkRight') br = c.score;
      }
      eyeOpen = 1 - Math.max(bl, br);
    }
    state.lm.eyeOpen = eyeOpen;
    // ── true head pitch (nod, chin up/down) from the 4×4 facial transform matrix ──
    // Column-major (the layout Three.js Matrix4.fromArray consumes); element (row r,col c)=d[c*4+r].
    // pitch≈atan2(-r21,r22): ~0 frontal, grows with a nod. The gate uses |pitch|, so the
    // decomposition sign/convention is moot — only the deviation magnitude matters near frontal.
    let pitch = 0;
    const mx = res && res.facialTransformationMatrixes && res.facialTransformationMatrixes[0];
    const d = mx && mx.data;
    if (d && d.length >= 11) {
      pitch = (Math.atan2(-d[6], d[10]) * 180) / Math.PI;
    }
    state.lm.pitch = pitch;
  }

  function m3dActivePhase() { return m3d.ready && m3d.seen && M3D_PHASES.has(state.step); }

  // agent HUD readouts (cyberpunk flavor) — NODES = particle count, SYNC = capture progress
  let hudBin = 0;
  function updateHud() {
    const nodesEl = document.getElementById('hud-nodes');
    if (nodesEl) nodesEl.textContent = (m3d.ready && m3d.P ? m3d.P : 5842).toLocaleString('en-US');
    const syncEl = document.getElementById('hud-sync');
    if (syncEl) syncEl.textContent = (captureProgress() * 100).toFixed(1) + '%';
    if ((hudBin = (hudBin + 1) % 6) === 0) {
      const b = document.getElementById('hud-binary');
      if (b) { let s = ''; for (let i = 0; i < 10; i++) s += Math.random() > 0.5 ? '1' : '0'; b.textContent = s; }
    }
  }

  function renderModel3D(t) {
    const host = document.getElementById('model3d');
    if (!m3d.ready) { if (host) host.classList.remove('on'); return; }
    const show = m3dActivePhase();
    host.classList.toggle('on', show);
    // hide the real-camera preview while the abstract model is shown (privacy + focus);
    // when not showing 3D, let the .live class control it (2D fallback keeps the preview)
    const cam = document.getElementById('cam-wrap');
    if (cam) cam.style.opacity = show ? '0' : '';
    if (!show) return;
    // smooth landmarks, then place each particle by lerping along its tessellation edge
    const lc = m3d.lmCur, lt = m3d.lmTarget;
    for (let i = 0; i < m3d.N * 3; i++) lc[i] += (lt[i] - lc[i]) * M3D.SMOOTH;
    const pos = m3d.pPos;
    for (let i = 0; i < m3d.P; i++) {
      const a = m3d.aIdx[i] * 3, b = m3d.bIdx[i] * 3, tt = m3d.tArr[i], j = i * 3;
      pos[j] = lc[a] + (lc[b] - lc[a]) * tt;
      pos[j + 1] = lc[a + 1] + (lc[b + 1] - lc[a + 1]) * tt;
      pos[j + 2] = lc[a + 2] + (lc[b + 2] - lc[a + 2]) * tt;
    }
    m3d.points.geometry.attributes.position.needsUpdate = true;

    m3d.glitch *= 0.88;
    const u = m3d.pmat.uniforms;
    u.uTime.value = t * 0.001;
    u.uMix.value = state.secured; // cyan (ACTIVE) → gold (SECURED)
    // lattice "comes into focus": scattered/glitchy when misaligned, crisp as you lock on
    const misalign = state.step === 'face_detecting' ? (1 - state.alignProg) * 0.5 : 0;
    u.uGlitch.value = Math.max(m3d.glitch, misalign);
    u.uScanY.value = t * 0.00035;
    m3d.group.rotation.y = Math.sin(t * 0.0004) * 0.1; // gentle idle sway

    if (m3d.composer) m3d.composer.render();
    else m3d.renderer.render(m3d.scene, m3d.camera);
  }

  // ── Guided Lock-On helpers ────────────────────────────────────────────────
  // which alignment targets currently pass (instantaneous)
  function alignChecks(g) {
    const lm = state.lm;
    const present = !!(state.mpActive && lm.present);
    return {
      present,
      light: g.lighting,
      distance: present && lm.dist >= ALIGN.distMin && lm.dist <= ALIGN.distMax,
      center: present && lm.centerOffset <= ALIGN.centerMax,
      level: present && Math.abs(lm.roll) <= ALIGN.rollMax && Math.abs(lm.yaw) <= ALIGN.yawMax
        && Math.abs(lm.pitch) <= ALIGN.pitchMax,
      eyes: present && lm.eyeOpen >= ALIGN.eyeOpenMin && g.stillness,
    };
  }

  // the single most-important correction (priority order), warm + child-readable copy
  function pickAlignNudge(c) {
    const lm = state.lm;
    if (!c.present) return { key: 'find', instr: 'Bring your face into view', sub: 'Hold the phone at eye level.' };
    if (!c.light) return { key: 'light', instr: 'Find brighter, even light', sub: 'Face a window or a lamp.' };
    if (!c.distance) return lm.dist < ALIGN.distMin
      ? { key: 'closer', instr: 'Come a little closer', sub: 'Fill the circle with your face.' }
      : { key: 'back', instr: 'Move back a little', sub: 'Give your face some room.' };
    if (!c.center) return { key: 'center', instr: 'Move into the circle', sub: 'Line the dot up with the centre.' };
    if (!c.level) {
      // dominant off-axis → sign-safe sub-copy (no "raise vs lower" guess)
      const eRoll = Math.abs(lm.roll) / ALIGN.rollMax;
      const eYaw = Math.abs(lm.yaw) / ALIGN.yawMax;
      const ePitch = Math.abs(lm.pitch) / ALIGN.pitchMax;
      const sub = ePitch >= eRoll && ePitch >= eYaw ? 'Keep your chin level — not up or down.'
        : eYaw >= eRoll ? 'Face the camera straight on.'
        : 'Keep your head upright.';
      return { key: 'level', instr: 'Look straight, keep level', sub };
    }
    if (!c.eyes) return lm.eyeOpen < ALIGN.eyeOpenMin
      ? { key: 'eyes', instr: 'Keep your eyes open', sub: 'Relax and look ahead.' }
      : { key: 'hold', instr: 'Hold still', sub: 'Almost there — steady.' };
    return { key: 'good', instr: 'Perfect — hold it', sub: 'Locking on…' };
  }

  // per-frame alignment driver: lock targets (hysteresis + reward), debounced single nudge, gate proceed
  function runAlign(t, g) {
    const c = alignChecks(g);
    let locked = 0;
    for (const k of ALIGN_KEYS) {
      if (c[k]) {
        if (!state.alignHold[k]) state.alignHold[k] = t;
        if (t - state.alignHold[k] >= ALIGN.holdMs && !state.alignLocked[k]) {
          state.alignLocked[k] = true; state.alignFlash = t; haptic(18); // sub-lock reward
        }
      } else {
        state.alignHold[k] = 0; state.alignLocked[k] = false;
      }
      if (state.alignLocked[k]) locked++;
    }
    state.alignProg = locked / ALIGN_KEYS.length;

    // single nudge, debounced so copy doesn't flicker between corrections
    const n = pickAlignNudge(c);
    if (n.key !== state.shownNudge) {
      if (state.candNudge !== n.key) { state.candNudge = n.key; state.candSince = t; }
      if (t - state.candSince >= 220) { state.shownNudge = n.key; setText(n.instr, n.sub); }
    }

    if ((locked >= ALIGN_KEYS.length && c.light) ||
        (c.present && t - state.stepStart >= ALIGN_FALLBACK_MS)) {
      haptic([18, 40, 90]); // full lock-on reward
      go('face_locked');
    }
  }

  // alignment overlay: lock pips + "move the dot into the circle" + reward flash
  function drawAlignOverlay(c, cx, cy, half, t) {
    const r = half + 30;
    ALIGN_KEYS.forEach((k, i) => {
      const a = -Math.PI / 2 + (i / ALIGN_KEYS.length) * Math.PI * 2;
      const px = cx + Math.cos(a) * r, py = cy + Math.sin(a) * r;
      const on = !!state.alignLocked[k];
      c.save();
      c.beginPath(); c.arc(px, py, 4.5, 0, Math.PI * 2);
      c.fillStyle = on ? COLORS.mint : 'rgba(255,255,255,0.16)';
      if (on) { c.shadowColor = COLORS.mint; c.shadowBlur = 10; }
      c.fill(); c.restore();
    });
    if (state.mpActive && state.lm.present) {
      c.save();
      c.beginPath(); c.arc(cx, cy, 22, 0, Math.PI * 2);
      c.strokeStyle = state.alignLocked.center ? COLORS.mint : 'rgba(0,240,255,0.6)';
      c.lineWidth = 2; c.stroke();
      const dx = (1 - state.lm.cx) - 0.5, dy = state.lm.cy - 0.5; // mirror x (selfie)
      const dotx = cx + dx * half * 2.2, doty = cy + dy * half * 2.2;
      c.beginPath(); c.arc(dotx, doty, 6, 0, Math.PI * 2);
      c.fillStyle = state.alignLocked.center ? COLORS.mint : COLORS.cyan;
      c.shadowColor = c.fillStyle; c.shadowBlur = 12; c.fill();
      c.restore();
    }
    if (t - state.alignFlash < 360) {
      const k = 1 - (t - state.alignFlash) / 360;
      c.save();
      c.beginPath(); c.arc(cx, cy, half * (1.12 - k * 0.3), 0, Math.PI * 2);
      c.strokeStyle = `rgba(0,230,153,${0.5 * k})`; c.lineWidth = 3; c.stroke();
      c.restore();
    }
  }

  // ── render loop (visual only; logic lives in update()) ──
  function render(t) {
    drawStarfield(t);
    const show3d = m3dActivePhase();
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

      if (!show3d) drawParticles(ctx, cx, cy, t); // 3D model replaces the 2D mesh during capture
      if (ph.processing) drawProcessingOrb(ctx, cx, cy, t);
      drawCorners(ctx, cx, cy, half, accent, state.started ? 0.95 : 0.5);
      drawHalo(ctx, cx, cy, half + 26, state.halo, accent);
      if (ph.guide !== undefined && state.halo < 0.82) drawGuide(ctx, cx, cy, ph.guide, accent);
      if (state.step === 'face_detecting' && state.mpActive) drawAlignOverlay(ctx, cx, cy, half, t);
    }
    renderModel3D(t);
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
    ensureModel3D(); // boot the 3D depth engine in the background (capture phases)

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
    if (state.mpActive || state.tierA) {
      centering = q.centerOffset <= T.centerOffsetMax && q.coverage >= T.coverageMin;
    } else {
      // Tier B honest heuristic: something with facial structure sits in the center,
      // under good light. Not ML — guides the user toward a centered, framed pose.
      centering = q.detail >= T.detailMin && lighting;
    }
    state.gates = { lighting, centering, stillness };
    return state.gates;
  }

  // accumulate a coarse aggregate for the qualitative confidence band.
  // Mirrors the spirit of mobile confidence.ts totalBaselineConfidence (pose / eye / lighting):
  // when MediaPipe is live we EARN the band with real alignment quality, not just stillness+light.
  function sampleConfidence(motionCeil) {
    const q = state.q, lm = state.lm;
    const still = 1 - clamp01(q.motion / Math.max(0.01, motionCeil));
    let agg;
    if (state.mpActive && lm.present) {
      // frontality excludes YAW on purpose → the intentional head-turn during arc_left/right
      // isn't penalised (roll+pitch should stay ~0 throughout the whole capture).
      const frontality = clamp01(1 - Math.max(Math.abs(lm.roll) / ALIGN.rollMax, Math.abs(lm.pitch) / ALIGN.pitchMax));
      const eyeOpen = clamp01(lm.eyeOpen);
      const distIn = lm.dist >= ALIGN.distMin && lm.dist <= ALIGN.distMax ? 1 : 0.4;
      const center = clamp01(1 - lm.centerOffset);
      agg = 0.25 * still + 0.18 * q.brightness + 0.15 * q.uniformity + 0.12 * center
        + 0.15 * frontality + 0.08 * eyeOpen + 0.07 * distIn;
    } else {
      // Tier B / no landmarks: original stillness+light+centering mix (weights sum to 1).
      agg = 0.35 * still + 0.25 * q.brightness + 0.2 * q.uniformity
        + 0.2 * (state.tierA ? clamp01(1 - q.centerOffset) : q.detail);
    }
    state.confSum += clamp01(agg);
    state.confN += 1;
  }

  // ── FSM transitions ───────────────────────────────────────────────────────
  function go(step) {
    state.step = step;
    state.stepStart = now();
    document.getElementById('stage').dataset.step = step; // scopes per-step layout (e.g. compact end screen)
    if (step === 'face_detecting') { // fresh Guided Lock-On each entry
      state.alignHold = {}; state.alignLocked = {}; state.alignProg = 0; state.shownNudge = ''; state.candNudge = '';
    }
    const ph = STEP[step];
    setText(ph.instr, ph.sub);
    document.getElementById('meter').style.opacity = ph.meter ? '1' : '0';
    document.getElementById('securedPill').classList.toggle('on', !!ph.secured);
    // baseline data snapshot panel (qualitative reference, Model B-honest)
    document.getElementById('proc-pct').classList.toggle('on', step === 'processing');
    document.getElementById('hud').classList.toggle('on', M3D_PHASES.has(step)); // agent HUD during capture
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
    // MediaPipe 3D landmarks supersede the heuristic for centering during capture
    if (m3d.landmarker && M3D_PHASES.has(state.step)) {
      detectLandmarks(document.getElementById('cam-video'), t);
      if (state.lm.present) {
        state.mpActive = true;
        state.q.centerOffset = state.lm.centerOffset;
        state.q.coverage = state.lm.coverage;
      } else {
        state.mpActive = false;
      }
    } else {
      state.mpActive = false;
    }
    const g = evalGates();
    // live precision indicators reflect REAL gate state every frame
    INDICATORS.forEach((ind) => {
      const dot = document.querySelector('#pin-' + ind.key + ' .pindot');
      if (dot) dot.classList.toggle('on', !!g[ind.key]);
    });
    if (M3D_PHASES.has(state.step)) updateHud();

    switch (state.step) {
      case 'environment_check': {
        const allPass = g.lighting && g.centering && g.stillness;
        if (allPass) {
          if (!state.envHoldStart) state.envHoldStart = t;
        } else {
          state.envHoldStart = 0;
        }
        const held = state.envHoldStart && (t - state.envHoldStart >= ENV_HOLD_MS);
        // safety net: never dead-end — once Lighting is OK, proceed after a grace window
        // even if Stillness/Centering stay noisy on a handheld device.
        const fallback = g.lighting && (t - state.stepStart >= ENV_FALLBACK_MS);
        if (held || fallback) { state.detectHoldStart = 0; go('face_detecting'); }
        break;
      }
      case 'face_detecting': {
        if (state.mpActive) {
          // Guided Lock-On: coach distance → centre → level → eyes, one nudge at a time
          runAlign(t, g);
        } else {
          // 2D fallback (no MediaPipe): original detect behavior
          const ok = state.tierA ? (g.centering && g.lighting) : (g.lighting && g.stillness && g.centering);
          if (ok) {
            if (!state.detectHoldStart) state.detectHoldStart = t;
            state.lossStart = 0;
            if (t - state.detectHoldStart >= DETECT_HOLD_MS) go('face_locked');
          } else {
            state.detectHoldStart = 0;
            if (!state.lossStart) state.lossStart = t;
            if (t - state.lossStart >= DETECT_LOSS_MS) { state.lossStart = 0; go('environment_check'); state.envHoldStart = 0; }
          }
        }
        break;
      }
      case 'face_locked': {
        if (t - state.stepStart >= LOCK_DWELL_MS) { lastCaptureStep = 'neutral_capture'; go('neutral_capture'); }
        break;
      }
      case 'neutral_capture': {
        lastCaptureStep = 'neutral_capture';
        const pass = g.lighting && g.stillness && ((state.mpActive || state.tierA) ? g.centering : true) && state.q.motion <= T.motionNeutral;
        captureTick(pass, 'neutral', NEUTRAL_MS, dt, T.motionNeutral, () => { go('arc_left'); });
        break;
      }
      case 'arc_left': {
        lastCaptureStep = 'arc_left';
        const pass = g.lighting && state.q.motion <= T.motionArc && ((state.mpActive || state.tierA) ? state.q.coverage >= T.coverageMin : g.centering);
        // arc_left fills the first half of arcProgress
        captureTick(pass, 'arc', ARC_MS, dt, T.motionArc, () => { go('arc_right'); }, 0.5);
        break;
      }
      case 'arc_right': {
        lastCaptureStep = 'arc_right';
        const pass = g.lighting && state.q.motion <= T.motionArc && ((state.mpActive || state.tierA) ? state.q.coverage >= T.coverageMin : g.centering);
        if (STEP.arc_right.recenter && state.arc > 0.9) {
          const el = document.getElementById('instruction');
          if (el.textContent !== STEP.arc_right.recenter) el.textContent = STEP.arc_right.recenter;
        }
        captureTick(pass, 'arc', ARC_MS, dt, T.motionArc, () => { go('stability_pass'); }, 1.0);
        break;
      }
      case 'stability_pass': {
        lastCaptureStep = 'stability_pass';
        const pass = g.lighting && g.stillness && state.q.motion <= T.motionStability && ((state.mpActive || state.tierA) ? g.centering : true);
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
    document.getElementById('stage').dataset.step = 'intro';
    Object.assign(state, {
      step: 'intro', stepStart: 0, started: false, tierA: false, detector: null, face: null,
      q: { brightness: 0, uniformity: 0, motion: 1, detail: 0, coverage: 0, centerOffset: 1 },
      gates: { lighting: false, centering: false, stillness: false },
      mpActive: false, lm: { present: false, yaw: 0, centerOffset: 1, coverage: 0, cx: 0.5, cy: 0.5, dist: 0, roll: 0, pitch: 0, eyeOpen: 1 },
      alignHold: {}, alignLocked: {}, alignProg: 0, shownNudge: '', candNudge: '', candSince: 0, alignFlash: 0,
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
    m3d.seen = false; // re-seed the 3D model on the next run
    const m3dHost = document.getElementById('model3d');
    if (m3dHost) m3dHost.classList.remove('on');
    document.getElementById('hud').classList.remove('on');
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
    document.getElementById('stage').dataset.step = 'intro';
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
