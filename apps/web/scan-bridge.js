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

    // ══════════════════════════════════════════════
    //  ONBOARDING MODAL (first visit only)
    // ══════════════════════════════════════════════

    function showOnboardingIfNeeded() {
        if (localStorage.getItem('tenki_onboarded') === '1') return;

        var overlay = document.createElement('div');
        overlay.className = 'tenki-onboard-overlay';
        overlay.innerHTML =
            '<div class="tenki-onboard-card">' +
            '  <div class="tenki-onboard-emoji"><span class="tenki-onboard-hero-chip"><i data-lucide="activity"></i></span></div>' +
            '  <div class="tenki-onboard-title">歡迎使用 TENKI</div>' +
            '  <div class="tenki-onboard-subtitle">預設為健康壓力模式：30 秒即時生理融合分析，持續提升決策品質與控制感</div>' +
            '  <div class="tenki-onboard-divider"></div>' +
            '  <div class="tenki-onboard-section">' +
            '    <div class="tenki-onboard-badge"><i data-lucide="target"></i><span>模式定位</span></div>' +
            '    <div class="tenki-onboard-desc">預設：健康壓力模式（一般決策）<br>設定可切換 Trader Mode，交易用語與功能同步套用</div>' +
            '  </div>' +
            '  <div class="tenki-onboard-steps">' +
            '    <div class="tenki-onboard-step"><span class="tenki-onboard-step-num">1</span>長按螢幕中央按鈕</div>' +
            '    <div class="tenki-onboard-step"><span class="tenki-onboard-step-num">2</span>允許鏡頭（僅用於臉部生理訊號分析，不做人臉辨識）</div>' +
            '    <div class="tenki-onboard-step"><span class="tenki-onboard-step-num">3</span>30 秒後查看你的 TEI 與決策狀態</div>' +
            '  </div>' +
            '  <button class="tenki-onboard-btn" id="tenki-onboard-start">進入預設模式開始掃描</button>' +
            '  <button class="tenki-onboard-link" id="tenki-onboard-learn">了解模式與 TEI</button>' +
            '</div>';

        document.body.appendChild(overlay);
        if (global.lucide && typeof global.lucide.createIcons === 'function') {
            global.lucide.createIcons();
        }

        // Animate in
        requestAnimationFrame(function() {
            overlay.classList.add('tenki-onboard-show');
        });

        function dismiss() {
            localStorage.setItem('tenki_onboarded', '1');
            overlay.classList.remove('tenki-onboard-show');
            overlay.classList.add('tenki-onboard-hide');
            setTimeout(function() {
                if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
            }, 400);
        }

        document.getElementById('tenki-onboard-start').addEventListener('click', dismiss);

        // "了解 TEI" shows inline explanation
        document.getElementById('tenki-onboard-learn').addEventListener('click', function() {
            var desc = overlay.querySelector('.tenki-onboard-desc');
            if (desc) {
                desc.innerHTML =
                    '<strong>TEI = Total Energy Index</strong><br>' +
                    '結合心率、心率變異性、呼吸率三大生理指標<br>' +
                    '轉換為 1-99 的百分位排名 (PR99)<br><br>' +
                    '<strong>隱私設計：</strong>影像僅在本機即時運算，不上傳雲端、不保存原始影像<br>' +
                    '<strong>辨識邊界：</strong>僅做生理訊號估計，不做人臉辨識<br><br>' +
                    '<strong>預設模式：</strong>健康壓力模式（一般決策語境）<br>' +
                    '<strong>設定切換：</strong>Trader Mode（交易語境與功能同步）<br><br>' +
                    '<strong>80-99</strong> <span class="material-symbols-outlined ferrari-icon" style="font-size:14px">speed</span> 高能量 — 適合挑戰性決策<br>' +
                    '<strong>55-79</strong> <span class="material-symbols-outlined ferrari-icon" style="font-size:14px">rocket_launch</span> 最佳區間 — 決策品質最高<br>' +
                    '<strong>35-54</strong> <span class="material-symbols-outlined ferrari-icon" style="font-size:14px">airline_seat_recline_normal</span> 穩定觀察 — 避免衝動判斷<br>' +
                    '<strong>01-34</strong> <span class="material-symbols-outlined ferrari-icon" style="font-size:14px">warning</span> 建議休息 — 暫緩重要決策';
                desc.style.fontSize = '12px';
                desc.style.lineHeight = '1.6';
            }
        });

        // Click backdrop to dismiss
        overlay.addEventListener('click', function(e) {
            if (e.target === overlay) dismiss();
        });
    }

    document.addEventListener('DOMContentLoaded', function () {
        dashboardLayer = document.getElementById('dashboard-layer');

        // Show onboarding modal for first-time users
        showOnboardingIfNeeded();

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
    var scanCommitted = false;
    var SCAN_DURATION = 1800; // 1.8 seconds for full ring animation

    function beginHoldScan(btn, ring) {
        isAnimating = true;
        scanElapsed = 0;
        scanCommitted = false;
        console.info('[BRIDGE] Scan touch started');

        // Audio + haptics (immediate feedback)
        var audio = getAudio();
        if (audio) { audio.init(); audio.scanStart(); }
        var haptics = global.TENKI_HAPTICS;
        if (haptics) haptics.tap();

        // Hide hint capsule
        hideHintCapsule();

        // Hide scan guide text + remove waiting dots
        document.body.classList.add('tenki-scanning');
        document.querySelectorAll('.tenki-waiting-dots').forEach(function(el) {
            el.classList.remove('tenki-waiting-dots');
        });

        // Activate button animations (ripple, beam, glow)
        btn.classList.add('active');

        // Show ring overlay and reset to 0%
        if (ring) {
            ring.style.background = 'conic-gradient(#00F0FF 0%, transparent 0%)';
            ring.classList.add('active');
        }

        // Progressive ring fill via setInterval (cosmetic only)
        scanInterval = setInterval(function () {
            scanElapsed += 50;
            var progress = Math.min(1, scanElapsed / SCAN_DURATION);
            var degrees = progress * 360;

            if (ring) {
                ring.style.background = 'conic-gradient(from -90deg, #00F0FF ' + degrees + 'deg, transparent ' + degrees + 'deg)';
            }

            // Ring filled → auto-commit (user still holding)
            if (scanElapsed >= SCAN_DURATION) {
                clearInterval(scanInterval);
                scanInterval = null;
                commitScan(btn, ring);
            }
        }, 50);

        // Camera request is deferred to showResultsPage() to avoid
        // permission dialog blocking the UI during tap
    }

    function cancelScan(btn, ring) {
        // Early release = cancel. Only a full 1.8s hold triggers commitScan.
        if (scanInterval) {
            clearInterval(scanInterval);
            scanInterval = null;
        }

        btn.classList.remove('active');
        if (ring) {
            ring.classList.remove('active');
            ring.style.background = 'conic-gradient(#00F0FF 0%, transparent 0%)';
        }

        scanElapsed = 0;
        isAnimating = false;
        console.info('[BRIDGE] Scan cancelled (released early)');
    }

    function commitScan(btn, ring) {
        if (scanCommitted) return;
        scanCommitted = true;

        console.info('[BRIDGE] Scan committed (' + scanElapsed + 'ms held)');

        btn.classList.remove('active');
        if (ring) {
            ring.classList.remove('active');
            ring.style.background = 'conic-gradient(#00F0FF 0%, transparent 0%)';
        }
        isAnimating = false;

        // Stop face sync before transitioning to results
        stopFaceSync();

        // Pre-build results DOM while still hidden, then reveal
        var resultsPage = document.getElementById('results-page');
        var scanUX = getScanUX();
        var results = global.TENKI_RESULTS;
        if (results && resultsPage) {
            try {
                results.init();      // build DOM while hidden
                results.showWarmup();
            } catch (e) {
                console.error('[BRIDGE] Results pre-init error:', e);
            }
        }

        // Show achievement toast, then transition to results
        showScanCompleteToast(function() {
            showResultsPage();
        });
    }

    // ── Scan Complete Achievement Toast ──
    function showScanCompleteToast(onDone) {
        // Read TEI from dashboard
        var scoreEl = document.getElementById('dash-score');
        var teiVal = scoreEl ? parseInt(scoreEl.textContent, 10) : null;
        if (!teiVal || isNaN(teiVal)) teiVal = null;

        var zone = 'NEUTRAL';
        var emojiIcon = 'airline_seat_recline_normal';
        if (teiVal !== null) {
            if (teiVal >= 80) { zone = 'PEAK'; emojiIcon = 'speed'; }
            else if (teiVal >= 55) { zone = 'OPTIMAL'; emojiIcon = 'rocket_launch'; }
            else if (teiVal >= 35) { zone = 'NEUTRAL'; emojiIcon = 'airline_seat_recline_normal'; }
            else { zone = 'DEGRADED'; emojiIcon = 'warning'; }
        }

        var toast = document.createElement('div');
        toast.className = 'tenki-scan-toast';
        toast.innerHTML =
            '<div class="tenki-scan-toast-title"><span class="material-symbols-outlined ferrari-icon" style="font-size:16px">flag</span> 掃描完成</div>' +
            (teiVal !== null
                ? '<div class="tenki-scan-toast-score">你的 TEI 指數：' + teiVal + ' <span class="material-symbols-outlined ferrari-icon">' + emojiIcon + '</span></div>'
                : '<div class="tenki-scan-toast-score">準備顯示結果 <span class="material-symbols-outlined ferrari-icon">' + emojiIcon + '</span></div>');

        document.body.appendChild(toast);

        // Force reflow then animate in
        toast.offsetHeight;
        toast.classList.add('tenki-scan-toast-show');

        // After 1.2s visible, fade out then callback
        setTimeout(function() {
            toast.classList.remove('tenki-scan-toast-show');
            toast.classList.add('tenki-scan-toast-hide');
            setTimeout(function() {
                if (toast.parentNode) toast.parentNode.removeChild(toast);
                if (onDone) onDone();
            }, 300);
        }, 1200);
    }

    // ── Camera for rPPG (returns Promise) ──
    function requestCamera() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            return Promise.reject(new Error('mediaDevices unavailable'));
        }

        return navigator.mediaDevices.getUserMedia({
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
            return stream;
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

        // Show results overlay with fade (DOM already pre-built by commitScan)
        if (!resultsPage.classList.contains('rp-ready')) {
            resultsPage.classList.add('rp-ready');
        }
        resultsPage.classList.remove('hidden');
        void resultsPage.offsetHeight;
        resultsPage.classList.add('fade-in');

        // Audio
        var audio = getAudio();
        if (audio) audio.init();

        // Start progressive metrics immediately so results never feel empty.
        var scanUX = getScanUX();
        if (scanUX && typeof scanUX.start === 'function' &&
            (!scanUX.isRunning || !scanUX.isRunning())) {
            scanUX.start();
            console.info('[BRIDGE] Scan UX started (instant)');
        }

        // Defer camera request slightly to avoid blocking the transition.
        setTimeout(function () {
            requestCamera().then(function () {
                // Camera authorized; start scan if not yet running.
                if (scanUX && typeof scanUX.start === 'function' &&
                    (!scanUX.isRunning || !scanUX.isRunning())) {
                    scanUX.start();
                    console.info('[BRIDGE] Scan UX started (camera authorized)');
                } else {
                    var results = global.TENKI_RESULTS;
                    if (results) {
                        results.init();
                        results.showWarmup();
                    }
                }
            }).catch(function (err) {
                console.warn('[BRIDGE] Camera denied:', err.message || err);
                alert('\u26A0\uFE0F \u76F8\u6A5F\u6388\u6B0A\u5931\u6557\u6216\u7121\u6CD5\u4F7F\u7528\uFF0C\u5DF2\u53D6\u6D88\u6383\u63CF\u3002');
                closeResultsPage();
            });
        }, 120);
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

        // Cleanup results renderer (stops nebula RAF + ANS interval)
        var results = global.TENKI_RESULTS;
        if (results && results.destroy) results.destroy();

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
            hudLayer.style.opacity = '1';
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
