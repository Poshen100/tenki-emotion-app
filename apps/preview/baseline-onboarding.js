/**
 * TENKI CORE — Baseline Onboarding Interactive Flow
 * ===================================================
 * 6-step baseline onboarding with simulated sensor data.
 * 
 * Steps:
 *   0. Intro: "TENKI learns you first"
 *   1. Sensor Choice: finger / face (beta)
 *   2. Readiness Check: coverage, brightness, stability, SQI
 *   3. Calibration Scan: 30s timer with progress ring
 *   4. Baseline Result: "Not a score — your normal reference"
 *   5. Next Action: first scan / trader check / explore
 * 
 * All sensor data is SIMULATED for desktop preview.
 * Real camera/sensor integration will use the same interfaces.
 */

'use strict';

// ─────────────────────────────────────────────
// State
// ─────────────────────────────────────────────

const state = {
  currentStep: 0,
  sensorChoice: 'finger',
  readinessInterval: null,
  scanRAF: null,
  scanStartTs: 0,
  scanDuration: 45,        // Phase 2 default (finger); 60 for face
  scanEarliestComplete: 30, // Earliest auto-complete window
  scanHardCap: 60,         // Safety upper bound
  readinessSimStep: 0,
  isScanning: false,
  scanPhase: 'idle',       // idle | gather | accumulate | climax | final | transition
  sqiHistory: [],          // rolling SQI samples (Mean used for early-complete gate)
  rollingSqi: 0,
  qualityTier: 'weak',
  particleSystem: null,
  cameraSession: null,     // Active { stop } handle from TENKI_PREVIEW_CAMERA
  cameraActive: false,     // True once a real camera frame has arrived
  lastCameraSample: null,  // Latest { coverage, color, redMean, redStd, sqi, hint }
  // Smart readiness gate state
  readinessLatch: { coverage: 0, brightness: 0, stability: 0, sqi: 0 },
  readySince: 0,           // timestamp when unlock conditions first met
  yellowCoverageMs: 0,     // accumulated ms with coverage ≥ 0.60
  lastReadinessTs: 0,      // for delta-time calculation
  readinessUnlocked: false,
  baseline: {
    hr: { mean: 0, std: 0 },
    hrv: { mean: 0, std: 0 },
    rr: { mean: 0, std: 0 },
  },
};

const STEPS = [
  'step-intro',
  'step-sensor',
  'step-readiness',
  'step-scan',
  'step-result',
  'step-next',
];

// ─────────────────────────────────────────────
// Navigation
// ─────────────────────────────────────────────

function goToStep(stepIndex) {
  if (stepIndex < 0 || stepIndex >= STEPS.length) return;

  // Exit current step
  const currentEl = document.getElementById(STEPS[state.currentStep]);
  if (currentEl) {
    currentEl.classList.remove('active');
    currentEl.classList.add('exit-left');
    setTimeout(() => currentEl.classList.remove('exit-left'), 500);
  }

  // Enter new step
  state.currentStep = stepIndex;
  const nextEl = document.getElementById(STEPS[stepIndex]);
  if (nextEl) {
    setTimeout(() => nextEl.classList.add('active'), 50);
  }

  // Update step indicator dots
  updateStepDots(stepIndex);

  // Trigger step-specific logic
  onStepEnter(stepIndex);
}

function updateStepDots(activeIndex) {
  const dots = document.querySelectorAll('.step-dot');
  dots.forEach((dot, i) => {
    dot.classList.remove('active', 'completed');
    if (i === activeIndex) {
      dot.classList.add('active');
    } else if (i < activeIndex) {
      dot.classList.add('completed');
    }
  });
}

function onStepEnter(stepIndex) {
  switch (stepIndex) {
    case 0:
      initParticles();
      break;
    case 2:
      startReadinessCheck();
      break;
    case 3:
      startCalibrationScan();
      break;
    case 4:
      showBaselineResult();
      break;
  }
}

// ─────────────────────────────────────────────
// Step 1: Learn More Toggle
// ─────────────────────────────────────────────

function toggleLearnMore() {
  const el = document.getElementById('learn-more');
  if (el) el.classList.toggle('hidden');
}

// ─────────────────────────────────────────────
// Step 2: Sensor Selection
// ─────────────────────────────────────────────

function selectSensor(type) {
  state.sensorChoice = type;
  // Finger: 45s ceremony with early-complete at ≥30s; face: 60s fixed
  state.scanDuration = type === 'finger' ? 45 : 60;
  state.scanEarliestComplete = type === 'finger' ? 30 : 45;
  state.scanHardCap = type === 'finger' ? 60 : 75;

  const finger = document.getElementById('sensor-finger');
  const face = document.getElementById('sensor-face');

  if (type === 'finger') {
    finger.classList.add('selected');
    face.classList.remove('selected');
  } else {
    face.classList.add('selected');
    finger.classList.remove('selected');
  }

  // Update instructions for step 3
  updateInstructions(type);
}

function updateInstructions(type) {
  const list = document.getElementById('instructions-list');
  if (!list) return;

  const fingerInstructions = [
    '將食指或中指的指腹完整覆蓋後鏡頭',
    '手指要輕放，不要用力按壓',
    '保持手機穩定，盡量不要晃動',
  ];

  const faceInstructions = [
    '面對前鏡頭，保持自然表情',
    '確保臉部光線均勻，避免逆光',
    '保持頭部穩定',
  ];

  const instructions = type === 'finger' ? fingerInstructions : faceInstructions;
  list.innerHTML = instructions.map((text, i) =>
    `<div class="instruction-item">
      <span class="instruction-number">${i + 1}</span>
      <span>${text}</span>
    </div>`
  ).join('');
}

// ─────────────────────────────────────────────
// Step 3: Readiness Check — Real Camera Data
// ─────────────────────────────────────────────

