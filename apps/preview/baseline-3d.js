// ─────────────────────────────────────────────────────────────────────────
// TENKI CORE — Neural Lattice · "Ghost Protocol" (prototype)
//
// First-time face baseline ONLY. The camera feed is never shown/stored — we
// derive 478 face landmarks on-device (MediaPipe) and render them as a CYBERPUNK
// "neural lattice": ~6k bloom-lit diamond data-nodes with multi-scanlines, a
// head-turn glitch, an agent HUD, and a lock ritual (icosahedron core + data
// rings + hex shockwave). No real-face pixels. Privacy-first.
// ─────────────────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { FaceLandmarker, FilesetResolver } from 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.12/vision_bundle.mjs';

const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
const WASM_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.12/wasm';

const C = {
  cyan: new THREE.Color('#00f5ff'), orange: new THREE.Color('#ff6a00'),
  gold: new THREE.Color('#ffc04d'), red: new THREE.Color('#ff2a4d'),
  rim: new THREE.Color('#9bf6ff'),
};

const el = {
  video: document.getElementById('cam-video'),
  scene: document.getElementById('scene'),
  statusLine: document.getElementById('status-line'),
  statusChip: document.getElementById('statusChip'),
  instruction: document.getElementById('instruction'),
  subtitle: document.getElementById('subtitle'),
  meter: document.getElementById('meter'),
  meterFill: document.getElementById('meter-fill'),
  cta: document.getElementById('cta'),
  nodes: document.getElementById('nodes'),
  sync: document.getElementById('sync'),
  binary: document.getElementById('binary'),
  reticle: document.getElementById('reticle'),
  fatal: document.getElementById('fatal'),
  fatalTitle: document.getElementById('fatal-title'),
  fatalMsg: document.getElementById('fatal-msg'),
  ghostToggle: document.getElementById('ghost-toggle'),
};

// ── Ghost Protocol sound (Web Audio; opt-in, iOS-safe) ──────────────────────
// A low breathing hum during scanning + ticks on phase changes + a lock whoosh.
const Sfx = (() => {
  let ctx = null, master = null, enabled = false, humGain = null, humOscs = [], lfo = null;
  function ensure() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.16; master.connect(ctx.destination);
  }
  function setEnabled(on) {
    enabled = on;
    if (on) { ensure(); if (ctx && ctx.state === 'suspended') ctx.resume(); }
    else { stopHum(); }
  }
  function startHum() {
    if (!enabled || !ctx || humGain) return;
    humGain = ctx.createGain(); humGain.gain.value = 0.0001; humGain.connect(master);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420; lp.connect(humGain);
    [55, 55.4, 110].forEach((f, i) => {
      const o = ctx.createOscillator(); o.type = i === 2 ? 'sine' : 'sawtooth'; o.frequency.value = f;
      const g = ctx.createGain(); g.gain.value = i === 2 ? 0.25 : 0.5; o.connect(g); g.connect(lp); o.start(); humOscs.push(o);
    });
    lfo = ctx.createOscillator(); lfo.frequency.value = 0.18; // slow breathing
    const la = ctx.createGain(); la.gain.value = 0.05; lfo.connect(la); la.connect(humGain.gain); lfo.start();
    humGain.gain.setTargetAtTime(0.1, ctx.currentTime, 0.8);
  }
  function stopHum() {
    if (!ctx || !humGain) return;
    humGain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.3);
    const oscs = humOscs, g = humGain, l = lfo;
    setTimeout(() => { try { oscs.forEach((o) => o.stop()); if (l) l.stop(); g.disconnect(); } catch (_) {} }, 800);
    humOscs = []; humGain = null; lfo = null;
  }
  function blip(freq, dur, type, vol) {
    if (!enabled || !ctx) return;
    const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq;
    const g = ctx.createGain(); o.connect(g); g.connect(master);
    const t = ctx.currentTime;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.start(t); o.stop(t + dur + 0.02);
  }
  function tick() { blip(1180, 0.06, 'square', 0.1); }
  function whoosh() {
    if (!enabled || !ctx) return;
    const dur = 0.7, buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
    const d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource(); src.buffer = buf;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.2;
    const t = ctx.currentTime;
    bp.frequency.setValueAtTime(300, t); bp.frequency.exponentialRampToValueAtTime(2400, t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.2, t + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(bp); bp.connect(g); g.connect(master); src.start(t); src.stop(t + dur);
    blip(70, 0.5, 'sine', 0.3);
  }
  function confirm() { blip(660, 0.12, 'sine', 0.22); setTimeout(() => blip(990, 0.18, 'sine', 0.2), 120); }
  return { setEnabled, startHum, stopHum, tick, whoosh, confirm, isOn: () => enabled };
})();

