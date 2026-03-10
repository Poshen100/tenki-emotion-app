/**
 * results-renderer.js — v4.2 Results Page DOM + Stardust Nebula
 *
 * Creates complete results UI:
 *   TEI dual ring, metallic number, zone pill, coach card,
 *   bento grid (HR/HRV/RR/Stress), Go Club body battery,
 *   ANS balance, signal quality, phase dots, FDCB dock.
 *
 * All DOM built dynamically. Integrates with scan-ux.js for live updates.
 */
(function (global) {
    'use strict';

    // ─── Constants ───
    var OUTER_R = 102, INNER_R = 80;
    var OUTER_CIRC = 2 * Math.PI * OUTER_R;
    var INNER_CIRC = 2 * Math.PI * INNER_R;

    var ZONE_COLORS = {
        PEAK: '#F5A623', OPTIMAL: '#00B4D8',
        NEUTRAL: '#E5E5EA', DEGRADED: '#5E3A87'
    };

    var ZONE_LABELS = {
        PEAK:     '🔥 Peak Zone — 巔峰表現區',
        OPTIMAL:  '✅ Optimal Zone — 理想執行區',
        NEUTRAL:  '🔄 Neutral Zone — 一般狀態區',
        DEGRADED: '🌙 Rest Zone — 建議休息區'
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

    var PHASE_NAMES = ['WARMUP', 'GLIMPSE', 'QUICK', 'STANDARD', 'DEEP'];

    // ─── State ───
    var nebulaFrame = null;
    var stars = [];
    var sparklines = {};

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

    function drawNebula(canvas) {
        var ctx = canvas.getContext('2d');
        var W = canvas.width, H = canvas.height;
        var t = Date.now() / 1000;

        ctx.clearRect(0, 0, W, H);

        var layers = [
            { cx: W/2, cy: 80, r: 200, color: [0,180,216], alpha: 0.06, period: 8 },
            { cx: W*0.15, cy: 200, r: 140, color: [52,199,89], alpha: 0.025, period: 11 },
            { cx: W*0.85, cy: 50, r: 100, color: [245,166,35], alpha: 0.02, period: 0 },
            { cx: W*0.08, cy: 30, r: 120, color: [0,122,255], alpha: 0.035, period: 14 }
        ];

        for (var li = 0; li < layers.length; li++) {
            var l = layers[li];
            var pulse = l.period > 0 ? 0.7 + 0.3 * Math.sin(t * (2*Math.PI/l.period)) : 1;
            var grad = ctx.createRadialGradient(l.cx, l.cy, 0, l.cx, l.cy, l.r);
            grad.addColorStop(0, 'rgba('+l.color.join(',')+','+(l.alpha*pulse)+')');
            grad.addColorStop(1, 'rgba('+l.color.join(',')+',0)');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, W, H);
        }

        for (var si = 0; si < stars.length; si++) {
            var s = stars[si];
            var twinkle = 0.5 + 0.5 * Math.sin(t * (2*Math.PI/s.speed) + s.phase);
            ctx.beginPath();
            ctx.arc(s.x*W, s.y*H, s.size, 0, Math.PI*2);
            ctx.fillStyle = 'rgba(255,255,255,'+(s.alpha*twinkle)+')';
            ctx.fill();
        }

        nebulaFrame = requestAnimationFrame(function() { drawNebula(canvas); });
    }

    // ─── TEI Ring SVG ───
    function createRingSVG() {
        var ns = 'http://www.w3.org/2000/svg';
        var svg = document.createElementNS(ns, 'svg');
        svg.setAttribute('viewBox', '0 0 240 240');
        svg.setAttribute('class', 'tei-ring-svg');

        var defs = document.createElementNS(ns, 'defs');

        // 7-stop spectrum gradient
        var outerGrad = document.createElementNS(ns, 'linearGradient');
        outerGrad.id = 'tei-outer-grad';
        [[0,'#5E3A87'],[15,'#00B4D8'],[30,'#34C759'],[50,'#A8D843'],
         [65,'#F5A623'],[80,'#FF6B35'],[100,'#FF453A']].forEach(function(s) {
            var stop = document.createElementNS(ns, 'stop');
            stop.setAttribute('offset', s[0]+'%');
            stop.setAttribute('stop-color', s[1]);
            outerGrad.appendChild(stop);
        });
        defs.appendChild(outerGrad);

        var innerGrad = document.createElementNS(ns, 'linearGradient');
        innerGrad.id = 'tei-inner-grad';
        var is1 = document.createElementNS(ns, 'stop');
        is1.setAttribute('offset', '0%'); is1.setAttribute('stop-color', '#34C759');
        var is2 = document.createElementNS(ns, 'stop');
        is2.setAttribute('offset', '100%'); is2.setAttribute('stop-color', '#00B4D8');
        innerGrad.appendChild(is1); innerGrad.appendChild(is2);
        defs.appendChild(innerGrad);
        svg.appendChild(defs);

        // Background tracks
        var obg = document.createElementNS(ns, 'circle');
        obg.setAttribute('cx','120'); obg.setAttribute('cy','120');
        obg.setAttribute('r', String(OUTER_R));
        obg.setAttribute('fill','none'); obg.setAttribute('stroke','rgba(255,255,255,0.05)');
        obg.setAttribute('stroke-width','6');
        svg.appendChild(obg);

        var ibg = document.createElementNS(ns, 'circle');
        ibg.setAttribute('cx','120'); ibg.setAttribute('cy','120');
        ibg.setAttribute('r', String(INNER_R));
        ibg.setAttribute('fill','none'); ibg.setAttribute('stroke','rgba(255,255,255,0.03)');
        ibg.setAttribute('stroke-width','4');
        svg.appendChild(ibg);

        // Active rings
        var outer = document.createElementNS(ns, 'circle');
        outer.setAttribute('cx','120'); outer.setAttribute('cy','120');
        outer.setAttribute('r', String(OUTER_R));
        outer.setAttribute('class','tei-outer-ring');
        outer.setAttribute('stroke','url(#tei-outer-grad)');
        outer.setAttribute('stroke-dasharray', String(OUTER_CIRC));
        outer.setAttribute('stroke-dashoffset', String(OUTER_CIRC));
        outer.id = 'tei-outer-ring';
        svg.appendChild(outer);

        var inner = document.createElementNS(ns, 'circle');
        inner.setAttribute('cx','120'); inner.setAttribute('cy','120');
        inner.setAttribute('r', String(INNER_R));
        inner.setAttribute('class','tei-inner-ring');
        inner.setAttribute('stroke','url(#tei-inner-grad)');
        inner.setAttribute('stroke-dasharray', String(INNER_CIRC));
        inner.setAttribute('stroke-dashoffset', String(INNER_CIRC));
        inner.id = 'tei-inner-ring';
        svg.appendChild(inner);

        // Endpoint dot
        var ep = document.createElementNS(ns, 'circle');
        ep.setAttribute('r','5'); ep.setAttribute('fill','#F5A623');
        ep.setAttribute('class','tei-endpoint'); ep.id = 'tei-endpoint';
        ep.setAttribute('cx','120'); ep.setAttribute('cy', String(120 - OUTER_R));
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

    function stressLevel(val) {
        if (val <= 25) return 'rest';
        if (val <= 50) return 'low';
        if (val <= 75) return 'medium';
        return 'high';
    }

    // ─── Build DOM ───
    function buildDOM(container) {
        container.innerHTML = '';

        // Nebula canvas
        var nebula = document.createElement('canvas');
        nebula.id = 'tenki-nebula-canvas';
        nebula.width = 430; nebula.height = 560;
        container.appendChild(nebula);

        // Scan badge
        var badge = document.createElement('div');
        badge.className = 'scan-badge'; badge.id = 'scan-badge';
        badge.textContent = ''; container.appendChild(badge);

        // Source strip
        var srcStrip = document.createElement('div');
        srcStrip.className = 'source-strip';
        srcStrip.innerHTML =
            '<span class="source-chip active" id="src-rppg">rPPG Face</span>' +
            '<span class="source-chip" id="src-garmin">Garmin 265</span>';
        container.appendChild(srcStrip);

        // Phase dots
        var dots = document.createElement('div');
        dots.className = 'phase-dots'; dots.id = 'phase-dots';
        for (var d = 0; d < 5; d++) {
            var dot = document.createElement('div');
            dot.className = 'phase-dot'; dot.dataset.phase = String(d);
            dots.appendChild(dot);
        }
        container.appendChild(dots);

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
        zoneLabel.textContent = 'SCANNING';
        numCont.appendChild(zoneLabel);

        ringContainer.appendChild(numCont);
        ringSection.appendChild(ringContainer);
        container.appendChild(ringSection);

        // Zone pill
        var pill = document.createElement('div');
        pill.className = 'zone-pill'; pill.id = 'zone-pill';
        pill.textContent = '';
        container.appendChild(pill);

        // Coach card
        var coach = document.createElement('div');
        coach.className = 'coach-card'; coach.id = 'coach-card';
        coach.textContent = '';
        container.appendChild(coach);

        // Bento grid
        var grid = document.createElement('div');
        grid.className = 'bento-grid';

        var metrics = [
            { id:'hr', label:'HEART RATE', unit:'BPM', color:'#FF453A' },
            { id:'hrv', label:'HRV RMSSD', unit:'ms', color:'#00B4D8' },
            { id:'rr', label:'RESP RATE', unit:'BrPM', color:'#34C759' },
            { id:'stress', label:'STRESS', unit:'', color:'#F5A623' }
        ];

        metrics.forEach(function(m) {
            var card = document.createElement('div');
            card.className = 'bento-card';

            var lbl = document.createElement('div');
            lbl.className = 'bento-label'; lbl.textContent = m.label;
            card.appendChild(lbl);

            var valRow = document.createElement('div');
            var val = document.createElement('span');
            val.className = 'bento-value'; val.id = 'bento-' + m.id;
            val.textContent = '--';
            valRow.appendChild(val);

            if (m.unit) {
                var unit = document.createElement('span');
                unit.className = 'bento-unit'; unit.textContent = m.unit;
                valRow.appendChild(unit);
            }
            card.appendChild(valRow);

            if (m.id === 'stress') {
                // Stress bar instead of sparkline
                var stressContainer = document.createElement('div');
                stressContainer.className = 'stress-bar-container';

                var track = document.createElement('div');
                track.className = 'stress-track';

                var fill = document.createElement('div');
                fill.className = 'stress-fill'; fill.id = 'stress-fill';
                fill.style.width = '0%';
                track.appendChild(fill);

                var indicator = document.createElement('div');
                indicator.className = 'stress-indicator'; indicator.id = 'stress-indicator';
                indicator.style.left = '0%';
                track.appendChild(indicator);

                stressContainer.appendChild(track);

                var ticks = document.createElement('div');
                ticks.className = 'stress-ticks';
                ticks.innerHTML = '<span>0</span><span>25</span><span>50</span><span>75</span><span>100</span>';
                stressContainer.appendChild(ticks);

                card.appendChild(stressContainer);
            } else {
                var spark = document.createElement('canvas');
                spark.className = 'bento-sparkline'; spark.id = 'spark-' + m.id;
                card.appendChild(spark);
            }

            grid.appendChild(card);
        });
        container.appendChild(grid);

        // Body Battery Go Club
        var bbCard = document.createElement('div');
        bbCard.className = 'glass-card';
        var bbTitle = document.createElement('div');
        bbTitle.className = 'bento-label';
        bbTitle.textContent = 'BODY BATTERY \u00B7 24H';
        bbCard.appendChild(bbTitle);

        var bbChart = document.createElement('div');
        bbChart.className = 'bb-chart'; bbChart.id = 'bb-chart';
        bbCard.appendChild(bbChart);

        var bbLbl = document.createElement('div');
        bbLbl.className = 'bb-label';
        bbLbl.textContent = '12h ago \u2192 Now';
        bbCard.appendChild(bbLbl);
        container.appendChild(bbCard);

        // ANS Balance
        var ansCard = document.createElement('div');
        ansCard.className = 'glass-card';
        var ansTitle = document.createElement('div');
        ansTitle.className = 'bento-label';
        ansTitle.textContent = 'ANS BALANCE';
        ansCard.appendChild(ansTitle);

        var ansBar = document.createElement('div');
        ansBar.className = 'ans-bar-container';

        var ansSns = document.createElement('div');
        ansSns.className = 'ans-sns'; ansSns.id = 'ans-sns';
        ansSns.style.width = '45%';
        ansBar.appendChild(ansSns);

        var ansDivider = document.createElement('div');
        ansDivider.className = 'ans-divider'; ansDivider.id = 'ans-divider';
        ansDivider.style.left = '45%';
        ansBar.appendChild(ansDivider);

        var ansPns = document.createElement('div');
        ansPns.className = 'ans-pns'; ansPns.id = 'ans-pns';
        ansPns.style.width = '55%';
        ansBar.appendChild(ansPns);

        ansCard.appendChild(ansBar);

        var ansLabels = document.createElement('div');
        ansLabels.className = 'ans-labels';
        ansLabels.innerHTML =
            '<span>SNS <span id="ans-sns-pct">45</span>% (warm)</span>' +
            '<span>PNS <span id="ans-pns-pct">55</span>% (cool)</span>';
        ansCard.appendChild(ansLabels);
        container.appendChild(ansCard);

        // Signal quality
        var sqSection = document.createElement('div');
        sqSection.className = 'signal-quality'; sqSection.id = 'signal-quality';
        sqSection.innerHTML =
            '<span class="sqi-chip" id="sqi-grade">SQI --</span>' +
            '<span class="sqi-chip" id="sqi-fusion">Fusion: face</span>';
        container.appendChild(sqSection);

        // FDCB dock
        var dock = document.createElement('div');
        dock.className = 'fdcb-dock'; dock.id = 'fdcb-dock';
        dock.innerHTML =
            '<div class="fdcb-template" id="fdcb-template-name">\uD83D\uDCCA Canslim GS \u25BE</div>' +
            '<div style="text-align:center">' +
            '  <div class="fdcb-timer" id="fdcb-timer">05:00</div>' +
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

            var opacity = 0.2 + (i / 12) * 0.55;
            if (i === data.length - 1) opacity = 1;
            bar.style.opacity = String(opacity);

            if (i === data.length - 1) {
                bar.style.boxShadow = '0 0 8px ' + colors[0];
            }

            chart.appendChild(bar);

            setTimeout(function() { bar.classList.add('animate'); }, 1200 + i * 80);
        });
    }

    // ─── Public API ───
    var RENDERER = {
        init: function() {
            var container = document.getElementById('results-page');
            if (!container) return;

            buildDOM(container);

            initStars(60);
            var canvas = document.getElementById('tenki-nebula-canvas');
            if (canvas) {
                canvas.width = Math.min(window.innerWidth, 430);
                drawNebula(canvas);
            }

            initSparklines();
        },

        /** Show warmup state: "--" numbers, calibrating hint */
        showWarmup: function() {
            var el = document.getElementById('tei-display');
            if (el) el.textContent = '--';
            var zone = document.getElementById('tei-zone-label');
            if (zone) { zone.textContent = 'SCANNING'; zone.className = 'tei-zone-label neutral'; }
            var pill = document.getElementById('zone-pill');
            if (pill) pill.textContent = '';
            var coach = document.getElementById('coach-card');
            if (coach) coach.textContent = '正在校準感測器...';

            // Set all bento values to --
            ['hr','hrv','rr','stress'].forEach(function(id) {
                var v = document.getElementById('bento-' + id);
                if (v) v.textContent = '--';
            });
        },

        /** Update all metrics from scan-ux.js EWMA values */
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
                zoneEl.textContent = zone;
                zoneEl.style.color = ZONE_COLORS[zone];
            }

            // Zone pill
            var pillEl = document.getElementById('zone-pill');
            if (pillEl) {
                pillEl.textContent = ZONE_LABELS[zone];
                pillEl.style.borderColor = ZONE_COLORS[zone] + '40';
            }

            // Coach card
            var coachEl = document.getElementById('coach-card');
            if (coachEl) {
                var msgs = COACH_MSGS[zone];
                coachEl.textContent = msgs[Math.floor(Math.random() * msgs.length)];
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
                    endpoint.setAttribute('cx', String(120 + OUTER_R * Math.cos(angle)));
                    endpoint.setAttribute('cy', String(120 + OUTER_R * Math.sin(angle)));
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

            // Stress bar
            var stressFill = document.getElementById('stress-fill');
            var stressInd = document.getElementById('stress-indicator');
            if (stressFill) {
                stressFill.style.width = stress + '%';
                var lvl = stressLevel(stress);
                stressFill.setAttribute('data-level', lvl);
            }
            if (stressInd) stressInd.style.left = stress + '%';

            // ANS balance
            var snsPct = ans ? ans.sns : 50;
            var pnsPct = ans ? ans.pns : 50;
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

            // SQI
            var sqiEl = document.getElementById('sqi-grade');
            if (sqiEl) {
                var sqi = Math.round(ewma.sqi || 0);
                var grade = sqi > 85 ? 'A' : sqi > 70 ? 'B' : sqi > 50 ? 'C' : 'D';
                sqiEl.textContent = 'SQI ' + grade + ' (' + sqi + ')';
            }
        },

        /** Update scan badge text */
        updateBadge: function(phase, elapsed) {
            var el = document.getElementById('scan-badge');
            if (!el) return;
            if (phase < 5) {
                el.textContent = '\u2726 SCANNING \u00B7 ' + elapsed + 's';
            }
        },

        /** Update phase dots */
        updatePhaseDots: function(phase) {
            var dots = document.querySelectorAll('.phase-dot');
            dots.forEach(function(dot) {
                var p = parseInt(dot.dataset.phase, 10);
                dot.className = 'phase-dot';
                if (p < phase) dot.classList.add('done');
                else if (p === phase) dot.classList.add('active');
            });
        },

        /** Show completion state */
        showComplete: function(ewma) {
            var badge = document.getElementById('scan-badge');
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

            // All phase dots done
            var dots = document.querySelectorAll('.phase-dot');
            dots.forEach(function(dot) { dot.className = 'phase-dot done'; });
        },

        destroy: function() {
            if (nebulaFrame) {
                cancelAnimationFrame(nebulaFrame);
                nebulaFrame = null;
            }
            sparklines = {};
        }
    };

    global.TENKI_RESULTS = RENDERER;
})(window);
