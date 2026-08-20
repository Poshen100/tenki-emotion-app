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

  // ── blink-cadence baseline (shared helper: blink-cadence.js) ──
  // Sampled across the four capture phases, real landmarks only. Blendshape
  // eyeOpen (1 - max blink score) hysteresis: closed <0.35, re-arm >0.6.
  const BLINK_PHASES = new Set(['neutral_capture', 'arc_left', 'arc_right', 'stability_pass']);
  const BLINK_CLOSE = 0.35, BLINK_OPEN = 0.6;

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
    blink: null, blinkEarned: false, // blink-cadence counter (TENKI_BLINK) + saved-this-run flag
    // visuals
    halo: 0, secured: 0, settle: 0, bloom: 0,
    orbR: 76, orbClimax: 0,
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
  function withAlpha(hex, a) {
    const [r, g, b] = hexToRgb(hex);
    return `rgba(${r},${g},${b},${a})`;
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
        z: Math.random(), // depth → size/brightness/parallax (volumetric soul)
        twSpeed: 0.5 + Math.random() * 1.6, // twinkle spark cadence
        twPhase: Math.random() * Math.PI * 2,
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

  // Precision-instrument reticle: breathing double-layer brackets with glowing
  // elbow nodes + edge measurement ticks. `t` drives a slow idle breath.
  function drawCorners(c, cx, cy, half, color, alpha, t) {
    const breath = 0.5 + 0.5 * Math.sin((t || 0) * 0.0016);
    const off = half + breath * 2;
    const len = 26;
    const a = alpha * (0.82 + breath * 0.18);
    c.save();
    c.lineCap = 'round';
    const corners = [
      [cx - off, cy - off, 1, 1], [cx + off, cy - off, -1, 1],
      [cx - off, cy + off, 1, -1], [cx + off, cy + off, -1, -1],
    ];
    for (const [x, y, sx, sy] of corners) {
      c.shadowColor = color; c.shadowBlur = 16;
      // outer soft glow
      c.strokeStyle = color; c.globalAlpha = a * 0.45; c.lineWidth = 5;
      c.beginPath(); c.moveTo(x, y + sy * len); c.lineTo(x, y); c.lineTo(x + sx * len, y); c.stroke();
      // bright inner edge
      c.globalAlpha = a; c.lineWidth = 2; c.shadowBlur = 6;
      c.beginPath(); c.moveTo(x, y + sy * len); c.lineTo(x, y); c.lineTo(x + sx * len, y); c.stroke();
      // glowing elbow node
      c.shadowBlur = 12; c.globalAlpha = a;
      c.fillStyle = '#EAFEFF';
      c.beginPath(); c.arc(x, y, 2.6, 0, Math.PI * 2); c.fill();
    }
    // edge midpoint measurement ticks
    c.globalAlpha = a * 0.6; c.lineWidth = 1.5; c.shadowBlur = 6; c.strokeStyle = color;
    const tick = 7;
    const mids = [
      [cx, cy - off, 0, 1], [cx, cy + off, 0, -1],
      [cx - off, cy, 1, 0], [cx + off, cy, -1, 0],
    ];
    for (const [x, y, nx, ny] of mids) {
      c.beginPath(); c.moveTo(x, y); c.lineTo(x + nx * tick, y + ny * tick); c.stroke();
    }
    c.restore();
  }

  // Soft scan-line sweeping the frame (idle only) — reads as live biometric scan.
  function drawScanLine(c, cx, cy, half, color, t) {
    const period = 3600;
    const ph = (t % period) / period;
    const y = cy - half + ph * (half * 2);
    const ease = Math.sin(ph * Math.PI); // bright mid-sweep, fades at the edges
    c.save();
    roundedRect(c, cx - half, cy - half, half * 2, half * 2, 40);
    c.clip();
    const g = c.createLinearGradient(0, y - 16, 0, y + 16);
    g.addColorStop(0, 'rgba(0,240,255,0)');
    g.addColorStop(0.5, `rgba(120,245,255,${(0.45 * ease).toFixed(3)})`);
    g.addColorStop(1, 'rgba(0,240,255,0)');
    c.fillStyle = g;
    c.fillRect(cx - half, y - 16, half * 2, 32);
    c.globalAlpha = 0.55 * ease;
    c.strokeStyle = color; c.shadowColor = color; c.shadowBlur = 10; c.lineWidth = 1;
    c.beginPath(); c.moveTo(cx - half, y); c.lineTo(cx + half, y); c.stroke();
    c.restore();
  }

  function drawHalo(c, cx, cy, radius, progress, color, t) {
    if (progress <= 0.001) return;
    const p = clamp01(progress);
    const start = -Math.PI / 2;
    const end = start + Math.PI * 2 * p;
    const breath = 0.5 + 0.5 * Math.sin((t || 0) * 0.0018);
    c.save();
    c.lineCap = 'round';

    // 1) instrument tick ring — filled ticks bright, unfilled dim
    const TICKS = 60;
    for (let i = 0; i < TICKS; i++) {
      const ang = start + (i / TICKS) * Math.PI * 2;
      const filled = (ang - start) <= (end - start) + 1e-3;
      const major = i % 5 === 0;
      const tlen = major ? 5 : 2.6;
      const r0 = radius - tlen, r1 = radius + (major ? 2 : 0);
      c.globalAlpha = filled ? 0.55 + 0.25 * breath : 0.10;
      c.strokeStyle = color; c.lineWidth = major ? 1.4 : 1;
      c.shadowColor = color; c.shadowBlur = filled ? 6 : 0;
      c.beginPath();
      c.moveTo(cx + Math.cos(ang) * r0, cy + Math.sin(ang) * r0);
      c.lineTo(cx + Math.cos(ang) * r1, cy + Math.sin(ang) * r1);
      c.stroke();
    }

    // 2) faint full track
    c.globalAlpha = 1; c.shadowBlur = 0;
    c.beginPath(); c.arc(cx, cy, radius, 0, Math.PI * 2);
    c.strokeStyle = 'rgba(255,255,255,0.05)'; c.lineWidth = 3.5; c.stroke();

    // 3) gradient progress arc — dim tail → bright leading edge
    const grad = c.createLinearGradient(cx - radius, cy, cx + radius, cy);
    grad.addColorStop(0, withAlpha(color, 0.25));
    grad.addColorStop(1, color);
    c.beginPath(); c.arc(cx, cy, radius, start, end);
    c.strokeStyle = grad; c.lineWidth = 4.5;
    c.shadowColor = color; c.shadowBlur = 16 + breath * 6; c.stroke();

    // 4) comet head — trailing fade + glowing core
    const hx = cx + Math.cos(end) * radius, hy = cy + Math.sin(end) * radius;
    const tailA = end - 0.32 * p; // short trailing wedge behind the head
    c.beginPath(); c.arc(cx, cy, radius, tailA, end);
    c.strokeStyle = withAlpha('#FFFFFF', 0.5); c.lineWidth = 5.5;
    c.shadowColor = color; c.shadowBlur = 20; c.stroke();
    c.beginPath(); c.arc(hx, hy, 4 + breath * 0.8, 0, Math.PI * 2);
    c.fillStyle = '#FFFFFF'; c.shadowColor = color; c.shadowBlur = 16; c.fill();
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
    const k = clamp01(settle * 0.5 + bloom);
    const idle = 1 - k; // 1 at rest, → 0 as the soul converges into the core
    // slow global rotation → a bound system, not a random scatter
    const rot = t * 0.00006;
    const cosR = Math.cos(rot), sinR = Math.sin(rot);

    // 1) resolve every node's screen position + look (links need positions first)
    const pts = [];
    for (const p of particles) {
      const drift = state.started ? 1 : 0.4;
      const dx = Math.sin(t * 0.001 * p.speed + p.phase) * 4 * drift;
      const dy = Math.cos(t * 0.0011 * p.speed + p.phase) * 4 * drift;
      const par = 0.62 + (p.z || 0.5) * 0.76; // depth parallax
      const bxr = (p.bx * cosR - p.by * sinR) * par;
      const byr = (p.bx * sinR + p.by * cosR) * par;
      const px = cx + lerp(bxr + dx + ax, 0, k);
      const py = cy + lerp(byr + dy + ay, 0, k);
      const pulse = 0.6 + 0.4 * Math.sin(t * 0.004 * p.speed + p.phase);
      const tw = Math.max(0, Math.sin(t * 0.001 * p.twSpeed + p.twPhase) - 0.86) / 0.14; // rare spark
      const depth = 0.55 + (p.z || 0.5) * 0.45;
      const base = p.gold ? mix(COLORS.cyan, COLORS.gold, secured) : mix(COLORS.cyan, COLORS.goldChampagne, secured * 0.7);
      const size = p.size * (0.8 + pulse * 0.5) * (1 + bloom * 0.6) * depth;
      const alpha = (0.25 + 0.55 * pulse + bloom * 0.2) * depth + tw * 0.5 * idle;
      pts.push({ px, py, size, alpha, base, z: (p.z || 0.5), tw });
    }
    // depth order: far/dim nodes behind, near/bright nodes on top
    pts.sort((a, b) => a.z - b.z);

    // 2) breathing core — a small volumetric sphere of light (the soul's heart).
    //    soft glow + dense upper-left specular + lower-right inner shadow read as
    //    a lit 3D core, not a flat disc. (idle only)
    if (idle > 0.01) {
      const breath = 0.5 + 0.5 * Math.sin(t * 0.0016);
      const cr = 30 + breath * 10;
      c.save();
      // soft outer glow
      const g = c.createRadialGradient(cx, cy, 0, cx, cy, cr);
      g.addColorStop(0, `rgba(130,246,255,${((0.20 + breath * 0.10) * idle).toFixed(3)})`);
      g.addColorStop(0.5, `rgba(0,240,255,${(0.09 * idle).toFixed(3)})`);
      g.addColorStop(1, 'rgba(0,240,255,0)');
      c.fillStyle = g;
      c.beginPath(); c.arc(cx, cy, cr, 0, Math.PI * 2); c.fill();
      // lower-right inner shadow → spherical roundness
      const sx = cx + cr * 0.34, sy2 = cy + cr * 0.38;
      const sh = c.createRadialGradient(sx, sy2, 0, sx, sy2, cr);
      sh.addColorStop(0, `rgba(2,10,24,${(0.28 * idle).toFixed(3)})`);
      sh.addColorStop(0.7, 'rgba(2,10,24,0)');
      c.fillStyle = sh;
      c.beginPath(); c.arc(cx, cy, cr, 0, Math.PI * 2); c.fill();
      // dense specular highlight, offset upper-left → lit volume
      const hx = cx - cr * 0.26, hy = cy - cr * 0.30;
      const hl = c.createRadialGradient(hx, hy, 0, hx, hy, cr * 0.8);
      hl.addColorStop(0, `rgba(212,252,255,${(0.55 * idle).toFixed(3)})`);
      hl.addColorStop(0.5, `rgba(150,244,255,${(0.15 * idle).toFixed(3)})`);
      hl.addColorStop(1, 'rgba(150,244,255,0)');
      c.fillStyle = hl;
      c.beginPath(); c.arc(hx, hy, cr * 0.8, 0, Math.PI * 2); c.fill();
      c.restore();
    }

    // 2c) orbital containment ring — back half (behind the lattice)
    if (idle > 0.02) drawSoulOrbit(c, cx, cy, t, idle, secured, false);

    // 3) constellation links — nearest-neighbour lattice (≤K links/node so the
    //    centre reads as a clean star map, not a cobweb; fades as it converges)
    if (idle > 0.02) {
      c.save();
      c.lineWidth = 1;
      const maxD = 46, maxD2 = maxD * maxD, K = 3;
      const seen = new Set();
      for (let i = 0; i < pts.length; i++) {
        const near = [];
        for (let j = 0; j < pts.length; j++) {
          if (j === i) continue;
          const ddx = pts[i].px - pts[j].px, ddy = pts[i].py - pts[j].py;
          const d2 = ddx * ddx + ddy * ddy;
          if (d2 <= maxD2) near.push([d2, j]);
        }
        near.sort((m, n) => m[0] - n[0]);
        for (let n = 0; n < Math.min(K, near.length); n++) {
          const j = near[n][1];
          const key = i < j ? i * 1000 + j : j * 1000 + i;
          if (seen.has(key)) continue;
          seen.add(key);
          const a = (1 - Math.sqrt(near[n][0]) / maxD) * 0.22 * idle;
          if (a < 0.015) continue;
          c.strokeStyle = `rgba(90,225,255,${a.toFixed(3)})`;
          c.beginPath(); c.moveTo(pts[i].px, pts[i].py); c.lineTo(pts[j].px, pts[j].py); c.stroke();
        }
      }
      c.restore();
    }

    // 4) the nodes themselves (+ twinkle cross-spark)
    for (const pt of pts) {
      c.save();
      c.globalAlpha = clamp01(pt.alpha);
      c.beginPath(); c.arc(pt.px, pt.py, pt.size, 0, Math.PI * 2);
      c.fillStyle = pt.base; c.shadowColor = pt.base; c.shadowBlur = 6 + bloom * 14 + pt.tw * 8;
      c.fill();
      if (pt.tw > 0.2 && idle > 0.2) {
        c.globalAlpha = pt.tw * 0.6 * idle;
        c.strokeStyle = '#CFFBFF'; c.lineWidth = 0.8;
        const s = pt.size * (2 + pt.tw * 2);
        c.beginPath();
        c.moveTo(pt.px - s, pt.py); c.lineTo(pt.px + s, pt.py);
        c.moveTo(pt.px, pt.py - s); c.lineTo(pt.px, pt.py + s);
        c.stroke();
      }
      c.restore();
    }

    // 4b) orbital containment ring — front half (over the lattice) + bead
    if (idle > 0.02) drawSoulOrbit(c, cx, cy, t, idle, secured, true);

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

  // ═══════════════════════════════════════════════════════════════════════════
  // CINEMATIC CRYSTAL ORB — Processing & Baseline Locked Volumetric Glass Sphere
  // Target: docs/refs/crystal-ball-target-IMG_8437.png
  // ═══════════════════════════════════════════════════════════════════════════
  // ═══════════════════════════════════════════════════════════════════════════
  // CINEMATIC CRYSTAL ORB — Processing & Baseline Locked Volumetric Glass Sphere
  // Target: docs/refs/crystal-ball-target-IMG_8437.png
  // ═══════════════════════════════════════════════════════════════════════════
  // Ultra-smooth flowing golden sand fluid dynamics: 2,200+ multi-scale micro-grains
  // across 4 tangled Keplerian orbits with non-linear velocity gradients, organic
  // viscous stream turbulence, curved Bezier motion streaks, and crystalline specular glints.
  function drawProcessingOrb(c, cx, cy, t, opts = {}) {
    c.save();
    const R = opts.R || 76;
    const climax = opts.climax || 0; // 0..1 transition surge
    const TAU = Math.PI * 2;

    // Check reduced motion
    const reducedMotion = typeof window !== 'undefined' &&
      window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // ── Optical Lighting Model (Matches IMG_8437) ──────────────────────────
    // Key light at 12 o'clock with organic sway + breathing; fill bounce at 4 o'clock
    const sway = reducedMotion ? 0 : Math.sin(t * 0.00045) * 0.14;
    const lang = -Math.PI / 2 + sway;
    const lx = cx + Math.cos(lang) * R * 0.48;
    const ly = cy + Math.sin(lang) * R * 0.48;
    const ux = Math.cos(lang), uy = Math.sin(lang);
    const shimmer = reducedMotion ? 0.95 : (0.86 + 0.14 * Math.sin(t * 0.0016));

    // ── 4 Tangled Keplerian Orbits (Non-coplanar 3D Golden Knot) ────────────
    const ORBITS = [
      { rr: R * 0.94, tilt: 1.15, roll: 0.00, yaw: 0.0, head: 0.00340, grit: 620, ecc: 0.12 },
      { rr: R * 0.82, tilt: -0.85, roll: 1.18, yaw: 1.7, head: 0.00460, grit: 580, ecc: 0.15 },
      { rr: R * 0.68, tilt: 0.52, roll: -1.08, yaw: 3.4, head: -0.00580, grit: 520, ecc: 0.18 },
      { rr: R * 0.52, tilt: -1.28, roll: 0.58, yaw: 5.1, head: 0.00720, grit: 480, ecc: 0.22 },
    ];

    // Asynchronous multi-harmonic precession (Keplerian drift)
    const GROT = reducedMotion ? { pitch: 0, yaw: 0 } : {
      pitch: 0.00065 + Math.sin(t * 0.00015) * 0.00015,
      yaw: 0.00028 + Math.cos(t * 0.00012) * 0.00008
    };

    const hash = (n) => {
      const s = Math.sin(n * 127.1) * 43758.5453;
      return s - Math.floor(s);
    };

    // Project orbits to 3D space with continuous angular velocity and fluid stream harmonics
    const O = ORBITS.map((o) => {
      const ax = o.tilt + (reducedMotion ? 0 : t * GROT.pitch);
      const ay = o.yaw + (reducedMotion ? 0 : t * GROT.yaw);
      const ca = Math.cos(ax), sa = Math.sin(ax);
      const cb = Math.cos(ay), sb = Math.sin(ay);
      const cr = Math.cos(o.roll || 0), sr = Math.sin(o.roll || 0);

      const project = (phi, radOffset = 0, zOffset = 0) => {
        // Keplerian radial breathing + fluid eccentricity
        const curR = (o.rr + radOffset) * (1 - o.ecc * Math.cos(phi));
        const x0 = Math.cos(phi) * curR, y0 = Math.sin(phi) * curR;
        const y1 = y0 * ca, z1 = y0 * sa + zOffset;
        const x2 = x0 * cb + z1 * sb, z2 = -x0 * sb + z1 * cb;
        const xr = x2 * cr - y1 * sr, yr = x2 * sr + y1 * cr;
        return { x: cx + xr, y: cy + yr, z: z2 };
      };

      const dir = Math.sign(o.head) || 1;
      const head = reducedMotion ? 0 : (((t * o.head) % TAU + TAU) % TAU);
      const comet = (phi) => Math.exp(-(((dir * (head - phi)) % TAU + TAU) % TAU) * 0.28);

      return { o, project, comet };
    });

    // ── High-Density Golden Sand Fluid Particles Stream (2,200+ grains) ──────
    const EPS = 0.035; // Fine tangent delta for curved motion streaks
    const drawMicroStardust = (front) => {
      c.save();
      c.lineCap = 'round';

      for (const { o, project, comet } of O) {
        const count = o.grit;
        for (let i = 0; i < count; i++) {
          const h1 = hash(o.rr * 9.1 + i * 17.3);
          const h2 = hash(i * 5.7 + o.rr * 3.3);
          const h3 = hash(i * 11.9 + 101.1);
          const h4 = hash(i * 23.3 + 47.9);

          // Natural speed distribution: core flow is faster, boundary layer slower
          const spd = 0.72 + h1 * 0.95;
          // Organic fluid turbulence: slight sinusoidal cross-drift over time
          const turb = reducedMotion ? 0 : Math.sin(t * 0.0018 + h3 * TAU) * 0.04;
          const phi = reducedMotion ? (h1 * TAU) : (h1 * TAU + t * (o.head * spd) + turb);

          // Non-linear Keplerian orbital velocity acceleration (faster near periapsis)
          const kepPhi = phi + 0.12 * Math.sin(phi);

          // Cross-stream Gaussian dispersion (fluid stream tube thickness)
          const off = (h2 - 0.5) * 2;
          const spreadRad = off * R * 0.11 * (1 - 0.3 * Math.abs(off));
          const spreadZ = (h3 - 0.5) * R * 0.08;

          const p = project(kepPhi, spreadRad, spreadZ);
          if ((p.z >= 0) !== front) continue;

          // Compute instantaneous curvature and tangents for curved fluid motion
          const pPrev = project(kepPhi - EPS * 0.8, spreadRad, spreadZ);
          const pNext = project(kepPhi + EPS * 0.8, spreadRad, spreadZ);

          const d = (p.z / o.rr) * 0.5 + 0.5; // Normalized depth: 0 (deep back) -> 1 (closest front)
          const ci = comet(kepPhi);
          
          // Organic crystal facet twinkle (tumbles as it travels)
          const facetAngle = (t * 0.008 + h4 * TAU) % TAU;
          const facetReflect = Math.max(0, Math.cos(facetAngle));
          const isSpark = h4 > 0.88; // 12% crystalline flake grains with specular glint
          const isEmbers = h4 < 0.08; // 8% blazing core embers

          // Alpha blending with depth attenuation & Doppler boost
          let a = (0.30 + ci * 0.95 + climax * 0.45) * (front ? (0.75 + 0.35 * d) : (0.26 + 0.14 * d));
          if (isSpark) a *= (0.8 + 0.8 * facetReflect);
          if (a < 0.012) continue;

          // Motion streak length scaled by orbital speed & depth
          const lenScale = (1.8 + d * 3.6 + spd * 1.8 + climax * 2.8) * (R / 76);
          const tx = (pNext.x - pPrev.x) * 0.5;
          const ty = (pNext.y - pPrev.y) * 0.5;
          const tl = Math.hypot(tx, ty) || 1;
          const ux = (tx / tl) * lenScale;
          const uy = (ty / tl) * lenScale;

          c.globalAlpha = clamp01(a * (1 - 0.35 * Math.abs(off)));

          // Grain size hierarchy:
          // - Embers: 1.2 ~ 2.2px
          // - Sparks: 0.8 ~ 1.5px
          // - Micro-sand: 0.35 ~ 0.85px
          const baseW = isEmbers ? (1.1 + d * 0.9) : isSpark ? (0.75 + d * 0.65) : (0.38 + d * 0.52);
          c.lineWidth = baseW * (R / 76);

          // Rich Doppler color palette: White-gold head -> Radiant sovereign gold -> Deep honey amber
          if (isEmbers || (ci > 0.68 && front)) {
            c.strokeStyle = '#FFFFFF';
            c.shadowColor = '#FFEAA7';
            c.shadowBlur = 4.5 + d * 8.0 + climax * 9.0;
          } else if (isSpark && facetReflect > 0.6) {
            c.strokeStyle = '#FFFDF0';
            c.shadowColor = '#FFD46E';
            c.shadowBlur = 3.5 + d * 6.0;
          } else if (ci > 0.28 || (front && d > 0.6)) {
            c.strokeStyle = '#FFDF78';
            c.shadowColor = '#F3A92A';
            c.shadowBlur = 2.2 + d * 4.5;
          } else if (front) {
            c.strokeStyle = '#F0B842';
            c.shadowColor = '#D48B1E';
            c.shadowBlur = 1.6;
          } else {
            c.strokeStyle = '#C27F18';
            c.shadowColor = '#7A4806';
            c.shadowBlur = 1.0;
          }

          // Render curved quadratic Bezier fluid trail
          c.beginPath();
          c.moveTo(p.x - ux, p.y - uy);
          c.quadraticCurveTo(p.x, p.y, p.x + ux, p.y + uy);
          c.stroke();
        }
      }
      c.globalAlpha = 1;
      c.restore();
    };

    // ── Outer Volumetric Bloom Halo (Bleeds Warm Gold) ───────────────────────
    const glow = c.createRadialGradient(cx, cy, R * 0.25, cx, cy, R * 1.95);
    const bloomAlpha = (0.32 + climax * 0.28) * shimmer;
    glow.addColorStop(0, `rgba(255,212,118,${(0.38 * bloomAlpha).toFixed(3)})`);
    glow.addColorStop(0.45, `rgba(255,188,76,${(0.16 * bloomAlpha).toFixed(3)})`);
    glow.addColorStop(0.85, `rgba(255,170,50,${(0.04 * bloomAlpha).toFixed(3)})`);
    glow.addColorStop(1, 'rgba(255,170,50,0)');
    c.fillStyle = glow;
    c.beginPath();
    c.arc(cx, cy, R * 1.95, 0, TAU);
    c.fill();

    // ── Volumetric Optical Glass Body (Deep Amber to Obsidian) ───────────────
    const body = c.createRadialGradient(lx, ly, R * 0.05, cx, cy, R * 1.08);
    body.addColorStop(0, 'rgba(140,105,52,0.52)');
    body.addColorStop(0.40, 'rgba(56,40,16,0.38)');
    body.addColorStop(0.80, 'rgba(14,10,4,0.36)');
    body.addColorStop(1, 'rgba(0,0,0,0.12)');
    c.beginPath();
    c.arc(cx, cy, R, 0, TAU);
    c.fillStyle = body;
    c.fill();

    // ── Inner Glass Cavity (Clip & Render Internal Layers) ───────────────────
    c.save();
    c.beginPath();
    c.arc(cx, cy, R, 0, TAU);
    c.clip();

    // Dynamic Inner Shadow (Terminator sweeps with Key Light)
    const shade = c.createRadialGradient(cx - ux * R * 0.44, cy - uy * R * 0.44, R * 0.08, cx, cy, R);
    shade.addColorStop(0, 'rgba(0,0,0,0.48)');
    shade.addColorStop(0.72, 'rgba(0,0,0,0)');
    c.fillStyle = shade;
    c.beginPath();
    c.arc(cx, cy, R, 0, TAU);
    c.fill();

    // Far Stardust Streams (Deep behind core)
    drawMicroStardust(false);

    // ── Volumetric Radiant Core (Breathing Harmonic Soul Heart) ───────────────
    const coreBreathe = reducedMotion ? 1.0 : (0.94 + 0.06 * Math.sin(t * 0.0018));
    const coreR = R * (0.44 + climax * 0.16) * coreBreathe;
    const core = c.createRadialGradient(cx, cy, 0, cx, cy, coreR);
    core.addColorStop(0, 'rgba(255,255,252,1.0)');
    core.addColorStop(0.28, `rgba(255,242,198,${(0.94 + climax * 0.06).toFixed(2)})`);
    core.addColorStop(0.60, 'rgba(255,198,92,0.54)');
    core.addColorStop(0.88, 'rgba(255,180,60,0.18)');
    core.addColorStop(1, 'rgba(255,180,60,0)');
    c.beginPath();
    c.arc(cx, cy, coreR, 0, TAU);
    c.fillStyle = core;
    c.fill();

    // Near Stardust Streams (In front of core)
    drawMicroStardust(true);

    // ── Inner Ambient Occlusion Ring (Glass Wall Thickness) ───────────────────
    c.save();
    c.beginPath();
    c.arc(cx, cy, R * 0.985, 0, TAU);
    c.strokeStyle = 'rgba(0,0,0,0.32)';
    c.lineWidth = R * 0.055;
    c.stroke();
    c.restore();

    // ── Frosted Edge-Haze (Breathing Thinking Nebula) ────────────────────────
    c.save();
    const mistBreathe = reducedMotion ? 0.5 : (0.5 + 0.5 * Math.sin(t * 0.0019));
    const mistPeak = (0.28 + 0.12 * mistBreathe);
    const mistAlpha = (f) => `rgba(240,246,255,${(mistPeak * f).toFixed(3)})`;

    const ringHaze = c.createRadialGradient(cx, cy, R * 0.42, cx, cy, R);
    ringHaze.addColorStop(0.00, 'rgba(240,246,255,0)');
    ringHaze.addColorStop(0.55, mistAlpha(0.03));
    ringHaze.addColorStop(0.72, mistAlpha(0.12));
    ringHaze.addColorStop(0.84, mistAlpha(0.26));
    ringHaze.addColorStop(0.92, mistAlpha(0.50));
    ringHaze.addColorStop(0.97, mistAlpha(0.78));
    ringHaze.addColorStop(1.00, mistAlpha(1.00));
    c.fillStyle = ringHaze;
    c.beginPath();
    c.arc(cx, cy, R, 0, TAU);
    c.fill();

    if (!reducedMotion) {
      // 3 Drifting soft density lobes
      for (let i = 0; i < 3; i++) {
        const ha = t * (0.00055 + i * 0.00022) + i * 2.27;
        const hr = R * (0.91 + 0.05 * Math.sin(t * 0.0012 + i * 1.7));
        const hx = cx + Math.cos(ha) * hr, hy = cy + Math.sin(ha) * hr;
        const lb = 0.4 + 0.6 * Math.sin(t * 0.0026 + i * 2.1);
        const lobe = c.createRadialGradient(hx, hy, 0, hx, hy, R * 0.55);
        lobe.addColorStop(0, `rgba(244,249,255,${(0.075 * lb).toFixed(3)})`);
        lobe.addColorStop(1, 'rgba(244,249,255,0)');
        c.fillStyle = lobe;
        c.beginPath();
        c.arc(hx, hy, R * 0.55, 0, TAU);
        c.fill();
      }
    }
    c.restore();

    // ── Ray-Bent Refractive Caustic Pool (Dual-Layer Optical Arc) ────────────
    // Emerges exactly opposite the key light with chromatic dispersion
    const rca = lang + Math.PI;
    c.save();
    c.lineCap = 'round';
    c.globalAlpha = shimmer;

    // Outer broad caustic fan
    c.beginPath();
    c.arc(cx, cy, R * 0.91, rca - 0.38 * Math.PI, rca + 0.38 * Math.PI);
    c.strokeStyle = 'rgba(255,230,165,0.52)';
    c.lineWidth = R * 0.088;
    c.shadowColor = COLORS.gold;
    c.shadowBlur = R * 0.30;
    c.stroke();

    // Inner sharp focal caustics line
    c.beginPath();
    c.arc(cx, cy, R * 0.945, rca - 0.30 * Math.PI, rca + 0.30 * Math.PI);
    c.strokeStyle = 'rgba(255,250,230,0.58)';
    c.lineWidth = R * 0.032;
    c.shadowBlur = R * 0.14;
    c.stroke();
    c.globalAlpha = 1;
    c.restore();

    // ── Secondary Fill Reflection (4 o'clock Lower-Right Bounce) ─────────────
    const fa = Math.PI * 0.25 + (reducedMotion ? 0 : Math.sin(t * 0.0005) * 0.10);
    const fxs = cx + Math.cos(fa) * R * 0.62, fys = cy + Math.sin(fa) * R * 0.62;
    const fill = c.createRadialGradient(fxs, fys, 0, fxs, fys, R * 0.45);
    fill.addColorStop(0, `rgba(255,245,220,${(0.22 * shimmer).toFixed(3)})`);
    fill.addColorStop(1, 'rgba(255,245,220,0)');
    c.fillStyle = fill;
    c.beginPath();
    c.arc(fxs, fys, R * 0.45, 0, TAU);
    c.fill();

    // ── Specular Hotspot & Sub-Pixel Catchlight ──────────────────────────────
    const spec = c.createRadialGradient(lx, ly, 0, lx, ly, R * 0.38);
    spec.addColorStop(0, `rgba(255,255,255,${(0.78 * shimmer).toFixed(3)})`);
    spec.addColorStop(0.38, 'rgba(255,248,228,0.22)');
    spec.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = spec;
    c.beginPath();
    c.arc(lx, ly, R * 0.38, 0, TAU);
    c.fill();

    // Crisp catchlight dot
    c.beginPath();
    c.arc(lx + ux * R * 0.05, ly + uy * R * 0.05, R * 0.048, 0, TAU);
    c.fillStyle = 'rgba(255,255,255,0.98)';
    c.fill();

    // Luminous glass rim crescent
    c.beginPath();
    c.arc(cx, cy, R * 0.865, lang - 0.32, lang + 0.32);
    c.strokeStyle = 'rgba(255,255,255,0.68)';
    c.lineWidth = 2.4 * (R / 76);
    c.lineCap = 'round';
    c.shadowColor = 'rgba(255,255,255,0.75)';
    c.shadowBlur = 7;
    c.stroke();

    c.restore(); // End clip

    // ── Fresnel Rim Glow (Defines Sphere Silhouette) ─────────────────────────
    c.save();
    c.beginPath();
    c.arc(cx, cy, R, 0, TAU);
    c.strokeStyle = 'rgba(255,226,156,0.28)';
    c.lineWidth = 1.25 * (R / 76);
    c.shadowColor = COLORS.gold;
    c.shadowBlur = 8;
    c.stroke();

    // Grazing key light boost
    c.beginPath();
    c.arc(cx, cy, R, lang - 0.42 * Math.PI, lang + 0.42 * Math.PI);
    c.strokeStyle = 'rgba(255,244,208,0.48)';
    c.lineWidth = 1.65 * (R / 76);
    c.lineCap = 'round';
    c.shadowBlur = 12;
    c.stroke();

    // Harmonic Climax Shockwave Ring (Plays during state transition)
    if (climax > 0.01) {
      const shockR = R * (1.0 + (1 - climax) * 0.4);
      c.beginPath();
      c.arc(cx, cy, shockR, 0, TAU);
      c.strokeStyle = `rgba(255,235,170,${(climax * 0.65).toFixed(3)})`;
      c.lineWidth = (2.0 * climax) * (R / 76);
      c.shadowColor = '#FFE8A3';
      c.shadowBlur = 14 * climax;
      c.stroke();
    }

    c.restore();
  }

  // Faint orbital containment ring around the idle soul — signals a *bound
  // system*, not a scatter. One fixed-tilt ellipse, depth-split (back half dim &
  // behind the lattice, front half brighter & over it) with a single travelling
  // bead drawn in whichever pass owns its current half. Fades with `idle`, so it
  // dissolves as the soul converges into the core during capture.
  function drawSoulOrbit(c, cx, cy, t, idle, secured, front) {
    const rx = 84, ry = 30, tilt = -0.30;
    c.save();
    c.translate(cx, cy); c.rotate(tilt);
    c.beginPath();
    if (front) c.ellipse(0, 0, rx, ry, 0, 0, Math.PI);
    else       c.ellipse(0, 0, rx, ry, 0, Math.PI, Math.PI * 2);
    c.strokeStyle = front
      ? `rgba(125,232,255,${(0.30 * idle).toFixed(3)})`
      : `rgba(90,200,235,${(0.11 * idle).toFixed(3)})`;
    c.lineWidth = front ? 1.5 : 1.0; c.lineCap = 'round';
    c.shadowColor = mix(COLORS.cyan, COLORS.goldChampagne, secured * 0.7);
    c.shadowBlur = front ? 8 : 3;
    c.stroke();
    // travelling bead — depth-scaled, owned by the half it currently sits on
    const a = t * 0.0009;
    const sy = Math.sin(a);
    if ((sy >= 0) === front) {
      const bx = Math.cos(a) * rx, byp = sy * ry;
      const depth = sy * 0.5 + 0.5; // 0 far .. 1 near
      c.globalAlpha = (0.4 + depth * 0.6) * idle;
      c.beginPath(); c.arc(bx, byp, 1.6 + depth * 1.4, 0, Math.PI * 2);
      c.fillStyle = '#CFF6FF'; c.shadowColor = COLORS.cyan; c.shadowBlur = 10; c.fill();
    }
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
        // Scan-band tint stays on-palette: bright cyan-white (ACTIVE) → champagne (SECURED via uMix).
        uScanCol: { value: new THREE.Color('#CFFBFF') }, uScanColB: { value: new THREE.Color(COLORS.goldChampagne) },
        uRim: { value: new THREE.Color('#9bf6ff') },
      },
      vertexShader: `
        attribute float aRnd;
        uniform float uTime, uSize, uScanY, uMix, uGlitch;
        uniform vec3 uColorA, uColorB, uScanCol, uScanColB, uRim;
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
          float rim = smoothstep(0.50, 1.05, length(p.xy));
          float band = 0.0;
          for (int i = 0; i < 3; i++) {
            float yk = -1.4 + fract(uScanY + float(i) * 0.34) * 2.8;
            band = max(band, smoothstep(0.05, 0.0, abs(p.y - yk)));
          }
          vec3 base = mix(uColorA, uColorB, uMix) * lit * twk + uRim * rim * 0.72;
          vec3 scan = mix(uScanCol, uScanColB, uMix);
          vColor = mix(base, scan, band * 0.9);
          vA = (0.4 + 0.6 * depth) * (1.0 + band * 0.8 + rim * 0.5);
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
          float halo = smoothstep(0.5, 0.0, dd); // wide soft falloff → in-shader bloom
          vec3 col = vColor + core * 0.7 + vColor * halo * 0.28;
          float a = max(max(edge * 0.7, core), halo * 0.22) * vA;
          gl_FragColor = vec4(col, a);
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
      // circular dark backing — matches the round camera lens + gold ring (118)
      ctx.beginPath();
      ctx.arc(cx, cy, 114, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(10,16,30,0.30)';
      ctx.fill();
      ctx.restore();

      const coreHeld = ph.confirmed || ph.keepCore;
      if (coreHeld || ph.processing) {
        // result screens & processing: smooth transition of radius R (76 -> 98) + climax surge
        drawProcessingOrb(ctx, cx, cy, t, { R: state.orbR, climax: state.orbClimax });
      } else {
        if (!show3d) drawParticles(ctx, cx, cy, t); // 3D model replaces the 2D mesh during capture
        if (!state.started && !ph.processing) drawScanLine(ctx, cx, cy, half, accent, t);
        drawCorners(ctx, cx, cy, half, accent, state.started ? 0.95 : 0.5, t);
        drawHalo(ctx, cx, cy, half + 26, state.halo, accent, t);
        if (ph.guide !== undefined && state.halo < 0.82) drawGuide(ctx, cx, cy, ph.guide, accent);
        if (state.step === 'face_detecting' && state.mpActive) drawAlignOverlay(ctx, cx, cy, half, t);
      }
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
    
    // Toggle Camera Permission Hub if permission denied
    const permHub = document.getElementById('perm-hub');
    if (permHub) {
      permHub.classList.toggle('show', step === 'permission_denied');
    }

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
      // earned row: only shown when a real blink-cadence baseline was measured + saved
      const bxBlink = document.getElementById('bx-blink');
      if (bxBlink) bxBlink.hidden = !state.blinkEarned;
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
    const targetOrbR = coreHeld ? 98 : 76;
    state.orbR += (targetOrbR - state.orbR) * 0.075;
    if (state.step === 'baseline_confirmed' && t - state.stepStart < 1400) {
      const p = (t - state.stepStart) / 1400;
      state.orbClimax = Math.sin(p * Math.PI) * (1 - p * 0.4);
    } else {
      state.orbClimax *= 0.92;
    }

    // Demo simulation loop when camera is not available
    if (state.isDemo) {
      const gDemo = { lighting: true, centering: true, stillness: true };
      INDICATORS.forEach((ind) => {
        const dot = document.querySelector('#pin-' + ind.key + ' .pindot');
        if (dot) dot.classList.add('on');
      });
      switch (state.step) {
        case 'environment_check':
          if (t - state.stepStart >= 1200) go('face_detecting');
          break;
        case 'face_detecting':
          if (t - state.stepStart >= 1500) go('face_locked');
          break;
        case 'face_locked':
          if (t - state.stepStart >= 800) go('neutral_capture');
          break;
        case 'neutral_capture':
          state.neutral += 0.008;
          if (state.neutral >= 1) go('arc_left');
          break;
        case 'arc_left':
          state.arc += 0.008;
          if (state.arc >= 0.5) go('arc_right');
          break;
        case 'arc_right':
          state.arc += 0.008;
          if (state.arc >= 1.0) go('stability_pass');
          break;
        case 'stability_pass':
          state.stability += 0.008;
          if (state.stability >= 1.0) go('processing');
          break;
        case 'processing': {
          const pp = clamp01((t - state.stepStart) / 2200);
          const numEl = document.getElementById('proc-pct-num');
          if (numEl) numEl.textContent = String(Math.round(pp * 100));
          if (pp >= 1) {
            updateConfidenceCopy();
            go('baseline_confirmed');
          }
          break;
        }
        default: break;
      }
      return;
    }

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
    // blink-cadence sampling: capture phases only, real landmarks only (never heuristic).
    // dt capped so tracking gaps / tab-away frames can't inflate the measured window.
    if (state.blink && state.mpActive && BLINK_PHASES.has(state.step)) {
      state.blink.feed(state.lm.eyeOpen, Math.min(dt, 200));
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
          saveBlinkBaseline();
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

  // Persist the earned blink-cadence baseline (derived scalars only — no frames,
  // no timelines). Honest degradation: a short or absent measurement (Tier B,
  // MediaPipe CDN blocked) saves nothing and the baseline_data row stays hidden.
  function saveBlinkBaseline() {
    const B = window.TENKI_BLINK;
    const c = state.blink;
    if (!B || !c) return;
    const cpm = B.cadencePerMin(c.blinks, c.windowMs);
    if (cpm == null) return;
    state.blinkEarned = B.save({ cpm, blinks: c.blinks, windowSec: c.windowMs / 1000 });
  }

  // ── public controls ──
  async function begin() {
    if (state.started) return;
    state.started = true;
    state.isDemo = false;
    state.blink = window.TENKI_BLINK
      ? window.TENKI_BLINK.createCounter({ closeBelow: BLINK_CLOSE, openAbove: BLINK_OPEN })
      : null;
    state.blinkEarned = false;
    document.getElementById('cta').classList.add('hidden');
    document.getElementById('indicators').style.opacity = '1';
    const permHub = document.getElementById('perm-hub');
    if (permHub) permHub.classList.remove('show');
    go('permission_check');
    try {
      await startCamera();
      state.envHoldStart = 0;
      go('environment_check');
    } catch (_) {
      go('permission_denied');
    }
  }

  function startDemoSimulation() {
    state.isDemo = true;
    state.started = true;
    const permHub = document.getElementById('perm-hub');
    if (permHub) permHub.classList.remove('show');
    document.getElementById('cta').classList.add('hidden');
    document.getElementById('indicators').style.opacity = '1';
    state.tierA = true;
    state.confSum = 50;
    state.confN = 55;
    state.envHoldStart = 0;
    go('environment_check');
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
      step: 'intro', stepStart: 0, started: false, isDemo: false, tierA: false, detector: null, face: null,
      q: { brightness: 0, uniformity: 0, motion: 1, detail: 0, coverage: 0, centerOffset: 1 },
      gates: { lighting: false, centering: false, stillness: false },
      mpActive: false, lm: { present: false, yaw: 0, centerOffset: 1, coverage: 0, cx: 0.5, cy: 0.5, dist: 0, roll: 0, pitch: 0, eyeOpen: 1 },
      alignHold: {}, alignLocked: {}, alignProg: 0, shownNudge: '', candNudge: '', candSince: 0, alignFlash: 0,
      envHoldStart: 0, detectHoldStart: 0, lossStart: 0,
      neutral: 0, arc: 0, stability: 0, confSum: 0, confN: 0,
      blink: null, blinkEarned: false,
      halo: 0, secured: 0, settle: 0, bloom: 0, lastT: 0,
    });
    const bxBlink = document.getElementById('bx-blink');
    if (bxBlink) bxBlink.hidden = true;
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
    const permHub = document.getElementById('perm-hub');
    if (permHub) permHub.classList.remove('show');
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
    if (cta) {
      cta.dataset.action = 'begin';
      cta.onclick = onCta;
    }

    // Connect Permission Hub buttons
    const retryBtn = document.getElementById('perm-retry-btn');
    if (retryBtn) {
      retryBtn.onclick = () => { state.started = false; begin(); };
    }
    const demoBtn = document.getElementById('perm-demo-btn');
    if (demoBtn) {
      demoBtn.onclick = () => { startDemoSimulation(); };
    }

    window.addEventListener('resize', () => { initStarfield(); });
    requestAnimationFrame(render);
    requestAnimationFrame(loop);
  }

  window.TENKI_ENROLL = { begin, restart };

  // Dev-only headless hook: when the orb-tuner harness sets this flag BEFORE this
  // script loads, expose just the orb renderer and skip the app boot (no camera,
  // no FSM) so scripts/orb-tuner can render drawProcessingOrb in isolation against
  // the IMG_8437 reference. Production never sets the flag, so this is a no-op there.
  if (window.__ORB_HARNESS__) {
    window.TENKI_ORB = { drawProcessingOrb, COLORS };
    return;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
