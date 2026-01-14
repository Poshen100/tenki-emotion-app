// TENKI v50 App - Progressive Precision + rPPG
lucide.createIcons();

const app = {
    config: {
        particleCount: 8000, particleSize: 0.08,
        scanDurationByMode: { glimpse: 2000, lock: 15000, spectrum: 60000 },
        confidenceByMode: { glimpse: 30, lock: 75, spectrum: 95 },
        gateLuxMin: 20, gateShakeMax: 0.5
    },
    state: {
        isFaceDetected: false, isScanning: false, isSensorActive: false,
        mouthOpen: 0, headRot: { x: 0, y: 0 }, energy: 0, audioData: 0,
        baseScore: 0, mentalBuffer: 0, engineResult: null, scanBuffer: [],
        envLux: 0, deviceMotion: 0, scanMode: "glimpse", gateHold: false,
        rppg: null, rppgTick: 0
    },
    audioCtx: null, analyser: null, dataArray: null, stream: null, lightCtx: null,

    init: function() {
        this.initThree(); this.initEvents(); this.initDashboardInteractions();
        this.initEnvironment(); this.initPrecisionTabs();
        const container = document.getElementById('ppg-graph');
        for (let i = 0; i < 30; i++) {
            const d = document.createElement('div');
            d.className = 'bio-bar'; d.style.height = '10%';
            container.appendChild(d);
        }
        document.getElementById('dash-date').innerText = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase();
        if (typeof TENKI_RPPG !== 'undefined') this.state.rppg = TENKI_RPPG.create('./rpgg-worker.js');
    },

    gatePass: function() {
        if (!this.state.isFaceDetected) return { pass: false, reason: "FIND FACE" };
        if (this.state.envLux < this.config.gateLuxMin) return { pass: false, reason: "LOW LIGHT" };
        if (this.state.deviceMotion > this.config.gateShakeMax) return { pass: false, reason: "HOLD STEADY" };
        if (this.state.rppg && this.state.scanMode !== "glimpse") {
            const rg = this.state.rppg.getQualityGate();
            if (!rg.pass) return { pass: false, reason: rg.reason };
        }
        return { pass: true, reason: "READY" };
    },

    initPrecisionTabs: function() {
        const tabs = document.querySelectorAll("#precision-tabs .precision-tab");
        const self = this;
        tabs.forEach(btn => {
            btn.addEventListener("click", function() {
                tabs.forEach(b => b.classList.remove("active"));
                btn.classList.add("active");
                self.state.scanMode = btn.dataset.mode;
                if (self.state.rppg) self.state.rppg.setMode(btn.dataset.mode);
                const dm = { glimpse: "2s", lock: "15s", spectrum: "60s" };
                document.getElementById("instruction").innerText = "HOLD TO SYNC · " + dm[self.state.scanMode];
            });
        });
    },

    initEnvironment: function() {
        const c = document.getElementById('light-analysis-canvas');
        if (c) this.lightCtx = c.getContext('2d', { willReadFrequently: true });
        window.addEventListener('devicemotion', (e) => {
            if (e.accelerationIncludingGravity) {
                const { x, y, z } = e.accelerationIncludingGravity;
                this.state.deviceMotion = Math.abs(Math.sqrt(x*x + y*y + z*z) - 9.8) * 0.1;
            }
        });
    },

    updateEnvironment: function() {
        if (!this.state.isSensorActive) {
            this.updateEnvUI(60 + Math.sin(Date.now() * 0.001) * 10, 0.02);
            return;
        }
        if (this.lightCtx && document.getElementById('input-video').readyState === 4) {
            if (Math.random() > 0.9) {
                const v = document.getElementById('input-video');
                this.lightCtx.drawImage(v, 0, 0, 50, 50);
                const frame = this.lightCtx.getImageData(0, 0, 50, 50).data;
                let colorSum = 0;
                for (let x = 0; x < frame.length; x += 4) colorSum += Math.floor((frame[x] + frame[x+1] + frame[x+2]) / 3);
                this.state.envLux = Math.min(100, (Math.floor(colorSum / 2500) / 200) * 100);
            }
        }
        let instab = this.state.deviceMotion;
        if (this.state.headRot) instab += (Math.abs(this.state.headRot.x) + Math.abs(this.state.headRot.y)) * 0.05;
        this.updateEnvUI(this.state.envLux, instab);
    },

    updateEnvUI: function(lux, shake) {
        const luxBar = document.getElementById('env-lux-bar');
        const luxItem = document.getElementById('env-lux');
        const stabBar = document.getElementById('env-stab-bar');
        const stabItem = document.getElementById('env-stab');
        if (luxBar) { luxBar.style.width = lux + '%'; if (lux < 20) { luxItem.classList.add('warn'); luxItem.classList.remove('good'); } else { luxItem.classList.add('good'); luxItem.classList.remove('warn'); } }
        if (stabBar) { const stabPct = Math.max(0, 100 - (shake * 100)); stabBar.style.width = stabPct + '%'; if (shake > 0.5) { stabItem.classList.add('warn'); stabItem.classList.remove('good'); } else { stabItem.classList.add('good'); stabItem.classList.remove('warn'); } }
    },

    initThree: function() {
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
        const colors = new Float32Array(this.config.particleCount * 3);
        const randoms = new Float32Array(this.config.particleCount);
        const originals = new Float32Array(this.config.particleCount * 3);
        const phi = Math.PI * (3 - Math.sqrt(5));
        for (let i = 0; i < this.config.particleCount; i++) {
            const y = 1 - (i / (this.config.particleCount - 1)) * 2;
            const radius = Math.sqrt(1 - y * y);
            const theta = phi * i;
            const idx = i * 3;
            positions[idx] = Math.cos(theta) * radius * 2.5;
            positions[idx + 1] = y * 2.5;
            positions[idx + 2] = Math.sin(theta) * radius * 2.5;
            originals[idx] = positions[idx]; originals[idx+1] = positions[idx+1]; originals[idx+2] = positions[idx+2];
            randoms[i] = Math.random();
            const c = new THREE.Color().setHSL(0.5 + y * 0.2, 0.8, 0.6);
            colors[idx] = c.r; colors[idx + 1] = c.g; colors[idx + 2] = c.b;
        }
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('originalPosition', new THREE.BufferAttribute(originals, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geometry.setAttribute('random', new THREE.BufferAttribute(randoms, 1));
        this.material = new THREE.PointsMaterial({ size: this.config.particleSize, vertexColors: true, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
        this.cloud = new THREE.Points(geometry, this.material);
        this.scene.add(this.cloud);
        this.animate();
    },

    startSensors: async function() {
        document.getElementById('instruction').innerText = "SENSORS ACTIVE...";
        try {
            this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            this.analyser = this.audioCtx.createAnalyser(); this.analyser.fftSize = 64;
            this.stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
            const source = this.audioCtx.createMediaStreamSource(this.stream);
            source.connect(this.analyser);
            this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
            this.initAI(this.stream); this.state.isSensorActive = true;
        } catch (e) { document.getElementById('instruction').innerText = "USE MOUSE MODE"; this.initAI(null); }
    },

    stopSensors: function() {
        if (this.stream) { this.stream.getTracks().forEach(track => track.stop()); this.stream = null; }
        if (this.audioCtx) { this.audioCtx.close(); this.audioCtx = null; }
        this.state.isSensorActive = false; this.state.isFaceDetected = false;
        document.getElementById('connection-status').innerText = "SIMULATION MODE";
    },

    updateAudio: function() {
        if (!this.state.isSensorActive) { this.state.audioData = 30 + Math.sin(Date.now() * 0.001 * 0.8) * 15; return; }
        if (!this.analyser) return;
        this.analyser.getByteFrequencyData(this.dataArray);
        let sum = 0; for (let i = 0; i < this.dataArray.length; i++) sum += this.dataArray[i];
        this.state.audioData = sum / this.dataArray.length;
    },

    getEyeOpenness: function(lm) { return Math.min(1, (Math.abs(lm[159].y - lm[145].y) + Math.abs(lm[386].y - lm[374].y)) / 2 / 0.05); },
    getEyeTension: function(lm) { return Math.max(0, 1 - (Math.abs(lm[159].y - lm[145].y) / Math.abs(lm[33].x - lm[133].x)) * 2.5); },
    getEyebrowHeight: function(lm) { const eyeY = (lm[159].y + lm[145].y) / 2; return Math.min(1, ((eyeY - lm[105].y) + (eyeY - lm[334].y)) / 0.08); },

    initAI: function(stream) {
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

    processData: function(results) {
        if (!this.state.isSensorActive) return;
        const statusEl = document.getElementById('connection-status');
        const landmarks = results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0 ? results.multiFaceLandmarks[0] : null;
        this.updateAlignment(landmarks);
        if (landmarks) {
            this.state.isFaceDetected = true;
            statusEl.innerText = "VISION: ACTIVE"; statusEl.style.color = "#00F0FF";
            if (!this.state.isScanning) {
                const dm = { glimpse: "2s", lock: "15s", spectrum: "60s" };
                document.getElementById('instruction').innerText = "HOLD TO SCAN · " + dm[this.state.scanMode];
            }
            const nose = landmarks[1];
            this.state.headRot.x = (nose.y - 0.5) * 2; this.state.headRot.y = (nose.x - 0.5) * 2;
            const upperLip = landmarks[13], lowerLip = landmarks[14];
            const dist = Math.sqrt(Math.pow(upperLip.x - lowerLip.x, 2) + Math.pow(upperLip.y - lowerLip.y, 2));
            this.state.mouthOpen += ((dist - 0.02) * 5 - this.state.mouthOpen) * 0.2;
            if (this.state.mouthOpen < 0) this.state.mouthOpen = 0;
            if (this.state.isScanning) {
                this.state.scanBuffer.push({ headRot: { x: this.state.headRot.x, y: this.state.headRot.y }, mouthOpen: this.state.mouthOpen, audioData: this.state.audioData || 0, eyeOpen: this.getEyeOpenness(landmarks), eyeTens: this.getEyeTension(landmarks), browH: this.getEyebrowHeight(landmarks) });
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
            }
        } else { statusEl.innerText = "SEARCHING..."; statusEl.style.color = "gray"; }
    },

    updateAlignment: function(landmarks) {
        const capsule = document.getElementById('align-hint-capsule');
        const textBox = document.getElementById('hint-text');
        const iconBox = document.getElementById('hint-icon-box');
        if (this.state.isScanning || document.getElementById('dashboard-layer').classList.contains('show')) { capsule.classList.remove('show'); return; }
        let msg = "FIND FACE"; let icon = "scan-face"; let colorClass = "status-error"; let iconColor = "text-red-400"; let iconBg = "bg-red-500/20";
        if (landmarks) { msg = "READY TO SCAN"; icon = "check-circle"; colorClass = "status-good"; iconColor = "text-cyan-400"; iconBg = "bg-cyan-500/20"; }
        if (textBox.innerText !== msg) { textBox.innerText = msg; iconBox.className = `w-6 h-6 rounded-full flex items-center justify-center transition-colors duration-300 ${iconBg}`; iconBox.innerHTML = `<i data-lucide="${icon}" class="w-4 h-4 ${iconColor}"></i>`; lucide.createIcons(); capsule.className = ""; capsule.classList.add(colorClass, 'show'); }
        if (!capsule.classList.contains('show')) capsule.classList.add('show');
    },

    animate: function() {
        requestAnimationFrame(() => this.animate());
        this.updateAudio(); this.updateEnvironment();
        const time = Date.now() * 0.001;
        if (!this.state.isSensorActive) { this.state.headRot.x = Math.sin(time * 0.5) * 0.15; this.state.headRot.y = Math.cos(time * 0.3) * 0.15; this.state.mouthOpen = 0.05 + Math.max(0, Math.sin(time * 1.5) * 0.05); }
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
            const noise = pulse * (randoms[i] + 0.5) + (Math.random() - 0.5) * jitter;
            positions[idx] = ox * expansionBase + (ox * noise);
            positions[idx + 1] = oy * expansionBase + (oy * noise);
            positions[idx + 2] = oz * expansionBase + (oz * noise);
        }
        this.cloud.geometry.attributes.position.needsUpdate = true;
        if (this.state.isScanning) { this.material.size = 0.12 + audioForce * 0.1; this.material.opacity = 1.0; }
        else { this.material.size = 0.08 + (audioForce * 0.05); this.material.opacity = 0.8; }
        this.renderer.render(this.scene, this.camera);
    },

    initEvents: function() {
        const btnWrapper = document.getElementById('scan-trigger-wrapper');
        const ringPath = document.getElementById('scan-progress-bar');
        const maxOffset = 339;
        const self = this;
        const start = (e) => {
            e.preventDefault();
            if (!this.audioCtx) { this.startSensors(); document.getElementById('instruction').innerText = "SENSORS READY. HOLD NOW."; return; }
            this.state.isScanning = true; this.state.scanBuffer = [];
            if (this.state.rppg) { this.state.rppg.reset(); this.state.rppg.setMode(this.state.scanMode); }
            document.getElementById('align-hint-capsule').classList.remove('show');
            btnWrapper.classList.add('active');
            document.getElementById('instruction').innerText = "KEEP STEADY...";
            document.getElementById('instruction').style.color = "#00F0FF";
            if (navigator.vibrate) navigator.vibrate(50);
            ringPath.style.strokeDashoffset = maxOffset;
            let elapsed = 0;
            const duration = self.config.scanDurationByMode[self.state.scanMode] || 2000;
            this.scanInterval = setInterval(() => {
                const gate = self.gatePass();
                if (!gate.pass) { self.state.gateHold = true; document.getElementById("instruction").innerText = "GATE HOLD · " + gate.reason; document.getElementById("instruction").style.color = "#FF5500"; return; }
                self.state.gateHold = false; document.getElementById("instruction").innerText = "KEEP STEADY..."; document.getElementById("instruction").style.color = "#00F0FF";
                elapsed += 40;
                const pct = Math.min(100, Math.floor((elapsed / duration) * 100));
                ringPath.style.strokeDashoffset = maxOffset - (pct / 100) * maxOffset;
                if (pct % 10 === 0 && navigator.vibrate) navigator.vibrate(8);
                if (pct >= 100) self.finishScan();
            }, 40);
        };
        const end = (e) => {
            e.preventDefault();
            if (!this.state.isScanning) return;
            this.state.isScanning = false;
            clearInterval(this.scanInterval);
            btnWrapper.classList.remove('active');
            ringPath.style.transition = 'none';
            ringPath.style.strokeDashoffset = maxOffset;
            setTimeout(() => { ringPath.style.transition = 'stroke-dashoffset 0.05s linear'; }, 100);
            const dm = { glimpse: "2s", lock: "15s", spectrum: "60s" };
            document.getElementById('instruction').innerText = "HOLD TO SYNC · " + dm[this.state.scanMode];
            document.getElementById('instruction').style.color = "#9CA3AF";
        };
        btnWrapper.addEventListener('mousedown', start); btnWrapper.addEventListener('touchstart', start);
        window.addEventListener('mouseup', end); window.addEventListener('touchend', end);
    },

    finishScan: function() {
        clearInterval(this.scanInterval);
        this.state.isScanning = false;
        if (navigator.vibrate) navigator.vibrate([50, 50, 100]);
        this.state.engineResult = TenkiEngine.calculatePole(this.state.scanBuffer, { lux: this.state.envLux, motion: this.state.deviceMotion }, this.state.scanMode);
        const conf = this.config.confidenceByMode[this.state.scanMode] || 30;
        baselineMgr.recordSession();
        this.state.baseScore = this.state.engineResult.scoreNumeric || (typeof this.state.engineResult.score === 'number' ? this.state.engineResult.score : 50);
        this.state.mentalBuffer = 0;
        this.state.v50Confidence = conf;
        if (this.state.rppg && this.state.scanMode !== "glimpse") {
            const m = this.state.rppg.metrics;
            if (m.bpm !== null) this.state.engineResult.bpm = Math.round(m.bpm);
            if (m.rmssd !== null) this.state.engineResult.hrv = Math.round(m.rmssd);
            document.getElementById('dash-quote').innerText = `"${this.state.rppg.getStatusString()}"`;
        }
        this.showDashboard();
    },

    initDashboardInteractions: function() {
        const container = document.getElementById('tei-orbit-container');
        const self = this;
        const startCharge = (e) => {
            if (e) e.preventDefault();
            container.classList.add('charging');
            if (navigator.vibrate) navigator.vibrate(20);
            this.chargeInterval = setInterval(() => {
                if (self.state.mentalBuffer < 100) { self.state.mentalBuffer += 1.5; self.updateDashboardVisuals(); if (Math.floor(self.state.mentalBuffer) % 10 === 0 && navigator.vibrate) navigator.vibrate(5); }
                else { clearInterval(self.chargeInterval); if (navigator.vibrate) navigator.vibrate([30, 30, 30]); }
            }, 30);
        };
        const stopCharge = (e) => { if (e) e.preventDefault(); container.classList.remove('charging'); clearInterval(self.chargeInterval); };
        container.addEventListener('mousedown', startCharge); container.addEventListener('touchstart', startCharge);
        window.addEventListener('mouseup', stopCharge); container.addEventListener('mouseleave', stopCharge);
        window.addEventListener('touchend', stopCharge);
    },

    updateDashboardVisuals: function() {
        const res = this.state.engineResult;
        const safeEnergy = (res && Number.isFinite(res.energy)) ? res.energy : 30;
        const safeHrv = (res && Number.isFinite(res.hrv)) ? res.hrv : 60;
        const safeScore = res ? (res.scoreNumeric || (typeof res.score === 'number' ? res.score : 50)) : 50;
        const bufferPct = Math.min(100, Math.floor(this.state.mentalBuffer));
        const v50Conf = this.state.v50Confidence || this.config.confidenceByMode[this.state.scanMode] || 30;
        const displayConf = Math.floor((bufferPct / 100) * v50Conf);
        document.getElementById('resonance-fill').style.width = displayConf + "%";
        document.getElementById('confidence-val').innerText = displayConf + "%";
        const currentTargetScore = bufferPct === 100 ? safeScore : Math.floor((safeScore * (80 + bufferPct * 0.2)) / 100);
        const scoreEl = document.getElementById('dash-score');
        if (this.state.scanMode === "glimpse" && res && res.isRange) { scoreEl.innerText = res.score; scoreEl.style.fontSize = "60px"; }
        else { scoreEl.style.fontSize = "110px"; const cd = parseInt(scoreEl.innerText) || 0; if (cd < currentTargetScore) scoreEl.innerText = cd + 1; else if (cd > currentTargetScore) scoreEl.innerText = cd - 1; }
        const cScore = 753;
        document.getElementById('ring-score').style.strokeDashoffset = cScore - ((currentTargetScore / 100) * cScore);
        const label = document.getElementById('dash-label');
        const labelMap = { glimpse: "The Glimpse", lock: "The Lock", spectrum: "The Spectrum" };
        if (bufferPct < 100) { label.innerText = labelMap[this.state.scanMode] || "HOLD TO RESYNC"; label.style.color = "#9CA3AF"; }
        else { label.innerText = labelMap[this.state.scanMode] + " · LOCKED"; label.style.color = "#00F0FF"; }
        const baseBpm = 60 + Math.floor(safeEnergy * 0.4);
        const jitter = (Math.floor(Date.now() / 1000) % 2 === 0) ? 1 : -1;
        document.getElementById('bpm-val').innerText = baseBpm + jitter;
        const bars = document.querySelectorAll('.bio-bar');
        bars.forEach((b) => { const h = 20 + (safeEnergy * 0.4) + (Math.random() * 40); b.style.height = h + '%'; b.style.opacity = h > 60 ? 1 : 0.4; });
        const pnsPct = Math.min(90, Math.max(10, Math.floor((safeHrv / 120) * 100)));
        const snsPct = 100 - pnsPct;
        document.getElementById('hrv-val').innerText = safeHrv;
        document.getElementById('ans-sns-bar').style.width = snsPct + '%';
        document.getElementById('ans-pns-bar').style.width = pnsPct + '%';
        document.getElementById('sns-val').innerText = snsPct + '%';
        document.getElementById('pns-val').innerText = pnsPct + '%';
        const focus = Math.min(100, (res ? res.alertness : 50) + 10);
lucide.createIcons();

const app = {
    config: {
        particleCount: 8000, particleSize: 0.08,
        scanDurationByMode: { glimpse: 2000, lock: 15000, spectrum: 60000 },
        confidenceByMode: { glimpse: 30, lock: 75, spectrum: 95 },
        gateLuxMin: 20, gateShakeMax: 0.5
    },
    state: {
        isFaceDetected: false, isScanning: false, isSensorActive: false,
        mouthOpen: 0, headRot: { x: 0, y: 0 }, energy: 0, audioData: 0,
        baseScore: 0, mentalBuffer: 0, engineResult: null, scanBuffer: [],
        envLux: 0, deviceMotion: 0, scanMode: "glimpse", gateHold: false,
        rppg: null, rppgTick: 0
    },
    audioCtx: null, analyser: null, dataArray: null, stream: null, lightCtx: null,

    init: function() {
        this.initThree(); this.initEvents(); this.initDashboardInteractions();
        this.initEnvironment(); this.initPrecisionTabs();
        const container = document.getElementById('ppg-graph');
        for (let i = 0; i < 30; i++) {
            const d = document.createElement('div');
            d.className = 'bio-bar'; d.style.height = '10%';
            container.appendChild(d);
        }
        document.getElementById('dash-date').innerText = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase();
        if (typeof TENKI_RPPG !== 'undefined') this.state.rppg = TENKI_RPPG.create('./rpgg-worker.js');
    },

    gatePass: function() {
        if (!this.state.isFaceDetected) return { pass: false, reason: "FIND FACE" };
        if (this.state.envLux < this.config.gateLuxMin) return { pass: false, reason: "LOW LIGHT" };
        if (this.state.deviceMotion > this.config.gateShakeMax) return { pass: false, reason: "HOLD STEADY" };
        if (this.state.rppg && this.state.scanMode !== "glimpse") {
            const rg = this.state.rppg.getQualityGate();
            if (!rg.pass) return { pass: false, reason: rg.reason };
        }
        return { pass: true, reason: "READY" };
    },

    initPrecisionTabs: function() {
        const tabs = document.querySelectorAll("#precision-tabs .precision-tab");
        const self = this;
        tabs.forEach(btn => {
            btn.addEventListener("click", function() {
                tabs.forEach(b => b.classList.remove("active"));
                btn.classList.add("active");
                self.state.scanMode = btn.dataset.mode;
                if (self.state.rppg) self.state.rppg.setMode(btn.dataset.mode);
                const dm = { glimpse: "2s", lock: "15s", spectrum: "60s" };
                document.getElementById("instruction").innerText = "HOLD TO SYNC · " + dm[self.state.scanMode];
            });
        });
    },

    initEnvironment: function() {
        const c = document.getElementById('light-analysis-canvas');
        if (c) this.lightCtx = c.getContext('2d', { willReadFrequently: true });
        window.addEventListener('devicemotion', (e) => {
            if (e.accelerationIncludingGravity) {
                const { x, y, z } = e.accelerationIncludingGravity;
                this.state.deviceMotion = Math.abs(Math.sqrt(x*x + y*y + z*z) - 9.8) * 0.1;
            }
        });
    },

    updateEnvironment: function() {
        if (!this.state.isSensorActive) {
            this.updateEnvUI(60 + Math.sin(Date.now() * 0.001) * 10, 0.02);
            return;
        }
        if (this.lightCtx && document.getElementById('input-video').readyState === 4) {
            if (Math.random() > 0.9) {
                const v = document.getElementById('input-video');
                this.lightCtx.drawImage(v, 0, 0, 50, 50);
                const frame = this.lightCtx.getImageData(0, 0, 50, 50).data;
                let colorSum = 0;
                for (let x = 0; x < frame.length; x += 4) colorSum += Math.floor((frame[x] + frame[x+1] + frame[x+2]) / 3);
                this.state.envLux = Math.min(100, (Math.floor(colorSum / 2500) / 200) * 100);
            }
        }
        let instab = this.state.deviceMotion;
        if (this.state.headRot) instab += (Math.abs(this.state.headRot.x) + Math.abs(this.state.headRot.y)) * 0.05;
        this.updateEnvUI(this.state.envLux, instab);
    },

    updateEnvUI: function(lux, shake) {
        const luxBar = document.getElementById('env-lux-bar');
        const luxItem = document.getElementById('env-lux');
        const stabBar = document.getElementById('env-stab-bar');
        const stabItem = document.getElementById('env-stab');
        if (luxBar) { luxBar.style.width = lux + '%'; if (lux < 20) { luxItem.classList.add('warn'); luxItem.classList.remove('good'); } else { luxItem.classList.add('good'); luxItem.classList.remove('warn'); } }
        if (stabBar) { const stabPct = Math.max(0, 100 - (shake * 100)); stabBar.style.width = stabPct + '%'; if (shake > 0.5) { stabItem.classList.add('warn'); stabItem.classList.remove('good'); } else { stabItem.classList.add('good'); stabItem.classList.remove('warn'); } }
    },

    initThree: function() {
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
        const colors = new Float32Array(this.config.particleCount * 3);
        const randoms = new Float32Array(this.config.particleCount);
        const originals = new Float32Array(this.config.particleCount * 3);
        const phi = Math.PI * (3 - Math.sqrt(5));
        for (let i = 0; i < this.config.particleCount; i++) {
            const y = 1 - (i / (this.config.particleCount - 1)) * 2;
            const radius = Math.sqrt(1 - y * y);
            const theta = phi * i;
            const idx = i * 3;
            positions[idx] = Math.cos(theta) * radius * 2.5;
            positions[idx + 1] = y * 2.5;
            positions[idx + 2] = Math.sin(theta) * radius * 2.5;
            originals[idx] = positions[idx]; originals[idx+1] = positions[idx+1]; originals[idx+2] = positions[idx+2];
            randoms[i] = Math.random();
            const c = new THREE.Color().setHSL(0.5 + y * 0.2, 0.8, 0.6);
            colors[idx] = c.r; colors[idx + 1] = c.g; colors[idx + 2] = c.b;
        }
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('originalPosition', new THREE.BufferAttribute(originals, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geometry.setAttribute('random', new THREE.BufferAttribute(randoms, 1));
        this.material = new THREE.PointsMaterial({ size: this.config.particleSize, vertexColors: true, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
        this.cloud = new THREE.Points(geometry, this.material);
        this.scene.add(this.cloud);
        this.animate();
    },

    startSensors: async function() {
        document.getElementById('instruction').innerText = "SENSORS ACTIVE...";
        try {
            this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            this.analyser = this.audioCtx.createAnalyser(); this.analyser.fftSize = 64;
            this.stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
            const source = this.audioCtx.createMediaStreamSource(this.stream);
            source.connect(this.analyser);
            this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
            this.initAI(this.stream); this.state.isSensorActive = true;
        } catch (e) { document.getElementById('instruction').innerText = "USE MOUSE MODE"; this.initAI(null); }
    },

    stopSensors: function() {
        if (this.stream) { this.stream.getTracks().forEach(track => track.stop()); this.stream = null; }
        if (this.audioCtx) { this.audioCtx.close(); this.audioCtx = null; }
        this.state.isSensorActive = false; this.state.isFaceDetected = false;
        document.getElementById('connection-status').innerText = "SIMULATION MODE";
    },

    updateAudio: function() {
        if (!this.state.isSensorActive) { this.state.audioData = 30 + Math.sin(Date.now() * 0.001 * 0.8) * 15; return; }
        if (!this.analyser) return;
        this.analyser.getByteFrequencyData(this.dataArray);
        let sum = 0; for (let i = 0; i < this.dataArray.length; i++) sum += this.dataArray[i];
        this.state.audioData = sum / this.dataArray.length;
    },

    getEyeOpenness: function(lm) { return Math.min(1, (Math.abs(lm[159].y - lm[145].y) + Math.abs(lm[386].y - lm[374].y)) / 2 / 0.05); },
    getEyeTension: function(lm) { return Math.max(0, 1 - (Math.abs(lm[159].y - lm[145].y) / Math.abs(lm[33].x - lm[133].x)) * 2.5); },
    getEyebrowHeight: function(lm) { const eyeY = (lm[159].y + lm[145].y) / 2; return Math.min(1, ((eyeY - lm[105].y) + (eyeY - lm[334].y)) / 0.08); },

    initAI: function(stream) {
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

    processData: function(results) {
        if (!this.state.isSensorActive) return;
        const statusEl = document.getElementById('connection-status');
        const landmarks = results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0 ? results.multiFaceLandmarks[0] : null;
        this.updateAlignment(landmarks);
        if (landmarks) {
            this.state.isFaceDetected = true;
            statusEl.innerText = "VISION: ACTIVE"; statusEl.style.color = "#00F0FF";
            if (!this.state.isScanning) {
                const dm = { glimpse: "2s", lock: "15s", spectrum: "60s" };
                document.getElementById('instruction').innerText = "HOLD TO SCAN · " + dm[this.state.scanMode];
            }
            const nose = landmarks[1];
            this.state.headRot.x = (nose.y - 0.5) * 2; this.state.headRot.y = (nose.x - 0.5) * 2;
            const upperLip = landmarks[13], lowerLip = landmarks[14];
            const dist = Math.sqrt(Math.pow(upperLip.x - lowerLip.x, 2) + Math.pow(upperLip.y - lowerLip.y, 2));
            this.state.mouthOpen += ((dist - 0.02) * 5 - this.state.mouthOpen) * 0.2;
            if (this.state.mouthOpen < 0) this.state.mouthOpen = 0;
            if (this.state.isScanning) {
                this.state.scanBuffer.push({ headRot: { x: this.state.headRot.x, y: this.state.headRot.y }, mouthOpen: this.state.mouthOpen, audioData: this.state.audioData || 0, eyeOpen: this.getEyeOpenness(landmarks), eyeTens: this.getEyeTension(landmarks), browH: this.getEyebrowHeight(landmarks) });
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
            }
        } else { statusEl.innerText = "SEARCHING..."; statusEl.style.color = "gray"; }
    },

    updateAlignment: function(landmarks) {
        const capsule = document.getElementById('align-hint-capsule');
        const textBox = document.getElementById('hint-text');
        const iconBox = document.getElementById('hint-icon-box');
        if (this.state.isScanning || document.getElementById('dashboard-layer').classList.contains('show')) { capsule.classList.remove('show'); return; }
        let msg = "FIND FACE"; let icon = "scan-face"; let colorClass = "status-error"; let iconColor = "text-red-400"; let iconBg = "bg-red-500/20";
        if (landmarks) { msg = "READY TO SCAN"; icon = "check-circle"; colorClass = "status-good"; iconColor = "text-cyan-400"; iconBg = "bg-cyan-500/20"; }
        if (textBox.innerText !== msg) { textBox.innerText = msg; iconBox.className = `w-6 h-6 rounded-full flex items-center justify-center transition-colors duration-300 ${iconBg}`; iconBox.innerHTML = `<i data-lucide="${icon}" class="w-4 h-4 ${iconColor}"></i>`; lucide.createIcons(); capsule.className = ""; capsule.classList.add(colorClass, 'show'); }
        if (!capsule.classList.contains('show')) capsule.classList.add('show');
    },

    animate: function() {
        requestAnimationFrame(() => this.animate());
        this.updateAudio(); this.updateEnvironment();
        const time = Date.now() * 0.001;
        if (!this.state.isSensorActive) { this.state.headRot.x = Math.sin(time * 0.5) * 0.15; this.state.headRot.y = Math.cos(time * 0.3) * 0.15; this.state.mouthOpen = 0.05 + Math.max(0, Math.sin(time * 1.5) * 0.05); }
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
            const noise = pulse * (randoms[i] + 0.5) + (Math.random() - 0.5) * jitter;
            positions[idx] = ox * expansionBase + (ox * noise);
            positions[idx + 1] = oy * expansionBase + (oy * noise);
            positions[idx + 2] = oz * expansionBase + (oz * noise);
        }
        this.cloud.geometry.attributes.position.needsUpdate = true;
        if (this.state.isScanning) { this.material.size = 0.12 + audioForce * 0.1; this.material.opacity = 1.0; }
        else { this.material.size = 0.08 + (audioForce * 0.05); this.material.opacity = 0.8; }
        this.renderer.render(this.scene, this.camera);
    },

    initEvents: function() {
        const btnWrapper = document.getElementById('scan-trigger-wrapper');
        const ringPath = document.getElementById('scan-progress-bar');
        const maxOffset = 339;
        const self = this;
        const start = (e) => {
            e.preventDefault();
            if (!this.audioCtx) { this.startSensors(); document.getElementById('instruction').innerText = "SENSORS READY. HOLD NOW."; return; }
            this.state.isScanning = true; this.state.scanBuffer = [];
            if (this.state.rppg) { this.state.rppg.reset(); this.state.rppg.setMode(this.state.scanMode); }
            document.getElementById('align-hint-capsule').classList.remove('show');
            btnWrapper.classList.add('active');
            document.getElementById('instruction').innerText = "KEEP STEADY...";
            document.getElementById('instruction').style.color = "#00F0FF";
            if (navigator.vibrate) navigator.vibrate(50);
            ringPath.style.strokeDashoffset = maxOffset;
            let elapsed = 0;
            const duration = self.config.scanDurationByMode[self.state.scanMode] || 2000;
            this.scanInterval = setInterval(() => {
                const gate = self.gatePass();
                if (!gate.pass) { self.state.gateHold = true; document.getElementById("instruction").innerText = "GATE HOLD · " + gate.reason; document.getElementById("instruction").style.color = "#FF5500"; return; }
                self.state.gateHold = false; document.getElementById("instruction").innerText = "KEEP STEADY..."; document.getElementById("instruction").style.color = "#00F0FF";
                elapsed += 40;
                const pct = Math.min(100, Math.floor((elapsed / duration) * 100));
                ringPath.style.strokeDashoffset = maxOffset - (pct / 100) * maxOffset;
                if (pct % 10 === 0 && navigator.vibrate) navigator.vibrate(8);
                if (pct >= 100) self.finishScan();
            }, 40);
        };
        const end = (e) => {
            e.preventDefault();
            if (!this.state.isScanning) return;
            this.state.isScanning = false;
            clearInterval(this.scanInterval);
            btnWrapper.classList.remove('active');
            ringPath.style.transition = 'none';
            ringPath.style.strokeDashoffset = maxOffset;
            setTimeout(() => { ringPath.style.transition = 'stroke-dashoffset 0.05s linear'; }, 100);
            const dm = { glimpse: "2s", lock: "15s", spectrum: "60s" };
            document.getElementById('instruction').innerText = "HOLD TO SYNC · " + dm[this.state.scanMode];
            document.getElementById('instruction').style.color = "#9CA3AF";
        };
        btnWrapper.addEventListener('mousedown', start); btnWrapper.addEventListener('touchstart', start);
        window.addEventListener('mouseup', end); window.addEventListener('touchend', end);
    },

    finishScan: function() {
        clearInterval(this.scanInterval);
        this.state.isScanning = false;
        if (navigator.vibrate) navigator.vibrate([50, 50, 100]);
        this.state.engineResult = TenkiEngine.calculatePole(this.state.scanBuffer, { lux: this.state.envLux, motion: this.state.deviceMotion }, this.state.scanMode);
        const conf = this.config.confidenceByMode[this.state.scanMode] || 30;
        baselineMgr.recordSession();
        this.state.baseScore = this.state.engineResult.scoreNumeric || (typeof this.state.engineResult.score === 'number' ? this.state.engineResult.score : 50);
        this.state.mentalBuffer = 0;
        this.state.v50Confidence = conf;
        if (this.state.rppg && this.state.scanMode !== "glimpse") {
            const m = this.state.rppg.metrics;
            if (m.bpm !== null) this.state.engineResult.bpm = Math.round(m.bpm);
            if (m.rmssd !== null) this.state.engineResult.hrv = Math.round(m.rmssd);
            document.getElementById('dash-quote').innerText = `"${this.state.rppg.getStatusString()}"`;
        }
        this.showDashboard();
    },

    initDashboardInteractions: function() {
        const container = document.getElementById('tei-orbit-container');
        const self = this;
        const startCharge = (e) => {
            if (e) e.preventDefault();
            container.classList.add('charging');
            if (navigator.vibrate) navigator.vibrate(20);
            this.chargeInterval = setInterval(() => {
                if (self.state.mentalBuffer < 100) { self.state.mentalBuffer += 1.5; self.updateDashboardVisuals(); if (Math.floor(self.state.mentalBuffer) % 10 === 0 && navigator.vibrate) navigator.vibrate(5); }
                else { clearInterval(self.chargeInterval); if (navigator.vibrate) navigator.vibrate([30, 30, 30]); }
            }, 30);
        };
        const stopCharge = (e) => { if (e) e.preventDefault(); container.classList.remove('charging'); clearInterval(self.chargeInterval); };
        container.addEventListener('mousedown', startCharge); container.addEventListener('touchstart', startCharge);
        window.addEventListener('mouseup', stopCharge); container.addEventListener('mouseleave', stopCharge);
        window.addEventListener('touchend', stopCharge);
    },

    updateDashboardVisuals: function() {
        const res = this.state.engineResult;
        const safeEnergy = (res && Number.isFinite(res.energy)) ? res.energy : 30;
        const safeHrv = (res && Number.isFinite(res.hrv)) ? res.hrv : 60;
        const safeScore = res ? (res.scoreNumeric || (typeof res.score === 'number' ? res.score : 50)) : 50;
        const bufferPct = Math.min(100, Math.floor(this.state.mentalBuffer));
        const v50Conf = this.state.v50Confidence || this.config.confidenceByMode[this.state.scanMode] || 30;
        const displayConf = Math.floor((bufferPct / 100) * v50Conf);
        document.getElementById('resonance-fill').style.width = displayConf + "%";
        document.getElementById('confidence-val').innerText = displayConf + "%";
        const currentTargetScore = bufferPct === 100 ? safeScore : Math.floor((safeScore * (80 + bufferPct * 0.2)) / 100);
        const scoreEl = document.getElementById('dash-score');
        if (this.state.scanMode === "glimpse" && res && res.isRange) { scoreEl.innerText = res.score; scoreEl.style.fontSize = "60px"; }
        else { scoreEl.style.fontSize = "110px"; const cd = parseInt(scoreEl.innerText) || 0; if (cd < currentTargetScore) scoreEl.innerText = cd + 1; else if (cd > currentTargetScore) scoreEl.innerText = cd - 1; }
        const cScore = 753;
        document.getElementById('ring-score').style.strokeDashoffset = cScore - ((currentTargetScore / 100) * cScore);
        const label = document.getElementById('dash-label');
        const labelMap = { glimpse: "The Glimpse", lock: "The Lock", spectrum: "The Spectrum" };
        if (bufferPct < 100) { label.innerText = labelMap[this.state.scanMode] || "HOLD TO RESYNC"; label.style.color = "#9CA3AF"; }
        else { label.innerText = labelMap[this.state.scanMode] + " · LOCKED"; label.style.color = "#00F0FF"; }
        const baseBpm = 60 + Math.floor(safeEnergy * 0.4);
        const jitter = (Math.floor(Date.now() / 1000) % 2 === 0) ? 1 : -1;
        document.getElementById('bpm-val').innerText = baseBpm + jitter;
        const bars = document.querySelectorAll('.bio-bar');
        bars.forEach((b) => { const h = 20 + (safeEnergy * 0.4) + (Math.random() * 40); b.style.height = h + '%'; b.style.opacity = h > 60 ? 1 : 0.4; });
        const pnsPct = Math.min(90, Math.max(10, Math.floor((safeHrv / 120) * 100)));
        const snsPct = 100 - pnsPct;
        document.getElementById('hrv-val').innerText = safeHrv;
        document.getElementById('ans-sns-bar').style.width = snsPct + '%';
        document.getElementById('ans-pns-bar').style.width = pnsPct + '%';
        document.getElementById('sns-val').innerText = snsPct + '%';
        document.getElementById('pns-val').innerText = pnsPct + '%';
        const focus = Math.min(100, (res ? res.alertness : 50) + 10);
        const pos = Math.min(100, (res ? res.stability * 100 : 50));
        const p1y = 10 + ((100 - focus) * 0.4);
        const p2x = 90 - ((100 - pos) * 0.2); const p2y = 80 - ((100 - pos) * 0.2);
        const p3x = 10 + ((100 - pnsPct) * 0.2); const p3y = 80 - ((100 - pnsPct) * 0.2);
        document.getElementById('radar-poly').setAttribute('points', `${50},${p1y} ${p2x},${p2y} ${p3x},${p3y}`);
        if (bufferPct === 100) this.unlockAction(safeScore);
    },

    unlockAction: function(score) {
        const phraseEl = document.getElementById('dash-state');
        const btn = document.getElementById('dynamic-action-btn');
        const btnText = document.getElementById('btn-text');
        const btnIcon = document.getElementById('btn-icon');
        btn.disabled = false; btnIcon.classList.remove('animate-spin');
        if (score >= 80) { phraseEl.innerText = "Status Stable"; phraseEl.style.color = "var(--state-stable)"; btn.classList.add('bg-[#00FF94]', 'text-black'); btnText.innerText = "DECISION FLOW READY"; btnIcon.setAttribute('data-lucide', 'arrow-right-circle'); }
        else if (score >= 60) { phraseEl.innerText = "Status Controllable"; phraseEl.style.color = "var(--state-control)"; btn.classList.add('bg-[#FFD600]', 'text-black'); btnText.innerText = "TIMED MODE ACTIVE"; btnIcon.setAttribute('data-lucide', 'timer'); }
        else if (score >= 40) { phraseEl.innerText = "Status Volatile"; phraseEl.style.color = "var(--state-volatile)"; btn.classList.add('bg-[#FF8800]', 'text-black'); btnText.innerText = "QUALITY REDUCED"; btnIcon.setAttribute('data-lucide', 'alert-circle'); }
        else { phraseEl.innerText = "Risk Elevated"; phraseEl.style.color = "var(--state-risk)"; btn.classList.add('bg-[#FF0055]', 'text-white'); btnText.innerText = "FUNCTION LIMITED"; btnIcon.setAttribute('data-lucide', 'shield-ban'); }
        lucide.createIcons();
    },

    showDashboard: function() {
        document.getElementById('hud-layer').classList.add('hidden-ui');
        document.getElementById('align-hint-capsule').classList.remove('show');
        document.getElementById('universe').classList.add('dimmed');
        const dash = document.getElementById('dashboard-layer');
        this.updateDashboardVisuals();
        let rollInterval = setInterval(() => {
            this.updateDashboardVisuals();
            const scoreEl = document.getElementById('dash-score');
            if (this.state.mentalBuffer === 0 && parseInt(scoreEl.innerText) >= Math.floor(this.state.baseScore * 0.8)) clearInterval(rollInterval);
        }, 20);
        setTimeout(() => { dash.classList.add('show'); this.stopSensors(); }, 500);
    },

    reset: function() {
        document.getElementById('dashboard-layer').classList.remove('show');
        document.getElementById('hud-layer').classList.remove('hidden-ui');
        document.getElementById('universe').classList.remove('dimmed');
        document.getElementById('scan-trigger-wrapper').classList.remove('active');
        const dm = { glimpse: "2s", lock: "15s", spectrum: "60s" };
        document.getElementById('instruction').innerText = "HOLD TO SYNC · " + dm[this.state.scanMode];
        document.getElementById('instruction').style.color = "#9CA3AF";
        document.getElementById('dash-score').innerText = "00";
        document.getElementById('dash-score').style.fontSize = "110px";
        this.state.mentalBuffer = 0;
        document.getElementById('resonance-fill').style.width = "0%";
        const btn = document.getElementById('dynamic-action-btn');
        btn.disabled = true; btn.className = "dock-main-action";
        btn.classList.remove('bg-[#00FF94]', 'bg-[#FFD600]', 'bg-[#FF8800]', 'bg-[#FF0055]', 'text-black', 'text-white');
        document.getElementById('btn-text').innerText = "PROCESSING...";
        document.getElementById('btn-icon').setAttribute('data-lucide', 'rotate-ccw');
        const ringPath = document.getElementById('scan-progress-bar');
        if (ringPath) ringPath.style.strokeDashoffset = 339;
    }
};

window.onload = () => app.init();
window.onresize = () => { app.camera.aspect = window.innerWidth / window.innerHeight; app.camera.updateProjectionMatrix(); app.renderer.setSize(window.innerWidth, window.innerHeight); };
