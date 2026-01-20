// TENKI v51.1 App - Live Biometric Sync for 60s, then Simulation
lucide.createIcons();

const app = {
    config: {
        particleCount: 8000,
        particleSize: 0.08,
        scanDurationByMode: { glimpse: 2000, default: 30000, spectrum: 60000 },
        confidenceByMode: { glimpse: 30, default: 75, spectrum: 95 },
        gateLuxMin: 20,
        gateShakeMax: 0.5,
        // v51.1: Live sync duration (60s real data, then simulation)
        liveSyncDurationMs: 60000,
        phases: [
            { name: 'idle', ms: 0, confidence: 0, hrvRequired: 0, method: 'none' },
            { name: 'glimpse', ms: 2000, confidence: 30, hrvRequired: 0, method: 'cv' },
            { name: 'preview', ms: 15000, confidence: 50, hrvRequired: 5, method: 'timeDomain' },
            { name: 'default', ms: 30000, confidence: 75, hrvRequired: 15, method: 'timeDomain+' },
            { name: 'spectrum', ms: 60000, confidence: 95, hrvRequired: 30, method: 'freqDomain' }
        ]
    },
    state: {
        isFaceDetected: false, isScanning: false, isSensorActive: false,
        mouthOpen: 0, headRot: { x: 0, y: 0 }, energy: 0, audioData: 0,
        baseScore: 0, mentalBuffer: 0, engineResult: null, scanBuffer: [],
        envLux: 0, deviceMotion: 0, scanMode: "default", gateHold: false,
        rppg: null, rppgTick: 0, isLiveMode: false, currentPhase: 0,
        validHrvCount: 0, liveScore: null, liveConfidence: 0,
        scanStartTime: null, scanComplete: false,
        // v51.1: Track if we're in live sync mode (first 60s) or simulation
        isLiveSyncActive: true,
        lastRealMetrics: { hr: 72, rr: 16, sns: 50, pns: 50, rmssd: 45 },
        liveMetrics: { sns: 50, pns: 50, hr: 72, rr: 16, stress: 30, rmssd: 45 },
        sparkHistory: { sns: [], pns: [], hr: [], rr: [] },
        expression: null, hints: null, sceneQuote: "", lastRppg: null,
        sceneQuotes: [
            "Clear mind, clean execution. 專注當下，從容決策。",
            "Quality signals, quality decisions. 優質訊號，優質決策。",
            "Stable rhythm, steady progress. 平穩節奏，穩健前進。",
            "Trust the process. 相信過程。",
            "Breathe deeply, think clearly. 深呼吸，清晰思考。"
        ]
    },
    audioCtx: null, analyser: null, dataArray: null, stream: null, lightCtx: null,

    init: function () {
        this.initThree();
        this.initEvents();
        this.initDashboardInteractions();
        this.initEnvironment();
        this.initPrecisionTabs();
        this.initSparkBars();
        const container = document.getElementById('ppg-graph');
        for (let i = 0; i < 30; i++) {
            const d = document.createElement('div');
            d.className = 'bio-bar';
            d.style.height = '10%';
            container.appendChild(d);
        }
        const d = new Date();
        document.getElementById('dash-date').innerText = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase();
        if (typeof TENKI_RPPG !== 'undefined') this.state.rppg = TENKI_RPPG.create('./rpgg-worker.js');
        if (typeof TENKI_EXPRESSION !== 'undefined') this.state.expression = TENKI_EXPRESSION.create();
        if (typeof TENKI_HINTS !== 'undefined') this.state.hints = TENKI_HINTS.create();
    },

    initSparkBars: function () {
        ['sns', 'pns', 'hr', 'rr'].forEach(key => {
            const container = document.getElementById('spark-' + key);
            if (container) {
                container.innerHTML = '';
                for (let i = 0; i < 12; i++) {
                    const bar = document.createElement('div');
                    bar.className = 'spark-bar';
                    bar.style.height = '30%';
                    container.appendChild(bar);
                }
            }
        });
    },

    // v51.1: Check if we're still in live sync period (first 60s)
    isInLiveSyncPeriod: function () {
        if (!this.state.scanStartTime) return false;
        const elapsed = performance.now() - this.state.scanStartTime;
        return elapsed < this.config.liveSyncDurationMs;
    },

    startLiveMode: function () {
        if (this.state.isLiveMode) return;
        this.state.isLiveMode = true;
        this.state.scanStartTime = performance.now();
        this.state.currentPhase = 1;
        this.state.validHrvCount = 0;
        this.state.scanComplete = false;
        this.state.isLiveSyncActive = true;

        const self = this;
        if (this.liveInterval) clearInterval(this.liveInterval);

        this.liveInterval = setInterval(() => {
            const elapsed = performance.now() - self.state.scanStartTime;

            // v51.1: Check if we should switch from live sync to simulation
            if (elapsed >= self.config.liveSyncDurationMs && self.state.isLiveSyncActive) {
                self.state.isLiveSyncActive = false;
                // Store last real metrics for simulation baseline
                self.state.lastRealMetrics = { ...self.state.liveMetrics };
                console.log('Switching to simulation mode after 60s');
            }

            if (!self.state.scanComplete) {
                self.updateLivePhase();
            }

            // v51.1: Use real data for first 60s, then simulate
            if (self.state.isLiveSyncActive) {
                self.updateLiveMetricsFromRealData();
            } else {
                self.simulateMetricsAfterSync();
            }

            self.updateDashboardVisuals();
            self.updateSparkGraphs();
        }, 150);
    },

    // v51.1: Update metrics from real rPPG data (first 60s)
    updateLiveMetricsFromRealData: function () {
        const m = this.state.liveMetrics;
        const elapsed = performance.now() - this.state.scanStartTime;

        // Get real HR from rPPG if available
        if (this.state.rppg && this.state.rppg.metrics.bpm && this.state.rppg.metrics.bpm > 0) {
            m.hr = this.state.rppg.metrics.bpm;
            this.state.validHrvCount = this.state.rppg.metrics.nPeaks || 0;

            // Get real RMSSD for HRV
            if (this.state.rppg.metrics.rmssd) {
                m.rmssd = this.state.rppg.metrics.rmssd;
                // Derive PNS/SNS from RMSSD (higher RMSSD = more PNS dominant)
                m.pns = Math.min(80, Math.max(20, 30 + (m.rmssd * 0.5)));
                m.sns = 100 - m.pns;
            }
        } else {
            // Fallback: gentle variation based on elapsed time while waiting for signal
            m.hr = 68 + Math.sin(elapsed * 0.002) * 5 + (Math.random() - 0.5) * 2;
            if (elapsed > 2000) {
                this.state.validHrvCount = Math.min(30, Math.floor((elapsed - 2000) / 1500));
            }
        }

        // v51.1: Derive RR (breathing rate) from HR variability pattern
        // RSA (Respiratory Sinus Arrhythmia) - breathing modulates HR
        // Estimate RR from the dominant frequency in HR variation
        if (this.state.rppg && this.state.rppg.metrics.rmssd) {
            // Higher RMSSD often correlates with slower, deeper breathing
            const rmssd = this.state.rppg.metrics.rmssd;
            // Typical RR range: 12-20 breaths/min
            // Lower RMSSD -> faster breathing, Higher RMSSD -> slower breathing
            m.rr = Math.max(12, Math.min(20, 18 - (rmssd - 40) * 0.1)) + (Math.random() - 0.5) * 1;
        } else {
            m.rr = 14 + Math.sin(elapsed * 0.0008) * 3 + (Math.random() - 0.5) * 1;
        }

        // Stress: inverse of PNS dominance
        m.stress = Math.max(10, Math.min(90, 50 + (m.sns - 50) * 0.8));

        this.updateLiveScore();
        this.updateHintsFromMetrics();
    },

    // v51.1: Simulate metrics after 60s sync period
    simulateMetricsAfterSync: function () {
        const m = this.state.liveMetrics;
        const base = this.state.lastRealMetrics;

        // Gentle random walk around the last real values
        m.hr = Math.max(55, Math.min(100, base.hr + (Math.random() - 0.5) * 1.5));
        m.rr = Math.max(12, Math.min(22, base.rr + (Math.random() - 0.5) * 0.8));
        m.sns = Math.max(20, Math.min(80, base.sns + (Math.random() - 0.5) * 2));
        m.pns = 100 - m.sns;
        m.rmssd = Math.max(15, Math.min(100, base.rmssd + (Math.random() - 0.5) * 3));
        m.stress = Math.max(10, Math.min(90, 50 + (m.sns - 50) * 0.8));

        // Slowly update base for next iteration (EWMA)
        const alpha = 0.1;
        this.state.lastRealMetrics.hr = alpha * m.hr + (1 - alpha) * base.hr;
        this.state.lastRealMetrics.rr = alpha * m.rr + (1 - alpha) * base.rr;
        this.state.lastRealMetrics.sns = alpha * m.sns + (1 - alpha) * base.sns;
        this.state.lastRealMetrics.rmssd = alpha * m.rmssd + (1 - alpha) * base.rmssd;

        this.updateLiveScore();
    },

    updateHintsFromMetrics: function () {
        if (!this.state.hints) return;
        const m = this.state.liveMetrics;
        const rppgMetrics = this.state.rppg ? this.state.rppg.metrics : {};
        const exprStats = this.state.expression ? this.state.expression.stats : {};

        const hintMetrics = {
            hr: m.hr, rmssd: m.rmssd || null,
            rmssdStable: (rppgMetrics.nIbiUsable || 0) > 10,
            quality: rppgMetrics.quality || 0,
            nIbiUsable: rppgMetrics.nIbiUsable || 0, rr: m.rr,
            gazeStability: exprStats.gazeStability || 1.0,
            headJitter: exprStats.headJitter || 0,
            blinkRateAbnormal: (exprStats.blinkRate || 15) < 10 || (exprStats.blinkRate || 15) > 25,
            lux: this.state.envLux || 100,
            deviceMotion: this.state.deviceMotion || 0
        };
        this.state.hints.update(hintMetrics);
    },

    updateLivePhase: function () {
        if (!this.state.scanStartTime) return;
        const elapsed = performance.now() - this.state.scanStartTime;
        const hrvCount = this.state.validHrvCount;

        let newPhase = 1;
        for (let i = this.config.phases.length - 1; i >= 1; i--) {
            const p = this.config.phases[i];
            if (elapsed >= p.ms && hrvCount >= p.hrvRequired) { newPhase = i; break; }
        }

        if (newPhase > this.state.currentPhase) {
            this.state.currentPhase = newPhase;
            if (navigator.vibrate) navigator.vibrate([30, 20, 30]);
            this.onPhaseUpgrade(newPhase);
        }

        this.updatePhaseUI(newPhase);
        this.updateLiveTimer(elapsed);

        if (elapsed >= 60000 && !this.state.scanComplete) {
            this.state.scanComplete = true;
            this.onScanComplete();
        }
    },

    onPhaseUpgrade: function (phase) {
        const phaseInfo = this.config.phases[phase];
        this.state.liveConfidence = phaseInfo.confidence;
        const confEl = document.getElementById('confidence-val');
        if (confEl) confEl.innerText = phaseInfo.confidence + '%';
        const resEl = document.getElementById('resonance-fill');
        if (resEl) resEl.style.width = phaseInfo.confidence + '%';
        const labels = { 1: 'GLIMPSE', 2: 'PREVIEW', 3: 'DEFAULT', 4: 'SPECTRUM' };
        const labelEl = document.getElementById('dash-label');
        if (labelEl) {
            labelEl.innerText = labels[phase] || 'ANALYZING';
            labelEl.style.color = phase >= 3 ? '#00FF94' : '#00F0FF';
        }
    },

    onScanComplete: function () {
        const labelEl = document.getElementById('dash-label');
        if (labelEl) {
            labelEl.innerText = 'SCAN COMPLETE';
            labelEl.style.color = '#00FF94';
        }
        if (navigator.vibrate) navigator.vibrate([50, 30, 50, 30, 100]);
    },

    updatePhaseUI: function (currentPhase) {
        document.querySelectorAll('#phase-indicator .phase-dot').forEach((dot, i) => {
            const phaseNum = i + 1;
            dot.classList.remove('active', 'complete');
            if (phaseNum < currentPhase) dot.classList.add('complete');
            else if (phaseNum === currentPhase) dot.classList.add('active');
        });
        document.querySelectorAll('#phase-indicator .phase-line').forEach((line, i) => {
            line.classList.toggle('active', i < currentPhase - 1);
        });
    },

    updateLiveTimer: function (elapsedMs) {
        const seconds = Math.floor(elapsedMs / 1000);
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        const timerEl = document.getElementById('live-timer');
        if (timerEl) timerEl.innerText = String(mins).padStart(2, '0') + ':' + String(secs).padStart(2, '0');
        const hrvEl = document.getElementById('hrv-count-val');
        if (hrvEl) hrvEl.innerText = this.state.validHrvCount;
    },

    updateSparkGraphs: function () {
        const m = this.state.liveMetrics;
        const h = this.state.sparkHistory;

        ['sns', 'pns', 'hr', 'rr'].forEach(key => {
            h[key].push(m[key]);
            if (h[key].length > 12) h[key].shift();
        });

        ['sns', 'pns', 'hr', 'rr'].forEach(key => {
            const container = document.getElementById('spark-' + key);
            if (!container) return;
            const bars = container.querySelectorAll('.spark-bar');
            const values = h[key];
            if (!values || values.length === 0) return;

            let max = Math.max(...values), min = Math.min(...values);
            if (max === min) { max += 1; min -= 1; }
            const range = max - min;

            bars.forEach((bar, i) => {
                const val = values[i] !== undefined ? values[i] : (values[values.length - 1] || 0);
                const norm = (val - min) / range;
                const pct = 20 + (norm * 80);
                bar.style.height = pct + '%';
                bar.style.opacity = 0.4 + ((i / bars.length) * 0.6);
            });
        });
    },

    updateLiveScore: function () {
        const phase = this.state.currentPhase;
        const m = this.state.liveMetrics;

        let tei = 50;
        tei += (m.pns - 50) * 0.5;
        tei -= (m.stress - 50) * 0.3;
        tei += (phase - 1) * 5;
        tei = Math.max(10, Math.min(99, Math.round(tei)));
        this.state.liveScore = tei;

        let displayConfidence = this.state.liveConfidence;
        let displayMessage = "", messageColor = "";

        if (this.state.expression) {
            displayConfidence = Math.round(displayConfidence * this.state.expression.getConfidenceModifier());
            const exprOut = this.state.expression.getPhaseOutput(phase);
            if (exprOut.risk > 0.3) { displayMessage = exprOut.message; messageColor = '#FF8800'; }
        }

        if (this.state.hints) {
            displayConfidence = Math.round(displayConfidence * this.state.hints.getConfidenceModifier());
            const coachPrompt = this.state.hints.getCoachPrompt(phase);
            if (coachPrompt) {
                if (!displayMessage || coachPrompt.category === 'quality' || coachPrompt.intensity === 'alert') {
                    displayMessage = coachPrompt.mainPrompt;
                    messageColor = coachPrompt.intensity === 'alert' ? '#FF5500' :
                        coachPrompt.category === 'quality' ? '#FF8800' :
                            coachPrompt.category === 'breathing' ? '#00D4AA' : '#9CA3AF';
                }
            }
        }

        const scoreEl = document.getElementById('dash-score');
        if (scoreEl) scoreEl.innerText = String(tei).padStart(2, '0');

        const confEl = document.getElementById('confidence-val');
        if (confEl) {
            confEl.innerText = displayConfidence + '%';
            confEl.style.color = displayConfidence < this.state.liveConfidence * 0.8 ? '#FF8800' : '';
        }

        const quoteEl = document.getElementById('dash-quote');
        if (quoteEl) {
            if (displayMessage) {
                quoteEl.innerHTML = `"${displayMessage}"`;
                quoteEl.style.color = messageColor;
            } else {
                quoteEl.innerHTML = '"All signals stable · 訊號正常"';
                quoteEl.style.color = '#00D4AA';
            }
        }

        const cScore = 753;
        const offScore = cScore - ((tei / 100) * cScore);
        const ringEl = document.getElementById('ring-score');
        if (ringEl) ringEl.style.strokeDashoffset = offScore;
    },

    stopLiveMode: function () {
        this.state.isLiveMode = false;
        if (this.liveInterval) clearInterval(this.liveInterval);
    },

    gatePass: function () {
        if (!this.state.isFaceDetected) return { pass: false, reason: "FIND FACE" };
        if (this.state.envLux < this.config.gateLuxMin) return { pass: false, reason: "LOW LIGHT" };
        if (this.state.deviceMotion > this.config.gateShakeMax) return { pass: false, reason: "HOLD STEADY" };

        const phase = this.state.currentPhase || 0;
        if (phase <= 1) return { pass: true, reason: "GLIMPSE OK" };

        if (this.state.expression) {
            const exprOut = this.state.expression.getPhaseOutput(phase);
            if (exprOut.uncertainty > 0.6) return { pass: false, reason: exprOut.message || "FACE UNSTABLE" };
        }

        if (this.state.hints && this.state.hints.requiresGateHold()) {
            const hint = this.state.hints.getPrimaryHint();
            return { pass: false, reason: hint ? hint.label.toUpperCase() : "QUALITY ISSUE" };
        }

        if (phase >= 3 && this.state.rppg) {
            const rppgGate = this.state.rppg.getQualityGate();
            if (!rppgGate.pass) return { pass: false, reason: rppgGate.reason };
        }

        return { pass: true, reason: "READY" };
    },

    initPrecisionTabs: function () {
        const tabs = document.querySelectorAll("#precision-tabs .precision-tab");
        const self = this;
        tabs.forEach(btn => {
            btn.addEventListener("click", function () {
                tabs.forEach(b => b.classList.remove("active"));
                btn.classList.add("active");
                self.state.scanMode = btn.dataset.mode;
                if (self.state.rppg) self.state.rppg.setMode(btn.dataset.mode);
                const durationMap = { glimpse: "2s", default: "30s", spectrum: "60s" };
                document.getElementById("instruction").innerText = "HOLD TO SYNC · " + durationMap[self.state.scanMode];
            });
        });
    },

    initEnvironment: function () {
        const c = document.getElementById('light-analysis-canvas');
        if (c) this.lightCtx = c.getContext('2d', { willReadFrequently: true });
        window.addEventListener('devicemotion', (event) => {
            if (event.accelerationIncludingGravity) {
                const { x, y, z } = event.accelerationIncludingGravity;
                const m = Math.sqrt(x * x + y * y + z * z);
                this.state.deviceMotion = Math.abs(m - 9.8) * 0.1;
            }
        });
    },

    updateEnvironment: function () {
        if (!this.state.isSensorActive) {
            this.updateEnvUI(60 + Math.sin(Date.now() * 0.001) * 10, 0.02);
            return;
        }
        if (this.lightCtx && document.getElementById('input-video').readyState === 4) {
            if (Math.random() > 0.9) {
                const v = document.getElementById('input-video');
                this.lightCtx.drawImage(v, 0, 0, 50, 50);
                const frame = this.lightCtx.getImageData(0, 0, 50, 50);
                const data = frame.data;
                let colorSum = 0;
                for (let x = 0; x < data.length; x += 4) colorSum += Math.floor((data[x] + data[x + 1] + data[x + 2]) / 3);
                this.state.envLux = Math.min(100, (Math.floor(colorSum / 2500) / 200) * 100);
            }
        }
        let instability = this.state.deviceMotion;
        if (this.state.headRot) instability += (Math.abs(this.state.headRot.x) + Math.abs(this.state.headRot.y)) * 0.05;
        this.updateEnvUI(this.state.envLux, instability);
    },

    updateEnvUI: function (lux, shake) {
        const luxBar = document.getElementById('env-lux-bar');
        const luxItem = document.getElementById('env-lux');
        const stabBar = document.getElementById('env-stab-bar');
        const stabItem = document.getElementById('env-stab');
        if (luxBar) {
            luxBar.style.width = lux + '%';
            if (lux < 20) { luxItem.classList.add('warn'); luxItem.classList.remove('good'); }
            else { luxItem.classList.add('good'); luxItem.classList.remove('warn'); }
        }
        if (stabBar) {
            const stabPct = Math.max(0, 100 - (shake * 100));
            stabBar.style.width = stabPct + '%';
            if (shake > 0.5) { stabItem.classList.add('warn'); stabItem.classList.remove('good'); }
            else { stabItem.classList.add('good'); stabItem.classList.remove('warn'); }
        }
    },

    initThree: function () {
        const container = document.getElementById('universe');
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.z = 5;
        this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        container.appendChild(this.renderer.domElement);

        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(this.config.particleCount * 3);
        const originals = new Float32Array(this.config.particleCount * 3);
        const colors = new Float32Array(this.config.particleCount * 3);
        const randoms = new Float32Array(this.config.particleCount);
        const phi = Math.PI * (3. - Math.sqrt(5.));
        const topColor = new THREE.Color(0xFF66CC);
        const midColor = new THREE.Color(0x9966FF);
        const botColor = new THREE.Color(0x00CCFF);

        for (let i = 0; i < this.config.particleCount; i++) {
            const y = 1 - (i / (this.config.particleCount - 1)) * 2;
            const radius = Math.sqrt(1 - y * y);
            const theta = phi * i;
            const r = 2.5;
            const idx = i * 3;
            positions[idx] = Math.cos(theta) * radius * r;
            positions[idx + 1] = y * r;
            positions[idx + 2] = Math.sin(theta) * radius * r;
            originals[idx] = positions[idx]; originals[idx + 1] = positions[idx + 1]; originals[idx + 2] = positions[idx + 2];
            randoms[i] = Math.random();
            const mixed = new THREE.Color();
            const normalizedY = (y + 1) / 2;
            if (normalizedY > 0.5) mixed.copy(midColor).lerp(topColor, (normalizedY - 0.5) * 2);
            else mixed.copy(botColor).lerp(midColor, normalizedY * 2);
            colors[idx] = mixed.r; colors[idx + 1] = mixed.g; colors[idx + 2] = mixed.b;
        }
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('originalPosition', new THREE.BufferAttribute(originals, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geometry.setAttribute('random', new THREE.BufferAttribute(randoms, 1));

        const canvas = document.createElement('canvas'); canvas.width = 32; canvas.height = 32;
        const ctx = canvas.getContext('2d');
        const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
        grad.addColorStop(0, 'rgba(255,255,255,1)');
        grad.addColorStop(0.4, 'rgba(255,255,255,0.8)');
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad; ctx.fillRect(0, 0, 32, 32);
        const tex = new THREE.Texture(canvas); tex.needsUpdate = true;

        this.material = new THREE.PointsMaterial({
            size: this.config.particleSize, map: tex, transparent: true, opacity: 0.9,
            vertexColors: true, blending: THREE.AdditiveBlending, depthWrite: false
        });
        this.cloud = new THREE.Points(geometry, this.material);
        this.scene.add(this.cloud);
        this.animate();
    },

    startSensors: async function () {
        document.getElementById('instruction').innerText = "SENSORS ACTIVE...";
        try {
            this.stream = await navigator.mediaDevices.getUserMedia({ video: true });
            this.initAI(this.stream);
            this.state.isSensorActive = true;
            this.audioCtx = { closed: false };
        } catch (e) {
            console.error(e);
            document.getElementById('instruction').innerText = "CAMERA REQUIRED";
            this.initAI(null);
        }
    },

    stopSensors: function () {
        if (this.stream) { this.stream.getTracks().forEach(track => track.stop()); this.stream = null; }
        this.audioCtx = null;
        this.state.isSensorActive = false;
        this.state.isFaceDetected = false;
        document.getElementById('connection-status').innerText = "SIMULATION MODE";
    },

    updateAudio: function () {
        this.state.audioData = 30 + Math.sin(Date.now() * 0.001 * 0.8) * 15;
    },

    getEyeOpenness: function (landmarks) {
        const avgDist = (Math.abs(landmarks[159].y - landmarks[145].y) + Math.abs(landmarks[386].y - landmarks[374].y)) / 2;
        return Math.min(1, avgDist / 0.05);
    },
    getEyeTension: function (landmarks) {
        const aspect = Math.abs(landmarks[159].y - landmarks[145].y) / Math.abs(landmarks[33].x - landmarks[133].x);
        return Math.max(0, 1 - (aspect * 2.5));
    },
    getEyebrowHeight: function (landmarks) {
        const eyeY = (landmarks[159].y + landmarks[145].y) / 2;
        return Math.min(1, ((eyeY - landmarks[105].y) + (eyeY - landmarks[334].y)) / 0.08);
    },

    initAI: function (stream) {
        const video = document.getElementById('input-video');
        if (stream) {
            video.srcObject = stream;
            const faceMesh = new FaceMesh({ locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}` });
            faceMesh.setOptions({ maxNumFaces: 1, refineLandmarks: true, minDetectionConfidence: 0.6 });
            faceMesh.onResults((res) => this.processData(res));
            const camera = new Camera(video, { onFrame: async () => await faceMesh.send({ image: video }), width: 640, height: 480 });
            camera.start();
        }
        document.addEventListener('mousemove', (e) => {
            if (!this.state.isFaceDetected && !this.state.isSensorActive) {
                this.state.headRot.y = (e.clientX / window.innerWidth - 0.5) * 1.5;
                this.state.headRot.x = (e.clientY / window.innerHeight - 0.5) * 1.5;
            }
        });
    },

    processData: function (results) {
        if (!this.state.isSensorActive) return;
        const statusEl = document.getElementById('connection-status');
        const landmarks = results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0 ? results.multiFaceLandmarks[0] : null;
        this.updateAlignment(landmarks);

        if (landmarks) {
            this.state.isFaceDetected = true;
            statusEl.innerText = "VISION: ACTIVE"; statusEl.style.color = "#00F0FF";
            if (!this.state.isScanning) {
                const durationMap = { glimpse: "2s", default: "30s", spectrum: "60s" };
                document.getElementById('instruction').innerText = "HOLD TO SCAN · " + durationMap[this.state.scanMode];
            }

            const nose = landmarks[1];
            this.state.headRot.x = (nose.y - 0.5) * 2;
            this.state.headRot.y = (nose.x - 0.5) * 2;

            const upperLip = landmarks[13], lowerLip = landmarks[14];
            const dist = Math.sqrt(Math.pow(upperLip.x - lowerLip.x, 2) + Math.pow(upperLip.y - lowerLip.y, 2));
            this.state.mouthOpen += ((dist - 0.02) * 5 - this.state.mouthOpen) * 0.2;
            if (this.state.mouthOpen < 0) this.state.mouthOpen = 0;

            if (this.state.isScanning) {
                this.state.scanBuffer.push({
                    headRot: { x: this.state.headRot.x, y: this.state.headRot.y },
                    mouthOpen: this.state.mouthOpen,
                    audioData: this.state.audioData || 0,
                    eyeOpen: this.getEyeOpenness(landmarks),
                    eyeTens: this.getEyeTension(landmarks),
                    browH: this.getEyebrowHeight(landmarks)
                });

                if (this.state.rppg) {
                    const videoEl = document.getElementById('input-video');
                    const meanG = this.state.rppg.extractRoiMeanG(videoEl, landmarks);
                    this.state.rppg.pushFrame({ t: performance.now(), meanG });

                    const now = performance.now();
                    if (now - this.state.rppgTick > 900) {
                        this.state.rppgTick = now;
                        this.state.rppg.requestCompute();
                        if (this.state.scanMode !== "glimpse" && !this.state.gateHold) {
                            const statusStr = this.state.rppg.getStatusString();
                            document.getElementById('instruction').innerText = statusStr;
                        }
                    }
                }

                if (this.state.expression) this.state.expression.pushSample(landmarks, performance.now());
            }

            if (this.state.expression && !this.state.isScanning) {
                this.state.expression.pushSample(landmarks, performance.now());
                const exprOut = this.state.expression.getPhaseOutput(1);
                if (!exprOut.ready && this.state.isFaceDetected) {
                    document.getElementById('instruction').innerText = exprOut.message;
                    document.getElementById('instruction').style.color = '#FF8800';
                }
            }
        } else {
            statusEl.innerText = "SEARCHING..."; statusEl.style.color = "gray";
            if (this.state.expression) this.state.expression.pushSample(null, performance.now());
        }
    },

    updateAlignment: function (landmarks) {
        const capsule = document.getElementById('align-hint-capsule');
        const textBox = document.getElementById('hint-text');
        const iconBox = document.getElementById('hint-icon-box');
        if (this.state.isScanning || document.getElementById('dashboard-layer').classList.contains('show')) {
            capsule.classList.remove('show'); return;
        }
        let msg = "FIND FACE"; let icon = "scan-face";
        let colorClass = "status-error"; let iconColor = "text-red-400"; let iconBg = "bg-red-500/20";

        if (landmarks) {
            msg = "READY TO SCAN"; icon = "check-circle";
            colorClass = "status-good"; iconColor = "text-cyan-400"; iconBg = "bg-cyan-500/20";
        }
        if (textBox.innerText !== msg) {
            textBox.innerText = msg;
            iconBox.className = `w-6 h-6 rounded-full flex items-center justify-center transition-colors duration-300 ${iconBg}`;
            iconBox.innerHTML = `<i data-lucide="${icon}" class="w-4 h-4 ${iconColor}"></i>`;
            lucide.createIcons();
            capsule.className = ""; capsule.classList.add(colorClass, 'show');
        }
        if (!capsule.classList.contains('show')) capsule.classList.add('show');
    },

    animate: function () {
        requestAnimationFrame(() => this.animate());
        this.updateAudio();
        this.updateEnvironment();

        const time = Date.now() * 0.001;
        if (!this.state.isSensorActive) {
            this.state.headRot.x = Math.sin(time * 0.5) * 0.15;
            this.state.headRot.y = Math.cos(time * 0.3) * 0.15;
            this.state.mouthOpen = 0.05 + Math.max(0, Math.sin(time * 1.5) * 0.05);
        }
        this.cloud.rotation.y += 0.002 + (this.state.headRot.y * 0.05);
        this.cloud.rotation.x += (this.state.headRot.x * 0.05);
        const audioForce = (this.state.audioData || 0) / 255;
        let targetEnergy = 0.2 + (audioForce * 0.8);
        if (this.state.mouthOpen > 0.1) targetEnergy += this.state.mouthOpen * 1.5;
        if (this.state.isScanning) targetEnergy = 3.0;
        this.state.energy += (targetEnergy - this.state.energy) * 0.1;

        const positions = this.cloud.geometry.attributes.position.array;
        const originals = this.cloud.geometry.attributes.originalPosition.array;
        const randoms = this.cloud.geometry.attributes.random.array;
        const expansionBase = 1 + (this.state.mouthOpen * 0.3) + (audioForce * 0.2);
        const pulse = Math.sin(time * 2) * this.state.energy * 0.1;
        const jitter = audioForce * 0.15;
        for (let i = 0; i < this.config.particleCount; i++) {
            const idx = i * 3;
            const ox = originals[idx], oy = originals[idx + 1], oz = originals[idx + 2];
            const expansion = expansionBase;
            const noise = pulse * (randoms[i] + 0.5) + (Math.random() - 0.5) * jitter;
            positions[idx] = ox * expansion + (ox * noise);
            positions[idx + 1] = oy * expansion + (oy * noise);
            positions[idx + 2] = oz * expansion + (oz * noise);
        }
        this.cloud.geometry.attributes.position.needsUpdate = true;
        if (this.state.isScanning) {
            this.material.size = 0.12 + audioForce * 0.1; this.material.opacity = 1.0;
        } else {
            this.material.size = 0.08 + (audioForce * 0.05); this.material.opacity = 0.8;
        }
        this.renderer.render(this.scene, this.camera);
    },

    initEvents: function () {
        const btnWrapper = document.getElementById('scan-trigger-wrapper');
        const ringPath = document.getElementById('scan-progress-bar');
        const maxOffset = 339;
        const self = this;

        const startSeamlessScan = (e) => {
            e.preventDefault();
            if (this.state.isScanning) return;

            if (!this.audioCtx) {
                this.startSensors();
                document.getElementById('instruction').innerText = "SENSORS READY. TAP AGAIN.";
                return;
            }

            this.state.isScanning = true;
            this.state.scanBuffer = [];
            this.state.scanStartTime = performance.now();
            this.state.currentPhase = 0;
            this.state.validHrvCount = 0;
            this.state.scanComplete = false;
            this.state.isLiveSyncActive = true;

            if (this.state.rppg) {
                this.state.rppg.reset();
                this.state.rppg.setMode('spectrum');
            }
            if (this.state.expression) this.state.expression.reset();

            document.getElementById('align-hint-capsule').classList.remove('show');
            btnWrapper.classList.add('active');
            document.getElementById('instruction').innerText = "SCANNING...";
            document.getElementById('instruction').style.color = "#00F0FF";
            if (navigator.vibrate) navigator.vibrate(50);

            ringPath.style.strokeDashoffset = maxOffset;

            let lastPhase = 0;
            const phaseThresholds = [
                { ms: 2000, phase: 1, name: 'GLIMPSE', confidence: 30 },
                { ms: 15000, phase: 2, name: 'PREVIEW', confidence: 50 },
                { ms: 30000, phase: 3, name: 'DEFAULT', confidence: 75 },
                { ms: 60000, phase: 4, name: 'SPECTRUM', confidence: 95 }
            ];

            this.scanInterval = setInterval(() => {
                const elapsed = performance.now() - self.state.scanStartTime;
                const gate = self.gatePass();

                if (!gate.pass) {
                    self.state.gateHold = true;
                    document.getElementById("instruction").innerText = "HOLD · " + gate.reason;
                    document.getElementById("instruction").style.color = "#FF5500";
                    return;
                }

                self.state.gateHold = false;
                const pct = Math.min(100, (elapsed / 60000) * 100);
                ringPath.style.strokeDashoffset = maxOffset - (pct / 100) * maxOffset;

                for (let i = phaseThresholds.length - 1; i >= 0; i--) {
                    const pt = phaseThresholds[i];
                    if (elapsed >= pt.ms && lastPhase < pt.phase) {
                        lastPhase = pt.phase;
                        self.state.currentPhase = pt.phase;
                        self.state.liveConfidence = pt.confidence;

                        if (navigator.vibrate) navigator.vibrate([30, 20, 30]);
                        if (pt.phase === 1) self.showSeamlessDashboard();

                        document.getElementById('instruction').innerText = pt.name + " · " + Math.round(elapsed / 1000) + "s";

                        if (pt.phase === 4) {
                            self.state.scanComplete = true;
                            document.getElementById('instruction').innerText = "SCAN COMPLETE";
                            document.getElementById('instruction').style.color = "#00FF94";
                            if (navigator.vibrate) navigator.vibrate([50, 30, 50, 30, 100]);
                        }
                        break;
                    }
                }

                if (!self.state.gateHold && lastPhase > 0) {
                    const secs = Math.round(elapsed / 1000);
                    const currentPhaseName = phaseThresholds[lastPhase - 1]?.name || 'SCANNING';
                    document.getElementById('instruction').innerText = currentPhaseName + " · " + secs + "s";
                    document.getElementById('instruction').style.color = "#00F0FF";
                }
            }, 100);
        };

        const toggleScan = (e) => {
            e.preventDefault();
            if (this.state.isScanning) {
                this.state.isScanning = false;
                clearInterval(this.scanInterval);
                btnWrapper.classList.remove('active');
                ringPath.style.strokeDashoffset = maxOffset;
                document.getElementById('instruction').innerText = "TAP TO SCAN";
                document.getElementById('instruction').style.color = "#9CA3AF";
                document.getElementById('dashboard-layer').classList.remove('show');
                document.getElementById('hud-layer').classList.remove('hidden-ui');
            } else {
                startSeamlessScan(e);
            }
        };

        btnWrapper.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
        btnWrapper.addEventListener('click', toggleScan);
        btnWrapper.addEventListener('touchend', (e) => { e.preventDefault(); e.stopPropagation(); toggleScan(e); }, { passive: false });
    },

    showSeamlessDashboard: function () {
        document.getElementById('hud-layer').classList.add('hidden-ui');
        document.getElementById('align-hint-capsule').classList.remove('show');
        this.startLiveMode();
        document.getElementById('dashboard-layer').classList.add('show');
    },

    initDashboardInteractions: function () {
        const container = document.getElementById('tei-orbit-container');
        const self = this;
        const startCharge = (e) => {
            if (e) e.preventDefault();
            container.classList.add('charging');
            if (navigator.vibrate) navigator.vibrate(20);
            this.chargeInterval = setInterval(() => {
                if (self.state.mentalBuffer < 100) {
                    self.state.mentalBuffer += 1.5;
                    self.updateDashboardVisuals();
                    if (Math.floor(self.state.mentalBuffer) % 10 === 0 && navigator.vibrate) navigator.vibrate(5);
                } else {
                    clearInterval(self.chargeInterval);
                    if (navigator.vibrate) navigator.vibrate([30, 30, 30]);
                }
            }, 30);
        };
        const stopCharge = (e) => {
            if (e) e.preventDefault();
            container.classList.remove('charging');
            clearInterval(self.chargeInterval);
        };
        container.addEventListener('mousedown', startCharge);
        container.addEventListener('touchstart', startCharge);
        window.addEventListener('mouseup', stopCharge);
        container.addEventListener('mouseleave', stopCharge);
        window.addEventListener('touchend', stopCharge);
    },

    updateDashboardVisuals: function () {
        const m = this.state.liveMetrics;

        // v51.1: Live sync indicator
        const syncIndicator = this.state.isLiveSyncActive ? "LIVE SYNC" : "SIMULATION";
        const gateStatus = document.getElementById('gate-status-text');
        if (gateStatus && this.state.isLiveMode) {
            gateStatus.innerText = syncIndicator;
            gateStatus.style.color = this.state.isLiveSyncActive ? "#00FF94" : "#9CA3AF";
        }

        // Update HR & RR displays
        const bpmEl = document.getElementById('bpm-val');
        if (bpmEl) bpmEl.innerText = Math.round(m.hr);

        const snapHr = document.getElementById('snap-hr');
        if (snapHr) snapHr.innerHTML = Math.round(m.hr) + '<span class="snapshot-unit">bpm</span>';

        const snapRr = document.getElementById('snap-rr');
        if (snapRr) snapRr.innerHTML = Math.round(m.rr) + '<span class="snapshot-unit">/m</span>';

        // Update ANS Balance
        const snsPct = Math.round(m.sns);
        const pnsPct = Math.round(m.pns);

        const ansSnsBar = document.getElementById('ans-sns-bar');
        if (ansSnsBar) ansSnsBar.style.width = snsPct + "%";
        const ansPnsBar = document.getElementById('ans-pns-bar');
        if (ansPnsBar) ansPnsBar.style.width = pnsPct + "%";

        const snsVal = document.getElementById('sns-val');
        if (snsVal) snsVal.innerText = snsPct + "%";
        const pnsVal = document.getElementById('pns-val');
        if (pnsVal) pnsVal.innerText = pnsPct + "%";

        const ratioEl = document.getElementById('ans-ratio');
        if (ratioEl) ratioEl.innerText = `${snsPct}/${pnsPct}`;

        // HRV (RMSSD)
        const hrvEl = document.getElementById('hrv-val');
        if (hrvEl) hrvEl.innerText = Math.round(m.rmssd || m.pns * 1.5);

        // PPG Graph animation
        const ppgContainer = document.getElementById('ppg-graph');
        if (ppgContainer && ppgContainer.children.length > 0) {
            const bars = Array.from(ppgContainer.children);
            const time = performance.now() / 200;
            bars.forEach((bar, i) => {
                const h = 20 + Math.sin(time + (i * 0.5)) * 15 + Math.random() * 10;
                bar.style.height = Math.max(5, h) + '%';
                bar.style.opacity = 0.3 + (h / 40);
            });
        }
    },

    reset: function () {
        this.stopLiveMode();
        this.stopSensors();
        if (this.state.expression) this.state.expression.reset();
        if (this.state.hints) this.state.hints.reset();

        document.getElementById('dashboard-layer').classList.remove('show');
        document.getElementById('hud-layer').classList.remove('hidden-ui');
        document.getElementById('universe').classList.remove('dimmed');
        document.getElementById('scan-trigger-wrapper').classList.remove('active');
        document.getElementById('instruction').innerText = "TAP TO SCAN";
        document.getElementById('instruction').style.color = "#9CA3AF";
        document.getElementById('dash-score').innerText = "00";
        this.state.mentalBuffer = 0;
        this.state.isLiveSyncActive = true;

        const ringPath = document.getElementById('scan-progress-bar');
        if (ringPath) ringPath.style.strokeDashoffset = 339;
    }
};

window.onload = () => app.init();
window.onresize = () => {
    app.camera.aspect = window.innerWidth / window.innerHeight;
    app.camera.updateProjectionMatrix();
    app.renderer.setSize(window.innerWidth, window.innerHeight);
};
