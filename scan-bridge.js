/**
 * scan-bridge.js — v4.5 Bridge: hint capsule + fingerprint tap → ring spin → camera → results
 *
 * Landing:
 *   - Shows alignment hint capsule ("FIND FACE") on page load
 *   - Stardust soul animation runs behind (stardust.js / expression.js untouched)
 *
 * Scan Flow:
 *   1. User taps fingerprint button (#scan-trigger-wrapper)
 *   2. Button activates: ripple rings + scan beam + progress circle spin
 *   3. Camera permission requested in parallel (browser popup if needed)
 *   4. After ring spin completes (~1.8s) → fade out landing → fade in results
 *   5. TENKI_SCAN_UX.start() begins 62-second progressive scan
 *
 * Camera fallback: if denied or unavailable → silent simulation mode (no error)
 */
(function (global) {
    'use strict';

    var isAnimating = false;
    var isResultsOpen = false;
    var cameraStream = null;
    var dashboardLayer = null;

    function getScanUX()   { return global.TENKI_SCAN_UX; }
    function getAudio()    { return global.TENKI_AUDIO; }
    function getStardust() { return global.TENKI_STARDUST; }

    // ─── Show alignment hint capsule on landing ───
    function showHintCapsule() {
        var capsule = document.getElementById('align-hint-capsule');
        if (!capsule) return;

        // Set "FIND FACE" state — matches v25.8.2 landing design
        var iconBox = document.getElementById('hint-icon-box');
        if (iconBox) iconBox.style.background = 'rgba(0,240,255,0.15)';
        var hintText = document.getElementById('hint-text');
        if (hintText) hintText.textContent = 'FIND FACE';

        // Show with animation
        capsule.classList.add('show');
    }

    function hideHintCapsule() {
        var capsule = document.getElementById('align-hint-capsule');
        if (capsule) capsule.classList.remove('show');
    }

    // ─── Init on DOM ready ───
    document.addEventListener('DOMContentLoaded', function () {
        dashboardLayer = document.getElementById('dashboard-layer');

        // Show hint capsule on landing page
        showHintCapsule();

        // Update connection status to match landing state
        var connStatus = document.getElementById('connection-status');
        if (connStatus) connStatus.textContent = 'SEARCHING \u2026';

        var scanTrigger = document.getElementById('scan-trigger-wrapper');
        if (!scanTrigger) {
            console.warn('[BRIDGE] #scan-trigger-wrapper not found');
            return;
        }

        // Single handler — prevent double-fire from click+touchend
        var lastTap = 0;
        function onTap(e) {
            if (e.type === 'touchend') e.preventDefault();
            var now = Date.now();
            if (now - lastTap < 500) return;
            lastTap = now;
            if (isAnimating || isResultsOpen) return;
            beginScanSequence(scanTrigger);
        }

        scanTrigger.addEventListener('click', onTap);
        scanTrigger.addEventListener('touchend', onTap);

        // Intercept app.js scan:complete (prevent it from doing anything else)
        document.addEventListener('scan:complete', function (e) {
            e.stopImmediatePropagation();
        }, true);
        document.addEventListener('tenki:scanDone', function (e) {
            e.stopImmediatePropagation();
        }, true);

        // Dashboard layer → redirect to results
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

    // ─── Main Sequence ───
    function beginScanSequence(btn) {
        isAnimating = true;
        console.info('[BRIDGE] Scan sequence started');

        // 1. Init audio on user gesture (iOS Safari requirement)
        var audio = getAudio();
        if (audio) {
            audio.init();
            audio.scanStart();
        }
        var haptics = global.TENKI_HAPTICS;
        if (haptics) haptics.tap();

        // 2. Hide hint capsule during scan
        hideHintCapsule();

        // 3. Activate button CSS animations (ripple + beam + pulse)
        btn.classList.add('active');

        // 3. Animate progress circle — fast spin fill
        var progressCircle = document.getElementById('scan-progress-bar');
        if (progressCircle) {
            var circumference = 339; // 2πr for r=54
            progressCircle.style.transition = 'none';
            progressCircle.setAttribute('stroke-dashoffset', String(circumference));
            void progressCircle.offsetHeight; // force reflow
            progressCircle.style.transition = 'stroke-dashoffset 1.6s cubic-bezier(0.22, 1, 0.36, 1)';
            progressCircle.setAttribute('stroke-dashoffset', '0');
        }

        // 4. Request camera in parallel (shows browser permission popup if needed)
        requestCamera();

        // 5. After animation → transition to results
        setTimeout(function () {
            // Deactivate button
            btn.classList.remove('active');
            if (progressCircle) {
                progressCircle.style.transition = 'none';
                progressCircle.setAttribute('stroke-dashoffset', '339');
            }

            isAnimating = false;
            showResultsPage();
        }, 1800);
    }

    // ─── Camera Permission ───
    function requestCamera() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            console.warn('[BRIDGE] mediaDevices unavailable — simulation mode');
            return;
        }

        navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
            audio: false
        }).then(function (stream) {
            cameraStream = stream;
            var camera = document.getElementById('camera');
            if (camera) {
                camera.srcObject = stream;
                camera.play().catch(function () {});
            }
            console.info('[BRIDGE] Camera authorized');
        }).catch(function (err) {
            console.warn('[BRIDGE] Camera denied/unavailable:', err.message || err);
            // Silent fallback — scan-ux.js uses simulation data
        });
    }

    // ─── Show Results Page ───
    function showResultsPage() {
        if (isResultsOpen) return;

        var resultsPage = document.getElementById('results-page');
        if (!resultsPage) {
            console.error('[BRIDGE] #results-page not found');
            return;
        }

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
            setTimeout(function () {
                hudLayer.style.display = 'none';
            }, 500);
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

        // Init audio context (if not already)
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

    // ─── Close Results ───
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

        // Stop camera
        if (cameraStream) {
            cameraStream.getTracks().forEach(function (t) { t.stop(); });
            cameraStream = null;
        }

        var resultsPage = document.getElementById('results-page');
        if (resultsPage) {
            resultsPage.classList.remove('fade-in');
            setTimeout(function () {
                resultsPage.classList.add('hidden');
            }, 600);
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

        // Restore hint capsule on landing
        showHintCapsule();
    }

    global.TENKI_BRIDGE = {
        showResults: showResultsPage,
        closeResults: closeResultsPage
    };
})(window);