function startReadinessCheck() {
  // Reset UI
  updateMeter('coverage', 0, '—');
  updateMeter('brightness', 0, '—');
  updateMeter('stability', 0, '—');
  updateMeter('sqi', 0, '—');

  // Reset smart gate state
  state.readinessLatch = { coverage: 0, brightness: 0, stability: 0, sqi: 0 };
  state.readySince = 0;
  state.yellowCoverageMs = 0;
  state.lastReadinessTs = 0;
  state.readinessUnlocked = false;

  const btn = document.getElementById('btn-start-scan');
  if (btn) {
    btn.disabled = true;
    btn.textContent = '等待就緒...';
  }

  const msgEl = document.getElementById('readiness-message');
  if (msgEl) { msgEl.textContent = '正在啟動相機…'; msgEl.style.color = ''; }

  // Start camera at readiness step so meters use real data
  startReadinessCamera();
}

async function startReadinessCamera() {
  const videoEl = document.getElementById('readiness-video');
  const container = document.getElementById('readiness-camera-container');
  const labelEl = document.getElementById('readiness-camera-label');
  const api = window.TENKI_PREVIEW_CAMERA;

  if (!videoEl || !api || !api.startFingerCamera) {
    // No camera module — fall back to simulated readiness
    startSimulatedReadiness();
    return;
  }

  // Stop any lingering session
  if (state.cameraSession) {
    try { state.cameraSession.stop(); } catch (_) {}
    state.cameraSession = null;
  }

  try {
    const session = await api.startFingerCamera(videoEl, (sample) => {
      state.cameraActive = true;
      state.lastCameraSample = sample;
      if (!state.isScanning) updateReadinessFromCamera(sample);
    });
    state.cameraSession = session;
    if (labelEl) labelEl.textContent = '後鏡頭已啟動';
  } catch (err) {
    state.cameraActive = false;
    if (container) container.style.display = 'none';
    if (labelEl) labelEl.textContent = '';
    const msgEl = document.getElementById('readiness-message');
    if (msgEl) {
      if (err && err.name === 'NotAllowedError') {
        msgEl.textContent = '相機權限被拒 — 使用模擬模式';
      } else {
        msgEl.textContent = '無法開啟相機 — 使用模擬模式';
      }
      msgEl.style.color = '#F5A623';
    }
    startSimulatedReadiness();
  }
}

// ── Readiness gate thresholds ──
const READY_GREEN = { coverage: 0.85, brightness: 0.50, stability: 0.70, sqi: 0.55 };
const READY_LATCH_MS = 3000;     // once green, stays green 3s
const READY_HOLD_MS = 1500;      // hold steady before unlock
const READY_PATIENCE_MS = 10000; // after 10s of yellow coverage → unlock anyway

function isLatchedGreen(key, value, threshold) {
  const now = Date.now();
  if (value >= threshold) {
    state.readinessLatch[key] = now + READY_LATCH_MS;
    return true;
  }
  return now < state.readinessLatch[key];
}

function updateReadinessFromCamera(sample) {
  const { coverage, brightness, stability, sqi, color, bpm } = sample;
  const now = Date.now();
  const dt = state.lastReadinessTs ? now - state.lastReadinessTs : 33;
  state.lastReadinessTs = now;

  // ── Latch: check each meter (latched = stays green for 3s after crossing threshold)
  const covG = isLatchedGreen('coverage', coverage, READY_GREEN.coverage);
  const briG = isLatchedGreen('brightness', brightness || 0, READY_GREEN.brightness);
  const staG = isLatchedGreen('stability', stability || 0, READY_GREEN.stability);
  const sqiG = isLatchedGreen('sqi', sqi, READY_GREEN.sqi);

  // ── Update meter visuals (use latched state for icons)
  updateMeter('coverage', coverage * 100, covG ? '✅' : getMeterIcon(coverage, 0.85, 0.60));
  updateMeter('brightness', (brightness || 0) * 100, briG ? '✅' : getMeterIcon(brightness || 0, 0.50, 0.30));
  updateMeter('stability', (stability || 0) * 100, staG ? '✅' : getMeterIcon(stability || 0, 0.70, 0.50));
  updateMeter('sqi', sqi * 100, sqiG ? '✅' : getMeterIcon(sqi, 0.55, 0.40));

  // ── Camera preview
  const container = document.getElementById('readiness-camera-container');
  if (container) container.dataset.state = color;

  const labelEl = document.getElementById('readiness-camera-label');
  if (labelEl) {
    if (color === 'green') labelEl.textContent = bpm > 0 ? `${bpm} BPM 偵測中` : '手指已覆蓋 ✓';
    else if (color === 'yellow') labelEl.textContent = '調整手指位置';
    else labelEl.textContent = '覆蓋後鏡頭';
  }

  // ── Patience: accumulate time with yellow+ coverage
  if (coverage >= 0.60) {
    state.yellowCoverageMs += dt;
  } else {
    state.yellowCoverageMs = Math.max(0, state.yellowCoverageMs - dt * 2);
  }

  // ── 3-Layer unlock gate ──
  // Layer 1: All 4 latched green
  const layer1 = covG && briG && staG && sqiG;

  // Layer 2: Coverage ≥ 0.70 + at least 2 of 3 others latched green
  const covRelaxed = coverage >= 0.70 || covG;
  const othersCount = [briG, staG, sqiG].filter(Boolean).length;
  const layer2 = covRelaxed && othersCount >= 2;

  // Layer 3: Patience — 10s of yellow+ coverage with basic conditions
  const layer3 = state.yellowCoverageMs >= READY_PATIENCE_MS
    && coverage >= 0.60
    && (brightness || 0) >= 0.30
    && (stability || 0) >= 0.40;

  const shouldUnlock = layer1 || layer2 || layer3;

  // ── Hold-steady timer ──
  const msgEl = document.getElementById('readiness-message');
  const btn = document.getElementById('btn-start-scan');

  if (state.readinessUnlocked) {
    // Already unlocked — keep it enabled (no re-locking once user sees the button)
    return;
  }

  if (shouldUnlock) {
    if (!state.readySince) state.readySince = now;
    const holdNeeded = layer3 ? 0 : READY_HOLD_MS;
    const elapsed = now - state.readySince;

    if (elapsed >= holdNeeded) {
      // ── UNLOCK ──
      state.readinessUnlocked = true;
      if (btn) { btn.disabled = false; btn.textContent = '開始掃描'; }
      if (msgEl) {
        if (layer1) {
          msgEl.textContent = '準備就緒，可以開始';
        } else if (layer2) {
          msgEl.textContent = '信號良好，可以開始';
        } else {
          msgEl.textContent = '信號足夠，可以開始';
        }
        msgEl.style.color = '#34C759';
      }
    } else {
      // Counting down to unlock
      const remaining = Math.ceil((holdNeeded - elapsed) / 1000);
      if (msgEl) {
        msgEl.textContent = `保持不動… ${remaining} 秒後就緒`;
        msgEl.style.color = '#34C759';
      }
    }
  } else {
    state.readySince = 0;

    // ── Specific blocker guidance ──
    if (msgEl) {
      if (coverage < 0.60) {
        msgEl.textContent = state.sensorChoice === 'finger'
          ? '請將手指完整覆蓋鏡頭' : '請將臉部對準鏡頭範圍';
        msgEl.style.color = '#FF3B30';
      } else if ((stability || 0) < 0.40) {
        msgEl.textContent = '偵測到晃動，請保持靜止';
        msgEl.style.color = '#F5A623';
      } else if ((brightness || 0) < 0.30) {
        msgEl.textContent = '光線不足，請移到較亮的地方';
        msgEl.style.color = '#F5A623';
      } else if (!covG && coverage < 0.85) {
        msgEl.textContent = '手指再往鏡頭中心移一點';
        msgEl.style.color = '#F5A623';
      } else {
        msgEl.textContent = '快好了，保持不動…';
        msgEl.style.color = '#F5A623';
      }
    }
  }
}