const SCALE = 2.7, DEPTH = 1.6, SMOOTH = 0.4, K_PER_EDGE = 2;
const FORM_MS = 2600, LOCK_MS = 1800, TURN_TARGET = 0.46, SCAN_MAX_MS = 11000;

const S = {
  phase: 'loading', phaseT: performance.now(), lastNow: performance.now(),
  reveal: 0, progress: 0, colorMix: 0, collapse: 0,
  yaw: 0, prevYaw: 0, glitch: 0, yawMin: 0, yawMax: 0,
  haveFace: false, centeredMs: 0, raf: 0, binN: 0,
};

let landmarker = null, N = 478, lmTarget = null, lmCur = null, seen = false, lastVideoTime = -1;
let P = 0, pPos = null, pScatter = null, pRnd = null, aIdx = null, bIdx = null, tArr = null;
let renderer, scene, camera, group, composer, points, pmat, stars;
let icoCore, ring1, ring2, shock;

// ── densify tessellation → particle set ─────────────────────────────────────
function buildParticles() {
  const tess = FaceLandmarker.FACE_LANDMARKS_TESSELATION || [];
  const a = [], b = [], t = [];
  for (let i = 0; i < N; i++) { a.push(i); b.push(i); t.push(0); }
  for (const e of tess) for (let k = 0; k < K_PER_EDGE; k++) { a.push(e.start); b.push(e.end); t.push((k + 1) / (K_PER_EDGE + 1)); }
  P = a.length;
  aIdx = new Uint16Array(a); bIdx = new Uint16Array(b); tArr = new Float32Array(t);
  pPos = new Float32Array(P * 3); pScatter = new Float32Array(P * 3); pRnd = new Float32Array(P);
  for (let i = 0; i < P; i++) {
    const u = Math.random() * 2 - 1, th = Math.random() * Math.PI * 2, r = 2.4 + Math.random() * 1.3, s = Math.sqrt(1 - u * u);
    pScatter[i * 3] = Math.cos(th) * s * r; pScatter[i * 3 + 1] = u * r; pScatter[i * 3 + 2] = Math.sin(th) * s * r;
    pRnd[i] = Math.random();
  }
}

function particleMaterial(pr) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 }, uSize: { value: 8.5 * pr }, uScanY: { value: 0 }, uMix: { value: 0 },
      uGlitch: { value: 0 }, uColorA: { value: C.cyan }, uColorB: { value: C.gold },
      uScanCol: { value: C.orange }, uRim: { value: C.rim }, uDim: { value: 1 },
    },
    vertexShader: `
      attribute float aRnd;
      uniform float uTime, uSize, uScanY, uMix, uGlitch;
      uniform vec3 uColorA, uColorB, uScanCol, uRim;
      varying vec3 vColor; varying float vA;
      float hash(float n){ return fract(sin(n) * 43758.5453); }
      void main() {
        vec3 p = position;
        if (uGlitch > 0.001) {                                   // digital glitch on head-turn
          float h = hash(dot(p.xy, vec2(12.9898, 78.233)) + floor(uTime * 28.0));
          p.x += (h - 0.5) * uGlitch * 0.26;
          p.y += (hash(h * 7.0) - 0.5) * uGlitch * 0.18;
        }
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        float depth = clamp(p.z * 0.6 + 0.5, 0.0, 1.0);
        float lit = 0.45 + 0.55 * depth;
        float twk = 0.8 + 0.2 * sin(uTime * 3.0 + aRnd * 6.283);
        float rim = smoothstep(0.55, 1.05, length(p.xy));        // edge-lit holographic outline
        float band = 0.0;                                        // 3 thin sweeping scanlines
        for (int i = 0; i < 3; i++) {
          float yk = -1.4 + fract(uScanY + float(i) * 0.34) * 2.8;
          band = max(band, smoothstep(0.05, 0.0, abs(p.y - yk)));
        }
        vec3 base = mix(uColorA, uColorB, uMix) * lit * twk + uRim * rim * 0.55;
        vColor = mix(base, uScanCol, band * 0.95);
        vA = (0.4 + 0.6 * depth) * (1.0 + band * 0.8);
        gl_PointSize = uSize * (1.0 / -mv.z) * (0.6 + 0.7 * depth) * (1.0 + band * 1.6 + rim * 0.4);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform float uDim;
      varying vec3 vColor; varying float vA;
      void main() {
        vec2 q = abs(gl_PointCoord - 0.5);
        float dd = q.x + q.y;                                    // diamond "data node"
        float edge = smoothstep(0.5, 0.12, dd);
        float core = smoothstep(0.16, 0.0, dd);
        gl_FragColor = vec4(vColor + core * 0.7, max(edge * 0.7, core) * vA * uDim);
      }`,
  });
}

