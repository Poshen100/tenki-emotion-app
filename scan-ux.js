/**
 * scan-ux.js — 5-Phase Progressive Scan Controller
 *
 * Phase 0 WARMUP   (0-2s):   No numbers "--", calibrating
 * Phase 1 GLIMPSE  (2-4s):   TEI first appears (noise ±12)
 * Phase 2 QUICK    (4-17s):  EWMA converges (±6), sparklines fill
 * Phase 3 STANDARD (17-32s): Stable (±3), BB stagger, ANS live
 * Phase 4 DEEP     (32-62s): Highest precision (±1), countdown tick
 * COMPLETE (62s):            Chord + triple haptic + lock + badge
 *
 * EWMA alpha=0.05, update interval 350ms
 * If rPPG unavailable → simulation mode (show lower SQI, not "error")
 */
(function (global) {
    'use strict';

    var PHASE_BOUNDARIES = [2, 4, 17, 32, 62];
    var NOISE_LEVELS = [0, 12, 6, 3, 1];
    var UPDATE_INTERVAL = 350;
    var ALPHA = 0.05;

    var timer = null;
    var updateTimer = null;
    var startTime = 0;
    var currentPhase = -1;
    var isRunning = false;
    var locked = false;
    var latestRaw = null;

    // EWMA state
    var ewma = { tei: 0, hr: 0, hrv: 0, rr: 0, stress: 0, sns: 50, sqi: 0 };
    var histories = { hr: [], hrv: [], rr: [] };

    function ewmaSmooth(current, target, min, max) {
        if (current === 0) return Math.max(min, Math.min(max, target));
        var v = current * (1 - ALPHA) + target * ALPHA;
        return Math.max(min, Math.min(max, v));
    }

    function getPhase(elapsed) {
        for (var i = 0; i < PHASE_BOUNDARIES.length; i++) {
            if (elapsed < PHASE_BOUNDARIES[i]) return i;
        }
        return 5;
    }

    /** Fallback TEI: z-score → percentile → weighted composite */
    function simpleTEI(hr, hrv, rr) {
        var baseline = global.TENKI_BASELINE_SIM;
        if (!baseline) return 50;
        var b = baseline.stats;

        var zHR  = b.hr.std > 0 ? -(hr - b.hr.mean) / b.hr.std : 0;
        var zHRV = b.hrv.std > 0 ? (hrv - b.hrv.mean) / b.hrv.std : 0;
        var zRR  = b.rr.std > 0 ? -(rr - b.rr.mean) / b.rr.std : 0;

        function zToP(z) {
            var c = Math.max(-3.5, Math.min(3.5, z));
            var a1=.254829592, a2=-.284496736, a3=1.421413741, a4=-1.453152027, a5=1.061405429, p=.3275911;
            var s = c < 0 ? -1 : 1, x = Math.abs(c) / Math.sqrt(2), t = 1/(1+p*x);
            var y = 1 - (((((a5*t+a4)*t)+a3)*t+a2)*t+a1) * t * Math.exp(-x*x);
            return Math.max(1, Math.min(99, Math.round(0.5 * (1 + s * y) * 100)));
        }

        return Math.round(zToP(zHRV) * 0.5 + zToP(zHR) * 0.3 + zToP(zRR) * 0.2);
    }

    function tick() {
        if (!isRunning) return;

        var elapsed = Math.floor((Date.now() - startTime) / 1000);
        var prevPhase = currentPhase;
        var phase = getPhase(elapsed);

        if (phase >= 5) {
            complete();
            return;
        }

        // Phase transition
        if (phase !== currentPhase) {
            currentPhase = phase;
            onPhaseChange(phase, prevPhase);
        }

        // Update badge and dots
        var results = global.TENKI_RESULTS;
        if (results) {
            results.updateBadge(phase, elapsed);
            results.updatePhaseDots(phase);
        }

        // Deep scan ticks (last 7s)
        var audio = global.TENKI_AUDIO;
        if (phase === 4 && elapsed >= 55 && audio) {
            var remaining = 62 - elapsed;
            if (remaining <= 7 && remaining > 0) {
                audio.tick();
            }
        }
    }

    function onPhaseChange(phase, prevPhase) {
        var audio = global.TENKI_AUDIO;
        var haptics = global.TENKI_HAPTICS;

        if (phase === 1 && prevPhase === 0) {
            // GLIMPSE: first data
            if (audio) audio.dataArrive();
            if (haptics) haptics.tap();
        } else if (phase > 1 && phase > prevPhase) {
            // Phase upgrade
            if (audio) audio.phaseUpgrade(phase);
            if (haptics) haptics.phaseUp();

            // Init BB chart at STANDARD phase
            if (phase === 3) {
                var baseline = global.TENKI_BASELINE_SIM;
                var results = global.TENKI_RESULTS;
                if (baseline && results && typeof results.showComplete !== 'function') {
                    // BB will be initialized on complete
                }
            }
        }
    }

    function updateMetrics() {
        if (locked || currentPhase < 1) return;

        var baseline = global.TENKI_BASELINE_SIM;
        var results = global.TENKI_RESULTS;
        if (!baseline || !results) return;

        var noise = NOISE_LEVELS[currentPhase] || 0;
        var n = function() { return (Math.random() - 0.5) * noise; };

        // Use raw rPPG data if available; otherwise hold values flat with SQI=0
        var rawHR, rawHRV, rawRR, rawSQI;
        if (latestRaw) {
            rawHR = latestRaw.hr + n();
            rawHRV = latestRaw.hrv + n();
            rawRR = latestRaw.rr + n() * 0.5;
            rawSQI = latestRaw.sqi + n() * 0.3;
        } else {
            // No face / rPPG data — hold current values, signal quality = 0
            rawHR = ewma.hr || baseline.stats.hr.mean;
            rawHRV = ewma.hrv || baseline.stats.hrv.mean;
            rawRR = ewma.rr || baseline.stats.rr.mean;
            rawSQI = 0;
        }

        // EWMA update
        ewma.hr = ewmaSmooth(ewma.hr, rawHR, 40, 200);
        ewma.hrv = ewmaSmooth(ewma.hrv, rawHRV, 5, 200);
        ewma.rr = ewmaSmooth(ewma.rr, rawRR, 6, 30);
        ewma.sqi = ewmaSmooth(ewma.sqi, rawSQI, 0, 100);

        // Derived metrics from baseline
        ewma.stress = baseline.calculateStress(ewma.hr, ewma.hrv);
        var ans = baseline.calculateANS(ewma.hr, ewma.hrv, ewma.rr);
        ewma.sns = ans.sns;

        // TEI via TenkiEngine or fallback
        if (typeof TenkiEngine !== 'undefined' && TenkiEngine.ingestDailyScan) {
            try {
                var result = TenkiEngine.ingestDailyScan({
                    deviceType: 'face_rppg',
                    sqs: {
                        grade: ewma.sqi > 85 ? 'A' : ewma.sqi > 70 ? 'B' : 'C',
                        total: Math.round(ewma.sqi)
                    },
                    metrics: {
                        hrBpm: ewma.hr,
                        hrvRmssdMs: ewma.hrv,
                        rrBrpm: ewma.rr
                    }
                });
                if (result && result.tei && result.tei.tei != null) {
                    ewma.tei = ewmaSmooth(ewma.tei, result.tei.tei, 1, 99);
                } else {
                    ewma.tei = ewmaSmooth(ewma.tei, simpleTEI(ewma.hr, ewma.hrv, ewma.rr), 1, 99);
                }
            } catch (e) {
                ewma.tei = ewmaSmooth(ewma.tei, simpleTEI(ewma.hr, ewma.hrv, ewma.rr), 1, 99);
            }
        } else {
            ewma.tei = ewmaSmooth(ewma.tei, simpleTEI(ewma.hr, ewma.hrv, ewma.rr), 1, 99);
        }

        // Push history (limit 40 points)
        histories.hr.push(ewma.hr);
        histories.hrv.push(ewma.hrv);
        histories.rr.push(ewma.rr);
        ['hr','hrv','rr'].forEach(function(k) {
            if (histories[k].length > 40) histories[k].shift();
        });

        // Render
        results.updateAll(ewma, histories, ans, currentPhase);
    }

    function complete() {
        locked = true;
        isRunning = false;
        clearInterval(timer);
        clearInterval(updateTimer);

        var audio = global.TENKI_AUDIO;
        var haptics = global.TENKI_HAPTICS;
        var results = global.TENKI_RESULTS;

        if (audio) {
            audio.stopBreathBg();
            audio.scanComplete();
        }
        if (haptics) haptics.complete();
        if (results) results.showComplete(ewma);
    }

    var SCAN_UX = {
        /** Start scan (call in user gesture) */
        start: function () {
            if (isRunning) return;

            ewma = { tei: 0, hr: 0, hrv: 0, rr: 0, stress: 0, sns: 50, sqi: 0 };
            histories = { hr: [], hrv: [], rr: [] };
            currentPhase = -1;
            locked = false;
            latestRaw = null;

            var audio = global.TENKI_AUDIO;
            var results = global.TENKI_RESULTS;

            if (audio) {
                audio.init();
                audio.scanStart();
                audio.startBreathBg();
            }

            var haptics = global.TENKI_HAPTICS;
            if (haptics) haptics.tap();

            if (results) {
                try {
                    results.init();
                    results.showWarmup();
                } catch (e) {
                    console.error('[SCAN-UX] Results init error:', e);
                }
            }

            isRunning = true;
            startTime = Date.now();

            timer = setInterval(tick, 1000);
            updateTimer = setInterval(updateMetrics, UPDATE_INTERVAL);
        },

        /** Feed raw rPPG data from engine */
        onRppgData: function (data) {
            latestRaw = data;
        },

        stop: function () {
            isRunning = false;
            clearInterval(timer);
            clearInterval(updateTimer);
            var audio = global.TENKI_AUDIO;
            if (audio) audio.stopBreathBg();
        },

        reset: function () {
            this.stop();
            currentPhase = -1;
            locked = false;
            latestRaw = null;
        },

        getPhase: function () { return currentPhase; },
        isRunning: function () { return isRunning; }
    };

    global.TENKI_SCAN_UX = SCAN_UX;
})(window);
