/**
 * scan-bridge.js — v4.6 Bridge: environment scanner + face expression sync + scan flow
 *
 * Landing Page:
 *   - LUX/STAB environment scanner (camera brightness + device motion)
 *   - FaceMesh → ExpressionTracker → stardust particle sync
 *   - Alignment hint capsule ("FIND FACE" / "TRACKING")
 *
 * Scan Flow:
 *   1. User taps fingerprint button (#scan-trigger-wrapper)
 *   2. Ring spin animation (1.8s) + camera permission popup
 *   3. Fade landing → show results page
 *   4. TENKI_SCAN_UX.start() begins 62-second progressive scan
 *
 * Protected files: expression.js, ui/*.js, ui/*.css — zero changes
 */
(function (global) {
    'use strict';

    var isAnimating = false;
    var isResultsOpen = false;
    var cameraStream = null;
    var dashboardLayer = null;

    // Face sync state
    var faceSyncStream = null;
    var faceMeshInstance = null;
    var faceSyncLoop = null;
    var prevEyeOpen = 1;
    var lastFaceCenter = null;
    var lastFaceTime = 0;
    var lastHintId = null;
    var lastHintText = '';
    var lastHintChangeAt = 0;
    var alignEnteredAt = 0;
    var lastAlignPulseAt = 0;

    var ALIGN_GUIDE = {
        sizeMin: 0.32,
        sizeMax: 0.62,
        centerXTol: 0.08,
        centerYTol: 0.09,
        rollDeg: 9,
        motionSpeed: 0.35,
        switchDelayMs: 350,
        alignConfirmMs: 450,
        alignPulseCooldownMs: 3000
    };

    function getScanUX()   { return global.TENKI_SCAN_UX; }
    function getAudio()    { return global.TENKI_AUDIO; }
    function getStardust() { return global.TENKI_STARDUST; }

    // ══════════════════════════════════════════════
    //  ENVIRONMENT SCANNER (LUX + STAB)
    // ══════════════════════════════════════════════

    function initEnvironmentScanner() {
        var luxBar  = document.getElementById('env-lux-bar');
        var luxItem = document.getElementById('env-lux');
        var stabBar = document.getElementById('env-stab-bar');
        var stabItem = document.getElementById('env-stab');

        // ── LUX: try AmbientLightSensor, fallback to camera brightness ──
        if ('AmbientLightSensor' in window) {
            try {
                var sensor = new AmbientLightSensor();
                sensor.addEventListener('reading', function () {
                    var pct = Math.min(sensor.illuminance / 400, 1);
                    if (luxBar) luxBar.style.width = (pct * 100) + '%';
                    if (luxItem) luxItem.className = 'env-item ' + (pct > 0.25 ? 'good' : 'warn');
                });
                sensor.start();
            } catch (e) {
                setDefaultLux(luxBar, luxItem);
            }
        } else {
            // Will be updated by camera frame analysis when FaceMesh runs
            setDefaultLux(luxBar, luxItem);
        }

        // ── STAB: DeviceMotion for stability ──
        var stabHistory = [];

        function handleMotion(e) {
            var acc = e.accelerationIncludingGravity;
            if (!acc) return;
            stabHistory.push(Math.sqrt(acc.x * acc.x + acc.y * acc.y + acc.z * acc.z));
            if (stabHistory.length > 30) stabHistory.shift();
        }

        if ('DeviceMotionEvent' in window) {
            // iOS 13+ requires permission
            if (typeof DeviceMotionEvent.requestPermission === 'function') {
                // Will be requested on first user gesture (scan tap)
                setDefaultStab(stabBar, stabItem);
            } else {
                window.addEventListener('devicemotion', handleMotion);
            }
        } else {
            setDefaultStab(stabBar, stabItem);
        }

        // Update STAB bar periodically
        setInterval(function () {
            if (stabHistory.length < 5) return;
            var mean = 0;
            for (var i = 0; i < stabHistory.length; i++) mean += stabHistory[i];
            mean /= stabHistory.length;
            var variance = 0;
            for (var j = 0; j < stabHistory.length; j++) {
                variance += (stabHistory[j] - mean) * (stabHistory[j] - mean);
            }
            variance /= stabHistory.length;
            var stability = Math.max(0, Math.min(1, 1 - variance * 0.3));
            if (stabBar) stabBar.style.width = (stability * 100) + '%';
            if (stabItem) stabItem.className = 'env-item ' + (stability > 0.6 ? 'good' : 'warn');
        }, 600);
    }

    function setDefaultLux(bar, item) {
        if (bar) bar.style.width = '70%';
        if (item) item.className = 'env-item good';
    }

    function setDefaultStab(bar, item) {
        if (bar) bar.style.width = '90%';
        if (item) item.className = 'env-item good';
    }

    // ══════════════════════════════════════════════
    //  FACEMESH → EXPRESSION → STARDUST SYNC
    // ══════════════════════════════════════════════

    function updateLuxFromCamera(videoEl) {
        var canvas = document.getElementById('light-analysis-canvas');
        if (!canvas || !videoEl || videoEl.readyState < 2) return;
        try {
            var ctx = canvas.getContext('2d');
            ctx.drawImage(videoEl, 0, 0, 50, 50);
            var data = ctx.getImageData(0, 0, 50, 50).data;
            var sum = 0;
            for (var i = 0; i < data.length; i += 4) {
                sum += data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
            }
            var avg = sum / (50 * 50);
            var pct = Math.min(1, avg / 160);
            var luxBar = document.getElementById('env-lux-bar');
            var luxItem = document.getElementById('env-lux');
            if (luxBar) luxBar.style.width = (pct * 100) + '%';
            if (luxItem) luxItem.className = 'env-item ' + (pct > 0.25 ? 'good' : 'warn');
        } catch (e) { /* CORS or security error — ignore */ }
    }

    function ensureAlignFlashStyles() {
        if (document.getElementById('align-flash-style')) return;
        var style = document.createElement('style');
        style.id = 'align-flash-style';
        style.textContent = [
            '#align-hint-capsule.align-flash {',
            '  animation: alignFlash 420ms ease;',
            '}',
            '#hint-icon-box.align-flash {',
            '  animation: alignIconFlash 420ms ease;',
            '}',
            '@keyframes alignFlash {',
            '  0% { filter: drop-shadow(0 0 0 rgba(35,243,212,0)); }',
            '  55% { filter: drop-shadow(0 0 18px rgba(35,243,212,0.65)); }',
            '  100% { filter: drop-shadow(0 0 0 rgba(35,243,212,0)); }',
            '}',
            '@keyframes alignIconFlash {',
            '  0% { transform: scale(1); box-shadow: 0 0 0 rgba(35,243,212,0); }',
            '  55% { transform: scale(1.08); box-shadow: 0 0 12px rgba(35,243,212,0.55); }',
            '  100% { transform: scale(1); box-shadow: 0 0 0 rgba(35,243,212,0); }',
            '}'
        ].join('\n');
        document.head.appendChild(style);
    }

    function triggerAlignFlash() {
        var capsule = document.getElementById('align-hint-capsule');
        var iconBox = document.getElementById('hint-icon-box');
        if (!capsule) return;
        ensureAlignFlashStyles();

        capsule.classList.remove('align-flash');
        if (iconBox) iconBox.classList.remove('align-flash');
        void capsule.offsetWidth; // restart animation
        capsule.classList.add('align-flash');
        if (iconBox) iconBox.classList.add('align-flash');

        setTimeout(function () {
            if (capsule) capsule.classList.remove('align-flash');
            if (iconBox) iconBox.classList.remove('align-flash');
        }, 480);
    }

    function computeFaceBox(lm) {
        var minX = 1, minY = 1, maxX = 0, maxY = 0;
        for (var i = 0; i < lm.length; i++) {
            var p = lm[i];
            if (!p) continue;
            if (p.x < minX) minX = p.x;
            if (p.y < minY) minY = p.y;
            if (p.x > maxX) maxX = p.x;
            if (p.y > maxY) maxY = p.y;
        }
        return { minX: minX, minY: minY, maxX: maxX, maxY: maxY };
    }

    function getAlignmentHint(lm) {
        var box = computeFaceBox(lm);
        var centerX = (box.minX + box.maxX) / 2;
        var centerY = (box.minY + box.maxY) / 2;
        var width = box.maxX - box.minX;
        var height = box.maxY - box.minY;
        var size = Math.max(width, height);

        var now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
        var motionSpeed = 0;
        if (lastFaceCenter && lastFaceTime) {
            var dt = Math.max(1, now - lastFaceTime);
            var dx = centerX - lastFaceCenter.x;
            var dy = centerY - lastFaceCenter.y;
            motionSpeed = Math.sqrt(dx * dx + dy * dy) / (dt / 1000);
        }
        lastFaceCenter = { x: centerX, y: centerY };
        lastFaceTime = now;

        var rollDeg = 0;
        var eyeL = lm[33];
        var eyeR = lm[263];
        if (eyeL && eyeR) {
            var dxEye = eyeR.x - eyeL.x;
            var dyEye = eyeR.y - eyeL.y;
            rollDeg = Math.atan2(dyEye, dxEye) * 180 / Math.PI;
        }

        var hint = { id: 'tracking', text: 'TRACKING' };

        if (size < ALIGN_GUIDE.sizeMin) {
            hint = { id: 'move_closer', text: 'MOVE CLOSER · 靠近一點' };
        } else if (size > ALIGN_GUIDE.sizeMax) {
            hint = { id: 'move_farther', text: 'MOVE FARTHER · 遠一點' };
        } else if (centerX < 0.5 - ALIGN_GUIDE.centerXTol) {
            hint = { id: 'move_right', text: 'MOVE RIGHT · 向右一點' };
        } else if (centerX > 0.5 + ALIGN_GUIDE.centerXTol) {
            hint = { id: 'move_left', text: 'MOVE LEFT · 向左一點' };
        } else if (centerY < 0.5 - ALIGN_GUIDE.centerYTol) {
            hint = { id: 'move_down', text: 'MOVE DOWN · 向下一點' };
        } else if (centerY > 0.5 + ALIGN_GUIDE.centerYTol) {
            hint = { id: 'move_up', text: 'MOVE UP · 向上一點' };
        } else if (Math.abs(rollDeg) > ALIGN_GUIDE.rollDeg) {
            hint = { id: 'straighten', text: 'STRAIGHTEN · 轉正' };
        } else if (motionSpeed > ALIGN_GUIDE.motionSpeed) {
            hint = { id: 'hold_still', text: 'HOLD STILL · 保持穩定' };
        }

        return {
            hint: hint,
            aligned: hint.id === 'tracking'
        };
    }

    function stabilizeHint(candidate) {
        var now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
        if (candidate.id === lastHintId) return candidate;

        if (now - lastHintChangeAt < ALIGN_GUIDE.switchDelayMs) {
            return {
                id: lastHintId || candidate.id,
                text: lastHintText || candidate.text
            };
        }

        lastHintId = candidate.id;
        lastHintText = candidate.text;
        lastHintChangeAt = now;
        return candidate;
    }

    function onFaceResults(results) {
        var capsule = document.getElementById('align-hint-capsule');
        var hintText = document.getElementById('hint-text');
        var iconBox = document.getElementById('hint-icon-box');
        var stardust = getStardust();

        if (!results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) {
            // No face detected
            if (hintText) hintText.textContent = 'FIND FACE';
            if (capsule) { capsule.classList.remove('status-good'); capsule.classList.add('status-warn'); }
            if (iconBox) iconBox.style.background = 'rgba(234,179,8,0.15)';
            lastFaceCenter = null;
            lastFaceTime = 0;
            lastHintId = 'no_face';
            lastHintText = 'FIND FACE';
            lastHintChangeAt = 0;
            alignEnteredAt = 0;
            if (stardust && stardust.clearExpression) stardust.clearExpression();
            return;
        }

        var lm = results.multiFaceLandmarks[0];

        // Alignment guidance (Apple Pay style)
        var align = getAlignmentHint(lm);
        var stableHint = stabilizeHint(align.hint);
        if (hintText) hintText.textContent = stableHint.text;
        if (stableHint.id === 'tracking') {
            if (capsule) { capsule.classList.remove('status-warn'); capsule.classList.add('status-good'); }
            if (iconBox) iconBox.style.background = 'rgba(35,243,212,0.15)';
        } else {
            if (capsule) { capsule.classList.remove('status-good'); capsule.classList.add('status-warn'); }
            if (iconBox) iconBox.style.background = 'rgba(234,179,8,0.15)';
        }

        // Alignment success feedback (light haptic + soft ping)
        var now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
        if (stableHint.id === 'tracking') {
            if (!alignEnteredAt) alignEnteredAt = now;
            if (now - alignEnteredAt >= ALIGN_GUIDE.alignConfirmMs &&
                now - lastAlignPulseAt >= ALIGN_GUIDE.alignPulseCooldownMs) {
                lastAlignPulseAt = now;
                var audio = getAudio();
                if (audio && typeof audio.alignOk === 'function') audio.alignOk();
                var haptics = global.TENKI_HAPTICS;
                if (haptics && typeof haptics.tap === 'function') haptics.tap();
                triggerAlignFlash();
            }
        } else {
            alignEnteredAt = 0;
        }

        // ── Compute expression metrics from FaceMesh landmarks ──
        // Eye open: vertical distance upper-lower lid (landmarks 159/145, 386/374)
        var eyeL = Math.abs(lm[159].y - lm[145].y);
        var eyeR = Math.abs(lm[386].y - lm[374].y);
        var eyeOpen = Math.min(1, ((eyeL + eyeR) / 2) / 0.035);

        // Mouth open: vertical distance upper-lower lip (landmarks 13/14)
        var mouthOpen = Math.min(1, Math.abs(lm[13].y - lm[14].y) / 0.05);

        // Brow tension: horizontal distance between brows (landmarks 105/334)
        var browDist = Math.abs(lm[105].x - lm[334].x);
        var browTension = Math.max(0, Math.min(1, 1 - browDist / 0.22));

        // Blink detection
        var blinkDetected = eyeOpen < 0.25 && prevEyeOpen > 0.55;
        prevEyeOpen = eyeOpen;

        // Push to stardust particle animation (abstract expression only)
        if (stardust && stardust.setExpression) {
            stardust.setExpression({
                mouthOpen: mouthOpen,
                eyeOpen: eyeOpen,
                blinkDetected: blinkDetected,
                browTension: browTension
            });
        }

        // Push to expression tracker if available
        var exprTracker = global.TENKI_EXPRESSION;
        if (exprTracker && exprTracker._instance && exprTracker._instance.pushSample) {
            exprTracker._instance.pushSample(lm, Date.now());
        }

        // Update LUX from camera brightness (~every 10th frame)
        if (Math.random() < 0.1) {
            var videoEl = document.getElementById('input-video');
            updateLuxFromCamera(videoEl);
        }
    }

    function initFaceSync() {
        if (typeof FaceMesh === 'undefined') {
            console.warn('[BRIDGE] MediaPipe FaceMesh not loaded — expression sync disabled');
            return;
        }

        var videoEl = document.getElementById('input-video');
        if (!videoEl) return;

        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            console.warn('[BRIDGE] getUserMedia unavailable');
            return;
        }

        navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'user', width: { ideal: 320 }, height: { ideal: 240 } },
            audio: false
        }).then(function (stream) {
            faceSyncStream = stream;
            videoEl.srcObject = stream;
            return videoEl.play();
        }).then(function () {
            try {
                faceMeshInstance = new FaceMesh({
                    locateFile: function (file) {
                        return 'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/' + file;
                    }
                });
                faceMeshInstance.setOptions({
                    maxNumFaces: 1,
                    refineLandmarks: false,
                    minDetectionConfidence: 0.5,
                    minTrackingConfidence: 0.5
                });
                faceMeshInstance.onResults(onFaceResults);

                // Process frames at ~10fps
                faceSyncLoop = setInterval(function () {
                    if (videoEl.readyState >= 2 && faceMeshInstance) {
                        faceMeshInstance.send({ image: videoEl }).catch(function () {});
                    }
                }, 100);

                console.info('[BRIDGE] FaceMesh expression sync active');
            } catch (e) {
                console.warn('[BRIDGE] FaceMesh init failed:', e);
            }
        }).catch(function (err) {
            console.warn('[BRIDGE] Camera unavailable for face sync:', err.message || err);
        });
    }

    function stopFaceSync() {
        if (faceSyncLoop) { clearInterval(faceSyncLoop); faceSyncLoop = null; }
        if (faceMeshInstance) { faceMeshInstance = null; }
        if (faceSyncStream) {
            faceSyncStream.getTracks().forEach(function (t) { t.stop(); });
            faceSyncStream = null;
        }
        var stardust = getStardust();
        if (stardust && stardust.clearExpression) stardust.clearExpression();
    }

    // ══════════════════════════════════════════════
    //  HINT CAPSULE
    // ══════════════════════════════════════════════

    function showHintCapsule() {
        var capsule = document.getElementById('align-hint-capsule');
        if (!capsule) return;
        var iconBox = document.getElementById('hint-icon-box');
        if (iconBox) iconBox.style.background = 'rgba(0,240,255,0.15)';
        var hintText = document.getElementById('hint-text');
        if (hintText) hintText.textContent = 'FIND FACE';
        capsule.classList.add('show');
    }

    function hideHintCapsule() {
        var capsule = document.getElementById('align-hint-capsule');
        if (capsule) capsule.classList.remove('show');
    }

    // ══════════════════════════════════════════════
    //  INIT ON DOM READY
    // ══════════════════════════════════════════════

    document.addEventListener('DOMContentLoaded', function () {
        dashboardLayer = document.getElementById('dashboard-layer');

        // Show hint capsule on landing
        showHintCapsule();

        // Update connection status
        var connStatus = document.getElementById('connection-status');
        if (connStatus) connStatus.textContent = 'SEARCHING \u2026';

        // Start environment scanner (LUX + STAB bars)
        initEnvironmentScanner();

        // Face SVG disabled — pure abstract stardust, no concrete facial features
        // Destroy any existing face SVG to ensure no eyes/mouth appear
        var face = global.TENKI_FACE;
        if (face && face.destroy) face.destroy();

        // Start FaceMesh face sync (camera → expression → stardust particles only)
        // Small delay so other modules finish init
        setTimeout(initFaceSync, 800);

        // ── Scan trigger (v25.8.2 HOLD-TO-SCAN) ──
        var scanTrigger = document.getElementById('scan-trigger-wrapper');
        if (!scanTrigger) {
            console.warn('[BRIDGE] #scan-trigger-wrapper not found');
            return;
        }

        var ringOverlay = document.getElementById('scan-ring-overlay');

        function startHoldScan(e) {
            if (e.type === 'touchstart') e.preventDefault();
            if (isAnimating || isResultsOpen) return;
            beginHoldScan(scanTrigger, ringOverlay);
        }

        function cancelHoldScan(e) {
            if (!isAnimating) return;
            cancelScan(scanTrigger, ringOverlay);
        }

        scanTrigger.addEventListener('mousedown', startHoldScan);
        scanTrigger.addEventListener('touchstart', startHoldScan, { passive: false });
        scanTrigger.addEventListener('mouseup', cancelHoldScan);
        scanTrigger.addEventListener('mouseleave', cancelHoldScan);
        scanTrigger.addEventListener('touchend', cancelHoldScan);
        scanTrigger.addEventListener('touchcancel', cancelHoldScan);

        // Intercept app.js scan events
        document.addEventListener('scan:complete', function (e) {
            e.stopImmediatePropagation();
        }, true);
        document.addEventListener('tenki:scanDone', function (e) {
            e.stopImmediatePropagation();
        }, true);

        // Dashboard layer → suppress (results page replaces it)
        if (dashboardLayer) {
            var observer = new MutationObserver(function (mutations) {
                for (var i = 0; i < mutations.length; i++) {
                    if (mutations[i].attributeName === 'class' && dashboardLayer.classList.contains('show')) {
                        dashboardLayer.classList.remove('show');
                        dashboardLayer.style.display = 'none';
                        break;
                    }
                }
            });
            observer.observe(dashboardLayer, { attributes: true, attributeFilter: ['class'] });
        }
    });

    // ══════════════════════════════════════════════
    //  HOLD-TO-SCAN with CSS Conic-Gradient Ring
    // ══════════════════════════════════════════════

    var scanElapsed = 0;
    var scanInterval = null;
    var SCAN_DURATION = 1800; // 1.8 seconds to complete

    function beginHoldScan(btn, ring) {
        isAnimating = true;
        scanElapsed = 0;
        console.info('[BRIDGE] Hold-to-scan started');

        // Stop face sync (free camera for rPPG)
        stopFaceSync();

        // Audio + haptics
        var audio = getAudio();
        if (audio) { audio.init(); audio.scanStart(); }
        var haptics = global.TENKI_HAPTICS;
        if (haptics) haptics.tap();

        // Hide hint capsule
        hideHintCapsule();

        // Activate button animations (ripple, beam, glow)
        btn.classList.add('active');

        // Show ring overlay and reset to 0%
        if (ring) {
            ring.style.background = 'conic-gradient(#00F0FF 0%, transparent 0%)';
            ring.classList.add('active');
        }

        // Progressive ring fill via setInterval
        scanInterval = setInterval(function () {
            scanElapsed += 50;
            var progress = Math.min(1, scanElapsed / SCAN_DURATION);
            var degrees = progress * 360;

            // Update conic-gradient clockwise fill
            if (ring) {
                ring.style.background = 'conic-gradient(from -90deg, #00F0FF ' + degrees + 'deg, transparent ' + degrees + 'deg)';
            }

            if (scanElapsed >= SCAN_DURATION) {
                clearInterval(scanInterval);
                scanInterval = null;
                finishHoldScan(btn, ring);
            }
        }, 50);

        // Request camera for rPPG
        requestCamera();
    }

    function cancelScan(btn, ring) {
        if (scanInterval) {
            clearInterval(scanInterval);
            scanInterval = null;
        }
        btn.classList.remove('active');
        if (ring) {
            ring.classList.remove('active');
            ring.style.background = 'conic-gradient(#00F0FF 0%, transparent 0%)';
        }
        isAnimating = false;
        console.info('[BRIDGE] Hold-to-scan cancelled');
    }

    function finishHoldScan(btn, ring) {
        btn.classList.remove('active');
        // Brief flash at 100% before hiding
        setTimeout(function () {
            if (ring) {
                ring.classList.remove('active');
                ring.style.background = 'conic-gradient(#00F0FF 0%, transparent 0%)';
            }
            isAnimating = false;
            showResultsPage();
        }, 200);
    }

    // ── Camera for rPPG ──
    function requestCamera() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;

        navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
            audio: false
        }).then(function (stream) {
            cameraStream = stream;
            var cam = document.getElementById('camera') || document.getElementById('input-video');
            if (cam) {
                cam.srcObject = stream;
                cam.play().catch(function () {});
            }
            console.info('[BRIDGE] Camera authorized for rPPG');
        }).catch(function (err) {
            console.warn('[BRIDGE] Camera denied:', err.message || err);
        });
    }

    // ══════════════════════════════════════════════
    //  RESULTS PAGE
    // ══════════════════════════════════════════════

    function showResultsPage() {
        if (isResultsOpen) return;

        var resultsPage = document.getElementById('results-page');
        if (!resultsPage) return;

        isResultsOpen = true;
        console.info('[BRIDGE] Transitioning to results page');

        // Dim stardust soul
        var stardust = getStardust();
        if (stardust && stardust.dim) stardust.dim();

        // Dim universe
        var universe = document.getElementById('universe');
        if (universe) {
            universe.style.transition = 'opacity 0.8s ease';
            universe.style.opacity = '0.15';
        }

        // Hide HUD layer
        var hudLayer = document.getElementById('hud-layer');
        if (hudLayer) {
            hudLayer.style.transition = 'opacity 0.5s ease';
            hudLayer.style.opacity = '0';
            setTimeout(function () { hudLayer.style.display = 'none'; }, 500);
        }

        // Hide dashboard
        if (dashboardLayer) {
            dashboardLayer.classList.remove('show');
            dashboardLayer.style.display = 'none';
        }

        // Show results overlay with fade
        resultsPage.classList.remove('hidden');
        void resultsPage.offsetHeight;
        resultsPage.classList.add('fade-in');

        // Audio
        var audio = getAudio();
        if (audio) audio.init();

        // Start 62-second progressive scan
        var scanUX = getScanUX();
        if (scanUX) {
            scanUX.start();
            console.info('[BRIDGE] Scan UX started');
        } else {
            var results = global.TENKI_RESULTS;
            if (results) {
                results.init();
                results.showWarmup();
            }
        }
    }

    // ── Close Results ──
    document.addEventListener('click', function (e) {
        if (e.target && (e.target.id === 'results-close-btn' || e.target.closest('#results-close-btn'))) {
            closeResultsPage();
        }
    });

    function closeResultsPage() {
        if (!isResultsOpen) return;
        isResultsOpen = false;

        var scanUX = getScanUX();
        if (scanUX) scanUX.stop();

        // Stop rPPG camera
        if (cameraStream) {
            cameraStream.getTracks().forEach(function (t) { t.stop(); });
            cameraStream = null;
        }

        var resultsPage = document.getElementById('results-page');
        if (resultsPage) {
            resultsPage.classList.remove('fade-in');
            setTimeout(function () { resultsPage.classList.add('hidden'); }, 600);
        }

        // Restore stardust
        var stardust = getStardust();
        if (stardust && stardust.brighten) stardust.brighten();

        // Restore universe
        var universe = document.getElementById('universe');
        if (universe) {
            universe.style.transition = 'opacity 0.8s ease';
            universe.style.opacity = '1';
        }

        // Restore HUD
        var hudLayer = document.getElementById('hud-layer');
        if (hudLayer) {
            hudLayer.style.display = '';
            hudLayer.style.opacity = '';
        }

        // Restore hint capsule + restart face sync
        showHintCapsule();
        setTimeout(initFaceSync, 800);
    }

    global.TENKI_BRIDGE = {
        showResults: showResultsPage,
        closeResults: closeResultsPage
    };
})(window);
