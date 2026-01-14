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
                        nPeaks: msg.nPeaks ?? 0
                    };
                }
            };
        }

        setMode(mode) {
            this.mode = mode;
            this.windowMs = mode === "spectrum" ? 60000 : (mode === "lock" ? 15000 : 2000);
        }

        reset() {
            this.worker.postMessage({ type: "reset" });
            this.metrics = { bpm: null, rmssd: null, quality: 0, nPeaks: 0 };
        }

        extractRoiMeanG(videoEl, landmarks) {
            if (!videoEl || !landmarks || !landmarks.length) return null;

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

            const sx = clamp(fx + fw * 0.30, 0, vw - 2);
            const sy = clamp(fy + fh * 0.10, 0, vh - 2);
            const sw = clamp(fw * 0.40, 2, vw - sx);
            const sh = clamp(fh * 0.18, 2, vh - sy);

            this.roiCtx.drawImage(videoEl, sx, sy, sw, sh, 0, 0, 32, 32);
            const img = this.roiCtx.getImageData(0, 0, 32, 32).data;

            let sumG = 0;
            for (let i = 0; i < img.length; i += 4) {
                sumG += img[i + 1] / 255;
            }
            return sumG / (32 * 32);
        }

        pushFrame({ t, meanG }) {
            if (meanG == null) return;
            this.worker.postMessage({ type: "sample", t, x: meanG });
        }

        requestCompute() {
            this.worker.postMessage({ type: "compute", windowMs: this.windowMs });
        }

        // Lock: quality >= 0.6, Spectrum: quality >= 0.75
        getQualityGate() {
            const m = this.metrics;
            if (this.mode === "glimpse") return { pass: true, reason: "GLIMPSE" };

            const qualityThreshold = this.mode === "spectrum" ? 0.75 : 0.6;
            
            if (m.bpm === null) return { pass: false, reason: "DETECTING PULSE" };
            if (m.quality < qualityThreshold) return { pass: false, reason: "WEAK SIGNAL" };
            if (m.bpm < 45 || m.bpm > 160) return { pass: false, reason: "BPM OUT OF RANGE" };
            if (m.nPeaks < 4) return { pass: false, reason: "NEED MORE DATA" };

            return { pass: true, reason: "SIGNAL OK" };
        }
        
        getStatusString() {
            const m = this.metrics;
            const modeLabel = this.mode.charAt(0).toUpperCase() + this.mode.slice(1);
            const qualityThreshold = this.mode === "spectrum" ? 0.75 : 0.6;
            const qPct = Math.round(m.quality * 100);
            const passLabel = m.quality >= qualityThreshold ? "PASS" : "HOLD";
            
            if (m.bpm === null || m.rmssd === null) {
                return `${modeLabel}: Detecting... Q ${qPct}%`;
            }
            
            return `${modeLabel}: RMSSD ${Math.round(m.rmssd)}ms | BPM ${Math.round(m.bpm)} | Q ${qPct}% (${passLabel})`;
        }
    }

    window.TENKI_RPPG = {
        create(workerUrl) { return new RPPGController(workerUrl); }
    };
})();
