/**
 * results-renderer.js — v4.2 Results Page DOM + Stardust Nebula
 *
 * Pixel-matched to IMG_5522 design reference:
 *   ✦ DEEP SCAN · 60s badge, Garmin Forerunner + rPPG 眉心 chips,
 *   TEI dual ring (7-stop spectrum, inner green→cyan, amber endpoint),
 *   72 metallic number, zone label, coach card, 2×2 bento grid
 *   (HR/Garmin Sync pill/sparkline, HRV/Balanced pill/sparkline,
 *    Respiratory/sparkline, Stress/4-segment bar),
 *   Body Battery Go Club 12-bar + 78/100,
 *   ANS Balance (SNS 38% / PNS 62% with micro-fluctuation),
 *   FDCB dock (📊 Canslim GS ▾ | 02:18 | ✓).
 *
 * Uses spectrum.css class names to avoid v51.1 inline style conflicts.
 */
(function (global) {
    'use strict';

    // ─── Constants ───
    var OUTER_R = 120, INNER_R = 100;
    var OUTER_CIRC = 2 * Math.PI * OUTER_R;
    var INNER_CIRC = 2 * Math.PI * INNER_R;

    var ZONE_COLORS = {
        PEAK: '#F5A623', OPTIMAL: '#00B4D8',
        NEUTRAL: '#E5E5EA', DEGRADED: '#5E3A87'
    };

    var COACH_MSGS = {
        PEAK: [
            '高能量狀態，自信充沛。提醒自己：自信是好的，過度自信需要留意。',
            '當前狀態極佳。建議啟用雙重確認機制，確保決策品質。'
        ],
        OPTIMAL: [
            '保持專注，信任你的策略判斷。當前狀態適合全功能交易。',
            '理想的身心平衡。此刻的你具備清晰的判斷力。'
        ],
        NEUTRAL: [
            '中性狀態，專注力尚可。建議只選擇最高確信的機會。',
            '適度放慢節奏。等待更好的時機，也是策略的一部分。'
        ],
        DEGRADED: [
            '身體發出需要休息的訊號。暫停是智慧的選擇。',
            '啟動呼吸校準，讓身心重新對齊。這不是弱點，是自律。'
        ]
    };

    // ─── State ───
    var nebulaFrame = null;
    var stars = [];
    var sparklines = {};
    var ansFluctuateTimer = null;
    var currentCoachZone = null;

    // ─── Nebula Canvas ───
    function initStars(count) {
        stars = [];
        for (var i = 0; i < count; i++) {
            stars.push({
                x: Math.random(), y: Math.random(),
                size: 0.3 + Math.random() * 1.5,
                alpha: 0.03 + Math.random() * 0.37,
                phase: Math.random() * Math.PI * 2,
                speed: 2 + Math.random() * 3
            });
        }
    }

    var nebulaW = 430, nebulaH = 660;

    function drawNebula(canvas) {
        var ctx = canvas.getContext('2d');
        var W = nebulaW, H = nebulaH;
        var t = Date.now() / 1000;

        ctx.clearRect(0, 0, W, H);

        // Deep space base — multiple overlapping nebula clouds
        var layers = [
            // Primary cyan-blue nebula (center-top, behind TEI ring)
            { cx: W*0.5, cy: H*0.28, r: 280, color: [0,140,220], alpha: 0.18, period: 10 },
            // Green-teal nebula (left of ring)
            { cx: W*0.2, cy: H*0.35, r: 200, color: [30,180,120], alpha: 0.12, period: 13 },
            // Purple nebula (right side)
            { cx: W*0.82, cy: H*0.2, r: 180, color: [100,60,200], alpha: 0.10, period: 16 },
            // Deep blue core (behind ring center)
            { cx: W*0.48, cy: H*0.32, r: 160, color: [0,80,180], alpha: 0.15, period: 8 },
            // Warm amber accent (lower right)
            { cx: W*0.75, cy: H*0.5, r: 120, color: [200,140,40], alpha: 0.05, period: 0 },
            // Cobalt blue glow (upper left)
            { cx: W*0.1, cy: H*0.08, r: 150, color: [0,100,255], alpha: 0.08, period: 14 },
            // Secondary green wisps
            { cx: W*0.35, cy: H*0.55, r: 100, color: [40,200,100], alpha: 0.06, period: 18 }
        ];

        for (var li = 0; li < layers.length; li++) {
            var l = layers[li];
            var pulse = l.period > 0 ? 0.7 + 0.3 * Math.sin(t * (2*Math.PI/l.period)) : 1;
            var grad = ctx.createRadialGradient(l.cx, l.cy, 0, l.cx, l.cy, l.r);
            grad.addColorStop(0, 'rgba('+l.color.join(',')+','+(l.alpha*pulse)+')');
            grad.addColorStop(0.5, 'rgba('+l.color.join(',')+','+(l.alpha*pulse*0.4)+')');
            grad.addColorStop(1, 'rgba('+l.color.join(',')+',0)');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, W, H);
        }

        // Stars — brighter, more visible
        for (var si = 0; si < stars.length; si++) {
            var s = stars[si];
            var twinkle = 0.5 + 0.5 * Math.sin(t * (2*Math.PI/s.speed) + s.phase);
            ctx.beginPath();
            ctx.arc(s.x*W, s.y*H, s.size, 0, Math.PI*2);
            ctx.fillStyle = 'rgba(255,255,255,'+(s.alpha*twinkle*1.3)+')';
            ctx.fill();
        }

        nebulaFrame = requestAnimationFrame(function() { drawNebula(canvas); });
    }

    // ─── TEI Ring SVG ───
    function createRingSVG() {
        var ns = 'http://www.w3.org/2000/svg';
        var svg = document.createElementNS(ns, 'svg');
        svg.setAttribute('viewBox', '0 0 280 280');
        svg.setAttribute('class', 'tei-ring-svg');

        var defs = document.createElementNS(ns, 'defs');

        // 7-stop spectrum gradient — rotated to match ring start (-90deg = 12 o'clock)
        var outerGrad = document.createElementNS(ns, 'linearGradient');
        outerGrad.id = 'tei-outer-grad';
        outerGrad.setAttribute('gradientUnits', 'userSpaceOnUse');
        // Diagonal from top-left to bottom-right for better color distribution around the ring
        outerGrad.setAttribute('x1', '0'); outerGrad.setAttribute('y1', '0');
        outerGrad.setAttribute('x2', '280'); outerGrad.setAttribute('y2', '280');
        [[0,'#5E3A87'],[12,'#0066FF'],[25,'#00B4D8'],[40,'#34C759'],[55,'#A8D843'],
         [70,'#F5A623'],[85,'#FF6B35'],[100,'#FF453A']].forEach(function(s) {
            var stop = document.createElementNS(ns, 'stop');
            stop.setAttribute('offset', s[0]+'%');
            stop.setAttribute('stop-color', s[1]);
            outerGrad.appendChild(stop);
        });
        defs.appendChild(outerGrad);

        var innerGrad = document.createElementNS(ns, 'linearGradient');
        innerGrad.id = 'tei-inner-grad';
        innerGrad.setAttribute('gradientUnits', 'userSpaceOnUse');
        innerGrad.setAttribute('x1', '0'); innerGrad.setAttribute('y1', '140');
        innerGrad.setAttribute('x2', '280'); innerGrad.setAttribute('y2', '140');
        var is1 = document.createElementNS(ns, 'stop');
        is1.setAttribute('offset', '0%'); is1.setAttribute('stop-color', '#34C759');
        var is2 = document.createElementNS(ns, 'stop');
        is2.setAttribute('offset', '100%'); is2.setAttribute('stop-color', '#00B4D8');
        innerGrad.appendChild(is1); innerGrad.appendChild(is2);
        defs.appendChild(innerGrad);
        svg.appendChild(defs);

        // Background tracks
        var CX = '140', CY = '140';
        var obg = document.createElementNS(ns, 'circle');
        obg.setAttribute('cx', CX); obg.setAttribute('cy', CY);
        obg.setAttribute('r', String(OUTER_R));
        obg.setAttribute('fill','none'); obg.setAttribute('stroke','rgba(255,255,255,0.06)');
        obg.setAttribute('stroke-width','16');
        svg.appendChild(obg);

        var ibg = document.createElementNS(ns, 'circle');
        ibg.setAttribute('cx', CX); ibg.setAttribute('cy', CY);
        ibg.setAttribute('r', String(INNER_R));
        ibg.setAttribute('fill','none'); ibg.setAttribute('stroke','rgba(255,255,255,0.04)');
        ibg.setAttribute('stroke-width','10');
        svg.appendChild(ibg);

        // Active rings
        var outer = document.createElementNS(ns, 'circle');
        outer.setAttribute('cx', CX); outer.setAttribute('cy', CY);
        outer.setAttribute('r', String(OUTER_R));
        outer.setAttribute('class','tei-outer-ring');
        outer.setAttribute('stroke','url(#tei-outer-grad)');
        outer.setAttribute('stroke-dasharray', String(OUTER_CIRC));
        outer.setAttribute('stroke-dashoffset', String(OUTER_CIRC));
        outer.id = 'tei-outer-ring';
        svg.appendChild(outer);

        var inner = document.createElementNS(ns, 'circle');
        inner.setAttribute('cx', CX); inner.setAttribute('cy', CY);
        inner.setAttribute('r', String(INNER_R));
        inner.setAttribute('class','tei-inner-ring');
        inner.setAttribute('stroke','url(#tei-inner-grad)');
        inner.setAttribute('stroke-dasharray', String(INNER_CIRC));
        inner.setAttribute('stroke-dashoffset', String(INNER_CIRC));
        inner.id = 'tei-inner-ring';
        svg.appendChild(inner);

        // Endpoint dot
        var ep = document.createElementNS(ns, 'circle');
        ep.setAttribute('r','7'); ep.setAttribute('fill','#F5A623');
        ep.setAttribute('class','tei-endpoint'); ep.id = 'tei-endpoint';
        ep.setAttribute('cx', CX); ep.setAttribute('cy', String(140 - OUTER_R));
        svg.appendChild(ep);

        return svg;
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

        // Content wrapper
        var wrap = document.createElement('div');
        wrap.className = 'results-content';

        // Close button
        var closeBtn = document.createElement('button');
        closeBtn.className = 'results-close-btn';
        closeBtn.id = 'results-close-btn';
        closeBtn.textContent = '\u00D7';
        container.appendChild(closeBtn);

        // Nebula canvas — dimensions set properly in init()
        var nebula = document.createElement('canvas');
        nebula.id = 'tenki-nebula-canvas';
        wrap.appendChild(nebula);

        // Scan badge
        var badge = document.createElement('div');
        badge.className = 'scan-badge'; badge.id = 'scan-badge';
        var badgePill = document.createElement('span');
        badgePill.className = 'scan-badge-pill'; badgePill.id = 'scan-badge-pill';
        badgePill.textContent = '\u2726 SCANNING';
        badge.appendChild(badgePill);
        wrap.appendChild(badge);

        // Source strip — Garmin Forerunner (active) + rPPG 眉心 (grey)
        var srcStrip = document.createElement('div');
        srcStrip.className = 'source-strip';
        srcStrip.innerHTML =
            '<span class="source-chip active" id="src-garmin">' +
            '<span class="source-chip-icon">\u{2316}</span>Garmin Forerunner</span>' +
            '<span class="source-chip" id="src-rppg">' +
            '<span class="source-chip-icon">\u{1F4F7}</span>rPPG \u7709\u5FC3</span>';
        wrap.appendChild(srcStrip);

        // TEI Ring Section
        var ringSection = document.createElement('div');
        ringSection.className = 'tei-ring-section';

        var ringContainer = document.createElement('div');
        ringContainer.className = 'tei-ring-container';
        ringContainer.id = 'tei-ring-container';
        ringContainer.appendChild(createRingSVG());

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
        zoneLabel.textContent = 'Optimal';
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

        // Card 1: Heart Rate
        var hrCard = document.createElement('div');
        hrCard.className = 'results-bento-card';
        hrCard.innerHTML =
            '<div class="results-bento-label">Heart Rate</div>' +
            '<div class="results-bento-row">' +
            '  <div><span class="results-bento-value" id="bento-hr">--</span>' +
            '  <span class="results-bento-unit">BPM</span></div>' +
            '  <span class="results-bento-pill garmin">Garmin Sync</span>' +
            '</div>' +
            '<canvas class="results-bento-sparkline" id="spark-hr"></canvas>';
        grid.appendChild(hrCard);

        // Card 2: HRV
        var hrvCard = document.createElement('div');
        hrvCard.className = 'results-bento-card';
        hrvCard.innerHTML =
            '<div class="results-bento-label">HRV</div>' +
            '<div class="results-bento-row">' +
            '  <div><span class="results-bento-value" id="bento-hrv">--</span>' +
            '  <span class="results-bento-unit"><sup>ms</sup> RMSSD</span></div>' +
            '  <span class="results-bento-pill balanced">Balanced</span>' +
            '</div>' +
            '<canvas class="results-bento-sparkline" id="spark-hrv"></canvas>';
        grid.appendChild(hrvCard);

        // Card 3: Respiratory
        var rrCard = document.createElement('div');
        rrCard.className = 'results-bento-card';
        rrCard.innerHTML =
            '<div class="results-bento-label">Respiratory</div>' +
            '<div class="results-bento-row">' +
            '  <div><span class="results-bento-value" id="bento-rr">--</span>' +
            '  <span class="results-bento-unit">BrPM</span></div>' +
            '</div>' +
            '<canvas class="results-bento-sparkline" id="spark-rr"></canvas>';
        grid.appendChild(rrCard);

        // Card 4: Stress — 4-segment bar
        var stressCard = document.createElement('div');
        stressCard.className = 'results-bento-card';
        stressCard.innerHTML =
            '<div class="results-bento-label">Stress</div>' +
            '<div class="results-bento-row">' +
            '  <div><span class="results-bento-value" id="bento-stress">--</span>' +
            '  <span class="results-bento-unit">/100</span></div>' +
            '  <span class="stress-pct" id="stress-pct"></span>' +
            '</div>' +
            '<div class="stress-segments" id="stress-segments">' +
            '  <div class="stress-seg" data-seg="0"><div class="stress-seg-fill"></div></div>' +
            '  <div class="stress-seg" data-seg="1"><div class="stress-seg-fill"></div></div>' +
            '  <div class="stress-seg" data-seg="2"><div class="stress-seg-fill"></div></div>' +
            '  <div class="stress-seg" data-seg="3"><div class="stress-seg-fill"></div></div>' +
            '</div>';
        grid.appendChild(stressCard);

        wrap.appendChild(grid);

        // Body Battery Go Club
        var bbCard = document.createElement('div');
        bbCard.className = 'results-glass-card';
        bbCard.innerHTML =
            '<div class="results-card-title">Body Battery Card</div>' +
            '<div class="bb-row">' +
            '  <div class="bb-chart" id="bb-chart"></div>' +
            '  <div class="bb-value-display">' +
            '    <div class="bb-value-number" id="bb-value">78</div>' +
            '    <div class="bb-value-total">/100</div>' +
            '  </div>' +
            '</div>';
        wrap.appendChild(bbCard);

        // ANS Balance
        var ansCard = document.createElement('div');
        ansCard.className = 'results-glass-card';
        ansCard.innerHTML =
            '<div class="results-card-title">ANS Balance</div>' +
            '<div class="ans-bar-outer">' +
            '  <div class="ans-sns-bar" id="ans-sns" style="width:38%"></div>' +
            '  <div class="ans-divider-line" id="ans-divider" style="left:38%"></div>' +
            '  <div class="ans-pns-bar" id="ans-pns" style="width:62%"></div>' +
            '</div>' +
            '<div class="ans-labels">' +
            '  <span><span id="ans-sns-pct">38</span>%&nbsp;&nbsp;&nbsp;SNS</span>' +
            '  <span>PNS&nbsp;&nbsp;&nbsp;<span id="ans-pns-pct">62</span>%</span>' +
            '</div>';
        wrap.appendChild(ansCard);

        container.appendChild(wrap);

        // FDCB dock (outside wrapper, fixed to bottom)
        var dock = document.createElement('div');
        dock.className = 'fdcb-dock'; dock.id = 'fdcb-dock';
        dock.innerHTML =
            '<div class="fdcb-template" id="fdcb-template-name">\uD83D\uDCCA Canslim GS \u25BE</div>' +
            '<div style="text-align:center">' +
            '  <div class="fdcb-timer" id="fdcb-timer">02:18</div>' +
            '  <div class="fdcb-progress"><div class="fdcb-progress-fill" id="fdcb-progress-fill" style="width:0%"></div></div>' +
            '</div>' +
            '<button class="fdcb-confirm" id="fdcb-confirm">\u2713</button>';
        container.appendChild(dock);
    }

    // ─── Init Sparklines ───
    function initSparklines() {
        sparklines = {};
        var colors = { hr:'#FF453A', hrv:'#00B4D8', rr:'#34C759' };
        ['hr','hrv','rr'].forEach(function(id) {
            var el = document.getElementById('spark-' + id);
            if (el && global.TENKI_Sparkline) {
                sparklines[id] = new global.TENKI_Sparkline(el, {
                    color: colors[id], maxPoints: 40
                });
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

    // ─── Update Stress 4-Segment Bar ───
    function updateStressBar(stress) {
        var segs = document.querySelectorAll('.stress-seg-fill');
        if (!segs || segs.length < 4) return;
        // 0-25: seg0 full, 26-50: seg0+seg1, 51-75: seg0+1+2, 76-100: all
        for (var i = 0; i < 4; i++) {
            var segMin = i * 25;
            var segMax = (i + 1) * 25;
            if (stress >= segMax) {
                segs[i].style.width = '100%';
            } else if (stress > segMin) {
                segs[i].style.width = ((stress - segMin) / 25 * 100) + '%';
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
            var jitter = (Math.random() - 0.5) * 4; // ±2%
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
    var RENDERER = {
        init: function() {
            var container = document.getElementById('results-page');
            if (!container) return;

            buildDOM(container);

            initStars(90);
            var canvas = document.getElementById('tenki-nebula-canvas');
            if (canvas) {
                var dpr = Math.min(window.devicePixelRatio || 1, 2);
                nebulaW = Math.min(window.innerWidth, 430);
                nebulaH = 660;
                canvas.width = nebulaW * dpr;
                canvas.height = nebulaH * dpr;
                canvas.style.width = nebulaW + 'px';
                canvas.style.height = nebulaH + 'px';
                canvas.getContext('2d').scale(dpr, dpr);
                drawNebula(canvas);
            }

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

            // Coach card — only update on zone change to avoid flicker
            if (zone !== currentCoachZone) {
                currentCoachZone = zone;
                var coachEl = document.getElementById('coach-card');
                if (coachEl) {
                    var msgs = COACH_MSGS[zone];
                    coachEl.textContent = msgs[Math.floor(Math.random() * msgs.length)];
                }
            }

            // Ring update
            var outerRing = document.getElementById('tei-outer-ring');
            var innerRing = document.getElementById('tei-inner-ring');
            var endpoint = document.getElementById('tei-endpoint');
            if (outerRing) {
                var outerFill = tei / 100;
                outerRing.setAttribute('stroke-dashoffset', String(OUTER_CIRC * (1 - outerFill)));

                var innerFill = Math.min(hrv / 80, 1);
                if (innerRing) innerRing.setAttribute('stroke-dashoffset', String(INNER_CIRC * (1 - innerFill)));

                if (endpoint) {
                    var angle = -Math.PI/2 + outerFill * 2 * Math.PI;
                    endpoint.setAttribute('cx', String(140 + OUTER_R * Math.cos(angle)));
                    endpoint.setAttribute('cy', String(140 + OUTER_R * Math.sin(angle)));
                }
            }

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

            // Stress 4-segment bar
            updateStressBar(stress);

            // ANS balance (from scan-ux EWMA)
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

            // TEI sub label
            var subEl = document.querySelector('.tei-sub');
            if (subEl) {
                var pr = tei >= 80 ? 99 : tei >= 55 ? 75 : tei >= 35 ? 50 : 25;
                subEl.textContent = 'TEI \u00B7 PR' + pr;
            }
        },

        updateBadge: function(phase, elapsed) {
            var el = document.getElementById('scan-badge-pill');
            if (!el) return;
            if (phase < 5) {
                el.textContent = '\u2726 SCANNING \u00B7 ' + elapsed + 's';
            }
        },

        updatePhaseDots: function() { /* phase dots removed per screenshot */ },

        showComplete: function(ewma) {
            var badge = document.getElementById('scan-badge-pill');
            if (badge) badge.textContent = '\u2726 DEEP SCAN \u00B7 60s';

            // Glow pulse on ring
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
            currentCoachZone = null;
        }
    };

    global.TENKI_RESULTS = RENDERER;
})(window);