function startSimulatedReadiness() {
  state.readinessSimStep = 0;
  if (state.readinessInterval) clearInterval(state.readinessInterval);
  state.readinessInterval = setInterval(() => {
    state.readinessSimStep++;
    simulateReadiness(state.readinessSimStep);
  }, 400);
}

function simulateReadiness(step) {
  const maxSteps = 10;
  const progress = Math.min(step / maxSteps, 1);
  const coverage = easeOutCubic(Math.min(progress * 1.3, 1));
  const brightness = 0.3 + easeOutCubic(Math.min(progress * 1.2, 1)) * 0.5;
  const stability = easeOutCubic(Math.min(progress * 1.0, 1)) * 0.9;
  const sqi = Math.min(100, Math.round((coverage * 40 + brightness * 20 + stability * 40)));

  updateMeter('coverage', coverage * 100, getMeterIcon(coverage, 0.85, 0.60));
  updateMeter('brightness', brightness * 100, getMeterIcon(brightness, 0.50, 0.30));
  updateMeter('stability', stability * 100, getMeterIcon(stability, 0.70, 0.50));
  updateMeter('sqi', sqi, getMeterIcon(sqi / 100, 0.55, 0.40));

  const msgEl = document.getElementById('readiness-message');

  if (coverage < 0.60) {
    if (msgEl) { msgEl.textContent = '模擬模式 — 覆蓋率上升中'; msgEl.style.color = '#F5A623'; }
  } else if (coverage >= 0.85 && stability >= 0.70 && brightness >= 0.50 && sqi >= 55) {
    if (msgEl) { msgEl.textContent = '準備就緒，可以開始'; msgEl.style.color = '#34C759'; }
    const btn = document.getElementById('btn-start-scan');
    if (btn) { btn.disabled = false; btn.textContent = '開始掃描'; }
    clearInterval(state.readinessInterval);
  } else {
    if (msgEl) { msgEl.textContent = '模擬模式 — 幾乎到位了...'; msgEl.style.color = '#F5A623'; }
  }
}

function updateMeter(id, percent, icon) {
  const fill = document.getElementById(`meter-${id}`);
  const status = document.getElementById(`status-${id}`);

  if (fill) {
    fill.style.width = `${Math.min(100, percent)}%`;
    // Color based on thresholds
    fill.className = 'meter-fill';
    if (percent >= 75) fill.classList.add('green');
    else if (percent >= 45) fill.classList.add('yellow');
    else if (percent > 0) fill.classList.add('red');
  }
  if (status) status.textContent = icon;
}

function getMeterIcon(value, greenTh, yellowTh) {
  if (value >= greenTh) return '✅';
  if (value >= yellowTh) return '⚠️';
  return '❌';
}

function easeOutCubic(x) {
  return 1 - Math.pow(1 - x, 3);
}

// ─────────────────────────────────────────────
// Step 4: Calibration Scan — 4-Phase Ceremony
// Phase 1 (0–3s)   : gather — particles converge to finger
// Phase 2 (3s→)    : accumulate — orbiting energy ball + telemetry
// Phase 3 climax   : early-complete if t ≥ 30s & rolling-mean SQI ≥ 0.85
// Phase 4 final    : outward burst → cinematic transition to result
// ─────────────────────────────────────────────

const SCAN_CIRCUMFERENCE = 2 * Math.PI * 88; // ring r=88
const PHASE_GATHER_MS = 3000;
const CLIMAX_MS = 1500;

function startCalibrationScan() {
  const scanEl = document.getElementById('step-scan');
  const timerEl = document.getElementById('scan-timer');
  const statusEl = document.getElementById('scan-status');
  const noteEl = document.getElementById('scan-note');
  const ringEl = document.getElementById('scan-progress-ring');
  const dialogEl = document.getElementById('ceremony-dialog');
  const dialogTextEl = document.getElementById('ceremony-dialog-text');
  const readyEl = document.getElementById('ready-indicator');

  // Reset ceremony UI
  state.isScanning = true;
  state.scanPhase = 'gather';
  state.sqiHistory = [];
  state.rollingSqi = 0;
  state.qualityTier = 'weak';
  state.scanStartTs = performance.now();
  state.baseline = {
    hr: { mean: 0, std: 0 },
    hrv: { mean: 0, std: 0 },
    rr: { mean: 0, std: 0 },
  };

  if (scanEl) {
    scanEl.classList.remove('phase-accumulate', 'phase-climax', 'phase-final', 'phase-transition');
    scanEl.classList.add('phase-gather');
  }
  if (timerEl) {
    timerEl.textContent = state.scanDuration;
    timerEl.style.color = '';
  }
  if (statusEl) {
    statusEl.style.color = '';
    statusEl.textContent = '準備中...';
  }
  if (noteEl) noteEl.textContent = '請保持不動';
  if (ringEl) ringEl.style.strokeDashoffset = SCAN_CIRCUMFERENCE;
  if (dialogEl && dialogTextEl) {
    dialogEl.classList.add('visible');
    dialogTextEl.textContent = '正在凝聚你的生理基線';
  }
  if (readyEl) readyEl.style.display = 'none';

  // Start particle system (converge → orbit → burst driven by phase)
  startParticleSystem();

  // Camera is already running from Step 3. Transfer the stream to the scan
  // video element so the circular preview shows inside the ceremony ring.
  transferCameraToScanView();

  // Cancel previous RAF loop
  if (state.scanRAF) cancelAnimationFrame(state.scanRAF);

  tickCalibration();
}

