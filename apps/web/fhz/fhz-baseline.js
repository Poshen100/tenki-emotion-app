// TENKI FIX v5.2 - added 3 minute rear-camera baseline capture with local persistence and completion event
(function (global) {
    'use strict';

    var BASELINE_STORAGE_KEY = 'tenki_baseline_v1';
    var CAPTURE_DURATION_MS = 180000;
    var FRAME_INTERVAL_MS = 33;
    var COMPUTE_INTERVAL_MS = 500;

    var sampleCanvas = document.createElement('canvas');
    var sampleContext = sampleCanvas.getContext('2d', { willReadFrequently: true });
    sampleCanvas.width = 48;
    sampleCanvas.height = 48;

    var session = null;
    var lastResult = null;

    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    function mean(values) {
        var total = 0;
        var i;

        if (!values || !values.length) return 0;

        for (i = 0; i < values.length; i++) {
            total += values[i];
        }

        return total / values.length;
    }

    function standardDeviation(values) {
        var average = mean(values);
        var varianceTotal = 0;
        var i;

        if (!values || values.length < 2) return 0;

        for (i = 0; i < values.length; i++) {
            varianceTotal += Math.pow(values[i] - average, 2);
        }

        return Math.sqrt(varianceTotal / (values.length - 1));
    }

    function formatClock(msRemaining) {
        var totalSeconds = Math.max(0, Math.ceil(msRemaining / 1000));
        var minutes = Math.floor(totalSeconds / 60);
        var seconds = totalSeconds % 60;

        return String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0');
    }

    function estimateSignalLabel(quality) {
        var percent = Math.round(clamp(quality || 0, 0, 100));

        if (percent >= 85) return 'Signal Excellent';
        if (percent >= 70) return 'Signal Good';
        if (percent >= 50) return 'Signal Fair';
        return 'Signal Weak';
    }

    function extractFingerMeanG(videoEl) {
        var frame;
        var data;
        var i;
        var total = 0;
        var count = 0;

        if (!videoEl || videoEl.readyState < 2 || !sampleContext) return null;

        try {
            sampleContext.drawImage(videoEl, 0, 0, sampleCanvas.width, sampleCanvas.height);
            frame = sampleContext.getImageData(0, 0, sampleCanvas.width, sampleCanvas.height);
        } catch (error) {
            console.warn('[FHZ] Baseline frame extraction failed', error);
            return null;
        }

        data = frame.data;

        for (i = 1; i < data.length; i += 4) {
            total += data[i] / 255;
            count += 1;
        }

        if (!count) return null;

        return total / count;
    }

    function getWorkerUrl() {
        return 'rpgg-worker.js';
    }

    function destroyController(controller) {
        if (!controller) return;

        try {
            if (controller.worker && typeof controller.worker.terminate === 'function') {
                controller.worker.terminate();
            } else if (typeof controller.reset === 'function') {
                controller.reset();
            }
        } catch (error) {
            console.warn('[FHZ] Failed to tear down baseline controller', error);
        }
    }

    function buildResult(activeSession) {
        var meanHR = mean(activeSession.hrValues);
        var rmssd = mean(activeSession.rmssdValues);
        var sdnn = standardDeviation(activeSession.ibiValues);
        var sqiAvg = mean(activeSession.sqiValues);

        return {
            timestamp: Date.now(),
            meanHR: Number((meanHR || 0).toFixed(2)),
            rmssd: Number((rmssd || 0).toFixed(2)),
            sdnn: Number((sdnn || 0).toFixed(2)),
            sqi_avg: Number((sqiAvg || 0).toFixed(2)),
            sampleCount: activeSession.sampleCount || 0
        };
    }

    function persistResult(result) {
        try {
            localStorage.setItem(BASELINE_STORAGE_KEY, JSON.stringify(result));
        } catch (error) {
            console.warn('[FHZ] Failed to persist baseline result', error);
        }
    }

    function pushEngineCalibration(result) {
        var engine = global.TenkiEngine;
        var qualityGrade = result.sqi_avg >= 85 ? 'A' : (result.sqi_avg >= 70 ? 'B' : 'C');

        if (!engine || typeof engine.calibrateFingerPPG !== 'function') return;

        try {
            engine.calibrateFingerPPG({
                timeUtc: result.timestamp,
                durationS: Math.round(CAPTURE_DURATION_MS / 1000),
                sqs: {
                    total: Math.round(result.sqi_avg),
                    grade: qualityGrade
                },
                metrics: {
                    hrBpm: result.meanHR,
                    hrvRmssdMs: result.rmssd
                }
            });
        } catch (error) {
            console.warn('[FHZ] TenkiEngine baseline calibration failed', error);
        }
    }

    function syncSimulationBaseline(result) {
        var baseline = global.TENKI_BASELINE_SIM;

        if (!baseline || !baseline.stats) return;

        baseline.stats.hr.mean = result.meanHR || baseline.stats.hr.mean;
        baseline.stats.hrv.mean = result.rmssd || baseline.stats.hrv.mean;
    }

    function dispatchBaselineComplete(result) {
        document.dispatchEvent(new CustomEvent('tenki:baseline-complete', {
            detail: result
        }));
    }

    function emitProgress(activeSession) {
        var elapsed = Date.now() - activeSession.startedAt;
        var remaining = Math.max(0, CAPTURE_DURATION_MS - elapsed);
        var latestMetrics = activeSession.latestMetrics || {};
        var payload = {
            elapsedMs: elapsed,
            remainingMs: remaining,
            progress: clamp(elapsed / CAPTURE_DURATION_MS, 0, 1),
            timeLabel: formatClock(remaining),
            signalLabel: estimateSignalLabel((latestMetrics.quality || 0) * 100),
            liveHr: latestMetrics.bpm ? String(Math.round(latestMetrics.bpm)) + ' bpm' : '--',
            liveRmssd: latestMetrics.rmssd ? String(Math.round(latestMetrics.rmssd)) + ' ms' : '--',
            message: remaining > 0
                ? 'Stay relaxed and keep full finger coverage over the rear lens.'
                : 'Finalizing your resting baseline.'
        };

        if (typeof activeSession.onUpdate === 'function') {
            activeSession.onUpdate(payload);
        }
    }

    function finalizeSession(reason) {
        var result;
        var activeSession = session;

        if (!activeSession) return null;

        if (activeSession.frameTimer) {
            clearInterval(activeSession.frameTimer);
            activeSession.frameTimer = null;
        }

        if (activeSession.computeTimer) {
            clearInterval(activeSession.computeTimer);
            activeSession.computeTimer = null;
        }

        destroyController(activeSession.controller);
        activeSession.controller = null;

        if (reason === 'completed') {
            result = buildResult(activeSession);
            lastResult = result;
            persistResult(result);
            pushEngineCalibration(result);
            syncSimulationBaseline(result);
            dispatchBaselineComplete(result);
        }

        session = null;
        return result || null;
    }

    function installWorkerTap(activeSession) {
        var originalHandler;

        if (!activeSession.controller || !activeSession.controller.worker) return;

        originalHandler = activeSession.controller.worker.onmessage;
        activeSession.controller.worker.onmessage = function (event) {
            var message = event.data || {};
            var bpm;
            var quality;
            var ibi;

            if (typeof originalHandler === 'function') {
                originalHandler.call(activeSession.controller.worker, event);
            }

            if (message.type !== 'metrics') return;

            activeSession.latestMetrics = message;

            if (message.bpm) {
                bpm = Number(message.bpm);
                activeSession.hrValues.push(bpm);
                ibi = 60000 / bpm;
                if (isFinite(ibi)) {
                    activeSession.ibiValues.push(ibi);
                }
            }

            if (message.rmssd) {
                activeSession.rmssdValues.push(Number(message.rmssd));
            }

            quality = clamp((message.quality || 0) * 100, 0, 100);
            activeSession.sqiValues.push(quality);
            emitProgress(activeSession);
        };
    }

    function start(videoEl, options) {
        var settings = options || {};
        var controller;

        if (!videoEl) {
            return Promise.reject(new Error('video element required'));
        }

        stop();

        if (!global.TENKI_RPPG || typeof global.TENKI_RPPG.create !== 'function') {
            return Promise.reject(new Error('TENKI_RPPG unavailable'));
        }

        controller = global.TENKI_RPPG.create(getWorkerUrl());
        controller.setMode('spectrum');

        session = {
            controller: controller,
            videoEl: videoEl,
            startedAt: Date.now(),
            onUpdate: settings.onUpdate,
            onComplete: settings.onComplete,
            sampleCount: 0,
            hrValues: [],
            rmssdValues: [],
            ibiValues: [],
            sqiValues: [],
            latestMetrics: null,
            frameTimer: null,
            computeTimer: null
        };

        installWorkerTap(session);

        session.frameTimer = setInterval(function () {
            var meanG = extractFingerMeanG(videoEl);

            if (meanG === null || !session || !session.controller) return;

            session.controller.pushFrame({
                t: Date.now(),
                meanG: meanG
            });
            session.sampleCount += 1;
        }, FRAME_INTERVAL_MS);

        session.computeTimer = setInterval(function () {
            var elapsed;
            var result;

            if (!session || !session.controller) return;

            session.controller.requestCompute();
            emitProgress(session);

            elapsed = Date.now() - session.startedAt;
            if (elapsed >= CAPTURE_DURATION_MS) {
                result = finalizeSession('completed');
                if (typeof settings.onComplete === 'function') {
                    settings.onComplete(result);
                }
            }
        }, COMPUTE_INTERVAL_MS);

        emitProgress(session);
        console.info('[FHZ] Baseline capture started');

        return Promise.resolve(true);
    }

    function stop() {
        var result = finalizeSession('stopped');

        if (session) {
            session = null;
        }

        if (result) {
            lastResult = result;
        }

        return result;
    }

    function getResult() {
        return lastResult;
    }

    function isRunning() {
        return !!session;
    }

    global.FHZ_BASELINE = {
        BASELINE_STORAGE_KEY: BASELINE_STORAGE_KEY,
        start: start,
        stop: stop,
        getResult: getResult,
        isRunning: isRunning
    };
})(window);
