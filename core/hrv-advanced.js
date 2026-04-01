// hrv-advanced.js - Advanced HRV Analysis Module
// SDNN, pNN50, LF/HF Frequency Analysis + Motion Artifact Detection
// Integrates with existing rPPG system via Event Bridge Pattern

(function () {
    'use strict';

    // ==================== CONSTANTS ====================
    
    // HRV Frequency Bands (Hz)
    const FREQ_BANDS = {
        VLF: { min: 0.003, max: 0.04 },  // Very Low Frequency
        LF: { min: 0.04, max: 0.15 },    // Low Frequency (sympathetic + parasympathetic)
        HF: { min: 0.15, max: 0.4 }      // High Frequency (parasympathetic)
    };

    // RR Interval Validity (Malik criteria)
    const RR_LIMITS = {
        MIN_MS: 300,   // ~200 BPM max
        MAX_MS: 2000,  // ~30 BPM min
        MAX_DIFF_RATIO: 0.20  // Max 20% change between adjacent RR
    };

    // Quality Thresholds
    const QUALITY_THRESHOLDS = {
        MIN_RR_COUNT: 30,        // Minimum RR intervals for time-domain
        MIN_RR_FREQ: 120,        // Minimum for frequency analysis (2 min worth)
        MOTION_THRESHOLD: 0.15,  // Max acceptable artifact ratio
        OUTLIER_THRESHOLD: 0.10  // Max acceptable outlier ratio
    };

    // ==================== HRV ADVANCED CLASS ====================

    class HRVAdvanced {
        constructor(rppgController = null) {
            this.rppgController = rppgController;
            
            // RR interval buffer (keeps last 5 minutes)
            this.rrBuffer = [];
            this.maxBufferMs = 300000;  // 5 minutes
            
            // Metrics cache
            this.metrics = {
                // Time Domain
                sdnn: null,
                rmssd: null,
                pnn50: null,
                meanRR: null,
                
                // Frequency Domain
                vlf: null,
                lf: null,
                hf: null,
                lfHfRatio: null,
                totalPower: null,
                
                // Quality
                quality: 0,
                outlierRatio: 0,
                motionArtifact: false,
                rrCount: 0,
                validRRCount: 0,
                lastUpdate: 0
            };
            
            // Motion detection state
            this.motionBuffer = [];
            this.motionWindow = 2000;  // 2 second window
            
            console.log('[HRV-ADV] Module initialized');
        }

        // ==================== RR INTERVAL MANAGEMENT ====================

        /**
         * Push a new RR interval (in milliseconds)
         * @param {number} rrMs - RR interval in milliseconds
         * @param {number} timestamp - Optional timestamp
         * @param {number} quality - Optional quality score 0-1
         */
        pushRR(rrMs, timestamp = null, quality = 1.0) {
            const t = timestamp || performance.now();
            
            // Basic validation
            if (rrMs < RR_LIMITS.MIN_MS || rrMs > RR_LIMITS.MAX_MS) {
                console.debug('[HRV-ADV] RR out of range:', rrMs);
                return false;
            }
            
            // Malik criterion: check against previous RR
            if (this.rrBuffer.length > 0) {
                const prevRR = this.rrBuffer[this.rrBuffer.length - 1].rr;
                const diffRatio = Math.abs(rrMs - prevRR) / prevRR;
                
                if (diffRatio > RR_LIMITS.MAX_DIFF_RATIO) {
                    // Mark as potential outlier but still store
                    this.rrBuffer.push({ t, rr: rrMs, quality, outlier: true });
                    this._trimBuffer();
                    return false;
                }
            }
            
            this.rrBuffer.push({ t, rr: rrMs, quality, outlier: false });
            this._trimBuffer();
            return true;
        }

        /**
         * Push multiple RR intervals from BLE or batch source
         */
        pushRRBatch(rrArray, startTimestamp = null) {
            let t = startTimestamp || performance.now();
            for (const rr of rrArray) {
                this.pushRR(rr, t);
                t += rr;  // Advance timestamp by RR interval
            }
        }

        /**
         * Sync with rPPG controller if available
         */
        syncFromRPPG() {
            if (!this.rppgController) return;
            
            const metrics = this.rppgController.metrics;
            if (metrics && metrics.bpm) {
                // Estimate RR from BPM if no direct RR access
                const estimatedRR = 60000 / metrics.bpm;
                this.pushRR(estimatedRR);
            }
            
            // If BLE RR intervals available, use them directly
            if (this.rppgController.bleRrIntervals?.length > 0) {
                const bleRRs = this.rppgController.bleRrIntervals;
                for (const item of bleRRs) {
                    if (!this._hasRRAtTime(item.t)) {
                        this.pushRR(item.rr, item.t, 1.0);  // BLE = perfect quality
                    }
                }
            }
        }

        _hasRRAtTime(t) {
            return this.rrBuffer.some(r => Math.abs(r.t - t) < 50);  // 50ms tolerance
        }

        _trimBuffer() {
            const now = this.rrBuffer.length > 0 ? 
                this.rrBuffer[this.rrBuffer.length - 1].t : performance.now();
            const cutoff = now - this.maxBufferMs;
            
            while (this.rrBuffer.length > 0 && this.rrBuffer[0].t < cutoff) {
                this.rrBuffer.shift();
            }
        }

        // ==================== TIME DOMAIN ANALYSIS ====================

        /**
         * Calculate time-domain HRV metrics
         * @param {number} windowMs - Analysis window in milliseconds
         */
        calculateTimeDomain(windowMs = 60000) {
            const rrData = this._getValidRRs(windowMs);
            
            if (rrData.length < QUALITY_THRESHOLDS.MIN_RR_COUNT) {
                return {
                    sdnn: null,
                    rmssd: null,
                    pnn50: null,
                    meanRR: null,
                    count: rrData.length,
                    sufficient: false
                };
            }
            
            const rrs = rrData.map(r => r.rr);
            
            // Mean RR
            const meanRR = this._mean(rrs);
            
            // SDNN (Standard Deviation of RR intervals)
            const sdnn = this._std(rrs);
            
            // RMSSD (Root Mean Square of Successive Differences)
            const diffs = [];
            for (let i = 1; i < rrs.length; i++) {
                diffs.push(rrs[i] - rrs[i - 1]);
            }
            const rmssd = Math.sqrt(this._mean(diffs.map(d => d * d)));
            
            // pNN50 (Percentage of successive RR differences > 50ms)
            const nn50Count = diffs.filter(d => Math.abs(d) > 50).length;
            const pnn50 = (nn50Count / diffs.length) * 100;
            
            return {
                sdnn: Math.round(sdnn * 10) / 10,
                rmssd: Math.round(rmssd * 10) / 10,
                pnn50: Math.round(pnn50 * 10) / 10,
                meanRR: Math.round(meanRR),
                count: rrData.length,
                sufficient: true
            };
        }

        // ==================== FREQUENCY DOMAIN ANALYSIS ====================

        /**
         * Calculate frequency-domain HRV metrics using Welch's method approximation
         * Requires at least 2 minutes of data for reliable results
         * @param {number} windowMs - Analysis window (recommend 120000ms+)
         */
        calculateFrequencyDomain(windowMs = 120000) {
            const rrData = this._getValidRRs(windowMs);
            
            if (rrData.length < QUALITY_THRESHOLDS.MIN_RR_FREQ) {
                return {
                    vlf: null,
                    lf: null,
                    hf: null,
                    lfHfRatio: null,
                    totalPower: null,
                    sufficient: false
                };
            }
            
            const rrs = rrData.map(r => r.rr);
            
            // Resample to uniform 4Hz for spectral analysis
            const resampled = this._resampleRR(rrs, 4);
            
            // Detrend
            const detrended = this._detrend(resampled);
            
            // Apply Hann window
            const windowed = this._hannWindow(detrended);
            
            // Calculate power spectrum using FFT approximation
            const { frequencies, power } = this._calculatePSD(windowed, 4);
            
            // Integrate power in each band
            const vlf = this._integrateBand(frequencies, power, FREQ_BANDS.VLF);
            const lf = this._integrateBand(frequencies, power, FREQ_BANDS.LF);
            const hf = this._integrateBand(frequencies, power, FREQ_BANDS.HF);
            
            const totalPower = vlf + lf + hf;
            const lfHfRatio = hf > 0 ? lf / hf : null;
            
            return {
                vlf: Math.round(vlf),
                lf: Math.round(lf),
                hf: Math.round(hf),
                lfHfRatio: lfHfRatio ? Math.round(lfHfRatio * 100) / 100 : null,
                totalPower: Math.round(totalPower),
                sufficient: true
            };
        }

        /**
         * Resample irregular RR intervals to uniform sampling rate
         */
        _resampleRR(rrs, targetHz) {
            const totalMs = rrs.reduce((a, b) => a + b, 0);
            const nSamples = Math.floor((totalMs / 1000) * targetHz);
            const resampled = [];
            
            let cumTime = 0;
            let rrIdx = 0;
            
            for (let i = 0; i < nSamples; i++) {
                const t = (i / targetHz) * 1000;  // Target time in ms
                
                // Find surrounding RR intervals
                while (rrIdx < rrs.length - 1 && cumTime + rrs[rrIdx] < t) {
                    cumTime += rrs[rrIdx];
                    rrIdx++;
                }
                
                // Linear interpolation
                resampled.push(rrs[rrIdx]);
            }
            
            return resampled;
        }

        /**
         * Remove linear trend from signal
         */
        _detrend(signal) {
            const n = signal.length;
            const mean = this._mean(signal);
            
            // Simple linear detrend
            let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
            for (let i = 0; i < n; i++) {
                sumX += i;
                sumY += signal[i];
                sumXY += i * signal[i];
                sumX2 += i * i;
            }
            
            const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
            const intercept = (sumY - slope * sumX) / n;
            
            return signal.map((v, i) => v - (slope * i + intercept));
        }

        /**
         * Apply Hann (Hanning) window
         */
        _hannWindow(signal) {
            const n = signal.length;
            return signal.map((v, i) => {
                const w = 0.5 * (1 - Math.cos(2 * Math.PI * i / (n - 1)));
                return v * w;
            });
        }

        /**
         * Calculate Power Spectral Density using simple periodogram
         * (Simplified FFT approximation using DFT for small segments)
         */
        _calculatePSD(signal, fs) {
            const n = signal.length;
            const frequencies = [];
            const power = [];
            
            // Only calculate up to Nyquist frequency
            const maxK = Math.floor(n / 2);
            
            for (let k = 0; k <= maxK; k++) {
                const freq = (k * fs) / n;
                frequencies.push(freq);
                
                // DFT at frequency k
                let real = 0, imag = 0;
                for (let t = 0; t < n; t++) {
                    const angle = -2 * Math.PI * k * t / n;
                    real += signal[t] * Math.cos(angle);
                    imag += signal[t] * Math.sin(angle);
                }
                
                // Power = |X(k)|^2 / N
                const magnitude = Math.sqrt(real * real + imag * imag);
                power.push((magnitude * magnitude) / n);
            }
            
            return { frequencies, power };
        }

        /**
         * Integrate power within a frequency band
         */
        _integrateBand(frequencies, power, band) {
            let sum = 0;
            for (let i = 0; i < frequencies.length; i++) {
                if (frequencies[i] >= band.min && frequencies[i] < band.max) {
                    sum += power[i];
                }
            }
            return sum;
        }

        // ==================== MOTION ARTIFACT DETECTION ====================

        /**
         * Detect motion artifacts from accelerometer or signal quality
         * @param {Object} motionData - { x, y, z } accelerometer or head position
         */
        pushMotionSample(motionData) {
            const t = performance.now();
            this.motionBuffer.push({ t, ...motionData });
            
            // Trim motion buffer
            const cutoff = t - this.motionWindow;
            while (this.motionBuffer.length > 0 && this.motionBuffer[0].t < cutoff) {
                this.motionBuffer.shift();
            }
        }

        /**
         * Check if motion artifact is present
         */
        hasMotionArtifact() {
            if (this.motionBuffer.length < 5) return false;
            
            // Calculate jitter (variance of position changes)
            let totalJitter = 0;
            for (let i = 1; i < this.motionBuffer.length; i++) {
                const prev = this.motionBuffer[i - 1];
                const curr = this.motionBuffer[i];
                const dx = (curr.x || 0) - (prev.x || 0);
                const dy = (curr.y || 0) - (prev.y || 0);
                totalJitter += Math.sqrt(dx * dx + dy * dy);
            }
            
            const avgJitter = totalJitter / (this.motionBuffer.length - 1);
            return avgJitter > QUALITY_THRESHOLDS.MOTION_THRESHOLD;
        }

        // ==================== QUALITY SCORING ====================

        /**
         * Calculate overall HRV measurement quality
         */
        calculateQuality(windowMs = 60000) {
            const rrData = this._getRRsInWindow(windowMs);
            
            if (rrData.length < 10) {
                return { score: 0, reason: 'Insufficient data' };
            }
            
            let score = 1.0;
            const issues = [];
            
            // Check outlier ratio
            const outlierCount = rrData.filter(r => r.outlier).length;
            const outlierRatio = outlierCount / rrData.length;
            if (outlierRatio > QUALITY_THRESHOLDS.OUTLIER_THRESHOLD) {
                score -= 0.3;
                issues.push(`High outliers (${Math.round(outlierRatio * 100)}%)`);
            }
            
            // Check motion artifact
            if (this.hasMotionArtifact()) {
                score -= 0.2;
                issues.push('Motion detected');
            }
            
            // Check data sufficiency
            const expectedCount = (windowMs / 1000) * 1.2;  // ~1.2 beats per second average
            const coverageRatio = rrData.length / expectedCount;
            if (coverageRatio < 0.7) {
                score -= 0.2;
                issues.push('Data gaps');
            }
            
            // Check signal quality from source
            const avgQuality = this._mean(rrData.map(r => r.quality));
            if (avgQuality < 0.7) {
                score -= 0.2;
                issues.push('Low signal quality');
            }
            
            return {
                score: Math.max(0, Math.min(1, score)),
                outlierRatio,
                coverageRatio,
                avgQuality,
                motionArtifact: this.hasMotionArtifact(),
                issues,
                reason: issues.length > 0 ? issues.join(', ') : 'Good quality'
            };
        }

        // ==================== MAIN API ====================

        /**
         * Get all HRV metrics for display
         * @param {number} windowMs - Analysis window
         */
        getMetrics(windowMs = 60000) {
            this.syncFromRPPG();
            
            const timeDomain = this.calculateTimeDomain(windowMs);
            const freqDomain = this.calculateFrequencyDomain(Math.max(windowMs, 120000));
            const quality = this.calculateQuality(windowMs);
            
            this.metrics = {
                // Time Domain
                sdnn: timeDomain.sdnn,
                rmssd: timeDomain.rmssd,
                pnn50: timeDomain.pnn50,
                meanRR: timeDomain.meanRR,
                
                // Frequency Domain
                vlf: freqDomain.vlf,
                lf: freqDomain.lf,
                hf: freqDomain.hf,
                lfHfRatio: freqDomain.lfHfRatio,
                totalPower: freqDomain.totalPower,
                
                // Quality
                quality: quality.score,
                outlierRatio: quality.outlierRatio,
                motionArtifact: quality.motionArtifact,
                rrCount: this.rrBuffer.length,
                validRRCount: timeDomain.count,
                
                // Flags
                timeDomainReady: timeDomain.sufficient,
                freqDomainReady: freqDomain.sufficient,
                lastUpdate: performance.now()
            };
            
            return this.metrics;
        }

        /**
         * Get HRV interpretation for display
         */
        getInterpretation() {
            const m = this.metrics;
            
            if (!m.timeDomainReady) {
                return {
                    level: 'pending',
                    message: `Collecting data... (${m.validRRCount}/${QUALITY_THRESHOLDS.MIN_RR_COUNT})`,
                    icon: '⏳'
                };
            }
            
            // RMSSD interpretation (parasympathetic activity)
            let parasympathetic = 'normal';
            if (m.rmssd < 20) parasympathetic = 'low';
            else if (m.rmssd > 60) parasympathetic = 'high';
            
            // LF/HF interpretation (autonomic balance)
            let balance = 'balanced';
            if (m.lfHfRatio !== null) {
                if (m.lfHfRatio > 2.5) balance = 'sympathetic-dominant';
                else if (m.lfHfRatio < 0.5) balance = 'parasympathetic-dominant';
            }
            
            // Overall interpretation
            let message = '';
            let icon = '💚';
            
            if (m.rmssd < 20 && m.lfHfRatio > 2.0) {
                message = 'Elevated stress response detected';
                icon = 'error';
            } else if (m.rmssd > 50 && m.lfHfRatio < 1.5) {
                message = 'Good recovery / relaxation state';
                icon = '💚';
            } else if (m.rmssd >= 20 && m.rmssd <= 50) {
                message = 'Normal autonomic activity';
                icon = '💛';
            } else {
                message = 'Monitoring...';
                icon = '💙';
            }
            
            return {
                level: parasympathetic,
                balance,
                message,
                icon,
                details: {
                    sdnn: `SDNN: ${m.sdnn}ms (overall variability)`,
                    rmssd: `RMSSD: ${m.rmssd}ms (parasympathetic tone)`,
                    lfHf: m.lfHfRatio ? `LF/HF: ${m.lfHfRatio} (autonomic balance)` : 'LF/HF: Collecting...'
                }
            };
        }

        // ==================== UTILITY METHODS ====================

        _getValidRRs(windowMs) {
            const rrData = this._getRRsInWindow(windowMs);
            return rrData.filter(r => !r.outlier);
        }

        _getRRsInWindow(windowMs) {
            if (this.rrBuffer.length === 0) return [];
            const now = this.rrBuffer[this.rrBuffer.length - 1].t;
            const cutoff = now - windowMs;
            return this.rrBuffer.filter(r => r.t >= cutoff);
        }

        _mean(arr) {
            if (arr.length === 0) return 0;
            return arr.reduce((a, b) => a + b, 0) / arr.length;
        }

        _std(arr) {
            if (arr.length < 2) return 0;
            const mean = this._mean(arr);
            const variance = this._mean(arr.map(x => (x - mean) * (x - mean)));
            return Math.sqrt(variance);
        }

        /**
         * Reset all buffers and metrics
         */
        reset() {
            this.rrBuffer = [];
            this.motionBuffer = [];
            this.metrics = {
                sdnn: null, rmssd: null, pnn50: null, meanRR: null,
                vlf: null, lf: null, hf: null, lfHfRatio: null, totalPower: null,
                quality: 0, outlierRatio: 0, motionArtifact: false,
                rrCount: 0, validRRCount: 0, lastUpdate: 0
            };
            console.log('[HRV-ADV] Reset complete');
        }

        // ==================== TEST UTILITIES ====================

        /**
         * Test SDNN calculation with known data
         */
        static testSDNN(rrArray) {
            const mean = rrArray.reduce((a, b) => a + b, 0) / rrArray.length;
            const variance = rrArray.map(x => (x - mean) * (x - mean))
                .reduce((a, b) => a + b, 0) / rrArray.length;
            return Math.sqrt(variance);
        }

        /**
         * Generate synthetic RR data for testing
         */
        static generateTestRRs(count = 100, meanRR = 800, sdnn = 50) {
            const rrs = [];
            for (let i = 0; i < count; i++) {
                // Box-Muller transform for normal distribution
                const u1 = Math.random();
                const u2 = Math.random();
                const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
                rrs.push(Math.max(300, Math.min(1500, meanRR + z * sdnn)));
            }
            return rrs;
        }
    }

    // ==================== EXPORT ====================

    window.TENKI_HRV_ADVANCED = {
        create(rppgController) { 
            return new HRVAdvanced(rppgController); 
        },
        HRVAdvanced,
        FREQ_BANDS,
        RR_LIMITS,
        QUALITY_THRESHOLDS,
        // Test utilities
        testSDNN: HRVAdvanced.testSDNN,
        generateTestRRs: HRVAdvanced.generateTestRRs
    };

    console.log('[HRV-ADV] Module loaded ✓');
})();