/**
 * Transfer the already-running camera stream from the readiness-video to
 * the scan-video element inside the ceremony ring. No new getUserMedia call.
 */
function transferCameraToScanView() {
  const container = document.getElementById('scan-ring-container');
  const scanVideoEl = document.getElementById('scan-video');
  const readinessVideoEl = document.getElementById('readiness-video');

  if (!scanVideoEl) return;

  if (readinessVideoEl && readinessVideoEl.srcObject) {
    scanVideoEl.srcObject = readinessVideoEl.srcObject;
    scanVideoEl.muted = true;
    scanVideoEl.playsInline = true;
    try { scanVideoEl.play(); } catch (_) {}

    if (container) {
      container.classList.remove('camera-unavailable');
      container.classList.add('camera-active');
    }
  } else {
    if (container) {
      container.classList.remove('camera-active');
      container.classList.add('camera-unavailable');
    }
  }
}

function stopFingerCameraFeed() {
  if (state.cameraSession) {
    try { state.cameraSession.stop(); } catch (_) {}
    state.cameraSession = null;
  }
  state.cameraActive = false;
  const container = document.getElementById('scan-ring-container');
  if (container) container.classList.remove('camera-active');
}

function tickCalibration() {
  const now = performance.now();
  const elapsedMs = now - state.scanStartTs;
  const elapsedSec = elapsedMs / 1000;

  const scanEl = document.getElementById('step-scan');
  const timerEl = document.getElementById('scan-timer');
  const statusEl = document.getElementById('scan-status');
  const ringEl = document.getElementById('scan-progress-ring');
  const dialogTextEl = document.getElementById('ceremony-dialog-text');

  // ── Phase transitions ──
  if (state.scanPhase === 'gather' && elapsedMs >= PHASE_GATHER_MS) {
    state.scanPhase = 'accumulate';
    if (scanEl) {
      scanEl.classList.remove('phase-gather');
      scanEl.classList.add('phase-accumulate');
    }
    if (dialogTextEl) dialogTextEl.textContent = '能量聚合中 — 讀取你的節奏';
  }

  // ── Countdown (starts after gather ends) ──
  const countdown = Math.max(0, Math.ceil(state.scanDuration - elapsedSec));
  if (timerEl) timerEl.textContent = countdown;

  // ── Progress ring ──
  const progress = Math.min(1, elapsedSec / state.scanDuration);
  if (ringEl) ringEl.style.strokeDashoffset = SCAN_CIRCUMFERENCE * (1 - progress);

  // ── Signal + baseline data collection ──
  if (state.scanPhase === 'accumulate' || state.scanPhase === 'climax') {
    if (state.cameraActive && state.lastCameraSample) {
      updateBaselineFromCamera(state.lastCameraSample);
    } else {
      simulateBaselineData(progress);
    }
    updateSignalTelemetry(elapsedSec);
  }

  // ── Coverage guidance (real-time finger placement feedback) ──
  updateCoverageGuidance(elapsedSec);

  // ── Status message (single-line, UX Standard 2) ──
  if (statusEl && state.scanPhase !== 'climax' && state.scanPhase !== 'final') {
    if (state.cameraActive && state.lastCameraSample) {
      // Camera-driven: coverage state takes priority over time-based messages
      const color = state.lastCameraSample.color;
      if (color === 'red') {
        statusEl.textContent = '請將手指完整覆蓋鏡頭';
        statusEl.style.color = '#FF3B30';
      } else if (color === 'yellow') {
        statusEl.textContent = '繼續調整手指位置…';
        statusEl.style.color = '#F5A623';
      } else if (elapsedSec < 8) {
        statusEl.textContent = 'PPG 訊號採集中…';
        statusEl.style.color = '';
      } else if (elapsedSec < state.scanEarliestComplete) {
        statusEl.textContent = '能量正在快速凝聚...';
        statusEl.style.color = '';
      } else {
        statusEl.textContent = '快好了，再堅持一下';
        statusEl.style.color = '';
      }
    } else {
      // Simulated fallback: time-based progression
      if (elapsedSec < 3) {
        statusEl.textContent = '能量凝聚中...';
      } else if (elapsedSec < 8) {
        statusEl.textContent = 'PPG 訊號採集中…';
      } else if (elapsedSec < 18) {
        statusEl.textContent = '能量正在快速凝聚...';
      } else if (elapsedSec < state.scanEarliestComplete) {
        statusEl.textContent = '品質越好，精準度越高';
      } else {
        statusEl.textContent = '快好了，再堅持一下';
      }
    }
  }

  // ── Early-complete gate: ≥earliest window AND rolling mean SQI ≥ 0.85 ──
  const earlyGate =
    state.scanPhase === 'accumulate' &&
    elapsedSec >= state.scanEarliestComplete &&
    state.rollingSqi >= 0.85;

  // ── Hard completion: scanDuration reached ──
  const durationComplete =
    state.scanPhase === 'accumulate' && elapsedSec >= state.scanDuration;

  if (earlyGate || durationComplete) {
    enterClimax(earlyGate ? 'early' : 'duration');
    return; // climax drives its own timeline
  }

  // ── Safety cap (WEAK signal even past duration) ──
  if (elapsedSec >= state.scanHardCap && state.scanPhase === 'accumulate') {
    enterClimax('safety');
    return;
  }

  state.scanRAF = requestAnimationFrame(tickCalibration);
}

