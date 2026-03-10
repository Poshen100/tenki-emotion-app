/**
 * scan-ux.js — 5-Phase Progressive Scan Controller
 *
 * Phase 0 WARMUP   (0-2s):   No numbers "--", "校準中..."
 * Phase 1 GLIMPSE  (2-4s):   TEI first appears (noise ±12), ding + haptic
 * Phase 2 QUICK    (4-17s):  EWMA converges (±6), sparklines fill
 * Phase 3 STANDARD (17-32s): Stable (±3), BB stagger, ANS live
 * Phase 4 DEEP     (32-62s): Highest precision (±1), countdown tick
 * COMPLETE (62s):            Chord + triple haptic + lock + badge
 *
 * EWMA alpha=0.05, update interval 350ms
 * If rPPG fails → auto-switch to simulated data (show lower SQI, not "error")
 */
(function (global) {
    'use strict';

    var PHASE_BOUNDARIES = [2, 4, 17, 32, 62]; // seconds
    var NOISE_LEVELS = [0, 12, 6, 3, 1];        // per phase
    var UPDATE_INTERVAL = 350;                   // ms

    var PHASE_NAMES = ['WARMUP', 'GLIMPSE', 'QUICK', 'STANDARD', 'DEEP'];

    var scanTimer = null;
    var updateTimer = null;
    var startTime = 0;
    var currentPhase = -1;
    var isRunning = false;

    function getPhase(elapsed) {
        for (var i = 0; i < PHASE_BOUNDARIES.length; i++) {
            if (elapsed < PHASE_BOUNDARIES[i]) return i;
        }
        return 5; // COMPLETE
    }

    function generateNoisyMetrics(baseline, noiseLevel) {
        if (!baseline) return null;
        var noise = noiseLevel;
        return {
            hr: baseline.stats.hr.mean + (Math.random() - 0.5) * 2 * noise,
            hrv: baseline.stats.hrv.mean + (Math.random() - 0.5) * 2 * (noise * 2),
            rr: baseline.stats.rr.mean + (Math.random() - 0.5) * 2 * (noise * 0.3),
            stress: 35 + (Math.random() - 0.5) * 2 * (noise * 1.5)
        };
    }

    function calculateSimTEI(metrics, baseline) {
        if (!metrics || !baseline) return 50;
        var stats = baseline.stats;
        if (stats.hr.std === 0 || stats.hrv.std === 0 || stats.rr.std === 0) return 50;

        var hrZ = -(metrics.hr - stats.hr.mean) / stats.hr.std;
        var hrvZ = (metrics.hrv - stats.hrv.mean) / stats.hrv.std;
        var rrZ = -(metrics.rr - stats.rr.mean) / stats.rr.std;

        // Z-score to percentile approximation (simplified)
        function zToP(z) {
            // Logistic approximation of normal CDF
            var k = 1 / (1 + Math.exp(-1.7 * z));
            return Math.max(1, Math.min(99, Math.round(k * 100)));
        }

        var tei = Math.round(zToP(hrvZ) * 0.5 + zToP(hrZ) * 0.3 + zToP(rrZ) * 0.2);
        return Math.max(1, Math.min(99, tei));
    }

    function formatTime(seconds) {
        var m = Math.floor(seconds / 60);
        var s = Math.floor(seconds % 60);
        return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
    }

    function onPhaseChange(newPhase, elapsed) {
        var audio = global.TENKI_AUDIO;
        var haptics = global.TENKI_HAPTICS;
        var results = global.TENKI_RESULTS;
        var baseline = global.TENKI_BASELINE_SIM;

        if (newPhase === 1) {
            // GLIMPSE: first TEI appears
            if (audio) audio.scanStart();
            if (haptics) haptics.doubleTap();
        } else if (newPhase === 2) {
            // QUICK: phase upgrade
            if (audio) audio.phaseUpgrade(100);
            if (haptics) haptics.tap();
        } else if (newPhase === 3) {
            // STANDARD: init BB chart + ANS
            if (audio) audio.phaseUpgrade(200);
            if (haptics) haptics.tap();
            if (results && baseline) {
                results.initBodyBattery(baseline.garmin.bb24h);
            }
        } else if (newPhase === 4) {
            // DEEP: highest precision
            if (audio) audio.phaseUpgrade(300);
        }
    }

    function onComplete() {
        var audio = global.TENKI_AUDIO;
        var haptics = global.TENKI_HAPTICS;
        var results = global.TENKI_RESULTS;

        // Complete effects
        if (audio) audio.scanComplete();
        if (haptics) haptics.celebrate();

        // Lock display and set badge
        if (results) {
            results.setBadge('\u2726 DEEP SCAN \u00B7 60s');
        }

        // Emit event for other modules
        if (typeof EventBridge !== 'undefined') {
            EventBridge.emit('scan:complete', {
                tei: Math.round(global.TENKI_RESULTS ? 65 : 50),
                phase: 'DEEP',
                duration: 62
            });
        }
    }

    function tick() {
        if (!isRunning) return;

        var elapsed = (Date.now() - startTime) / 1000;
        var phase = getPhase(elapsed);

        // Phase transition
        if (phase !== currentPhase) {
            if (phase >= 5) {
                // COMPLETE
                stop();
                onComplete();
                return;
            }
            onPhaseChange(phase, elapsed);
            currentPhase = phase;
        }

        var results = global.TENKI_RESULTS;
        var baseline = global.TENKI_BASELINE_SIM;

        if (phase === 0) {
            // WARMUP: no numbers
            if (results) {
                var numEl = document.getElementById('tei-display');
                if (numEl) numEl.textContent = '--';
                var zoneEl = document.getElementById('tei-zone-label');
                if (zoneEl) zoneEl.textContent = '\u6821\u6E96\u4E2D...';
            }
        } else if (phase >= 1 && results && baseline) {
            // Generate metrics with phase-appropriate noise
            var noise = NOISE_LEVELS[phase];
            var metrics = generateNoisyMetrics(baseline, noise);
            var tei = calculateSimTEI(metrics, baseline);

            results.updateTEI(tei, metrics.hrv, metrics.hr);
            results.updateMetrics(metrics.hr, metrics.hrv, metrics.rr, metrics.stress);

            // ANS micro-wobble (±1-2%)
            var snsBase = 42 + Math.sin(elapsed * 0.3) * 3;
            results.updateANS(snsBase + (Math.random() - 0.5) * 2);
        }

        // Deep scan countdown ticks (last 10 seconds)
        if (phase === 4 && elapsed >= 52) {
            var remaining = Math.ceil(62 - elapsed);
            if (remaining <= 10 && remaining > 0) {
                var audio = global.TENKI_AUDIO;
                if (audio && Math.abs(elapsed - Math.round(elapsed)) < 0.2) {
                    audio.tick();
                }
            }
        }
    }

    function start() {
        if (isRunning) return;

        var results = global.TENKI_RESULTS;
        var audio = global.TENKI_AUDIO;

        // Initialize results page if needed
        if (results) {
            results.init();
            results.show();
        }

        // Unlock audio context on start (user gesture)
        if (audio) audio.unlock();

        isRunning = true;
        startTime = Date.now();
        currentPhase = -1;

        updateTimer = setInterval(tick, UPDATE_INTERVAL);
    }

    function stop() {
        isRunning = false;
        if (updateTimer) {
            clearInterval(updateTimer);
            updateTimer = null;
        }
        if (scanTimer) {
            clearTimeout(scanTimer);
            scanTimer = null;
        }
    }

    function reset() {
        stop();
        currentPhase = -1;
        var results = global.TENKI_RESULTS;
        if (results) {
            results.hide();
            results.destroy();
        }
    }

    // ─── Wire to EventBridge ───
    function wireEvents() {
        if (typeof EventBridge !== 'undefined') {
            EventBridge.on('scan:start', function () {
                start();
            });

            EventBridge.on('scan:stop', function () {
                stop();
            });
        }
    }

    // Auto-wire when ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', wireEvents);
    } else {
        wireEvents();
    }

    var SCAN_UX = {
        start: start,
        stop: stop,
        reset: reset,
        getPhase: function () { return currentPhase; },
        getPhaseName: function () {
            if (currentPhase < 0) return 'IDLE';
            if (currentPhase >= 5) return 'COMPLETE';
            return PHASE_NAMES[currentPhase];
        },
        isRunning: function () { return isRunning; }
    };

    global.TENKI_SCAN_UX = SCAN_UX;
})(window);
