/**
 * tissue-instrument.js — the finger-scan readout, drawn from the real signal.
 *
 * The old scan stage stacked four competing shape families: a rounded-rectangle
 * viewfinder with corner brackets, circular halos, an elongated fingertip
 * silhouette and tilted orbital ellipses. The rectangle was inherited from face
 * scanning, where framing matters — but when a finger covers the lens there is
 * nothing to frame. So this replaces all of it with ONE circular aperture and
 * derives everything else radially from its centre.
 *
 * The important part is not the shapes, it is what drives them. `redMean` from
 * camera-scan.js is the light actually passing through the fingertip, so the
 * red tissue glow IS the measurement rather than a decoration of it, and the
 * waveform is that same series plotted. Nothing here is synthesised: with no
 * camera the instrument shows its waiting state and draws a flat baseline,
 * because inventing a pulse trace would be a fake physiological reading.
 *
 * Public API (window.TENKI_TISSUE):
 *   mount(hostEl)        → attach canvases and start the render loop
 *   feed(sample)         → push one camera-scan.js sample
 *   setProgress(0..1)    → capture progress for the sweep arc
 *   state()              → 'reading' | 'adjust' | 'waiting'
 *   destroy()            → stop the loop and release the canvases
 */
(function (global) {
  'use strict';

  // Colour language (docs/prompts/antigravity-finger-precision-kickoff.md):
  // red = blood/pulse and ONLY appears while reading; cyan = data/HUD;
  // amber = advisory; gold is reserved for the completion screen.
  var RED = [255, 59, 84];
  var CYAN = 'rgba(87, 228, 255, ';
  var AMBER = 'rgba(245, 176, 65, ';

  /** Samples kept for the trace — ~10s at 30fps, matching camera-scan's window. */
  var TRACE_LEN = 300;
  /** Below this coverage the finger is treated as lifted. */
  var COV_WAITING = 0.25;
  /** Below this it is on the lens but not sealing it. */
  var COV_ADJUST = 0.72;
  /** Padding kept outside the aperture for the graduations + progress arc. */
  var RIM_ROOM = 22;

  var host = null, stack = null, apertureCv = null, traceCv = null, aCtx = null, tCtx = null;
  var raf = null, dpr = 1;
  var trace = [];              // { v: redMean, t: ms }
  var last = null;             // most recent sample
  var progress = 0;
  var pulse = 0;               // 0..1 envelope, decays between beats
  var lastBeatBpm = 0;
  var reduced = false;         // prefers-reduced-motion
  var flip = false;            // half-rate render gate

  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

  /** Coverage decides the state; it is the one signal the user can act on. */
  function currentState() {
    if (!last || !(last.coverage > COV_WAITING)) return 'waiting';
    if (last.coverage < COV_ADJUST) return 'adjust';
    return 'reading';
  }

  /**
   * Normalise the trace against its own recent range. PPG is a small AC ripple
   * riding a large DC offset, so a fixed scale would render it as a flat line —
   * the range has to come from the window itself.
   */
  function traceRange() {
    var lo = Infinity, hi = -Infinity;
    for (var i = 0; i < trace.length; i++) {
      var v = trace[i].v;
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
    if (!isFinite(lo) || hi - lo < 1e-6) return null;
    return { lo: lo, hi: hi };
  }

  function sizeCanvas(cv, ctx) {
    var r = cv.getBoundingClientRect();
    var w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
    if (cv.width !== w * dpr || cv.height !== h * dpr) {
      cv.width = w * dpr; cv.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    return { w: w, h: h };
  }

  // ── Aperture: tissue glow + graduations + progress sweep ──
  function drawAperture(now) {
    var d = sizeCanvas(apertureCv, aCtx);
    var cx = d.w / 2, cy = d.h / 2;
    // The furniture outside the aperture — graduations at R+11 and the progress
    // arc at R+14 with a 10px shadow — has to fit inside the same canvas, or the
    // arc gets sliced off at the left and right edges.
    var R = Math.min(d.w, d.h) / 2 - RIM_ROOM;
    aCtx.clearRect(0, 0, d.w, d.h);

    var st = currentState();
    var cov = last ? clamp01(last.coverage) : 0;

    // Tissue radius breathes with the beat; the swell is the pulse envelope,
    // which only ever comes from a detected beat, never from a timer. Under
    // reduced-motion the swell is dropped — it is decoration, unlike the
    // brightness and the trace, which are the measurement itself.
    var glowR = R * (0.80 + (reduced ? 0 : 0.06 * pulse));

    // Partial coverage pushes the lit region off-centre — the dark crescent is
    // literally the part of the lens the finger is not sealing, so the fix
    // ("move toward the middle") is legible from the picture alone. The 0.72
    // factor is what makes it read as a bitten-off edge rather than a slightly
    // lopsided glow: at cov 0.5 it displaces ~0.22R, which survives at phone size.
    var offset = st === 'reading' ? 0 : (1 - cov / COV_ADJUST) * R * 0.72;

    aCtx.save();
    aCtx.beginPath();
    aCtx.arc(cx, cy, R, 0, Math.PI * 2);
    aCtx.clip();

    if (st === 'waiting') {
      // Cold, unlit tissue — no red anywhere, because nothing is being read.
      var cold = aCtx.createRadialGradient(cx, cy - R * 0.15, R * 0.05, cx, cy, R);
      cold.addColorStop(0, 'rgba(38, 58, 92, 0.55)');
      cold.addColorStop(0.55, 'rgba(20, 32, 56, 0.5)');
      cold.addColorStop(1, 'rgba(6, 10, 20, 0.9)');
      aCtx.fillStyle = cold;
      aCtx.fillRect(0, 0, d.w, d.h);
    } else {
      // Brightness of the glow tracks the measured light through the tissue.
      var lit = last ? clamp01((last.redMean || 0) / 190) : 0;
      var a = 0.30 + 0.62 * lit;
      var gx = cx - offset * 0.55, gy = cy - offset * 0.35;
      var g = aCtx.createRadialGradient(gx, gy, glowR * 0.04, gx, gy, glowR);
      g.addColorStop(0, 'rgba(' + RED[0] + ',' + (RED[1] + 40) + ',' + (RED[2] + 30) + ',' + (a + 0.12).toFixed(3) + ')');
      g.addColorStop(0.45, 'rgba(' + RED[0] + ',' + RED[1] + ',' + RED[2] + ',' + a.toFixed(3) + ')');
      g.addColorStop(0.82, 'rgba(150,20,40,' + (a * 0.45).toFixed(3) + ')');
      g.addColorStop(1, 'rgba(40,6,14,0.20)');
      aCtx.fillStyle = g;
      aCtx.fillRect(0, 0, d.w, d.h);

      if (offset > 0.5) {
        // The unsealed side reads cold and empty rather than merely dimmer.
        var sx = cx + offset * 1.15, sy = cy + offset * 0.7;
        var sh = aCtx.createRadialGradient(sx, sy, R * 0.02, sx, sy, R * 0.98);
        sh.addColorStop(0, 'rgba(3,6,13,0.97)');
        sh.addColorStop(0.42, 'rgba(3,6,13,0.86)');
        sh.addColorStop(0.78, 'rgba(3,6,13,0.34)');
        sh.addColorStop(1, 'rgba(3,6,13,0)');
        aCtx.fillStyle = sh;
        aCtx.fillRect(0, 0, d.w, d.h);
      }
    }
    aCtx.restore();

    // Hairline rim + fine graduations: the instrument frame, one family only.
    aCtx.save();
    aCtx.lineWidth = 1;
    aCtx.strokeStyle = st === 'waiting' ? 'rgba(120,150,190,0.30)' : 'rgba(255,150,165,0.34)';
    aCtx.beginPath(); aCtx.arc(cx, cy, R, 0, Math.PI * 2); aCtx.stroke();

    aCtx.strokeStyle = CYAN + '0.18)';
    for (var i = 0; i < 72; i++) {
      var ang = (i / 72) * Math.PI * 2 - Math.PI / 2;
      var long = i % 6 === 0;
      var r0 = R + 4, r1 = R + (long ? 11 : 6);
      aCtx.beginPath();
      aCtx.moveTo(cx + Math.cos(ang) * r0, cy + Math.sin(ang) * r0);
      aCtx.lineTo(cx + Math.cos(ang) * r1, cy + Math.sin(ang) * r1);
      aCtx.stroke();
    }

    // Capture progress: one arc, clockwise from twelve o'clock.
    if (progress > 0.001) {
      aCtx.lineWidth = 2.5;
      aCtx.lineCap = 'round';
      aCtx.strokeStyle = st === 'adjust' ? AMBER + '0.85)' : CYAN + '0.95)';
      aCtx.shadowColor = st === 'adjust' ? AMBER + '0.7)' : CYAN + '0.8)';
      aCtx.shadowBlur = 10;
      aCtx.beginPath();
      aCtx.arc(cx, cy, R + 14, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * clamp01(progress));
      aCtx.stroke();
    }
    aCtx.restore();
  }

  // ── Trace: the same redMean series, plotted ──
  function drawTrace() {
    var d = sizeCanvas(traceCv, tCtx);
    tCtx.clearRect(0, 0, d.w, d.h);
    var mid = d.h / 2;

    tCtx.save();
    tCtx.lineWidth = 1;
    tCtx.strokeStyle = 'rgba(120,150,190,0.16)';
    tCtx.beginPath(); tCtx.moveTo(0, mid); tCtx.lineTo(d.w, mid); tCtx.stroke();
    tCtx.restore();

    var range = traceRange();
    var st = currentState();
    // No coverage, or no measurable ripple, means no pulse to draw. Drawing one
    // anyway would be a fabricated physiological reading.
    if (st === 'waiting' || !range || trace.length < 8) return;

    var amp = d.h * 0.40;
    tCtx.save();
    tCtx.lineWidth = 1.6;
    tCtx.lineJoin = 'round';
    tCtx.strokeStyle = 'rgba(' + RED[0] + ',' + RED[1] + ',' + RED[2] + ',' + (st === 'adjust' ? 0.45 : 0.95) + ')';
    tCtx.shadowColor = 'rgba(' + RED[0] + ',' + RED[1] + ',' + RED[2] + ',0.55)';
    tCtx.shadowBlur = 6;
    tCtx.beginPath();
    // Anchored to the right edge, like any bedside monitor: the newest sample
    // is always under the cursor and history runs off to the left, so a
    // partially filled buffer grows leftwards instead of leaving a dead gap.
    var n = trace.length, px = 0, py = mid;
    var step = d.w / (TRACE_LEN - 1);
    for (var i = 0; i < n; i++) {
      var norm = (trace[i].v - range.lo) / (range.hi - range.lo); // 0..1
      var x = d.w - (n - 1 - i) * step;
      var y = mid + (0.5 - norm) * 2 * amp;
      if (i === 0) tCtx.moveTo(x, y); else tCtx.lineTo(x, y);
      px = x; py = y;
    }
    tCtx.stroke();
    tCtx.restore();

    // Leading cursor — where the instrument is reading right now.
    tCtx.save();
    tCtx.fillStyle = 'rgba(255,225,230,0.95)';
    tCtx.shadowColor = 'rgba(' + RED[0] + ',' + RED[1] + ',' + RED[2] + ',0.9)';
    tCtx.shadowBlur = 8;
    tCtx.beginPath(); tCtx.arc(px, py, 2.6, 0, Math.PI * 2); tCtx.fill();
    tCtx.restore();
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    // camera-scan.js samples at ~30fps, so drawing at 60 would just redraw the
    // same numbers twice. This page already runs close to the iOS memory and
    // GPU ceiling (see the OOM fixes in baseline-onboarding.js) — halve the work.
    flip = !flip;
    if (flip) return;
    // The pulse envelope decays on its own; only a detected beat re-arms it,
    // so a stalled signal visibly stops swelling instead of ticking along.
    pulse *= 0.81;   // ~0.90 per 60fps frame, at half the frame rate
    drawAperture(now);
    drawTrace();
  }

  function mount(hostEl) {
    if (!hostEl) return;
    destroy();
    host = hostEl;
    dpr = Math.min(global.devicePixelRatio || 1, 2);
    reduced = !!(global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches);
    // Only the canvas stack belongs to this component. The readout markup
    // (BPM, caption) is owned by the page, so it must survive mounting.
    stack = host.querySelector('.ti-canvas-stack');
    if (!stack) {
      stack = global.document.createElement('div');
      stack.className = 'ti-canvas-stack';
      stack.setAttribute('aria-hidden', 'true');
      stack.innerHTML =
        '<canvas class="ti-aperture"></canvas><canvas class="ti-trace"></canvas>';
      host.insertBefore(stack, host.firstChild);
    }
    apertureCv = stack.querySelector('.ti-aperture');
    traceCv = stack.querySelector('.ti-trace');
    aCtx = apertureCv.getContext('2d');
    tCtx = traceCv.getContext('2d');
    trace = []; last = null; progress = 0; pulse = 0; lastBeatBpm = 0; flip = false;
    raf = requestAnimationFrame(frame);
  }

  function feed(sample) {
    if (!sample) return;
    last = sample;
    if (typeof sample.redMean === 'number' && sample.redMean > 0) {
      trace.push({ v: sample.redMean, t: Date.now() });
      if (trace.length > TRACE_LEN) trace.shift();
    }
    // camera-scan.js only reports a BPM once it has detected peaks, so a change
    // in it is the closest honest proxy we have here for "a beat landed".
    if (sample.bpm && sample.bpm !== lastBeatBpm) {
      lastBeatBpm = sample.bpm;
      pulse = 1;
    }
    if (!sample.coverage) { trace.length = 0; }
  }

  function setProgress(p) { progress = clamp01(p || 0); }

  function destroy() {
    if (raf) cancelAnimationFrame(raf);
    raf = null;
    // Collapse the canvases to 0×0 before dropping them: iOS WebKit keeps the
    // backing store alive for a detached canvas until it is GC'd, and this page
    // is exactly where that has bitten before.
    if (apertureCv) { apertureCv.width = apertureCv.height = 0; }
    if (traceCv) { traceCv.width = traceCv.height = 0; }
    if (stack && stack.parentNode) stack.parentNode.removeChild(stack);
    host = stack = apertureCv = traceCv = aCtx = tCtx = null;
    trace = []; last = null;
  }

  global.TENKI_TISSUE = {
    mount: mount,
    feed: feed,
    setProgress: setProgress,
    state: currentState,
    destroy: destroy,
  };
})(typeof window !== 'undefined' ? window : globalThis);
