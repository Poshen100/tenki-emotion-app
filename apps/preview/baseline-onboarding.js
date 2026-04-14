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
  scanInterval: null,
  scanTimeRemaining: 30,
  scanDuration: 30,
  readinessSimStep: 0,
  isScanning: false,
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
  state.scanDuration = type === 'finger' ? 30 : 60;
  state.scanTimeRemaining = state.scanDuration;

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
// Step 3: Readiness Check (Simulated)
// ─────────────────────────────────────────────

function startReadinessCheck() {
  state.readinessSimStep = 0;

  // Clear previous interval
  if (state.readinessInterval) clearInterval(state.readinessInterval);

  // Reset UI
  updateMeter('coverage', 0, '—');
  updateMeter('brightness', 0, '—');
  updateMeter('stability', 0, '—');
  updateMeter('sqi', 0, '—');

  const btn = document.getElementById('btn-start-scan');
  if (btn) {
    btn.disabled = true;
    btn.textContent = '等待就緒...';
  }

  // Simulate progressive readiness (2-4 seconds)
  state.readinessInterval = setInterval(() => {
    state.readinessSimStep++;
    simulateReadiness(state.readinessSimStep);
  }, 400);
}

function simulateReadiness(step) {
  // Realistic progression: coverage first, then stability, then brightness, then SQI
  const maxSteps = 10;
  const progress = Math.min(step / maxSteps, 1);

  // Coverage ramps up first
  const coverage = easeOutCubic(Math.min(progress * 1.3, 1));
  // Brightness is generally good
  const brightness = 0.3 + easeOutCubic(Math.min(progress * 1.2, 1)) * 0.5;
  // Stability takes a bit longer
  const stability = easeOutCubic(Math.min(progress * 1.0, 1)) * 0.9;
  // SQI depends on others
  const sqi = Math.min(100, Math.round((coverage * 40 + brightness * 20 + stability * 40)));

  updateMeter('coverage', coverage * 100, getMeterIcon(coverage, 0.85, 0.60));
  updateMeter('brightness', brightness * 100, getMeterIcon(brightness, 0.50, 0.30));
  updateMeter('stability', stability * 100, getMeterIcon(stability, 0.70, 0.50));
  updateMeter('sqi', sqi, getMeterIcon(sqi / 100, 0.55, 0.40));

  // Overall message (single status — UX Standard 2)
  const msgEl = document.getElementById('readiness-message');
  const gradeEl = document.getElementById('readiness-grade');

  if (coverage < 0.60) {
    msgEl.textContent = state.sensorChoice === 'finger'
      ? '請將手指完整覆蓋鏡頭'
      : '請將臉部對準鏡頭範圍';
    msgEl.style.color = '#FF3B30';
  } else if (stability < 0.50) {
    msgEl.textContent = '偵測到晃動，請保持靜止';
    msgEl.style.color = '#F5A623';
  } else if (brightness < 0.30) {
    msgEl.textContent = '光線不足，請移到較亮的地方';
    msgEl.style.color = '#F5A623';
  } else if (coverage >= 0.85 && stability >= 0.70 && brightness >= 0.50 && sqi >= 55) {
    msgEl.textContent = '準備就緒，可以開始';
    msgEl.style.color = '#34C759';

    // Show grade
    gradeEl.textContent = sqi >= 85 ? 'A' : sqi >= 70 ? 'B' : 'C';
    gradeEl.classList.add('visible');

    // Enable button
    const btn = document.getElementById('btn-start-scan');
    if (btn) {
      btn.disabled = false;
      btn.textContent = '開始掃描';
    }

    clearInterval(state.readinessInterval);
  } else {
    msgEl.textContent = '幾乎到位了...';
    msgEl.style.color = '#F5A623';
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
// Step 4: Calibration Scan (Simulated)
// ─────────────────────────────────────────────

function startCalibrationScan() {
  state.scanTimeRemaining = state.scanDuration;
  state.isScanning = true;

  const timerEl = document.getElementById('scan-timer');
  const statusEl = document.getElementById('scan-status');
  const ringEl = document.getElementById('scan-progress-ring');

  if (timerEl) timerEl.textContent = state.scanDuration;

  const circumference = 2 * Math.PI * 88; // r=88

  // Status messages for each phase
  const statusMessages = [
    { time: 1.0, text: '準備中...' },
    { time: 0.85, text: '讀取中，保持不動' },
    { time: 0.50, text: '很好，保持不動' },
    { time: 0.25, text: '穩定中...' },
    { time: 0.10, text: '快好了，再堅持一下' },
    { time: 0.0, text: '即將完成' },
  ];

  // Simulate scan countdown
  if (state.scanInterval) clearInterval(state.scanInterval);

  state.scanInterval = setInterval(() => {
    state.scanTimeRemaining--;

    if (timerEl) timerEl.textContent = Math.max(0, state.scanTimeRemaining);

    // Update progress ring
    const progress = 1 - (state.scanTimeRemaining / state.scanDuration);
    if (ringEl) {
      ringEl.style.strokeDashoffset = circumference * (1 - progress);
    }

    // Update status message (single status — UX Standard 2)
    const ratio = state.scanTimeRemaining / state.scanDuration;
    const msg = statusMessages.find(m => ratio >= m.time) || statusMessages[statusMessages.length - 1];
    if (statusEl) statusEl.textContent = msg.text;

    // Simulate baseline data generation
    simulateBaselineData(progress);

    // Complete
    if (state.scanTimeRemaining <= 0) {
      clearInterval(state.scanInterval);
      state.isScanning = false;

      if (statusEl) {
        statusEl.textContent = '完成 ✓';
        statusEl.style.color = '#34C759';
      }

      // Auto-advance to result after brief pause
      setTimeout(() => goToStep(4), 1200);
    }
  }, 1000);
}

function simulateBaselineData(progress) {
  // Generate realistic baseline values
  const baseHR = 68 + Math.random() * 8;
  const baseHRV = 40 + Math.random() * 15;
  const baseRR = 14 + Math.random() * 4;

  // Running average simulation
  if (progress < 0.1) {
    state.baseline.hr = { mean: baseHR, std: 0 };
    state.baseline.hrv = { mean: baseHRV, std: 0 };
    state.baseline.rr = { mean: baseRR, std: 0 };
  } else {
    const alpha = 0.15;
    state.baseline.hr.mean = state.baseline.hr.mean * (1 - alpha) + baseHR * alpha;
    state.baseline.hr.std = Math.abs(baseHR - state.baseline.hr.mean) * 0.5;
    state.baseline.hrv.mean = state.baseline.hrv.mean * (1 - alpha) + baseHRV * alpha;
    state.baseline.hrv.std = Math.abs(baseHRV - state.baseline.hrv.mean) * 0.5;
    state.baseline.rr.mean = state.baseline.rr.mean * (1 - alpha) + baseRR * alpha;
    state.baseline.rr.std = Math.abs(baseRR - state.baseline.rr.mean) * 0.3;
  }
}

// ─────────────────────────────────────────────
// Step 5: Baseline Result
// ─────────────────────────────────────────────

function showBaselineResult() {
  const hrEl = document.getElementById('metric-hr');
  const hrvEl = document.getElementById('metric-hrv');
  const rrEl = document.getElementById('metric-rr');

  const hr = state.baseline.hr;
  const hrv = state.baseline.hrv;
  const rr = state.baseline.rr;

  if (hrEl) {
    const low = Math.round(hr.mean - hr.std);
    const high = Math.round(hr.mean + hr.std);
    hrEl.textContent = `${low}-${high} BPM`;
  }
  if (hrvEl) {
    hrvEl.textContent = `${Math.round(hrv.mean)} ms`;
  }
  if (rrEl) {
    rrEl.textContent = `${Math.round(rr.mean)} 次/分`;
  }

  // Animate confidence badge
  const confText = document.getElementById('confidence-text');
  if (confText) confText.textContent = '數據品質：良好';

  // Animate result icon
  const icon = document.getElementById('result-icon');
  if (icon) {
    icon.style.animation = 'none';
    void icon.offsetHeight; // reflow
    icon.style.animation = 'successBounce 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards';
  }

  // Counter animation for metrics
  animateCounter(hrEl, 0, Math.round(hr.mean), 'BPM', 800);
  animateCounter(hrvEl, 0, Math.round(hrv.mean), 'ms', 800);
  animateCounter(rrEl, 0, Math.round(rr.mean), '次/分', 800);
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
