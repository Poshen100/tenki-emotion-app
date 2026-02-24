/**
 * TENKI Neural Link v53 - TEI + ANS Engine (JavaScript Port)
 * Self-contained, offline, browser-compatible.
 */

const TenkiEngine = {
    // Constants
    BASE_QUALITY: {
        chest_strap: 1.00, garmin_sleep: 0.95, oura_sleep: 0.92,
        finger_anchor: 0.88, finger_ppg: 0.88, apple_watch: 0.75, face_rppg: 0.60
    },

    // Cold-start baseline from medical literature (Shaffer & Ginsberg 2017)
    // Used when personal history is insufficient for percentile calculation
    COLD_START_BASELINE: {
        hrvU: { mean: 3.74, std: 0.45 },      // ln(RMSSD), ~42ms mean
        hr: { mean: 70, std: 12 },             // resting HR
        rr: { mean: 15, std: 3 },              // respiratory rate
        sq: { mean: 70, std: 15 },             // signal quality score
        tei: { mean: 60, std: 18 }             // TEI population estimate
    },

    GRADE_WEIGHTS: {
        A: { hrv: 0.45, hr: 0.20, rr: 0.20, sq: 0.15 },
        B: { hrv: 0.30, hr: 0.25, rr: 0.20, sq: 0.25 },
        C: { hrv: 0.00, hr: 0.40, rr: 0.25, sq: 0.35 }
    },

    // State
    baselines: {},
    anchorTimeUtc: null,
    faceMappingBiasU: 0.0,
    hrvUHistory: [], hrHistory: [], rrHistory: [], sqHistory: [], teiHistory: [],
    sessionLogs: [], tradeLogs: [],
    learned: {
        deviceCalibration: {}, deviceBiasU: {},
        sqsPenaltyWeights: { light: 1.0, motion: 1.0, roi: 1.0, fps: 1.0, high_hr: 1.0 },
        teiWeightAdjustments: { hrv_pr: 1.0, hr_pr: 1.0, rr_pr: 1.0, sq_pr: 1.0 },
        timeOfDayProfiles: {}, highQualityScansCount: 0
    },
    garminNNights: 0,
    _cap: 500,

    // Utils
    clamp: (x, lo, hi) => Math.max(lo, Math.min(hi, x)),
    sigmoid: (x) => x >= 0 ? 1 / (1 + Math.exp(-x)) : Math.exp(x) / (1 + Math.exp(x)),
    safeLnMs: (ms) => (ms && ms > 0) ? Math.log(ms) : null,
    ema: (old, val, alpha) => (1 - alpha) * old + alpha * val,

    // Enhanced percentileRank with cold-start support
    // coldStartRef: { mean, std } - population baseline for estimation when history is insufficient
    percentileRank(value, history, coldStartRef = null) {
        if (value == null) return 50;

        // If insufficient history, use cold-start estimation
        if (history.length < 5) {
            if (coldStartRef && coldStartRef.mean != null && coldStartRef.std > 0) {
                // Z-score based estimation using population baseline
                const z = (value - coldStartRef.mean) / coldStartRef.std;
                // Standard normal CDF approximation (Bowling et al. 2009)
                const t = 1 / (1 + 0.2316419 * Math.abs(z));
                const d = 0.3989423 * Math.exp(-z * z / 2);
                const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
                const cdf = z > 0 ? 1 - p : p;
                return Math.floor(this.clamp(cdf * 100, 1, 99));
            }
            // True cold start: use simple linear estimation within reasonable bounds
            if (history.length >= 2) {
                const lo = Math.min(...history), hi = Math.max(...history);
                if (hi > lo) {
                    return Math.floor(this.clamp((value - lo) / (hi - lo) * 80 + 10, 10, 90));
                }
            }
            return 50; // Ultimate fallback
        }

        // Standard percentile calculation with sufficient history
        const lo = Math.min(...history), hi = Math.max(...history);
        if (lo === hi) return 50;
        let less = 0, equal = 0;
        for (const v of history) {
            if (v < value) less++;
            else if (v === value) equal++;
        }
        return Math.floor(this.clamp((less + 0.5 * equal) / history.length * 100, 1, 99));
    },

    welfordUpdate(n, mean, m2, x) {
        const nNew = n + 1;
        const delta = x - mean;
        const meanNew = mean + delta / nNew;
        const delta2 = x - meanNew;
        const m2New = m2 + delta * delta2;
        return { n: nNew, mean: meanNew, m2: m2New };
    },

    appendHistory(arr, x) {
        if (x == null) return;
        arr.push(x);
        if (arr.length > this._cap) arr.shift();
    },

    applyDeviceCalibration(deviceType, valueMs) {
        const scale = this.learned.deviceCalibration[deviceType] || 1.0;
        return valueMs * scale;
    },

    // Baseline fusion
    getFusedBaseline(nowUtc = Date.now(), lotScore = 1.0) {
        lotScore = this.clamp(lotScore, 0, 1);
        if (!this.anchorTimeUtc && !this.baselines.finger_anchor) {
            return { ok: true, meanU: null, stdU: null, confidence: 0, sources: [] };
        }

        let sumW = 0, sumWMean = 0, sumWM2 = 0;
        const sources = [];

        for (const [srcType, src] of Object.entries(this.baselines)) {
            let wQuality = this.BASE_QUALITY[srcType] || 0.75;
            if (srcType === 'face_rppg') wQuality *= lotScore;

            const daysSince = Math.max(0, (nowUtc - src.lastUpdate) / 86400000);
            const wRecency = Math.exp(-daysSince / 7);
            const wTotal = wQuality * wRecency;
            if (wTotal <= 0) continue;

            sumW += wTotal;
            sumWMean += wTotal * src.meanU;
            sumWM2 += wTotal * (src.stdU ** 2 + src.meanU ** 2);
            sources.push({ sourceType: srcType, wTotal, daysSince });
        }

        if (sumW <= 1e-9) {
            if (this.baselines.finger_anchor) {
                const a = this.baselines.finger_anchor;
                return { ok: true, meanU: a.meanU, stdU: Math.max(0.15, a.stdU), confidence: 0.2, sources };
            }
            return { ok: true, meanU: null, stdU: null, confidence: 0, sources };
        }

        const meanU = sumWMean / sumW;
        const ex2 = sumWM2 / sumW;
        const stdU = Math.sqrt(Math.max(ex2 - meanU ** 2, 1e-6));
        const confidence = this.clamp(sumW / 0.95, 0, 1);

        return { ok: true, meanU, stdU, confidence, sources };
    },

    // TEI computation
    computeTEI(sqGrade, hrPr, rrPr, sqPr, hrvPr, hrvEnabled, fusedMeanU, fusedStdU, currentHrvU, currentHrvMs, lfHfRatio) {
        if (!['A', 'B', 'C'].includes(sqGrade)) return { teiAvailable: false };

        const w = { ...this.GRADE_WEIGHTS[sqGrade] || this.GRADE_WEIGHTS.C };
        const adj = this.learned.teiWeightAdjustments;
        w.hrv *= this.clamp(adj.hrv_pr || 1, 0.8, 1.2);
        w.hr *= this.clamp(adj.hr_pr || 1, 0.8, 1.2);
        w.rr *= this.clamp(adj.rr_pr || 1, 0.8, 1.2);
        w.sq *= this.clamp(adj.sq_pr || 1, 0.8, 1.2);

        if (!hrvEnabled) w.hrv = 0;

        const sState = Math.max(w.hrv + w.hr + w.rr, 1e-9);
        const nHrv = this.clamp(hrvPr / 99, 0, 1);
        const nHr = this.clamp(hrPr / 99, 0, 1);
        const nRr = this.clamp(rrPr / 99, 0, 1);
        const nSq = this.clamp(sqPr / 99, 0, 1);

        const state = (w.hrv * nHrv + w.hr * nHr + w.rr * nRr) / sState;
        const penalty = this.clamp(0.6 * Math.pow(1 - nSq, 1.5), 0, 0.6);
        const tei = this.clamp(100 * state * (1 - w.sq * penalty), 0, 100);

        // Cognitive breakdown
        let zHrv = 0;
        if (currentHrvU != null && fusedMeanU != null && fusedStdU > 1e-6) {
            zHrv = (currentHrvU - fusedMeanU) / fusedStdU;
        }

        const meanMs = fusedMeanU != null ? Math.exp(fusedMeanU) : (currentHrvMs || 60);
        const stdMs = fusedStdU > 0 ? (Math.exp(fusedStdU) - 1) * meanMs : 10;
        const curMs = currentHrvMs || (currentHrvU != null ? Math.exp(currentHrvU) : meanMs);

        const PFC = 100 * this.sigmoid(1.5 * zHrv - 0.5);
        const riskThreshold = meanMs - 0.5 * stdMs;
        let risk = curMs >= riskThreshold ? 100 * (curMs / Math.max(meanMs, 1e-6)) : 50 * (curMs / Math.max(riskThreshold, 1e-6));
        risk = this.clamp(risk, 0, 100);

        let emotion = lfHfRatio > 0 ? 100 / (1 + lfHfRatio) : 75 * (curMs / Math.max(meanMs, 1e-6));
        emotion = this.clamp(emotion, 0, 100);

        const consistency = 100 * Math.exp(-0.5 * Math.abs(zHrv));

        return { teiAvailable: true, tei, zHrv, PFC, risk, emotion, consistency: this.clamp(consistency, 0, 100) };
    },

    zoneAndReco(teiPr) {
        teiPr = this.clamp(teiPr, 0, 99);
        if (teiPr >= 80) return { zone: 'PEAK', mult: 1.1, note: '高表現區，但注意過度自信；嚴守風控。' };
        if (teiPr >= 55) return { zone: 'OPTIMAL', mult: 1.0, note: '標準倉位，策略可正常運行。' };
        if (teiPr >= 35) return { zone: 'NEUTRAL', mult: 0.7, note: '降低倉位，挑高勝率 setup，避免追價。' };
        return { zone: 'DEGRADED', mult: 0.0, note: '建議不交易；先做呼吸/恢復，等待狀態回升。' };
    },

    // Calibration
    calibrateFingerPPG(scan) {
        const t = scan.timeUtc || Date.now();
        const duration = scan.durationS || 0;
        const sqs = scan.sqs || {};
        const sqGrade = (sqs.grade || 'D').toUpperCase();
        const metrics = scan.metrics || {};
        const hr = metrics.hrBpm || 0;
        const hrvMs = metrics.hrvRmssdMs || metrics.hrvMs;

        if (duration < 60) return { ok: false, error: 'duration_too_short' };
        if (!['A', 'B'].includes(sqGrade)) return { ok: false, error: 'sqs_not_good' };
        if (hr < 45 || hr > 90) return { ok: false, error: 'hr_out_of_range' };
        if (!hrvMs || hrvMs <= 0) return { ok: false, error: 'invalid_hrv' };

        const hrvMsCorr = this.applyDeviceCalibration('finger_ppg', hrvMs);
        const u = this.safeLnMs(hrvMsCorr);
        if (u == null) return { ok: false, error: 'invalid_hrv' };

        if (!this.anchorTimeUtc) this.anchorTimeUtc = t;

        this.baselines.finger_anchor = {
            sourceType: 'finger_anchor', meanU: u, stdU: 0.15,
            lastUpdate: t, qualityWeight: 0.88, nSamples: 1, m2U: 0
        };

        this.appendHistory(this.hrHistory, hr);
        this.appendHistory(this.hrvUHistory, u);
        this.appendHistory(this.sqHistory, sqs.total || 0);

        return { ok: true, anchorSet: true, fingerAnchorHrvMs: hrvMsCorr, fingerAnchorHrvU: u };
    },

    calibrateFaceRPPG(scan) {
        if (!this.baselines.finger_anchor) return { ok: false, error: 'missing_finger_anchor' };

        const t = scan.timeUtc || Date.now();
        const sqs = scan.sqs || {};
        const sqGrade = (sqs.grade || 'D').toUpperCase();
        const metrics = scan.metrics || {};
        const hr = metrics.hrBpm || 0;
        const hrvMs = metrics.hrvRmssdMs || metrics.hrvMs;
        const lotScore = this.clamp(scan.lotScore || 1, 0, 1);

        if (!['A', 'B'].includes(sqGrade)) return { ok: false, error: 'sqs_not_good' };
        if (hr >= 90) return { ok: false, error: 'hr_too_high' };
        if (!hrvMs || hrvMs <= 0) return { ok: false, error: 'invalid_hrv' };

        const hrvMsCorr = this.applyDeviceCalibration('face_rppg', hrvMs);
        const faceU = this.safeLnMs(hrvMsCorr);
        if (faceU == null) return { ok: false, error: 'invalid_hrv' };

        const anchorU = this.baselines.finger_anchor.meanU;
        this.faceMappingBiasU = anchorU - faceU;
        this.learned.deviceBiasU.face_rppg = this.ema(this.learned.deviceBiasU.face_rppg || 0, this.faceMappingBiasU, 0.25);

        const correctedU = faceU + this.faceMappingBiasU;
        this.baselines.face_rppg = {
            sourceType: 'face_rppg', meanU: correctedU, stdU: 0.20,
            lastUpdate: t, qualityWeight: 0.60 * lotScore, nSamples: 1, m2U: 0
        };

        this.appendHistory(this.hrHistory, hr);
        this.appendHistory(this.hrvUHistory, correctedU);
        this.appendHistory(this.sqHistory, sqs.total || 0);

        return { ok: true, faceMappingBiasU: this.faceMappingBiasU, lotScore };
    },

    // Daily scan ingestion
    ingestDailyScan(scan) {
        const t = scan.timeUtc || Date.now();
        const deviceType = scan.deviceType || 'face_rppg';
        const sqs = scan.sqs || {};
        const sqTotal = sqs.total || 0;
        const sqGrade = (sqs.grade || 'D').toUpperCase();
        const metrics = scan.metrics || {};
        const hr = metrics.hrBpm || 0;
        const rr = metrics.rrBrpm;
        const lfHfRatio = metrics.lfHfRatio;
        const lotScore = this.clamp(scan.lotScore || 1, 0, 1);

        if (sqGrade === 'D') return { ok: false, error: 'sqs_grade_D' };

        let hrvMs = metrics.hrvRmssdMs || metrics.hrvSdnnMs || metrics.hrvMs;
        const hrvValidForUse = ['A', 'B'].includes(sqGrade);
        const hrvValidForUpdate = hrvValidForUse && hr < 90;

        let hrvMsCorr = null, hrvU = null;
        if (hrvMs != null && hrvMs > 0) {
            hrvMsCorr = this.applyDeviceCalibration(deviceType, hrvMs);
            hrvU = this.safeLnMs(hrvMsCorr);
            if (hrvU != null) {
                hrvU += this.learned.deviceBiasU[deviceType] || 0;
                if (deviceType === 'face_rppg') hrvU += this.faceMappingBiasU;
            }
        }

        // Update baseline if eligible
        if (hrvU != null && hrvValidForUpdate) {
            this._updateSourceBaseline(deviceType, hrvU, t, lotScore);
        }

        const fused = this.getFusedBaseline(t, lotScore);

        // Build PRs with cold-start baseline support (before appending to history)
        let hrvPr = null;
        if (hrvU != null && hrvValidForUse) {
            hrvPr = this.percentileRank(hrvU, this.hrvUHistory, this.COLD_START_BASELINE.hrvU);
        }
        // For HR: lower is better, so invert the percentile
        const hrPr = 99 - this.percentileRank(hr, this.hrHistory, this.COLD_START_BASELINE.hr);
        // For RR: lower is generally calmer
        const rrPr = rr != null ? 99 - this.percentileRank(rr, this.rrHistory, this.COLD_START_BASELINE.rr) : 50;
        const sqPr = this.percentileRank(sqTotal, this.sqHistory, this.COLD_START_BASELINE.sq);

        // Append histories
        this.appendHistory(this.hrHistory, hr);
        this.appendHistory(this.sqHistory, sqTotal);
        if (rr != null) this.appendHistory(this.rrHistory, rr);
        if (hrvU != null && hrvValidForUse) this.appendHistory(this.hrvUHistory, hrvU);

        // Compute TEI
        const teiResult = this.computeTEI(
            sqGrade, hrPr, rrPr, sqPr, hrvPr || 50,
            hrvValidForUse && hrvPr != null,
            fused.meanU, fused.stdU, hrvU, hrvMsCorr, lfHfRatio
        );

        let teiPr = null;
        if (teiResult.teiAvailable) {
            teiPr = this.percentileRank(teiResult.tei, this.teiHistory);
            this.appendHistory(this.teiHistory, teiResult.tei);
        }

        const zoneInfo = this.zoneAndReco(teiPr || 50);

        return {
            ok: true, teiAvailable: teiResult.teiAvailable, deviceType,
            sqs: { total: sqTotal, grade: sqGrade },
            prs: { HRV_PR: hrvPr, HR_PR: hrPr, RR_PR: rrPr, SQ_PR: sqPr, TEI_PR: teiPr },
            tei: teiResult, ...zoneInfo
        };
    },

    _updateSourceBaseline(deviceType, hrvU, t, lotScore) {
        const srcType = deviceType === 'finger_ppg' ? 'finger_ppg' : deviceType;
        let baseQ = this.BASE_QUALITY[srcType] || 0.75;
        if (srcType === 'face_rppg') baseQ *= this.clamp(lotScore, 0, 1);

        if (!this.baselines[srcType]) {
            this.baselines[srcType] = {
                sourceType: srcType, meanU: hrvU, stdU: srcType === 'face_rppg' ? 0.20 : 0.15,
                lastUpdate: t, qualityWeight: baseQ, nSamples: 1, m2U: 0
            };
        } else {
            const src = this.baselines[srcType];
            const updated = this.welfordUpdate(src.nSamples, src.meanU, src.m2U, hrvU);
            src.nSamples = updated.n;
            src.meanU = updated.mean;
            src.m2U = updated.m2;
            if (updated.n >= 2) src.stdU = Math.sqrt(Math.max(updated.m2 / (updated.n - 1), 1e-6));
            src.lastUpdate = t;
            src.qualityWeight = baseQ;
        }
    },

    // ==================== CONTINUOUS LEARNING SYSTEM ====================

    // Trigger adaptive learning every N high-quality scans
    _checkLearningTrigger() {
        this.learned.highQualityScansCount++;
        if (this.learned.highQualityScansCount % 10 === 0) {
            this._adaptiveLearningUpdate();
        }
    },

    _adaptiveLearningUpdate() {
        console.log('[TenkiEngine] Running adaptive learning update...');
        this._learnDeviceCalibration();
        this._learnTimeOfDayPatterns();
        this._optimizeSqsWeights();
        // Note: TEI weight personalization requires trade logs
        if (this.tradeLogs.length >= 10) {
            this._personalizeTeiWeights();
        }
    },

    // Learn device-specific calibration coefficients
    _learnDeviceCalibration() {
        // Compare same-day measurements across devices
        const byDate = {};
        for (const log of this.sessionLogs) {
            const dateKey = new Date(log.timeUtc).toDateString();
            if (!byDate[dateKey]) byDate[dateKey] = {};
            if (!byDate[dateKey][log.deviceType]) byDate[dateKey][log.deviceType] = [];
            if (log.hrvU != null) byDate[dateKey][log.deviceType].push(log.hrvU);
        }

        // Calculate device biases relative to finger_ppg anchor
        for (const [date, devices] of Object.entries(byDate)) {
            if (!devices.finger_ppg || devices.finger_ppg.length === 0) continue;
            const anchorMean = devices.finger_ppg.reduce((a, b) => a + b, 0) / devices.finger_ppg.length;

            for (const [device, values] of Object.entries(devices)) {
                if (device === 'finger_ppg' || values.length === 0) continue;
                const deviceMean = values.reduce((a, b) => a + b, 0) / values.length;
                const bias = anchorMean - deviceMean;

                // EMA update of device bias
                const oldBias = this.learned.deviceBiasU[device] || 0;
                this.learned.deviceBiasU[device] = this.ema(oldBias, bias, 0.2);
            }
        }
    },

    // Learn time-of-day HRV patterns (circadian rhythm)
    _learnTimeOfDayPatterns() {
        const now = Date.now();
        const cutoff = now - 14 * 86400000; // Last 14 days
        const recent = this.sessionLogs.filter(s => s.timeUtc >= cutoff && s.hrvU != null);

        const periods = { morning: [], afternoon: [], evening: [], night: [] };
        for (const s of recent) {
            const hour = new Date(s.timeUtc).getHours();
            let period;
            if (hour >= 5 && hour < 12) period = 'morning';
            else if (hour >= 12 && hour < 17) period = 'afternoon';
            else if (hour >= 17 && hour < 21) period = 'evening';
            else period = 'night';
            periods[period].push(s.hrvU);
        }

        for (const [period, values] of Object.entries(periods)) {
            if (values.length >= 3) {
                const mean = values.reduce((a, b) => a + b, 0) / values.length;
                const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
                this.learned.timeOfDayProfiles[period] = {
                    mean, std: Math.sqrt(variance), n: values.length
                };
            }
        }
    },

    // Optimize SQS penalty weights based on HRV variance
    _optimizeSqsWeights() {
        // Analyze which SQS factors most affect HRV reliability
        const highSq = this.sessionLogs.filter(s => s.sqTotal >= 80 && s.hrvU != null);
        const lowSq = this.sessionLogs.filter(s => s.sqTotal < 60 && s.hrvU != null);

        if (highSq.length < 5 || lowSq.length < 5) return;

        const highVar = this._variance(highSq.map(s => s.hrvU));
        const lowVar = this._variance(lowSq.map(s => s.hrvU));

        // If low SQ has much higher variance, increase penalty
        if (lowVar > highVar * 1.5) {
            const adjustment = Math.min(1.3, lowVar / Math.max(highVar, 0.01));
            for (const key of Object.keys(this.learned.sqsPenaltyWeights)) {
                this.learned.sqsPenaltyWeights[key] *= this.clamp(adjustment, 0.9, 1.1);
            }
        }
    },

    // Personalize TEI weights based on trading outcomes
    _personalizeTeiWeights() {
        const goodTrades = this.tradeLogs.filter(t => t.pnlRatio > 0);
        const badTrades = this.tradeLogs.filter(t => t.pnlRatio <= 0);

        if (goodTrades.length < 5 || badTrades.length < 5) return;

        // Compare PRs between good and bad trades
        const prKeys = ['HRV_PR', 'HR_PR', 'RR_PR', 'SQ_PR'];
        for (const key of prKeys) {
            const goodMean = this._mean(goodTrades.map(t => t.prs?.[key]).filter(v => v != null));
            const badMean = this._mean(badTrades.map(t => t.prs?.[key]).filter(v => v != null));

            if (goodMean != null && badMean != null) {
                // If this PR is higher in good trades, increase its weight
                const delta = (goodMean - badMean) / 50; // Normalize to ±0.5 range
                const weightKey = key.toLowerCase().replace('_pr', '_pr');
                const oldWeight = this.learned.teiWeightAdjustments[weightKey] || 1.0;
                this.learned.teiWeightAdjustments[weightKey] = this.clamp(
                    this.ema(oldWeight, 1 + delta * 0.2, 0.3),
                    0.8, 1.2
                );
            }
        }
    },

    _variance(arr) {
        if (arr.length < 2) return 0;
        const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
        return arr.reduce((a, b) => a + (b - mean) ** 2, 0) / (arr.length - 1);
    },

    _mean(arr) {
        if (!arr || arr.length === 0) return null;
        return arr.reduce((a, b) => a + b, 0) / arr.length;
    },

    // ==================== USER CONTROL & INSIGHTS ====================

    // Get learning status for UI display
    getLearningStatus() {
        return {
            totalScans: this.learned.highQualityScansCount,
            deviceCalibrations: Object.keys(this.learned.deviceCalibration).length,
            timePatterns: Object.keys(this.learned.timeOfDayProfiles).length,
            personalizationLevel: this._calculatePersonalizationLevel(),
            nextLearningIn: 10 - (this.learned.highQualityScansCount % 10)
        };
    },

    _calculatePersonalizationLevel() {
        let score = 0;
        // Each learned component adds to personalization
        if (Object.keys(this.learned.deviceBiasU).length > 0) score += 20;
        if (Object.keys(this.learned.timeOfDayProfiles).length >= 2) score += 20;
        if (this.hrvUHistory.length >= 20) score += 20;
        if (this.sessionLogs.length >= 10) score += 20;
        if (this.tradeLogs.length >= 5) score += 20;
        return Math.min(100, score);
    },

    // Get personalized insights
    getInsights() {
        const insights = [];

        // Time-of-day insight
        const profiles = this.learned.timeOfDayProfiles;
        if (profiles.morning && profiles.afternoon) {
            const diff = ((profiles.morning.mean - profiles.afternoon.mean) / profiles.morning.mean) * 100;
            if (Math.abs(diff) > 10) {
                insights.push({
                    type: 'circadian',
                    message: diff > 0
                        ? `您的晨間 HRV 比下午高 ${Math.abs(diff).toFixed(0)}%，建議重要決策安排在早上`
                        : `您的下午 HRV 比早上高 ${Math.abs(diff).toFixed(0)}%，下午狀態較佳`,
                    confidence: Math.min(profiles.morning.n, profiles.afternoon.n) / 10
                });
            }
        }

        // Trend insight
        if (this.hrvUHistory.length >= 14) {
            const recent7 = this.hrvUHistory.slice(-7);
            const prev7 = this.hrvUHistory.slice(-14, -7);
            const recentMean = this._mean(recent7);
            const prevMean = this._mean(prev7);
            const change = ((recentMean - prevMean) / prevMean) * 100;

            if (Math.abs(change) > 5) {
                insights.push({
                    type: 'trend',
                    message: change > 0
                        ? `過去 7 天 HRV 上升 ${change.toFixed(0)}%，恢復狀態良好`
                        : `過去 7 天 HRV 下降 ${Math.abs(change).toFixed(0)}%，注意休息和恢復`,
                    confidence: 0.7
                });
            }
        }

        return insights;
    },

    // Log a session for future learning
    logSession(scanResult, additionalData = {}) {
        const entry = {
            timeUtc: Date.now(),
            deviceType: scanResult.deviceType,
            hrvU: scanResult.tei?.zHrv != null ? this.hrvUHistory[this.hrvUHistory.length - 1] : null,
            hr: additionalData.hr || 0,
            tei: scanResult.tei?.tei,
            sqTotal: scanResult.sqs?.total,
            prs: scanResult.prs
        };
        this.sessionLogs.push(entry);
        if (this.sessionLogs.length > 500) this.sessionLogs.shift();

        // Trigger learning check
        if (scanResult.sqs?.grade === 'A' || scanResult.sqs?.grade === 'B') {
            this._checkLearningTrigger();
        }
    },

    // Log a trade for performance correlation
    logTrade(tradeData) {
        const entry = {
            timeUtc: Date.now(),
            pnlRatio: tradeData.pnlRatio || 0,
            prs: { ...tradeData.priorPrs },
            tei: tradeData.priorTei
        };
        this.tradeLogs.push(entry);
        if (this.tradeLogs.length > 200) this.tradeLogs.shift();
    },

    // Export learned parameters (for persistence)
    exportLearned() {
        return JSON.stringify({
            learned: this.learned,
            baselines: this.baselines,
            faceMappingBiasU: this.faceMappingBiasU,
            anchorTimeUtc: this.anchorTimeUtc,
            hrvUHistory: this.hrvUHistory.slice(-100),
            hrHistory: this.hrHistory.slice(-100),
            sessionLogs: this.sessionLogs.slice(-100)
        });
    },

    // Import learned parameters (for persistence)
    importLearned(json) {
        try {
            const data = JSON.parse(json);
            if (data.learned) this.learned = { ...this.learned, ...data.learned };
            if (data.baselines) this.baselines = data.baselines;
            if (data.faceMappingBiasU != null) this.faceMappingBiasU = data.faceMappingBiasU;
            if (data.anchorTimeUtc != null) this.anchorTimeUtc = data.anchorTimeUtc;
            if (data.hrvUHistory) this.hrvUHistory = data.hrvUHistory;
            if (data.hrHistory) this.hrHistory = data.hrHistory;
            if (data.sessionLogs) this.sessionLogs = data.sessionLogs;
            return { ok: true };
        } catch (e) {
            return { ok: false, error: e.message };
        }
    },

    // Reset
    reset() {
        this.baselines = {};
        this.anchorTimeUtc = null;
        this.faceMappingBiasU = 0;
        this.hrvUHistory = []; this.hrHistory = []; this.rrHistory = [];
        this.sqHistory = []; this.teiHistory = [];
        this.sessionLogs = []; this.tradeLogs = [];
        this.garminNNights = 0;
        // Note: We intentionally keep 'learned' to preserve personalization
    },

    // Full reset including learned parameters
    fullReset() {
        this.reset();
        this.learned = {
            deviceCalibration: {}, deviceBiasU: {},
            sqsPenaltyWeights: { light: 1.0, motion: 1.0, roi: 1.0, fps: 1.0, high_hr: 1.0 },
            teiWeightAdjustments: { hrv_pr: 1.0, hr_pr: 1.0, rr_pr: 1.0, sq_pr: 1.0 },
            timeOfDayProfiles: {}, highQualityScansCount: 0
        };
    },

    // ==================== WAVEFORM DATA STREAM ====================
    _waveformInterval: null,

    /**
     * Start pushing 200ms waveform data for the Snapshot UI
     * @param {Object} baseMetrics - Base metrics to simulate around { hr, hrv_ms, quality }
     */
    startWaveformStream(baseMetrics = { hr: 72, hrv_ms: 45, quality: 1.0 }) {
        this.stopWaveformStream();
        let ts = Date.now();

        this._waveformInterval = setInterval(() => {
            ts += 200;
            // Generate minor variance around base metrics
            const hr = baseMetrics.hr + (Math.random() * 2 - 1);
            const hrv = baseMetrics.hrv_ms + (Math.random() * 4 - 2);

            const sample = {
                v: 1,
                ts: ts,
                hr_bpm: hr,
                hrv_ms: Math.max(10, hrv),
                quality: baseMetrics.quality
            };

            // Dispatch via EventBridgeV2 if available
            if (typeof window !== 'undefined' && window.EventBridgeV2) {
                window.EventBridgeV2.emit('root', 'tenki:sensor-sample', sample);
            }
        }, 200);
    },

    stopWaveformStream() {
        if (this._waveformInterval) {
            clearInterval(this._waveformInterval);
            this._waveformInterval = null;
        }
    }
};

// Export for use in app.js
if (typeof window !== 'undefined') window.TenkiEngine = TenkiEngine;
