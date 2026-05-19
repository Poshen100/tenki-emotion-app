/**
 * TENKI CORE — Preview Camera Scan (Full PPG Pipeline)
 * =====================================================
 * Self-contained camera + finger-detection + PPG analysis module.
 * Outputs real biometric signals: BPM, HRV (RMSSD), coverage, SQI.
 *
 * Pipeline:
 *   getUserMedia(rear) → skin-pixel coverage → red-channel ROI mean
 *   → 3-point smoothing → peak detection (40-180 BPM band)
 *   → IBI series → BPM + RMSSD (HRV) + respiratory rate estimate
 *
 * Desktop fallback: if the device has no rear camera or user denies
 * permission, `start()` rejects and the caller should fall back.
 */

'use strict';

(function (global) {

  // ── Coverage thresholds (aligned with core/finger-detector.js) ──
  const COVERAGE_GREEN = 0.85;
  const COVERAGE_YELLOW = 0.60;

  const SKIN_R_MIN = 80, SKIN_R_MAX = 255;
  const SKIN_G_MIN = 40, SKIN_G_MAX = 200;
  const SKIN_B_MIN = 20, SKIN_B_MAX = 170;
  const SKIN_R_RATIO = 1.15;

  const PX_STRIDE = 4;
  const COV_EWMA = 0.25;

  // ── PPG constants ──
  const PPG_WINDOW = 300;       // ~10s at 30fps
  const PPG_ROI = 100;          // centre 100×100 patch
  const BPM_MIN = 40;
  const BPM_MAX = 180;
  const MIN_PEAK_DIST_S = 60 / BPM_MAX; // ~0.33s
  const IBI_WINDOW = 20;        // last N inter-beat intervals for HRV
  const STABILITY_WINDOW = 30;  // frames for coverage stability

  function isCovered(r, g, b) {
    // Torch ON touching: extremely red (blood filtering)
    const isRed = r >= 50 && r >= g * 1.8 && r >= b * 1.8;
    // Torch OFF touching: very dark (ambient light blocked)
    const isDark = r < 50 && g < 50 && b < 50;
    return isRed || isDark;
  }

  function covColor(c) {
    if (c >= COVERAGE_GREEN) return 'green';
    if (c >= COVERAGE_YELLOW) return 'yellow';
    return 'red';
  }

  function covHint(color) {
    if (color === 'green') return '保持不動，正在讀取…';
    if (color === 'yellow') return '繼續調整手指位置';
    return '請將手指完整覆蓋鏡頭';
  }

  /**
   * Start a camera-based finger scan.
   * @param {HTMLVideoElement} videoEl
   * @param {(sample: Object) => void} onSample — ~30×/s
   * @returns {Promise<{stop: () => void}>}
   */
  async function startFingerCamera(videoEl, onSample) {
    if (!videoEl) throw new Error('videoEl required');
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      const e = new Error('getUserMedia unavailable');
      e.code = 'UNSUPPORTED';
      throw e;
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 640 }, height: { ideal: 480 } },
      audio: false,
    });

    videoEl.srcObject = stream;
    videoEl.muted = true;
    videoEl.playsInline = true;
    try { await videoEl.play(); } catch (_) {}

    // Torch is NOT activated automatically here.
    // It must be triggered explicitly via the toggleTorch() method
    // to manage iOS WebKit GPU memory pressure.

    // OOM Fix #6: iOS gets smaller canvas + 15fps throttle.
    // 320×240 @ 30fps is excessive for PPG analysis on iOS WebKit.
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const canvas = document.createElement('canvas');
    canvas.width = isIOS ? 160 : 320;
    canvas.height = isIOS ? 120 : 240;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    // ── State ──
    let ewmaCov = 0, covInit = false;
    const covHistory = [];       // recent coverage values for stability
    const redBuf = [];           // { value, ts } timestamped red-channel means
    const peakTimes = [];        // timestamps of detected PPG peaks
    const ibis = [];             // inter-beat intervals (ms)
    let lastPeakTs = 0;
    let running = true, rafId = null, lastFrameTs = 0;
    let isTransitioningTorch = false;
    const dt = isIOS ? (1000 / 15) : (1000 / 30); // 15fps on iOS, 30fps elsewhere

    function analyze(ts) {
      if (!running) return;
      if (isTransitioningTorch) {
        rafId = requestAnimationFrame(analyze);
        return;
      }
      if (ts - lastFrameTs < dt) { rafId = requestAnimationFrame(analyze); return; }
      lastFrameTs = ts;

      const vw = videoEl.videoWidth || 0;
      if (vw === 0) { rafId = requestAnimationFrame(analyze); return; }

      ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);

      let imgData;
      try { imgData = ctx.getImageData(0, 0, canvas.width, canvas.height); }
      catch (_) {
        running = false;
        onSample && onSample({ coverage: 0, color: 'red', sqi: 0, bpm: 0, hrv: 0, rr: 0,
          redMean: 0, redStd: 0, brightness: 0, stability: 0, hint: '畫面讀取失敗', error: 'CANVAS_TAINTED' });
        return;
      }

      const px = imgData.data;
      const W = canvas.width, H = canvas.height;

      // ── 1) Skin coverage ──
      let skinCnt = 0, totalCnt = 0;
      for (let y = 0; y < H; y += PX_STRIDE) {
        for (let x = 0; x < W; x += PX_STRIDE) {
          const i = (y * W + x) * 4;
          totalCnt++;
          if (isCovered(px[i], px[i + 1], px[i + 2])) skinCnt++;
        }
      }
      const rawCov = totalCnt ? skinCnt / totalCnt : 0;
      ewmaCov = covInit ? COV_EWMA * rawCov + (1 - COV_EWMA) * ewmaCov : rawCov;
      covInit = true;

      // Stability: inverse of coverage variance over recent frames
      covHistory.push(ewmaCov);
      if (covHistory.length > STABILITY_WINDOW) covHistory.shift();
      let stability = 0;
      if (covHistory.length >= 5) {
        const avg = covHistory.reduce((a, b) => a + b, 0) / covHistory.length;
        const variance = covHistory.reduce((s, v) => s + (v - avg) ** 2, 0) / covHistory.length;
        stability = Math.max(0, Math.min(1, 1 - Math.sqrt(variance) * 10));
      }

      // ── 2) Red channel mean (centre ROI) ──
      const rx = Math.floor((W - PPG_ROI) / 2), ry = Math.floor((H - PPG_ROI) / 2);
      let rSum = 0, rCnt = 0;
      for (let y = ry; y < ry + PPG_ROI; y += 2) {
        for (let x = rx; x < rx + PPG_ROI; x += 2) {
          rSum += px[(y * W + x) * 4];
          rCnt++;
        }
      }
      const redMean = rCnt ? rSum / rCnt : 0;

      redBuf.push({ value: redMean, ts });
      if (redBuf.length > PPG_WINDOW) redBuf.shift();

      // ── 3) Red channel std ──
      let redStd = 0;
      if (redBuf.length >= 30) {
        const n = redBuf.length;
        const avg = redBuf.reduce((s, v) => s + v.value, 0) / n;
        redStd = Math.sqrt(redBuf.reduce((s, v) => s + (v.value - avg) ** 2, 0) / n);
      }

      // ── 4) Peak detection (PPG heartbeat) ──
      // Use a 3-point smoothed signal; detect when slope changes from + to -.
      let bpm = 0;
      if (redBuf.length >= 5 && ewmaCov >= COVERAGE_YELLOW) {
        const len = redBuf.length;
        const i = len - 2; // check the second-to-last sample
        if (i >= 1) {
          const prev = redBuf[i - 1].value;
          const curr = redBuf[i].value;
          const next = redBuf[i + 1].value;
          // Smooth: 3-point average at each position
          const sPrev = i >= 2 ? (redBuf[i - 2].value + prev + curr) / 3 : prev;
          const sCurr = (prev + curr + next) / 3;
          const sNext = i + 2 < len ? (curr + next + redBuf[i + 2].value) / 3 : next;

          const isPeak = sCurr > sPrev && sCurr >= sNext;
          const peakTs = redBuf[i].ts;
          const minDist = MIN_PEAK_DIST_S * 1000;

          if (isPeak && (peakTs - lastPeakTs) > minDist) {
            if (lastPeakTs > 0) {
              const ibi = peakTs - lastPeakTs;
              const instantBpm = 60000 / ibi;
              if (instantBpm >= BPM_MIN && instantBpm <= BPM_MAX) {
                ibis.push(ibi);
                if (ibis.length > IBI_WINDOW) ibis.shift();
                peakTimes.push(peakTs);
                if (peakTimes.length > IBI_WINDOW + 1) peakTimes.shift();
              }
            }
            lastPeakTs = peakTs;
          }
        }

        // BPM from recent IBIs
        if (ibis.length >= 3) {
          const avgIbi = ibis.reduce((a, b) => a + b, 0) / ibis.length;
          bpm = Math.round(60000 / avgIbi);
          if (bpm < BPM_MIN || bpm > BPM_MAX) bpm = 0;
        }
      }

      // ── 5) HRV (RMSSD) from IBIs ──
      let hrv = 0;
      if (ibis.length >= 4) {
        let sumSqDiff = 0;
        for (let k = 1; k < ibis.length; k++) {
          sumSqDiff += (ibis[k] - ibis[k - 1]) ** 2;
        }
        hrv = Math.round(Math.sqrt(sumSqDiff / (ibis.length - 1)));
      }

      // ── 6) Respiratory rate estimate from IBI modulation ──
      // RSA: respiratory sinus arrhythmia — IBI series oscillates at breathing freq.
      // Rough estimate: count zero-crossings of detrended IBI over last ~15 IBIs.
      let rr = 0;
      if (ibis.length >= 8) {
        const ibiMean = ibis.reduce((a, b) => a + b, 0) / ibis.length;
        let crossings = 0;
        let prevSign = ibis[0] > ibiMean;
        for (let k = 1; k < ibis.length; k++) {
          const sign = ibis[k] > ibiMean;
          if (sign !== prevSign) crossings++;
          prevSign = sign;
        }
        // Each full respiratory cycle = 2 zero-crossings.
        // Duration spanned by the IBIs:
        const spanMs = ibis.reduce((a, b) => a + b, 0);
        const spanMin = spanMs / 60000;
        if (spanMin > 0) {
          rr = Math.round((crossings / 2) / spanMin);
          if (rr < 6 || rr > 30) rr = 0; // physiological range
        }
      }

      // ── 7) Brightness (normalized red saturation) ──
      const brightness = Math.min(1, redMean / 200);

      // ── 8) SQI composite ──
      const covScore = Math.min(1, ewmaCov / COVERAGE_GREEN);
      const satScore = Math.min(1, redMean / 180);
      const oscScore = Math.min(1, redStd / 4);
      const bpmBonus = bpm > 0 ? 0.15 : 0;
      const sqi = Math.max(0, Math.min(1,
        0.45 * covScore + 0.15 * satScore + 0.15 * oscScore + 0.10 * stability + bpmBonus));

      const color = covColor(ewmaCov);
      onSample && onSample({
        coverage: Math.round(ewmaCov * 1000) / 1000,
        color,
        redMean,
        redStd,
        brightness,
        stability,
        sqi,
        bpm,
        hrv,
        rr,
        hint: covHint(color),
      });

      rafId = requestAnimationFrame(analyze);
    }

    rafId = requestAnimationFrame(analyze);

    return {
      stop() {
        running = false;
        if (rafId) cancelAnimationFrame(rafId);
        try {
          const track = stream.getVideoTracks()[0];
          if (track) track.applyConstraints({ advanced: [{ torch: false }] });
        } catch (_) {}
        stream.getTracks().forEach(t => t.stop());
        try { videoEl.srcObject = null; } catch (_) {}
      },
      async toggleTorch(enable) {
        try {
          const track = stream.getVideoTracks()[0];
          const caps = track.getCapabilities ? track.getCapabilities() : {};
          if (caps && caps.torch) {
            isTransitioningTorch = true;
            // Wait 100ms for JS drawing to settle
            await new Promise(resolve => setTimeout(resolve, 100));
            await track.applyConstraints({ advanced: [{ torch: !!enable }] });
            // Wait 200ms for OS camera pipeline to settle before resuming Canvas
            await new Promise(resolve => setTimeout(resolve, 200));
            isTransitioningTorch = false;
          }
        } catch (_) {
          isTransitioningTorch = false;
        }
      }
    };
  }

  global.TENKI_PREVIEW_CAMERA = { startFingerCamera };

})(typeof window !== 'undefined' ? window : globalThis);
