/**
 * results-renderer.js — v5.0 Results Page DOM + Canvas TEI Ring + Nebula
 *
 * Major visual upgrade:
 *   - Canvas-based TEI ring with true multi-segment spectrum gradient
 *   - Thicker ring strokes (24px outer, 14px inner)
 *   - Full-viewport nebula background (fixed position)
 *   - Endpoint amber dot with glow
 *   - Same public API as v4.2
 */
(function (global) {
    'use strict';

    // ─── Ring Constants ───
    var RING_SIZE = 296;
    var OUTER_R = 126, INNER_R = 104;
    var OUTER_W = 12, INNER_W = 6;
    var OUTER_START = Math.PI * 0.74; // lower-left
    var INNER_START = -Math.PI * 0.40; // upper-right

    // 15-stop spectrum for outer ring (purple → blue → cyan → green → yellow → orange → red)
    var SPECTRUM = [
        [94,58,135],   // #5E3A87
        [58,32,176],   // #3A20B0
        [0,102,255],   // #0066FF
        [0,136,234],   // #0088EA
        [0,180,216],   // #00B4D8
        [26,202,107],  // #1ACA6B
        [52,199,89],   // #34C759
        [111,216,75],  // #6FD84B
        [168,216,67],  // #A8D843
        [207,192,51],  // #CFC033
        [245,166,35],  // #F5A623
        [250,137,44],  // #FA892C
        [255,107,53],  // #FF6B35
        [255,87,56],   // #FF5738
        [255,69,58]    // #FF453A
    ];

    var ZONE_COLORS = {
        PEAK: '#F5A623', OPTIMAL: '#00B4D8',
        NEUTRAL: '#E5E5EA', DEGRADED: '#5E3A87'
    };

    var COACH_MSGS = {
        PEAK: ['\u7BC0\u594F\u8207\u5C08\u6CE8\u540C\u6B65\uFF0C\u4FDD\u6301\u7D00\u5F8B\uFF0C\u4F60\u6B63\u8655\u65BC\u9AD8\u52DD\u7387\u6C7A\u7B56\u5340\u3002'],
        OPTIMAL: ['\u4FDD\u6301\u5C08\u6CE8\uFF0C\u4FE1\u4EFB\u4F60\u7684\u7B56\u7565\u5224\u65B7\uFF0C\u76EE\u524D\u7684\u751F\u7406\u72C0\u614B\u986F\u793A\u4F60\u5DF2\u8655\u65BC\u6700\u4F73\u4EA4\u6613\u5340\u9593\u3002'],
        NEUTRAL: ['\u72C0\u614B\u7A69\u5B9A\u4F46\u5C1A\u672A\u9032\u5165\u751C\u871C\u9EDE\uFF0C\u653E\u6162\u7BC0\u594F\u518D\u89C0\u5BDF\u4E00\u8F2A\u8A0A\u865F\u3002'],
        DEGRADED: ['\u5148\u66AB\u505C\u65B0\u5009\u4F4D\uFF0C\u505A 2 \u6B21\u6DF1\u547C\u5438\uFF0C\u7B49\u5F85 HRV \u56DE\u5347\u5F8C\u518D\u6C7A\u7B56\u3002']
    };

    // ─── State ───
    var nebulaFrame = null;
    var sparklines = {};
    var ansFluctuateTimer = null;
    var currentCoachZone = null;
    var ringCtx = null;
    var ringDpr = 1;
    var currentOuterFill = 0;
    var currentInnerFill = 0;

    // ─── Nebula Canvas ───
    var nebulaW = 430, nebulaH = 900;

    function drawNebula(canvas) {
        var ctx = canvas.getContext('2d');
        var W = nebulaW, H = nebulaH;
        var t = Date.now() / 1000;

        ctx.clearRect(0, 0, W, H);

        // Deep space nebula clouds — vivid enough for frosted-glass backdrop-filter
        var layers = [
            { cx: W*0.50, cy: H*0.22, r: 350, color: [0,100,220], alpha: 0.32, period: 10 },
            { cx: W*0.15, cy: H*0.30, r: 280, color: [30,180,140], alpha: 0.22, period: 13 },
            { cx: W*0.85, cy: H*0.15, r: 240, color: [120,60,220], alpha: 0.20, period: 16 },
            { cx: W*0.45, cy: H*0.25, r: 200, color: [0,60,200], alpha: 0.26, period: 8 },
            { cx: W*0.70, cy: H*0.45, r: 180, color: [200,120,40], alpha: 0.12, period: 20 },
            { cx: W*0.08, cy: H*0.05, r: 200, color: [0,120,255], alpha: 0.16, period: 14 },
            { cx: W*0.35, cy: H*0.50, r: 160, color: [40,200,120], alpha: 0.14, period: 18 },
            { cx: W*0.60, cy: H*0.65, r: 220, color: [80,40,180], alpha: 0.16, period: 12 },
            { cx: W*0.25, cy: H*0.75, r: 180, color: [0,140,200], alpha: 0.14, period: 15 }
        ];

        for (var li = 0; li < layers.length; li++) {
            var l = layers[li];
            var pulse = l.period > 0 ? 0.7 + 0.3 * Math.sin(t * (2*Math.PI/l.period)) : 1;
            var grad = ctx.createRadialGradient(l.cx, l.cy, 0, l.cx, l.cy, l.r);
            grad.addColorStop(0, 'rgba('+l.color.join(',')+','+(l.alpha*pulse)+')');
            grad.addColorStop(0.4, 'rgba('+l.color.join(',')+','+(l.alpha*pulse*0.5)+')');
            grad.addColorStop(1, 'rgba('+l.color.join(',')+',0)');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, W, H);
        }

        nebulaFrame = requestAnimationFrame(function() { drawNebula(canvas); });
    }

    // ─── Canvas TEI Ring ───
    function lerpColor(c1, c2, t) {
        return [
            Math.round(c1[0] + (c2[0]-c1[0])*t),
            Math.round(c1[1] + (c2[1]-c1[1])*t),
            Math.round(c1[2] + (c2[2]-c1[2])*t)
        ];
    }

    function getSpectrumColor(pct) {
        var idx = pct * (SPECTRUM.length - 1);
        var lo = Math.floor(idx);
        var hi = Math.min(lo + 1, SPECTRUM.length - 1);
        var frac = idx - lo;
        return lerpColor(SPECTRUM[lo], SPECTRUM[hi], frac);
    }

    function drawTEIRing(outerFill, innerFill) {
        if (!ringCtx) return;
        var ctx = ringCtx;
        var cx = RING_SIZE / 2, cy = RING_SIZE / 2;

        ctx.save();
        ctx.setTransform(ringDpr, 0, 0, ringDpr, 0, 0);
        ctx.clearRect(0, 0, RING_SIZE, RING_SIZE);

        // ── Decorative concentric track rings ──
        var trackRings = [
            { r: OUTER_R, w: OUTER_W, a: 0.06 },
            { r: OUTER_R - 16, w: 1.5, a: 0.03 },
            { r: INNER_R, w: INNER_W, a: 0.05 },
            { r: INNER_R - 16, w: 1.5, a: 0.025 },
            { r: INNER_R - 28, w: 1, a: 0.02 }
        ];
        for (var tr = 0; tr < trackRings.length; tr++) {
            ctx.lineWidth = trackRings[tr].w;
            ctx.strokeStyle = 'rgba(255,255,255,' + trackRings[tr].a + ')';
            ctx.beginPath();
            ctx.arc(cx, cy, trackRings[tr].r, 0, Math.PI * 2);
            ctx.stroke();
        }

        // ── Outer ring: spectrum gradient via segments ──
        if (outerFill > 0.001) {
            var startA = OUTER_START;
            var totalAngle = outerFill * Math.PI * 2;
            var SEGS = 90;
            var segAngle = totalAngle / SEGS;

            ctx.lineWidth = OUTER_W;
            ctx.lineCap = 'round';

            // Glow layer (subtle)
            ctx.save();
            ctx.shadowColor = 'rgba(0,180,216,0.25)';
            ctx.shadowBlur = 14;

            for (var i = 0; i < SEGS; i++) {
                var t = (i / SEGS + 0.30) % 1;
                var c = getSpectrumColor(t);
                var a1 = startA + i * segAngle;
                var a2 = startA + (i + 1) * segAngle + 0.02;

                ctx.beginPath();
                ctx.arc(cx, cy, OUTER_R, a1, a2);
                ctx.strokeStyle = 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')';
                ctx.stroke();
            }
            ctx.restore();

            // Start cyan marker
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

            // ── Endpoint amber dot ──
            var endAngle = startA + totalAngle;
            var epx = cx + OUTER_R * Math.cos(endAngle);
            var epy = cy + OUTER_R * Math.sin(endAngle);

            // Glow
            ctx.save();
            ctx.shadowColor = 'rgba(245,166,35,0.7)';
            ctx.shadowBlur = 14;
            ctx.beginPath();
            ctx.arc(epx, epy, 6, 0, Math.PI * 2);
            ctx.fillStyle = '#F5A623';
            ctx.fill();
            ctx.restore();
        }

        // ── Inner ring: green → cyan gradient ──
        if (innerFill > 0.001) {
            var iStart = INNER_START;
            var iTotal = innerFill * Math.PI * 2;
            var iSegs = 40;
            var iSegAngle = iTotal / iSegs;

            ctx.lineWidth = INNER_W;
            ctx.lineCap = 'round';

            ctx.save();
            ctx.shadowColor = 'rgba(52,199,89,0.2)';
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

    // ─── Zone ───
    function getZone(tei) {
        if (tei >= 80) return 'PEAK';
        if (tei >= 55) return 'OPTIMAL';
        if (tei >= 35) return 'NEUTRAL';
        return 'DEGRADED';
    }

    function bbColor(val) {
        if (val >= 65) return ['#34C759','#1A6B2E'];
        if (val >= 40) return ['#00B4D8','#0E5A6F'];
        if (val >= 25) return ['#F5A623','#8A5E14'];
        return ['#FF6B35','#7A3318'];
    }

    // ─── Build DOM ───
    function buildDOM(container) {
        container.innerHTML = '';

        var wrap = document.createElement('div');
        wrap.className = 'results-content';

        // Close button
        var closeBtn = document.createElement('button');
        closeBtn.className = 'results-close-btn';
        closeBtn.id = 'results-close-btn';
        closeBtn.textContent = '\u00D7';
        container.appendChild(closeBtn);

        // Nebula canvas (fixed background)
        var nebula = document.createElement('canvas');
        nebula.id = 'tenki-nebula-canvas';
        container.appendChild(nebula);

        // Scan badge
        var badge = document.createElement('div');
        badge.className = 'scan-badge'; badge.id = 'scan-badge';
        var badgePill = document.createElement('span');
        badgePill.className = 'scan-badge-pill'; badgePill.id = 'scan-badge-pill';
        badgePill.textContent = '\u2726 SCANNING';
        badge.appendChild(badgePill);
        wrap.appendChild(badge);

        // Source strip
        var srcStrip = document.createElement('div');
        srcStrip.className = 'source-strip';
        srcStrip.innerHTML =
            '<span class="source-chip active" id="src-garmin">' +
            '  <span class="source-chip-icon source-chip-icon-watch" aria-hidden="true">' +
            '    <svg viewBox="0 0 24 24" focusable="false">' +
            '      <rect x="8" y="5" width="8" height="14" rx="3" />' +
            '      <circle cx="12" cy="12" r="2.1" />' +
            '    </svg>' +
            '  </span>' +
            '  <span class="source-chip-text">Garmin Forerunner</span>' +
            '</span>' +
            '<span class="source-chip" id="src-rppg">' +
            '  <span class="source-chip-icon source-chip-icon-camera" aria-hidden="true">' +
            '    <svg viewBox="0 0 24 24" focusable="false">' +
            '      <path d="M7 8.5h2.1l1.1-1.5h3.6l1.1 1.5H17a2 2 0 0 1 2 2V16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-5.5a2 2 0 0 1 2-2z" />' +
            '      <circle cx="12" cy="12.5" r="2.5" />' +
            '    </svg>' +
            '  </span>' +
            '  <span class="source-chip-text">rPPG 眉心</span>' +
            '</span>';
        wrap.appendChild(srcStrip);

        // TEI Ring Section — Canvas-based
        var ringSection = document.createElement('div');
        ringSection.className = 'tei-ring-section';

        var ringContainer = document.createElement('div');
        ringContainer.className = 'tei-ring-container';
        ringContainer.id = 'tei-ring-container';

        var ringCanvas = document.createElement('canvas');
        ringCanvas.id = 'tei-ring-canvas';
        ringCanvas.className = 'tei-ring-canvas';
        ringContainer.appendChild(ringCanvas);

        var numCont = document.createElement('div');
        numCont.className = 'tei-number-container';

        var teiNum = document.createElement('div');
        teiNum.className = 'tei-number'; teiNum.id = 'tei-display';
        teiNum.textContent = '--';
        numCont.appendChild(teiNum);

        var teiSub = document.createElement('div');
        teiSub.className = 'tei-sub'; teiSub.textContent = 'TEI \u00B7 PR99';
        numCont.appendChild(teiSub);

        var zoneLabel = document.createElement('div');
        zoneLabel.className = 'tei-zone-label neutral';
        zoneLabel.id = 'tei-zone-label';
        zoneLabel.textContent = 'Scanning';
        numCont.appendChild(zoneLabel);

        ringContainer.appendChild(numCont);
        ringSection.appendChild(ringContainer);
        wrap.appendChild(ringSection);

        // Coach card
        var coach = document.createElement('div');
        coach.className = 'coach-card'; coach.id = 'coach-card';
        coach.textContent = '\u6B63\u5728\u6821\u6E96\u611F\u6E2C\u5668...';
        wrap.appendChild(coach);

        // Bento grid — 2×2
        var grid = document.createElement('div');
        grid.className = 'results-bento-grid';

        // Card 1: Heart Rate — header (label+pill) then body (value+sparkline)
        grid.innerHTML =
            '<div class="results-bento-card">' +
            '  <div class="results-bento-header">' +
            '    <div class="results-bento-label">Heart Rate</div>' +
            '    <span class="results-bento-pill garmin">Garmin Sync</span>' +
            '  </div>' +
            '  <div class="results-bento-body">' +
            '    <div class="results-bento-row">' +
            '      <span class="results-bento-value" id="bento-hr">--</span>' +
            '      <span class="results-bento-unit">BPM</span>' +
            '    </div>' +
            '    <canvas class="results-bento-sparkline" id="results-spark-hr"></canvas>' +
            '  </div>' +
            '</div>' +

            '<div class="results-bento-card">' +
            '  <div class="results-bento-header">' +
            '    <div class="results-bento-label">HRV</div>' +
            '    <span class="results-bento-pill balanced">Balanced</span>' +
            '  </div>' +
            '  <div class="results-bento-body">' +
            '    <div class="results-bento-row">' +
            '      <span class="results-bento-value" id="bento-hrv">--</span>' +
            '      <span class="results-bento-unit"><sup>ms</sup> RMSSD</span>' +
            '    </div>' +
            '    <canvas class="results-bento-sparkline" id="results-spark-hrv"></canvas>' +
            '  </div>' +
            '</div>' +

            '<div class="results-bento-card">' +
            '  <div class="results-bento-header">' +
            '    <div class="results-bento-label">Respiratory</div>' +
            '  </div>' +
            '  <div class="results-bento-body">' +
            '    <div class="results-bento-row">' +
            '      <span class="results-bento-value" id="bento-rr">--</span>' +
            '      <span class="results-bento-unit">BrPM</span>' +
            '    </div>' +
            '    <canvas class="results-bento-sparkline" id="results-spark-rr"></canvas>' +
            '  </div>' +
            '</div>' +

            '<div class="results-bento-card">' +
            '  <div class="results-bento-header">' +
            '    <div class="results-bento-label">Stress</div>' +
            '    <span class="stress-pct" id="stress-pct"></span>' +
            '  </div>' +
            '  <div class="results-bento-body">' +
            '    <div class="results-bento-row">' +
            '      <span class="results-bento-value" id="bento-stress">--</span>' +
            '      <span class="results-bento-unit">/100</span>' +
            '    </div>' +
            '  </div>' +
            '  <div class="stress-segments" id="stress-segments">' +
            '    <div class="stress-seg" data-seg="0"><div class="stress-seg-fill"></div></div>' +
            '    <div class="stress-seg" data-seg="1"><div class="stress-seg-fill"></div></div>' +
            '    <div class="stress-seg" data-seg="2"><div class="stress-seg-fill"></div></div>' +
            '    <div class="stress-seg" data-seg="3"><div class="stress-seg-fill"></div></div>' +
            '    <div class="stress-seg" data-seg="4"><div class="stress-seg-fill"></div></div>' +
            '  </div>' +
            '</div>';

        wrap.appendChild(grid);

        // Body Battery Card (includes ANS Balance)
        var bbCard = document.createElement('div');
        bbCard.className = 'results-glass-card';
        bbCard.innerHTML =
            '<div class="results-card-title">Body Battery</div>' +
            '<div class="bb-row">' +
            '  <div class="bb-chart" id="bb-chart"></div>' +
            '  <div class="bb-value-display">' +
            '    <div class="bb-value-number" id="bb-value">78</div>' +
            '    <div class="bb-value-total">/100</div>' +
            '  </div>' +
            '</div>' +
            '<div class="ans-section">' +
            '  <div class="results-card-subtitle">ANS Balance</div>' +
            '  <div class="ans-bar-outer">' +
            '    <div class="ans-sns-bar" id="ans-sns" style="width:38%"></div>' +
            '    <div class="ans-divider-line" id="ans-divider" style="left:38%"></div>' +
            '    <div class="ans-pns-bar" id="ans-pns" style="width:62%"></div>' +
            '  </div>' +
            '  <div class="ans-labels">' +
            '    <span><span id="ans-sns-pct">38</span>%&nbsp;&nbsp;&nbsp;SNS</span>' +
            '    <span>PNS&nbsp;&nbsp;&nbsp;<span id="ans-pns-pct">62</span>%</span>' +
            '  </div>' +
            '</div>';
        wrap.appendChild(bbCard);

        container.appendChild(wrap);

        // FDCB dock
        var dock = document.createElement('div');
        dock.className = 'fdcb-dock'; dock.id = 'fdcb-dock';
        dock.innerHTML =
            '<div class="fdcb-template" id="fdcb-template-name">' +
            '  <span class="fdcb-icon" aria-hidden="true">' +
            '    <svg class="fdcb-icon-svg" viewBox="0 0 24 24" focusable="false">' +
            '      <g class="fdcb-icon-back">' +
            '        <path d="M12 5 C14.8 5 17 7.2 17 10" />' +
            '        <path d="M19 12 C19 14.8 16.8 17 14 17" />' +
            '        <path d="M12 19 C9.2 19 7 16.8 7 14" />' +
            '        <path d="M5 12 C5 9.2 7.2 7 10 7" />' +
            '      </g>' +
            '      <g class="fdcb-icon-front">' +
            '        <path d="M12 6 C14.2 6 16 7.8 16 10" />' +
            '        <path d="M18 12 C18 14.2 16.2 16 14 16" />' +
            '        <path d="M12 18 C9.8 18 8 16.2 8 14" />' +
            '        <path d="M6 12 C6 9.8 7.8 8 10 8" />' +
            '      </g>' +
            '      <circle class="fdcb-icon-core" cx="12" cy="12" r="1.6" />' +
            '    </svg>' +
            '  </span>' +
            '  <span class="fdcb-template-text">Canslim GS</span>' +
            '  <span class="fdcb-template-caret">\u25BE</span>' +
            '</div>' +
            '<div class="fdcb-center">' +
            '  <div class="fdcb-timer" id="fdcb-timer">02:18</div>' +
            '  <div class="fdcb-progress"><div class="fdcb-progress-fill" id="fdcb-progress-fill" style="width:0%"></div></div>' +
            '</div>' +
            '<button class="fdcb-confirm" id="fdcb-confirm">\u2713</button>';
        container.appendChild(dock);
    }

    // ─── Init Ring Canvas ───
    function initRingCanvas() {
        var canvas = document.getElementById('tei-ring-canvas');
        if (!canvas) return;

        ringDpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = RING_SIZE * ringDpr;
        canvas.height = RING_SIZE * ringDpr;
        canvas.style.width = RING_SIZE + 'px';
        canvas.style.height = RING_SIZE + 'px';

        ringCtx = canvas.getContext('2d');
        currentOuterFill = 0;
        currentInnerFill = 0;

        // Draw empty tracks
        drawTEIRing(0, 0);
    }

    // ─── Init Sparklines ───
    function initSparklines() {
        sparklines = {};
        var colors = { hr:'#FF453A', hrv:'#67EA8E', rr:'#20D7F2' };
        ['hr','hrv','rr'].forEach(function(id) {
            var el = document.getElementById('results-spark-' + id);
            if (el && global.TENKI_Sparkline) {
                try {
                    sparklines[id] = new global.TENKI_Sparkline(el, {
                        color: colors[id], maxPoints: 40
                    });
                } catch (e) {
                    console.warn('[RESULTS] Sparkline init failed for', id, e);
                }
            }
        });
    }

    // ─── Init Body Battery ───
    function initBBChart(data) {
        var chart = document.getElementById('bb-chart');
        if (!chart) return;
        chart.innerHTML = '';
        var maxVal = Math.max.apply(null, data);

        data.forEach(function(val, i) {
            var bar = document.createElement('div');
            bar.className = 'bb-bar';
            if (i === data.length - 1) bar.classList.add('last');

            var hPct = (val / maxVal) * 100;
            bar.style.height = hPct + '%';

            var colors = bbColor(val);
            bar.style.background = 'linear-gradient(180deg, ' + colors[0] + ', ' + colors[1] + ')';

            var opacity = 0.25 + (i / 12) * 0.55;
            if (i === data.length - 1) opacity = 1;
            bar.style.opacity = String(opacity);

            if (i === data.length - 1) {
                bar.style.boxShadow = '0 0 8px ' + colors[0];
            }

            chart.appendChild(bar);
            setTimeout(function() { bar.classList.add('animate'); }, 1200 + i * 80);
        });
    }

    // ─── Update Stress segmented bar ───
    function updateStressBar(stress) {
        var segs = document.querySelectorAll('.stress-seg-fill');
        if (!segs || segs.length < 1) return;
        var segCount = segs.length;
        var unit = 100 / segCount;
        for (var i = 0; i < segCount; i++) {
            var segMin = i * unit;
            var segMax = (i + 1) * unit;
            if (stress >= segMax) {
                segs[i].style.width = '100%';
            } else if (stress > segMin) {
                segs[i].style.width = ((stress - segMin) / unit * 100) + '%';
            } else {
                segs[i].style.width = '0%';
            }
        }
        var pctEl = document.getElementById('stress-pct');
        if (pctEl) pctEl.textContent = stress + '%';
    }

    // ─── ANS Micro-fluctuation ───
    function startANSFluctuation() {
        if (ansFluctuateTimer) return;
        ansFluctuateTimer = setInterval(function () {
            var snsEl = document.getElementById('ans-sns');
            var pnsEl = document.getElementById('ans-pns');
            var divEl = document.getElementById('ans-divider');
            var snsPctEl = document.getElementById('ans-sns-pct');
            var pnsPctEl = document.getElementById('ans-pns-pct');

            if (!snsEl || !pnsEl) return;

            var current = parseFloat(snsEl.style.width) || 38;
            var jitter = (Math.random() - 0.5) * 4;
            var newSns = Math.max(15, Math.min(85, current + jitter));
            var newPns = 100 - newSns;

            snsEl.style.width = newSns + '%';
            pnsEl.style.width = newPns + '%';
            if (divEl) divEl.style.left = newSns + '%';
            if (snsPctEl) snsPctEl.textContent = String(Math.round(newSns));
            if (pnsPctEl) pnsPctEl.textContent = String(Math.round(newPns));
        }, 350);
    }

    // ─── Public API ───
    var isInitialized = false;

    var RENDERER = {
        init: function() {
            // Idempotent — skip if already built (commitScan pre-builds)
            if (isInitialized && document.getElementById('tei-ring-canvas')) return;

            var container = document.getElementById('results-page');
            if (!container) return;

            isInitialized = true;
            buildDOM(container);

            // Init nebula
            // Nebula clouds only — no star particles
            var nebula = document.getElementById('tenki-nebula-canvas');
            if (nebula) {
                var dpr = Math.min(window.devicePixelRatio || 1, 2);
                nebulaW = Math.min(window.innerWidth, 430);
                nebulaH = window.innerHeight;
                nebula.width = nebulaW * dpr;
                nebula.height = nebulaH * dpr;
                nebula.style.width = nebulaW + 'px';
                nebula.style.height = nebulaH + 'px';
                nebula.getContext('2d').scale(dpr, dpr);
                drawNebula(nebula);
            }

            // Init TEI ring canvas
            initRingCanvas();

            // Init sparklines
            initSparklines();
        },

        showWarmup: function() {
            var el = document.getElementById('tei-display');
            if (el) el.textContent = '--';
            var zone = document.getElementById('tei-zone-label');
            if (zone) { zone.textContent = 'SCANNING'; zone.className = 'tei-zone-label neutral'; }
            var coach = document.getElementById('coach-card');
            if (coach) coach.textContent = '\u6B63\u5728\u6821\u6E96\u611F\u6E2C\u5668...';

            ['hr','hrv','rr','stress'].forEach(function(id) {
                var v = document.getElementById('bento-' + id);
                if (v) v.textContent = '--';
            });

            // Draw empty ring
            drawTEIRing(0, 0);
        },

        updateAll: function(ewma, histories, ans, phase) {
            var tei = Math.round(ewma.tei);
            var hr = Math.round(ewma.hr);
            var hrv = Math.round(ewma.hrv);
            var rr = Math.round(ewma.rr);
            var stress = Math.round(ewma.stress);
            var zone = getZone(tei);

            // TEI number
            var numEl = document.getElementById('tei-display');
            if (numEl) numEl.textContent = String(tei);

            // Heartbeat pulse sync
            if (hr > 0) {
                document.documentElement.style.setProperty('--pulse-dur', (60/hr).toFixed(2) + 's');
            }

            // Zone label
            var zoneEl = document.getElementById('tei-zone-label');
            if (zoneEl) {
                zoneEl.className = 'tei-zone-label ' + zone.toLowerCase();
                zoneEl.textContent = zone.charAt(0) + zone.slice(1).toLowerCase();
                zoneEl.style.color = ZONE_COLORS[zone];
            }

            // Coach card
            if (zone !== currentCoachZone) {
                currentCoachZone = zone;
                var coachEl = document.getElementById('coach-card');
                if (coachEl) {
                    var msgs = COACH_MSGS[zone];
                    coachEl.textContent = msgs[Math.floor(Math.random() * msgs.length)];
                }
            }

            // ── Canvas TEI Ring ──
            currentOuterFill = Math.max(0, Math.min(1, tei / 100));
            currentInnerFill = Math.max(0.68, Math.min(0.93, 0.56 + (hrv / 100) * 0.6));
            drawTEIRing(currentOuterFill, currentInnerFill);

            // Bento values
            var bentoHr = document.getElementById('bento-hr');
            if (bentoHr) bentoHr.textContent = String(hr);
            var bentoHrv = document.getElementById('bento-hrv');
            if (bentoHrv) bentoHrv.textContent = String(hrv);
            var bentoRr = document.getElementById('bento-rr');
            if (bentoRr) bentoRr.textContent = String(rr);
            var bentoStress = document.getElementById('bento-stress');
            if (bentoStress) bentoStress.textContent = String(stress);

            // Sparklines
            if (sparklines.hr && histories.hr.length > 0) sparklines.hr.push(hr);
            if (sparklines.hrv && histories.hrv.length > 0) sparklines.hrv.push(hrv);
            if (sparklines.rr && histories.rr.length > 0) sparklines.rr.push(rr);

            // Stress bar
            updateStressBar(stress);

            // ANS balance
            var snsPct = ans ? ans.sns : 38;
            var pnsPct = ans ? ans.pns : 62;
            var snsEl = document.getElementById('ans-sns');
            var pnsEl = document.getElementById('ans-pns');
            var divEl = document.getElementById('ans-divider');
            if (snsEl) snsEl.style.width = snsPct + '%';
            if (pnsEl) pnsEl.style.width = pnsPct + '%';
            if (divEl) divEl.style.left = snsPct + '%';
            var snsPctEl = document.getElementById('ans-sns-pct');
            var pnsPctEl = document.getElementById('ans-pns-pct');
            if (snsPctEl) snsPctEl.textContent = String(snsPct);
            if (pnsPctEl) pnsPctEl.textContent = String(pnsPct);

            // TEI sub
            var subEl = document.querySelector('.tei-sub');
            if (subEl) {
                subEl.textContent = 'TEI \u00B7 PR99';
            }
        },

        updateBadge: function(phase, elapsed) {
            var el = document.getElementById('scan-badge-pill');
            if (!el) return;
            if (phase < 5) {
                el.textContent = '\u2726 SCANNING \u00B7 ' + elapsed + 's';
            }
        },

        updatePhaseDots: function() { },

        showComplete: function(ewma) {
            var badge = document.getElementById('scan-badge-pill');
            if (badge) badge.textContent = '\u2726 DEEP SCAN \u00B7 60s';

            // Glow pulse on ring container
            var ring = document.getElementById('tei-ring-container');
            if (ring) {
                ring.classList.add('ring-glow-pulse');
                setTimeout(function() { ring.classList.remove('ring-glow-pulse'); }, 1500);
            }

            // Show FDCB dock
            var dock = document.getElementById('fdcb-dock');
            if (dock) dock.classList.add('active');

            // Init BB chart
            var baseline = global.TENKI_BASELINE_SIM;
            if (baseline) {
                initBBChart(baseline.generateBB24h());
            }

            // Start ANS micro-fluctuation
            startANSFluctuation();
        },

        destroy: function() {
            if (nebulaFrame) {
                cancelAnimationFrame(nebulaFrame);
                nebulaFrame = null;
            }
            if (ansFluctuateTimer) {
                clearInterval(ansFluctuateTimer);
                ansFluctuateTimer = null;
            }
            sparklines = {};
            ringCtx = null;
            currentCoachZone = null;
            isInitialized = false;
        }
    };

    global.TENKI_RESULTS = RENDERER;
})(window);

