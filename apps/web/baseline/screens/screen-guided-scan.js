import { setState } from '../baseline-state.js';
import { flags } from '../flags.js';

export function renderGuidedScan(container, { navigateTo, getState }) {
  const state = getState();
  const sensorMode = state.sensor.selected || 'camera_guided';

  const screen = document.createElement('div');
  screen.className = 'bl-screen';

  screen.innerHTML = `
    <div class="bl-header">
      <span class="bl-header__label">STEP 3 OF 3</span>
    </div>
    <h1 class="bl-title">基準擷取中</h1>
    <p class="bl-subtitle" id="bl-scan-status">正在初始化...</p>

    <div class="bl-camera-preview" id="bl-preview">
      <video id="bl-video" autoplay playsinline muted style="width:100%;height:100%;object-fit:cover;transform:scaleX(-1);display:none;"></video>
      <div id="bl-placeholder" style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;color:#8E8E93;font-size:14px;">
        <span class="ferrari-icon" style="font-size:48px;opacity:0.3;">photo_camera</span>
      </div>
      <div class="bl-camera-preview__frame">
        <svg viewBox="0 0 200 260"><ellipse cx="100" cy="130" rx="70" ry="95" /></svg>
      </div>
    </div>

    <div class="bl-progress-bar">
      <div class="bl-progress-bar__fill" id="bl-progress" style="width:0%;"></div>
    </div>

    <div class="bl-card" id="bl-quality-panel">
      <div class="bl-quality-row">
        <span>穩定度</span>
        <span class="bl-quality-row__value" id="bl-q-stability">—</span>
      </div>
      <div class="bl-quality-row">
        <span>光線品質</span>
        <span class="bl-quality-row__value" id="bl-q-lighting">—</span>
      </div>
      <div class="bl-quality-row">
        <span>臉部對齊</span>
        <span class="bl-quality-row__value" id="bl-q-framing">—</span>
      </div>
    </div>

    <div style="flex:1;"></div>
    <button class="bl-btn bl-btn--secondary" id="bl-cancel">取消</button>
  `;

  container.appendChild(screen);

  const videoEl = screen.querySelector('#bl-video');
  const placeholder = screen.querySelector('#bl-placeholder');
  const progressBar = screen.querySelector('#bl-progress');
  const statusEl = screen.querySelector('#bl-scan-status');
  const qStability = screen.querySelector('#bl-q-stability');
  const qLighting = screen.querySelector('#bl-q-lighting');
  const qFraming = screen.querySelector('#bl-q-framing');
  const cancelBtn = screen.querySelector('#bl-cancel');

  let stream = null;
  let scanCancel = null;

  cancelBtn.addEventListener('click', () => {
    cleanup();
    navigateTo('retry_help', { reason: 'session_interrupted' });
  });

  async function startCamera() {
    if (sensorMode !== 'camera_guided') return;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      videoEl.srcObject = stream;
      videoEl.style.display = 'block';
      placeholder.style.display = 'none';
    } catch {
      // Camera failed — continue with mock
    }
  }

  function runMockScan() {
    let progress = 0;
    const session = {
      sessionId: `scan-${Date.now()}`,
      sensorMode,
      status: 'initializing',
      quality: {},
      interruptionCount: 0,
      startedAt: new Date().toISOString(),
    };

    setState({ scanSession: session });
    statusEl.textContent = '正在初始化...';

    // Phase: initializing → aligning → capturing → completed
    setTimeout(() => {
      statusEl.textContent = '對齊中...請保持穩定';
      session.status = 'aligning';
    }, 500);

    setTimeout(() => {
      statusEl.textContent = '擷取中...';
      session.status = 'capturing';
    }, 1500);

    const interval = setInterval(() => {
      progress += 10;
      progressBar.style.width = progress + '%';

      // Mock quality values
      qStability.textContent = Math.min(98, 60 + progress * 0.38).toFixed(0) + '%';
      qLighting.textContent = Math.min(95, 70 + progress * 0.25).toFixed(0) + '%';
      qFraming.textContent = Math.min(96, 65 + progress * 0.31).toFixed(0) + '%';

      session.progress = progress;
      session.quality = {
        motionLevel: Math.max(0.02, 0.2 - progress * 0.002),
        lightingQuality: Math.min(0.95, 0.7 + progress * 0.0025),
        framingQuality: Math.min(0.96, 0.65 + progress * 0.0031),
        signalConfidence: Math.min(0.92, 0.4 + progress * 0.0052),
      };

      if (progress >= 100) {
        clearInterval(interval);

        // Check mock_fail flag
        if (flags.mock_fail === 'scan') {
          session.status = 'failed';
          session.failureReason = 'signal_inconclusive';
          session.endedAt = new Date().toISOString();
          setState({ scanSession: session });
          navigateTo('retry_help', { reason: 'signal_inconclusive' });
          return;
        }

        session.status = 'completed';
        session.endedAt = new Date().toISOString();
        session.durationMs = Date.now() - new Date(session.startedAt).getTime();
        setState({ scanSession: session });

        statusEl.textContent = '擷取完成！';
        setTimeout(() => navigateTo('analyzing'), 600);
      }
    }, 1000);

    scanCancel = () => clearInterval(interval);
  }

  function cleanup() {
    if (scanCancel) scanCancel();
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      stream = null;
    }
  }

  startCamera().then(() => runMockScan());

  return cleanup;
}
