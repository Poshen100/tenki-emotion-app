// rpgg.js - rPPG Controller (Main Thread)
// Enhanced ROI extraction with eyebrow priority + BLE fusion + Quality logging

(function () {
    function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

    // Signal Quality Thresholds (single SQI approach)
    const SQI_THRESHOLDS = {
        EXCELLENT: 8.0,   // Medical-grade quality
        GOOD: 5.0,        // Reliable for TEI
        ACCEPTABLE: 3.0,  // Use with caution
        POOR: 0           // Fallback to next ROI
    };

    // Signal Source Tiers
    const SIGNAL_TIERS = {
        BLE_RR: { tier: 1, label: 'BLE Heart Rate', icon: '🛡️', confidence: 1.0 },
        EYEBROW: { tier: 2, label: 'Eyebrow Optical', icon: '👁️', confidence: 0.92 },
        FOREHEAD: { tier: 3, label: 'Forehead Optical', icon: '📷', confidence: 0.85 },
        CHEEK: { tier: 4, label: 'Cheek Optical', icon: '📷', confidence: 0.75 },
        DEGRADED: { tier: 5, label: 'Degraded Signal', icon: '⚠️', confidence: 0.5 }
    };

    class RPPGController {
        constructor(workerUrl) {
            this.worker = new Worker(workerUrl);
            this.metrics = { bpm: null, rmssd: null, quality: 0, nPeaks: 0, nIbiUsable: 0 };
            this.mode = "glimpse";
            this.windowMs = 2000;

            // BLE Heart Rate state
            this.bleConnected = false;
            this.bleDevice = null;
            this.bleRrIntervals = [];
            this.bleHeartRate = null;

            // Fusion state
            this.currentSource = SIGNAL_TIERS.DEGRADED;
            this.fusionLog = [];
            this.lastFusionDecision = null;

            this.roiCanvas = document.createElement("canvas");
            this.roiCanvas.width = 32;
            this.roiCanvas.height = 32;
            this.roiCtx = this.roiCanvas.getContext("2d", { willReadFrequently: true });

            this.worker.onmessage = (e) => {
                const msg = e.data || {};
                if (msg.type === "metrics") {
                    this.metrics = {
                        bpm: msg.bpm ?? null,
                        rmssd: msg.rmssd ?? null,
                        quality: msg.quality ?? 0,
                        nPeaks: msg.nPeaks ?? 0,
                        nIbiUsable: msg.nIbiUsable ?? 0
                    };
                }
            };
        }

        setMode(mode) {
            this.mode = mode;
            this.windowMs = mode === "spectrum" ? 60000 : (mode === "default" ? 30000 : 2000);
        }

        reset() {
            this.worker.postMessage({ type: "reset" });
            this.metrics = { bpm: null, rmssd: null, quality: 0, nPeaks: 0, nIbiUsable: 0 };
            this.fusionLog = [];
            this.lastFusionDecision = null;
        }

        // ============== BLE HEART RATE INTEGRATION ==============

        async connectBLE() {
            try {
                this.bleDevice = await navigator.bluetooth.requestDevice({
                    filters: [{ services: ['heart_rate'] }],
                    optionalServices: ['heart_rate']
                });

                const server = await this.bleDevice.gatt.connect();
                const service = await server.getPrimaryService('heart_rate');
                const characteristic = await service.getCharacteristic('heart_rate_measurement');

                await characteristic.startNotifications();
                characteristic.addEventListener('characteristicvaluechanged', (e) => {
                    this.handleBLEHeartRate(e.target.value);
                });

                this.bleConnected = true;
                this.logFusion('BLE_CONNECT', { device: this.bleDevice.name });
                return { success: true, device: this.bleDevice.name };
            } catch (err) {
                this.logFusion('BLE_ERROR', { error: err.message });
                return { success: false, error: err.message };
            }
        }

        handleBLEHeartRate(dataView) {
            const flags = dataView.getUint8(0);
            const is16Bit = (flags & 0x01) !== 0;
            const hasRRInterval = (flags & 0x10) !== 0;  // Bit 4: RR-Interval presence

            // Parse heart rate
            let hr = is16Bit ? dataView.getUint16(1, true) : dataView.getUint8(1);
            this.bleHeartRate = hr;

            // Parse RR intervals if present (highest trust source!)
            if (hasRRInterval) {
                const rrOffset = is16Bit ? 3 : 2;
                const rrCount = Math.floor((dataView.byteLength - rrOffset) / 2);

                for (let i = 0; i < rrCount; i++) {
                    const rrRaw = dataView.getUint16(rrOffset + (i * 2), true);
                    const rrMs = rrRaw * (1000 / 1024);  // Convert to milliseconds
                    this.bleRrIntervals.push({ t: performance.now(), rr: rrMs });

                    // Keep last 60 intervals
                    if (this.bleRrIntervals.length > 60) this.bleRrIntervals.shift();
                }

                // Calculate RMSSD from BLE RR intervals
                if (this.bleRrIntervals.length >= 5) {
                    this.metrics.rmssd = this.calculateRMSSD(this.bleRrIntervals.map(r => r.rr));
                    this.metrics.bpm = hr;
                    this.metrics.quality = 1.0;  // BLE = perfect quality
                    this.currentSource = SIGNAL_TIERS.BLE_RR;
                }
            }
        }

        calculateRMSSD(rrIntervals) {
            if (rrIntervals.length < 2) return null;
            let sumSquaredDiff = 0;
            for (let i = 1; i < rrIntervals.length; i++) {
                const diff = rrIntervals[i] - rrIntervals[i - 1];
                sumSquaredDiff += diff * diff;
            }
            return Math.sqrt(sumSquaredDiff / (rrIntervals.length - 1));
        }

        disconnectBLE() {
            if (this.bleDevice && this.bleDevice.gatt.connected) {
                this.bleDevice.gatt.disconnect();
            }
            this.bleConnected = false;
            this.bleRrIntervals = [];
            this.logFusion('BLE_DISCONNECT', {});
        }

        // ============== ENHANCED ROI DEFINITIONS ==============

        // Priority order: eyebrow (glabella) → forehead → cheeks
        // Nature 2024: Glabella is most stable ROI with best motion artifact resistance
        static ROI_DEFINITIONS = {
            // Highest priority: Eyebrow/Glabella region (Nature 2024)
            eyebrow: { xStart: 0.35, xEnd: 0.65, yStart: 0.15, yEnd: 0.25, priority: 1 },
            // Second priority: Forehead (larger area, good efficiency)
            forehead: { xStart: 0.25, xEnd: 0.75, yStart: 0.08, yEnd: 0.22, priority: 2 },
            // Third priority: Left cheek
            leftCheek: { xStart: 0.10, xEnd: 0.35, yStart: 0.45, yEnd: 0.65, priority: 3 },
            // Fourth priority: Right cheek  
            rightCheek: { xStart: 0.65, xEnd: 0.90, yStart: 0.45, yEnd: 0.65, priority: 4 }
        };

        // ============== FUSION DECISION LOGIC ==============

        extractRoiMeanG(videoEl, landmarks) {
            // If BLE RR is available, it's always highest priority
            if (this.bleConnected && this.bleRrIntervals.length >= 5) {
                this.logFusion('USE_BLE', {
                    reason: 'BLE RR-interval available (highest trust)',
                    rrCount: this.bleRrIntervals.length
                });
                this.currentSource = SIGNAL_TIERS.BLE_RR;
                return null;  // Skip camera - using BLE
            }

            if (!videoEl || !landmarks || !landmarks.length) {
                this.logFusion('NO_FACE', { reason: 'No landmarks detected' });
                this.currentSource = SIGNAL_TIERS.DEGRADED;
                return null;
            }

            // Get face bounding box
            let minX = 1, minY = 1, maxX = 0, maxY = 0;
            for (const p of landmarks) {
                if (p.x < minX) minX = p.x;
                if (p.y < minY) minY = p.y;
                if (p.x > maxX) maxX = p.x;
                if (p.y > maxY) maxY = p.y;
            }

            const vw = videoEl.videoWidth || 640;
            const vh = videoEl.videoHeight || 480;
            const fx = minX * vw;
            const fy = minY * vh;
            const fw = (maxX - minX) * vw;
            const fh = (maxY - minY) * vh;

            // Extract all ROIs with SQI
            const roiResults = [];
            for (const [name, roi] of Object.entries(RPPGController.ROI_DEFINITIONS)) {
                const result = this.extractSingleRoi(videoEl, fx, fy, fw, fh, roi, vw, vh);
                if (result) {
                    roiResults.push({ name, priority: roi.priority, ...result });
                }
            }

            if (roiResults.length === 0) {
                this.logFusion('NO_ROI', { reason: 'All ROI extractions failed' });
                this.currentSource = SIGNAL_TIERS.DEGRADED;
                return null;
            }

            // Sort by priority first, then by SQI within same tier
            roiResults.sort((a, b) => {
                // First check if SQI meets threshold
                const aGood = a.sqi >= SQI_THRESHOLDS.ACCEPTABLE;
                const bGood = b.sqi >= SQI_THRESHOLDS.ACCEPTABLE;

                if (aGood && !bGood) return -1;
                if (!aGood && bGood) return 1;

                // Both good or both bad - use priority
                if (a.priority !== b.priority) return a.priority - b.priority;

                // Same priority - use SQI
                return b.sqi - a.sqi;
            });

            const bestRoi = roiResults[0];

            // Determine signal tier and log decision
            let selectedTier = SIGNAL_TIERS.DEGRADED;
            if (bestRoi.sqi >= SQI_THRESHOLDS.ACCEPTABLE) {
                if (bestRoi.name === 'eyebrow') selectedTier = SIGNAL_TIERS.EYEBROW;
                else if (bestRoi.name === 'forehead') selectedTier = SIGNAL_TIERS.FOREHEAD;
                else selectedTier = SIGNAL_TIERS.CHEEK;
            }

            this.currentSource = selectedTier;
            this.lastSelectedRoi = bestRoi.name;
            this.lastRoiSqis = roiResults.reduce((acc, r) => {
                acc[r.name] = { sqi: r.sqi.toFixed(2), quality: this.getSqiLabel(r.sqi) };
                return acc;
            }, {});

            // Log fusion decision
            this.logFusion('ROI_SELECT', {
                selected: bestRoi.name,
                sqi: bestRoi.sqi.toFixed(2),
                quality: this.getSqiLabel(bestRoi.sqi),
                tier: selectedTier.tier,
                alternatives: roiResults.slice(1).map(r => `${r.name}:${r.sqi.toFixed(1)}`).join(', '),
                reason: bestRoi.sqi >= SQI_THRESHOLDS.GOOD ? 'SQI above threshold' :
                    bestRoi.sqi >= SQI_THRESHOLDS.ACCEPTABLE ? 'Acceptable SQI' : 'Best available'
            });

            return bestRoi.meanG;
        }

        getSqiLabel(sqi) {
            if (sqi >= SQI_THRESHOLDS.EXCELLENT) return 'EXCELLENT';
            if (sqi >= SQI_THRESHOLDS.GOOD) return 'GOOD';
            if (sqi >= SQI_THRESHOLDS.ACCEPTABLE) return 'ACCEPTABLE';
            return 'POOR';
        }

        extractSingleRoi(videoEl, fx, fy, fw, fh, roi, vw, vh) {
            const sx = clamp(fx + fw * roi.xStart, 0, vw - 2);
            const sy = clamp(fy + fh * roi.yStart, 0, vh - 2);
            const sw = clamp(fw * (roi.xEnd - roi.xStart), 2, vw - sx);
            const sh = clamp(fh * (roi.yEnd - roi.yStart), 2, vh - sy);

            this.roiCtx.drawImage(videoEl, sx, sy, sw, sh, 0, 0, 32, 32);
            const img = this.roiCtx.getImageData(0, 0, 32, 32).data;

            let sumG = 0, sumG2 = 0, count = 0;
            for (let i = 0; i < img.length; i += 4) {
                const g = img[i + 1] / 255;
                sumG += g;
                sumG2 += g * g;
                count++;
            }

            if (count === 0) return null;

            const meanG = sumG / count;
            const variance = (sumG2 / count) - (meanG * meanG);
            const stdDev = Math.sqrt(Math.max(0, variance));

            // SQI: inverse of coefficient of variation (CV)
            const cv = stdDev / (meanG + 0.001);
            const sqi = 1 / (cv + 0.1);

            return { meanG, sqi };
        }

        // ============== FUSION LOGGING ==============

        logFusion(event, data) {
            const entry = {
                t: performance.now(),
                event,
                ...data
            };
            this.fusionLog.push(entry);
            this.lastFusionDecision = entry;

            // Keep last 100 entries
            if (this.fusionLog.length > 100) this.fusionLog.shift();

            // Console log for debugging
            console.log(`[FUSION] ${event}:`, data);
        }

        getFusionStatus() {
            return {
                source: this.currentSource,
                bleConnected: this.bleConnected,
                bleDevice: this.bleDevice?.name || null,
                lastDecision: this.lastFusionDecision,
                selectedRoi: this.lastSelectedRoi,
                roiSqis: this.lastRoiSqis
            };
        }

        // ============== QUALITY GATE ==============

        pushFrame({ t, meanG }) {
            if (meanG == null) return;
            this.worker.postMessage({ type: "sample", t, x: meanG });
        }

        requestCompute() {
            this.worker.postMessage({ type: "compute", windowMs: this.windowMs });
        }

        getQualityGate() {
            const m = this.metrics;

            // BLE always passes if connected with data
            if (this.bleConnected && this.bleRrIntervals.length >= 5) {
                return { pass: true, reason: "BLE OK", tier: 1 };
            }

            if (this.mode === "glimpse") return { pass: true, reason: "GLIMPSE", tier: this.currentSource.tier };

            const qualityThreshold = this.mode === "spectrum" ? 0.75 : 0.6;
            const ibiRequired = this.mode === "spectrum" ? 30 : 12;

            if (m.bpm === null) return { pass: false, reason: "DETECTING PULSE", tier: 5 };
            if (m.nIbiUsable < ibiRequired) return { pass: false, reason: `IBI ${m.nIbiUsable}/${ibiRequired}`, tier: 4 };
            if (m.quality < qualityThreshold) return { pass: false, reason: "WEAK SIGNAL", tier: 4 };
            if (m.bpm < 45 || m.bpm > 160) return { pass: false, reason: "BPM OUT OF RANGE", tier: 5 };

            return { pass: true, reason: "SIGNAL OK", tier: this.currentSource.tier };
        }

        getStatusString() {
            const m = this.metrics;
            const source = this.currentSource;
            const modeLabel = this.mode.charAt(0).toUpperCase() + this.mode.slice(1);
            const qualityThreshold = this.mode === "spectrum" ? 0.75 : 0.6;
            const ibiRequired = this.mode === "spectrum" ? 30 : 12;
            const qPct = Math.round(m.quality * 100);
            const passLabel = (m.quality >= qualityThreshold && m.nIbiUsable >= ibiRequired) ? "PASS" : "HOLD";

            const tierLabel = `[T${source.tier}:${source.icon}]`;

            if (m.bpm === null || m.rmssd === null) {
                return `${tierLabel} ${modeLabel}: Detecting... IBI ${m.nIbiUsable}/${ibiRequired} · Q ${qPct}%`;
            }

            return `${tierLabel} ${modeLabel}: RMSSD ${Math.round(m.rmssd)}ms | BPM ${Math.round(m.bpm)} | Q ${qPct}% (${passLabel})`;
        }
    }

    window.TENKI_RPPG = {
        create(workerUrl) { return new RPPGController(workerUrl); },
        SIGNAL_TIERS,
        SQI_THRESHOLDS
    };
})();

