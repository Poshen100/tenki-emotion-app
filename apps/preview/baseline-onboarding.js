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
 *   5. Next Action: first scan / explore (Trader Mode 為 Settings 內 opt-in，不在 onboarding 露出)
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
  sensorChoice: 'face',
  readinessInterval: null,
  scanRAF: null,
  scanStartTs: 0,
  scanDuration: 60,        // Phase 2 default (finger); 60 for face
  scanEarliestComplete: 45, // Earliest auto-complete window
  scanHardCap: 75,         // Safety upper bound
  readinessSimStep: 0,
  isScanning: false,
  scanPhase: 'idle',       // idle | wait | gather | accumulate | climax | final | transition
  scanWaitStartTs: 0,      // v1.2: timestamp when scan-step entered (used during 'wait')
  signalValidSinceTs: null, // v1.2: timestamp when signal first hit GOOD/EXCELLENT
  signalDegradeSinceTs: null, // v1.2: timestamp when signal first dropped below GOOD (forgetting-prevention)
  forgetReminderActive: false, // v1.2: true while finger-guide & banner are re-shown after signal drop
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

  // Dynamic calibration-ceremony class on #app to orchestrate step dots fade-out
  const appContainer = document.getElementById('app');
  if (appContainer) {
    if (stepIndex === 2) {
      appContainer.classList.add('calibration-ceremony');
    } else {
      appContainer.classList.remove('calibration-ceremony');
    }
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
    case 1:
      startReadinessCheck();
      break;
    case 2:
      startCalibrationScan();
      break;
    case 3:
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

// Step 2: Sensor Selection removed for Model B face-only onboarding.

function updateInstructions(type) {
  const copy = type === 'finger'
    ? {
        title: '先把鏡頭蓋對',
        body: '這一步做得越準，後面的基線越穩。先看 2 秒示範，再照著動態提示放好手指。',
        demoTitle: '用指腹，置中，蓋滿',
        demoBody: '鏡頭要整顆消失在指腹下面，邊緣不要漏光。',
        bullets: [
          '用指腹而不是指尖，覆蓋面積更穩。',
          '手指輕放就好，不要用力按壓鏡頭。',
          '握穩手機，連續靜止 1 秒讓訊號鎖定。',
        ],
        note: '我們只在理想覆蓋時建立 baseline，讓你的 reference 更穩。',
        coach: '把指腹移到後鏡頭正中央',
        liveTitle: '照著提示把手指放到理想位置',
      }
    : {
        title: 'Environment Calibration',
        body: '臉部 baseline 仍在 beta。先把臉放正、補足光線，再讓系統確認穩定度。',
        demoTitle: 'Face beta 準備中',
        demoBody: '目前這個 step 先用 checklist 幫你對齊光線與穩定度。',
        bullets: [
          '讓整張臉都進入鏡頭取景範圍。',
          '避免強烈逆光，讓五官保持清楚。',
          '固定頭部與手機，連續穩住 1 秒。',
        ],
        note: 'beta 模式會先用較保守的 gate，避免把不穩定的畫面寫進 baseline。',
        coach: '先把臉放進鏡頭正中央',
        liveTitle: '先把臉對準，再等系統放行',
      };

  setReadinessText('readiness-title', copy.title);
  setReadinessText('readiness-body', copy.body);
  setReadinessText('cover-demo-title', copy.demoTitle);
  setReadinessText('cover-demo-body', copy.demoBody);
  setReadinessText('readiness-success-note', copy.note);
  setReadinessText('readiness-coach', copy.coach);
  setReadinessTextInSelector('.readiness-live-title', copy.liveTitle);

  const card = document.getElementById('perfect-cover-card');
  if (card) card.classList.toggle('is-hidden', type !== 'finger');

  const list = document.getElementById('instructions-list');
  if (list) {
    list.innerHTML = copy.bullets.map((text, i) =>
      `<div class="cover-bullet">
        <span class="cover-bullet-icon">${i + 1}</span>
        <span class="cover-bullet-copy">${text}</span>
      </div>`
    ).join('');
  }
}

const READINESS_THRESHOLDS = {
  coverage: { ready: 0.88, warning: 0.72, missing: 0.58 },
  brightness: { ready: 0.38, warning: 0.30 },
  stability: { ready: 0.72, warning: 0.55 },
  sqi: { ready: 0.60, warning: 0.46 },
};

const READINESS_STAGE_ORDER = ['approach', 'cover', 'hold', 'ready'];

const READINESS_TONE_COLORS = {
  neutral: '',
  warning: '#F5A623',
  danger: '#FF3B30',
  success: '#34C759',
};

function setReadinessText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function setReadinessTextInSelector(selector, text) {
  const el = document.querySelector(selector);
  if (el) el.textContent = text;
}

function setReadinessStage(stage) {
  const activeIndex = READINESS_STAGE_ORDER.indexOf(stage);
  document.querySelectorAll('.readiness-stage-pill, .cover-chip').forEach((el) => {
    const elStage = el.dataset.stage || '';
    const elIndex = READINESS_STAGE_ORDER.indexOf(elStage);
    el.classList.toggle('is-active', elIndex === activeIndex);
    el.classList.toggle('is-complete', elIndex > -1 && elIndex < activeIndex);
  });
}

function setReadinessFeedback(primary, secondary, tone) {
  const msgEl = document.getElementById('readiness-message');
  const detailEl = document.getElementById('readiness-detail');
  const blockEl = document.getElementById('readiness-status-block');
  const color = READINESS_TONE_COLORS[tone] || '';

  if (msgEl) {
    msgEl.textContent = primary;
    msgEl.style.color = color;
  }
  if (detailEl) detailEl.textContent = secondary;
  if (blockEl) blockEl.dataset.tone = tone;
}

function setReadinessButton(enabled) {
  const btn = document.getElementById('btn-start-scan');
  if (!btn) return;
  btn.disabled = !enabled;
  btn.textContent = enabled ? '開始建立基線' : '等待理想覆蓋';
}

/**
 * Updates one Environment Calibration status pill (Screen A).
 * @param {string} name - 'lighting' | 'distance' | 'stability'
 * @param {boolean} ok - latched pass state
 */
function setEnvPill(name, ok) {
  const pill = document.getElementById('pill-' + name);
  if (!pill) return;
  const dot = pill.querySelector('.env-pill-dot');
  if (!dot) return;
  dot.dataset.ok = ok ? '1' : '0';
  dot.textContent = ok ? '\u2713' : '\u2715';
}

function getFingerReadinessAssessment(metrics) {
  const { coverage, brightness, stability, sqi, bpm } = metrics;

  if (coverage < READINESS_THRESHOLDS.coverage.missing) {
    return {
      stage: 'approach',
      tone: 'danger',
      ready: false,
      coach: '把指腹移到後鏡頭正中央',
      message: '先找到鏡頭位置',
      detail: '讓鏡頭完整消失在指腹下面，先不用急著開始掃描。',
      label: '找到後鏡頭',
    };
  }

  if (coverage < READINESS_THRESHOLDS.coverage.ready) {
    return {
      stage: 'cover',
      tone: 'warning',
      ready: false,
      coach: '再蓋滿一點，邊緣不要漏光',
      message: '覆蓋快對了',
      detail: '鏡頭四周還有空隙。請用指腹而不是指尖，把邊緣也一起蓋滿。',
      label: '再蓋滿一點',
    };
  }

  if (stability < READINESS_THRESHOLDS.stability.ready) {
    return {
      stage: 'hold',
      tone: 'warning',
      ready: false,
      coach: '位置對了，先不要滑動',
      message: '先穩住 1 秒',
      detail: '現在最重要的是不要晃。握住手機，讓手指和鏡頭一起穩定下來。',
      label: '保持靜止',
    };
  }

  if (brightness < READINESS_THRESHOLDS.brightness.ready) {
    return {
      stage: 'hold',
      tone: 'warning',
      ready: false,
      coach: '換到更亮一點的地方',
      message: '光線再亮一點會更穩',
      detail: '覆蓋已經對了，但光線太弱會讓波形不穩，先移到比較亮的位置。',
      label: '亮度偏低',
    };
  }

  if (sqi < READINESS_THRESHOLDS.sqi.ready) {
    return {
      stage: 'hold',
      tone: 'warning',
      ready: false,
      coach: '很好，再穩一秒讓訊號鎖定',
      message: '幾乎到了',
      detail: '覆蓋、亮度都已過線，系統正在確認訊號品質。',
      label: bpm > 0 ? `${bpm} BPM 鎖定中` : '訊號鎖定中',
    };
  }

  return {
    stage: 'ready',
    tone: 'success',
    ready: true,
    coach: '很好，這就是理想覆蓋',
    message: '準備就緒，可以開始',
    detail: '覆蓋、穩定、亮度都過線了。現在建立 baseline，精準度會更可靠。',
    label: bpm > 0 ? `${bpm} BPM 已鎖定` : '理想覆蓋 ✓',
  };
}

function getFaceReadinessAssessment(metrics) {
  const { coverage, brightness, stability, sqi } = metrics;

  if (coverage < 0.58) {
    return {
      stage: 'approach',
      tone: 'danger',
      ready: false,
      coach: '把臉放進鏡頭正中央',
      message: '先把臉放進取景範圍',
      detail: '讓眼睛和鼻樑落在中央，距離鏡頭維持在舒服的閱讀距離。',
      label: '對準臉部',
    };
  }

  if (brightness < 0.34) {
    return {
      stage: 'cover',
      tone: 'warning',
      ready: false,
      coach: '補一點正面光',
      message: '光線不夠穩',
      detail: '避免逆光，讓臉部亮度平均一點，系統才能更穩定地抓到 baseline。',
      label: '調整光線',
    };
  }

  if (stability < 0.68) {
    return {
      stage: 'hold',
      tone: 'warning',
      ready: false,
      coach: '保持頭部與手機靜止',
      message: '先穩住一下',
      detail: '畫面已對準，但還需要一小段穩定時間，才能讓 gate 放行。',
      label: '保持靜止',
    };
  }

  if (sqi < 0.56) {
    return {
      stage: 'hold',
      tone: 'warning',
      ready: false,
      coach: '很好，再穩一秒讓系統確認',
      message: '正在確認畫面品質',
      detail: 'beta 模式會多看一下畫面品質，避免把模糊資料寫進 baseline。',
      label: '確認中',
    };
  }

  return {
    stage: 'ready',
    tone: 'success',
    ready: true,
    coach: '很好，可以開始 face baseline',
    message: '準備就緒，可以開始',
    detail: '光線與穩定度已過線，現在可以開始建立 baseline。',
    label: '畫面已鎖定',
  };
}

function getReadinessAssessment(metrics) {
  return state.sensorChoice === 'finger'
    ? getFingerReadinessAssessment(metrics)
    : getFaceReadinessAssessment(metrics);
}

function applyReadinessState(sample) {
  const metrics = {
    coverage: clamp01(sample.coverage || 0),
    brightness: clamp01(sample.brightness || 0),
    stability: clamp01(sample.stability || 0),
    sqi: clamp01(sample.sqi || 0),
    bpm: sample.bpm || 0,
  };

  const now = Date.now();
  const dt = state.lastReadinessTs ? now - state.lastReadinessTs : 33;
  state.lastReadinessTs = now;

  // ── Latch: each meter stays green for 3s after crossing threshold
  const TH = READINESS_THRESHOLDS;
  const covG = isLatchedGreen('coverage', metrics.coverage, TH.coverage.ready);
  const briG = isLatchedGreen('brightness', metrics.brightness, TH.brightness.ready);
  const staG = isLatchedGreen('stability', metrics.stability, TH.stability.ready);
  const sqiG = isLatchedGreen('sqi', metrics.sqi, TH.sqi.ready);

  // ── Screen A status pills (Lighting / Distance / Stability)
  setEnvPill('lighting', briG);
  setEnvPill('distance', covG);
  setEnvPill('stability', staG);

  // ── Meter visuals (use latched state for icons)
  const meterIcon = (latched, value, readyTh, warnTh) =>
    latched ? 'statusOk' : getMeterIcon(value, readyTh, warnTh);

  updateMeter('coverage', metrics.coverage * 100,
    meterIcon(covG, metrics.coverage, TH.coverage.ready, TH.coverage.warning),
    { green: TH.coverage.ready * 100, yellow: TH.coverage.warning * 100 });
  updateMeter('brightness', metrics.brightness * 100,
    meterIcon(briG, metrics.brightness, TH.brightness.ready, TH.brightness.warning),
    { green: TH.brightness.ready * 100, yellow: TH.brightness.warning * 100 });
  updateMeter('stability', metrics.stability * 100,
    meterIcon(staG, metrics.stability, TH.stability.ready, TH.stability.warning),
    { green: TH.stability.ready * 100, yellow: TH.stability.warning * 100 });
  updateMeter('sqi', metrics.sqi * 100,
    meterIcon(sqiG, metrics.sqi, TH.sqi.ready, TH.sqi.warning),
    { green: TH.sqi.ready * 100, yellow: TH.sqi.warning * 100 });

  // ── Patience: accumulate time with yellow+ coverage
  if (metrics.coverage >= TH.coverage.warning) {
    state.yellowCoverageMs += dt;
  } else {
    state.yellowCoverageMs = Math.max(0, state.yellowCoverageMs - dt * 2);
  }

  // ── Strict assessment from the new staged system
  const assessment = getReadinessAssessment(metrics);

  // ── 3-Layer smart gate ──
  // Layer 1: strict assessment says ready (all thresholds met)
  const layer1 = assessment.ready;

  // Layer 2: coverage ≥ warning + at least 2 of 3 others latched green
  const covRelaxed = metrics.coverage >= TH.coverage.warning || covG;
  const othersCount = [briG, staG, sqiG].filter(Boolean).length;
  const layer2 = !layer1 && covRelaxed && othersCount >= 2;

  // Layer 3: patience — 10s of yellow+ coverage with basic conditions
  const layer3 = !layer1 && !layer2
    && state.yellowCoverageMs >= READY_PATIENCE_MS
    && metrics.coverage >= TH.coverage.missing
    && metrics.brightness >= TH.brightness.warning
    && metrics.stability >= TH.stability.warning;

  const shouldUnlock = layer1 || layer2 || layer3;

  // ── Once unlocked, stay unlocked
  if (state.readinessUnlocked) {
    setReadinessStage('ready');
    setReadinessButton(true);
    return;
  }

  // ── Hold-steady timer
  if (shouldUnlock) {
    if (!state.readySince) state.readySince = now;
    const holdNeeded = layer1 ? 0 : layer3 ? 0 : READY_HOLD_MS;
    const elapsed = now - state.readySince;

    if (elapsed >= holdNeeded) {
      state.readinessUnlocked = true;

      const readyAssessment = layer1 ? assessment : {
        stage: 'ready',
        tone: 'success',
        ready: true,
        coach: layer2 ? '信號夠好了，可以開始' : '已等待足夠時間，可以開始',
        message: layer2 ? '信號良好，可以開始' : '信號足夠，可以開始',
        detail: '現在建立 baseline，精準度足夠可靠。',
        label: metrics.bpm > 0 ? `${metrics.bpm} BPM` : '可以開始 ✓',
      };

      setReadinessStage(readyAssessment.stage);
      setReadinessText('readiness-coach', readyAssessment.coach);
      setReadinessFeedback(readyAssessment.message, readyAssessment.detail, readyAssessment.tone);
      setReadinessButton(true);
      setReadinessText('readiness-camera-label', readyAssessment.label);

      const container = document.getElementById('readiness-camera-container');
      if (container) container.dataset.state = 'green';
      return;
    }

    // Hold countdown
    const remaining = Math.ceil((holdNeeded - elapsed) / 1000);
    setReadinessStage('hold');
    setReadinessText('readiness-coach', '位置對了，穩住不動');
    setReadinessFeedback(
      `保持不動… ${remaining} 秒後就緒`,
      '覆蓋和訊號都在線了，只差最後穩定確認。',
      'success'
    );
    setReadinessButton(false);
    setReadinessText('readiness-camera-label', `穩定確認中…`);

    const container = document.getElementById('readiness-camera-container');
    if (container) container.dataset.state = 'yellow';
    return;
  }

  // ── Not ready: use the strict assessment's guidance
  state.readySince = 0;

  setReadinessStage(assessment.stage);
  setReadinessText('readiness-coach', assessment.coach);
  setReadinessFeedback(assessment.message, assessment.detail, assessment.tone);
  setReadinessButton(false);
  setReadinessText('readiness-camera-label', assessment.label);

  const container = document.getElementById('readiness-camera-container');
  if (container) {
    container.dataset.state = assessment.stage === 'approach' ? 'red' : 'yellow';
  }
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

// ─────────────────────────────────────────────
// Step 3: Readiness Check — Real Camera Data
// ─────────────────────────────────────────────

function startReadinessCheck() {
  state.isScanning = false;
  state.cameraActive = false;
  state.readinessSimStep = 0;
  if (state.readinessInterval) clearInterval(state.readinessInterval);
  state.readinessInterval = null;
  if (state.cameraSession) {
    try { state.cameraSession.stop(); } catch (_) {}
    state.cameraSession = null;
  }

  // Reset smart gate state
  state.readinessLatch = { coverage: 0, brightness: 0, stability: 0, sqi: 0 };
  state.readySince = 0;
  state.yellowCoverageMs = 0;
  state.lastReadinessTs = 0;
  state.readinessUnlocked = false;

  updateInstructions(state.sensorChoice);
  setReadinessStage('approach');
  setReadinessButton(false);
  setReadinessFeedback(
    state.sensorChoice === 'finger' ? '正在啟動相機…' : '正在準備 face beta…',
    state.sensorChoice === 'finger'
      ? '先看一下示範，再把指腹移到後鏡頭正中央。'
      : '先把臉放進鏡頭中央，系統會用更保守的 gate 幫你確認穩定度。',
    'neutral'
  );
  setReadinessText('readiness-camera-label', state.sensorChoice === 'finger' ? '等待相機…' : 'Face beta preview');

  const container = document.getElementById('readiness-camera-container');
  if (container) {
    container.style.display = '';
    container.dataset.state = 'neutral';
  }

  updateMeter('coverage', 0, '—', { green: READINESS_THRESHOLDS.coverage.ready * 100, yellow: READINESS_THRESHOLDS.coverage.warning * 100 });
  updateMeter('brightness', 0, '—', { green: READINESS_THRESHOLDS.brightness.ready * 100, yellow: READINESS_THRESHOLDS.brightness.warning * 100 });
  updateMeter('stability', 0, '—', { green: READINESS_THRESHOLDS.stability.ready * 100, yellow: READINESS_THRESHOLDS.stability.warning * 100 });
  updateMeter('sqi', 0, '—', { green: READINESS_THRESHOLDS.sqi.ready * 100, yellow: READINESS_THRESHOLDS.sqi.warning * 100 });

  if (state.sensorChoice !== 'finger') {
    startSimulatedReadiness('face');
    return;
  }

  startReadinessCamera();
}

async function startReadinessCamera() {
  const videoEl = document.getElementById('readiness-video');
  const container = document.getElementById('readiness-camera-container');
  const labelEl = document.getElementById('readiness-camera-label');
  const api = window.TENKI_PREVIEW_CAMERA;

  if (!videoEl || !api || !api.startFingerCamera) {
    setReadinessFeedback(
      '無法直接存取相機，改用示範模式',
      '你還是可以先看理想覆蓋的節奏，確認 flow 和提示是否順手。',
      'warning'
    );
    startSimulatedReadiness('finger');
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
    if (container) container.dataset.state = 'red';
    if (labelEl) labelEl.textContent = '對準後鏡頭';
  } catch (err) {
    state.cameraActive = false;
    if (container) container.dataset.state = 'yellow';
    if (labelEl) labelEl.textContent = '模擬覆蓋教學';
    setReadinessFeedback(
      err && err.name === 'NotAllowedError' ? '相機權限被拒，改用示範模式' : '無法開啟相機，改用示範模式',
      '這個 fallback 仍然能幫你檢查提示是否清楚，之後再接上真實相機 gate。',
      'warning'
    );
    startSimulatedReadiness('finger');
  }
}

// ── Smart gate constants ──
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
  applyReadinessState({
    coverage: sample.coverage,
    brightness: sample.brightness || 0,
    stability: sample.stability || 0,
    sqi: sample.sqi || 0,
    bpm: sample.bpm || 0,
  });
}

function startSimulatedReadiness(mode = state.sensorChoice) {
  state.readinessSimStep = 0;
  if (state.readinessInterval) clearInterval(state.readinessInterval);

  if (mode === 'face') {
    setReadinessText('readiness-camera-label', 'Face beta preview');
  } else {
    setReadinessText('readiness-camera-label', '模擬覆蓋教學');
  }

  state.readinessInterval = setInterval(() => {
    state.readinessSimStep++;
    simulateReadiness(state.readinessSimStep, mode);
  }, 420);
}

function simulateReadiness(step, mode = state.sensorChoice) {
  const maxSteps = mode === 'finger' ? 12 : 11;
  const progress = Math.min(step / maxSteps, 1);
  const eased = easeOutCubic(progress);
  const wobble = Math.sin(progress * Math.PI * 1.2) * 0.02;

  const sample = mode === 'finger'
    ? {
        coverage: clamp01(easeOutCubic(Math.min(progress * 1.2, 1)) * 0.96 + wobble),
        brightness: clamp01(0.28 + eased * 0.22),
        stability: clamp01(Math.max(0, eased * 0.86 - (progress < 0.55 ? 0.08 : 0))),
        sqi: clamp01(Math.max(0, eased * 0.74 - (progress < 0.7 ? 0.08 : 0))),
        bpm: progress > 0.78 ? 68 : 0,
      }
    : {
        coverage: clamp01(0.44 + eased * 0.48),
        brightness: clamp01(0.24 + eased * 0.26),
        stability: clamp01(Math.max(0, eased * 0.82 - (progress < 0.52 ? 0.10 : 0))),
        sqi: clamp01(Math.max(0, eased * 0.68 - (progress < 0.66 ? 0.08 : 0))),
        bpm: 0,
      };

  applyReadinessState(sample);

  if (getReadinessAssessment(sample).ready) {
    clearInterval(state.readinessInterval);
    state.readinessInterval = null;
  }
}

function updateMeter(id, percent, icon, thresholds = { green: 75, yellow: 45 }) {
  const fill = document.getElementById(`meter-${id}`);
  const status = document.getElementById(`status-${id}`);
  const { green, yellow } = thresholds;

  if (fill) {
    fill.style.width = `${Math.min(100, percent)}%`;
    fill.className = 'meter-fill';
    if (percent >= green) fill.classList.add('green');
    else if (percent >= yellow) fill.classList.add('yellow');
    else if (percent > 0) fill.classList.add('red');
  }
  if (status) {
    var svg = window.tenkiIcon ? window.tenkiIcon(icon, { size: 18 }) : icon;
    if (svg) {
      status.innerHTML = svg;
    }
  }
}

function getMeterIcon(value, greenTh, yellowTh) {
  if (value >= greenTh) return 'statusOk';
  if (value >= yellowTh) return 'statusWarn';
  return 'statusFail';
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
const SIGNAL_VALID_GATE_MS = 3000; // v1.2: signal must hold GOOD/EXCELLENT this long before countdown starts
const SIGNAL_DEGRADE_MS = 2000;     // v1.2: signal must stay below GOOD this long before re-showing guide

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
  state.scanPhase = 'wait';                        // v1.2: enter wait phase first
  state.sqiHistory = [];
  state.rollingSqi = 0;
  state.qualityTier = 'weak';
  state.scanStartTs = 0;                           // v1.2: countdown start deferred until signal-valid gate passes
  state.scanWaitStartTs = performance.now();
  state.signalValidSinceTs = null;
  state.signalDegradeSinceTs = null;
  state.forgetReminderActive = false;
  state.baseline = {
    hr: { mean: 0, std: 0 },
    hrv: { mean: 0, std: 0 },
    rr: { mean: 0, std: 0 },
  };

  if (scanEl) {
    scanEl.classList.remove('phase-accumulate', 'phase-climax', 'phase-final', 'phase-transition', 'phase-gather');
    scanEl.classList.add('phase-wait');
  }
  if (timerEl) {
    // v1.2: paused state — countdown will start once signal-valid gate passes
    timerEl.textContent = '';
    timerEl.style.color = 'rgba(255, 255, 255, 0.30)';
  }
  if (statusEl) {
    statusEl.style.color = '';
    statusEl.textContent = '準備中...';
  }
  if (noteEl) noteEl.textContent = '請保持不動';
  if (ringEl) ringEl.style.strokeDashoffset = SCAN_CIRCUMFERENCE;
  // OOM Fix #8-11 reset: enterClimax hides scan-banner / ceremony-dialog /
  // finger-halo / scan-video via inline display:none to drop GPU backing
  // store. On scan restart we must restore default display so the CSS
  // .is-hidden ↔ active transitions take over again.
  const bannerResetEl = document.getElementById('scan-banner');
  if (bannerResetEl) bannerResetEl.style.display = '';
  if (scanEl) {
    scanEl.querySelectorAll('.finger-halo, .finger-halo-outer').forEach(function(el) {
      el.style.display = '';
      el.style.opacity = '';
    });
  }
  const scanVideoResetEl = document.getElementById('scan-video');
  if (scanVideoResetEl) {
    scanVideoResetEl.style.display = '';
    scanVideoResetEl.style.opacity = '';
  }
  // OOM Fix #7: ceremony-dialog has 32px backdrop-filter blur — extremely
  // GPU-heavy on iOS Safari. During wait phase it stacks on top of the
  // scan-banner's 12px blur + camera + halo + video, pushing WebContent
  // process past its memory cap. Hide it during wait; gate-pass in tickWait
  // will add .visible when the user has actually covered the lens.
  // (Pairs with OOM Fix #3 which defers particles to the same gate-pass.)
  if (dialogEl && dialogTextEl) {
    dialogEl.style.display = '';   // Clear OOM Fix #10's inline hide on restart
    dialogEl.classList.remove('visible');
    dialogTextEl.textContent = state.sensorChoice === 'face' ? '正在採集你的臉部基線' : '正在凝聚你的生理基線';
  }
  if (readyEl) readyEl.style.display = 'none';

  // v1.2: reset camera target ring to "waiting" (pulsing arrows)
  setCameraRingState('waiting');
  // v1.2: show top guidance banner (will hide once signal reaches GOOD)
  setScanBannerVisible(true);

  // OOM Fix #3: defer particle system to gather phase (not during wait)
  // During wait, camera + meters are already active — particles are invisible
  // behind the wait UI and just burn GPU memory.

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

/**
 * v1.2 — Wait phase tick.
 * Continuously updates telemetry so the quality tier reflects the live cover,
 * but defers the countdown until the signal has stayed GOOD/EXCELLENT for
 * SIGNAL_VALID_GATE_MS. On gate-pass, transitions to 'gather' and starts the
 * real countdown.
 */
function tickWait(now) {
  const waitElapsedSec = (now - state.scanWaitStartTs) / 1000;

  // Drive telemetry so qualityTier updates while the user finds the right cover
  if (state.cameraActive && state.lastCameraSample) {
    updateBaselineFromCamera(state.lastCameraSample);
  }
  updateSignalTelemetry(waitElapsedSec);
  updateCoverageGuidance(waitElapsedSec);

  // Track signal-valid duration
  const validNow =
    state.qualityTier === 'good' || state.qualityTier === 'excellent';

  if (validNow) {
    if (state.signalValidSinceTs === null) {
      state.signalValidSinceTs = now;
    }
    if (now - state.signalValidSinceTs >= SIGNAL_VALID_GATE_MS) {
      // ── Gate passed: countdown starts now ──
      state.scanPhase = 'gather';
      state.scanStartTs = now;

      const scanEl = document.getElementById('step-scan');
      if (scanEl) {
        scanEl.classList.remove('phase-wait');
        scanEl.classList.add('phase-gather');
      }
      const timerEl = document.getElementById('scan-timer');
      if (timerEl) {
        timerEl.textContent = state.scanDuration;
        timerEl.style.color = '';
      }

      // v1.2 visual handoff: ring → covered, hide guide & banner
      setCameraRingState('covered');
      setScanBannerVisible(false);
      const fingerGuideEl = document.getElementById('finger-guide-anim');
      if (fingerGuideEl) fingerGuideEl.classList.add('is-hidden');

      // OOM Fix #14: Delay torch activation to let iOS WebKit GPU settle
      // after the phase transition UI changes.
      if (state.cameraSession && state.cameraSession.toggleTorch) {
        setTimeout(() => {
          if (state.scanPhase === 'gather' || state.scanPhase === 'accumulate') {
            state.cameraSession.toggleTorch(true);
          }
        }, 500);
      }

      // OOM Fix #3: start particles NOW (gather phase) instead of wait phase
      startParticleSystem();
      // OOM Fix #7: now safe to bring in ceremony-dialog (32px blur) — banner
      // has just been hidden, finger-guide is hiding, so only one blur layer
      // is in flight at a time.
      const dialogEl = document.getElementById('ceremony-dialog');
      if (dialogEl) dialogEl.classList.add('visible');

      // Light haptic confirms successful covering (graceful no-op if unsupported)
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        try { navigator.vibrate(20); } catch (_) {}
      }
    }
  } else {
    state.signalValidSinceTs = null;
  }

  state.scanRAF = requestAnimationFrame(tickCalibration);
}

/**
 * v1.2 — Forgetting-prevention monitor (accumulate phase only).
 * If the signal drops below GOOD for SIGNAL_DEGRADE_MS, the finger guide,
 * banner, and target ring are re-shown to nudge the user back to a clean
 * cover. When the signal recovers and holds GOOD for SIGNAL_VALID_GATE_MS,
 * the guide elements dismiss again so the ceremony continues uninterrupted.
 */
function monitorSignalForgetting(now) {
  const validNow =
    state.qualityTier === 'good' || state.qualityTier === 'excellent';

  if (validNow) {
    state.signalDegradeSinceTs = null;
    if (state.forgetReminderActive) {
      if (state.signalValidSinceTs === null) {
        state.signalValidSinceTs = now;
      }
      if (now - state.signalValidSinceTs >= SIGNAL_VALID_GATE_MS) {
        applySignalRecoveryHandoff();
      }
    }
  } else {
    state.signalValidSinceTs = null;
    if (state.signalDegradeSinceTs === null) {
      state.signalDegradeSinceTs = now;
    }
    if (
      !state.forgetReminderActive &&
      now - state.signalDegradeSinceTs >= SIGNAL_DEGRADE_MS
    ) {
      applySignalWeakHandoff();
    }
  }
}

function applySignalWeakHandoff() {
  if (state.forgetReminderActive) return;
  state.forgetReminderActive = true;

  setCameraRingState('signal-weak');
  setScanBannerVisible(true);
  const fingerGuideEl = document.getElementById('finger-guide-anim');
  if (fingerGuideEl) fingerGuideEl.classList.remove('is-hidden');
  // OOM Fix #7: hide ceremony-dialog (32px blur) while banner is back —
  // mutually exclusive blur layers prevent GPU stack on signal drop.
  const dialogElWeak = document.getElementById('ceremony-dialog');
  if (dialogElWeak) dialogElWeak.classList.remove('visible');

  // Soft warning haptic — short triple tap, gracefully no-op when unsupported
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try { navigator.vibrate([40, 60, 40]); } catch (_) {}
  }
}