function updateBaselineFromCamera(sample) {
  const { bpm, hrv, rr } = sample;
  const alpha = 0.05; // TENKI convention: EWMA α=0.05 slow convergence

  if (bpm > 0) {
    if (state.baseline.hr.mean === 0) {
      state.baseline.hr = { mean: bpm, std: 3 };
    } else {
      state.baseline.hr.mean = state.baseline.hr.mean * (1 - alpha) + bpm * alpha;
      state.baseline.hr.std = Math.max(2, Math.abs(bpm - state.baseline.hr.mean) * 0.5);
    }
  }

  if (hrv > 0) {
    if (state.baseline.hrv.mean === 0) {
      state.baseline.hrv = { mean: hrv, std: 5 };
    } else {
      state.baseline.hrv.mean = state.baseline.hrv.mean * (1 - alpha) + hrv * alpha;
      state.baseline.hrv.std = Math.max(3, Math.abs(hrv - state.baseline.hrv.mean) * 0.5);
    }
  }

  if (rr > 0) {
    if (state.baseline.rr.mean === 0) {
      state.baseline.rr = { mean: rr, std: 1 };
    } else {
      state.baseline.rr.mean = state.baseline.rr.mean * (1 - alpha) + rr * alpha;
      state.baseline.rr.std = Math.max(1, Math.abs(rr - state.baseline.rr.mean) * 0.3);
    }
  }
}

function simulateBaselineData(progress) {
  const baseHR = 68 + Math.random() * 8;
  const baseHRV = 40 + Math.random() * 15;
  const baseRR = 14 + Math.random() * 4;

  if (state.baseline.hr.mean === 0) {
    state.baseline.hr = { mean: baseHR, std: 0 };
    state.baseline.hrv = { mean: baseHRV, std: 0 };
    state.baseline.rr = { mean: baseRR, std: 0 };
  } else {
    const alpha = 0.05; // TENKI convention: EWMA α=0.05 slow convergence
    state.baseline.hr.mean = state.baseline.hr.mean * (1 - alpha) + baseHR * alpha;
    state.baseline.hr.std = Math.abs(baseHR - state.baseline.hr.mean) * 0.5;
    state.baseline.hrv.mean = state.baseline.hrv.mean * (1 - alpha) + baseHRV * alpha;
    state.baseline.hrv.std = Math.abs(baseHRV - state.baseline.hrv.mean) * 0.5;
    state.baseline.rr.mean = state.baseline.rr.mean * (1 - alpha) + baseRR * alpha;
    state.baseline.rr.std = Math.abs(baseRR - state.baseline.rr.mean) * 0.3;
  }
}

// ─────────────────────────────────────────────
// Coverage guidance — real-time finger placement feedback
// Shows RED/YELLOW/GREEN state + actionable instruction
// ─────────────────────────────────────────────

function updateCoverageGuidance(elapsedSec) {
  const guidanceEl = document.getElementById('scan-guidance');
  const iconEl = document.getElementById('scan-guidance-icon');
  const textEl = document.getElementById('scan-guidance-text');
  if (!guidanceEl || !iconEl || !textEl) return;

  if (state.cameraActive && state.lastCameraSample) {
    const { color, hint } = state.lastCameraSample;
    guidanceEl.dataset.coverage = color;
    if (color === 'red') {
      iconEl.textContent = '❌';
      textEl.textContent = '請將食指完整覆蓋後鏡頭';
    } else if (color === 'yellow') {
      iconEl.textContent = '⚠️';
      textEl.textContent = '手指位置偏了，請調整覆蓋';
    } else {
      iconEl.textContent = '✅';
      textEl.textContent = '手指已覆蓋 — 保持不動';
    }
  } else {
    // Simulated fallback: show generic instruction
    if (elapsedSec < 3) {
      guidanceEl.dataset.coverage = '';
      iconEl.textContent = '👆';
      textEl.textContent = '請將食指完整覆蓋後鏡頭';
    } else {
      guidanceEl.dataset.coverage = 'green';
      iconEl.textContent = '✅';
      textEl.textContent = '訊號採集中 — 請保持不動';
    }
  }
}

// ─────────────────────────────────────────────
// Signal telemetry (quality badge, meter, rolling SQI)
// ─────────────────────────────────────────────

function updateSignalTelemetry(elapsedSec) {
  let instant;

  if (state.cameraActive && state.lastCameraSample) {
    // Real camera path: use the live SQI from skin coverage + red-channel PPG.
    // Jitter is intrinsic to the signal — no synthetic noise added.
    instant = Math.max(0, Math.min(1, state.lastCameraSample.sqi || 0));
  } else {
    // Simulated fallback (desktop / permission denied). Ramp 3s→11s to 0.95,
    // with low-frequency noise so the early-complete gate still behaves.
    const rampT = Math.min(1, Math.max(0, (elapsedSec - 3) / 8));
    const target = 0.55 + rampT * 0.40;
    instant = Math.max(0, Math.min(1, target + (Math.random() - 0.5) * 0.06));
  }

  // Keep a ~10s rolling window (called every RAF ≈ 60/s → window ≈600 samples)
  state.sqiHistory.push(instant);
  if (state.sqiHistory.length > 600) state.sqiHistory.shift();
  const mean =
    state.sqiHistory.reduce((s, v) => s + v, 0) / state.sqiHistory.length;
  state.rollingSqi = mean;

  // ── Quality tier ──
  let tier = 'weak';
  if (mean >= 0.85) tier = 'excellent';
  else if (mean >= 0.70) tier = 'good';
  else if (mean >= 0.55) tier = 'fair';

  if (tier !== state.qualityTier) {
    state.qualityTier = tier;
    const badge = document.getElementById('quality-badge');
    const label = document.getElementById('quality-label');
    if (badge && label) {
      badge.classList.remove('quality-weak', 'quality-fair', 'quality-good', 'quality-excellent');
      badge.classList.add(`quality-${tier}`);
      label.textContent = tier.toUpperCase();
    }

    // Drive finger silhouette + halo glow intensity via data attribute
    const scanEl = document.getElementById('step-scan');
    if (scanEl) scanEl.dataset.sqi = tier;

    // Update ceremony dialog sub-text — camera-driven when active
    const subEl = document.getElementById('ceremony-dialog-sub');
    if (subEl) {
      if (state.cameraActive && state.lastCameraSample) {
        const coverColor = state.lastCameraSample.color;
        if (tier === 'excellent') {
          subEl.textContent = '手指已完全覆蓋 ✓ — 能量正在快速凝聚';
        } else if (tier === 'good') {
          subEl.textContent = '訊號良好 — 繼續保持不動';
        } else if (coverColor === 'red') {
          subEl.textContent = '⚠ 請將食指完整覆蓋後鏡頭';
        } else if (coverColor === 'yellow') {
          subEl.textContent = '手指位置偏了 — 請微調覆蓋';
        } else {
          subEl.textContent = 'PPG 訊號採集中… 品質越好越精準';
        }
      } else {
        if (tier === 'excellent') subEl.textContent = '手指已完全覆蓋 ✓ — 能量正在快速凝聚';
        else if (tier === 'good') subEl.textContent = '訊號良好 — 繼續保持不動';
        else if (tier === 'fair') subEl.textContent = 'PPG 訊號採集中… 品質越好越精準';
        else subEl.textContent = '請將食指完全覆蓋後鏡頭';
      }
    }
  }

  // ── Signal meter fill ──
  const fill = document.getElementById('signal-meter-fill');
  if (fill) fill.style.width = `${Math.round(mean * 100)}%`;
}

