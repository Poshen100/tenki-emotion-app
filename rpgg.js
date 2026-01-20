// rpgg.js - rPPG Controller (Main Thread)
// ROI extraction + Worker communication

(function () {
    function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

    class RPPGController {
        constructor(workerUrl) {
            this.worker = new Worker(workerUrl);
            this.metrics = { bpm: null, rmssd: null, quality: 0, nPeaks: 0 };
            this.mode = "glimpse";
            this.windowMs = 2000;

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
        }

        // v51 Blueprint: Multi-ROI definitions (forehead + cheeks)
        static ROI_DEFINITIONS = {
            forehead: { xStart: 0.30, xEnd: 0.70, yStart: 0.10, yEnd: 0.28 },
            leftCheek: { xStart: 0.10, xEnd: 0.35, yStart: 0.45, yEnd: 0.65 },
            rightCheek: { xStart: 0.65, xEnd: 0.90, yStart: 0.45, yEnd: 0.65 }
        };

        // v51 Blueprint: Multi-ROI extraction with SQI-based selection
        // Extracts from 3 ROIs, calculates SQI for each, returns best quality signal
        extractRoiMeanG(videoEl, landmarks) {
            if (!videoEl || !landmarks || !landmarks.length) return null;

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

            // Extract all ROIs and calculate SQI for each
            const roiResults = [];
            for (const [name, roi] of Object.entries(RPPGController.ROI_DEFINITIONS)) {
                const result = this.extractSingleRoi(videoEl, fx, fy, fw, fh, roi, vw, vh);
                if (result) {
                    roiResults.push({ name, ...result });
                }
            }

            if (roiResults.length === 0) return null;

            // Select ROI with highest SQI (Signal Quality Index)
            // SQI is inverse of coefficient of variation - lower CV = higher quality
            roiResults.sort((a, b) => b.sqi - a.sqi);
            const bestRoi = roiResults[0];

            // Store which ROI was selected for debugging
            this.lastSelectedRoi = bestRoi.name;
            this.lastRoiSqis = roiResults.reduce((acc, r) => { acc[r.name] = r.sqi; return acc; }, {});

            return bestRoi.meanG;
        }

        // Extract a single ROI and calculate its SQI
        extractSingleRoi(videoEl, fx, fy, fw, fh, roi, vw, vh) {
            const sx = clamp(fx + fw * roi.xStart, 0, vw - 2);
            const sy = clamp(fy + fh * roi.yStart, 0, vh - 2);
            const sw = clamp(fw * (roi.xEnd - roi.xStart), 2, vw - sx);
            const sh = clamp(fh * (roi.yEnd - roi.yStart), 2, vh - sy);

            this.roiCtx.drawImage(videoEl, sx, sy, sw, sh, 0, 0, 32, 32);
            const img = this.roiCtx.getImageData(0, 0, 32, 32).data;

            let sumG = 0;
            let sumG2 = 0;
            let count = 0;

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
            // Higher SQI = more stable signal (lower relative variation)
            // Add small epsilon to avoid division by zero
            const cv = stdDev / (meanG + 0.001);
            const sqi = 1 / (cv + 0.1);  // Transform to SQI scale

            return { meanG, sqi };
        }

        pushFrame({ t, meanG }) {
            if (meanG == null) return;
            this.worker.postMessage({ type: "sample", t, x: meanG });
        }

        requestCompute() {
            this.worker.postMessage({ type: "compute", windowMs: this.windowMs });
        }

        // Get quality gate status for Lock/Spectrum modes
        // Lock: quality >= 0.6 AND nIbiUsable >= 12
        // Spectrum: quality >= 0.75 AND nIbiUsable >= 30
        getQualityGate() {
            const m = this.metrics;
            if (this.mode === "glimpse") return { pass: true, reason: "GLIMPSE" };

            // Mode-specific thresholds
            const qualityThreshold = this.mode === "spectrum" ? 0.75 : 0.6;
            const ibiRequired = this.mode === "spectrum" ? 30 : 12;

            if (m.bpm === null) return { pass: false, reason: "DETECTING PULSE" };
            if (m.nIbiUsable < ibiRequired) return { pass: false, reason: `IBI ${m.nIbiUsable}/${ibiRequired}` };
            if (m.quality < qualityThreshold) return { pass: false, reason: "WEAK SIGNAL" };
            if (m.bpm < 45 || m.bpm > 160) return { pass: false, reason: "BPM OUT OF RANGE" };

            return { pass: true, reason: "SIGNAL OK" };
        }

        // Get formatted status string for dash-quote
        getStatusString() {
            const m = this.metrics;
            const modeLabel = this.mode.charAt(0).toUpperCase() + this.mode.slice(1);
            const qualityThreshold = this.mode === "spectrum" ? 0.75 : 0.6;
            const ibiRequired = this.mode === "spectrum" ? 30 : 12;
            const qPct = Math.round(m.quality * 100);
            const passLabel = (m.quality >= qualityThreshold && m.nIbiUsable >= ibiRequired) ? "PASS" : "HOLD";

            if (m.bpm === null || m.rmssd === null) {
                return `${modeLabel}: Detecting... IBI ${m.nIbiUsable}/${ibiRequired} · Q ${qPct}%`;
            }

            return `${modeLabel}: RMSSD ${Math.round(m.rmssd)}ms | BPM ${Math.round(m.bpm)} | IBI ${m.nIbiUsable}/${ibiRequired} · Q ${qPct}% (${passLabel})`;
        }
    }

    window.TENKI_RPPG = {
        create(workerUrl) { return new RPPGController(workerUrl); }
    };
})();
