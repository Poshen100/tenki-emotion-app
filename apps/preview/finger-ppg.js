/**
 * @module finger-ppg
 * @description Real fingertip PPG for the TENKI browser preview (Model B —
 * "establish a finger-PPG baseline"). Works in the browser without a native
 * build, so the deployed /preview/ can show a *real* resting heart rate.
 *
 * Two layers:
 *   1. Pure DSP + baseline (HEADLESS-TESTABLE): a green-channel sample series →
 *      resting BPM via autocorrelation, a signal-quality gate, and a personal
 *      HR baseline (Welford mean/std + maturity) persisted to localStorage.
 *      Verified by __tests__/finger-ppg.test.cjs (synthetic signals).
 *   2. Browser capture controller `createPpgCapture` (DEVICE-VERIFY): getUserMedia
 *      back camera + torch + per-frame green-ROI sampling that feeds layer 1.
 *      Needs a real phone + finger to validate; tune ROI/torch/fps on-device.
 *
 * Privacy: raw pixels never leave the device; only derived HR (mean/std/count)
 * is written to localStorage. Nothing is uploaded.
 *
 * Frame-sampling shape mirrors apps/preview/soul-enroll.js (startCamera/sampleFrame).
 */
(function (factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.TENKIFingerPPG = api;
})(function () {
  'use strict';

  // ── tunables ────────────────────────────────────────────────
  const MIN_BPM = 42;
  const MAX_BPM = 240;
  const MIN_SECONDS = 4; // need >= 4s of signal before estimating
  const QUALITY_MIN_CONFIDENCE = 0.5; // normalized autocorr peak [0..1]
  const QUALITY_MIN_AMPLITUDE = 0.12; // detrended std floor (8-bit) — real
  // fingertip PPG AC is tiny when the lens is red-saturated, so keep this low
  // and lean on the periodicity (confidence) gate to reject junk.

  // maturity thresholds mirror the engine baseline (new/building/ready/mature)
  const MATURITY = { BUILDING: 1, READY: 5, MATURE: 15 };

  // ── pure DSP ────────────────────────────────────────────────

  /**
   * Centered moving-average detrend: removes DC + slow drift (window ~1s).
   * @param {number[]} series
   * @param {number} win - window length in samples.
   * @returns {number[]} detrended series.
   */
  function detrend(series, win) {
    const n = series.length;
    const out = new Array(n);
    const half = Math.max(1, Math.round(win / 2));
    for (let i = 0; i < n; i++) {
      const lo = Math.max(0, i - half);
      const hi = Math.min(n - 1, i + half);
      let s = 0;
      for (let j = lo; j <= hi; j++) s += series[j];
      out[i] = series[i] - s / (hi - lo + 1);
    }
    return out;
  }

  /**
   * Centered moving-average low-pass. Window `win` samples → first null at
   * fps/win Hz. Used to band-limit to the cardiac band and kill the 4–30 Hz
   * broadband camera/sensor noise that otherwise inflates the variance and
   * crushes autocorrelation confidence on a real (but small) fingertip pulse.
   * @param {number[]} series
   * @param {number} win - window length in samples.
   * @returns {number[]} low-passed series.
   */
  function lowpass(series, win) {
    const n = series.length;
    if (win < 2 || n < win) return series.slice();
    const out = new Array(n);
    const half = Math.floor(win / 2);
    for (let i = 0; i < n; i++) {
      const lo = Math.max(0, i - half);
      const hi = Math.min(n - 1, i + half);
      let s = 0;
      for (let j = lo; j <= hi; j++) s += series[j];
      out[i] = s / (hi - lo + 1);
    }
    return out;
  }

  /**
   * Estimate resting heart rate from a green-channel series via autocorrelation.
   * Searches only the physiological band (MIN_BPM..MAX_BPM). Returns bpm=null
   * when the signal is too short, too flat, or not periodic enough.
   *
   * @param {number[]} green - per-frame mean green values.
   * @param {number} fps - sampling rate (frames per second).
   * @returns {{ bpm: number|null, confidence: number }}
   */
  function estimateBpm(green, fps) {
    const n = green.length;
    if (!fps || n < Math.ceil(MIN_SECONDS * fps)) {
      return { bpm: null, confidence: 0, amp: 0, reason: 'short' };
    }

    // Band-pass into the cardiac band:
    //   high-pass — subtract a ~1.5s moving average (removes DC + drift below MIN_BPM)
    //   low-pass  — centered moving average (~fps/8 ≈ 3–4 Hz cutoff) removes the
    //               4–30 Hz broadband noise that crushes confidence on a real pulse.
    // Real fingertip PPG is small vs camera noise; without the low-pass the
    // variance denominator is noise-dominated and confidence stays ~0.15 (weak).
    const hp = detrend(green, Math.round(fps * 1.5));
    const d = lowpass(hp, Math.max(2, Math.round(fps / 8)));

    // amplitude gate — reject flat / no-contact frames
    let mean = 0;
    for (let i = 0; i < n; i++) mean += d[i];
    mean /= n;
    let varSum = 0;
    for (let i = 0; i < n; i++) varSum += (d[i] - mean) * (d[i] - mean);
    const std = Math.sqrt(varSum / n);
    if (std < QUALITY_MIN_AMPLITUDE) return { bpm: null, confidence: 0, amp: std, reason: 'flat' };

    // zero-lag energy
    let c0 = 0;
    for (let i = 0; i < n; i++) c0 += d[i] * d[i];
    if (c0 <= 0) return { bpm: null, confidence: 0, amp: std, reason: 'flat' };
    const energyPerSample = c0 / n;

    const lagMin = Math.floor((60 * fps) / MAX_BPM);
    const lagMax = Math.ceil((60 * fps) / MIN_BPM);

    let bestLag = -1;
    let bestCorr = -Infinity;
    for (let lag = lagMin; lag <= lagMax && lag < n; lag++) {
      let c = 0;
      for (let i = 0; i + lag < n; i++) c += d[i] * d[i + lag];
      c /= n - lag; // normalize for fewer overlapping samples
      if (c > bestCorr) {
        bestCorr = c;
        bestLag = lag;
      }
    }
    if (bestLag < 0) return { bpm: null, confidence: 0, amp: std, reason: 'weak' };

    // confidence = normalized autocorrelation peak vs average energy (~[0..1])
    const confidence = Math.max(0, Math.min(1, bestCorr / energyPerSample));
    if (confidence < QUALITY_MIN_CONFIDENCE) {
      return { bpm: null, confidence, amp: std, reason: 'weak' };
    }

    const bpm = Math.round((60 * fps) / bestLag);
    return { bpm, confidence, amp: std, reason: 'ok' };
  }

  // ── personal HR baseline (Welford + maturity, localStorage) ──

  const STORAGE_KEY = 'tenki.fingerBaseline.v1';

  /** @returns {{count:number,mean:number,m2:number,std:number,maturity:string,lastUpdatedAt:number}} */
  function createFingerBaseline() {
    return { count: 0, mean: 0, m2: 0, std: 0, maturity: 'new', lastUpdatedAt: 0 };
  }

  /** Maturity by accepted-scan count (mirrors engine: new→building→ready→mature). */
  function fingerMaturity(count) {
    if (count >= MATURITY.MATURE) return 'mature';
    if (count >= MATURITY.READY) return 'ready';
    if (count >= MATURITY.BUILDING) return 'building';
    return 'new';
  }

  /**
   * Welford online update with a new resting-HR sample.
   * @param {object} b - current baseline.
   * @param {number} bpm - new resting HR.
   * @param {number} [now] - timestamp (ms).
   */
  function updateFingerBaseline(b, bpm, now) {
    const count = b.count + 1;
    const delta = bpm - b.mean;
    const mean = b.mean + delta / count;
    const m2 = b.m2 + delta * (bpm - mean);
    const std = count > 1 ? Math.sqrt(m2 / count) : 0;
    return { count, mean, m2, std, maturity: fingerMaturity(count), lastUpdatedAt: now || 0 };
  }

  function loadBaseline() {
    try {
      if (typeof localStorage === 'undefined') return createFingerBaseline();
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : createFingerBaseline();
    } catch (_) {
      return createFingerBaseline();
    }
  }

  function saveBaseline(b) {
    try {
      if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, JSON.stringify(b));
    } catch (_) {
      /* private mode / quota — degrade silently */
    }
  }

  /** Record one valid scan: load → Welford update → persist → return new baseline. */
  function recordFingerScan(bpm, now) {
    const ts = now || (typeof Date !== 'undefined' ? Date.now() : 0);
    const next = updateFingerBaseline(loadBaseline(), bpm, ts);
    saveBaseline(next);
    return next;
  }

  // ── browser capture controller (DEVICE-VERIFY) ──────────────
  // NOTE: this layer needs a real phone camera + finger to validate. It is
  // intentionally OOM-safe (single tiny reused canvas, fixed-length ring buffer,
  // pixels discarded each frame, stream stopped on finish). Antigravity tunes
  // ROI/torch/fps and wires it into apps/preview/index.html Step 4/5.

  /**
   * @param {object} opts
   * @param {(bpm:number, confidence:number)=>void} [opts.onBpm] live BPM updates.
   * @param {(covered:boolean, brightness:number)=>void} [opts.onQuality] contact feedback.
   * @param {(baseline:object, bpm:number)=>void} [opts.onComplete] final + baseline.
   * @param {(d:object)=>void} [opts.onDiag] per-frame diagnostics:
   *   { fps, channel, rMean, gMean, rAmp, gAmp, confidence, reason, bpm }.
   * @param {number} [opts.roi] ROI canvas size (px). Small = OOM-safe.
   * @param {number} [opts.windowSeconds] rolling analysis window.
   */
  function createPpgCapture(opts) {
    opts = opts || {};
    const onBpm = opts.onBpm || function () {};
    const onQuality = opts.onQuality || function () {};
    const onComplete = opts.onComplete || function () {};
    const onDiag = opts.onDiag || function () {};
    const ROI = opts.roi || 24; // tiny ROI → cheap getImageData, OOM-safe
    const WINDOW_S = opts.windowSeconds || 10;

    let stream = null;
    let track = null;
    let video = null;
    let canvas = null;
    let ctx = null;
    let raf = 0;
    let running = false;
    // parallel ring buffers — fingertip PPG lives in red OR green depending on the
    // device/exposure (red often saturates under torch); we auto-pick the best.
    const samplesR = [];
    const samplesG = [];
    const times = [];
    let lastR = 0;
    let lastG = 0;

    async function start(videoEl) {
      video = videoEl;
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      track = stream.getVideoTracks()[0];
      // best-effort torch (unsupported on iOS Safari → degrade, prompt user for light)
      try {
        await track.applyConstraints({ advanced: [{ torch: true }] });
      } catch (_) {
        /* no torch — capture still works under decent ambient light */
      }
      video.srcObject = stream;
      await video.play().catch(function () {});
      canvas = (typeof document !== 'undefined') ? document.createElement('canvas') : null;
      if (canvas) {
        canvas.width = ROI;
        canvas.height = ROI;
        ctx = canvas.getContext('2d', { willReadFrequently: true });
      }
      running = true;
      loop();
    }

    function loop() {
      if (!running) return;
      sampleFrame();
      raf = (typeof requestAnimationFrame !== 'undefined')
        ? requestAnimationFrame(loop)
        : setTimeout(loop, 33);
    }

    function sampleFrame() {
      if (!video || !ctx || video.readyState < 2) return;
      try {
        // center-crop the video into the tiny ROI canvas
        const vw = video.videoWidth || 640;
        const vh = video.videoHeight || 480;
        const side = Math.min(vw, vh);
        const sx = (vw - side) / 2;
        const sy = (vh - side) / 2;
        ctx.drawImage(video, sx, sy, side, side, 0, 0, ROI, ROI);
        const px = ctx.getImageData(0, 0, ROI, ROI).data; // discarded after this frame
        let g = 0;
        let r = 0;
        for (let i = 0; i < px.length; i += 4) {
          r += px[i];
          g += px[i + 1];
        }
        const nPx = px.length / 4;
        lastG = g / nPx;
        lastR = r / nPx;
        // finger-over-lens + torch ≈ bright + red-dominant
        const covered = lastR > 90 && lastR > lastG;
        onQuality(covered, lastR);

        const t = (typeof performance !== 'undefined') ? performance.now() : Date.now();
        samplesR.push(lastR);
        samplesG.push(lastG);
        times.push(t);
        // fixed-length ring buffers (OOM-safe): keep only the last WINDOW_S worth
        while (times.length > 1 && t - times[0] > WINDOW_S * 1000) {
          times.shift();
          samplesR.shift();
          samplesG.shift();
        }

        if (times.length >= 2) analyse();
      } catch (_) {
        /* transient frame error — skip */
      }
    }

    /**
     * Run the tested estimator on both channels and pick the better one. Red
     * carries the strongest pulse but saturates under torch (→ flat); green is
     * weaker but rarely clips. Choosing per-frame by confidence handles both.
     */
    function analyse() {
      const spanS = (times[times.length - 1] - times[0]) / 1000;
      const fps = spanS > 0 ? (samplesR.length - 1) / spanS : 0;
      const rRes = estimateBpm(samplesR, fps);
      const gRes = estimateBpm(samplesG, fps);

      let chosen;
      let channel;
      if (rRes.bpm && gRes.bpm) {
        chosen = rRes.confidence >= gRes.confidence ? rRes : gRes;
        channel = rRes.confidence >= gRes.confidence ? 'R' : 'G';
      } else if (rRes.bpm) {
        chosen = rRes; channel = 'R';
      } else if (gRes.bpm) {
        chosen = gRes; channel = 'G';
      } else {
        chosen = gRes.amp >= rRes.amp ? gRes : rRes;
        channel = gRes.amp >= rRes.amp ? 'G' : 'R';
      }

      if (chosen.bpm) onBpm(chosen.bpm, chosen.confidence);
      onDiag({
        fps: Math.round(fps),
        channel: channel,
        rMean: Math.round(lastR),
        gMean: Math.round(lastG),
        rAmp: Math.round(rRes.amp * 100) / 100,
        gAmp: Math.round(gRes.amp * 100) / 100,
        confidence: Math.round(chosen.confidence * 100) / 100,
        reason: chosen.reason,
        bpm: chosen.bpm,
      });
      return chosen;
    }

    /** Commit the current estimate to the persisted baseline and stop. */
    function finish() {
      const chosen = times.length >= 2 ? analyse() : { bpm: null };
      stop();
      if (chosen.bpm) {
        const baseline = recordFingerScan(chosen.bpm);
        onComplete(baseline, chosen.bpm);
      } else {
        onComplete(null, null);
      }
      return chosen;
    }

    function stop() {
      running = false;
      if (raf) {
        if (typeof cancelAnimationFrame !== 'undefined') cancelAnimationFrame(raf);
        else clearTimeout(raf);
        raf = 0;
      }
      if (stream) {
        stream.getTracks().forEach(function (tk) { tk.stop(); });
        stream = null;
      }
      track = null;
      video = null;
      ctx = null;
      canvas = null;
    }

    return { start, finish, stop };
  }

  return {
    // pure DSP + baseline (tested)
    detrend,
    estimateBpm,
    createFingerBaseline,
    fingerMaturity,
    updateFingerBaseline,
    loadBaseline,
    saveBaseline,
    recordFingerScan,
    STORAGE_KEY,
    // browser capture (device-verify)
    createPpgCapture,
  };
});
