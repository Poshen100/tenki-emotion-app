// fusion-controller.js - Multi-Modal Data Fusion Controller
// Dynamic weight adjustment based on signal quality
// Integrates HRV, Expression, and Device data for unified TEI output

(function () {
    'use strict';

    // ==================== DEFAULT WEIGHTS ====================

    const DEFAULT_WEIGHTS = {
        hrv: 0.60,        // Primary modality (physiological)
        expression: 0.30, // Secondary modality (behavioral)
        device: 0.10      // Tertiary (wearable supplement)
    };

    // Quality thresholds for weight adjustment
    const QUALITY_THRESHOLDS = {
        HIGH: 0.8,
        MEDIUM: 0.5,
        LOW: 0.3
    };

    // Fusion modes
    const FUSION_MODES = {
        FULL: 'full',              // All modalities available
        HRV_EXPRESSION: 'hrv_expression',  // No device
        HRV_ONLY: 'hrv_only',      // HRV is primary
        EXPRESSION_ONLY: 'expression_only', // Behavioral mode
        DEVICE_ONLY: 'device_only', // External device only
        HISTORICAL: 'historical'    // No live data, use history
    };

    // ==================== FUSION CONTROLLER CLASS ====================

    class FusionController {
        constructor(options = {}) {
            // Module references
            this.hrvModule = options.hrvModule || null;
            this.facsModule = options.facsModule || null;
            this.deviceModule = options.deviceModule || null;

            // Current weights (dynamic)
            this.weights = { ...DEFAULT_WEIGHTS };

            // Quality scores for each modality
            this.quality = {
                hrv: 0,
                expression: 0,
                device: 0
            };

            // Fusion state
            this.mode = FUSION_MODES.HISTORICAL;
            this.lastFusionResult = null;
            this.fusionHistory = [];
            this.maxHistory = 100;

            // Confidence tracking
            this.overallConfidence = 0;
            this.confidenceHistory = [];

            // Time tracking
            this.lastUpdate = 0;
            this.updateCount = 0;

            console.log('[FUSION] Controller initialized');
        }

        // ==================== MODULE REGISTRATION ====================

        /**
         * Register HRV module
         */
        setHRVModule(module) {
            this.hrvModule = module;
            console.log('[FUSION] HRV module registered');
        }

        /**
         * Register FACS/Expression module
         */
        setFACSModule(module) {
            this.facsModule = module;
            console.log('[FUSION] FACS module registered');
        }

        /**
         * Register external device module (HealthKit, Google Fit, etc.)
         */
        setDeviceModule(module) {
            this.deviceModule = module;
            console.log('[FUSION] Device module registered');
        }

        // ==================== QUALITY ASSESSMENT ====================

        /**
         * Assess quality of each modality
         */
        _assessQuality() {
            // HRV Quality
            if (this.hrvModule) {
                const hrvMetrics = this.hrvModule.getMetrics?.() ||
                    this.hrvModule.metrics || {};
                this.quality.hrv = hrvMetrics.quality || 0;
            } else {
                this.quality.hrv = 0;
            }

            // Expression Quality (based on face detection and calibration)
            if (this.facsModule) {
                const facsAnalysis = this.facsModule.getAnalysis?.() || {};
                const calibrated = facsAnalysis.calibrated ? 0.5 : 0;
                const frameRecency = facsAnalysis.lastUpdate ?
                    Math.max(0, 1 - (performance.now() - facsAnalysis.lastUpdate) / 5000) : 0;
                this.quality.expression = (calibrated + frameRecency * 0.5);
            } else {
                this.quality.expression = 0;
            }

            // Device Quality (if available)
            if (this.deviceModule) {
                const deviceStatus = this.deviceModule.getStatus?.() || {};
                this.quality.device = deviceStatus.connected ?
                    (deviceStatus.signalQuality || 0.5) : 0;
            } else {
                this.quality.device = 0;
            }
        }

        // ==================== WEIGHT ADJUSTMENT ====================

        /**
         * Dynamically adjust weights based on signal quality
         */
        _adjustWeights() {
            this._assessQuality();

            // Start with default weights
            let weights = { ...DEFAULT_WEIGHTS };

            // Adjust based on HRV quality
            if (this.quality.hrv < QUALITY_THRESHOLDS.LOW) {
                // HRV very low - redistribute to expression
                const reduction = weights.hrv * 0.7;
                weights.hrv -= reduction;
                weights.expression += reduction * 0.8;
                weights.device += reduction * 0.2;
            } else if (this.quality.hrv < QUALITY_THRESHOLDS.MEDIUM) {
                // HRV moderate - slight reduction
                const reduction = weights.hrv * 0.3;
                weights.hrv -= reduction;
                weights.expression += reduction * 0.7;
                weights.device += reduction * 0.3;
            }

            // Adjust based on expression quality
            if (this.quality.expression < QUALITY_THRESHOLDS.LOW) {
                // No good expression data - redistribute to HRV
                const reduction = weights.expression * 0.8;
                weights.expression -= reduction;
                weights.hrv += reduction * 0.9;
                weights.device += reduction * 0.1;
            }

            // Boost device weight if it's the only reliable source
            if (this.quality.device > QUALITY_THRESHOLDS.HIGH &&
                this.quality.hrv < QUALITY_THRESHOLDS.MEDIUM &&
                this.quality.expression < QUALITY_THRESHOLDS.MEDIUM) {
                weights.device = 0.6;
                weights.hrv = 0.25;
                weights.expression = 0.15;
            }

            // Normalize weights to sum to 1.0
            const total = weights.hrv + weights.expression + weights.device;
            if (total > 0) {
                weights.hrv /= total;
                weights.expression /= total;
                weights.device /= total;
            }

            this.weights = weights;

            // Determine fusion mode
            this._determineFusionMode();
        }

        /**
         * Determine the current fusion mode based on available modalities
         */
        _determineFusionMode() {
            const hrvOk = this.quality.hrv >= QUALITY_THRESHOLDS.LOW;
            const exprOk = this.quality.expression >= QUALITY_THRESHOLDS.LOW;
            const deviceOk = this.quality.device >= QUALITY_THRESHOLDS.LOW;

            if (hrvOk && exprOk && deviceOk) {
                this.mode = FUSION_MODES.FULL;
            } else if (hrvOk && exprOk) {
                this.mode = FUSION_MODES.HRV_EXPRESSION;
            } else if (hrvOk) {
                this.mode = FUSION_MODES.HRV_ONLY;
            } else if (exprOk) {
                this.mode = FUSION_MODES.EXPRESSION_ONLY;
            } else if (deviceOk) {
                this.mode = FUSION_MODES.DEVICE_ONLY;
            } else {
                this.mode = FUSION_MODES.HISTORICAL;
            }
        }

        // ==================== DATA EXTRACTION ====================

        /**
         * Extract normalized score from HRV module
         * @returns {number} Score 0-1 (higher = better HRV / lower stress)
         */
        _getHRVScore() {
            if (!this.hrvModule) return 0.5;

            const metrics = this.hrvModule.getMetrics?.() ||
                this.hrvModule.metrics || {};

            if (!metrics.rmssd) return 0.5;

            // RMSSD normalization (typical range 20-80ms)
            // Higher RMSSD = better parasympathetic tone = lower stress
            const rmssdNorm = Math.min(1, Math.max(0, (metrics.rmssd - 10) / 80));

            // LF/HF ratio inversion (lower ratio = more relaxed)
            let lfHfScore = 0.5;
            if (metrics.lfHfRatio !== null && metrics.lfHfRatio !== undefined) {
                // Typical range 0.5 - 4.0, lower is better
                lfHfScore = Math.max(0, Math.min(1, 1 - (metrics.lfHfRatio - 0.5) / 3.5));
            }

            // Combined score (RMSSD weighted more heavily)
            return rmssdNorm * 0.7 + lfHfScore * 0.3;
        }

        /**
         * Extract normalized score from FACS module
         * @returns {number} Score 0-1 (higher = positive state)
         */
        _getExpressionScore() {
            if (!this.facsModule) return 0.5;

            const fusionOutput = this.facsModule.getFusionOutput?.() || {};

            if (fusionOutput.valence === undefined) return 0.5;

            // Valence is -1 to 1, normalize to 0-1
            const valenceNorm = (fusionOutput.valence + 1) / 2;

            // Stress is 0-1, invert for wellness score
            const stressNorm = 1 - (fusionOutput.stress || 0);

            // Combine
            return valenceNorm * 0.6 + stressNorm * 0.4;
        }

        /**
         * Extract normalized score from device module
         * @returns {number} Score 0-1
         */
        _getDeviceScore() {
            if (!this.deviceModule) return 0.5;

            const deviceData = this.deviceModule.getLatestData?.() || {};

            // If device provides HRV directly, use it
            if (deviceData.hrvScore !== undefined) {
                return deviceData.hrvScore;
            }

            // If device provides heart rate, normalize
            if (deviceData.heartRate) {
                // Resting HR: 60-80 is normal
                // Lower (within reason) is generally better
                const hr = deviceData.heartRate;
                if (hr >= 50 && hr <= 100) {
                    return 1 - (hr - 50) / 50;  // 50 bpm = 1.0, 100 bpm = 0.0
                }
            }

            return 0.5;
        }

        // ==================== FUSION COMPUTATION ====================

        /**
         * Compute fused score from all modalities
         * @returns {Object} Fusion result
         */
        computeFusion() {
            this._adjustWeights();

            // Get individual scores
            const hrvScore = this._getHRVScore();
            const exprScore = this._getExpressionScore();
            const deviceScore = this._getDeviceScore();

            // Weighted fusion
            const fusedScore =
                hrvScore * this.weights.hrv +
                exprScore * this.weights.expression +
                deviceScore * this.weights.device;

            // Calculate overall confidence
            const qualitySum =
                this.quality.hrv * this.weights.hrv +
                this.quality.expression * this.weights.expression +
                this.quality.device * this.weights.device;

            this.overallConfidence = Math.min(1, qualitySum);

            // Store result
            const result = {
                // Fused output
                score: fusedScore,
                teiEquivalent: Math.round(fusedScore * 98) + 1,  // Map to 1-99 TEI range

                // Individual contributions
                components: {
                    hrv: { score: hrvScore, weight: this.weights.hrv, quality: this.quality.hrv },
                    expression: { score: exprScore, weight: this.weights.expression, quality: this.quality.expression },
                    device: { score: deviceScore, weight: this.weights.device, quality: this.quality.device }
                },

                // Meta
                mode: this.mode,
                confidence: this.overallConfidence,
                confidenceLevel: this._getConfidenceLevel(),
                timestamp: performance.now()
            };

            // Store in history
            this.fusionHistory.push(result);
            if (this.fusionHistory.length > this.maxHistory) {
                this.fusionHistory.shift();
            }

            this.lastFusionResult = result;
            this.lastUpdate = result.timestamp;
            this.updateCount++;

            return result;
        }

        /**
         * Get human-readable confidence level
         */
        _getConfidenceLevel() {
            if (this.overallConfidence >= 0.8) return 'high';
            if (this.overallConfidence >= 0.5) return 'medium';
            if (this.overallConfidence >= 0.3) return 'low';
            return 'minimal';
        }

        // ==================== HISTORICAL FALLBACK ====================

        /**
         * Get historical baseline when live data unavailable
         */
        getHistoricalBaseline() {
            if (this.fusionHistory.length < 5) {
                return { score: 0.5, teiEquivalent: 50, confidence: 0.2 };
            }

            // Use last 10 valid results
            const recent = this.fusionHistory.slice(-10);
            const avgScore = recent.reduce((a, r) => a + r.score, 0) / recent.length;

            return {
                score: avgScore,
                teiEquivalent: Math.round(avgScore * 98) + 1,
                confidence: 0.4,  // Lower confidence for historical
                mode: FUSION_MODES.HISTORICAL,
                basedOnSamples: recent.length
            };
        }

        // ==================== API ====================

        /**
         * Get current fusion state for display
         */
        getState() {
            return {
                weights: { ...this.weights },
                quality: { ...this.quality },
                mode: this.mode,
                confidence: this.overallConfidence,
                lastResult: this.lastFusionResult,
                updateCount: this.updateCount
            };
        }

        /**
         * Get latest fused score (call computeFusion first or use cached)
         */
        getLatestScore() {
            if (!this.lastFusionResult ||
                performance.now() - this.lastFusionResult.timestamp > 1000) {
                return this.computeFusion();
            }
            return this.lastFusionResult;
        }

        /**
         * Get interpretation message for UI
         */
        getInterpretation() {
            const result = this.getLatestScore();

            let message = '';
            let icon = '💙';

            // Mode-based messages
            switch (this.mode) {
                case FUSION_MODES.FULL:
                    icon = '💚';
                    message = 'Full sensor fusion active';
                    break;
                case FUSION_MODES.HRV_EXPRESSION:
                    icon = '💚';
                    message = 'Camera-based analysis';
                    break;
                case FUSION_MODES.HRV_ONLY:
                    icon = '💛';
                    message = 'Physiological mode only';
                    break;
                case FUSION_MODES.EXPRESSION_ONLY:
                    icon = '💛';
                    message = 'Behavioral analysis only';
                    break;
                case FUSION_MODES.DEVICE_ONLY:
                    icon = '💙';
                    message = 'Using wearable data';
                    break;
                case FUSION_MODES.HISTORICAL:
                    icon = '⚪';
                    message = 'Using baseline estimate';
                    break;
            }

            // Score-based overlay
            if (result.score > 0.7) {
                message += ' • Excellent state';
            } else if (result.score > 0.5) {
                message += ' • Good condition';
            } else if (result.score > 0.3) {
                message += ' • Monitor closely';
            } else {
                message += ' • Elevated stress';
            }

            return {
                icon,
                message,
                confidence: result.confidenceLevel,
                mode: this.mode,
                score: result.teiEquivalent
            };
        }

        /**
         * Force weight configuration (for testing/override)
         */
        setWeights(weights) {
            const total = (weights.hrv || 0) + (weights.expression || 0) + (weights.device || 0);
            if (total > 0) {
                this.weights = {
                    hrv: (weights.hrv || 0) / total,
                    expression: (weights.expression || 0) / total,
                    device: (weights.device || 0) / total
                };
            }
        }

        /**
         * Reset fusion state
         */
        reset() {
            this.weights = { ...DEFAULT_WEIGHTS };
            this.quality = { hrv: 0, expression: 0, device: 0 };
            this.mode = FUSION_MODES.HISTORICAL;
            this.lastFusionResult = null;
            this.fusionHistory = [];
            this.overallConfidence = 0;
            this.updateCount = 0;
            console.log('[FUSION] Reset complete');
        }
    }

    // ==================== EXPORT ====================

    window.TENKI_FUSION = {
        create(options) { return new FusionController(options); },
        FusionController,
        DEFAULT_WEIGHTS,
        QUALITY_THRESHOLDS,
        FUSION_MODES
    };

    console.log('[FUSION] Module loaded ✓');
})();