// ─────────────────────────────────────────────
// Phase 3/4: Climax + Final (burst & complete)
// ─────────────────────────────────────────────

function enterClimax(reason) {
  if (state.scanPhase === 'climax' || state.scanPhase === 'final') return;
  state.scanPhase = 'climax';

  const scanEl = document.getElementById('step-scan');
  const statusEl = document.getElementById('scan-status');
  const noteEl = document.getElementById('scan-note');
  const dialogTextEl = document.getElementById('ceremony-dialog-text');
  const readyEl = document.getElementById('ready-indicator');

  if (scanEl) {
    scanEl.classList.remove('phase-accumulate');
    scanEl.classList.add('phase-climax');
  }
  if (readyEl && reason === 'early') readyEl.style.display = 'inline-flex';

  if (statusEl) {
    statusEl.textContent =
      reason === 'early'
        ? '訊號品質優良，即將完成'
        : reason === 'safety'
        ? '已達時間上限，完成中'
        : '完成中';
    statusEl.style.color = '#6fe08a';
  }
  if (noteEl) noteEl.textContent = '';
  if (dialogTextEl) dialogTextEl.textContent = '基線凝聚完成！你的能量已完全覺醒 ✨';
  const subEl = document.getElementById('ceremony-dialog-sub');
  if (subEl) subEl.textContent = '';

  // Trigger particle outward burst
  if (state.particleSystem) state.particleSystem.burst();

  // Haptic / vibration (where supported)
  if (navigator.vibrate) {
    try { navigator.vibrate([20, 40, 60]); } catch (_) {}
  }

  // After climax window → begin transition (Todo 3 will implement)
  setTimeout(() => enterTransition(), CLIMAX_MS);
}

// ─────────────────────────────────────────────
// Cinematic hand-off (2s total)
//   0.00–0.30s  Brightness +20%, particles radiate, card fades in
//   0.30–1.20s  Golden flash + card slide-up / 1.05× scale
//   1.20–2.00s  Brightness settles, particles converge on result icon
// ─────────────────────────────────────────────

function enterTransition() {
  state.scanPhase = 'transition';
  state.isScanning = false;

  const scanEl = document.getElementById('step-scan');
  if (scanEl) {
    scanEl.classList.remove('phase-climax');
    scanEl.classList.add('phase-transition');
  }

  // Golden flash CSS keyframe fires via .phase-transition class.
  // Now orchestrate Summary Card entrance in lockstep with particles.

  // Prepare Summary Card in the background at t=0 so its slide-in
  // synchronises with the particle burst already in flight.
  const resultEl = document.getElementById('step-result');
  const card = document.getElementById('summary-card');
  if (resultEl && card) {
    // Snap the result step to visible without its default 0.5s fade —
    // the card runs its own cinematic entrance inline.
    resultEl.style.transition = 'none';
    resultEl.classList.add('active');
    card.classList.remove('summary-card-locked-in');
    card.style.opacity = '0';
    card.style.transform = 'translateY(40px) scale(0.94)';
  }

  // Digits start masked — revealed at the climax beat (~1.0s into transition).
  showBaselineResult({ maskDigits: true });

  // Beat 1 (0.30s) — card begins slide-up + scale to 1.05
  setTimeout(() => {
    if (card) {
      card.style.transition =
        'opacity 0.6s ease, transform 0.9s cubic-bezier(0.34, 1.56, 0.64, 1)';
      card.style.opacity = '1';
      card.style.transform = 'translateY(-4px) scale(1.05)';
    }
  }, 300);

  // Beat 2 (1.00s) — reveal the metric digits with a tick animation.
  //   Matches the spec: "TEI 數字先顯示為「–」 → 在轉場結束時瞬間變成最終數值"
  //   NOTE: project vocabulary is "Decision Edge Score" (CLAUDE.md), so the
  //   custom event payload uses `score` rather than the deprecated `tei` key.
  setTimeout(() => {
    revealBaselineDigits();
    // Strong completion haptic
    if (navigator.vibrate) {
      try { navigator.vibrate([30, 60, 120]); } catch (_) {}
    }
    // Consumers (e.g. future result screen) listen for this hand-off.
    const score = estimateEdgeScore();
    document.dispatchEvent(new CustomEvent('tenki:baseline-to-result', {
      detail: { score, zone: zoneFor(score), rollingSqi: state.rollingSqi },
    }));
  }, 1000);

  // Beat 3 (1.20s) — card settles to 1.00×, particles decelerate + fade,
  // and the ambient brightness returns to normal.
  setTimeout(() => {
    if (card) {
      card.style.transform = 'translateY(0) scale(1)';
    }
    if (scanEl) scanEl.classList.add('phase-transition-settle');
    if (state.particleSystem) state.particleSystem.converge();
  }, 1200);

  // t=2.0s — full hand-off. Tear down the scan step, stop particles,
  // leave result step active with step indicator synced.
  setTimeout(() => {
    if (state.particleSystem) state.particleSystem.stop();
    if (state.scanRAF) cancelAnimationFrame(state.scanRAF);
    stopFingerCameraFeed();

    const scanSection = document.getElementById('step-scan');
    if (scanSection) {
      scanSection.classList.remove(
        'active',
        'phase-gather',
        'phase-accumulate',
        'phase-climax',
        'phase-final',
        'phase-transition',
        'phase-transition-settle'
      );
    }
    // Finalise navigation state (updates dots + currentStep).
    state.currentStep = 4;
    updateStepDots(4);
    if (card) card.classList.add('summary-card-locked-in');
  }, 2000);
}

