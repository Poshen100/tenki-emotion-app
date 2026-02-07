// facs-tracker.js - FACS Action Unit Tracking Module
// Maps FaceMesh landmarks to Facial Action Coding System units
// Outputs emotion probability vectors for multi-modal fusion

(function () {
    'use strict';

    // ==================== FACEMESH LANDMARK INDICES ====================
    // Reference: https://github.com/tensorflow/tfjs-models/blob/master/face-landmarks-detection/mesh_map.jpg

    const LANDMARKS = {
        // Eyebrows
        LEFT_BROW_INNER: 105,
        LEFT_BROW_OUTER: 46,
        RIGHT_BROW_INNER: 334,
        RIGHT_BROW_OUTER: 276,

        // Eyes
        LEFT_EYE_UPPER: 159,
        LEFT_EYE_LOWER: 145,
        LEFT_EYE_INNER: 133,
        LEFT_EYE_OUTER: 33,
        RIGHT_EYE_UPPER: 386,
        RIGHT_EYE_LOWER: 374,
        RIGHT_EYE_INNER: 362,
        RIGHT_EYE_OUTER: 263,

        // Nose
        NOSE_TIP: 1,
        NOSE_BRIDGE: 6,
        GLABELLA: 9,  // Between eyebrows

        // Mouth
        UPPER_LIP_TOP: 13,
        UPPER_LIP_BOTTOM: 14,
        LOWER_LIP_TOP: 17,
        LOWER_LIP_BOTTOM: 0,
        MOUTH_LEFT: 61,
        MOUTH_RIGHT: 291,

        // Cheeks
        LEFT_CHEEK: 117,
        RIGHT_CHEEK: 346,

        // Jaw
        CHIN: 152,
        JAW_LEFT: 234,
        JAW_RIGHT: 454
    };

    // ==================== ACTION UNIT DEFINITIONS ====================
    // Based on Ekman's FACS (Facial Action Coding System)

    const ACTION_UNITS = {
        AU1: { name: 'Inner Brow Raiser', muscles: 'Frontalis (pars medialis)' },
        AU2: { name: 'Outer Brow Raiser', muscles: 'Frontalis (pars lateralis)' },
        AU4: { name: 'Brow Lowerer', muscles: 'Corrugator supercilii' },
        AU5: { name: 'Upper Lid Raiser', muscles: 'Levator palpebrae superioris' },
        AU6: { name: 'Cheek Raiser', muscles: 'Orbicularis oculi (pars orbitalis)' },
        AU7: { name: 'Lid Tightener', muscles: 'Orbicularis oculi (pars palpebralis)' },
        AU9: { name: 'Nose Wrinkler', muscles: 'Levator labii superioris alaeque nasi' },
        AU10: { name: 'Upper Lip Raiser', muscles: 'Levator labii superioris' },
        AU12: { name: 'Lip Corner Puller', muscles: 'Zygomaticus major' },
        AU15: { name: 'Lip Corner Depressor', muscles: 'Depressor anguli oris' },
        AU17: { name: 'Chin Raiser', muscles: 'Mentalis' },
        AU20: { name: 'Lip Stretcher', muscles: 'Risorius' },
        AU23: { name: 'Lip Tightener', muscles: 'Orbicularis oris' },
        AU25: { name: 'Lips Part', muscles: 'Depressor labii inferioris' },
        AU26: { name: 'Jaw Drop', muscles: 'Masseter, temporal, medial pterygoid' },
        AU43: { name: 'Eyes Closed', muscles: 'Orbicularis oculi' }
    };

    // Emotion to AU mappings (Ekman's basic emotions)
    const EMOTION_AU_MAP = {
        happy: ['AU6', 'AU12'],                      // Cheek raise + smile
        sad: ['AU1', 'AU4', 'AU15'],                 // Inner brow raise + brow lower + frown
        angry: ['AU4', 'AU5', 'AU7', 'AU23'],        // Brow lower + lid raise + tighten
        surprised: ['AU1', 'AU2', 'AU5', 'AU26'],    // Brow raise + lid raise + jaw drop
        fear: ['AU1', 'AU2', 'AU4', 'AU5', 'AU20'],  // Brow raise + lower + lid + stretch
        disgust: ['AU9', 'AU15', 'AU17'],            // Nose wrinkle + frown + chin raise
        contempt: ['AU12', 'AU14']                   // Unilateral smile (simplified)
    };

    // ==================== FACS TRACKER CLASS ====================

    class FACSTracker {
        constructor() {
            // Action Unit intensities (0-1 scale)
            this.auValues = {};
            for (const au of Object.keys(ACTION_UNITS)) {
                this.auValues[au] = 0;
            }

            // Baseline calibration (neutral face reference)
            this.baseline = null;
            this.calibrationSamples = [];
            this.calibrationCount = 30;  // Frames for calibration

            // EWMA smoothing
            this.alpha = 0.2;

            // Output emotion probabilities
            this.emotions = {
                happy: 0,
                sad: 0,
                angry: 0,
                surprised: 0,
                fear: 0,
                disgust: 0,
                neutral: 1.0
            };

            // Temporal buffer for micro-expression detection
            this.buffer = [];
            this.maxBufferMs = 5000;  // 5 seconds

            // Stats
            this.frameCount = 0;
            this.lastUpdate = 0;

            console.log('[FACS] Module initialized');
        }

        // ==================== LANDMARK EXTRACTION ====================

        /**
         * Get landmark position by index
         */
        getLandmark(landmarks, idx) {
            if (!landmarks || idx >= landmarks.length) return null;
            const p = landmarks[idx];
            return { x: p.x, y: p.y, z: p.z || 0 };
        }

        /**
         * Calculate distance between two landmarks
         */
        distance(p1, p2) {
            if (!p1 || !p2) return 0;
            return Math.sqrt(
                Math.pow(p1.x - p2.x, 2) +
                Math.pow(p1.y - p2.y, 2) +
                Math.pow((p1.z || 0) - (p2.z || 0), 2)
            );
        }

        /**
         * Calculate vertical distance (Y only)
         */
        verticalDist(p1, p2) {
            if (!p1 || !p2) return 0;
            return p2.y - p1.y;  // Positive = p2 is lower
        }

        // ==================== ACTION UNIT CALCULATION ====================

        /**
         * Process a frame of landmarks and update AU values
         */
        pushFrame(landmarks, timestamp = null) {
            if (!landmarks || landmarks.length < 468) {
                return false;
            }

            const t = timestamp || performance.now();
            this.frameCount++;

            // Extract raw AU measurements
            const rawAUs = this._extractRawAUs(landmarks);

            // During calibration, accumulate samples
            if (!this.baseline && this.calibrationSamples.length < this.calibrationCount) {
                this.calibrationSamples.push(rawAUs);
                if (this.calibrationSamples.length >= this.calibrationCount) {
                    this._computeBaseline();
                }
                return true;
            }

            // Normalize against baseline
            const normalizedAUs = this._normalizeAUs(rawAUs);

            // Apply EWMA smoothing
            for (const au of Object.keys(normalizedAUs)) {
                this.auValues[au] = this.alpha * normalizedAUs[au] +
                    (1 - this.alpha) * (this.auValues[au] || 0);
            }

            // Store in buffer for temporal analysis
            this.buffer.push({
                t,
                aus: { ...this.auValues },
                emotions: null  // Will be computed below
            });
            this._trimBuffer(t);

            // Compute emotion probabilities
            this._computeEmotions();

            // Update buffer entry with emotions
            if (this.buffer.length > 0) {
                this.buffer[this.buffer.length - 1].emotions = { ...this.emotions };
            }

            this.lastUpdate = t;
            return true;
        }

        /**
         * Extract raw AU measurements from landmarks
         */
        _extractRawAUs(landmarks) {
            const L = LANDMARKS;
            const aus = {};

            // Reference distances for normalization
            const eyeWidth = this.distance(
                this.getLandmark(landmarks, L.LEFT_EYE_INNER),
                this.getLandmark(landmarks, L.LEFT_EYE_OUTER)
            );
            const faceHeight = this.distance(
                this.getLandmark(landmarks, L.GLABELLA),
                this.getLandmark(landmarks, L.CHIN)
            );

            // AU1 - Inner Brow Raiser
            // Measure: distance from inner brow to glabella
            const leftBrowInner = this.getLandmark(landmarks, L.LEFT_BROW_INNER);
            const rightBrowInner = this.getLandmark(landmarks, L.RIGHT_BROW_INNER);
            const glabella = this.getLandmark(landmarks, L.GLABELLA);
            aus.AU1 = (this.verticalDist(leftBrowInner, glabella) +
                this.verticalDist(rightBrowInner, glabella)) / 2;

            // AU2 - Outer Brow Raiser
            const leftBrowOuter = this.getLandmark(landmarks, L.LEFT_BROW_OUTER);
            const rightBrowOuter = this.getLandmark(landmarks, L.RIGHT_BROW_OUTER);
            aus.AU2 = (leftBrowOuter?.y + rightBrowOuter?.y) / 2 || 0;

            // AU4 - Brow Lowerer (inverse of brow height + brow closeness)
            const browDist = this.distance(leftBrowInner, rightBrowInner);
            aus.AU4 = browDist;

            // AU5 - Upper Lid Raiser
            const leftEyeOpen = this.distance(
                this.getLandmark(landmarks, L.LEFT_EYE_UPPER),
                this.getLandmark(landmarks, L.LEFT_EYE_LOWER)
            );
            const rightEyeOpen = this.distance(
                this.getLandmark(landmarks, L.RIGHT_EYE_UPPER),
                this.getLandmark(landmarks, L.RIGHT_EYE_LOWER)
            );
            aus.AU5 = (leftEyeOpen + rightEyeOpen) / 2;

            // AU6 - Cheek Raiser
            const leftCheek = this.getLandmark(landmarks, L.LEFT_CHEEK);
            const rightCheek = this.getLandmark(landmarks, L.RIGHT_CHEEK);
            aus.AU6 = -((leftCheek?.y || 0) + (rightCheek?.y || 0)) / 2;  // Negative Y = raised

            // AU7 - Lid Tightener (narrowing of eye)
            aus.AU7 = eyeWidth > 0 ? (leftEyeOpen + rightEyeOpen) / (2 * eyeWidth) : 0;

            // AU9 - Nose Wrinkler (measured by nose bridge compression)
            const noseTip = this.getLandmark(landmarks, L.NOSE_TIP);
            const noseBridge = this.getLandmark(landmarks, L.NOSE_BRIDGE);
            aus.AU9 = this.distance(noseTip, noseBridge);

            // AU12 - Lip Corner Puller (smile)
            const mouthLeft = this.getLandmark(landmarks, L.MOUTH_LEFT);
            const mouthRight = this.getLandmark(landmarks, L.MOUTH_RIGHT);
            const mouthWidth = this.distance(mouthLeft, mouthRight);
            const mouthCornerY = ((mouthLeft?.y || 0) + (mouthRight?.y || 0)) / 2;
            aus.AU12 = -mouthCornerY;  // Negative Y = corners raised

            // AU15 - Lip Corner Depressor (frown) - inverse of AU12
            aus.AU15 = mouthCornerY;

            // AU17 - Chin Raiser
            const chin = this.getLandmark(landmarks, L.CHIN);
            const lowerLip = this.getLandmark(landmarks, L.LOWER_LIP_BOTTOM);
            aus.AU17 = this.distance(chin, lowerLip);

            // AU25 - Lips Part
            const upperLip = this.getLandmark(landmarks, L.UPPER_LIP_BOTTOM);
            const lowerLipTop = this.getLandmark(landmarks, L.LOWER_LIP_TOP);
            aus.AU25 = this.distance(upperLip, lowerLipTop);

            // AU26 - Jaw Drop
            aus.AU26 = faceHeight > 0 ? this.distance(upperLip, chin) / faceHeight : 0;

            // AU43 - Eyes Closed
            aus.AU43 = 1 - ((leftEyeOpen + rightEyeOpen) / (2 * (eyeWidth * 0.3 || 0.01)));

            return aus;
        }

        /**
         * Compute baseline from calibration samples
         */
        _computeBaseline() {
            this.baseline = {};
            const keys = Object.keys(this.calibrationSamples[0]);

            for (const key of keys) {
                const values = this.calibrationSamples.map(s => s[key]).filter(v => v !== undefined);
                this.baseline[key] = {
                    mean: values.reduce((a, b) => a + b, 0) / values.length,
                    std: this._std(values)
                };
            }

            console.log('[FACS] Baseline calibration complete');
        }

        /**
         * Normalize AU values against baseline
         */
        _normalizeAUs(rawAUs) {
            const normalized = {};

            for (const [key, value] of Object.entries(rawAUs)) {
                if (this.baseline && this.baseline[key]) {
                    const { mean, std } = this.baseline[key];
                    // Z-score normalization, then sigmoid to 0-1
                    const z = std > 0.001 ? (value - mean) / std : 0;
                    normalized[key] = this._sigmoid(z);
                } else {
                    normalized[key] = value;
                }
            }

            return normalized;
        }

        _sigmoid(x) {
            return 1 / (1 + Math.exp(-x));
        }

        _std(arr) {
            if (arr.length < 2) return 0;
            const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
            const variance = arr.reduce((a, v) => a + Math.pow(v - mean, 2), 0) / arr.length;
            return Math.sqrt(variance);
        }

        // ==================== EMOTION COMPUTATION ====================

        /**
         * Compute emotion probabilities from AU values
         */
        _computeEmotions() {
            const scores = {};

            for (const [emotion, auList] of Object.entries(EMOTION_AU_MAP)) {
                // Geometric mean of AU intensities for this emotion
                let product = 1;
                let count = 0;

                for (const au of auList) {
                    if (this.auValues[au] !== undefined) {
                        product *= Math.max(0.01, this.auValues[au]);
                        count++;
                    }
                }

                scores[emotion] = count > 0 ? Math.pow(product, 1 / count) : 0;
            }

            // Softmax normalization to get probabilities
            const maxScore = Math.max(...Object.values(scores), 0.001);
            let sumExp = 0;

            for (const emotion of Object.keys(scores)) {
                scores[emotion] = Math.exp(scores[emotion] / maxScore);
                sumExp += scores[emotion];
            }

            // Add neutral as inverse of max emotion
            const maxEmotion = Math.max(...Object.values(scores)) / sumExp;
            scores.neutral = Math.max(0, 1 - maxEmotion * 2);
            sumExp += scores.neutral;

            // Normalize to probabilities
            for (const emotion of Object.keys(scores)) {
                this.emotions[emotion] = scores[emotion] / sumExp;
            }
        }

        // ==================== MICRO-EXPRESSION DETECTION ====================

        /**
         * Detect micro-expressions (rapid AU changes within 0.5s)
         */
        detectMicroExpressions() {
            if (this.buffer.length < 10) return null;

            const now = this.buffer[this.buffer.length - 1].t;
            const recentWindow = 500;  // 0.5 seconds
            const recentSamples = this.buffer.filter(s => s.t > now - recentWindow);

            if (recentSamples.length < 5) return null;

            const microExpressions = [];

            // Check for rapid AU spikes
            for (const au of Object.keys(ACTION_UNITS)) {
                const values = recentSamples.map(s => s.aus[au] || 0);
                const max = Math.max(...values);
                const min = Math.min(...values);
                const range = max - min;

                // Micro-expression: rapid change > 0.3 intensity
                if (range > 0.3) {
                    microExpressions.push({
                        au,
                        name: ACTION_UNITS[au].name,
                        intensity: range,
                        timestamp: now
                    });
                }
            }

            return microExpressions.length > 0 ? microExpressions : null;
        }

        // ==================== API ====================

        /**
         * Get current AU values
         */
        getAUValues() {
            return { ...this.auValues };
        }

        /**
         * Get current emotion probabilities
         */
        getEmotions() {
            return { ...this.emotions };
        }

        /**
         * Get dominant emotion
         */
        getDominantEmotion() {
            let maxEmotion = 'neutral';
            let maxProb = this.emotions.neutral || 0;

            for (const [emotion, prob] of Object.entries(this.emotions)) {
                if (prob > maxProb) {
                    maxProb = prob;
                    maxEmotion = emotion;
                }
            }

            return {
                emotion: maxEmotion,
                probability: maxProb,
                confidence: maxProb > 0.5 ? 'high' : maxProb > 0.3 ? 'medium' : 'low'
            };
        }

        /**
         * Get full analysis output
         */
        getAnalysis() {
            const dominant = this.getDominantEmotion();
            const microExpr = this.detectMicroExpressions();

            return {
                // Action Units
                actionUnits: this.getAUValues(),

                // Emotions
                emotions: this.getEmotions(),
                dominantEmotion: dominant.emotion,
                emotionConfidence: dominant.confidence,

                // Micro-expressions
                microExpressions: microExpr,

                // Status
                calibrated: this.baseline !== null,
                frameCount: this.frameCount,
                lastUpdate: this.lastUpdate
            };
        }

        /**
         * Get simplified output for fusion
         */
        getFusionOutput() {
            const dominant = this.getDominantEmotion();

            // Convert emotions to stress/valence/arousal for TEI integration
            const valence = (this.emotions.happy || 0) -
                (this.emotions.sad || 0) -
                (this.emotions.angry || 0) * 0.5;

            const arousal = (this.emotions.surprised || 0) +
                (this.emotions.angry || 0) +
                (this.emotions.fear || 0) -
                (this.emotions.neutral || 0) * 0.5;

            const stress = (this.emotions.angry || 0) * 0.4 +
                (this.emotions.fear || 0) * 0.3 +
                (this.emotions.sad || 0) * 0.2 +
                (1 - (this.emotions.happy || 0)) * 0.1;

            return {
                valence: Math.max(-1, Math.min(1, valence)),      // -1 to 1
                arousal: Math.max(-1, Math.min(1, arousal)),      // -1 to 1
                stress: Math.max(0, Math.min(1, stress)),         // 0 to 1
                confidence: dominant.probability,
                dominantEmotion: dominant.emotion
            };
        }

        /**
         * Force recalibration
         */
        recalibrate() {
            this.baseline = null;
            this.calibrationSamples = [];
            console.log('[FACS] Recalibration started');
        }

        /**
         * Reset all state
         */
        reset() {
            for (const au of Object.keys(ACTION_UNITS)) {
                this.auValues[au] = 0;
            }
            this.baseline = null;
            this.calibrationSamples = [];
            this.buffer = [];
            this.emotions = {
                happy: 0, sad: 0, angry: 0, surprised: 0,
                fear: 0, disgust: 0, neutral: 1.0
            };
            this.frameCount = 0;
            console.log('[FACS] Reset complete');
        }

        _trimBuffer(now) {
            const cutoff = now - this.maxBufferMs;
            while (this.buffer.length > 0 && this.buffer[0].t < cutoff) {
                this.buffer.shift();
            }
        }
    }

    // ==================== EXPORT ====================

    window.TENKI_FACS = {
        create() { return new FACSTracker(); },
        FACSTracker,
        ACTION_UNITS,
        EMOTION_AU_MAP,
        LANDMARKS
    };

    console.log('[FACS] Module loaded ✓');
})();