function initThree() {
  const pr = Math.min(window.devicePixelRatio || 1, 2);
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(pr); renderer.setSize(window.innerWidth, window.innerHeight); renderer.setClearColor(0x000000, 0);
  el.scene.appendChild(renderer.domElement);

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(46, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 0, 3.0);
  group = new THREE.Group(); scene.add(group);

  const sg = new THREE.BufferGeometry(), sp = new Float32Array(240 * 3);
  for (let i = 0; i < sp.length; i++) sp[i] = (Math.random() - 0.5) * 18;
  sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0x16384a, size: 0.02, transparent: true, opacity: 0.6 }));
  scene.add(stars);

  buildParticles();
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  geo.setAttribute('aRnd', new THREE.BufferAttribute(pRnd, 1));
  pmat = particleMaterial(pr);
  points = new THREE.Points(geo, pmat); points.frustumCulled = false;
  group.add(points);

  // lock ritual meshes
  icoCore = new THREE.Mesh(new THREE.IcosahedronGeometry(0.17, 0),
    new THREE.MeshBasicMaterial({ color: C.red.clone(), wireframe: true, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  icoCore.scale.setScalar(0.01); group.add(icoCore);
  const ringMat = () => new THREE.MeshBasicMaterial({ color: C.gold.clone(), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false });
  ring1 = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.008, 8, 64), ringMat());
  ring2 = new THREE.Mesh(new THREE.TorusGeometry(0.30, 0.006, 8, 52), ringMat());
  group.add(ring1); group.add(ring2);
  shock = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.0, 6), new THREE.MeshBasicMaterial({ color: C.orange.clone(), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false }));
  shock.scale.setScalar(0.01); group.add(shock);

  composer = new EffectComposer(renderer);
  composer.setPixelRatio(Math.min(pr, 1.5));
  composer.setSize(window.innerWidth, window.innerHeight);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.95, 0.3, 0.2)); // sharper holographic bloom

  window.addEventListener('resize', onResize);
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight); composer.setSize(window.innerWidth, window.innerHeight);
}

// ── camera + model ──────────────────────────────────────────────────────────
async function startCamera() {
  const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
  el.video.srcObject = stream; await el.video.play();
}
function stopCamera() { const s = el.video.srcObject; if (s) { s.getTracks().forEach((t) => t.stop()); el.video.srcObject = null; } }
async function loadModel() {
  const fileset = await FilesetResolver.forVisionTasks(WASM_URL);
  const mk = (d) => FaceLandmarker.createFromOptions(fileset, { baseOptions: { modelAssetPath: MODEL_URL, delegate: d }, runningMode: 'VIDEO', numFaces: 1 });
  try { landmarker = await mk('GPU'); } catch (_) { landmarker = await mk('CPU'); }
}

function ingest(L) {
  N = L.length;
  let cx = 0, cy = 0, cz = 0;
  for (let i = 0; i < N; i++) { cx += L[i].x; cy += L[i].y; cz += L[i].z; }
  cx /= N; cy /= N; cz /= N;
  for (let i = 0; i < N; i++) {
    lmTarget[i * 3] = -(L[i].x - cx) * SCALE;
    lmTarget[i * 3 + 1] = -(L[i].y - cy) * SCALE;
    lmTarget[i * 3 + 2] = -(L[i].z - cz) * SCALE * DEPTH;
  }
  if (!seen) { for (let i = 0; i < N * 3; i++) lmCur[i] = lmTarget[i]; seen = true; }
  const nose = L[1], le = L[33], re = L[263], span = Math.abs(re.x - le.x) || 1e-3;
  S.prevYaw = S.yaw;
  S.yaw = (nose.x - (le.x + re.x) / 2) / span;
  S.glitch = Math.min(1, S.glitch + Math.abs(S.yaw - S.prevYaw) * 9); // head-turn → glitch pulse
}

