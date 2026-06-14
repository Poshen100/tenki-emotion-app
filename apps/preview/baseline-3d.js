// ─────────────────────────────────────────────────────────────────────────
// TENKI CORE — 3D Baseline modeling (prototype)
//
// First-time face baseline ONLY (Model B enrollment ceremony). The camera feed
// is never shown or stored — we derive 468/478 face landmarks on-device with
// MediaPipe FaceLandmarker and render them as an abstract glowing 3D point
// cloud + mesh (the "dot projector" / Face-ID aesthetic), so the user sees a
// 3D model of themselves WITHOUT their actual face being displayed.
//
// Ceremony: forming (scan sweep) → turn-to-rotate scan → lock-collapse to a
// gold core → "Baseline locked." Privacy-first: detection stops + camera track
// is released the moment the baseline locks.
// ─────────────────────────────────────────────────────────────────────────
import * as THREE from 'three';
import {
  FaceLandmarker,
  FilesetResolver,
} from 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.12/vision_bundle.mjs';

const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
const WASM_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.12/wasm';

const COL = {
  cyan: new THREE.Color('#36e6ff'),
  gold: new THREE.Color('#ffc85e'),
  white: new THREE.Color('#fff4d8'),
};

// DOM
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
const SCALE = 2.7; // landmark-space → world units
const DEPTH = 1.5; // exaggerate z for a 3D pop
const SMOOTH = 0.4; // point position easing (anti-jitter)
const FORM_MS = 2000; // scan-sweep reveal duration
const LOCK_MS = 1500; // collapse-to-core duration
const TURN_TARGET = 0.46; // yaw span (proxy units) needed to "complete" the scan
const SCAN_MAX_MS = 11000; // fallback so the ceremony never dead-ends

// runtime state
const S = {
  phase: 'loading', // loading → await_face → forming → scanning → locking → locked
  t0: performance.now(),
  phaseT: performance.now(),
  reveal: 0, // 0..1 forming sweep
  progress: 0, // 0..1 scan coverage
  colorMix: 0, // 0 cyan (active) → 1 gold (secured)
  collapse: 0, // 0..1 lock collapse
  yawMin: 0,
  yawMax: 0,
  yaw: 0,
  haveFace: false,
  centeredMs: 0,
  raf: 0,
};

let landmarker = null;
let N = 478;
let target = null; // Float32Array N*3 (centered, world)
let cur = null; // Float32Array N*3 smoothed
let sortByY = null; // indices sorted bottom→top for the reveal sweep
let lastVideoTime = -1;

// three objects
let renderer, scene, camera, group, points, lines, core, stars;
let pointColors, lineIdx;

// ── three.js setup ─────────────────────────────────────────────────────────
function sprite() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.35, 'rgba(255,255,255,0.9)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  return t;
}

function initThree() {
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  el.scene.appendChild(renderer.domElement);

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(48, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 0, 3.0);

  group = new THREE.Group();
  scene.add(group);

  // faint starfield for depth
  const sg = new THREE.BufferGeometry();
  const sp = new Float32Array(280 * 3);
  for (let i = 0; i < sp.length; i++) sp[i] = (Math.random() - 0.5) * 16;
  sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  stars = new THREE.Points(
    sg,
    new THREE.PointsMaterial({ color: 0x33405a, size: 0.018, transparent: true, opacity: 0.5 }),
  );
  scene.add(stars);

  // landmark point cloud
  const geo = new THREE.BufferGeometry();
  cur = new Float32Array(N * 3);
  target = new Float32Array(N * 3);
  pointColors = new Float32Array(N * 3);
  geo.setAttribute('position', new THREE.BufferAttribute(cur, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(pointColors, 3));
  points = new THREE.Points(
    geo,
    new THREE.PointsMaterial({
      size: 0.05,
      map: sprite(),
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    }),
  );
  group.add(points);

  // wireframe mesh (tessellation) — appears once formed, subtle
  lineIdx = [];
  const tess = FaceLandmarker.FACE_LANDMARKS_TESSELATION || [];
  for (const c of tess) lineIdx.push(c.start, c.end);
  const lgeo = new THREE.BufferGeometry();
  lgeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(lineIdx.length * 3), 3));
  lines = new THREE.LineSegments(
    lgeo,
    new THREE.LineBasicMaterial({
      color: COL.cyan.clone(),
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  group.add(lines);

  // gold core for the lock-collapse
  core = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: sprite(),
      color: COL.gold.clone(),
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  core.scale.set(0.01, 0.01, 0.01);
  group.add(core);

  window.addEventListener('resize', onResize);
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

// ── camera + model ───────────────────────────────────────────────────────
async function startCamera() {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
    audio: false,
  });
  el.video.srcObject = stream;
  await el.video.play();
}

function stopCamera() {
  const s = el.video.srcObject;
  if (s) {
    s.getTracks().forEach((t) => t.stop());
    el.video.srcObject = null;
  }
}

async function loadModel() {
  const fileset = await FilesetResolver.forVisionTasks(WASM_URL);
  const make = (delegate) =>
    FaceLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: MODEL_URL, delegate },
      runningMode: 'VIDEO',
      numFaces: 1,
      outputFaceBlendshapes: false,
      outputFacialTransformationMatrixes: false,
    });
  try {
    landmarker = await make('GPU');
  } catch (_) {
    landmarker = await make('CPU'); // some iOS builds reject the GPU delegate
  }
}

