// ─────────────────────────────────────────────────────────────────────────
// TENKI CORE — 3D Baseline modeling (prototype) · "Soul Lattice" leap build
//
// First-time face baseline ONLY (Model B enrollment). The camera feed is never
// shown or stored — we derive 478 face landmarks on-device with MediaPipe and
// render them as a LUMINOUS PARTICLE LATTICE: thousands of bloom-lit points
// (densified along the face tessellation) that materialise into an abstract 3D
// structure, sweep-scan, then collapse into a gold core. No real-face pixels.
//
// Privacy-first: detection stops + camera track released the moment it locks.
// ─────────────────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import {
  FaceLandmarker,
  FilesetResolver,
} from 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.12/vision_bundle.mjs';

const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
const WASM_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.12/wasm';

const COL = { cyan: new THREE.Color('#36e6ff'), gold: new THREE.Color('#ffc85e'), white: new THREE.Color('#fff4d8') };

const el = {
  video: document.getElementById('cam-video'),
  scene: document.getElementById('scene'),
  dot: document.getElementById('dot'),
  status: document.getElementById('status'),
  instruction: document.getElementById('instruction'),
  subtitle: document.getElementById('subtitle'),
  meter: document.getElementById('meter'),
  meterFill: document.getElementById('meter-fill'),
  cta: document.getElementById('cta'),
  fatal: document.getElementById('fatal'),
  fatalTitle: document.getElementById('fatal-title'),
  fatalMsg: document.getElementById('fatal-msg'),
};

// tuning
const SCALE = 2.7;
const DEPTH = 1.6;
const SMOOTH = 0.4;
const K_PER_EDGE = 2; // samples per tessellation edge → ~5–6k particles
const FORM_MS = 2600;
const LOCK_MS = 1700;
const TURN_TARGET = 0.46;
const SCAN_MAX_MS = 11000;

const S = {
  phase: 'loading', phaseT: performance.now(), lastNow: performance.now(),
  reveal: 0, progress: 0, colorMix: 0, collapse: 0,
  yawMin: 0, yawMax: 0, yaw: 0, haveFace: false, centeredMs: 0, raf: 0,
};

let landmarker = null;
let N = 478;
let lmTarget = null, lmCur = null; // smoothed landmark positions (N*3)
let seen = false, lastVideoTime = -1;

// particle buffers
let P = 0;
let pPos = null, pScatter = null, pRnd = null, aIdx = null, bIdx = null, tArr = null;

// three
let renderer, scene, camera, group, composer, bloom, points, pmat, core, ring, stars;

// ── densify tessellation into a particle set ────────────────────────────────
function buildParticles() {
  const tess = FaceLandmarker.FACE_LANDMARKS_TESSELATION || [];
  const a = [], b = [], t = [];
  // crisp structural vertices
  for (let i = 0; i < N; i++) { a.push(i); b.push(i); t.push(0); }
  // interpolated points along each edge
  for (const e of tess) {
    for (let k = 0; k < K_PER_EDGE; k++) {
      a.push(e.start); b.push(e.end); t.push((k + 1) / (K_PER_EDGE + 1));
    }
  }
  P = a.length;
  aIdx = new Uint16Array(a); bIdx = new Uint16Array(b); tArr = new Float32Array(t);
  pPos = new Float32Array(P * 3);
  pScatter = new Float32Array(P * 3);
  pRnd = new Float32Array(P);
  for (let i = 0; i < P; i++) {
    // scatter origin on a sphere shell (for the materialise fly-in)
    const u = Math.random() * 2 - 1, th = Math.random() * Math.PI * 2, r = 2.4 + Math.random() * 1.2;
    const s = Math.sqrt(1 - u * u);
    pScatter[i * 3] = Math.cos(th) * s * r;
    pScatter[i * 3 + 1] = u * r;
    pScatter[i * 3 + 2] = Math.sin(th) * s * r;
    pRnd[i] = Math.random();
  }
}

// ── particle shader (depth-lit + scan band + twinkle) ───────────────────────
function particleMaterial(pixelRatio) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 }, uSize: { value: 9.0 * pixelRatio }, uScanY: { value: -2 },
      uMix: { value: 0 }, uColorA: { value: COL.cyan }, uColorB: { value: COL.gold },
      uScan: { value: COL.white }, uDim: { value: 1 },
    },
    vertexShader: `
      attribute float aRnd;
      uniform float uTime, uSize, uScanY, uMix;
      uniform vec3 uColorA, uColorB, uScan;
      varying vec3 vColor; varying float vA;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        float depth = clamp(position.z * 0.6 + 0.5, 0.0, 1.0);     // closer = brighter
        float lit = 0.5 + 0.5 * depth;
        float twk = 0.78 + 0.22 * sin(uTime * 3.0 + aRnd * 6.283);
        float band = smoothstep(0.14, 0.0, abs(position.y - uScanY));
        vec3 base = mix(uColorA, uColorB, uMix) * lit * twk;
        vColor = mix(base, uScan, band * 0.9);
        vA = 0.45 + 0.55 * depth;
        gl_PointSize = uSize * (1.0 / -mv.z) * (0.7 + 0.7 * depth) * (1.0 + band * 1.4);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform float uDim;
      varying vec3 vColor; varying float vA;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, d);
        gl_FragColor = vec4(vColor, a * vA * uDim);
      }`,
  });
}

