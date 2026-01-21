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

    percentileRank(value, history) {
        if (value == null || history.length < 5) return 50;
        const lo = Math.min(...history), hi = Math.max(...history);
        if (lo === hi) return 50;
        let less = 0, equal = 0;
        for (const v of history) {
            if (v < value) less++;
            else if (v === value) equal++;
        }
        return Math.floor(this.clamp((less + 0.5 * equal) / history.length * 100, 0, 99));
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

        // Build PRs (before appending to history)
        let hrvPr = null;
        if (hrvU != null && hrvValidForUse) {
            hrvPr = this.percentileRank(hrvU, this.hrvUHistory);
        }
        const hrPr = 99 - this.percentileRank(hr, this.hrHistory);
        const rrPr = rr != null ? 99 - this.percentileRank(rr, this.rrHistory) : 50;
        const sqPr = this.percentileRank(sqTotal, this.sqHistory);

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

    // ANS Health Assessment
    assessANSHealth(nowUtc = Date.now()) {
        const cutoff14 = nowUtc - 14 * 86400000;
        const cutoff7 = nowUtc - 7 * 86400000;

        const sessions = this.sessionLogs.filter(s => s.timeUtc >= cutoff14);
        const last7 = sessions.filter(s => s.timeUtc >= cutoff7);

        const teiLast7 = last7.filter(s => s.tei != null).map(s => s.tei);
        const daysTeiLt40 = teiLast7.filter(v => v < 40).length;

        const hrLast7 = last7.filter(s => s.hr > 0).map(s => s.hr);
        const meanHrLast7 = hrLast7.length ? hrLast7.reduce((a, b) => a + b, 0) / hrLast7.length : null;

        const flags = {
            HRV_DECLINING_TREND: false,
            HIGH_HRV_VARIABILITY: false,
            CHRONIC_LOW_HRV: false,
            ELEVATED_RESTING_HR: false,
            PERSISTENT_LOW_TEI: daysTeiLt40 >= 4,
            LOW_SLEEP_HRV: false
        };

        const penalties = {
            HRV_DECLINING_TREND: 20, HIGH_HRV_VARIABILITY: 15, CHRONIC_LOW_HRV: 25,
            ELEVATED_RESTING_HR: 15, PERSISTENT_LOW_TEI: 10, LOW_SLEEP_HRV: 15
        };

        let totalPen = 0;
        for (const [k, v] of Object.entries(flags)) {
            if (v) totalPen += penalties[k];
        }
        const score = this.clamp(100 - totalPen, 0, 100);

        let state = 'HEALTHY';
        if (score < 80) state = 'WATCH';
        if (score < 60) state = 'CONCERN';
        if (score < 40) state = 'ALERT';

        return { ok: true, ansHealthScore: score, ansState: state, flags, meanHrLast7, daysTeiLt40 };
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
    }
};

// Export for use in app.js
if (typeof window !== 'undefined') window.TenkiEngine = TenkiEngine;
