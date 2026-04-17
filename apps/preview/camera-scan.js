/**
 * TENKI CORE — Preview Camera Scan
 * ==================================
 * Self-contained camera + finger-detection module for the baseline onboarding
 * preview. Ports the behaviour of `core/camera-controller.js`, `core/finger-detector.js`
 * and `core/ppg-analyzer.js` into a single file so the `apps/preview/` bundle
 * stays static-deployable with zero build steps.
 *
 * Responsibilities:
 *   - Request the rear camera via getUserMedia({ facingMode: 'environment' })
 *   - Compute skin-pixel coverage (RED/YELLOW/GREEN) with EWMA α=0.25
 *   - Track red-channel PPG variance as signal quality proxy
 *   - Emit `{ coverage, color, redMean, redStd, sqi, hint }` samples at ~30 fps
 *
 * Desktop fallback: if the device has no rear camera or user denies permission,
 * `start()` rejects and the caller should fall back to simulated SQI.
 */

'use strict';

(function (global) {

  // ── Thresholds (aligned with core/finger-detector.js) ────────────────────
  const COVERAGE_GREEN_THRESHOLD = 0.85;
  const COVERAGE_YELLOW_THRESHOLD = 0.60;

  const SKIN_R_MIN = 80, SKIN_R_MAX = 255;
  const SKIN_G_MIN = 40, SKIN_G_MAX = 200;
  const SKIN_B_MIN = 20, SKIN_B_MAX = 170;
  const SKIN_R_DOMINANT_RATIO = 1.15;

  const PIXEL_SAMPLE_STRIDE = 4;
  const COVERAGE_EWMA_ALPHA = 0.25;

  // PPG analysis window
  const PPG_SAMPLE_WINDOW = 150; // ~5s at 30fps
  const PPG_ROI_SIZE = 100;      // centre 100×100 patch

  function isSkinPixel(r, g, b) {
    if (r < SKIN_R_MIN || r > SKIN_R_MAX) return false;
    if (g < SKIN_G_MIN || g > SKIN_G_MAX) return false;
    if (b < SKIN_B_MIN || b > SKIN_B_MAX) return false;
    if (r < g * SKIN_R_DOMINANT_RATIO) return false;
    return true;
  }

  function coverageColor(c) {
    if (c >= COVERAGE_GREEN_THRESHOLD) return 'green';
    if (c >= COVERAGE_YELLOW_THRESHOLD) return 'yellow';
    return 'red';
  }

  function coverageHint(color) {
    if (color === 'green') return '保持不動，正在讀取…';
    if (color === 'yellow') return '繼續調整手指位置';
    return '請將手指完整覆蓋鏡頭';
  }

  /**
   * Start a camera-based finger scan bound to the given <video> element.
   * @param {HTMLVideoElement} videoEl
   * @param {(sample) => void} onSample — invoked ~30×/s with detection result
   * @returns {Promise<{stop: () => void}>}
   */
  async function startFingerCamera(videoEl, onSample) {
    if (!videoEl) throw new Error('videoEl required');

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      const err = new Error('getUserMedia unavailable');
      err.code = 'UNSUPPORTED';
      throw err;
    }

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      });
    } catch (err) {
      // Bubble the original DOMException so caller can classify (NotAllowed, NotFound…)
      throw err;
    }

    videoEl.srcObject = stream;
    videoEl.muted = true;
    videoEl.playsInline = true;
    try { await videoEl.play(); } catch (_) { /* some browsers need user gesture */ }

    // Try to force the torch on — makes PPG much cleaner on phones that support it.
    try {
      const track = stream.getVideoTracks()[0];
      const caps = track.getCapabilities ? track.getCapabilities() : {};
      if (caps && caps.torch) {
        await track.applyConstraints({ advanced: [{ torch: true }] });
      }
    } catch (_) { /* torch is best-effort */ }

    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 240;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    let ewmaCoverage = 0;
    let coverageInit = false;
    const redBuffer = [];
    let running = true;
    let rafId = null;
    let lastFrameTs = 0;
    const frameInterval = 1000 / 30;

    function analyzeFrame(ts) {
      if (!running) return;
      if (ts - lastFrameTs < frameInterval) {
        rafId = requestAnimationFrame(analyzeFrame);
        return;
      }
      lastFrameTs = ts;

      const vw = videoEl.videoWidth || 0;
      const vh = videoEl.videoHeight || 0;
      if (vw === 0 || vh === 0) {
        rafId = requestAnimationFrame(analyzeFrame);
        return;
      }

      ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);

      // Full-frame skin coverage
      let imgData;
      try {
        imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      } catch (e) {
        // Cross-origin video can taint canvas; bail with hint.
        running = false;
        onSample && onSample({
          coverage: 0, color: 'red', redMean: 0, redStd: 0, sqi: 0,
          hint: '畫面讀取失敗，改用模擬訊號',
          error: 'CANVAS_TAINTED',
        });
        return;
      }

      const data = imgData.data;
      let skin = 0, total = 0;
      for (let y = 0; y < canvas.height; y += PIXEL_SAMPLE_STRIDE) {
        for (let x = 0; x < canvas.width; x += PIXEL_SAMPLE_STRIDE) {
          const idx = (y * canvas.width + x) * 4;
          total++;
          if (isSkinPixel(data[idx], data[idx + 1], data[idx + 2])) skin++;
        }
      }
      const rawCoverage = total ? skin / total : 0;

      if (!coverageInit) {
        ewmaCoverage = rawCoverage;
        coverageInit = true;
      } else {
        ewmaCoverage = COVERAGE_EWMA_ALPHA * rawCoverage
                     + (1 - COVERAGE_EWMA_ALPHA) * ewmaCoverage;
      }

      // Red channel mean over centre ROI (for PPG)
      const roiX = Math.floor((canvas.width - PPG_ROI_SIZE) / 2);
      const roiY = Math.floor((canvas.height - PPG_ROI_SIZE) / 2);
      let redSum = 0, redCount = 0;
      for (let y = roiY; y < roiY + PPG_ROI_SIZE; y += 2) {
        for (let x = roiX; x < roiX + PPG_ROI_SIZE; x += 2) {
          const idx = (y * canvas.width + x) * 4;
          redSum += data[idx];
          redCount++;
        }
      }
      const redMean = redCount ? redSum / redCount : 0;

      redBuffer.push(redMean);
      if (redBuffer.length > PPG_SAMPLE_WINDOW) redBuffer.shift();

      // Std-dev of recent red samples — heartbeats produce oscillation
      let redStd = 0;
      if (redBuffer.length >= 30) {
        const n = redBuffer.length;
        const mean = redBuffer.reduce((a, b) => a + b, 0) / n;
        let sqSum = 0;
        for (let i = 0; i < n; i++) sqSum += (redBuffer[i] - mean) ** 2;
        redStd = Math.sqrt(sqSum / n);
      }

      // SQI heuristic:
      //   - Finger must cover the lens (coverage weight 0.6)
      //   - Red channel must be saturated (coverage amplitude weight 0.2)
      //   - Signal must oscillate in the PPG band (std weight 0.2)
      const coverageScore = Math.min(1, ewmaCoverage / COVERAGE_GREEN_THRESHOLD);
      const redSatScore = Math.min(1, redMean / 180);
      const oscillationScore = Math.min(1, redStd / 4); // empirical: clean PPG ≈ 2-6
      const sqi = Math.max(0, Math.min(1,
        0.6 * coverageScore + 0.2 * redSatScore + 0.2 * oscillationScore));

      const color = coverageColor(ewmaCoverage);
      onSample && onSample({
        coverage: Math.round(ewmaCoverage * 1000) / 1000,
        color,
        redMean,
        redStd,
        sqi,
        hint: coverageHint(color),
      });

      rafId = requestAnimationFrame(analyzeFrame);
    }

    rafId = requestAnimationFrame(analyzeFrame);

    return {
      stop() {
        running = false;
        if (rafId) cancelAnimationFrame(rafId);
        if (stream) {
          stream.getTracks().forEach(t => t.stop());
        }
        try { videoEl.srcObject = null; } catch (_) {}
      },
    };
  }

  global.TENKI_PREVIEW_CAMERA = { startFingerCamera };

})(typeof window !== 'undefined' ? window : globalThis);
