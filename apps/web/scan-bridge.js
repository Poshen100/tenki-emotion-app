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
    var lastHintEn = '';
    var lastHintZh = '';
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

        var hint = { id: 'tracking', en: 'TRACKING', zh: '追蹤中' };

        if (size < ALIGN_GUIDE.sizeMin) {
            hint = { id: 'move_closer', en: 'MOVE CLOSER', zh: '靠近一點' };
        } else if (size > ALIGN_GUIDE.sizeMax) {
            hint = { id: 'move_farther', en: 'MOVE FARTHER', zh: '遠一點' };
        } else if (centerX < 0.5 - ALIGN_GUIDE.centerXTol) {
            hint = { id: 'move_right', en: 'MOVE RIGHT', zh: '向右一點' };
        } else if (centerX > 0.5 + ALIGN_GUIDE.centerXTol) {
            hint = { id: 'move_left', en: 'MOVE LEFT', zh: '向左一點' };
        } else if (centerY < 0.5 - ALIGN_GUIDE.centerYTol) {
            hint = { id: 'move_down', en: 'MOVE DOWN', zh: '向下一點' };
        } else if (centerY > 0.5 + ALIGN_GUIDE.centerYTol) {
            hint = { id: 'move_up', en: 'MOVE UP', zh: '向上一點' };
        } else if (Math.abs(rollDeg) > ALIGN_GUIDE.rollDeg) {
            hint = { id: 'straighten', en: 'STRAIGHTEN', zh: '轉正' };
        } else if (motionSpeed > ALIGN_GUIDE.motionSpeed) {
            hint = { id: 'hold_still', en: 'HOLD STILL', zh: '保持穩定' };
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
                en: lastHintEn || candidate.en,
                zh: lastHintZh || candidate.zh
            };
        }

        lastHintId = candidate.id;
        lastHintEn = candidate.en;
        lastHintZh = candidate.zh;
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
            if (hintText) hintText.innerHTML = '<span class="hint-en">FIND FACE</span><span class="hint-zh">尋找臉部</span>';
            if (capsule) { capsule.classList.remove('status-good'); capsule.classList.add('status-warn'); }
            if (iconBox) iconBox.style.background = 'rgba(234,179,8,0.15)';
            lastFaceCenter = null;
            lastFaceTime = 0;
            lastHintId = 'no_face';
            lastHintEn = 'FIND FACE';
            lastHintZh = '尋找臉部';
            lastHintChangeAt = 0;
            alignEnteredAt = 0;
            if (stardust && stardust.clearExpression) stardust.clearExpression();
            return;
        }

        var lm = results.multiFaceLandmarks[0];

        // Alignment guidance (Apple Pay style)
        var align = getAlignmentHint(lm);
        var stableHint = stabilizeHint(align.hint);
        if (hintText) hintText.innerHTML = '<span class="hint-en">' + stableHint.en + '</span><span class="hint-zh">' + stableHint.zh + '</span>';
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
            console.warn('[FHZ] MediaPipe FaceMesh not loaded — expression sync disabled');
            return;
        }

        var videoEl = document.getElementById('input-video');
        if (!videoEl) return;

        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            console.warn('[FHZ] getUserMedia unavailable');
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

                console.info('[FHZ] FaceMesh expression sync active');
            } catch (e) {
                console.warn('[FHZ] FaceMesh init failed:', e);
            }
        }).catch(function (err) {
            console.warn('[FHZ] Camera unavailable for face sync:', err.message || err);
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
        if (hintText) hintText.innerHTML = '<span class="hint-en">FIND FACE</span><span class="hint-zh">尋找臉部</span>';
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
                    '<strong>35-54</strong> <span class="material-symbols-outlined ferrari-icon" style="font-size:14px">equalizer</span> 穩定觀察 — 避免衝動判斷<br>' +
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

    var fhzModulesPromise = null;
    var processingElements = null;
    var rppgSession = null;
    var scanElapsed = 0;
    var scanInterval = null;
    var scanCommitted = false;
    var SCAN_DURATION = 1800;
    var activeCameraFacingMode = 'user';
    var motionPermissionPrimed = false;
    var scanUxKickoffTimer = null;

    var FHZ_SCRIPT_PATHS = [
        'fhz/fhz-purposes.js',
        'fhz/fhz-metrics.js',
        'fhz/fhz-renderer.js',
        'fhz/fhz-baseline.js',
        'fhz/fhz-controller.js'
    ];

    function loadScriptOnce(src) {
        return new Promise(function (resolve, reject) {
            var existing = document.querySelector('script[src="' + src + '"]');
            var script;

            if (existing && existing.getAttribute('data-tenki-loaded') === '1') {
                resolve();
                return;
            }

            if (existing) {
                existing.addEventListener('load', function () {
                    existing.setAttribute('data-tenki-loaded', '1');
                    resolve();
                }, { once: true });
                existing.addEventListener('error', function () {
                    reject(new Error('Unable to load ' + src));
                }, { once: true });
                return;
            }

            script = document.createElement('script');
            script.src = src;
            script.async = false;
            script.onload = function () {
                script.setAttribute('data-tenki-loaded', '1');
                resolve();
            };
            script.onerror = function () {
                reject(new Error('Unable to load ' + src));
            };
            document.body.appendChild(script);
        });
    }

    function ensureFhzModules() {
        if (global.TENKI_FHZ) {
            return Promise.resolve(global.TENKI_FHZ);
        }

        if (!fhzModulesPromise) {
            fhzModulesPromise = FHZ_SCRIPT_PATHS.reduce(function (chain, src) {
                return chain.then(function () {
                    return loadScriptOnce(src);
                });
            }, Promise.resolve()).then(function () {
                if (!global.TENKI_FHZ) {
                    throw new Error('TENKI_FHZ unavailable after script load');
                }
                return global.TENKI_FHZ;
            });
        }

        return fhzModulesPromise;
    }

    function persistMotionPermissionState(state) {
        try {
            localStorage.setItem('tenki_fhz_motion_permission', state);
        } catch (error) {
            console.warn('[FHZ] Unable to persist motion permission state', error);
        }
    }

    function primeMotionPermissionOnGesture() {
        if (motionPermissionPrimed) return;

        motionPermissionPrimed = true;

        if (global.TENKI_FHZ && typeof global.TENKI_FHZ.primePermissions === 'function') {
            global.TENKI_FHZ.primePermissions().catch(function (error) {
                console.warn('[FHZ] Motion priming via TENKI_FHZ failed', error);
            });
            return;
        }

        if (!('DeviceMotionEvent' in global)) {
            persistMotionPermissionState('unsupported');
            return;
        }

        if (typeof global.DeviceMotionEvent.requestPermission !== 'function') {
            persistMotionPermissionState('granted');
            return;
        }

        global.DeviceMotionEvent.requestPermission().then(function (state) {
            persistMotionPermissionState(state === 'granted' ? 'granted' : 'denied');
        }).catch(function (error) {
            persistMotionPermissionState('denied');
            console.warn('[FHZ] Motion permission request failed', error);
        });
    }

    function ensureProcessingElements() {
        var video;
        var canvas;

        if (processingElements) return processingElements;

        video = document.getElementById('camera');
        canvas = document.getElementById('rppg-canvas');

        if (!video) {
            video = document.createElement('video');
            video.id = 'camera';
            video.setAttribute('playsinline', 'true');
            video.muted = true;
            video.style.position = 'fixed';
            video.style.top = '-9999px';
            video.style.left = '-9999px';
            video.style.opacity = '0';
            video.style.pointerEvents = 'none';
            document.body.appendChild(video);
        }

        if (!canvas) {
            canvas = document.createElement('canvas');
            canvas.id = 'rppg-canvas';
            canvas.width = 100;
            canvas.height = 100;
            canvas.style.position = 'fixed';
            canvas.style.top = '-9999px';
            canvas.style.left = '-9999px';
            canvas.style.opacity = '0';
            canvas.style.pointerEvents = 'none';
            document.body.appendChild(canvas);
        }

        processingElements = {
            video: video,
            canvas: canvas
        };

        return processingElements;
    }

    function attachProcessingStream(stream) {
        var elements = ensureProcessingElements();

        elements.video.srcObject = stream;

        return elements.video.play().catch(function () {
            return Promise.resolve();
        }).then(function () {
            return stream;
        });
    }

    function stopCameraStream() {
        if (cameraStream) {
            cameraStream.getTracks().forEach(function (track) {
                track.stop();
            });
            cameraStream = null;
        }
    }

    function estimateRR(bpm) {
        if (!bpm || bpm < 40) return 14;
        return Math.max(8, Math.min(24, bpm / 4.5));
    }

    function extractRppgMeanG(videoEl, canvasEl, facingMode) {
        var ctx;
        var sw = 100;
        var sh = 100;
        var x0;
        var y0;
        var rw;
        var rh;
        var data;
        var sum = 0;
        var count = 0;
        var i;

        if (!videoEl || videoEl.readyState < 2 || !canvasEl) return null;

        ctx = canvasEl.getContext('2d', { willReadFrequently: true });
        canvasEl.width = sw;
        canvasEl.height = sh;

        try {
            ctx.drawImage(videoEl, 0, 0, sw, sh);
        } catch (error) {
            return null;
        }

        if (facingMode === 'environment') {
            x0 = 0;
            y0 = 0;
            rw = sw;
            rh = sh;
        } else {
            x0 = Math.floor(sw * 0.3);
            y0 = Math.floor(sh * 0.1);
            rw = Math.floor(sw * 0.4);
            rh = Math.floor(sh * 0.2);
        }

        try {
            data = ctx.getImageData(x0, y0, rw, rh).data;
        } catch (error) {
            return null;
        }

        for (i = 1; i < data.length; i += 4) {
            sum += data[i];
            count += 1;
        }

        return count ? (sum / count) : null;
    }

    function stopRppgPipeline() {
        if (!rppgSession) return;

        if (rppgSession.frameLoop) {
            clearInterval(rppgSession.frameLoop);
        }

        if (rppgSession.controller) {
            try {
                if (rppgSession.controller.worker && typeof rppgSession.controller.worker.terminate === 'function') {
                    rppgSession.controller.worker.terminate();
                } else if (typeof rppgSession.controller.reset === 'function') {
                    rppgSession.controller.reset();
                }
            } catch (error) {
                console.warn('[FHZ] Failed to stop rPPG pipeline cleanly', error);
            }
        }

        rppgSession = null;
    }

    function startRppgPipeline(options) {
        var settings = options || {};
        var elements = ensureProcessingElements();
        var controller;
        var originalHandler;
        var firstMetricDelivered = false;
        var lastComputeAt = 0;

        stopRppgPipeline();

        if (!global.TENKI_RPPG || typeof global.TENKI_RPPG.create !== 'function') {
            console.warn('[FHZ] TENKI_RPPG unavailable, keeping scan UX alive without live samples');
            return Promise.resolve(false);
        }

        controller = global.TENKI_RPPG.create('rpgg-worker.js');
        controller.setMode(settings.rppgMode || 'spectrum');

        originalHandler = controller.worker.onmessage;
        controller.worker.onmessage = function (event) {
            var message = event.data || {};
            var scanUX = getScanUX();

            if (typeof originalHandler === 'function') {
                originalHandler.call(controller.worker, event);
            }

            if (message.type !== 'metrics') return;

            if (scanUX && typeof scanUX.onRppgData === 'function') {
                scanUX.onRppgData({
                    hr: message.bpm || 68,
                    hrv: message.rmssd || 50,
                    rr: estimateRR(message.bpm),
                    sqi: Math.round((message.quality || 0) * 100)
                });
            }

            if (!firstMetricDelivered) {
                firstMetricDelivered = true;
                if (typeof settings.onFirstMetric === 'function') {
                    settings.onFirstMetric();
                }
            }
        };

        rppgSession = {
            controller: controller,
            frameLoop: setInterval(function () {
                var meanG = extractRppgMeanG(elements.video, elements.canvas, activeCameraFacingMode);
                var now = Date.now();

                if (meanG === null) return;

                controller.pushFrame({
                    t: now,
                    meanG: meanG
                });

                if (now - lastComputeAt >= 500) {
                    controller.requestCompute();
                    lastComputeAt = now;
                }
            }, 33)
        };

        console.info('[FHZ] rPPG pipeline active on ' + activeCameraFacingMode + ' camera');
        return Promise.resolve(true);
    }

    function prepareResultsDom() {
        var resultsPage = document.getElementById('results-page');
        var results = global.TENKI_RESULTS;

        if (!results || !resultsPage) return;

        try {
            results.init();
            results.showWarmup();
        } catch (error) {
            console.error('[FHZ] Results pre-init error:', error);
        }
    }

    function revealResultsShell(resultsPage) {
        var stardust = getStardust();
        var universe = document.getElementById('universe');
        var hudLayer = document.getElementById('hud-layer');

        if (stardust && stardust.dim) stardust.dim();

        if (universe) {
            universe.style.transition = 'opacity 0.8s ease';
            universe.style.opacity = '0.15';
        }

        if (hudLayer) {
            hudLayer.style.transition = 'opacity 0.5s ease';
            hudLayer.style.opacity = '0';
            setTimeout(function () {
                hudLayer.style.display = 'none';
            }, 500);
        }

        if (dashboardLayer) {
            dashboardLayer.classList.remove('show');
            dashboardLayer.style.display = 'none';
        }

        if (!resultsPage.classList.contains('rp-ready')) {
            resultsPage.classList.add('rp-ready');
        }

        resultsPage.classList.remove('hidden');
        void resultsPage.offsetHeight;
        resultsPage.classList.add('fade-in');
    }

    function kickoffScanUxOnce() {
        var scanUX = getScanUX();

        if (!scanUX || typeof scanUX.start !== 'function') return;
        if (scanUX.isRunning && scanUX.isRunning()) return;

        scanUX.start();
        console.info('[FHZ] Scan UX started');
    }

    function clearKickoffTimer() {
        if (scanUxKickoffTimer) {
            clearTimeout(scanUxKickoffTimer);
            scanUxKickoffTimer = null;
        }
    }

    function restoreLandingState() {
        var stardust = getStardust();
        var universe = document.getElementById('universe');
        var hudLayer = document.getElementById('hud-layer');

        document.body.classList.remove('tenki-scanning');

        if (stardust && stardust.brighten) stardust.brighten();

        if (universe) {
            universe.style.transition = 'opacity 0.8s ease';
            universe.style.opacity = '1';
        }

        if (hudLayer) {
            hudLayer.style.display = '';
            hudLayer.style.opacity = '1';
        }

        showHintCapsule();
    }

    function openFhzFlow() {
        ensureFhzModules().then(function (fhz) {
            return fhz.open();
        }).catch(function (error) {
            console.warn('[FHZ] Unable to open FHZ, falling back to existing results flow', error);
            showResultsPage();
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
            console.warn('[FHZ] #scan-trigger-wrapper not found');
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

        document.addEventListener('tenki:fhz-commit', function (e) {
            var detail = e.detail || {};

            showResultsPage({
                preferredStream: detail.stream || null,
                purpose: detail.purpose || 'QUICK',
                rppgMode: detail.rppgMode || 'spectrum',
                facingMode: detail.facingMode || 'environment'
            });
        });

        document.addEventListener('tenki:fhz-cancel', function () {
            restoreLandingState();
            if (!faceSyncStream) {
                setTimeout(initFaceSync, 400);
            }
        });

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

    function beginHoldScan(btn, ring) {
        isAnimating = true;
        scanElapsed = 0;
        scanCommitted = false;
        console.info('[FHZ] Scan touch started');

        primeMotionPermissionOnGesture();
        ensureFhzModules().catch(function (error) {
            console.warn('[FHZ] FHZ preload failed', error);
        });

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
        document.body.classList.remove('tenki-scanning');
        console.info('[FHZ] Scan cancelled (released early)');
    }

    function commitScan(btn, ring) {
        if (scanCommitted) return;
        scanCommitted = true;

        console.info('[FHZ] Scan committed (' + scanElapsed + 'ms held)');

        btn.classList.remove('active');
        if (ring) {
            ring.classList.remove('active');
            ring.style.background = 'conic-gradient(#00F0FF 0%, transparent 0%)';
        }
        isAnimating = false;

        stopFaceSync();
        openFhzFlow();
    }

    // ── Scan Complete Achievement Toast ──
    function getToastIconMarkup(iconName) {
        var iconPaths = {
            confirm: '<path d="M6.7 12.6 10.3 16.2 17.3 9.2"/>',
            insights: '<rect x="5.5" y="5.5" width="13" height="13" rx="3"/><path d="M8 15.3 10.8 12.5 13 14.7 16 10.4"/><circle cx="16" cy="10.4" r="1"/>'
        };

        var markup = iconPaths[iconName] || iconPaths.insights;
        return '<span class="tenki-scan-toast-icon" aria-hidden="true">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
            markup +
            '</svg>' +
            '</span>';
    }

    function showScanCompleteToast(onDone) {
        // Read TEI from dashboard
        var scoreEl = document.getElementById('dash-score');
        var teiVal = scoreEl ? parseInt(scoreEl.textContent, 10) : null;
        if (!teiVal || isNaN(teiVal)) teiVal = null;

        var toast = document.createElement('div');
        toast.className = 'tenki-scan-toast';
        toast.innerHTML =
            '<div class="tenki-scan-toast-title">' + getToastIconMarkup('confirm') + '<span>掃描完成</span></div>' +
            (teiVal !== null
                ? '<div class="tenki-scan-toast-score"><span>你的 TEI 指數：' + teiVal + '</span>' + getToastIconMarkup('insights') + '</div>'
                : '<div class="tenki-scan-toast-score"><span>準備顯示結果</span>' + getToastIconMarkup('insights') + '</div>');

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
    function requestCamera(options) {
        var settings = options || {};

        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            return Promise.reject(new Error('mediaDevices unavailable'));
        }

        if (settings.preferredStream && settings.preferredStream.active) {
            if (cameraStream && cameraStream !== settings.preferredStream) {
                stopCameraStream();
            }

            cameraStream = settings.preferredStream;
            activeCameraFacingMode = settings.facingMode || 'environment';

            return attachProcessingStream(cameraStream).then(function () {
                console.info('[FHZ] Reusing FHZ rear stream for rPPG');
                return cameraStream;
            });
        }

        stopCameraStream();
        activeCameraFacingMode = 'user';

        return navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
            audio: false
        }).then(function (stream) {
            cameraStream = stream;
            return attachProcessingStream(stream).then(function () {
                console.info('[FHZ] Camera authorized for fallback face rPPG');
                return stream;
            });
        });
    }

    // ══════════════════════════════════════════════
    //  RESULTS PAGE
    // ══════════════════════════════════════════════

    function showResultsPage(options) {
        var settings = options || {};
        var resultsPage = document.getElementById('results-page');
        var audio = getAudio();

        if (isResultsOpen) return;
        if (!resultsPage) return;

        isResultsOpen = true;
        console.info('[FHZ] Transitioning to results page');

        prepareResultsDom();
        revealResultsShell(resultsPage);

        if (audio) audio.init();

        clearKickoffTimer();

        requestCamera({
            preferredStream: settings.preferredStream || null,
            facingMode: settings.facingMode || 'user'
        }).then(function (stream) {
            return startRppgPipeline({
                stream: stream,
                rppgMode: settings.rppgMode || 'spectrum',
                onFirstMetric: function () {
                    clearKickoffTimer();
                    kickoffScanUxOnce();
                }
            });
        }).then(function () {
            scanUxKickoffTimer = setTimeout(function () {
                kickoffScanUxOnce();
            }, 1200);
        }).catch(function (err) {
            console.warn('[FHZ] Camera denied:', err.message || err);
            alert('\u26A0\uFE0F \u76F8\u6A5F\u6388\u6B0A\u5931\u6557\u6216\u7121\u6CD5\u4F7F\u7528\uFF0C\u5DF2\u53D6\u6D88\u6383\u63CF\u3002');
            closeResultsPage();
        });
    }

    // ── Close Results ──
    document.addEventListener('click', function (e) {
        if (e.target && (e.target.id === 'results-close-btn' || e.target.closest('#results-close-btn'))) {
            closeResultsPage();
        }
    });

    function closeResultsPage() {
        var scanUX = getScanUX();
        var results = global.TENKI_RESULTS;
        var resultsPage = document.getElementById('results-page');

        if (!isResultsOpen) return;
        isResultsOpen = false;
        clearKickoffTimer();

        if (scanUX && typeof scanUX.stop === 'function') {
            scanUX.stop();
        }

        if (results && typeof results.destroy === 'function') {
            results.destroy();
        }

        stopRppgPipeline();
        stopCameraStream();

        if (resultsPage) {
            resultsPage.classList.remove('fade-in');
            setTimeout(function () {
                resultsPage.classList.add('hidden');
            }, 600);
        }

        restoreLandingState();
        if (!faceSyncStream) {
            setTimeout(initFaceSync, 800);
        }
    }

    global.TENKI_BRIDGE = {
        showResults: showResultsPage,
        closeResults: closeResultsPage,
        ensureFhzModules: ensureFhzModules
    };
})(window);
