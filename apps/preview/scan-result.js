/**
 * scan-result.js — TENKI CORE Scan Result Page v3.0
 *
 * Canvas-based dual-ring gauge with spectrum gradient,
 * nebula background, sparklines, body battery chart,
 * and ANS balance visualization.
 *
 * All data comes from TENKI's own scan calculations.
 * Terminology: v3 compliant (Edge Score, not TEI/PR99).
 *
 * @version 3.0
 * @see ANTIGRAVITY.md v3.0
 */
(function () {
  'use strict';

  // Resolve a canonical CSS token (from tokens.css) for canvas drawing,
  // which needs a concrete color string. Single-source for the rr cyan.
  function cssVar(name, fallback) {
    try {
      var v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
      return v || fallback;
    } catch (_) { return fallback; }
  }
  var CYAN_ACTIVE = cssVar('--cyan-active', '#22D3EE');

  // ═══════════════════════════════════════════
  // Ring Constants (matches design mockup)
  // ═══════════════════════════════════════════
  var RING_SIZE = 260;
  var OUTER_R = 116, INNER_R = 90;
  var OUTER_W = 14, INNER_W = 8;
  var RING_START = Math.PI * 0.74; // lower-left (~8 o'clock)

  // 12-stop spectrum: cyan → green → yellow → orange → red
  var SPECTRUM = [
    [0, 180, 180],   // teal
    [0, 190, 140],   // teal-green
    [40, 200, 100],  // green
    [80, 210, 60],   // yellow-green
    [140, 210, 50],  // lime
    [190, 200, 40],  // yellow-green
    [220, 180, 35],  // golden
    [240, 155, 30],  // amber
    [250, 125, 35],  // orange
    [255, 100, 45],  // deep orange
    [255, 80, 50],   // red-orange
    [255, 65, 55]    // red
  ];

  // ═══════════════════════════════════════════
  // Simulated scan data (from TENKI engine)
  // ═══════════════════════════════════════════
  var SCAN_DATA = {
    edgeScore: 72,
    zone: 'clear',       // v3: clear (70-100), neutral (40-69), strain (0-39)
    zoneLabel: 'Clear',
    confidence: 0.82,
    hr: { value: 68, unit: 'BPM', history: [] },
    hrv: { value: 52, unit: 'ms RMSSD', history: [] },
    rr: { value: 14, unit: 'BrPM', history: [] },
    stress: { value: 25, pct: 25 },
    recovery: 78,
    ans: { sns: 38, pns: 62 },
    scanType: 'DEEP SCAN',
    scanDuration: 60,
    source: 'finger'
  };

  // Generate realistic sparkline history
  function generateHistory(base, amplitude, points) {
    var arr = [];
    for (var i = 0; i < points; i++) {
      var phase = (i / points) * Math.PI * 4;
      var wave = Math.sin(phase) * base * amplitude;
      var wave2 = Math.sin(phase * 2.3 + 1.7) * base * amplitude * 0.4;
      var noise = (Math.random() - 0.5) * base * 0.04;
      arr.push(base + wave + wave2 + noise);
    }
    return arr;
  }

  SCAN_DATA.hr.history = generateHistory(68, 0.06, 30);
  SCAN_DATA.hrv.history = generateHistory(52, 0.12, 30);
  SCAN_DATA.rr.history = generateHistory(14, 0.08, 30);

  // Body battery hourly data (simulated from scan history)
  var BB_DATA = [55, 58, 52, 48, 45, 50, 55, 60, 65, 68, 72, 75, 78];

  // ═══════════════════════════════════════════
  // Canvas: Nebula Background
  // ═══════════════════════════════════════════
  var nebulaFrame = null;

  function initNebula() {
    var canvas = document.getElementById('nebula-canvas');
    if (!canvas) return;
    var W = 430, H = 932;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    var ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    var layers = [
      { cx: W * 0.50, cy: H * 0.18, r: 340, color: [0, 100, 220], alpha: 0.35, period: 10 },
      { cx: W * 0.15, cy: H * 0.28, r: 280, color: [30, 180, 140], alpha: 0.25, period: 13 },
      { cx: W * 0.85, cy: H * 0.12, r: 240, color: [120, 60, 220], alpha: 0.22, period: 16 },
      { cx: W * 0.45, cy: H * 0.22, r: 220, color: [0, 60, 200], alpha: 0.30, period: 8 },
      { cx: W * 0.70, cy: H * 0.40, r: 200, color: [200, 120, 40], alpha: 0.12, period: 20 },
      { cx: W * 0.25, cy: H * 0.65, r: 200, color: [0, 140, 200], alpha: 0.18, period: 15 },
      { cx: W * 0.60, cy: H * 0.55, r: 240, color: [80, 40, 180], alpha: 0.18, period: 12 }
    ];

    function draw() {
      var t = Date.now() / 1000;
      ctx.clearRect(0, 0, W, H);

      for (var i = 0; i < layers.length; i++) {
        var l = layers[i];
        var pulse = 0.7 + 0.3 * Math.sin(t * (2 * Math.PI / l.period));
        var grad = ctx.createRadialGradient(l.cx, l.cy, 0, l.cx, l.cy, l.r);
        grad.addColorStop(0, 'rgba(' + l.color.join(',') + ',' + (l.alpha * pulse) + ')');
        grad.addColorStop(0.4, 'rgba(' + l.color.join(',') + ',' + (l.alpha * pulse * 0.5) + ')');
        grad.addColorStop(1, 'rgba(' + l.color.join(',') + ',0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);
      }

      nebulaFrame = requestAnimationFrame(draw);
    }

    draw();
  }

  // ═══════════════════════════════════════════
  // Canvas: Dual Ring Gauge
  // ═══════════════════════════════════════════
  var ringCtx = null;
  var ringDpr = 1;

  function lerpColor(c1, c2, t) {
    return [
      Math.round(c1[0] + (c2[0] - c1[0]) * t),
      Math.round(c1[1] + (c2[1] - c1[1]) * t),
      Math.round(c1[2] + (c2[2] - c1[2]) * t)
    ];
  }

  function getSpectrumColor(pct) {
    var idx = pct * (SPECTRUM.length - 1);
    var lo = Math.floor(idx);
    var hi = Math.min(lo + 1, SPECTRUM.length - 1);
    return lerpColor(SPECTRUM[lo], SPECTRUM[hi], idx - lo);
  }

  function drawRing(outerFill, innerFill) {
    if (!ringCtx) return;
    var ctx = ringCtx;
    var cx = RING_SIZE / 2, cy = RING_SIZE / 2;

    ctx.save();
    ctx.setTransform(ringDpr, 0, 0, ringDpr, 0, 0);
    ctx.clearRect(0, 0, RING_SIZE, RING_SIZE);

    // Track rings (subtle background)
    var tracks = [
      { r: OUTER_R, w: OUTER_W, a: 0.06 },
      { r: OUTER_R - 18, w: 1, a: 0.03 },
      { r: INNER_R, w: INNER_W, a: 0.05 },
      { r: INNER_R - 14, w: 1, a: 0.025 }
    ];
    for (var t = 0; t < tracks.length; t++) {
      ctx.lineWidth = tracks[t].w;
      ctx.strokeStyle = 'rgba(255,255,255,' + tracks[t].a + ')';
      ctx.beginPath();
      ctx.arc(cx, cy, tracks[t].r, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Outer ring: spectrum gradient segments
    if (outerFill > 0.001) {
      var startA = RING_START;
      var totalAngle = outerFill * Math.PI * 2;
      var SEGS = 90;
      var segAngle = totalAngle / SEGS;

      ctx.lineWidth = OUTER_W;
      ctx.lineCap = 'round';

      // Glow layer
      ctx.save();
      ctx.shadowColor = 'rgba(0,180,216,0.3)';
      ctx.shadowBlur = 16;

      for (var i = 0; i < SEGS; i++) {
        var st = i / SEGS;
        var c = getSpectrumColor(st);
        var a1 = startA + i * segAngle;
        var a2 = startA + (i + 1) * segAngle + 0.02;

        ctx.beginPath();
        ctx.arc(cx, cy, OUTER_R, a1, a2);
        ctx.strokeStyle = 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')';
        ctx.stroke();
      }
      ctx.restore();

      // Start marker (cyan dot)
      var spx = cx + OUTER_R * Math.cos(startA);
      var spy = cy + OUTER_R * Math.sin(startA);
      ctx.save();
      ctx.shadowColor = 'rgba(121,244,236,0.6)';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(spx, spy, 5, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(172,255,248,0.85)';
      ctx.fill();
      ctx.restore();

      // End marker (amber dot with glow)
      var endAngle = startA + totalAngle;
      var epx = cx + OUTER_R * Math.cos(endAngle);
      var epy = cy + OUTER_R * Math.sin(endAngle);
      ctx.save();
      ctx.shadowColor = 'rgba(245,166,35,0.7)';
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.arc(epx, epy, 6, 0, Math.PI * 2);
      ctx.fillStyle = '#F5A623';
      ctx.fill();
      ctx.restore();
    }

    // Inner ring: green → cyan gradient
    if (innerFill > 0.001) {
      var iStart = RING_START;
      var iTotal = innerFill * Math.PI * 2;
      var iSegs = 50;
      var iSegAngle = iTotal / iSegs;

      ctx.lineWidth = INNER_W;
      ctx.lineCap = 'round';

      ctx.save();
      ctx.shadowColor = 'rgba(40,200,140,0.3)';
      ctx.shadowBlur = 10;

      for (var j = 0; j < iSegs; j++) {
        var jt = j / iSegs;
        var r = Math.round(82 + (38 - 82) * jt);
        var g = Math.round(236 + (201 - 236) * jt);
        var b = Math.round(145 + (235 - 145) * jt);

        var ia1 = iStart + j * iSegAngle;
        var ia2 = iStart + (j + 1) * iSegAngle + 0.02;

        ctx.beginPath();
        ctx.arc(cx, cy, INNER_R, ia1, ia2);
        ctx.strokeStyle = 'rgb(' + r + ',' + g + ',' + b + ')';
        ctx.stroke();
      }
      ctx.restore();
    }

    ctx.restore();
  }

  function initRing() {
    var canvas = document.getElementById('ring-canvas');
    if (!canvas) return;

    ringDpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = RING_SIZE * ringDpr;
    canvas.height = RING_SIZE * ringDpr;
    canvas.style.width = RING_SIZE + 'px';
    canvas.style.height = RING_SIZE + 'px';

    ringCtx = canvas.getContext('2d');
    drawRing(0, 0);

    // Animate ring fill
    var outerTarget = SCAN_DATA.edgeScore / 100;
    var innerTarget = SCAN_DATA.recovery / 100;
    var outerCur = 0, innerCur = 0;
    var startTime = Date.now();
    var duration = 1800;

    function animateRing() {
      var elapsed = Date.now() - startTime;
      var progress = Math.min(1, elapsed / duration);
      // Ease out cubic
      var ease = 1 - Math.pow(1 - progress, 3);

      outerCur = outerTarget * ease;
      innerCur = innerTarget * ease;
      drawRing(outerCur, innerCur);

      if (progress < 1) {
        requestAnimationFrame(animateRing);
      }
    }

    // Delay ring animation for dramatic effect
    setTimeout(animateRing, 400);
  }

  // Animate score number
  function animateScore() {
    var el = document.getElementById('score-display');
    if (!el) return;

    var target = SCAN_DATA.edgeScore;
    var current = 0;
    var startTime = Date.now();
    var duration = 1600;

    function tick() {
      var elapsed = Date.now() - startTime;
      var progress = Math.min(1, elapsed / duration);
      var ease = 1 - Math.pow(1 - progress, 3);
      current = Math.round(target * ease);
      el.textContent = current;

      if (progress < 1) {
        requestAnimationFrame(tick);
      }
    }

    setTimeout(tick, 500);
  }

  // ═══════════════════════════════════════════
  // Canvas: Sparklines
  // ═══════════════════════════════════════════
  function drawSparkline(canvasId, data, color) {
    var canvas = document.getElementById(canvasId);
    if (!canvas || !data.length) return;

    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var W = canvas.offsetWidth || 140;
    var H = canvas.offsetHeight || 32;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';

    var ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    var min = Math.min.apply(null, data);
    var max = Math.max.apply(null, data);
    var range = max - min || 1;
    var padding = 4;

    // Gradient fill under line
    var grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, color + '30');
    grad.addColorStop(1, color + '00');

    ctx.beginPath();
    ctx.moveTo(0, H);

    for (var i = 0; i < data.length; i++) {
      var x = (i / (data.length - 1)) * W;
      var y = H - padding - ((data[i] - min) / range) * (H - padding * 2);
      if (i === 0) ctx.lineTo(x, y);
      else ctx.lineTo(x, y);
    }

    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // Line
    ctx.beginPath();
    for (var j = 0; j < data.length; j++) {
      var lx = (j / (data.length - 1)) * W;
      var ly = H - padding - ((data[j] - min) / range) * (H - padding * 2);
      if (j === 0) ctx.moveTo(lx, ly);
      else ctx.lineTo(lx, ly);
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.8;
    ctx.lineJoin = 'round';
    ctx.stroke();

    // End dot
    var lastX = W;
    var lastY = H - padding - ((data[data.length - 1] - min) / range) * (H - padding * 2);
    ctx.beginPath();
    ctx.arc(lastX, lastY, 3, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }

  function initSparklines() {
    setTimeout(function () {
      drawSparkline('spark-hr', SCAN_DATA.hr.history, '#FF453A');
      drawSparkline('spark-hrv', SCAN_DATA.hrv.history, '#67EA8E');
      drawSparkline('spark-rr', SCAN_DATA.rr.history, CYAN_ACTIVE);
    }, 800);
  }

  // ═══════════════════════════════════════════
  // Stress Bar
  // ═══════════════════════════════════════════
  function initStressBar() {
    var pct = SCAN_DATA.stress.pct;
    setTimeout(function () {
      var segs = document.querySelectorAll('.stress-seg-fill');
      for (var i = 0; i < segs.length; i++) {
        var segStart = i * 25;
        var segEnd = segStart + 25;
        if (pct >= segEnd) {
          segs[i].style.width = '100%';
        } else if (pct > segStart) {
          segs[i].style.width = ((pct - segStart) / 25 * 100) + '%';
        }
      }
    }, 900);
  }

  // ═══════════════════════════════════════════
  // Body Battery (Recovery) Chart
  // ═══════════════════════════════════════════
  function bbColor(val) {
    if (val >= 65) return ['#34C759', '#1A6B2E'];
    if (val >= 40) return ['#00B4D8', '#0E5A6F'];
    if (val >= 25) return ['#F5A623', '#8A5E14'];
    return ['#FF6B35', '#7A3318'];
  }

  function initBBChart() {
    var chart = document.getElementById('bb-chart');
    if (!chart) return;
    chart.innerHTML = '';
    var maxVal = Math.max.apply(null, BB_DATA);

    BB_DATA.forEach(function (val, i) {
      var bar = document.createElement('div');
      bar.className = 'bb-bar';
      if (i === BB_DATA.length - 1) bar.classList.add('last');

      var hPct = (val / maxVal) * 100;
      bar.style.height = '0%';
      bar.dataset.targetHeight = hPct + '%';

      var colors = bbColor(val);
      bar.style.background = 'linear-gradient(180deg, ' + colors[0] + ', ' + colors[1] + ')';

      var opacity = 0.25 + (i / BB_DATA.length) * 0.55;
      if (i === BB_DATA.length - 1) opacity = 1;
      bar.style.opacity = String(opacity);

      if (i === BB_DATA.length - 1) {
        bar.style.boxShadow = '0 0 8px ' + colors[0];
      }

      chart.appendChild(bar);

      setTimeout(function () {
        bar.classList.add('animate');
        bar.style.height = bar.dataset.targetHeight;
      }, 1200 + i * 80);
    });
  }

  // ═══════════════════════════════════════════
  // ANS Balance micro-fluctuation
  // ═══════════════════════════════════════════
  var ansTimer = null;

  function initANS() {
    var snsBar = document.getElementById('ans-sns-bar');
    var snsPct = document.getElementById('ans-sns-pct');
    var pnsPct = document.getElementById('ans-pns-pct');
    if (!snsBar) return;

    var target = SCAN_DATA.ans.sns;
    var current = target;

    ansTimer = setInterval(function () {
      // Subtle fluctuation ±2%
      target = SCAN_DATA.ans.sns + (Math.random() - 0.5) * 4;
      target = Math.max(25, Math.min(55, target));
      current += (target - current) * 0.15;

      var sns = Math.round(current);
      var pns = 100 - sns;

      snsBar.style.width = sns + '%';
      if (snsPct) snsPct.textContent = sns;
      if (pnsPct) pnsPct.textContent = pns;
    }, 2000);
  }

  // ═══════════════════════════════════════════
  // Live sparkline animation
  // ═══════════════════════════════════════════
  var sparkTimer = null;
  var sparkPhase = 0;

  function startLiveSparklines() {
    sparkPhase = Math.random() * 100;
    sparkTimer = setInterval(function () {
      sparkPhase += 0.35;

      var metrics = {
        hr: { base: 68, amp: 0.05, freq: 0.7, color: '#FF453A', canvas: 'spark-hr' },
        hrv: { base: 52, amp: 0.12, freq: 0.4, color: '#67EA8E', canvas: 'spark-hrv' },
        rr: { base: 14, amp: 0.08, freq: 0.25, color: CYAN_ACTIVE, canvas: 'spark-rr' }
      };

      Object.keys(metrics).forEach(function (key) {
        var m = metrics[key];
        var v = m.base
          + Math.sin(sparkPhase * m.freq) * m.base * m.amp
          + Math.sin(sparkPhase * m.freq * 2.3 + 1.7) * m.base * m.amp * 0.4
          + (Math.random() - 0.5) * m.base * 0.03;

        SCAN_DATA[key].history.push(v);
        if (SCAN_DATA[key].history.length > 40) {
          SCAN_DATA[key].history.shift();
        }

        drawSparkline(m.canvas, SCAN_DATA[key].history, m.color);
      });
    }, 500);
  }

  // ═══════════════════════════════════════════
  // Populate DOM with scan data
  // ═══════════════════════════════════════════
  function populateData() {
    // Set values
    setText('value-hr', SCAN_DATA.hr.value);
    setText('value-hrv', SCAN_DATA.hrv.value);
    setText('value-rr', SCAN_DATA.rr.value);
    setText('value-stress', SCAN_DATA.stress.value);
    setText('stress-pct-label', SCAN_DATA.stress.pct + '%');
    setText('recovery-value', SCAN_DATA.recovery);
    setText('scan-type-label', '✦ ' + SCAN_DATA.scanType + ' · ' + SCAN_DATA.scanDuration + 's');

    // Zone label
    var zoneEl = document.getElementById('zone-display');
    if (zoneEl) {
      zoneEl.textContent = SCAN_DATA.zoneLabel;
      zoneEl.className = 'zone-label ' + SCAN_DATA.zone;
    }
  }

  function setText(id, text) {
    var el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  // ═══════════════════════════════════════════
  // Init
  // ═══════════════════════════════════════════
  function init() {
    populateData();
    initNebula();
    initRing();
    animateScore();
    initSparklines();
    initStressBar();
    initBBChart();
    initANS();

    // Start live sparkline updates after initial draw
    setTimeout(startLiveSparklines, 2000);
  }

  // Wait for DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Cleanup on unload
  window.addEventListener('beforeunload', function () {
    if (nebulaFrame) cancelAnimationFrame(nebulaFrame);
    if (ansTimer) clearInterval(ansTimer);
    if (sparkTimer) clearInterval(sparkTimer);
  });
})();
