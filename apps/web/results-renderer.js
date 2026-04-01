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
    var OUTER_START = Math.PI * 0.74; // lower-left (~8 o'clock)
    var INNER_START = Math.PI * 0.74; // same start — both rings clockwise from lower-left

    // 12-stop spectrum for outer ring (cyan → green → yellow → orange → red)
    // Matches reference mockup warm-progression
    var SPECTRUM = [
        [0,180,180],   // #00B4B4  teal
        [0,190,140],   // #00BE8C  teal-green
        [40,200,100],  // #28C864  green
        [80,210,60],   // #50D23C  yellow-green
        [140,210,50],  // #8CD232  lime
        [190,200,40],  // #BEC828  yellow-green
        [220,180,35],  // #DCB423  golden
        [240,155,30],  // #F09B1E  amber
        [250,125,35],  // #FA7D23  orange
        [255,100,45],  // #FF642D  deep orange
        [255,80,50],   // #FF5032  red-orange
        [255,65,55]    // #FF4137  red
    ];

    var ZONE_COLORS = {
        PEAK: '#F5A623', OPTIMAL: '#00B4D8',
        NEUTRAL: '#E5E5EA', DEGRADED: '#5E3A87'
    };

    var COACH_MSGS = {
        PEAK: ['你的專注力與身體節律高度同步，適合處理重要決策。保持穩定節奏。'],
        OPTIMAL: ['生理狀態穩定清晰，目前是做決策的最佳時機。信任你的判斷力。'],
        NEUTRAL: ['狀態平穩但尚未進入最佳區間，放慢節奏，觀察自己的呼吸再行動。'],
        DEGRADED: ['身體正在發出休息訊號。暫緩任何重要判斷，先做 2 次深呼吸。']
    };

    // Decision recommendation messages per zone (Health/Decision mode default)
    var TRADE_ADVICE = {
        PEAK: {
            label: '高能量狀態',
            emoji: '🔥',
            tips: [
                '適合處理高複雜度的決策與挑戰',
                '注意過度自信風險，保持紀律',
                '可積極行動，但設定明確停損點'
            ]
        },
        OPTIMAL: {
            label: '最佳決策區間',
            emoji: '✨',
            tips: [
                '情緒清明穩定，決策品質良好',
                '信任你的判斷，保持專注',
                '適合執行重要計畫與行動'
            ]
        },
        NEUTRAL: {
            label: '穩定觀察區',
            emoji: '😌',
            tips: [
                '適合執行既有策略，避免衝動決策',
                '建議先做 60 秒呼吸校準再行動',
                '壓力中等，放慢節奏觀察自身狀態'
            ]
        },
        DEGRADED: {
            label: '建議休息',
            emoji: '⚠️',
            tips: [
                '暫停所有重要決策，先恢復能量',
                '等待 HRV 回升後再重新評估',
                '目前狀態不適合做關鍵判斷'
            ]
        }
    };

    // Breathing guidance hints shown during scanning warmup
    var BREATHING_HINTS = [
        '請保持臉部在畫面中央',
        '試著平穩呼吸：4 秒吸氣，6 秒吐氣',
        '放鬆肩膀，自然呼吸',
        '正在分析你的生理指標...',
        '保持穩定，讓感測器校準',
        '深呼吸有助於提升 HRV 數值',
        '掃描中，請勿移動裝置'
    ];

    // ─── State ───
    var nebulaFrame = null;
    var sparklines = {};
    var ansFluctuateTimer = null;
    var breathingTimer = null;
    var currentCoachZone = null;
    var ringCtx = null;
    var ringDpr = 1;
    var currentOuterFill = 0;
    var currentInnerFill = 0;

    var animatedTeiTarget = 1;
    var animatedTeiCurrent = 1;
    var teiAnimFrame = null;

    /**
     * TEI PR99 → RS-style 顯示分數 (1–99)
     * 引擎已輸出 1-99，此函式為安全網 + 單一顯示來源
     * @param {number} raw - 內部 PR99 值
     * @returns {number} 1–99 整數
     */
    function clampTeiDisplay(raw) {
        if (raw == null || isNaN(raw)) return 1;
        return Math.max(1, Math.min(99, Math.round(raw)));
    }

    function animateTeiLoop() {
        var diff = animatedTeiTarget - animatedTeiCurrent;
        var numEl = document.getElementById('tei-display');

        if (Math.abs(diff) < 0.5) {
            animatedTeiCurrent = animatedTeiTarget;
            if (numEl) numEl.textContent = String(clampTeiDisplay(animatedTeiCurrent));
            teiAnimFrame = null;
            return;
        }

        animatedTeiCurrent += diff * 0.15;
        if (numEl) numEl.textContent = String(clampTeiDisplay(animatedTeiCurrent));
        teiAnimFrame = requestAnimationFrame(animateTeiLoop);
    }

    // ─── Nebula Canvas ───
    var nebulaW = 430, nebulaH = 900;

    function drawNebula(canvas) {
        var ctx = canvas.getContext('2d');
        var W = nebulaW, H = nebulaH;
        var t = Date.now() / 1000;

        ctx.clearRect(0, 0, W, H);

        // Deep space nebula clouds — vivid enough for frosted-glass backdrop-filter
        var layers = [
            { cx: W*0.50, cy: H*0.22, r: 380, color: [0,100,220], alpha: 0.45, period: 10 },
            { cx: W*0.15, cy: H*0.30, r: 310, color: [30,180,140], alpha: 0.35, period: 13 },
            { cx: W*0.85, cy: H*0.15, r: 270, color: [120,60,220], alpha: 0.30, period: 16 },
            { cx: W*0.45, cy: H*0.25, r: 240, color: [0,60,200], alpha: 0.38, period: 8 },
            { cx: W*0.70, cy: H*0.45, r: 220, color: [200,120,40], alpha: 0.18, period: 20 },
            { cx: W*0.08, cy: H*0.05, r: 240, color: [0,120,255], alpha: 0.24, period: 14 },
            { cx: W*0.35, cy: H*0.50, r: 200, color: [40,200,120], alpha: 0.22, period: 18 },
            { cx: W*0.60, cy: H*0.65, r: 260, color: [80,40,180], alpha: 0.24, period: 12 },
            { cx: W*0.25, cy: H*0.75, r: 220, color: [0,140,200], alpha: 0.22, period: 15 }
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
                var t = i / SEGS;
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
            ctx.shadowColor = 'rgba(40,200,140,0.25)';
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

    /**
     * Sync current TEI zone to body dataset for zone-aware UI theming.
     * @param {'PEAK'|'OPTIMAL'|'NEUTRAL'|'DEGRADED'} zone
     */
    function applyZoneTheme(zone) {
        if (!document.body || !zone) return;
        var zoneValue = zone.toLowerCase();
        if (document.body.getAttribute('data-tenki-zone') !== zoneValue) {
            document.body.setAttribute('data-tenki-zone', zoneValue);
        }
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

        // Trading Summary Card
        var summary = document.createElement('div');
        summary.className = 'results-glass-card rp-summary-card';
        summary.id = 'rp-summary';
        summary.innerHTML =
            '<div class="rp-summary-header">' +
            '  <span class="rp-summary-zone" id="rp-summary-zone">--</span>' +
            '  <span class="rp-summary-emoji" id="rp-summary-emoji"></span>' +
            '</div>' +
            '<div class="rp-summary-label" id="rp-summary-label"></div>' +
            '<div class="rp-summary-tips" id="rp-summary-tips"></div>';
        wrap.appendChild(summary);

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
            '    <div class="results-bento-spark-wrap">' +
            '      <span class="results-bento-sparkline-wait" id="spark-wait-hr">\u7B49\u5F85\u6578\u64DA\u4E2D\u2026</span>' +
            '      <canvas class="results-bento-sparkline" id="results-spark-hr" style="display:none"></canvas>' +
            '    </div>' +
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
            '      <span class="results-bento-unit">ms RMSSD</span>' +
            '    </div>' +
            '    <div class="results-bento-spark-wrap">' +
            '      <span class="results-bento-sparkline-wait" id="spark-wait-hrv">\u7B49\u5F85\u6578\u64DA\u4E2D\u2026</span>' +
            '      <canvas class="results-bento-sparkline" id="results-spark-hrv" style="display:none"></canvas>' +
            '    </div>' +
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
            '    <div class="results-bento-spark-wrap">' +
            '      <span class="results-bento-sparkline-wait" id="spark-wait-rr">\u7B49\u5F85\u6578\u64DA\u4E2D\u2026</span>' +
            '      <canvas class="results-bento-sparkline" id="results-spark-rr" style="display:none"></canvas>' +
            '    </div>' +
            '  </div>' +
            '</div>' +

            '<div class="results-bento-card">' +
            '  <div class="results-bento-header">' +
            '    <div class="results-bento-label">Stress</div>' +
            '  </div>' +
            '  <div class="results-bento-body">' +
            '    <div class="results-bento-row">' +
            '      <span class="results-bento-value" id="bento-stress">--</span>' +
            '      <span class="results-bento-unit">/100</span>' +
            '    </div>' +
            '    <span class="stress-pct" id="stress-pct"></span>' +
            '  </div>' +
            '  <div class="stress-seg-track" id="stress-bar-track">' +
            '    <div class="stress-seg" data-seg="0"><div class="stress-seg-fill"></div></div>' +
            '    <div class="stress-seg" data-seg="1"><div class="stress-seg-fill"></div></div>' +
            '    <div class="stress-seg" data-seg="2"><div class="stress-seg-fill"></div></div>' +
            '    <div class="stress-seg" data-seg="3"><div class="stress-seg-fill"></div></div>' +
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
                    // Force explicit size before init
                    el.style.width = '80px';
                    el.style.height = '28px';
                    sparklines[id] = new global.TENKI_Sparkline(el, {
                        color: colors[id], maxPoints: 40, lineWidth: 1.8
                    });
                } catch (e) {
                    console.warn('[RESULTS] Sparkline init failed for', id, e);
                }
            }
        });
    }

    // Show sparkline canvas and hide waiting text
    var sparkRevealed = {};
    function revealSparkline(id) {
        if (sparkRevealed[id]) return;
        sparkRevealed[id] = true;
        var canvas = document.getElementById('results-spark-' + id);
        var wait = document.getElementById('spark-wait-' + id);
        if (canvas) canvas.style.display = 'block';
        if (wait) wait.style.display = 'none';
    }

    // Seed sparklines with realistic organic waveform so it's visible immediately
    var sparkAnimTimer = null;
    var sparkAnimPhase = 0;

    function seedSparklines() {
        var seeds = { hr: 68, hrv: 45, rr: 15 };
        var ampScale = { hr: 0.06, hrv: 0.15, rr: 0.10 };
        ['hr', 'hrv', 'rr'].forEach(function(id) {
            if (!sparklines[id]) return;
            revealSparkline(id);
            var base = seeds[id];
            var amp = ampScale[id];
            var batch = [];
            // Generate 20 points of organic sinusoidal breathing curve
            for (var i = 0; i < 20; i++) {
                var phase = (i / 20) * Math.PI * 4; // 2 full cycles
                var wave = Math.sin(phase) * base * amp;
                var noise = (Math.random() - 0.5) * base * 0.05;
                batch.push(base + wave + noise);
            }
            if (sparklines[id].pushBatch) {
                sparklines[id].pushBatch(batch);
            } else {
                for (var j = 0; j < batch.length; j++) sparklines[id].push(batch[j]);
            }
        });

        // Start continuous animation so waveforms keep moving
        startSparklineAnimator();
    }

    function startSparklineAnimator() {
        if (sparkAnimTimer) return;
        sparkAnimPhase = Math.random() * 100;
        sparkAnimTimer = setInterval(function() {
            sparkAnimPhase += 0.35;
            var seeds = { hr: 68, hrv: 45, rr: 15 };
            var ampScale = { hr: 0.05, hrv: 0.12, rr: 0.08 };
            var freqs = { hr: 0.7, hrv: 0.4, rr: 0.25 };
            ['hr', 'hrv', 'rr'].forEach(function(id) {
                if (!sparklines[id]) return;
                var base = seeds[id];
                var amp = ampScale[id];
                var v = base
                    + Math.sin(sparkAnimPhase * freqs[id]) * base * amp
                    + Math.sin(sparkAnimPhase * freqs[id] * 2.3 + 1.7) * base * amp * 0.4
                    + (Math.random() - 0.5) * base * 0.03;
                sparklines[id].push(v);
            });
        }, 400);
    }

    function stopSparklineAnimator() {
        if (sparkAnimTimer) {
            clearInterval(sparkAnimTimer);
            sparkAnimTimer = null;
        }
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
        // 4-segment colored stress bar (each segment = 25%)
        var track = document.getElementById('stress-bar-track');
        if (track) {
            var segs = track.querySelectorAll('.stress-seg-fill');
            var pct = Math.max(0, Math.min(100, stress));
            for (var i = 0; i < segs.length; i++) {
                var segStart = i * 25;
                var segEnd = segStart + 25;
                if (pct >= segEnd) {
                    segs[i].style.width = '100%';
                } else if (pct > segStart) {
                    segs[i].style.width = ((pct - segStart) / 25 * 100) + '%';
                } else {
                    segs[i].style.width = '0%';
                }
            }
        }
        var pctEl = document.getElementById('stress-pct');
        if (pctEl) pctEl.textContent = stress + '%';
    }

    // ─── ANS Micro-fluctuation ───
    var ansTarget = 38;
    var ansCurrent = 38;
    var ansLastUpdate = 0;

    function startANSFluctuation() {
        if (ansFluctuateTimer) return;
        ansCurrent = 38;
        ansTarget = 38;
        ansLastUpdate = Date.now();

        ansFluctuateTimer = setInterval(function () {
            var snsEl = document.getElementById('ans-sns');
            var pnsEl = document.getElementById('ans-pns');
            var divEl = document.getElementById('ans-divider');
            var snsPctEl = document.getElementById('ans-sns-pct');
            var pnsPctEl = document.getElementById('ans-pns-pct');

            if (!snsEl || !pnsEl) return;

            // Pick new random target every ~1.2s
            var now = Date.now();
            if (now - ansLastUpdate > 1200) {
                ansTarget = Math.max(25, Math.min(75, ansTarget + (Math.random() - 0.5) * 12));
                ansLastUpdate = now;
            }

            // Smooth lerp toward target
            ansCurrent += (ansTarget - ansCurrent) * 0.15;
            var newSns = ansCurrent;
            var newPns = 100 - newSns;

            snsEl.style.width = newSns.toFixed(1) + '%';
            pnsEl.style.width = newPns.toFixed(1) + '%';
            if (divEl) divEl.style.left = newSns.toFixed(1) + '%';
            if (snsPctEl) snsPctEl.textContent = String(Math.round(newSns));
            if (pnsPctEl) pnsPctEl.textContent = String(Math.round(newPns));
        }, 80);
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
            applyZoneTheme('NEUTRAL');

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

            // Init sparklines + BB + stress + FDCB (delay to ensure layout is settled)
            setTimeout(function() {
                initSparklines();
                seedSparklines();

                // FIX #2: Seed BB chart immediately with default declining profile
                var defaultBB = [92,90,88,86,84,82,80,79,78,77,76,75,78,80,82,84,82,80,78,76,75,74,76,78];
                initBBChart(defaultBB);

                // FIX #4: Seed stress bar with neutral default
                updateStressBar(30);

                // FIX #5: Show FDCB dock immediately (idle state)
                var dock = document.getElementById('fdcb-dock');
                if (dock) dock.classList.add('active');

                // FIX: Start ANS fluctuation immediately (don't wait for scan complete)
                startANSFluctuation();
            }, 300);
        },

        showWarmup: function() {
            var el = document.getElementById('tei-display');
            if (el) el.textContent = '--';
            var zone = document.getElementById('tei-zone-label');
            if (zone) { zone.textContent = 'SCANNING'; zone.className = 'tei-zone-label neutral'; }
            var coach = document.getElementById('coach-card');
            if (coach) coach.textContent = '\u6B63\u5728\u6821\u6E96\u611F\u6E2C\u5668...';
            applyZoneTheme('NEUTRAL');

            // Start breathing guidance rotation on coach card
            if (breathingTimer) clearInterval(breathingTimer);
            var hintIdx = 0;
            breathingTimer = setInterval(function() {
                if (!coach) return;
                hintIdx = (hintIdx + 1) % BREATHING_HINTS.length;
                coach.style.transition = 'opacity 0.3s ease';
                coach.style.opacity = '0';
                setTimeout(function() {
                    coach.textContent = BREATHING_HINTS[hintIdx];
                    coach.style.opacity = '1';
                }, 300);
            }, 5000);

            ['hr','hrv','rr'].forEach(function(id) {
                var v = document.getElementById('bento-' + id);
                if (v) v.textContent = '--';
            });
            var stressEl = document.getElementById('bento-stress');
            if (stressEl) stressEl.textContent = '--';
            updateStressBar(30);

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
            applyZoneTheme(zone);

            // TEI number - fast count up animation (RS-style 1–99)
            var teiClamped = clampTeiDisplay(tei);
            if (teiClamped !== animatedTeiTarget) {
                animatedTeiTarget = teiClamped;
                if (!teiAnimFrame) teiAnimFrame = requestAnimationFrame(animateTeiLoop);
            }

            // Heartbeat pulse sync disabled per user request
            // if (hr > 0) { ... }

            // Zone label
            var zoneEl = document.getElementById('tei-zone-label');
            if (zoneEl) {
                zoneEl.className = 'tei-zone-label ' + zone.toLowerCase();
                zoneEl.textContent = zone.charAt(0) + zone.slice(1).toLowerCase();
                zoneEl.style.color = ZONE_COLORS[zone];
            }

            // Coach card — stop breathing hints when real zone data arrives
            if (zone !== currentCoachZone) {
                currentCoachZone = zone;
                if (breathingTimer) {
                    clearInterval(breathingTimer);
                    breathingTimer = null;
                }
                var coachEl = document.getElementById('coach-card');
                if (coachEl) {
                    coachEl.style.transition = '';
                    coachEl.style.opacity = '1';
                    var msgs = COACH_MSGS[zone];
                    coachEl.textContent = msgs[Math.floor(Math.random() * msgs.length)];
                }

                // Decision summary card (health mode default)
                var advice = TRADE_ADVICE[zone];
                if (advice) {
                    var szEl = document.getElementById('rp-summary-zone');
                    if (szEl) szEl.textContent = 'TEI ' + clampTeiDisplay(tei) + ' / 99';
                    var seEl = document.getElementById('rp-summary-emoji');
                    if (seEl) seEl.textContent = advice.emoji;
                    var slEl = document.getElementById('rp-summary-label');
                    if (slEl) {
                        slEl.textContent = advice.label;
                        slEl.style.color = ZONE_COLORS[zone];
                    }
                    var stEl = document.getElementById('rp-summary-tips');
                    if (stEl) {
                        stEl.innerHTML = advice.tips.map(function(t) {
                            return '<div class="rp-summary-tip">\u2022 ' + t + '</div>';
                        }).join('');
                    }
                }
            }

            // ── Canvas TEI Ring ──
            // RS-style: PR99=99 fills ring 100%, PR99=1 fills ~1%
            currentOuterFill = Math.max(0, Math.min(1, clampTeiDisplay(tei) / 99));
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

            // Sparklines — push EWMA + physiological micro-oscillation for visual life
            // (Numeric displays above still show clean EWMA values)
            stopSparklineAnimator();
            var st = Date.now() / 1000;
            var breathCycle = Math.sin(st * 0.4 * Math.PI * 2); // ~2.5s breathing rhythm
            var heartVar = Math.sin(st * 1.2 * Math.PI * 2);    // faster heartbeat variation
            var jitter = function(scale) { return (Math.random() - 0.5) * scale; };

            if (sparklines.hr) {
                revealSparkline('hr');
                sparklines.hr.push(hr + breathCycle * 2.8 + heartVar * 1.6 + jitter(1.0));
            }
            if (sparklines.hrv) {
                revealSparkline('hrv');
                sparklines.hrv.push(hrv + breathCycle * 4.5 + heartVar * 2.2 + jitter(1.5));
            }
            if (sparklines.rr) {
                revealSparkline('rr');
                sparklines.rr.push(rr + breathCycle * 1.2 + heartVar * 0.5 + jitter(0.3));
            }

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
            if (breathingTimer) {
                clearInterval(breathingTimer);
                breathingTimer = null;
            }
            stopSparklineAnimator();
            sparklines = {};
            sparkRevealed = {};
            ringCtx = null;
            currentCoachZone = null;
            isInitialized = false;
            if (document.body) {
                document.body.removeAttribute('data-tenki-zone');
            }
        },

        pushSparkline: function(id, val) {
            if (sparklines[id]) {
                sparklines[id].push(val);
            }
        }
    };

    global.TENKI_RESULTS = RENDERER;
})(window);

