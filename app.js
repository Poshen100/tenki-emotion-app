/**
 * TENKI PHASE 0 MAX — App Flow Controller
 *
 * Landing → Camera Permission → 5-Phase Progressive Scan → Results
 *
 * rPPG pipeline:
 *   1. TENKI_RPPG.create('rpgg-worker.js') → RPPGController
 *   2. Extract green channel from face ROI (FaceMesh or simple forehead)
 *   3. pushFrame → requestCompute → onmessage → scanUX.onRppgData()
 *
 * If rPPG engine unavailable → simulation mode (SQI shows lower, never "error")
 */
(function () {
    'use strict';

    // ─── Landing Particles ───
    function initLandingParticles() {
        var canvas = document.getElementById('landing-particles');
        if (!canvas) return null;
        var ctx = canvas.getContext('2d');
        var dpr = Math.min(window.devicePixelRatio || 1, 2);
        var w, h;

        function resize() {
            w = window.innerWidth;
            h = window.innerHeight;
            canvas.width = w * dpr;
            canvas.height = h * dpr;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        }
        resize();
        window.addEventListener('resize', resize);

        var particles = [];
        for (var i = 0; i < 80; i++) {
            particles.push({
                x: Math.random() * w,
                y: Math.random() * h,
                size: 0.5 + Math.random() * 1.5,
                alpha: 0.05 + Math.random() * 0.3,
                vx: (Math.random() - 0.5) * 0.15,
                vy: (Math.random() - 0.5) * 0.1,
                phase: Math.random() * Math.PI * 2
            });
        }

        var animId;
        function draw() {
            ctx.clearRect(0, 0, w, h);
            var t = Date.now() / 1000;

            // Subtle nebula glow
            var grad = ctx.createRadialGradient(w / 2, h * 0.35, 0, w / 2, h * 0.35, w * 0.4);
            grad.addColorStop(0, 'rgba(0,180,216,0.03)');
            grad.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, w, h);

            for (var j = 0; j < particles.length; j++) {
                var p = particles[j];
                p.x += p.vx;
                p.y += p.vy;
                if (p.x < 0) p.x = w;
                if (p.x > w) p.x = 0;
                if (p.y < 0) p.y = h;
                if (p.y > h) p.y = 0;

                var twinkle = 0.5 + 0.5 * Math.sin(t * 1.5 + p.phase);
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(255,255,255,' + (p.alpha * twinkle) + ')';
                ctx.fill();
            }

            animId = requestAnimationFrame(draw);
        }
        draw();

        return function stop() {
            cancelAnimationFrame(animId);
            window.removeEventListener('resize', resize);
        };
    }

    // ─── Simple Green Channel Extraction (no FaceMesh) ───
    function extractSimpleGreen(videoEl, canvas) {
        if (!videoEl || videoEl.readyState < 2) return null;
        var ctx = canvas.getContext('2d');
        var sw = 100, sh = 100;
        canvas.width = sw;
        canvas.height = sh;

        try {
            ctx.drawImage(videoEl, 0, 0, sw, sh);
        } catch (e) {
            return null;
        }

        // Forehead region: top 30%, center 40%
        var x0 = Math.floor(sw * 0.3);
        var y0 = Math.floor(sh * 0.1);
        var rw = Math.floor(sw * 0.4);
        var rh = Math.floor(sh * 0.2);

        var data;
        try {
            data = ctx.getImageData(x0, y0, rw, rh).data;
        } catch (e) {
            return null;
        }

        var sum = 0, count = 0;
        for (var i = 1; i < data.length; i += 4) {
            sum += data[i]; // green channel
            count++;
        }
        return count > 0 ? sum / count : null;
    }

    function estimateRR(bpm) {
        if (!bpm || bpm < 40) return 14;
        return Math.max(8, Math.min(24, bpm / 4.5 + (Math.random() - 0.5) * 2));
    }

    // ─── Main Init ───
    document.addEventListener('DOMContentLoaded', function () {
        var scanUX = window.TENKI_SCAN_UX;
        var audio = window.TENKI_AUDIO;

        var startBtn = document.getElementById('start-btn');
        var landing = document.getElementById('landing');
        var resultsPage = document.getElementById('results-page');
        var camera = document.getElementById('camera');
        var rppgCanvas = document.getElementById('rppg-canvas');
        var soundBtn = document.getElementById('sound-toggle');

        var stopLandingParticles = initLandingParticles();
        var rppgController = null;
        var frameLoop = null;
        var soundOn = true;
        var lastComputeTime = 0;

        // Sound toggle
        if (soundBtn) {
            soundBtn.addEventListener('click', function () {
                soundOn = !soundOn;
                if (audio) audio.setEnabled(soundOn);
                if (window.TENKI_HAPTICS) window.TENKI_HAPTICS.setEnabled(soundOn);
                soundBtn.textContent = soundOn ? '🔊' : '🔇';
            });
        }

        // ─── Start Button ───
        if (startBtn) {
            startBtn.addEventListener('click', function () {
                // Init audio on user gesture (iOS requirement)
                if (audio) audio.init();

                // Guard: mediaDevices may be undefined on HTTP or restricted contexts
                if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                    console.warn('[TENKI] mediaDevices unavailable — simulation mode');
                    beginScan();
                    return;
                }

                // Request front camera
                navigator.mediaDevices.getUserMedia({
                    video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
                    audio: false
                }).then(function (stream) {
                    camera.srcObject = stream;
                    return camera.play();
                }).then(function () {
                    beginScan();
                }).catch(function (err) {
                    // Camera denied → run in simulation mode (no error shown to user)
                    console.warn('[TENKI] Camera access issue:', err.message || err);
                    beginScan();
                });
            });
        }

        function beginScan() {
            // Transition: landing → results
            if (stopLandingParticles) stopLandingParticles();
            landing.classList.add('fade-out');

            setTimeout(function () {
                landing.classList.add('hidden');
                resultsPage.classList.remove('hidden');

                // Trigger reflow then fade in
                void resultsPage.offsetHeight;
                resultsPage.classList.add('fade-in');

                // Start scan UX
                if (scanUX) scanUX.start();

                // Start rPPG pipeline
                startRppgPipeline();
            }, 500);
        }

        function startRppgPipeline() {
            // Try real rPPG engine
            if (typeof TENKI_RPPG !== 'undefined' && camera.srcObject) {
                try {
                    rppgController = TENKI_RPPG.create('rpgg-worker.js');
                    rppgController.setMode('spectrum'); // 60s deep scan mode

                    // Intercept worker messages for metrics
                    var origOnMessage = rppgController.worker.onmessage;
                    rppgController.worker.onmessage = function (e) {
                        if (origOnMessage) origOnMessage.call(rppgController.worker, e);
                        var msg = e.data || {};
                        if (msg.type === 'metrics' && scanUX) {
                            scanUX.onRppgData({
                                hr: msg.bpm || 68,
                                hrv: msg.rmssd || 50,
                                rr: estimateRR(msg.bpm),
                                sqi: (msg.quality || 0) * 100
                            });
                        }
                    };

                    // Frame extraction loop (~30fps)
                    frameLoop = setInterval(function () {
                        if (!camera.srcObject || camera.readyState < 2) return;

                        var meanG = extractSimpleGreen(camera, rppgCanvas);
                        if (meanG !== null) {
                            rppgController.pushFrame({ t: Date.now(), meanG: meanG });
                        }

                        // Request compute every ~500ms
                        var now = Date.now();
                        if (now - lastComputeTime > 500) {
                            rppgController.requestCompute();
                            lastComputeTime = now;
                        }
                    }, 33);

                    console.info('[TENKI] rPPG pipeline active (simple forehead ROI)');
                    return;
                } catch (e) {
                    console.warn('[TENKI] rPPG init failed:', e.message);
                }
            }

            // Fallback: simulation mode
            // scan-ux.js automatically uses baseline stats when no rPPG data arrives
            console.info('[TENKI] Running in simulation mode (no camera or rPPG unavailable)');
        }
    });
})();