// ── landmark → geometry ────────────────────────────────────────────────────
function ingest(L) {
  N = L.length;
  // map to world, then center on centroid so the model stays put and rotation reads cleanly
  let cx = 0;
  let cy = 0;
  let cz = 0;
  for (let i = 0; i < N; i++) {
    cx += L[i].x;
    cy += L[i].y;
    cz += L[i].z;
  }
  cx /= N;
  cy /= N;
  cz /= N;
  for (let i = 0; i < N; i++) {
    target[i * 3] = -(L[i].x - cx) * SCALE; // mirror X (selfie)
    target[i * 3 + 1] = -(L[i].y - cy) * SCALE;
    target[i * 3 + 2] = -(L[i].z - cz) * SCALE * DEPTH;
  }
  // yaw proxy: nose offset relative to eye span (works without pose matrix)
  const nose = L[1];
  const le = L[33];
  const re = L[263];
  const span = Math.abs(re.x - le.x) || 1e-3;
  S.yaw = (nose.x - (le.x + re.x) / 2) / span;

  if (!sortByY) {
    sortByY = Array.from({ length: N }, (_, i) => i).sort(
      (a, b) => target[a * 3 + 1] - target[b * 3 + 1],
    );
    for (let i = 0; i < N * 3; i++) cur[i] = target[i]; // seed (no fly-in jump)
  }
}

// ── phase machine ──────────────────────────────────────────────────────────
function setCopy(instr, sub) {
  el.instruction.textContent = instr;
  el.subtitle.textContent = sub;
}
function go(phase) {
  S.phase = phase;
  S.phaseT = performance.now();
}

function updatePhase(now, dt) {
  switch (S.phase) {
    case 'await_face': {
      el.status.textContent = 'Looking for you…';
      setCopy('Bring your face into frame', 'Hold your phone at eye level.');
      const centered = S.haveFace && Math.abs(S.yaw) < 0.16;
      S.centeredMs = centered ? S.centeredMs + dt : 0;
      if (S.centeredMs > 450) {
        S.reveal = 0;
        go('forming');
      }
      break;
    }
    case 'forming': {
      el.status.textContent = 'Capturing depth';
      setCopy('Mapping your structure', 'Stay relaxed — building your model.');
      S.reveal = Math.min(1, (now - S.phaseT) / FORM_MS);
      if (S.reveal >= 1) {
        S.yawMin = S.yaw;
        S.yawMax = S.yaw;
        go('scanning');
      }
      break;
    }
    case 'scanning': {
      el.status.textContent = 'Building 3D baseline';
      setCopy('Slowly turn left, then right', 'Watch your model rotate as we capture it.');
      el.meter.classList.add('on');
      if (S.haveFace) {
        S.yawMin = Math.min(S.yawMin, S.yaw);
        S.yawMax = Math.max(S.yawMax, S.yaw);
      }
      const span = S.yawMax - S.yawMin;
      S.progress = Math.max(S.progress, Math.min(1, span / TURN_TARGET));
      S.colorMix = 0.15 * S.progress; // start warming toward gold
      const timedOut = now - S.phaseT > SCAN_MAX_MS && S.progress > 0.4;
      if (S.progress >= 1 || timedOut) go('locking');
      break;
    }
    case 'locking': {
      el.status.textContent = 'Securing baseline';
      setCopy('Locking your baseline…', 'Encrypting on this device.');
      el.dot.classList.add('gold');
      const k = Math.min(1, (now - S.phaseT) / LOCK_MS);
      S.collapse = k * k; // ease-in toward the core
      S.colorMix = 0.15 + 0.85 * k;
      S.progress = 1;
      if (k >= 1) {
        stopCamera(); // privacy: release the camera the instant we're done
        go('locked');
      }
      break;
    }
    case 'locked': {
      el.status.textContent = 'Baseline established';
      setCopy('Baseline locked.', 'Your 3D baseline is set — privately, on this device.');
      el.dot.classList.add('gold');
      el.meter.classList.remove('on');
      el.cta.classList.add('on');
      break;
    }
  }
  el.meterFill.style.width = (S.progress * 100).toFixed(0) + '%';
}

