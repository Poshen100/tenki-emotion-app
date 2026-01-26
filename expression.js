// expression.js - Expression Risk / Uncertainty Layer
// Continuous feature accumulation for progressive precision
// NOT microexpression classification - this is a risk/uncertainty modifier

(function () {
    class ExpressionTracker {
        constructor() {
            // Feature buffer (rolling window)
            this.buffer = [];
            this.maxBufferMs = 60000; // Keep 60s max

            // EWMA smoothing factor
            this.alpha = 0.15;

            // Running statistics
            this.stats = {
                faceDetectRatio: 1.0,
                landmarkQuality: 1.0,
                gazeStability: 1.0,
                blinkRate: 0,       // blinks per minute
                blinkRateEwma: 15,  // normal ~15-20/min
                mouthEventRate: 0,
                browTension: 0,     // 0=relaxed, 1=tense
                headJitter: 0,
                lastBlinkTime: 0,
                blinkCount: 0
            };

            // Outputs
            this.uncertainty = 0.3;  // 0=certain, 1=very uncertain
            this.risk = 0.3;         // 0=low risk, 1=high risk
            this.riskMessage = "";

            // Thresholds
            this.config = {
                // Gaze
                gazeVarThreshold: 0.015,
                // Blink
                normalBlinkRateMin: 10,
                normalBlinkRateMax: 25,
                // Head
                headJitterThreshold: 0.02,
                // Brow
                browTensionThreshold: 0.6
            };
        }

        // Push a frame sample from FaceMesh landmarks
        pushSample(landmarks, timestamp) {
            if (!landmarks || !landmarks.length) {
                this.buffer.push({
                    t: timestamp || performance.now(),
                    faceOk: false
                });
                this.trimBuffer();
                return;
            }

            const t = timestamp || performance.now();

            // Extract features from landmarks
            const sample = {
                t,
                faceOk: true,
                // Key landmark positions for tracking
                noseTip: this.getLandmark(landmarks, 1),      // Nose tip
                leftEye: this.getLandmark(landmarks, 159),    // Left eye outer
                rightEye: this.getLandmark(landmarks, 386),   // Right eye outer
                leftBrow: this.getLandmark(landmarks, 105),   // Left brow inner
                rightBrow: this.getLandmark(landmarks, 334),  // Right brow inner
                upperLip: this.getLandmark(landmarks, 13),    // Upper lip
                lowerLip: this.getLandmark(landmarks, 14),    // Lower lip
                leftIris: this.getLandmark(landmarks, 468),   // Left iris (if available)
                rightIris: this.getLandmark(landmarks, 473),  // Right iris (if available)
                // Computed features
                eyeOpenRatio: this.computeEyeOpenRatio(landmarks),
                mouthOpen: this.computeMouthOpen(landmarks),
                browDistance: this.computeBrowDistance(landmarks)
            };

            this.buffer.push(sample);
            this.trimBuffer();
            this.updateStats();
        }

        getLandmark(landmarks, idx) {
            if (idx < landmarks.length) {
                return { x: landmarks[idx].x, y: landmarks[idx].y, z: landmarks[idx].z || 0 };
            }
            return null;
        }

        computeEyeOpenRatio(landmarks) {
            // Simplified: vertical distance between upper/lower eyelid
            const leftUpper = this.getLandmark(landmarks, 159);
            const leftLower = this.getLandmark(landmarks, 145);
            const rightUpper = this.getLandmark(landmarks, 386);
            const rightLower = this.getLandmark(landmarks, 374);

            if (!leftUpper || !leftLower || !rightUpper || !rightLower) return 0.5;

            const leftOpen = Math.abs(leftUpper.y - leftLower.y);
            const rightOpen = Math.abs(rightUpper.y - rightLower.y);
            return (leftOpen + rightOpen) / 2;
        }

        computeMouthOpen(landmarks) {
            const upper = this.getLandmark(landmarks, 13);
            const lower = this.getLandmark(landmarks, 14);
            if (!upper || !lower) return 0;
            return Math.abs(upper.y - lower.y);
        }

        computeBrowDistance(landmarks) {
            // Inner brow distance (tension = brows closer together)
            const left = this.getLandmark(landmarks, 105);
            const right = this.getLandmark(landmarks, 334);
            if (!left || !right) return 0.1;
            return Math.abs(left.x - right.x);
        }

        trimBuffer() {
            const now = this.buffer.length ? this.buffer[this.buffer.length - 1].t : performance.now();
            const cutoff = now - this.maxBufferMs;
            while (this.buffer.length > 0 && this.buffer[0].t < cutoff) {
                this.buffer.shift();
            }
        }

        // Get samples within a time window
        getWindowSamples(windowMs) {
            if (this.buffer.length === 0) return [];
            const now = this.buffer[this.buffer.length - 1].t;
            const cutoff = now - windowMs;
            return this.buffer.filter(s => s.t >= cutoff);
        }

        updateStats() {
            if (this.buffer.length < 5) return;

            const now = this.buffer[this.buffer.length - 1].t;
            const samples15s = this.getWindowSamples(15000);
            const samples2s = this.getWindowSamples(2000);

            // Face detection ratio (2s window)
            const faceOkCount = samples2s.filter(s => s.faceOk).length;
            this.stats.faceDetectRatio = faceOkCount / Math.max(1, samples2s.length);

            // Landmark quality (simplified: all landmarks present?)
            const validSamples = samples2s.filter(s => s.faceOk && s.noseTip);
            this.stats.landmarkQuality = validSamples.length / Math.max(1, samples2s.length);

            // Gaze stability (variance of eye positions over 2s)
            this.stats.gazeStability = this.computeGazeStability(samples2s);

            // Blink detection and rate (15s window)
            this.detectBlinks(samples15s);

            // Mouth event rate
            this.stats.mouthEventRate = this.computeMouthEventRate(samples15s);

            // Brow tension
            this.stats.browTension = this.computeBrowTension(samples2s);

            // Head jitter (nose tip movement variance)
            this.stats.headJitter = this.computeHeadJitter(samples2s);

            // Compute final uncertainty and risk
            this.computeOutputs();
        }

        computeGazeStability(samples) {
            const valid = samples.filter(s => s.leftEye && s.rightEye);
            if (valid.length < 3) return 1.0;

            // Compute variance of eye center position
            const eyeCenters = valid.map(s => ({
                x: (s.leftEye.x + s.rightEye.x) / 2,
                y: (s.leftEye.y + s.rightEye.y) / 2
            }));

            const meanX = eyeCenters.reduce((a, p) => a + p.x, 0) / eyeCenters.length;
            const meanY = eyeCenters.reduce((a, p) => a + p.y, 0) / eyeCenters.length;

            const variance = eyeCenters.reduce((a, p) =>
                a + Math.pow(p.x - meanX, 2) + Math.pow(p.y - meanY, 2), 0) / eyeCenters.length;

            // Convert variance to stability (0=unstable, 1=stable)
            const stability = Math.max(0, 1 - variance / this.config.gazeVarThreshold);
            return stability;
        }

        detectBlinks(samples) {
            const valid = samples.filter(s => s.faceOk && s.eyeOpenRatio !== undefined);
            if (valid.length < 10) return;

            // Detect blinks as dips in eye open ratio
            const threshold = 0.015; // Eyes considered closed below this
            let blinkCount = 0;
            let inBlink = false;

            for (let i = 1; i < valid.length; i++) {
                const prevOpen = valid[i - 1].eyeOpenRatio;
                const currOpen = valid[i].eyeOpenRatio;

                if (!inBlink && currOpen < threshold && prevOpen >= threshold) {
                    inBlink = true;
                }
                if (inBlink && currOpen >= threshold && prevOpen < threshold) {
                    inBlink = false;
                    blinkCount++;
                }
            }

            // Calculate blink rate (per minute)
            const durationSec = (valid[valid.length - 1].t - valid[0].t) / 1000;
            if (durationSec > 1) {
                const rate = (blinkCount / durationSec) * 60;
                // EWMA smoothing
                this.stats.blinkRateEwma = this.alpha * rate + (1 - this.alpha) * this.stats.blinkRateEwma;
            }

            this.stats.blinkRate = this.stats.blinkRateEwma;
            this.stats.blinkCount = blinkCount;
        }

        computeMouthEventRate(samples) {
            const valid = samples.filter(s => s.faceOk && s.mouthOpen !== undefined);
            if (valid.length < 5) return 0;

            // Count mouth open/close transitions
            const threshold = 0.02;
            let events = 0;
            let wasOpen = false;

            for (const s of valid) {
                const isOpen = s.mouthOpen > threshold;
                if (isOpen !== wasOpen) {
                    events++;
                    wasOpen = isOpen;
                }
            }

            const durationSec = (valid[valid.length - 1].t - valid[0].t) / 1000;
            return durationSec > 0 ? events / durationSec : 0;
        }

        computeBrowTension(samples) {
            const valid = samples.filter(s => s.browDistance !== undefined);
            if (valid.length < 3) return 0;

            const distances = valid.map(s => s.browDistance);
            const mean = distances.reduce((a, b) => a + b, 0) / distances.length;

            // Lower distance = more tension (brows furrowed)
            // Normalize: typical relaxed ~0.08-0.12, tense ~0.04-0.07
            const tension = Math.max(0, Math.min(1, (0.10 - mean) / 0.05));
            return tension;
        }

        computeHeadJitter(samples) {
            const valid = samples.filter(s => s.noseTip);
            if (valid.length < 5) return 0;

            // Compute frame-to-frame movement
            let totalMovement = 0;
            for (let i = 1; i < valid.length; i++) {
                const prev = valid[i - 1].noseTip;
                const curr = valid[i].noseTip;
                const dx = curr.x - prev.x;
                const dy = curr.y - prev.y;
                totalMovement += Math.sqrt(dx * dx + dy * dy);
            }

            const avgMovement = totalMovement / (valid.length - 1);
            // Normalize to 0-1 scale
            return Math.min(1, avgMovement / this.config.headJitterThreshold);
        }

        computeOutputs() {
            const s = this.stats;

            // Uncertainty: based on face detection, landmark quality, gaze, head jitter
            let uncertainty = 0;

            // Face detection issues
            if (s.faceDetectRatio < 0.9) uncertainty += 0.3 * (1 - s.faceDetectRatio);
            if (s.landmarkQuality < 0.9) uncertainty += 0.2 * (1 - s.landmarkQuality);

            // Gaze instability
            if (s.gazeStability < 0.7) uncertainty += 0.25 * (1 - s.gazeStability);

            // Head movement
            if (s.headJitter > 0.3) uncertainty += 0.25 * s.headJitter;

            this.uncertainty = Math.min(1, Math.max(0, uncertainty));

            // Risk: based on blink patterns, brow tension, mouth activity
            let risk = 0;

            // Abnormal blink rate
            if (s.blinkRate < this.config.normalBlinkRateMin) {
                risk += 0.2; // Staring (high focus or stress)
            } else if (s.blinkRate > this.config.normalBlinkRateMax) {
                risk += 0.3; // Rapid blinking (anxiety/discomfort)
            }

            // Brow tension
            if (s.browTension > 0.5) risk += 0.3 * s.browTension;

            // High mouth activity
            if (s.mouthEventRate > 1) risk += 0.2 * Math.min(1, s.mouthEventRate / 3);

            this.risk = Math.min(1, Math.max(0, risk));

            // Generate risk message
            this.riskMessage = this.generateRiskMessage();
        }

        generateRiskMessage() {
            const s = this.stats;
            const messages = [];

            if (s.headJitter > 0.4) messages.push("Movement detected");
            if (s.gazeStability < 0.5) messages.push("Gaze unstable");
            if (s.blinkRate > this.config.normalBlinkRateMax) messages.push("Blink rate elevated");
            if (s.blinkRate < this.config.normalBlinkRateMin * 0.7) messages.push("Low blink rate");
            if (s.browTension > 0.6) messages.push("Tension rising");
            if (s.faceDetectRatio < 0.8) messages.push("Face tracking unstable");

            if (messages.length === 0) {
                if (this.risk < 0.2) return "Expression stable";
                return "Monitoring...";
            }

            return messages.slice(0, 2).join(" · ");
        }

        // Get output for specific phase
        getPhaseOutput(phase) {
            // phase: 1=glimpse(2s), 2=lock(15s), 3=deep(30s), 4=spectrum(60s)
            const s = this.stats;

            if (phase === 1) {
                // 2s: Just face lock and initial uncertainty
                return {
                    ready: s.faceDetectRatio > 0.8 && s.landmarkQuality > 0.8,
                    uncertainty: this.uncertainty,
                    message: s.faceDetectRatio < 0.8 ? "Face not stable" :
                        s.headJitter > 0.5 ? "Hold steady" :
                            s.gazeStability < 0.5 ? "Look at camera" : "Ready"
                };
            }

            if (phase >= 2) {
                // 15s+: Full risk assessment
                return {
                    ready: this.uncertainty < 0.5,
                    uncertainty: this.uncertainty,
                    risk: this.risk,
                    riskLevel: this.risk < 0.25 ? "Low" : this.risk < 0.5 ? "Med" : "High",
                    message: this.riskMessage,
                    stats: {
                        gazeStability: Math.round(s.gazeStability * 100),
                        blinkRate: Math.round(s.blinkRate),
                        browTension: Math.round(s.browTension * 100),
                        headJitter: Math.round(s.headJitter * 100)
                    }
                };
            }

            return { ready: true, uncertainty: 0.3, message: "Analyzing..." };
        }

        // Should TEI confidence be reduced?
        shouldReduceConfidence() {
            return this.uncertainty > 0.4;
        }

        // Get confidence modifier (0.5 to 1.0)
        getConfidenceModifier() {
            // If uncertainty is high, reduce confidence
            // uncertainty 0 -> modifier 1.0
            // uncertainty 0.5 -> modifier 0.85
            // uncertainty 1.0 -> modifier 0.5
            return Math.max(0.5, 1 - (this.uncertainty * 0.5));
        }

        reset() {
            this.buffer = [];
            this.stats = {
                faceDetectRatio: 1.0,
                landmarkQuality: 1.0,
                gazeStability: 1.0,
                blinkRate: 0,
                blinkRateEwma: 15,
                mouthEventRate: 0,
                browTension: 0,
                headJitter: 0,
                lastBlinkTime: 0,
                blinkCount: 0
            };
            this.uncertainty = 0.3;
            this.risk = 0.3;
            this.riskMessage = "";
        }
    }

    window.TENKI_EXPRESSION = {
        create() { return new ExpressionTracker(); }
    };
})();