// ── phase machine ───────────────────────────────────────────────────────────
function setCopy(line, instr, sub) { el.statusLine.textContent = line; el.instruction.textContent = instr; el.subtitle.textContent = sub; }
function go(p) {
  S.phase = p; S.phaseT = performance.now();
  if (p === 'forming') Sfx.tick();
  else if (p === 'scanning') { Sfx.startHum(); Sfx.tick(); }
  else if (p === 'locking') { Sfx.stopHum(); Sfx.whoosh(); }
  else if (p === 'locked') Sfx.confirm();
}

function updatePhase(now, dt) {
  switch (S.phase) {
    case 'await_face':
      setCopy('Acquiring target', 'Bring your face into frame', 'Hold your phone at eye level.');
      S.centeredMs = (S.haveFace && Math.abs(S.yaw) < 0.16) ? S.centeredMs + dt : 0;
      if (S.centeredMs > 450) { S.reveal = 0; go('forming'); }
      break;
    case 'forming':
      setCopy('Mapping lattice', 'Mapping your lattice', 'Thousands of nodes — stay relaxed.');
      S.reveal = Math.min(1, (now - S.phaseT) / FORM_MS);
      if (S.reveal >= 1) { S.yawMin = S.yaw; S.yawMax = S.yaw; go('scanning'); }
      break;
    case 'scanning': {
      setCopy('Calibrating', 'Turn slowly left, then right', 'Calibrating your neural lattice.');
      el.meter.classList.add('on');
      if (S.haveFace) { S.yawMin = Math.min(S.yawMin, S.yaw); S.yawMax = Math.max(S.yawMax, S.yaw); }
      S.progress = Math.max(S.progress, Math.min(1, (S.yawMax - S.yawMin) / TURN_TARGET));
      S.colorMix = 0.2 * S.progress;
      if (S.progress >= 1 || (now - S.phaseT > SCAN_MAX_MS && S.progress > 0.4)) go('locking');
      break;
    }
    case 'locking': {
      setCopy('Encrypting', 'Locking baseline…', 'Encrypting on this device.');
      const k = Math.min(1, (now - S.phaseT) / LOCK_MS);
      S.collapse = k * k; S.colorMix = 0.2 + 0.8 * k; S.progress = 1;
      if (k >= 1) { stopCamera(); go('locked'); }
      break;
    }
    case 'locked':
      setCopy('Lattice online', 'Identity confirmed.', 'Your neural lattice is online — on this device.');
      el.statusChip.textContent = 'Online'; el.statusChip.classList.add('online');
      el.meter.classList.remove('on'); el.cta.classList.add('on');
      break;
  }
  el.reticle.classList.toggle('on', S.phase === 'forming' || S.phase === 'scanning' || S.phase === 'await_face');
  el.meterFill.style.width = (S.progress * 100).toFixed(0) + '%';
  updateHud(now);
}

function updateHud(now) {
  el.nodes.textContent = P.toLocaleString('en-US');
  const sync = S.phase === 'locked' ? 1 : Math.min(0.987, 0.32 * S.reveal + 0.667 * S.progress);
  el.sync.textContent = (sync * 100).toFixed(1) + '%';
  if ((S.binN = (S.binN + 1) % 5) === 0) {
    let s = ''; for (let i = 0; i < 18; i++) s += Math.random() > 0.5 ? '1' : '0';
    el.binary.textContent = s;
  }
}