function applySignalRecoveryHandoff() {
  if (!state.forgetReminderActive) return;
  state.forgetReminderActive = false;

  setCameraRingState('covered');
  setScanBannerVisible(false);
  const fingerGuideEl = document.getElementById('finger-guide-anim');
  if (fingerGuideEl) fingerGuideEl.classList.add('is-hidden');
  // OOM Fix #7: now safe to bring ceremony-dialog (32px blur) back
  const dialogElRec = document.getElementById('ceremony-dialog');
  if (dialogElRec) dialogElRec.classList.add('visible');
}

function tickCalibration() {
  const now = performance.now();

  // v1.2 wait phase: hold countdown until signal stays GOOD/EXCELLENT for SIGNAL_VALID_GATE_MS
  if (state.scanPhase === 'wait') {
    return tickWait(now);
  }

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

  // ── v1.2 Forgetting-prevention (re-show guide if signal drops) ──
  if (state.scanPhase === 'accumulate') {
    monitorSignalForgetting(now);
  }

  // ── Coverage guidance (real-time finger placement feedback) ──
  updateCoverageGuidance(elapsedSec);

  // ── Status message (single-line, UX Standard 2) ──
  // Compute the desired message + colour first, then write to the DOM only
  // when it actually changes. Rewriting textContent/color on every animation
  // frame is what made WebKit continuously repaint and garble the CJK glyphs.
  if (statusEl && state.scanPhase !== 'climax' && state.scanPhase !== 'final') {
    let nextText;
    let nextColor = '';
    if (state.cameraActive && state.lastCameraSample) {
      // Camera-driven: coverage state takes priority over time-based messages
      const isFace = state.sensorChoice === 'face';
      const color = state.lastCameraSample.color;
      if (color === 'red') {
        nextText = isFace ? '請將臉部移到畫面中央' : '請將手指完整覆蓋鏡頭';
        nextColor = '#FF3B30';
      } else if (color === 'yellow') {
        nextText = isFace ? '臉部位置偏了，請對準鏡頭' : '繼續調整手指位置…';
        nextColor = '#F5A623';
      } else if (elapsedSec < 8) {
        nextText = isFace ? '臉部訊號採集中…' : 'PPG 訊號採集中…';
      } else if (elapsedSec < state.scanEarliestComplete) {
        nextText = '能量正在快速凝聚...';
      } else {
        nextText = '就快完成，繼續放穩';
      }
    } else {
      // Simulated fallback: time-based progression
      const isFace = state.sensorChoice === 'face';
      if (elapsedSec < 3) {
        nextText = '能量凝聚中...';
      } else if (elapsedSec < 8) {
        nextText = isFace ? '臉部訊號採集中…' : 'PPG 訊號採集中…';
      } else if (elapsedSec < 18) {
        nextText = '能量正在快速凝聚...';
      } else if (elapsedSec < state.scanEarliestComplete) {
        nextText = '品質越好，精準度越高';
      } else {
        nextText = '就快完成，繼續放穩';
      }
    }
    if (statusEl.textContent !== nextText) statusEl.textContent = nextText;
    if (statusEl.style.color !== nextColor) statusEl.style.color = nextColor;
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

  function setGuidanceIcon(name, size) {
    var prev = iconEl.getAttribute('data-icon-name');
    if (prev !== name) {
      iconEl.setAttribute('data-icon-name', name);
      iconEl.innerHTML = window.tenkiIcon ? window.tenkiIcon(name, { size: size || 18 }) : '';
    }
  }

  const isFace = state.sensorChoice === 'face';

  if (state.cameraActive && state.lastCameraSample) {
    const { color, hint } = state.lastCameraSample;
    guidanceEl.dataset.coverage = color;
    if (color === 'red') {
      setGuidanceIcon('statusFail', 18);
      textEl.textContent = isFace ? '請將臉部移到畫面中央' : '請將食指完整覆蓋後鏡頭';
    } else if (color === 'yellow') {
      setGuidanceIcon('statusWarn', 18);
      textEl.textContent = isFace ? '臉部位置偏了，請對準鏡頭' : '手指位置偏了，請調整覆蓋';
    } else {
      setGuidanceIcon('statusOk', 18);
      textEl.textContent = isFace ? '臉部已對準 — 保持平穩' : '手指已覆蓋 — 保持不動';
    }
  } else {
    // Simulated fallback: show generic instruction
    if (elapsedSec < 3) {
      guidanceEl.dataset.coverage = '';
      setGuidanceIcon(isFace ? 'soulFace' : 'fingerprint', 18);
      textEl.textContent = isFace ? '請將臉部對準前鏡頭並保持正對' : '請將食指完整覆蓋後鏡頭';
    } else {
      guidanceEl.dataset.coverage = 'green';
      setGuidanceIcon('statusOk', 18);
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
      const isFace = state.sensorChoice === 'face';
      if (state.cameraActive && state.lastCameraSample) {
        const coverColor = state.lastCameraSample.color;
        if (tier === 'excellent') {
          subEl.textContent = isFace ? '臉部已對準 ✓ — 能量正在快速凝聚' : '手指已完全覆蓋 ✓ — 能量正在快速凝聚';
        } else if (tier === 'good') {
          subEl.textContent = '訊號良好 — 繼續保持不動';
        } else if (coverColor === 'red') {
          subEl.innerHTML = (window.tenkiIcon ? window.tenkiIcon('statusWarn', { size: 16 }) : '') + (isFace ? ' 請將臉部移到畫面中央' : ' 請將食指完整覆蓋後鏡頭');
        } else if (coverColor === 'yellow') {
          subEl.textContent = isFace ? '臉部位置偏了 — 請對準鏡頭' : '手指位置偏了 — 請微調覆蓋';
        } else {
          subEl.textContent = isFace ? '臉部訊號採集中…' : 'PPG 訊號採集中… 品質越好越精準';
        }
      } else {
        if (tier === 'excellent') subEl.textContent = isFace ? '臉部已對準 ✓ — 能量正在快速凝聚' : '手指已完全覆蓋 ✓ — 能量正在快速凝聚';
        else if (tier === 'good') subEl.textContent = '訊號良好 — 繼續保持不動';
        else if (tier === 'fair') subEl.textContent = isFace ? '臉部訊號採集中…' : 'PPG 訊號採集中… 品質越好越精準';
        else subEl.textContent = isFace ? '請將臉部對準前鏡頭並保持正對' : '請將食指完全覆蓋後鏡頭';
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

  // ── OOM Fix #8: cancel scan RAF immediately ──
  // Previously cancelled at t=1200ms in enterTransition. But tickCalibration
  // continues to run during the climax window (CLIMAX_MS=1500ms) and through
  // the early part of the flash, doing DOM reads + reflows that compound the
  // GPU pressure of the flash + particle burst. Cancel now.
  if (state.scanRAF) { cancelAnimationFrame(state.scanRAF); state.scanRAF = null; }

  // ── OOM Fix #9: kill scan-banner backdrop-filter blur(12px) entirely ──
  // CSS .is-hidden uses transform/opacity to slide off-screen, but iOS WebKit
  // still allocates backing store for backdrop-filter elements that are NOT
  // display:none. Direct DOM hide drops the layer.
  const bannerEl = document.getElementById('scan-banner');
  if (bannerEl) {
    bannerEl.classList.add('is-hidden');
    bannerEl.style.display = 'none';
  }

  // ── OOM Fix #10: hide ceremony-dialog (still has backdrop-filter blur(4px)
  // per styles.css phase-climax rule). At climax time the dialog text is the
  // last frame of the "正在凝聚" copy — replaced by the result card anyway.
  const dialogEl = document.getElementById('ceremony-dialog');
  if (dialogEl) {
    dialogEl.classList.remove('visible');
    dialogEl.style.display = 'none';
  }

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

  // ── OOM Fix #2: immediately release GPU-heavy resources ──
  // Camera feed is no longer needed (scan data collection is done).
  // Stopping it before the particle burst prevents camera decode +
  // particle canvas + backdrop-filter from running simultaneously.
  stopFingerCameraFeed();

  // ── OOM Fix #11: display:none on halo + video (not just opacity:0) ──
  // iOS WebKit keeps GPU backing store allocated for opacity:0 elements
  // when ancestor has will-change. display:none drops the backing store.
  const haloEls = scanEl ? scanEl.querySelectorAll('.finger-halo, .finger-halo-outer') : [];
  haloEls.forEach(function(el) {
    el.style.opacity = '0';
    el.style.display = 'none';
  });
  const scanVideoEl = document.getElementById('scan-video');
  if (scanVideoEl) {
    scanVideoEl.style.opacity = '0';
    scanVideoEl.style.display = 'none';
  }

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
    // OOM Fix #4: stop particles immediately instead of converge animation.
    // converge() re-intensifies GPU load; at this point the user is looking
    // at the result card, not the particle canvas.
    if (state.particleSystem) state.particleSystem.stop();
  }, 1200);

  // t=2.0s — full hand-off. Tear down the scan step,
  // leave result step active with step indicator synced.
  setTimeout(() => {
    if (state.scanRAF) cancelAnimationFrame(state.scanRAF);
    // Camera already stopped in enterClimax (Fix #2) — no redundant call.

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

    // Clean up dynamic calibration-ceremony class to restore step dots
    const appContainer = document.getElementById('app');
    if (appContainer) {
      appContainer.classList.remove('calibration-ceremony');
    }

    // Finalise navigation state (updates dots + currentStep).
    state.currentStep = 3;
    updateStepDots(3);
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

  if (action === 'scan') {
    try {
      // Establish baseline flag so root page unlocks scanning
      localStorage.setItem('tenki_baseline_established', '1');
      // Clear onboarding shown flag so logo onboarding modal will display
      localStorage.removeItem('tenki_onboarding_shown');
    } catch (e) {
      console.warn('[TENKI] Failed to write localStorage:', e);
    }
    // Model B: finger PPG is the calibration layer → hand off to the v6 Today
    // dashboard (full FaceMesh stardust scan + score reveal via ?from=baseline).
    setTimeout(() => { window.location.href = '/preview/v6/?from=baseline'; }, 280);
  } else {
    // Navigate to Today dashboard explore tab
    setTimeout(() => { window.location.href = '/preview/v6/#lab'; }, 280);
  }
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

  // OOM Fix #5: iOS gets fewer particles + 30fps throttle.
  // 140 particles × DPR 3 = ~420 fill ops/frame, excessive on A-series GPU.
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const PARTICLE_COUNT = isIOS ? 80 : 140;
  const FRAME_INTERVAL = isIOS ? 33 : 0; // ~30fps on iOS, uncapped on desktop
  const particles = [];

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    particles.push(spawnConvergeParticle(W, H, target));
  }

  let mode = 'converge';
  let modeStart = performance.now();
  let running = true;
  let lastFrameTs = 0;

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

    // OOM Fix #5: throttle to ~30fps on iOS
    if (FRAME_INTERVAL && now - lastFrameTs < FRAME_INTERVAL) {
      requestAnimationFrame(frame);
      return;
    }
    lastFrameTs = now;

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
// v1.2 — UI helpers (camera target ring state)
// ─────────────────────────────────────────────

/**
 * Switch the camera target ring's visual state.
 * @param {'waiting' | 'covered' | 'signal-weak'} nextState
 */
function setCameraRingState(nextState) {
  const ringEl = document.getElementById('camera-target-ring');
  if (!ringEl) return;
  if (ringEl.dataset.state === nextState) return;
  ringEl.dataset.state = nextState;
}

/**
 * Show or hide the top guidance banner.
 * Banner default-shows on .scan-step.active; .is-hidden class slides it back up.
 * @param {boolean} visible
 */
function setScanBannerVisible(visible) {
  const bannerEl = document.getElementById('scan-banner');
  if (!bannerEl) return;
  bannerEl.classList.toggle('is-hidden', !visible);
}

// ─────────────────────────────────────────────
// Init
// ─────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  // Initialize step 0
  updateStepDots(0);
  initParticles();

  // Toggle face/finger silhouettes based on sensorChoice
  const fingerSil = document.getElementById('finger-silhouette');
  const faceSil = document.getElementById('face-silhouette');
  const fingerAnim = document.getElementById('finger-guide-anim');
  if (state.sensorChoice === 'face') {
    if (fingerSil) fingerSil.style.display = 'none';
    if (faceSil) faceSil.style.display = 'block';
    if (fingerAnim) fingerAnim.style.display = 'none';
  } else {
    if (fingerSil) fingerSil.style.display = 'block';
    if (faceSil) faceSil.style.display = 'none';
    if (fingerAnim) fingerAnim.style.display = 'block';
  }

  updateInstructions(state.sensorChoice);
  setReadinessStage('approach');
  setReadinessButton(false);
});
