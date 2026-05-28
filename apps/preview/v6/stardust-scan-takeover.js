/**
 * stardust-scan-takeover.js — Drives the premium 3D stardust scanning ceremony
 *
 * Handles:
 *   - Redirection checking (?from=baseline)
 *   - Splash transition to 3D stardust takeover
 *   - Camera & MediaPipe FaceMesh expression tracking
 *   - Apple Pay style dynamic alignment guidance capsule
 *   - 8-second interactive fingerprint hold-to-scan button with conic progress ring
 *   - Successful completion climax golden flash & Today dashboard reveal
 */
(function (global) {
    'use strict';

    var isTakeoverActive = false;
    var isHolding = false;
    var progress = 0; // 0 to 1
    var scanDuration = 8000; // 8 seconds
    var lastFrameTime = 0;

    // Camera & FaceMesh state
    var cameraStream = null;
    var faceMeshInstance = null;
    var faceSyncLoop = null;
    var prevEyeOpen = 1;
    var lastFaceCenter = null;
    var lastFaceTime = 0;
    var lastHintChangeAt = 0;
    var lastHintId = '';

    var ALIGN_GUIDE = {
        sizeMin: 0.30,
        sizeMax: 0.65,
        centerXTol: 0.08,
        centerYTol: 0.09,
        rollDeg: 9,
        motionSpeed: 0.35,
        switchDelayMs: 350
    };

    function init() {
        // Guard: check if returning from baseline onboarding
        if (window.location.search.indexOf('from=baseline') === -1) {
            // Normal entry: reveal Today screen rings immediately after splash fades
            setTimeout(revealTodayRings, 2900);
            return;
        }

        // Bypassing mock baselineFlow: make sure it never opens
        window.openBaseline = function () { console.log('Baseline open bypassed in favor of stardust 3D takeover'); };
        window.bfGo = function () { };

        // Bind fingerprint hold event listeners
        var trigger = document.getElementById('scan-takeover-trigger');
        if (trigger) {
            trigger.addEventListener('mousedown', startHold);
            trigger.addEventListener('touchstart', function (e) {
                e.preventDefault();
                startHold();
            }, { passive: false });

            window.addEventListener('mouseup', endHold);
            window.addEventListener('touchend', endHold);
        }

        // Wait for the Brand Splash to fade out, then fade in stardust takeover
        // Splash auto-dismisses at 2400ms, fades 400ms → cleared by ~2850ms
        setTimeout(activateTakeover, 2900);
    }

    function activateTakeover() {
        var takeover = document.getElementById('stardust-scan-takeover');
        if (!takeover) return;

        isTakeoverActive = true;
        takeover.classList.add('active');

        // Start camera and FaceMesh tracking
        startCameraAndFaceSync();

        // Start progress update loop
        lastFrameTime = performance.now();
        requestAnimationFrame(updateLoop);
    }

    // ─── Camera & FaceMesh expression tracking ───
    function startCameraAndFaceSync() {
        var videoEl = document.getElementById('input-video');
        if (!videoEl) {
            // If videoEl doesn't exist, create it hidden
            videoEl = document.createElement('video');
            videoEl.id = 'input-video';
            videoEl.setAttribute('playsinline', 'true');
            videoEl.muted = true;
            videoEl.style.position = 'fixed';
            videoEl.style.top = '-9999px';
            videoEl.style.left = '-9999px';
            videoEl.style.opacity = '0';
            videoEl.style.pointerEvents = 'none';
            document.body.appendChild(videoEl);
        }

        var canvasEl = document.getElementById('light-analysis-canvas');
        if (!canvasEl) {
            canvasEl = document.createElement('canvas');
            canvasEl.id = 'light-analysis-canvas';
            canvasEl.width = 50;
            canvasEl.height = 50;
            canvasEl.style.position = 'fixed';
            canvasEl.style.top = '-9999px';
            canvasEl.style.left = '-9999px';
            canvasEl.style.opacity = '0';
            canvasEl.style.pointerEvents = 'none';
            document.body.appendChild(canvasEl);
        }

        if (typeof FaceMesh === 'undefined') {
            console.warn('[FHZ] MediaPipe FaceMesh not loaded — running in simulated tracking mode');
            setSimulatedCapsule();
            return;
        }

        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            console.warn('[FHZ] getUserMedia unavailable — running in simulated tracking mode');
            setSimulatedCapsule();
            return;
        }

        navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'user', width: { ideal: 320 }, height: { ideal: 240 } },
            audio: false
        }).then(function (stream) {
            cameraStream = stream;
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

                // Show dynamic capsule
                showCapsule();

                // Process frames at ~10fps (CPU/OOM safe)
                faceSyncLoop = setInterval(function () {
                    if (videoEl.readyState >= 2 && faceMeshInstance) {
                        faceMeshInstance.send({ image: videoEl }).catch(function () {});
                    }
                }, 100);

                console.log('[FHZ] FaceMesh expression sync active inside takeover');
            } catch (e) {
                console.warn('[FHZ] FaceMesh init failed, falling back to simulated:', e);
                setSimulatedCapsule();
            }
        }).catch(function (err) {
            console.warn('[FHZ] Camera unavailable, running in simulated tracking mode:', err.message || err);
            setSimulatedCapsule();
        });
    }

    function setSimulatedCapsule() {
        showCapsule();
        var hintText = document.getElementById('hint-text');
        var capsule = document.getElementById('align-hint-capsule');
        var iconBox = document.getElementById('hint-icon-box');

        if (hintText) hintText.innerHTML = 'INTEGRATING SIGNALS · 訊號整合中';
        if (capsule) {
            capsule.className = 'status-good show';
        }
        if (iconBox) {
            iconBox.style.background = 'rgba(0, 240, 255, 0.15)';
        }
    }

    function showCapsule() {
        var capsule = document.getElementById('align-hint-capsule');
        if (capsule) capsule.classList.add('show');
    }

    function onFaceResults(results) {
        var capsule = document.getElementById('align-hint-capsule');
        var hintText = document.getElementById('hint-text');
        var iconBox = document.getElementById('hint-icon-box');
        var stardust = window.TENKI_STARDUST;

        if (!results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) {
            // No face detected
            if (hintText) hintText.innerHTML = 'FIND FACE · 尋找臉部';
            if (capsule) {
                capsule.className = 'status-warn show';
            }
            if (iconBox) iconBox.style.background = 'rgba(234,179,8,0.15)';
            lastFaceCenter = null;
            lastFaceTime = 0;
            if (stardust && stardust.clearExpression) stardust.clearExpression();
            return;
        }

        var lm = results.multiFaceLandmarks[0];

        // Alignment guidance
        var align = getAlignmentHint(lm);
        var stableHint = stabilizeHint(align.hint);

        if (hintText) hintText.innerHTML = stableHint.en + ' · ' + stableHint.zh;

        if (stableHint.id === 'tracking') {
            if (capsule) {
                capsule.className = 'status-good show';
            }
            if (iconBox) iconBox.style.background = 'rgba(35,243,212,0.15)';
        } else {
            if (capsule) {
                capsule.className = 'status-warn show';
            }
            if (iconBox) iconBox.style.background = 'rgba(234,179,8,0.15)';
        }

        // Compute expression metrics
        var eyeL = Math.abs(lm[159].y - lm[145].y);
        var eyeR = Math.abs(lm[386].y - lm[374].y);
        var eyeOpen = Math.min(1, ((eyeL + eyeR) / 2) / 0.035);

        var mouthOpen = Math.min(1, Math.abs(lm[13].y - lm[14].y) / 0.05);

        var browDist = Math.abs(lm[105].x - lm[334].x);
        var browTension = Math.max(0, Math.min(1, 1 - browDist / 0.22));

        var blinkDetected = eyeOpen < 0.25 && prevEyeOpen > 0.55;
        prevEyeOpen = eyeOpen;

        // Push to 3D stardust particle system
        if (stardust && stardust.setExpression) {
            stardust.setExpression({
                mouthOpen: mouthOpen,
                eyeOpen: eyeOpen,
                blinkDetected: blinkDetected,
                browTension: browTension
            });
        }
    }

    function getAlignmentHint(lm) {
        var box = computeFaceBox(lm);
        var centerX = (box.minX + box.maxX) / 2;
        var centerY = (box.minY + box.maxY) / 2;
        var width = box.maxX - box.minX;
        var height = box.maxY - box.minY;
        var size = Math.max(width, height);

        var now = performance.now();
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

        var hint = { id: 'tracking', en: 'TRACKING', zh: '追蹤中' };

        if (size < ALIGN_GUIDE.sizeMin) {
            hint = { id: 'move_closer', en: 'MOVE CLOSER', zh: '靠近一點' };
        } else if (size > ALIGN_GUIDE.sizeMax) {
            hint = { id: 'move_farther', en: 'MOVE FARTHER', zh: '遠一點' };
        } else if (centerX < 0.5 - ALIGN_GUIDE.centerXTol) {
            hint = { id: 'move_right', en: 'MOVE RIGHT', zh: '向右對齊' };
        } else if (centerX > 0.5 + ALIGN_GUIDE.centerXTol) {
            hint = { id: 'move_left', en: 'MOVE LEFT', zh: '向左對齊' };
        } else if (centerY < 0.5 - ALIGN_GUIDE.centerYTol) {
            hint = { id: 'move_down', en: 'MOVE DOWN', zh: '向下對齊' };
        } else if (centerY > 0.5 + ALIGN_GUIDE.centerYTol) {
            hint = { id: 'move_up', en: 'MOVE UP', zh: '向上對齊' };
        } else if (Math.abs(rollDeg) > ALIGN_GUIDE.rollDeg) {
            hint = { id: 'straighten', en: 'STRAIGHTEN', zh: '頭部擺正' };
        } else if (motionSpeed > ALIGN_GUIDE.motionSpeed) {
            hint = { id: 'hold_still', en: 'HOLD STILL', zh: '保持穩定' };
        }

        return {
            hint: hint,
            aligned: hint.id === 'tracking'
        };
    }

    function stabilizeHint(candidate) {
        var now = performance.now();
        if (candidate.id === lastHintId) return candidate;

        if (now - lastHintChangeAt < ALIGN_GUIDE.switchDelayMs && lastHintId) {
            return {
                id: lastHintId,
                en: document.getElementById('hint-text').textContent.split(' · ')[0],
                zh: document.getElementById('hint-text').textContent.split(' · ')[1]
            };
        }

        lastHintId = candidate.id;
        lastHintChangeAt = now;
        return candidate;
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

    function stopFaceSync() {
        if (faceSyncLoop) { clearInterval(faceSyncLoop); faceSyncLoop = null; }
        if (faceMeshInstance) { faceMeshInstance = null; }
        if (cameraStream) {
            cameraStream.getTracks().forEach(function (t) { t.stop(); });
            cameraStream = null;
        }
        var stardust = window.TENKI_STARDUST;
        if (stardust && stardust.clearExpression) stardust.clearExpression();
    }

    // ─── Fingerprint holding & progress conic ring ───
    function startHold() {
        if (!isTakeoverActive) return;
        isHolding = true;

        var wrapper = document.getElementById('scan-takeover-trigger');
        var ring = document.getElementById('scan-takeover-progress-ring');
        if (wrapper) wrapper.classList.add('active');
        if (ring) ring.classList.add('active');

        // Play biometric sync start micro-haptics / vibration
        if (navigator.vibrate) {
            try { navigator.vibrate([15, 30]); } catch (_) {}
        }
    }

    function endHold() {
        if (!isHolding) return;
        isHolding = false;

        var wrapper = document.getElementById('scan-takeover-trigger');
        var ring = document.getElementById('scan-takeover-progress-ring');
        if (wrapper) wrapper.classList.remove('active');
        if (ring) ring.classList.remove('active');
    }

    function updateLoop(now) {
        if (!isTakeoverActive) return;

        var dt = now - lastFrameTime;
        lastFrameTime = now;

        if (isHolding) {
            progress += dt / scanDuration;
            if (progress >= 1) {
                progress = 1;
                triggerClimaxSuccess();
                return;
            }

            // Periodic haptic heartbeat tap every ~1000ms
            if (Math.floor((progress * scanDuration) / 1000) !== Math.floor(((progress * scanDuration) - dt) / 1000)) {
                if (navigator.vibrate) {
                    try { navigator.vibrate(10); } catch (_) {}
                }
            }
        } else {
            // Drain progress back smoothly
            progress -= dt / 1500; // drains in 1.5s
            if (progress < 0) progress = 0;
        }

        // Update CSS conic progress ring
        var ring = document.getElementById('scan-takeover-progress-ring');
        if (ring) {
            var pct = progress * 100;
            ring.style.background = 'conic-gradient(#00F0FF ' + pct + '%, transparent 0%)';
        }

        // Update scanning status badge
        var statusBadge = document.getElementById('scan-takeover-status-badge');
        if (statusBadge) {
            if (progress > 0) {
                statusBadge.textContent = 'SYNCHRONIZING ' + Math.round(progress * 100) + '%';
            } else {
                statusBadge.textContent = 'SYSTEM READY';
            }
        }

        requestAnimationFrame(updateLoop);
    }

    // ─── Golden Climax Success & Today Dashboard Reveal ───
    function triggerClimaxSuccess() {
        isTakeoverActive = false;
        endHold();

        // 1. Trigger Golden Climax Flash
        var flash = document.getElementById('stardust-scan-takeover-flash');
        if (flash) {
            flash.classList.add('active');
        }

        // Multi-frequency Success Haptics
        if (navigator.vibrate) {
            try { navigator.vibrate([40, 80, 150]); } catch (_) {}
        }

        // 2. Shut down camera and faceMesh quickly to avoid WebKit OOM pressure
        stopFaceSync();

        // 3. Fade out stardust takeover and fade out the golden flash to reveal the Today dashboard
        setTimeout(function () {
            var takeover = document.getElementById('stardust-scan-takeover');
            if (takeover) {
                takeover.classList.remove('active');
            }

            // Fade out golden flash slowly
            setTimeout(function () {
                if (flash) {
                    flash.style.transition = 'opacity 1s ease';
                    flash.classList.remove('active');
                }

                // Reveal Today screen rings beautifully with native entrance animations!
                revealTodayRings();
            }, 300);
        }, 600);
    }

    function revealTodayRings() {
        // Remove the takeover active class on body and html so Today dashboard fades in premium-style
        document.body.classList.remove('baseline-takeover-active');
        document.documentElement.classList.remove('baseline-takeover-active');

        // Reveal the Today screen Apple-style spectrum rings
        var outerRing = document.querySelector('.ring-outer-wrap');
        var innerRing = document.querySelector('.ring-inner-wrap');
        var dots = document.querySelectorAll('.ring-dot');

        if (outerRing) outerRing.classList.add('revealed');
        if (innerRing) innerRing.classList.add('revealed');
        dots.forEach(function (dot) {
            dot.classList.add('revealed');
        });

        // High-frequency random flicker score calculation (極速運算到位的數字)
        var scoreEl = document.getElementById('tlTlTlTeiScore');
        if (scoreEl && window.location.search.indexOf('from=baseline') !== -1) {
            var startTime = performance.now();
            var duration = 1200; // 1.2s high-speed calculation
            var interval = setInterval(function() {
                var elapsed = performance.now() - startTime;
                if (elapsed >= duration) {
                    clearInterval(interval);
                    scoreEl.textContent = '84';
                    scoreEl.style.transform = 'scale(1.08)';
                    setTimeout(function() {
                        scoreEl.style.transform = 'scale(1)';
                    }, 200);
                    // Haptic snap on completion
                    if (navigator.vibrate) {
                        try { navigator.vibrate([15, 30]); } catch (_) {}
                    }
                    // Unblock drift and set global values to 84
                    window.currentTlTei = 84;
                    window.targetTlTei = 84;
                    window.isDriftBlocked = false;
                } else {
                    // Random number flicker between 40 and 99
                    var randomNum = Math.floor(Math.random() * 59) + 40;
                    scoreEl.textContent = randomNum;
                    // Keep it centered and scaling slightly during calculation
                    scoreEl.style.transform = 'scale(' + (1.0 + Math.random() * 0.05).toFixed(3) + ')';
                }
            }, 40); // 40ms interval (25fps)
        }
    }

    // Auto-init when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    global.STARDUST_SCAN_TAKEOVER = {
        init: init
    };
})(window);
