// TENKI FIX v5.2 - added modular FHZ controller with rear-camera handoff and baseline commit flow
(function (global) {
    'use strict';

    var PURPOSE_STORAGE_KEY = 'tenki_fhz_last_purpose';
    var STATES = {
        NOT_DETECTED: 'NOT_DETECTED',
        ALIGNING: 'ALIGNING',
        STABILIZING: 'STABILIZING',
        READY: 'READY'
    };

    var session = {
        isOpen: false,
        state: STATES.NOT_DETECTED,
        purposeId: readStoredPurpose(),
        stream: null,
        metricTimer: null,
        readySince: 0,
        lastSnapshot: null
    };

    function readStoredPurpose() {
        try {
            return localStorage.getItem(PURPOSE_STORAGE_KEY) || 'QUICK';
        } catch (error) {
            return 'QUICK';
        }
    }

    function persistPurpose(purposeId) {
        session.purposeId = purposeId;

        try {
            localStorage.setItem(PURPOSE_STORAGE_KEY, purposeId);
        } catch (error) {
            console.warn('[FHZ] Unable to persist FHZ purpose', error);
        }
    }

    function getPurposesApi() {
        return global.TENKI_FHZ_PURPOSES;
    }

    function getMetricsApi() {
        return global.TENKI_FHZ_METRICS;
    }

    function getRendererApi() {
        return global.TENKI_FHZ_RENDERER;
    }

    function getBaselineApi() {
        return global.FHZ_BASELINE;
    }

    function getPurpose(purposeId) {
        var purposes = getPurposesApi();

        if (!purposes || typeof purposes.getById !== 'function') {
            return {
                id: 'QUICK',
                label: 'Quick',
                subtitle: 'Fast readiness handoff',
                commitLabel: 'Start Scan',
                guidance: 'Lock a stable finger signal and continue.',
                rppgMode: 'default',
                usesResultsFlow: true
            };
        }

        return purposes.getById(purposeId || session.purposeId);
    }

    function getStateCopy(state, purpose) {
        if (state === STATES.READY) {
            return purpose.id === 'BASELINE'
                ? 'Ready to start your 3 minute resting baseline capture.'
                : 'Ready. Commit now to keep the rear stream alive for rPPG.';
        }

        if (state === STATES.STABILIZING) {
            return 'Signal looks usable. Hold a little steadier to reach READY.';
        }

        if (state === STATES.ALIGNING) {
            return 'Coverage is improving. Fully cover the rear lens and flash.';
        }

        return 'Cover the rear camera fully with a fingertip until the pulse signal locks.';
    }

    function getStateLabel(state) {
        if (state === STATES.READY) return 'Ready';
        if (state === STATES.STABILIZING) return 'Stabilizing';
        if (state === STATES.ALIGNING) return 'Aligning';
        return 'Not Detected';
    }

    function buildChecklist(snapshot, purpose) {
        var motionReady = snapshot.motionPermissionState === 'granted' ||
            snapshot.motionPermissionState === 'denied' ||
            snapshot.motionPermissionState === 'unsupported';

        return {
            signalQualityReady: snapshot.quality >= 0.54,
            coverageReady: snapshot.coverage >= 0.58,
            stabilityReady: snapshot.stability >= 0.48,
            cameraPermissionReady: motionReady && !!session.stream && purpose.id !== 'BASELINE'
                ? true
                : motionReady && !!session.stream
        };
    }

    function computeState(snapshot) {
        var now = Date.now();
        var coverageReady = snapshot.coverage >= 0.58;
        var qualityReady = snapshot.quality >= 0.54;
        var stabilityReady = snapshot.stability >= 0.48;

        if (!coverageReady || snapshot.quality < 0.32) {
            session.readySince = 0;
            return STATES.NOT_DETECTED;
        }

        if (!qualityReady) {
            session.readySince = 0;
            return STATES.ALIGNING;
        }

        if (!stabilityReady) {
            session.readySince = 0;
            return STATES.STABILIZING;
        }

        if (!session.readySince) {
            session.readySince = now;
        }

        if (now - session.readySince >= 900) {
            return STATES.READY;
        }

        return STATES.STABILIZING;
    }

    function updateRenderer() {
        var renderer = getRendererApi();
        var purpose = getPurpose();
        var metricsApi = getMetricsApi();
        var snapshot = session.lastSnapshot || {
            coverage: 0,
            stability: 0,
            quality: 0,
            motionPermissionState: metricsApi && metricsApi.getMotionPermissionState
                ? metricsApi.getMotionPermissionState()
                : 'unknown'
        };
        var checklist = buildChecklist(snapshot, purpose);

        if (!renderer) return;

        renderer.renderMetrics({
            stateLabel: getStateLabel(session.state),
            instruction: getStateCopy(session.state, purpose),
            subtitle: purpose.guidance,
            coverage: snapshot.coverage,
            stability: snapshot.stability,
            quality: snapshot.quality,
            checklist: checklist
        });

        if (getBaselineApi() && getBaselineApi().isRunning()) {
            renderer.setCommitState(false, 'Baseline Running');
        } else if (session.state === STATES.READY) {
            renderer.setCommitState(true, purpose.commitLabel);
        } else {
            renderer.setCommitState(false, purpose.commitLabel);
        }
    }

    function stopMetricLoop() {
        if (session.metricTimer) {
            clearInterval(session.metricTimer);
            session.metricTimer = null;
        }
    }

    function stopStream() {
        if (session.stream) {
            session.stream.getTracks().forEach(function (track) {
                track.stop();
            });
            session.stream = null;
        }
    }

    function detachVideo() {
        var renderer = getRendererApi();
        var shell;

        if (!renderer || typeof renderer.ensureShell !== 'function') return;

        shell = renderer.ensureShell();
        if (!shell || !shell.video) return;

        try {
            shell.video.pause();
        } catch (error) {
            console.warn('[FHZ] Unable to pause FHZ preview', error);
        }

        shell.video.srcObject = null;
    }

    function handlePurposeClick(event) {
        var button = event.target && event.target.closest('[data-purpose]');
        var purposes = getPurposesApi();
        var renderer = getRendererApi();

        if (!button || !purposes || !renderer) return;

        persistPurpose(button.getAttribute('data-purpose'));
        renderer.hideBaselinePanel();
        renderer.hideBaselineSummary();
        renderer.renderPurposeButtons(purposes.PURPOSES, session.purposeId);
        updateRenderer();
    }

    function bindUi() {
        var renderer = getRendererApi();
        var shell;

        if (!renderer || typeof renderer.ensureShell !== 'function') return;

        shell = renderer.ensureShell();
        if (shell._tenkiFhzBound) return;

        shell._tenkiFhzBound = true;
        shell.closeBtn.addEventListener('click', cancel);
        shell.cancelBtn.addEventListener('click', cancel);
        shell.commitBtn.addEventListener('click', commitToScan);
        shell.purposeRow.addEventListener('click', handlePurposeClick);
    }

    function startMetricLoop() {
        var metrics = getMetricsApi();
        var renderer = getRendererApi();
        var shell = renderer.ensureShell();

        if (!metrics) return;

        metrics.reset();
        metrics.startMotion();
        stopMetricLoop();

        session.metricTimer = setInterval(function () {
            var snapshot;

            if (!session.isOpen || !shell.video) return;

            snapshot = metrics.sample(shell.video);
            session.lastSnapshot = snapshot;
            session.state = computeState(snapshot);
            updateRenderer();
        }, 120);
    }

    function requestRearCamera() {
        var renderer = getRendererApi();
        var shell = renderer.ensureShell();

        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            return Promise.reject(new Error('mediaDevices unavailable'));
        }

        if (session.stream && session.stream.active) {
            shell.video.srcObject = session.stream;
            return shell.video.play().then(function () {
                return session.stream;
            }).catch(function () {
                return session.stream;
            });
        }

        return navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: { ideal: 'environment' },
                width: { ideal: 720 },
                height: { ideal: 1280 }
            },
            audio: false
        }).then(function (stream) {
            session.stream = stream;
            shell.video.srcObject = stream;
            return shell.video.play().then(function () {
                console.info('[FHZ] Rear camera stream ready');
                return stream;
            }).catch(function () {
                console.info('[FHZ] Rear camera stream attached without explicit play');
                return stream;
            });
        });
    }

    function close(options) {
        var settings = options || {};
        var renderer = getRendererApi();
        var metrics = getMetricsApi();
        var baseline = getBaselineApi();

        session.isOpen = false;
        stopMetricLoop();
        session.readySince = 0;
        session.state = STATES.NOT_DETECTED;
        session.lastSnapshot = null;

        if (baseline && baseline.isRunning()) {
            baseline.stop();
        }

        if (metrics) {
            metrics.stopMotion();
            metrics.reset();
        }

        if (!settings.preserveStream) {
            stopStream();
        }

        detachVideo();

        if (renderer) {
            renderer.close();
        }
    }

    function cancel() {
        close();
        document.dispatchEvent(new CustomEvent('tenki:fhz-cancel'));
    }

    function handleBaselineComplete(result) {
        var renderer = getRendererApi();

        stopMetricLoop();

        if (session.stream) {
            stopStream();
            detachVideo();
        }

        if (renderer) {
            renderer.showBaselineSummary(result);
            renderer.setCommitState(true, 'Done');
        }

        session.state = STATES.NOT_DETECTED;
    }

    function startBaselineCapture() {
        var renderer = getRendererApi();
        var shell = renderer.ensureShell();
        var baseline = getBaselineApi();

        if (!baseline) {
            console.warn('[FHZ] Baseline module unavailable');
            return;
        }

        renderer.showBaselinePanel({
            timeLabel: '03:00',
            signalLabel: 'Signal --',
            progressPercent: '0%',
            liveHr: '--',
            liveRmssd: '--',
            message: 'Stay calm and keep the rear camera fully covered.'
        });
        renderer.setCommitState(false, 'Baseline Running');

        baseline.start(shell.video, {
            onUpdate: function (payload) {
                renderer.showBaselinePanel({
                    timeLabel: payload.timeLabel,
                    signalLabel: payload.signalLabel,
                    progressPercent: Math.round(payload.progress * 100) + '%',
                    liveHr: payload.liveHr,
                    liveRmssd: payload.liveRmssd,
                    message: payload.message
                });
            },
            onComplete: handleBaselineComplete
        }).catch(function (error) {
            console.warn('[FHZ] Baseline capture failed to start', error);
            renderer.setCommitState(true, 'Retry Baseline');
        });
    }

    function commitToScan() {
        var purpose = getPurpose();
        var renderer = getRendererApi();
        var preservedStream;

        if (getBaselineApi() && getBaselineApi().isRunning()) return;

        if (purpose.id === 'BASELINE' && renderer && renderer.ensureShell().commitBtn.textContent === 'Done') {
            close();
            return;
        }

        if (session.state !== STATES.READY) return;

        if (purpose.id === 'BASELINE') {
            startBaselineCapture();
            return;
        }

        preservedStream = session.stream;
        close({ preserveStream: true });
        document.dispatchEvent(new CustomEvent('tenki:fhz-commit', {
            detail: {
                purpose: purpose.id,
                rppgMode: purpose.rppgMode,
                stream: preservedStream,
                facingMode: 'environment'
            }
        }));
    }

    function open(options) {
        var settings = options || {};
        var purposes = getPurposesApi();
        var renderer = getRendererApi();

        if (!renderer || !purposes) {
            return Promise.reject(new Error('FHZ dependencies unavailable'));
        }

        bindUi();

        if (settings.purpose) {
            persistPurpose(settings.purpose);
        }

        renderer.renderPurposeButtons(purposes.PURPOSES, session.purposeId);
        renderer.hideBaselinePanel();
        renderer.hideBaselineSummary();
        renderer.open();

        session.isOpen = true;
        session.state = STATES.NOT_DETECTED;
        session.readySince = 0;
        session.lastSnapshot = null;

        updateRenderer();

        return requestRearCamera().then(function () {
            startMetricLoop();
            updateRenderer();
            return true;
        }).catch(function (error) {
            console.warn('[FHZ] Unable to open rear camera for FHZ', error);
            cancel();
            throw error;
        });
    }

    function primePermissions() {
        var metrics = getMetricsApi();

        if (!metrics || typeof metrics.requestMotionPermission !== 'function') {
            return Promise.resolve(false);
        }

        return metrics.requestMotionPermission();
    }

    function getActiveStream() {
        return session.stream;
    }

    global.TENKI_FHZ = {
        STATES: STATES,
        open: open,
        close: close,
        cancel: cancel,
        commitToScan: commitToScan,
        primePermissions: primePermissions,
        getActiveStream: getActiveStream
    };
})(window);