// ── per-frame geometry ──────────────────────────────────────────────────────
function writeFrame(t) {
  for (let i = 0; i < N * 3; i++) lmCur[i] += (lmTarget[i] - lmCur[i]) * SMOOTH;
  const formed = S.phase === 'scanning' || S.phase === 'locking' || S.phase === 'locked';
  const collapse = S.collapse;
  for (let i = 0; i < P; i++) {
    const a = aIdx[i] * 3, b = bIdx[i] * 3, tt = tArr[i], j = i * 3;
    let fx = lmCur[a] + (lmCur[b] - lmCur[a]) * tt;
    let fy = lmCur[a + 1] + (lmCur[b + 1] - lmCur[a + 1]) * tt;
    let fz = lmCur[a + 2] + (lmCur[b + 2] - lmCur[a + 2]) * tt;
    if (!formed) {
      const amt = Math.max(0, Math.min(1, (S.reveal - pRnd[i] * 0.32) / 0.68));
      const e = amt * amt * (3 - 2 * amt);
      fx = pScatter[j] + (fx - pScatter[j]) * e; fy = pScatter[j + 1] + (fy - pScatter[j + 1]) * e; fz = pScatter[j + 2] + (fz - pScatter[j + 2]) * e;
    }
    if (collapse > 0) { const m = 1 - collapse; fx *= m; fy *= m; fz *= m; }
    pPos[j] = fx; pPos[j + 1] = fy; pPos[j + 2] = fz;
  }
  points.geometry.attributes.position.needsUpdate = true;

  S.glitch *= 0.88;
  pmat.uniforms.uTime.value = t * 0.001;
  pmat.uniforms.uMix.value = S.colorMix;
  pmat.uniforms.uDim.value = 1 - collapse * 0.85;
  pmat.uniforms.uGlitch.value = S.glitch;
  pmat.uniforms.uScanY.value = (S.phase === 'forming' || S.phase === 'await_face') ? S.reveal : t * 0.00035;

  // lock ritual
  const lk = S.phase === 'locked' ? 1 : collapse;
  icoCore.material.color.copy(C.red).lerp(C.gold, lk);
  icoCore.material.opacity += ((lk > 0.02 ? 0.9 : 0) - icoCore.material.opacity) * 0.14;
  const cs = 0.05 + lk * 0.95; icoCore.scale.setScalar(cs);
  icoCore.rotation.y = t * 0.0016; icoCore.rotation.x = t * 0.0011;
  const ro = (lk > 0.05 ? 0.8 : 0);
  ring1.material.opacity += (ro - ring1.material.opacity) * 0.12; ring2.material.opacity = ring1.material.opacity;
  ring1.scale.setScalar(0.4 + lk * 0.7); ring2.scale.setScalar(0.4 + lk * 0.7);
  ring1.rotation.x = t * 0.0012; ring1.rotation.y = t * 0.0018; ring2.rotation.y = -t * 0.0015; ring2.rotation.z = t * 0.001;
  if (S.phase === 'locking' || S.phase === 'locked') {
    const rs = 0.3 + collapse * 3.6; shock.scale.set(rs, rs, 1);
    shock.material.opacity = Math.max(0, 0.85 * (1 - collapse)); shock.rotation.z = t * 0.0008;
  }

  const sway = S.phase === 'locked' ? 0 : 0.1;
  group.rotation.y = Math.sin(t * 0.00045) * sway; group.rotation.x = Math.sin(t * 0.0003) * sway * 0.3;
}

function loop() {
  S.raf = requestAnimationFrame(loop);
  const now = performance.now(), dt = Math.min(48, now - S.lastNow); S.lastNow = now;
  if (landmarker && el.video.readyState >= 2 && S.phase !== 'locked') {
    if (el.video.currentTime !== lastVideoTime) {
      lastVideoTime = el.video.currentTime;
      try {
        const res = landmarker.detectForVideo(el.video, now);
        if (res && res.faceLandmarks && res.faceLandmarks.length) { S.haveFace = true; ingest(res.faceLandmarks[0]); } else S.haveFace = false;
      } catch (_) { /* transient */ }
    }
  }
  if (S.phase !== 'loading') updatePhase(now, dt);
  if (seen) writeFrame(now);
  composer.render();
}

// ── boot ───────────────────────────────────────────────────────────────────
function fatal(title, msg) { el.fatalTitle.textContent = title; el.fatalMsg.textContent = msg; el.fatal.classList.add('on'); }
el.cta.addEventListener('click', () => { const h = el.cta.dataset.href; if (h) window.location.href = h; });

el.ghostToggle.addEventListener('click', () => {
  const on = !Sfx.isOn();
  Sfx.setEnabled(on); // the tap also unlocks AudioContext on iOS
  el.ghostToggle.textContent = on ? '◼ Ghost Protocol · Sound ON' : '▶ Ghost Protocol · Sound';
  el.ghostToggle.classList.toggle('on', on);
  if (on && S.phase === 'scanning') Sfx.startHum();
});

async function boot() {
  lmTarget = new Float32Array(478 * 3); lmCur = new Float32Array(478 * 3);
  initThree(); loop();
  try { await loadModel(); } catch (_) { fatal('Could not load the lattice engine', 'Check your connection and reload. Everything runs on-device once loaded.'); return; }
  try { await startCamera(); } catch (_) { fatal('Camera access needed', 'We build your baseline on-device using the front camera. No image ever leaves your phone — enable camera and reload.'); return; }
  go('await_face');
}

boot();