// ── per-frame write to GPU buffers ───────────────────────────────────────────
const _c = new THREE.Color();
function writeFrame() {
  const formed = S.phase === 'scanning' || S.phase === 'locking' || S.phase === 'locked';
  // sweep line in world-y for the forming reveal (bottom→top)
  const sweep = -1.4 + S.reveal * 2.8;

  const posAttr = points.geometry.attributes.position;
  const colAttr = points.geometry.attributes.color;

  for (let i = 0; i < N; i++) {
    const j = i * 3;
    // smooth toward target, then pull toward origin during the lock-collapse
    cur[j] += (target[j] - cur[j]) * SMOOTH;
    cur[j + 1] += (target[j + 1] - cur[j + 1]) * SMOOTH;
    cur[j + 2] += (target[j + 2] - cur[j + 2]) * SMOOTH;
    if (S.collapse > 0) {
      const k = S.collapse;
      cur[j] *= 1 - k;
      cur[j + 1] *= 1 - k;
      cur[j + 2] *= 1 - k;
    }

    // visibility: during forming, reveal points below the rising sweep line
    let vis = 1;
    let band = 0;
    if (!formed) {
      const py = cur[j + 1];
      vis = py <= sweep ? 1 : 0;
      band = Math.max(0, 1 - Math.abs(py - sweep) / 0.12); // bright scan band
    }
    vis *= 1 - S.collapse * 0.9; // dim points as they collapse into the core

    // depth-based brightness for 3D pop
    const depthLit = 0.65 + 0.35 * THREE.MathUtils.clamp(cur[j + 2] * 0.5 + 0.5, 0, 1);
    _c.copy(COL.cyan).lerp(COL.gold, S.colorMix);
    if (band > 0) _c.lerp(COL.white, band);
    const inten = vis * depthLit * (0.85 + 0.15 * Math.sin(performance.now() * 0.004 + i));
    colAttr.array[j] = _c.r * inten;
    colAttr.array[j + 1] = _c.g * inten;
    colAttr.array[j + 2] = _c.b * inten;
  }
  posAttr.needsUpdate = true;
  colAttr.needsUpdate = true;

  // wireframe mesh
  const lp = lines.geometry.attributes.position.array;
  for (let k = 0; k < lineIdx.length; k++) {
    const src = lineIdx[k] * 3;
    lp[k * 3] = cur[src];
    lp[k * 3 + 1] = cur[src + 1];
    lp[k * 3 + 2] = cur[src + 2];
  }
  lines.geometry.attributes.position.needsUpdate = true;
  lines.material.color.copy(COL.cyan).lerp(COL.gold, S.colorMix);
  const lineTarget = formed ? 0.16 * (1 - S.collapse) : 0;
  lines.material.opacity += (lineTarget - lines.material.opacity) * 0.1;

  // gold core grows during the collapse
  const coreTarget = S.phase === 'locked' ? 0.9 : S.collapse;
  core.material.opacity += (coreTarget - core.material.opacity) * 0.12;
  const cs = 0.05 + coreTarget * 0.85 + (S.phase === 'locked' ? 0.06 * Math.sin(performance.now() * 0.003) : 0);
  core.scale.set(cs, cs, cs);

  // gentle idle sway so it feels alive even when the user is still
  const sway = S.phase === 'locked' ? 0 : 0.12;
  group.rotation.y = Math.sin(performance.now() * 0.0004) * sway;
  group.rotation.x = Math.sin(performance.now() * 0.0003) * sway * 0.4;
}

// ── main loop ────────────────────────────────────────────────────────────
function loop() {
  S.raf = requestAnimationFrame(loop);
  const now = performance.now();
  const dt = Math.min(48, now - (S.lastNow || now));
  S.lastNow = now;

  if (landmarker && el.video.readyState >= 2 && S.phase !== 'locked') {
    if (el.video.currentTime !== lastVideoTime) {
      lastVideoTime = el.video.currentTime;
      try {
        const res = landmarker.detectForVideo(el.video, now);
        if (res && res.faceLandmarks && res.faceLandmarks.length) {
          S.haveFace = true;
          el.dot.style.opacity = '1';
          ingest(res.faceLandmarks[0]);
        } else {
          S.haveFace = false;
        }
      } catch (_) {
        /* transient detector hiccup — keep last frame */
      }
    }
  }

  if (S.phase !== 'loading') updatePhase(now, dt);
  if (sortByY) writeFrame();
  renderer.render(scene, camera);
}

// ── boot ───────────────────────────────────────────────────────────────────
function fatal(title, msg) {
  el.fatalTitle.textContent = title;
  el.fatalMsg.textContent = msg;
  el.fatal.classList.add('on');
}

el.cta.addEventListener('click', () => {
  const href = el.cta.dataset.href;
  if (href) window.location.href = href;
});

async function boot() {
  initThree();
  loop();
  try {
    await loadModel();
  } catch (e) {
    fatal('Could not load the depth engine', 'Check your connection and reload. Everything runs on-device once loaded.');
    return;
  }
  try {
    await startCamera();
  } catch (e) {
    fatal('Camera access needed', 'We build your baseline on-device using the front camera. No image ever leaves your phone — enable camera and reload.');
    return;
  }
  go('await_face');
}

boot();