// ─────────────────────────────────────────────
// Decision Edge Score estimate from SQI + HRV stand-in
// ─────────────────────────────────────────────

function estimateEdgeScore() {
  // Lightweight stand-in (0–100). Real engine lives in packages/engine.
  const sqi = state.rollingSqi || 0.6;
  const hrvNorm = Math.min(1, (state.baseline.hrv.mean || 45) / 80);
  const score = Math.round((sqi * 0.6 + hrvNorm * 0.4) * 100);
  return Math.max(0, Math.min(100, score));
}

function zoneFor(score) {
  if (score >= 70) return 'clear';
  if (score >= 40) return 'neutral';
  return 'strain';
}

function revealBaselineDigits() {
  const hr = state.baseline.hr;
  const hrv = state.baseline.hrv;
  const rr = state.baseline.rr;

  const hrEl = document.getElementById('metric-hr');
  const hrvEl = document.getElementById('metric-hrv');
  const rrEl = document.getElementById('metric-rr');

  if (hrEl) {
    const low = Math.round(hr.mean - hr.std);
    const high = Math.round(hr.mean + hr.std);
    hrEl.textContent = `${low}-${high} BPM`;
    hrEl.classList.add('digit-snap');
  }
  if (hrvEl) {
    hrvEl.textContent = `${Math.round(hrv.mean)} ms`;
    hrvEl.classList.add('digit-snap');
  }
  if (rrEl) {
    rrEl.textContent = `${Math.round(rr.mean)} 次/分`;
    rrEl.classList.add('digit-snap');
  }

  // Confidence text keyed to rolling SQI
  const confText = document.getElementById('confidence-text');
  if (confText) {
    const sqi = state.rollingSqi;
    confText.textContent =
      sqi >= 0.85 ? '數據品質：優良' :
      sqi >= 0.70 ? '數據品質：良好' :
      sqi >= 0.55 ? '數據品質：普通' : '數據品質：勉強';
  }
}

// ─────────────────────────────────────────────
// Step 5: Baseline Result
// ─────────────────────────────────────────────

function showBaselineResult(opts) {
  const maskDigits = !!(opts && opts.maskDigits);

  const hrEl = document.getElementById('metric-hr');
  const hrvEl = document.getElementById('metric-hrv');
  const rrEl = document.getElementById('metric-rr');

  const hr = state.baseline.hr;
  const hrv = state.baseline.hrv;
  const rr = state.baseline.rr;

  if (maskDigits) {
    // Digits appear as "–" during the cinematic entrance and snap to
    // their final values at the ~1.0s climax beat (see enterTransition).
    if (hrEl) hrEl.textContent = '– BPM';
    if (hrvEl) hrvEl.textContent = '– ms';
    if (rrEl) rrEl.textContent = '– 次/分';
  } else {
    if (hrEl) {
      const low = Math.round(hr.mean - hr.std);
      const high = Math.round(hr.mean + hr.std);
      hrEl.textContent = `${low}-${high} BPM`;
    }
    if (hrvEl) hrvEl.textContent = `${Math.round(hrv.mean)} ms`;
    if (rrEl) rrEl.textContent = `${Math.round(rr.mean)} 次/分`;
  }

  // Confidence badge (final text written again in revealBaselineDigits)
  const confText = document.getElementById('confidence-text');
  if (confText && !maskDigits) confText.textContent = '數據品質：良好';

  // Animate result icon
  const icon = document.getElementById('result-icon');
  if (icon) {
    icon.style.animation = 'none';
    void icon.offsetHeight; // reflow
    icon.style.animation = 'successBounce 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards';
  }

  // Counter animation only for direct-entry (non-cinematic) path
  if (!maskDigits) {
    animateCounter(hrEl, 0, Math.round(hr.mean), 'BPM', 800);
    animateCounter(hrvEl, 0, Math.round(hrv.mean), 'ms', 800);
    animateCounter(rrEl, 0, Math.round(rr.mean), '次/分', 800);
  }
}

function animateCounter(el, from, to, unit, duration) {
  if (!el) return;
  const startTime = performance.now();

  function tick(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = easeOutCubic(progress);
    const current = Math.round(from + (to - from) * eased);
    el.textContent = `${current} ${unit}`;

    if (progress < 1) {
      requestAnimationFrame(tick);
    }
  }

  requestAnimationFrame(tick);
}

// ─────────────────────────────────────────────
// Step 6: Next Action
// ─────────────────────────────────────────────

function selectNextAction(action) {
  // Visual feedback
  const cards = document.querySelectorAll('.action-card');
  cards.forEach(c => c.style.borderColor = '');

  const el = event.currentTarget;
  if (el) {
    el.style.borderColor = 'var(--success)';
    el.style.background = 'rgba(52, 199, 89, 0.08)';
  }

  // In production, this would route to the appropriate screen
  setTimeout(() => {
    alert(`🎉 Baseline 建立完成！\n\n下一步：${
      action === 'scan' ? '第一次 Emotion Scan' :
      action === 'trader' ? 'Trader Mode 前檢查' :
      '探索 TENKI'
    }\n\n（Production 環境會導航到對應頁面）`);
  }, 300);
}

// ─────────────────────────────────────────────
// Scan Particle System
// Mode A: converge (Phase 1 gather) — particles fly toward finger target
// Mode B: orbit    (Phase 2 accumulate) — particles circle the energy ball
// Mode C: burst    (Phase 3 climax + Phase 4 transition) — radial explosion
// ─────────────────────────────────────────────