function glowSprite() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.4, 'rgba(255,255,255,0.85)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

function initThree() {
  const pr = Math.min(window.devicePixelRatio || 1, 2);
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(pr);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x000000, 0);
  el.scene.appendChild(renderer.domElement);

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(46, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 0, 3.0);
  group = new THREE.Group();
  scene.add(group);

  // faint starfield
  const sg = new THREE.BufferGeometry();
  const sp = new Float32Array(260 * 3);
  for (let i = 0; i < sp.length; i++) sp[i] = (Math.random() - 0.5) * 18;
  sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0x2c3a55, size: 0.02, transparent: true, opacity: 0.5 }));
  scene.add(stars);

  // particle lattice
  buildParticles();
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  geo.setAttribute('aRnd', new THREE.BufferAttribute(pRnd, 1));
  pmat = particleMaterial(pr);
  points = new THREE.Points(geo, pmat);
  points.frustumCulled = false;
  group.add(points);

  // gold core (lock)
  core = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowSprite(), color: COL.gold, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  core.scale.set(0.01, 0.01, 0.01);
  group.add(core);

  // shockwave ring (lock)
  ring = new THREE.Mesh(
    new THREE.RingGeometry(0.92, 1.0, 72),
    new THREE.MeshBasicMaterial({ color: COL.gold, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false }),
  );
  ring.scale.set(0.01, 0.01, 0.01);
  group.add(ring);

  // bloom
  composer = new EffectComposer(renderer);
  composer.setPixelRatio(Math.min(pr, 1.5)); // bloom at reduced res for mobile
  composer.setSize(window.innerWidth, window.innerHeight);
  composer.addPass(new RenderPass(scene, camera));
  bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.15, 0.6, 0.0);
  composer.addPass(bloom);

  window.addEventListener('resize', onResize);
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
}

// ── camera + model ──────────────────────────────────────────────────────────
async function startCamera() {
  const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
  el.video.srcObject = stream;
  await el.video.play();
}
function stopCamera() {
  const s = el.video.srcObject;
  if (s) { s.getTracks().forEach((t) => t.stop()); el.video.srcObject = null; }
}
async function loadModel() {
  const fileset = await FilesetResolver.forVisionTasks(WASM_URL);
  const make = (delegate) => FaceLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: MODEL_URL, delegate }, runningMode: 'VIDEO', numFaces: 1,
  });
  try { landmarker = await make('GPU'); } catch (_) { landmarker = await make('CPU'); }
}

// ── landmark ingest ─────────────────────────────────────────────────────────
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
  const nose = L[1], le = L[33], re = L[263];
  const span = Math.abs(re.x - le.x) || 1e-3;
  S.yaw = (nose.x - (le.x + re.x) / 2) / span;
}

// ── phase machine ───────────────────────────────────────────────────────────
function setCopy(i, s) { el.instruction.textContent = i; el.subtitle.textContent = s; }
function go(p) { S.phase = p; S.phaseT = performance.now(); }

function updatePhase(now, dt) {
  switch (S.phase) {
    case 'await_face':
      el.status.textContent = 'Looking for you…';
      setCopy('Bring your face into frame', 'Hold your phone at eye level.');
      S.centeredMs = (S.haveFace && Math.abs(S.yaw) < 0.16) ? S.centeredMs + dt : 0;
      if (S.centeredMs > 450) { S.reveal = 0; go('forming'); }
      break;
    case 'forming':
      el.status.textContent = 'Capturing depth';
      setCopy('Materialising your model', 'Thousands of points — stay relaxed.');
      S.reveal = Math.min(1, (now - S.phaseT) / FORM_MS);
      if (S.reveal >= 1) { S.yawMin = S.yaw; S.yawMax = S.yaw; go('scanning'); }
      break;
    case 'scanning': {
      el.status.textContent = 'Building 3D baseline';
      setCopy('Slowly turn left, then right', 'Watch your model rotate as it locks in.');
      el.meter.classList.add('on');
      if (S.haveFace) { S.yawMin = Math.min(S.yawMin, S.yaw); S.yawMax = Math.max(S.yawMax, S.yaw); }
      S.progress = Math.max(S.progress, Math.min(1, (S.yawMax - S.yawMin) / TURN_TARGET));
      S.colorMix = 0.18 * S.progress;
      if (S.progress >= 1 || (now - S.phaseT > SCAN_MAX_MS && S.progress > 0.4)) go('locking');
      break;
    }
    case 'locking': {
      el.status.textContent = 'Securing baseline';
      setCopy('Locking your baseline…', 'Encrypting on this device.');
      el.dot.classList.add('gold');
      const k = Math.min(1, (now - S.phaseT) / LOCK_MS);
      S.collapse = k * k; S.colorMix = 0.18 + 0.82 * k; S.progress = 1;
      if (k >= 1) { stopCamera(); go('locked'); }
      break;
    }
    case 'locked':
      el.status.textContent = 'Baseline established';
      setCopy('Baseline locked.', 'Your 3D baseline is set — privately, on this device.');
      el.dot.classList.add('gold'); el.meter.classList.remove('on'); el.cta.classList.add('on');
      break;
  }
  el.meterFill.style.width = (S.progress * 100).toFixed(0) + '%';
}

