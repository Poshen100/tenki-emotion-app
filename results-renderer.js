/**
 * results-renderer.js — v4.2 Results Page DOM + Stardust Nebula Canvas
 * Creates the complete results UI: TEI ring, bento cards, Go Club, ANS, FDCB dock.
 * Integrates with EventBridge for live data updates.
 */
(function (global) {
    'use strict';

    // ─── Constants ───
    var OUTER_R = 102;
    var INNER_R = 80;
    var OUTER_CIRC = 2 * Math.PI * OUTER_R;
    var INNER_CIRC = 2 * Math.PI * INNER_R;
    var EWMA_ALPHA = 0.05;

    // TEI Zone colors
    var ZONE_COLORS = {
        PEAK: '#F5A623',
        OPTIMAL: '#00B4D8',
        NEUTRAL: '#E5E5EA',
        DEGRADED: '#5E3A87'
    };

    var COACH_MESSAGES = {
        PEAK: '\u9AD8\u80FD\u91CF\u72C0\u614B\uFF0C\u81EA\u4FE1\u5145\u6C9B\u3002\u63D0\u9192\u81EA\u5DF1\uFF1A\u81EA\u4FE1\u662F\u597D\u7684\uFF0C\u904E\u5EA6\u81EA\u4FE1\u9700\u8981\u7559\u610F\u3002',
        OPTIMAL: '\u4FDD\u6301\u5C08\u6CE8\uFF0C\u4FE1\u4EFB\u4F60\u7684\u7B56\u7565\u5224\u65B7\u3002\u7576\u524D\u72C0\u614B\u9069\u5408\u5168\u529F\u80FD\u4EA4\u6613\u3002',
        NEUTRAL: '\u4E2D\u6027\u72C0\u614B\uFF0C\u5C08\u6CE8\u529B\u5C1A\u53EF\u3002\u5EFA\u8B70\u53EA\u9078\u64C7\u6700\u9AD8\u78BA\u4FE1\u7684\u6A5F\u6703\u3002',
        DEGRADED: '\u8EAB\u9AD4\u767C\u51FA\u9700\u8981\u4F11\u606F\u7684\u8A0A\u865F\u3002\u66AB\u505C\u662F\u667A\u6167\u7684\u9078\u64C7\u3002'
    };

    // ─── EWMA Helper ───
    function ewma(prev, curr) {
        if (prev === null) return curr;
        return prev * (1 - EWMA_ALPHA) + curr * EWMA_ALPHA;
    }

    // ─── State ───
    var state = {
        tei: null,
        hr: null,
        hrv: null,
        rr: null,
        stress: null,
        sns: 45,
        pns: 55,
        zone: 'NEUTRAL',
        sparklines: {}
    };

    // ─── Nebula Canvas ───
    var nebulaFrame = null;
    var stars = [];

    function initStars(count) {
        stars = [];
        for (var i = 0; i < count; i++) {
            stars.push({
                x: Math.random(),
                y: Math.random(),
                size: 0.3 + Math.random() * 1.5,
                alpha: 0.03 + Math.random() * 0.37,
                phase: Math.random() * Math.PI * 2,
                speed: 2 + Math.random() * 3
            });
        }
    }

    function drawNebula(canvas) {
        var ctx = canvas.getContext('2d');
        var W = canvas.width;
        var H = canvas.height;
        var t = Date.now() / 1000;

        ctx.clearRect(0, 0, W, H);

        // 4 nebula layers
        var layers = [
            { cx: W / 2, cy: 80, r: 200, color: [0, 180, 216], alpha: 0.06, period: 8 },
            { cx: W * 0.15, cy: 200, r: 140, color: [52, 199, 89], alpha: 0.025, period: 11 },
            { cx: W * 0.85, cy: 50, r: 100, color: [245, 166, 35], alpha: 0.02, period: 0 },
            { cx: W * 0.08, cy: 30, r: 120, color: [0, 122, 255], alpha: 0.035, period: 14 }
        ];

        layers.forEach(function (l) {
            var pulse = l.period > 0 ? 0.7 + 0.3 * Math.sin(t * (2 * Math.PI / l.period)) : 1;
            var a = l.alpha * pulse;
            var grad = ctx.createRadialGradient(l.cx, l.cy, 0, l.cx, l.cy, l.r);
            grad.addColorStop(0, 'rgba(' + l.color.join(',') + ',' + a + ')');
            grad.addColorStop(1, 'rgba(' + l.color.join(',') + ',0)');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, W, H);
        });

        // 60 twinkling stars
        stars.forEach(function (s) {
            var twinkle = 0.5 + 0.5 * Math.sin(t * (2 * Math.PI / s.speed) + s.phase);
            var a = s.alpha * twinkle;
            ctx.beginPath();
            ctx.arc(s.x * W, s.y * H, s.size, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255,255,255,' + a + ')';
            ctx.fill();
        });

        nebulaFrame = requestAnimationFrame(function () { drawNebula(canvas); });
    }

    // ─── TEI Ring SVG ───
    function createRingSVG() {
        var ns = 'http://www.w3.org/2000/svg';
        var svg = document.createElementNS(ns, 'svg');
        svg.setAttribute('viewBox', '0 0 240 240');
        svg.setAttribute('class', 'tei-ring-svg');

        // Gradient for outer ring (7-stop spectrum)
        var defs = document.createElementNS(ns, 'defs');

        var outerGrad = document.createElementNS(ns, 'linearGradient');
        outerGrad.id = 'tei-outer-grad';
        var stops = [
            [0, '#5E3A87'], [15, '#00B4D8'], [30, '#34C759'],
            [50, '#A8D843'], [65, '#F5A623'], [80, '#FF6B35'], [100, '#FF453A']
        ];
        stops.forEach(function (s) {
            var stop = document.createElementNS(ns, 'stop');
            stop.setAttribute('offset', s[0] + '%');
            stop.setAttribute('stop-color', s[1]);
            outerGrad.appendChild(stop);
        });
        defs.appendChild(outerGrad);

        var innerGrad = document.createElementNS(ns, 'linearGradient');
        innerGrad.id = 'tei-inner-grad';
        var iStop1 = document.createElementNS(ns, 'stop');
        iStop1.setAttribute('offset', '0%');
        iStop1.setAttribute('stop-color', '#34C759');
        var iStop2 = document.createElementNS(ns, 'stop');
        iStop2.setAttribute('offset', '100%');
        iStop2.setAttribute('stop-color', '#00B4D8');
        innerGrad.appendChild(iStop1);
        innerGrad.appendChild(iStop2);
        defs.appendChild(innerGrad);

        svg.appendChild(defs);

        // Background tracks
        var outerBg = document.createElementNS(ns, 'circle');
        outerBg.setAttribute('cx', '120');
        outerBg.setAttribute('cy', '120');
        outerBg.setAttribute('r', String(OUTER_R));
        outerBg.setAttribute('fill', 'none');
        outerBg.setAttribute('stroke', 'rgba(255,255,255,0.05)');
        outerBg.setAttribute('stroke-width', '6');
        svg.appendChild(outerBg);

        var innerBg = document.createElementNS(ns, 'circle');
        innerBg.setAttribute('cx', '120');
        innerBg.setAttribute('cy', '120');
        innerBg.setAttribute('r', String(INNER_R));
        innerBg.setAttribute('fill', 'none');
        innerBg.setAttribute('stroke', 'rgba(255,255,255,0.03)');
        innerBg.setAttribute('stroke-width', '4');
        svg.appendChild(innerBg);

        // Active rings
        var outerRing = document.createElementNS(ns, 'circle');
        outerRing.setAttribute('cx', '120');
        outerRing.setAttribute('cy', '120');
        outerRing.setAttribute('r', String(OUTER_R));
        outerRing.setAttribute('class', 'tei-outer-ring');
        outerRing.setAttribute('stroke', 'url(#tei-outer-grad)');
        outerRing.setAttribute('stroke-dasharray', String(OUTER_CIRC));
        outerRing.setAttribute('stroke-dashoffset', String(OUTER_CIRC));
        outerRing.id = 'tei-outer-ring';
        svg.appendChild(outerRing);

        var innerRing = document.createElementNS(ns, 'circle');
        innerRing.setAttribute('cx', '120');
        innerRing.setAttribute('cy', '120');
        innerRing.setAttribute('r', String(INNER_R));
        innerRing.setAttribute('class', 'tei-inner-ring');
        innerRing.setAttribute('stroke', 'url(#tei-inner-grad)');
        innerRing.setAttribute('stroke-dasharray', String(INNER_CIRC));
        innerRing.setAttribute('stroke-dashoffset', String(INNER_CIRC));
        innerRing.id = 'tei-inner-ring';
        svg.appendChild(innerRing);

        // Endpoint dot
        var endpoint = document.createElementNS(ns, 'circle');
        endpoint.setAttribute('r', '5');
        endpoint.setAttribute('fill', '#F5A623');
        endpoint.setAttribute('class', 'tei-endpoint');
        endpoint.id = 'tei-endpoint';
        endpoint.setAttribute('cx', '120');
        endpoint.setAttribute('cy', String(120 - OUTER_R));
        svg.appendChild(endpoint);

        return svg;
    }

    // ─── Update Ring ───
    function updateRing(tei, hrv) {
        var outerRing = document.getElementById('tei-outer-ring');
        var innerRing = document.getElementById('tei-inner-ring');
        var endpoint = document.getElementById('tei-endpoint');

        if (!outerRing) return;

        // Outer ring fill based on TEI (0-100)
        var outerFill = tei / 100;
        var outerOffset = OUTER_CIRC * (1 - outerFill);
        outerRing.setAttribute('stroke-dashoffset', String(outerOffset));

        // Inner ring fill based on HRV (max 80ms = full)
        var innerFill = Math.min((hrv || 0) / 80, 1);
        var innerOffset = INNER_CIRC * (1 - innerFill);
        innerRing.setAttribute('stroke-dashoffset', String(innerOffset));

        // Endpoint position (follow outer ring arc)
        var angle = -Math.PI / 2 + outerFill * 2 * Math.PI;
        var epX = 120 + OUTER_R * Math.cos(angle);
        var epY = 120 + OUTER_R * Math.sin(angle);
        endpoint.setAttribute('cx', String(epX));
        endpoint.setAttribute('cy', String(epY));
    }

    // ─── Zone Classification ───
    function getZone(tei) {
        if (tei >= 80) return 'PEAK';
        if (tei >= 55) return 'OPTIMAL';
        if (tei >= 35) return 'NEUTRAL';
        return 'DEGRADED';
    }

    // ─── Body Battery Bar Color ───
    function bbColor(val) {
        if (val >= 65) return '#34C759';
        if (val >= 40) return '#00B4D8';
        if (val >= 25) return '#F5A623';
        return '#FF6B35';
    }

    // ─── Build Results DOM ───
    function buildResultsDOM() {
        var container = document.createElement('div');
        container.className = 'tenki-results';
        container.id = 'tenki-results';

        // Nebula canvas
        var nebulaCanvas = document.createElement('canvas');
        nebulaCanvas.id = 'tenki-nebula-canvas';
        nebulaCanvas.width = 430;
        nebulaCanvas.height = 560;
        container.appendChild(nebulaCanvas);

        // TEI Ring Section
        var ringSection = document.createElement('div');
        ringSection.className = 'tei-ring-section';

        var ringContainer = document.createElement('div');
        ringContainer.className = 'tei-ring-container';
        ringContainer.appendChild(createRingSVG());

        var numContainer = document.createElement('div');
        numContainer.className = 'tei-number-container';
        var teiNum = document.createElement('div');
        teiNum.className = 'tei-number';
        teiNum.id = 'tei-display';
        teiNum.textContent = '--';
        numContainer.appendChild(teiNum);

        var zoneLabel = document.createElement('div');
        zoneLabel.className = 'tei-zone-label neutral';
        zoneLabel.id = 'tei-zone-label';
        zoneLabel.textContent = '\u6821\u6E96\u4E2D...';
        numContainer.appendChild(zoneLabel);

        ringContainer.appendChild(numContainer);
        ringSection.appendChild(ringContainer);

        var badge = document.createElement('div');
        badge.className = 'scan-badge';
        badge.id = 'scan-badge';
        badge.textContent = '';
        ringSection.appendChild(badge);

        container.appendChild(ringSection);

        // Coach hint
        var coach = document.createElement('div');
        coach.className = 'coach-hint';
        coach.id = 'coach-hint';
        coach.textContent = '';
        container.appendChild(coach);

        // Bento grid (2x2): HR, HRV, RR, Stress
        var bentoGrid = document.createElement('div');
        bentoGrid.className = 'bento-grid';

        var metrics = [
            { id: 'hr', label: 'HEART RATE', unit: 'BPM', color: '#FF453A' },
            { id: 'hrv', label: 'HRV RMSSD', unit: 'ms', color: '#00B4D8' },
            { id: 'rr', label: 'RESP RATE', unit: 'BrPM', color: '#34C759' },
            { id: 'stress', label: 'STRESS', unit: '', color: '#F5A623' }
        ];

        metrics.forEach(function (m) {
            var card = document.createElement('div');
            card.className = 'bento-card';

            var label = document.createElement('div');
            label.className = 'bento-label';
            label.textContent = m.label;
            card.appendChild(label);

            var valRow = document.createElement('div');
            var val = document.createElement('span');
            val.className = 'bento-value';
            val.id = 'bento-' + m.id;
            val.textContent = '--';
            valRow.appendChild(val);

            if (m.unit) {
                var unit = document.createElement('span');
                unit.className = 'bento-unit';
                unit.textContent = m.unit;
                valRow.appendChild(unit);
            }
            card.appendChild(valRow);

            var sparkCanvas = document.createElement('canvas');
            sparkCanvas.className = 'bento-sparkline';
            sparkCanvas.id = 'spark-' + m.id;
            sparkCanvas.width = 160;
            sparkCanvas.height = 28;
            card.appendChild(sparkCanvas);

            bentoGrid.appendChild(card);
        });

        container.appendChild(bentoGrid);

        // Body Battery Go Club
        var bbCard = document.createElement('div');
        bbCard.className = 'glass-card';

        var bbTitle = document.createElement('div');
        bbTitle.className = 'bento-label';
        bbTitle.textContent = 'BODY BATTERY \u00B7 24H';
        bbCard.appendChild(bbTitle);

        var bbChart = document.createElement('div');
        bbChart.className = 'bb-chart';
        bbChart.id = 'bb-chart';
        bbCard.appendChild(bbChart);

        var bbLabel = document.createElement('div');
        bbLabel.className = 'bb-label';
        bbLabel.textContent = '12h ago \u2192 Now';
        bbCard.appendChild(bbLabel);

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
        ansSns.className = 'ans-sns';
        ansSns.id = 'ans-sns';
        ansSns.style.width = '45%';
        ansBar.appendChild(ansSns);

        var ansDivider = document.createElement('div');
        ansDivider.className = 'ans-divider';
        ansDivider.id = 'ans-divider';
        ansDivider.style.left = '45%';
        ansBar.appendChild(ansDivider);

        var ansPns = document.createElement('div');
        ansPns.className = 'ans-pns';
        ansPns.id = 'ans-pns';
        ansPns.style.width = '55%';
        ansBar.appendChild(ansPns);

        ansCard.appendChild(ansBar);

        var ansLabels = document.createElement('div');
        ansLabels.className = 'ans-labels';
        ansLabels.innerHTML = '<span>SNS <span id="ans-sns-pct">45</span>%</span><span>PNS <span id="ans-pns-pct">55</span>%</span>';
        ansCard.appendChild(ansLabels);

        container.appendChild(ansCard);

        // FDCB Floating Dock
        var dock = document.createElement('div');
        dock.className = 'fdcb-dock';
        dock.id = 'fdcb-dock';

        dock.innerHTML =
            '<div class="fdcb-template" id="fdcb-template-name">\uD83D\uDCCA Canslim GS \u25BE</div>' +
            '<div style="text-align:center">' +
            '  <div class="fdcb-timer" id="fdcb-timer">05:00</div>' +
            '  <div class="fdcb-progress"><div class="fdcb-progress-fill" id="fdcb-progress-fill" style="width:0%"></div></div>' +
            '</div>' +
            '<button class="fdcb-confirm" id="fdcb-confirm">\u2713</button>';

        container.appendChild(dock);

        return container;
    }

    // ─── Init Body Battery Chart ───
    function initBBChart(data) {
        var chart = document.getElementById('bb-chart');
        if (!chart) return;
        chart.innerHTML = '';

        var maxVal = Math.max.apply(null, data);

        data.forEach(function (val, i) {
            var bar = document.createElement('div');
            bar.className = 'bb-bar';
            var heightPct = (val / maxVal) * 100;
            bar.style.height = heightPct + '%';
            bar.style.backgroundColor = bbColor(val);

            // Opacity progression: 0.25 → 1.0
            var opacity = 0.25 + (i / (data.length - 1)) * 0.75;
            bar.style.opacity = String(opacity);

            // Last bar gets glow
            if (i === data.length - 1) {
                bar.style.boxShadow = '0 0 8px ' + bbColor(val);
            }

            chart.appendChild(bar);

            // Stagger animation
            setTimeout(function () {
                bar.classList.add('animate');
            }, 1200 + i * 80);
        });
    }

    // ─── Update ANS Balance ───
    function updateANS(snsRaw) {
        state.sns = ewma(state.sns, snsRaw);
        state.pns = 100 - state.sns;

        var snsPct = Math.round(state.sns);
        var pnsPct = 100 - snsPct;

        var snsEl = document.getElementById('ans-sns');
        var pnsEl = document.getElementById('ans-pns');
        var divEl = document.getElementById('ans-divider');
        var snsPctEl = document.getElementById('ans-sns-pct');
        var pnsPctEl = document.getElementById('ans-pns-pct');

        if (snsEl) snsEl.style.width = snsPct + '%';
        if (pnsEl) pnsEl.style.width = pnsPct + '%';
        if (divEl) divEl.style.left = snsPct + '%';
        if (snsPctEl) snsPctEl.textContent = String(snsPct);
        if (pnsPctEl) pnsPctEl.textContent = String(pnsPct);
    }

    // ─── Public API ───
    var RESULTS_RENDERER = {
        /**
         * Initialize the results page. Call once on app load.
         */
        init: function () {
            var existing = document.getElementById('tenki-results');
            if (existing) existing.remove();

            var dom = buildResultsDOM();
            document.body.appendChild(dom);

            // Init nebula
            initStars(60);
            var canvas = document.getElementById('tenki-nebula-canvas');
            if (canvas) {
                // Match parent width
                canvas.width = Math.min(window.innerWidth, 430);
                drawNebula(canvas);
            }

            // Init sparklines
            var sparkIds = ['hr', 'hrv', 'rr', 'stress'];
            var sparkColors = { hr: '#FF453A', hrv: '#00B4D8', rr: '#34C759', stress: '#F5A623' };
            sparkIds.forEach(function (id) {
                var sc = document.getElementById('spark-' + id);
                if (sc && global.TENKI_Sparkline) {
                    state.sparklines[id] = new global.TENKI_Sparkline(sc, {
                        color: sparkColors[id],
                        maxPoints: 30
                    });
                }
            });
        },

        /**
         * Show the results page.
         */
        show: function () {
            var el = document.getElementById('tenki-results');
            if (el) el.classList.add('active');
        },

        /**
         * Hide the results page.
         */
        hide: function () {
            var el = document.getElementById('tenki-results');
            if (el) el.classList.remove('active');
        },

        /**
         * Update TEI display with EWMA smoothing.
         * @param {number} teiRaw - Raw TEI PR99 value (1-99)
         * @param {number} hrvRaw - Raw HRV RMSSD in ms
         * @param {number} hrRaw - Raw HR BPM
         */
        updateTEI: function (teiRaw, hrvRaw, hrRaw) {
            state.tei = ewma(state.tei, teiRaw);
            state.hrv = ewma(state.hrv, hrvRaw);
            state.hr = ewma(state.hr, hrRaw);

            var teiDisplay = Math.round(state.tei);
            var zone = getZone(teiDisplay);
            state.zone = zone;

            // Update number
            var numEl = document.getElementById('tei-display');
            if (numEl) numEl.textContent = String(teiDisplay);

            // Heartbeat pulse sync
            if (state.hr && state.hr > 0) {
                var pulseDur = (60 / state.hr).toFixed(2);
                document.documentElement.style.setProperty('--pulse-dur', pulseDur + 's');
            }

            // Zone label
            var labelEl = document.getElementById('tei-zone-label');
            if (labelEl) {
                labelEl.className = 'tei-zone-label ' + zone.toLowerCase();
                labelEl.textContent = zone;
                labelEl.style.color = ZONE_COLORS[zone];
            }

            // Coach hint
            var coachEl = document.getElementById('coach-hint');
            if (coachEl) coachEl.textContent = COACH_MESSAGES[zone];

            // Ring
            updateRing(teiDisplay, state.hrv);
        },

        /**
         * Update bento card metrics.
         */
        updateMetrics: function (hr, hrv, rr, stress) {
            state.hr = ewma(state.hr, hr);
            state.hrv = ewma(state.hrv, hrv);
            state.rr = ewma(state.rr, rr);
            state.stress = ewma(state.stress, stress);

            var pairs = [
                ['bento-hr', state.hr],
                ['bento-hrv', state.hrv],
                ['bento-rr', state.rr],
                ['bento-stress', state.stress]
            ];

            pairs.forEach(function (p) {
                var el = document.getElementById(p[0]);
                if (el) el.textContent = p[1] !== null ? Math.round(p[1]) : '--';
            });

            // Push to sparklines
            if (state.sparklines.hr && state.hr !== null) state.sparklines.hr.push(state.hr);
            if (state.sparklines.hrv && state.hrv !== null) state.sparklines.hrv.push(state.hrv);
            if (state.sparklines.rr && state.rr !== null) state.sparklines.rr.push(state.rr);
            if (state.sparklines.stress && state.stress !== null) state.sparklines.stress.push(state.stress);
        },

        /**
         * Initialize Body Battery chart with 24h data.
         */
        initBodyBattery: function (data) {
            initBBChart(data);
        },

        /**
         * Update ANS balance display.
         * @param {number} snsPercent - SNS percentage (0-100)
         */
        updateANS: updateANS,

        /**
         * Set scan badge text.
         */
        setBadge: function (text) {
            var el = document.getElementById('scan-badge');
            if (el) el.textContent = text;
        },

        /**
         * Show/hide FDCB dock.
         */
        showDock: function () {
            var el = document.getElementById('fdcb-dock');
            if (el) el.classList.add('active');
        },

        hideDock: function () {
            var el = document.getElementById('fdcb-dock');
            if (el) el.classList.remove('active');
        },

        /**
         * Update FDCB timer display.
         */
        updateDockTimer: function (timeStr, progressPct) {
            var timerEl = document.getElementById('fdcb-timer');
            var progressEl = document.getElementById('fdcb-progress-fill');
            if (timerEl) timerEl.textContent = timeStr;
            if (progressEl) progressEl.style.width = progressPct + '%';
        },

        /**
         * Stop nebula animation (cleanup).
         */
        destroy: function () {
            if (nebulaFrame) {
                cancelAnimationFrame(nebulaFrame);
                nebulaFrame = null;
            }
        }
    };

    global.TENKI_RESULTS = RESULTS_RENDERER;
})(window);
