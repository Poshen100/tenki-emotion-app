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
        // v2.0: rPPG Accumulator for effective HR/RMSSD (quality-weighted)
        rppgAcc: {
            sumW: 0,           // Sum of weights
            sumHRW: 0,         // Sum of HR × weight
            sumRMSSDW: 0,      // Sum of RMSSD × weight
            validMs: 0,        // Total ms with valid signal
            totalMs: 0,        // Total elapsed ms
            lastT: null        // Last timestamp
        },
        // v2.0: Derived SQS for TEI calculation
        sqsGrade: 'D',
        sqsTotal: 0,
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
            m.hr = Math.round(this.state.rppg.metrics.bpm);
            this.state.validHrvCount = this.state.rppg.metrics.nPeaks || 0;

            // Get real RMSSD for HRV
            if (this.state.rppg.metrics.rmssd) {
                m.rmssd = Math.round(this.state.rppg.metrics.rmssd);
                // Derive PNS/SNS from RMSSD (higher RMSSD = more PNS dominant)
                m.pns = Math.round(Math.min(80, Math.max(20, 30 + (m.rmssd * 0.5))));
                m.sns = Math.round(100 - m.pns);
            }
        } else {
            // Fallback: gentle variation based on elapsed time while waiting for signal
            m.hr = Math.round(68 + Math.sin(elapsed * 0.002) * 5 + (Math.random() - 0.5) * 2);
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
            m.rr = Math.round(Math.max(12, Math.min(20, 18 - (rmssd - 40) * 0.1)) + (Math.random() - 0.5) * 1);
        } else {
            m.rr = Math.round(14 + Math.sin(elapsed * 0.0008) * 3 + (Math.random() - 0.5) * 1);
        }

        // Stress: inverse of PNS dominance
        m.stress = Math.round(Math.max(10, Math.min(90, 50 + (m.sns - 50) * 0.8)));

        this.updateLiveScore();
        this.updateHintsFromMetrics();
    },

    // v51.1: Simulate metrics after 60s sync period
    simulateMetricsAfterSync: function () {
        const m = this.state.liveMetrics;
        const base = this.state.lastRealMetrics;

        // Gentle random walk around the last real values (rounded to prevent flickering)
        m.hr = Math.round(Math.max(55, Math.min(100, base.hr + (Math.random() - 0.5) * 1.5)));
        m.rr = Math.round(Math.max(12, Math.min(22, base.rr + (Math.random() - 0.5) * 0.8)));
        m.sns = Math.round(Math.max(20, Math.min(80, base.sns + (Math.random() - 0.5) * 2)));
        m.pns = Math.round(100 - m.sns);
        m.rmssd = Math.round(Math.max(15, Math.min(100, base.rmssd + (Math.random() - 0.5) * 3)));
        m.stress = Math.round(Math.max(10, Math.min(90, 50 + (m.sns - 50) * 0.8)));

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

        // v53.2: Smart Milestones - 15s/30s/60s with heartbeat targets
        const MILESTONES = {
            QUICK: { ms: 15000, beats: 15, confidence: 50, label: '15秒 快速檢測' },
            STANDARD: { ms: 30000, beats: 30, confidence: 75, label: '30秒 標準分析' },
            DEEP: { ms: 60000, beats: 60, confidence: 95, label: '60秒 深度分析' }
        };

        // Calculate current milestone
        let milestone = 'QUICK';
        let milestoneInfo = MILESTONES.QUICK;
        if (elapsed >= 30000 || hrvCount >= 30) {
            milestone = 'STANDARD';
            milestoneInfo = MILESTONES.STANDARD;
        }
        if (elapsed >= 60000 || hrvCount >= 60) {
            milestone = 'DEEP';
            milestoneInfo = MILESTONES.DEEP;
        }

        // Update phase based on milestone
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

        // v53.2: Auto-lock logic - freeze score when data is most reliable
        const canAutoLock = this._checkAutoLock(elapsed, hrvCount, milestone);

        this.updatePhaseUI(newPhase);
        this.updateMilestoneUI(elapsed, hrvCount, milestone, milestoneInfo, canAutoLock);

        // Max duration is 60s
        if (elapsed >= 60000 && !this.state.scanComplete) {
            this.state.scanComplete = true;
            this.state.scoreLocked = true;
            this.onScanComplete('MAX_TIME');
        }
    },

    // v53.2: Check if we should auto-lock the score
    _checkAutoLock: function (elapsed, hrvCount, milestone) {
        if (this.state.scoreLocked) return true;

        // Conditions for auto-lock (any of these)
        const conditions = {
            // 60 valid beats collected = excellent data
            excellentData: hrvCount >= 60,
            // 30 beats + 30s elapsed = good enough
            goodData: hrvCount >= 30 && elapsed >= 30000,
            // Low variance in last 5 TEI readings = stable
            stableReadings: this._isTeiStable(),
            // Max time reached
            maxTime: elapsed >= 60000
        };

        const shouldLock = conditions.excellentData ||
            conditions.goodData ||
            (conditions.stableReadings && elapsed >= 20000) ||
            conditions.maxTime;

        if (shouldLock && !this.state.scoreLocked) {
            this.state.scoreLocked = true;
            this.state.lockReason = conditions.excellentData ? 'EXCELLENT_DATA' :
                conditions.stableReadings ? 'STABLE' :
                    conditions.goodData ? 'GOOD_DATA' : 'MAX_TIME';
            this.onScanComplete(this.state.lockReason);
        }

        return this.state.scoreLocked;
    },

    // Check if TEI readings are stable
    _isTeiStable: function () {
        if (!this.state.teiReadings) this.state.teiReadings = [];
        if (this.state.teiReadings.length < 5) return false;

        const last5 = this.state.teiReadings.slice(-5);
        const mean = last5.reduce((a, b) => a + b, 0) / 5;
        const variance = last5.reduce((a, b) => a + (b - mean) ** 2, 0) / 5;

        // Variance < 4 means scores are within ±2 of mean
        return variance < 4;
    },

    // Update milestone UI
    updateMilestoneUI: function (elapsed, hrvCount, milestone, info, isLocked) {
        const timerEl = document.getElementById('live-timer');
        const seconds = Math.floor(elapsed / 1000);
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;

        if (timerEl) {
            if (isLocked) {
                timerEl.innerText = '✓ LOCKED';
                timerEl.style.color = '#00FF94';
            } else {
                timerEl.innerText = String(mins).padStart(2, '0') + ':' + String(secs).padStart(2, '0');
                timerEl.style.color = '';
            }
        }

        const hrvEl = document.getElementById('hrv-count-val');
        if (hrvEl) {
            hrvEl.innerText = hrvCount;
            // Color based on progress toward target
            if (hrvCount >= 60) hrvEl.style.color = '#00FF94';
            else if (hrvCount >= 30) hrvEl.style.color = '#00D4AA';
            else hrvEl.style.color = '';
        }

        // Update progress indicators
        const progressEl = document.getElementById('scan-progress-info');
        if (progressEl) {
            if (isLocked) {
                progressEl.innerText = `✓ ${info.label} · 數據已鎖定`;
            } else {
                const beatsRemaining = milestone === 'DEEP' ? 0 :
                    milestone === 'STANDARD' ? Math.max(0, 60 - hrvCount) :
                        Math.max(0, 30 - hrvCount);
                if (beatsRemaining > 0) {
                    progressEl.innerText = `收集中 · 還需 ${beatsRemaining} 組心率`;
                } else {
                    progressEl.innerText = info.label;
                }
            }
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
        if (labelEl && !this.state.scoreLocked) {
            labelEl.innerText = labels[phase] || 'ANALYZING';
            labelEl.style.color = phase >= 3 ? '#00FF94' : '#00F0FF';
        }
    },

    onScanComplete: function (reason) {
        const labelEl = document.getElementById('dash-label');
        if (labelEl) {
            const labels = {
                'EXCELLENT_DATA': '✓ 完美數據',
                'GOOD_DATA': '✓ 數據充足',
                'STABLE': '✓ 狀態穩定',
                'MAX_TIME': '✓ 分析完成'
            };
            labelEl.innerText = labels[reason] || '✓ COMPLETE';
            labelEl.style.color = '#00FF94';
        }

        // Celebratory vibration
        if (navigator.vibrate) {
            if (reason === 'EXCELLENT_DATA') {
                navigator.vibrate([100, 50, 100, 50, 200]); // Strong celebration
            } else {
                navigator.vibrate([50, 30, 50, 30, 100]); // Normal completion
            }
        }

        // Log to engine for learning
        if (typeof TenkiEngine !== 'undefined' && this.state.lastScanResult) {
            TenkiEngine.logSession(this.state.lastScanResult, {
                hr: this.state.liveMetrics.hr,
                lockReason: reason,
                hrvCount: this.state.validHrvCount
            });
        }
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
        const elapsed = this.state.scanStartTime ? (performance.now() - this.state.scanStartTime) : 0;

        // v54.0: Faster warm-up for quicker response (reduced from 8s to 3s)
        const WARMUP_MS = 3000; // 3 seconds warm-up
        const MIN_PHASE_FOR_TEI = 1; // Allow TEI from phase 1
        const isWarmingUp = elapsed < WARMUP_MS || phase < MIN_PHASE_FOR_TEI;

        let tei = 50;
        let zone = 'SYNCING';
        let zoneNote = '';
        let teiResult = null;

        // Initialize state
        if (this.state.smoothedTei === undefined) {
            this.state.smoothedTei = 50;
            this.state.displayedTei = 50;
            this.state.teiSampleCount = 0;
            this.state.lastMessageUpdate = 0;
            this.state.currentMessage = '';
            this.state.lastZone = '';
        }

        // v53.1: Calming messages during calibration (cycle through)
        const calmMessages = [
            '深呼吸，放鬆身心...',
            '正在同步您的生理節律...',
            '保持自然呼吸...',
            '信號同步中，請稍候...',
            '正在建立基線...'
        ];

        // v54.0: Early TEI estimation even during warm-up (if we have valid data)
        const hrvValid = m.rmssd && m.rmssd > 10 && m.rmssd < 150;
        const hrValid = m.hr && m.hr > 40 && m.hr < 120;

        if (hrvValid && hrValid && typeof TenkiEngine !== 'undefined') {
            const sqGrade = phase >= 3 ? 'A' : (phase >= 2 ? 'B' : 'C');
            const sqTotal = Math.min(95, 50 + phase * 12);

            const scanResult = TenkiEngine.ingestDailyScan({
                timeUtc: Date.now(),
                deviceType: 'face_rppg',
                sqs: { grade: sqGrade, total: sqTotal },
                metrics: { hrBpm: m.hr, hrvRmssdMs: m.rmssd, rrBrpm: m.rr },
                lotScore: this.state.expression ? this.state.expression.getConfidenceModifier() : 0.85
            });

            if (scanResult.ok && scanResult.teiAvailable) {
                const rawTei = Math.round(scanResult.tei.tei);
                this.state.teiSampleCount++;

                // v53.2: Record TEI readings for stability check
                if (!this.state.teiReadings) this.state.teiReadings = [];
                this.state.teiReadings.push(rawTei);
                if (this.state.teiReadings.length > 10) this.state.teiReadings.shift();

                // v54.0: Faster initial convergence, then smooth
                const alpha = this.state.teiSampleCount < 3 ? 0.25 : 0.08;
                this.state.smoothedTei = alpha * rawTei + (1 - alpha) * this.state.smoothedTei;

                // v54.0: Show estimated TEI earlier (reduced from 5 to 2 samples)
                if (this.state.scoreLocked) {
                    // Keep the locked score
                    tei = this.state.lockedTei || Math.round(this.state.smoothedTei);
                } else if (this.state.teiSampleCount >= 2) {
                    tei = Math.round(this.state.smoothedTei);
                    zone = scanResult.zone;
                    zoneNote = scanResult.note;
                    teiResult = scanResult;
                    this.state.teiPRs = scanResult.prs;
                    this.state.lastScanResult = scanResult;

                    // Store for potential lock
                    this.state.lockedTei = tei;
                } else {
                    // First sample: show preliminary value, not fixed 50
                    tei = Math.round(this.state.smoothedTei);
                    zone = 'CALIBRATING';
                    zoneNote = '初步分析中...';
                }
            }
        }

        // v54.0: During warm-up with no data: estimate from real metrics if available
        if ((isWarmingUp || this.state.teiSampleCount < 2) && zone === 'SYNCING') {
            if (hrValid && hrvValid) {
                // Calculate preliminary TEI from raw metrics
                // HR contribution: 70 bpm optimal, drops off toward 50 and 100
                const hrNorm = Math.max(0, 1 - Math.abs(m.hr - 70) / 35);
                // HRV contribution: higher is better, saturates around 80ms
                const hrvNorm = Math.min(1, (m.rmssd - 10) / 70);
                // Preliminary estimate: weighted combination
                const prelimTei = Math.round(40 + (hrNorm * 20) + (hrvNorm * 30));
                tei = Math.max(25, Math.min(85, prelimTei));
                zone = 'SYNCING';
            }
            const msgIndex = Math.floor(elapsed / 2500) % calmMessages.length;
            zoneNote = calmMessages[msgIndex];
        }

        // v53.1: Ultra-smooth displayed TEI (separate from internal smoothedTei)
        // Display moves max ±1 per update cycle
        const diff = tei - this.state.displayedTei;
        if (Math.abs(diff) > 0) {
            this.state.displayedTei += Math.sign(diff) * Math.min(Math.abs(diff), 1);
        }
        const displayTei = Math.round(this.state.displayedTei);

        this.state.liveScore = displayTei;

        // v53.1: Rate-limit message updates (every 3 seconds)
        const MESSAGE_UPDATE_INTERVAL = 3000;
        const shouldUpdateMessage = (elapsed - this.state.lastMessageUpdate) > MESSAGE_UPDATE_INTERVAL;

        let displayMessage = this.state.currentMessage || zoneNote;
        let messageColor = '';

        // Zone colors (calmer palette)
        const zoneColors = {
            'PEAK': '#00FF94',
            'OPTIMAL': '#00D4AA',
            'NEUTRAL': '#A0A0A0',  // Softer grey instead of yellow
            'DEGRADED': '#FF8855', // Softer orange
            'SYNCING': '#00F0FF',
            'CALIBRATING': '#00F0FF'
        };
        messageColor = zoneColors[zone] || '#9CA3AF';

        // Only update message at intervals (reduces anxiety)
        if (shouldUpdateMessage || !this.state.currentMessage) {
            this.state.lastMessageUpdate = elapsed;

            // Don't show warnings during early phase
            if (this.state.expression && !isWarmingUp && zone !== 'SYNCING') {
                const exprOut = this.state.expression.getPhaseOutput(phase);
                if (exprOut.risk > 0.5) { // Higher threshold
                    displayMessage = exprOut.message;
                    messageColor = '#FF8800';
                }
            }

            if (this.state.hints && !isWarmingUp && zone !== 'SYNCING') {
                const coachPrompt = this.state.hints.getCoachPrompt(phase);
                if (coachPrompt && coachPrompt.intensity === 'alert') {
                    displayMessage = coachPrompt.mainPrompt;
                }
            }

            // Fallback to zone note or stable message
            if (!displayMessage || displayMessage === this.state.currentMessage) {
                displayMessage = zoneNote || '狀態穩定';
            }

            this.state.currentMessage = displayMessage;
        } else {
            displayMessage = this.state.currentMessage;
        }

        // Update UI elements
        const scoreEl = document.getElementById('dash-score');
        if (scoreEl) scoreEl.innerText = String(displayTei).padStart(2, '0');

        const labelEl = document.getElementById('dash-label');
        if (labelEl && !this.state.scanComplete) {
            // Only update zone label when it actually changes
            if (zone !== this.state.lastZone) {
                labelEl.innerText = zone;
                labelEl.style.color = messageColor;
                this.state.lastZone = zone;
            }
        }

        const confEl = document.getElementById('confidence-val');
        if (confEl) {
            const displayConf = this.state.liveConfidence;
            confEl.innerText = displayConf + '%';
        }

        const quoteEl = document.getElementById('dash-quote');
        if (quoteEl) {
            // Security: Use textContent instead of innerHTML to prevent XSS
            quoteEl.textContent = `"${displayMessage}"`;
            quoteEl.style.color = messageColor;
        }

        const stateEl = document.getElementById('dash-state');
        if (stateEl) {
            const stateMap = {
                'PEAK': 'Peak Performance 巔峰狀態',
                'OPTIMAL': 'Optimal State 最佳狀態',
                'NEUTRAL': 'Neutral State 中性狀態',
                'DEGRADED': 'Recovery Needed 需要恢復',
                'SYNCING': 'Syncing 同步中',
                'CALIBRATING': 'Calibrating 校準中',
                'ANALYZING': 'Analyzing 分析中'
            };
            stateEl.innerText = stateMap[zone] || 'Status Stable';
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
            document.getElementById('connection-status').innerText = "VISION: READY";
        } catch (e) {
            console.error('Camera not available, using simulation mode:', e);
            // Still allow scanning in simulation mode
            this.audioCtx = { closed: false, simulation: true };
            this.state.isSensorActive = false;
            this.state.isFaceDetected = true; // Simulate face detected
            this.initAI(null);
            document.getElementById('instruction').innerText = "TAP TO SCAN";
            document.getElementById('connection-status').innerText = "SIMULATION MODE";
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
            // Security: Use DOM API instead of innerHTML to prevent XSS
            iconBox.textContent = '';
            const iconEl = document.createElement('i');
            iconEl.setAttribute('data-lucide', icon);
            iconEl.className = `w-4 h-4 ${iconColor}`;
            iconBox.appendChild(iconEl);
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

                // v51.1 Fix: Keep dashboard visible if scan reached a meaningful phase
                // Only hide if no meaningful data was collected (phase 0 or very early)
                if (this.state.currentPhase >= 1 || this.state.scanComplete) {
                    // Keep dashboard visible, update instruction to show results are ready
                    document.getElementById('instruction').innerText = "RESULTS READY · TAP TO RESCAN";
                    document.getElementById('instruction').style.color = "#00FF94";
                    // Don't hide dashboard - let user view results
                } else {
                    // No meaningful data, hide dashboard
                    document.getElementById('instruction').innerText = "TAP TO SCAN";
                    document.getElementById('instruction').style.color = "#9CA3AF";
                    document.getElementById('dashboard-layer').classList.remove('show');
                    document.getElementById('hud-layer').classList.remove('hidden-ui');
                }
            } else {
                // If dashboard is showing (from previous scan), hide it first
                if (document.getElementById('dashboard-layer').classList.contains('show')) {
                    document.getElementById('dashboard-layer').classList.remove('show');
                    document.getElementById('hud-layer').classList.remove('hidden-ui');
                    // Reset state for new scan
                    this.state.currentPhase = 0;
                    this.state.scanComplete = false;
                    this.state.scoreLocked = false;
                    this.stopLiveMode();
                }
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
        // Show the dock at bottom
        const dock = document.getElementById('processing-dock');
        if (dock) dock.classList.add('show');
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

        // v53.3: Smart Dock Minimize on Scroll
        const dashboard = document.getElementById('dashboard-layer');
        const dock = document.getElementById('processing-dock');
        if (dashboard && dock) {
            dashboard.addEventListener('scroll', () => {
                if (dashboard.scrollTop > 20) {
                    dock.classList.add('minimized');
                } else {
                    dock.classList.remove('minimized');
                }
            }, { passive: true });
        }
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

        // Update 6-card Bio-Decision Dashboard
        this.updateBioCards();
    },

    // Bio-Decision Dashboard - 6 Card Update Logic
    updateBioCards: function () {
        const m = this.state.liveMetrics;
        const rppgMetrics = this.state.rppg ? this.state.rppg.metrics : {};

        // ============== v2.0: EFFECTIVE HR/RMSSD ACCUMULATOR ==============
        const now = performance.now();
        const acc = this.state.rppgAcc;
        const dt = acc.lastT ? (now - acc.lastT) : 0;
        acc.lastT = now;
        acc.totalMs += dt;

        const r = rppgMetrics;
        if (r && r.bpm && r.rmssd && r.quality != null && this.state.isScanning) {
            // Only accumulate when quality gate passes
            const gate = this.state.rppg ? this.state.rppg.getQualityGate() : { pass: false };
            if (gate.pass) {
                acc.validMs += dt;
                const isSpectrum = this.state.scanMode === 'spectrum';
                const ibiRequired = isSpectrum ? 30 : 12;
                const ibiFrac = Math.min(1, (r.nIbiUsable || 0) / ibiRequired);
                const w = Math.max(0, r.quality) * ibiFrac * (dt / 1000); // weight in seconds

                acc.sumW += w;
                acc.sumHRW += r.bpm * w;
                acc.sumRMSSDW += r.rmssd * w;
            }
        }

        // Apply effective HR/RMSSD to liveMetrics (quality-weighted average)
        if (acc.sumW > 0) {
            m.hr = acc.sumHRW / acc.sumW;
            m.rmssd = acc.sumRMSSDW / acc.sumW;
        }

        // ============== v2.0: SQS GRADE CALCULATION ==============
        const validRatio = acc.totalMs > 0 ? (acc.validMs / acc.totalMs) : 0;
        let sqTotal = 0;
        let sqGrade = 'D';

        if (r && r.quality != null) {
            const q = Math.max(0, Math.min(1, r.quality));
            // SQ total = quality × validRatio (both matter)
            sqTotal = Math.round(100 * q * Math.max(0, Math.min(1, validRatio)));

            const nIbi = r.nIbiUsable || 0;
            const isSpectrum = this.state.scanMode === 'spectrum';

            // Grade assignment based on real rPPG quality (not phase)
            if (q >= 0.75 && nIbi >= 30 && validRatio >= 0.7 && isSpectrum) {
                sqGrade = 'A';  // Spectrum quality
            } else if (q >= 0.60 && nIbi >= 15 && validRatio >= 0.5) {
                sqGrade = 'B';  // Good quality
            } else if (q >= 0.45 && nIbi >= 5) {
                sqGrade = 'C';  // Acceptable quality
            } else {
                sqGrade = 'D';  // Poor quality
            }
        }

        // Store SQS in state for TEI engine
        this.state.sqsGrade = sqGrade;
        this.state.sqsTotal = sqTotal;
        this.state.validHrvCount = r ? (r.nIbiUsable || 0) : 0;

        // Card A: Live HR
        const bioHrVal = document.getElementById('bio-hr-val');
        if (bioHrVal) bioHrVal.innerText = Math.round(m.hr);

        // Animate PPG wave in card
        const ppgWave = document.getElementById('bio-ppg-wave');
        if (ppgWave) {
            const bars = Array.from(ppgWave.children);
            const time = performance.now() / 150;
            bars.forEach((bar, i) => {
                const h = 30 + Math.sin(time + (i * 0.6)) * 35 + Math.random() * 10;
                bar.style.height = Math.max(15, h) + '%';
            });
        }

        // Card B: HRV Status (Garmin Style)
        const bioHrvVal = document.getElementById('bio-hrv-val');
        const rmssd = m.rmssd || 45;
        if (bioHrvVal) bioHrvVal.innerText = Math.round(rmssd);

        // Calculate HRV status based on baseline
        const hrvStatus = this.getHrvStatus(rmssd, this.state.hrvBaseline || 50);
        const hrvBadge = document.getElementById('hrv-status-badge');
        const hrvIcon = document.getElementById('hrv-status-icon');
        const hrvText = document.getElementById('hrv-status-text');
        if (hrvBadge && hrvIcon && hrvText) {
            hrvBadge.className = 'hrv-status-badge ' + hrvStatus.cssClass;
            hrvIcon.innerText = hrvStatus.icon;
            hrvText.innerText = hrvStatus.label;
        }

        // Update HRV range visualization
        this.updateHrvRangeBar(rmssd);

        // Card C: Respiratory Rate + RSA Coherence
        const bioRrVal = document.getElementById('bio-rr-val');
        if (bioRrVal) bioRrVal.innerText = Math.round(m.rr);

        // Calculate RSA coherence (heart-breathing synchrony)
        const rsaCoherence = this.calculateRSACoherence(m.hr, m.rr, rmssd);
        const rsaFill = document.getElementById('rsa-fill');
        const rsaValue = document.getElementById('rsa-value');
        if (rsaFill) rsaFill.style.width = (rsaCoherence * 100) + '%';
        if (rsaValue) rsaValue.innerText = rsaCoherence.toFixed(2);

        // Card E: Stress Load (TEI PR)
        const bioStressPr = document.getElementById('bio-stress-pr');
        const stressZoneBadge = document.getElementById('stress-zone-badge');
        const teiPr = this.state.teiPRs ? Math.round(this.state.teiPRs.tei_pr * 100) : 50;
        if (bioStressPr) bioStressPr.innerText = teiPr;
        if (stressZoneBadge) {
            const stressZone = this.getStressZone(teiPr);
            stressZoneBadge.className = 'stress-zone ' + stressZone.cssClass;
            stressZoneBadge.innerText = stressZone.label;
        }

        // Card F: Signal Quality
        const bioQualityVal = document.getElementById('bio-quality-val');
        const quality = rppgMetrics.quality || 0;
        if (bioQualityVal) bioQualityVal.innerText = Math.round(quality * 100);

        // Update signal indicators
        this.updateSignalIndicators(quality);

        // Update Tier/Source indicator
        this.updateTierIndicator();

        // Check for quality degradation
        this.updateQualityWarning();

        // Check for bio-pattern alerts
        this.checkBioPatternAlert(m, rmssd, rsaCoherence);
    },

    // Update floating Tier/Source indicator
    updateTierIndicator: function () {
        if (!this.state.rppg) return;

        const fusionStatus = this.state.rppg.getFusionStatus();
        const source = fusionStatus.source;

        const tierEl = document.getElementById('tier-indicator-float');
        const iconEl = document.getElementById('tier-icon');
        const labelEl = document.getElementById('tier-label');

        if (!tierEl || !iconEl || !labelEl) return;

        // Update tier class
        tierEl.className = 'tier-indicator tier-' + source.tier;
        iconEl.innerText = source.icon;
        labelEl.innerText = `T${source.tier}: ${source.label}`;

        // Also update the signal quality card source display
        const sigBle = document.getElementById('sig-ble');
        if (sigBle) {
            if (this.state.rppg.bleConnected) {
                sigBle.className = 'signal-indicator good';
                sigBle.style.opacity = '1';
            } else {
                sigBle.className = 'signal-indicator';
                sigBle.style.opacity = '0.4';
            }
        }
    },

    // Update quality degradation warning
    updateQualityWarning: function () {
        if (!this.state.rppg || !this.state.isScanning) return;

        const fusionStatus = this.state.rppg.getFusionStatus();
        const source = fusionStatus.source;
        const warningEl = document.getElementById('quality-warning');
        const warningText = document.getElementById('quality-warning-text');

        if (!warningEl) return;

        // Show warning for tier 4-5 (degraded signals)
        if (source.tier >= 4) {
            warningEl.classList.add('show');
            if (warningText) {
                const messages = {
                    4: '訊號品質較低 · 建議調整光線或姿勢',
                    5: '訊號已降級 · 數據可能不準確'
                };
                warningText.innerText = messages[source.tier] || '訊號問題';
            }
        } else {
            warningEl.classList.remove('show');
        }
    },

    // Connect to BLE heart rate monitor
    connectBLEHeartRate: async function () {
        if (!this.state.rppg) return { success: false, error: 'rPPG not initialized' };

        const result = await this.state.rppg.connectBLE();
        if (result.success) {
            // Update UI to show BLE connected
            const connStatus = document.getElementById('connection-status');
            if (connStatus) {
                connStatus.innerText = `BLE: ${result.device}`;
                connStatus.style.color = '#00FF94';
            }
        }
        return result;
    },

    // Disconnect BLE
    disconnectBLEHeartRate: function () {
        if (this.state.rppg) {
            this.state.rppg.disconnectBLE();
            const connStatus = document.getElementById('connection-status');
            if (connStatus) {
                connStatus.innerText = 'VISION ONLY';
                connStatus.style.color = '';
            }
        }
    },

    // Garmin-style HRV Status
    getHrvStatus: function (currentRmssd, baseline) {
        const deviation = (currentRmssd - baseline) / baseline;
        if (deviation >= -0.10 && deviation <= 0.15) {
            return { label: 'Balanced', icon: '✅', cssClass: 'balanced', color: '#00FF94' };
        }
        if (deviation > 0.15 || (deviation < -0.10 && deviation >= -0.25)) {
            return { label: 'Unbalanced', icon: '⚠️', cssClass: 'unbalanced', color: '#FF8855' };
        }
        if (deviation < -0.25) {
            return { label: 'Poor', icon: '🔴', cssClass: 'poor', color: '#FF4444' };
        }
        return { label: 'Low', icon: '🟣', cssClass: 'low', color: '#9966FF' };
    },

    // Update HRV range bar (21-day visualization)
    updateHrvRangeBar: function (currentRmssd) {
        const rangeBar = document.getElementById('hrv-range-bar');
        if (!rangeBar) return;

        // Initialize HRV history if not exists
        if (!this.state.hrvHistory) this.state.hrvHistory = [];
        this.state.hrvHistory.push(currentRmssd);
        if (this.state.hrvHistory.length > 5) this.state.hrvHistory.shift();

        const segments = rangeBar.querySelectorAll('.hrv-range-segment');
        const history = this.state.hrvHistory;
        const max = Math.max(...history, 60);
        const min = Math.min(...history, 30);
        const range = max - min || 1;

        segments.forEach((seg, i) => {
            const val = history[i] || (min + range / 2);
            const normalized = (val - min) / range;
            seg.style.height = (20 + normalized * 80) + '%';
        });
    },

    // Calculate RSA Coherence (Respiratory Sinus Arrhythmia)
    calculateRSACoherence: function (hr, rr, rmssd) {
        // RSA coherence: how well heart rate syncs with breathing
        // Higher RMSSD with optimal RR (12-16) = higher coherence
        const optimalRr = 14;
        const rrDeviation = Math.abs(rr - optimalRr) / optimalRr;
        const rmssdNormalized = Math.min(1, rmssd / 80);

        // Coherence formula: high RMSSD + optimal breathing = high coherence
        let coherence = rmssdNormalized * (1 - rrDeviation * 0.5);
        coherence = Math.max(0, Math.min(1, coherence));

        return coherence;
    },

    // Get stress zone based on TEI PR
    getStressZone: function (teiPr) {
        if (teiPr >= 80) return { label: 'Peak', cssClass: 'peak' };
        if (teiPr >= 60) return { label: 'Optimal', cssClass: 'optimal' };
        if (teiPr >= 40) return { label: 'Neutral', cssClass: 'neutral' };
        return { label: 'Degraded', cssClass: 'degraded' };
    },

    // Update signal quality indicators
    updateSignalIndicators: function (quality) {
        const sigIso = document.getElementById('sig-iso');
        const sigGyro = document.getElementById('sig-gyro');

        if (sigIso) {
            const isoGood = this.state.envLux >= 30;
            sigIso.className = 'signal-indicator ' + (isoGood ? 'good' : 'warn');
        }

        if (sigGyro) {
            const gyroGood = (this.state.deviceMotion || 0) < 0.3;
            sigGyro.className = 'signal-indicator ' + (gyroGood ? 'good' : 'warn');
        }
    },

    // Check and show bio-pattern alerts
    checkBioPatternAlert: function (metrics, rmssd, rsaCoherence) {
        // Initialize tracking
        if (!this.state.bioPatternState) {
            this.state.bioPatternState = {
                lastHr: metrics.hr,
                lastRmssd: rmssd,
                lastRr: metrics.rr,
                lastAlertTime: 0
            };
            return;
        }

        const state = this.state.bioPatternState;
        const now = performance.now();

        // Only check every 10 seconds and not too frequently
        if (now - state.lastAlertTime < 30000) return;

        const hrChange = metrics.hr - state.lastHr;
        const rmssdChange = rmssd - state.lastRmssd;
        const rrChange = metrics.rr - state.lastRr;

        // Detect anxiety arousal pattern: HR↑ + HRV↓ + RR↑
        if (hrChange > 8 && rmssdChange < -5 && rrChange > 2) {
            this.showBioPatternAlert('anxiety', {
                hrChange: Math.round(hrChange),
                rmssdChange: Math.round(rmssdChange),
                rrChange: Math.round(rrChange)
            });
            state.lastAlertTime = now;
        }

        // Detect overconfidence pattern: HR↑ + TEI high + RSA low
        const teiPr = this.state.teiPRs ? this.state.teiPRs.tei_pr * 100 : 50;
        if (hrChange > 5 && teiPr > 80 && rsaCoherence < 0.5) {
            this.showBioPatternAlert('overconfidence', {
                hrChange: Math.round(hrChange),
                teiPr: Math.round(teiPr)
            });
            state.lastAlertTime = now;
        }

        // Update tracking state
        state.lastHr = metrics.hr;
        state.lastRmssd = rmssd;
        state.lastRr = metrics.rr;
    },

    // Show bio-pattern alert modal
    showBioPatternAlert: function (type, data) {
        const alertEl = document.getElementById('bio-pattern-alert');
        const contentEl = document.getElementById('bio-pattern-content');
        if (!alertEl || !contentEl) return;

        let content = '';
        if (type === 'anxiety') {
            content = `你的心率上升 (+${data.hrChange} bpm)<br>`;
            content += `但 HRV 下降 (${data.rmssdChange}ms)<br>`;
            content += `且呼吸加速 (+${data.rrChange} BrPM)<br><br>`;
            content += `這是典型的「焦慮性喚醒」模式。`;
        } else if (type === 'overconfidence') {
            content = `你的心率上升 (+${data.hrChange} bpm)<br>`;
            content += `但 TEI 處於高峰 (PR ${data.teiPr})<br>`;
            content += `心肺協調性較低<br><br>`;
            content += `這可能是「過度自信」狀態。`;
        }

        contentEl.innerHTML = content;
        alertEl.classList.add('show');

        // Vibrate to get attention
        if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
    },

    // Dismiss bio-pattern alert
    dismissBioAlert: function () {
        const alertEl = document.getElementById('bio-pattern-alert');
        if (alertEl) alertEl.classList.remove('show');
    },

    // Start breathing exercise (placeholder for Phase 2)
    startBreathingExercise: function () {
        this.dismissBioAlert();
        // TODO: Implement breathing exercise UI in Phase 2
        alert('呼吸校準功能將在 Phase 2 實現');
    },

    reset: function () {
        this.stopLiveMode();
        this.stopSensors();
        if (this.state.expression) this.state.expression.reset();
        if (this.state.hints) this.state.hints.reset();

        // v53.1: Reset all TEI and UX state
        this.state.smoothedTei = 50;
        this.state.displayedTei = 50;
        this.state.teiSampleCount = 0;
        this.state.lastMessageUpdate = 0;
        this.state.currentMessage = '';
        this.state.lastZone = '';

        // v53.2: Reset smart scan state
        this.state.scoreLocked = false;
        this.state.lockReason = null;
        this.state.teiReadings = [];
        this.state.lockedTei = null;
        this.state.lastScanResult = null;

        // v2.0: Reset rPPG accumulator (prevents cross-scan pollution)
        this.state.rppgAcc = {
            sumW: 0,
            sumHRW: 0,
            sumRMSSDW: 0,
            validMs: 0,
            totalMs: 0,
            lastT: null
        };
        this.state.sqsGrade = 'D';
        this.state.sqsTotal = 0;
        this.state.validHrvCount = 0;

        if (typeof TenkiEngine !== 'undefined') TenkiEngine.reset();

        document.getElementById('dashboard-layer').classList.remove('show');
        document.getElementById('hud-layer').classList.remove('hidden-ui');
        document.getElementById('universe').classList.remove('dimmed');
        document.getElementById('scan-trigger-wrapper').classList.remove('active');
        document.getElementById('instruction').innerText = "TAP TO SCAN";
        document.getElementById('instruction').style.color = "#9CA3AF";
        document.getElementById('dash-score').innerText = "00";
        this.state.mentalBuffer = 0;
        this.state.isLiveSyncActive = true;

        // Hide the dock
        const dock = document.getElementById('processing-dock');
        if (dock) dock.classList.remove('show');

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