// ── per-frame geometry write ────────────────────────────────────────────────
function writeFrame(t) {
  // smooth landmarks
  for (let i = 0; i < N * 3; i++) lmCur[i] += (lmTarget[i] - lmCur[i]) * SMOOTH;

  const formed = S.phase === 'scanning' || S.phase === 'locking' || S.phase === 'locked';
  const collapse = S.collapse;
  for (let i = 0; i < P; i++) {
    const a = aIdx[i] * 3, b = bIdx[i] * 3, tt = tArr[i], j = i * 3;
    // face-space position = lerp along the tessellation edge
    let fx = lmCur[a] + (lmCur[b] - lmCur[a]) * tt;
    let fy = lmCur[a + 1] + (lmCur[b + 1] - lmCur[a + 1]) * tt;
    let fz = lmCur[a + 2] + (lmCur[b + 2] - lmCur[a + 2]) * tt;
    // materialise: fly in from scatter → face, staggered per particle
    if (!formed) {
      const amt = Math.max(0, Math.min(1, (S.reveal - pRnd[i] * 0.32) / 0.68));
      const e = amt * amt * (3 - 2 * amt); // smoothstep
      fx = pScatter[j] + (fx - pScatter[j]) * e;
      fy = pScatter[j + 1] + (fy - pScatter[j + 1]) * e;
      fz = pScatter[j + 2] + (fz - pScatter[j + 2]) * e;
    }
    if (collapse > 0) { const m = 1 - collapse; fx *= m; fy *= m; fz *= m; }
    pPos[j] = fx; pPos[j + 1] = fy; pPos[j + 2] = fz;
  }
  points.geometry.attributes.position.needsUpdate = true;

  // shader uniforms
  pmat.uniforms.uTime.value = t * 0.001;
  pmat.uniforms.uMix.value = S.colorMix;
  pmat.uniforms.uDim.value = 1 - collapse * 0.85;
  // scan band: sweeps with forming, gentle drift afterward
  pmat.uniforms.uScanY.value = !formed ? (-1.4 + S.reveal * 2.8)
    : 1.2 * Math.sin(t * 0.0011);

  // gold core grows on collapse / locked
  const coreTarget = S.phase === 'locked' ? 0.95 : collapse;
  core.material.opacity += (coreTarget - core.material.opacity) * 0.14;
  const cs = 0.05 + coreTarget * 0.9 + (S.phase === 'locked' ? 0.06 * Math.sin(t * 0.003) : 0);
  core.scale.set(cs, cs, cs);

  // shockwave ring expands once during locking
  if (S.phase === 'locking' || S.phase === 'locked') {
    const rs = 0.3 + collapse * 3.4;
    ring.scale.set(rs, rs, 1);
    ring.material.opacity = Math.max(0, 0.8 * (1 - collapse));
  }

  // gentle breathing rotation; real head-turn already rotates the lattice
  const sway = S.phase === 'locked' ? 0 : 0.12;
  group.rotation.y = Math.sin(t * 0.00045) * sway;
  group.rotation.x = Math.sin(t * 0.0003) * sway * 0.35;
}

// ── main loop ───────────────────────────────────────────────────────────────
function loop() {
  S.raf = requestAnimationFrame(loop);
  const now = performance.now();
  const dt = Math.min(48, now - S.lastNow); S.lastNow = now;

  if (landmarker && el.video.readyState >= 2 && S.phase !== 'locked') {
    if (el.video.currentTime !== lastVideoTime) {
      lastVideoTime = el.video.currentTime;
      try {
        const res = landmarker.detectForVideo(el.video, now);
        if (res && res.faceLandmarks && res.faceLandmarks.length) { S.haveFace = true; el.dot.style.opacity = '1'; ingest(res.faceLandmarks[0]); }
        else S.haveFace = false;
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

async function boot() {
  lmTarget = new Float32Array(478 * 3);
  lmCur = new Float32Array(478 * 3);
  initThree();
  loop();
  try { await loadModel(); }
  catch (_) { fatal('Could not load the depth engine', 'Check your connection and reload. Everything runs on-device once loaded.'); return; }
  try { await startCamera(); }
  catch (_) { fatal('Camera access needed', 'We build your baseline on-device using the front camera. No image ever leaves your phone — enable camera and reload.'); return; }
  go('await_face');
}

boot();