function startParticleSystem() {
  const canvas = document.getElementById('scan-particles');
  if (!canvas) return;

  // Stop any previous instance
  if (state.particleSystem) state.particleSystem.stop();

  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.max(1, Math.floor(rect.width * dpr));
  canvas.height = Math.max(1, Math.floor(rect.height * dpr));

  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const W = rect.width;
  const H = rect.height;
  // Finger target ≈ middle-ish of scan step (matches scan-ring-container)
  const target = { x: W / 2, y: H * 0.48 };

  const PARTICLE_COUNT = 140;
  const particles = [];

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    particles.push(spawnConvergeParticle(W, H, target));
  }

  let mode = 'converge';
  let modeStart = performance.now();
  let running = true;

  function spawnConvergeParticle(w, h, t) {
    // Begin far from target, fly inward
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.max(w, h) * (0.5 + Math.random() * 0.4);
    return {
      x: t.x + Math.cos(angle) * dist,
      y: t.y + Math.sin(angle) * dist,
      vx: 0,
      vy: 0,
      r: 0.8 + Math.random() * 1.8,
      alpha: 0.25 + Math.random() * 0.55,
      hue: 188 + Math.random() * 18, // cyan band
      angle: angle,
      orbitRadius: 60 + Math.random() * 55,
      orbitSpeed: 0.6 + Math.random() * 1.4,
      life: 1,
    };
  }

  function frame() {
    if (!running) return;

    const now = performance.now();
    const t = (now - modeStart) / 1000;

    ctx.clearRect(0, 0, W, H);

    for (const p of particles) {
      if (mode === 'converge') {
        // Steer toward target with easing
        const dx = target.x - p.x;
        const dy = target.y - p.y;
        const d = Math.hypot(dx, dy) || 1;
        const pull = 0.04 + Math.min(0.12, t * 0.03);
        p.vx += (dx / d) * pull;
        p.vy += (dy / d) * pull;
        p.vx *= 0.92; p.vy *= 0.92;
        p.x += p.vx;
        p.y += p.vy;
        // Snap to orbit when near
        if (d < p.orbitRadius + 6) {
          p.angle = Math.atan2(dy, dx) + Math.PI;
        }
      } else if (mode === 'orbit') {
        p.angle += (p.orbitSpeed * 0.015);
        // Gentle breathing
        const breath = 1 + Math.sin((now / 700) + p.orbitSpeed) * 0.04;
        const rx = p.orbitRadius * breath;
        const targetX = target.x + Math.cos(p.angle) * rx;
        const targetY = target.y + Math.sin(p.angle) * rx;
        p.x += (targetX - p.x) * 0.18;
        p.y += (targetY - p.y) * 0.18;
      } else if (mode === 'burst') {
        // Explode outward from target, accelerating
        if (!p.bursted) {
          const bx = p.x - target.x;
          const by = p.y - target.y;
          const bd = Math.hypot(bx, by) || 1;
          const speed = 4 + Math.random() * 5;
          p.vx = (bx / bd) * speed;
          p.vy = (by / bd) * speed;
          p.bursted = true;
        }
        p.vx *= 1.04;
        p.vy *= 1.04;
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.012;
      } else if (mode === 'converge-out') {
        // Final beat: decelerate and fade toward zero over ~800ms
        if (!p.fadeStart) p.fadeStart = now;
        p.vx *= 0.92;
        p.vy *= 0.92;
        p.x += p.vx;
        p.y += p.vy;
        const fadeT = (now - p.fadeStart) / 800;
        p.life = Math.max(0, 1 - fadeT);
      }

      const a = Math.max(0, p.alpha * p.life);
      if (a <= 0) continue;

      // Soft glow
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * 2.2, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${p.hue}, 88%, 65%, ${a * 0.18})`;
      ctx.fill();
      // Core
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${p.hue}, 92%, 72%, ${a})`;
      ctx.fill();
    }

    // Auto-switch from converge → orbit after gather phase
    if (mode === 'converge' && t > 3.0) {
      mode = 'orbit';
      modeStart = now;
    }

    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);

  state.particleSystem = {
    stop() {
      running = false;
      ctx.clearRect(0, 0, W, H);
    },
    burst() {
      mode = 'burst';
      modeStart = performance.now();
      // Shift hue toward warm gold for climax
      for (const p of particles) {
        p.hue = 46 + Math.random() * 14; // gold band
        p.r *= 1.3;
        p.life = 1;
        p.bursted = false;
      }
    },
    orbit() {
      mode = 'orbit';
      modeStart = performance.now();
    },
    // Beat 3 of cinematic transition: particles decelerate + fade out
    // over ~800ms so the Summary Card can own the frame.
    converge() {
      mode = 'converge-out';
      modeStart = performance.now();
      const now = performance.now();
      for (const p of particles) p.fadeStart = now;
    },
  };
}

// ─────────────────────────────────────────────
// Particle Background (subtle stardust)
// ─────────────────────────────────────────────

function initParticles() {
  const container = document.getElementById('particle-canvas-intro');
  if (!container || container.querySelector('canvas')) return;

  const canvas = document.createElement('canvas');
  canvas.width = 390;
  canvas.height = 844;
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  container.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  const particles = [];
  const PARTICLE_COUNT = 40;

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    particles.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 2 + 0.5,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      alpha: Math.random() * 0.4 + 0.1,
      pulse: Math.random() * Math.PI * 2,
    });
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.pulse += 0.02;

      // Wrap around
      if (p.x < 0) p.x = canvas.width;
      if (p.x > canvas.width) p.x = 0;
      if (p.y < 0) p.y = canvas.height;
      if (p.y > canvas.height) p.y = 0;

      const alpha = p.alpha * (0.7 + 0.3 * Math.sin(p.pulse));
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(0, 180, 216, ${alpha})`;
      ctx.fill();
    });

    requestAnimationFrame(draw);
  }

  draw();
}

// ─────────────────────────────────────────────
// Init
// ─────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  // Initialize step 0
  updateStepDots(0);
  initParticles();
});
