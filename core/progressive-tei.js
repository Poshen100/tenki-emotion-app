/**
 * TENKI ProgressiveTEI
 * =====================
 * 漸進式 TEI 計算引擎：2s → 15s → 30s → 60s 精度提升
 *
 * 設計原則:
 * - 只監聽 tenki:* 事件，只發送 tenki:* 事件（透過 EventBridgeV2）
 * - 不直接 import 任何 LOCKED FILE
 * - 採用 EWMA 平滑 + Bootstrap 誤差估計 + PR99 轉換
 * - 每個 Milestone 發出一次 tenki:tei-progressive，精度遞增
 * - SQI (Signal Quality Index) 門檻 gating：品質不足的樣本不計入
 *
 * 架構:
 *   tenki:sensor-samples-batch → SQI Gating → HRV Pipeline → PR99 Engine
 *   → EWMA Smoother → Bootstrap CI → EventBridgeV2.emitTEIUpdate()
 *
 * 里程碑:
 *   quick:    2s  /  ~4  有效樣本 / confidence ≥ 0.1
 *   standard: 15s / ~30  有效樣本 / confidence ≥ 0.4
 *   precise:  30s / ~60  有效樣本 / confidence ≥ 0.65
 *   ultra:    60s / ~120 有效樣本 / confidence ≥ 0.85
 *
 * @version 2.0.0
 * @author  TENKI Core Team
 */

'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// 常數
// ─────────────────────────────────────────────────────────────────────────────

/** 里程碑定義 */
const MILESTONES = [
    {
        level: 'quick',
        durationMs: 2_000,
        minValidSamples: 4,
        confidenceTarget: 0.30,
        sqiThreshold: 0.40,
        errorMarginBase: 15,
    },
    {
        level: 'standard',
        durationMs: 15_000,
        minValidSamples: 25,
        confidenceTarget: 0.60,
        sqiThreshold: 0.55,
        errorMarginBase: 8,
    },
    {
        level: 'precise',
        durationMs: 30_000,
        minValidSamples: 55,
        confidenceTarget: 0.80,
        sqiThreshold: 0.65,
        errorMarginBase: 5,
    },
    {
        level: 'ultra',
        durationMs: 60_000,
        minValidSamples: 110,
        confidenceTarget: 0.92,
        sqiThreshold: 0.70,
        errorMarginBase: 3,
    },
];

/** EWMA 衰減係數（越小越平滑，反應越慢） */
const EWMA_ALPHA_HR = 0.15;
const EWMA_ALPHA_HRV = 0.10;

/** PR99 轉換：HRV 典型範圍 (RMSSD ms) */
const HRV_POPULATION_MEAN = 42;
const HRV_POPULATION_STD = 18;

/** HR 典型範圍 */
const HR_POPULATION_MEAN = 70;
const HR_POPULATION_STD = 12;

/** Bootstrap CI 樣本數 */
const BOOTSTRAP_ITERATIONS = 200;

/** 最小有效 HR 範圍 */
const HR_MIN = 40;
const HR_MAX = 180;

/** SQI 過低時的 console 警告頻率 (ms) */
const SQI_WARN_INTERVAL_MS = 3000;


// ─────────────────────────────────────────────────────────────────────────────
// 統計工具
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 常態分佈 CDF (Φ) — 使用 Abramowitz & Stegun 近似
 * @param {number} z
 * @returns {number} 0–1
 */
function normalCDF(z) {
    const t = 1 / (1 + 0.2316419 * Math.abs(z));
    const poly = t * (0.319381530
        + t * (-0.356563782
            + t * (1.781477937
                + t * (-1.821255978
                    + t * 1.330274429))));
    const phi = 1 - (1 / Math.sqrt(2 * Math.PI)) * Math.exp(-0.5 * z * z) * poly;
    return z >= 0 ? phi : 1 - phi;
}

/**
 * 計算陣列平均值
 * @param {number[]} arr
 * @returns {number}
 */
function mean(arr) {
    if (arr.length === 0) return 0;
    return arr.reduce((s, v) => s + v, 0) / arr.length;
}

/**
 * 計算樣本標準差
 * @param {number[]} arr
 * @returns {number}
 */
function stddev(arr) {
    if (arr.length < 2) return 0;
    const m = mean(arr);
    const variance = arr.reduce((s, v) => s + (v - m) ** 2, 0) / (arr.length - 1);
    return Math.sqrt(variance);
}

/**
 * clamp 工具
 */
function clamp(val, min, max) {
    return Math.min(max, Math.max(min, val));
}

/**
 * EWMA 更新
 */
function ewmaUpdate(prev, curr, alpha) {
    return alpha * curr + (1 - alpha) * prev;
}


// ─────────────────────────────────────────────────────────────────────────────
// PR99 引擎
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 將 HRV (RMSSD) 轉換為 PR99 原始分
 * @param {number} hrv_ms  - RMSSD (ms)，越高越好
 * @param {number} hr_bpm  - 心率，越低越好（靜息）
 * @returns {number} 原始 PR (0–1)
 */
function computeRawPR(hrv_ms, hr_bpm) {
    const zHRV = (hrv_ms - HRV_POPULATION_MEAN) / HRV_POPULATION_STD;
    const prHRV = normalCDF(zHRV);

    const zHR = -(hr_bpm - HR_POPULATION_MEAN) / HR_POPULATION_STD;
    const prHR = normalCDF(zHR);

    return 0.70 * prHRV + 0.30 * prHR;
}

/**
 * 將原始 PR (0–1) 轉換為 PR99 整數 (1–99)
 */
function rawPRtoPR99(rawPR) {
    const pr99 = Math.round(rawPR * 98) + 1;
    return clamp(pr99, 1, 99);
}

/**
 * Bootstrap 信心區間估計
 */
function bootstrapCI(hrv_samples, hr_samples, centerPR99) {
    if (hrv_samples.length < 4) {
        const margin = 20;
        return {
            lower: clamp(centerPR99 - margin, 1, 99),
            upper: clamp(centerPR99 + margin, 1, 99),
            marginPR99: margin,
        };
    }

    const n = hrv_samples.length;
    const bootstrapMeans = [];

    for (let i = 0; i < BOOTSTRAP_ITERATIONS; i++) {
        let sumPR = 0;
        for (let j = 0; j < n; j++) {
            const idx = Math.floor(Math.random() * n);
            sumPR += computeRawPR(hrv_samples[idx], hr_samples[idx]);
        }
        bootstrapMeans.push(rawPRtoPR99(sumPR / n));
    }

    bootstrapMeans.sort((a, b) => a - b);

    const lower = bootstrapMeans[Math.floor(BOOTSTRAP_ITERATIONS * 0.025)];
    const upper = bootstrapMeans[Math.floor(BOOTSTRAP_ITERATIONS * 0.975)];
    const margin = Math.round((upper - lower) / 2);

    return { lower, upper, marginPR99: margin };
}


// ─────────────────────────────────────────────────────────────────────────────
// ProgressiveTEI 主類別
// ─────────────────────────────────────────────────────────────────────────────

class ProgressiveTEI {
    constructor(options = {}) {
        this._sqiOverride = options.sqiThresholdOverride ?? null;
        this._verbose = options.verbose ?? false;

        this._scanning = false;
        this._scanStartTs = 0;
        this._lastMilestone = null;

        this._validHRV = [];
        this._validHR = [];
        this._allSamples = [];
        this._sources = new Set();

        this._ewmaHR = null;
        this._ewmaHRV = null;

        this._lastSQIWarnTs = 0;

        this._stats = {
            samplesReceived: 0,
            samplesAccepted: 0,
            samplesRejected: 0,
            milestonesHit: [],
            lastTEI: null,
        };

        this._batchHandler = this._onSensorBatch.bind(this);

        if (options.autoStart) {
            this.start();
        }
    }

    // ── 公開 API ──

    start() {
        if (this._scanning) {
            this._log('[WARN] 已在掃描中，請先 stop()');
            return;
        }

        this._reset();
        this._scanning = true;
        this._scanStartTs = Date.now();

        if (!window.EventBridgeV2) {
            console.error('[ProgressiveTEI] window.EventBridgeV2 未就緒，無法啟動');
            this._scanning = false;
            return;
        }

        window.EventBridgeV2.addEventListener(
            'tenki:sensor-samples-batch',
            this._batchHandler
        );

        this._log(`[OK] 掃描開始 (ts: ${this._scanStartTs})`);

        window.EventBridgeV2.dispatchEvent(
            new CustomEvent('tenki:tei-scan-started', {
                detail: { ts: this._scanStartTs }
            })
        );
    }

    stop(emitFinal = true) {
        if (!this._scanning) return;

        this._scanning = false;

        if (window.EventBridgeV2) {
            window.EventBridgeV2.removeEventListener(
                'tenki:sensor-samples-batch',
                this._batchHandler
            );

            window.EventBridgeV2.flushSensorBuffer?.();

            if (emitFinal && this._validHRV.length > 0) {
                this._computeAndEmit(this._getCurrentMilestone(), true);
            }
        }

        this._log(`[STOP] 掃描停止 (有效樣本: ${this._stats.samplesAccepted})`);

        window.EventBridgeV2?.dispatchEvent(
            new CustomEvent('tenki:tei-scan-stopped', {
                detail: {
                    ts: Date.now(),
                    samplesAccepted: this._stats.samplesAccepted,
                    samplesRejected: this._stats.samplesRejected,
                    lastTEI: this._stats.lastTEI,
                }
            })
        );
    }

    reset() {
        const wasScanning = this._scanning;
        this.stop(false);
        this._reset();
        if (wasScanning) this.start();
    }

    get isScanning() {
        return this._scanning;
    }

    get elapsedMs() {
        if (!this._scanning) return 0;
        return Date.now() - this._scanStartTs;
    }

    getStats() {
        return {
            ...this._stats,
            elapsedMs: this.elapsedMs,
            validSamples: this._validHRV.length,
            scanning: this._scanning,
        };
    }

    ingestSamples(samples) {
        this._processBatch(samples);
    }

    // ── 私有：事件處理 ──

    _onSensorBatch(event) {
        if (!this._scanning) return;
        const { samples } = event.detail || {};
        if (!Array.isArray(samples)) return;
        this._processBatch(samples);
    }

    _processBatch(samples) {
        const elapsed = Date.now() - this._scanStartTs;

        samples.forEach(sample => {
            this._stats.samplesReceived++;
            this._allSamples.push(sample);
            this._sources.add(sample.source);

            const milestone = this._getMilestoneForElapsed(elapsed);
            const sqiThreshold = this._sqiOverride ?? milestone.sqiThreshold;

            if (!this._passSQI(sample, sqiThreshold)) {
                this._stats.samplesRejected++;
                this._warnLowSQI(sample.quality, sqiThreshold);
                return;
            }

            this._validHRV.push(sample.hrv_ms);
            this._validHR.push(sample.hr_bpm);
            this._stats.samplesAccepted++;

            this._ewmaHR = this._ewmaHR === null
                ? sample.hr_bpm
                : ewmaUpdate(this._ewmaHR, sample.hr_bpm, EWMA_ALPHA_HR);
            this._ewmaHRV = this._ewmaHRV === null
                ? sample.hrv_ms
                : ewmaUpdate(this._ewmaHRV, sample.hrv_ms, EWMA_ALPHA_HRV);
        });

        this._checkMilestones(elapsed);
    }

    // ── 私有：SQI Gating ──

    _passSQI(sample, threshold) {
        if (sample.quality < threshold) return false;
        if (sample.hr_bpm < HR_MIN || sample.hr_bpm > HR_MAX) return false;
        if (sample.hrv_ms < 5 || sample.hrv_ms > 200) return false;

        if (sample.meta) {
            if (sample.meta.motion !== undefined && sample.meta.motion > 0.7) {
                return false;
            }
            if (sample.meta.coverage !== undefined && sample.meta.coverage < 0.5) {
                return false;
            }
        }

        return true;
    }

    _warnLowSQI(quality, threshold) {
        const now = Date.now();
        if (now - this._lastSQIWarnTs < SQI_WARN_INTERVAL_MS) return;
        this._lastSQIWarnTs = now;

        console.warn(
            `[ProgressiveTEI] SQI 不足: quality=${quality.toFixed(2)} < threshold=${threshold.toFixed(2)}，樣本已排除`
        );

        window.EventBridgeV2?.dispatchEvent(
            new CustomEvent('tenki:tei-quality-low', {
                detail: { quality, threshold, ts: now }
            })
        );
    }

    // ── 私有：里程碑系統 ──

    _getMilestoneForElapsed(elapsed) {
        let current = MILESTONES[0];
        for (const m of MILESTONES) {
            if (elapsed >= m.durationMs) {
                current = m;
            }
        }
        return current;
    }

    _getCurrentMilestone() {
        const elapsed = this.elapsedMs;
        const validSamples = this._validHRV.length;
        let bestMilestone = MILESTONES[0];

        for (const m of MILESTONES) {
            if (elapsed >= m.durationMs && validSamples >= m.minValidSamples) {
                bestMilestone = m;
            }
        }
        return bestMilestone;
    }

    _checkMilestones(elapsed) {
        const validSamples = this._validHRV.length;

        for (const milestone of MILESTONES) {
            if (this._stats.milestonesHit.includes(milestone.level)) continue;

            const timeOk = elapsed >= milestone.durationMs;
            const samplesOk = validSamples >= milestone.minValidSamples;

            if (timeOk || samplesOk) {
                this._log(`[MILESTONE] 里程碑達成: ${milestone.level} (elapsed=${elapsed}ms, samples=${validSamples})`);
                this._stats.milestonesHit.push(milestone.level);
                this._lastMilestone = milestone;
                this._computeAndEmit(milestone, false);
            }
        }
    }

    // ── 私有：TEI 計算與發送 ──

    _computeAndEmit(milestone, isFinal) {
        if (this._validHRV.length === 0) return;

        const validSamples = this._validHRV.length;

        const hrEst = this._ewmaHR ?? mean(this._validHR);
        const hrvEst = this._ewmaHRV ?? mean(this._validHRV);

        const rawPR = computeRawPR(hrvEst, hrEst);
        const centerPR99 = rawPRtoPR99(rawPR);

        const ci = bootstrapCI(this._validHRV, this._validHR, centerPR99);

        const confidence = this._calcConfidence(milestone, validSamples, ci.marginPR99);

        const qualityAvg = this._calcAvgQuality();

        const teiResult = {
            v: 1,
            ts: Date.now(),
            tei_pr99: centerPR99,
            confidence,
            level: milestone.level,
            error_margin_pr99: ci.marginPR99,
            range_pr99: [ci.lower, ci.upper],
            inputs: {
                sources: Array.from(this._sources),
                samples_used: validSamples,
                quality_avg: Math.round(qualityAvg * 100) / 100,
            },
            ...(this._hasBaseline() ? {
                baseline: {
                    hr_bpm: Math.round(hrEst * 10) / 10,
                    confidence: clamp(confidence * 0.7, 0, 1),
                }
            } : {}),
            _meta: {
                is_final: isFinal,
                elapsed_ms: this.elapsedMs,
                ewma_hr: Math.round(hrEst * 10) / 10,
                ewma_hrv: Math.round(hrvEst * 10) / 10,
                samples_total: this._stats.samplesReceived,
                samples_rejected: this._stats.samplesRejected,
            }
        };

        this._stats.lastTEI = teiResult;

        if (window.EventBridgeV2) {
            window.EventBridgeV2.emitTEIUpdate(teiResult);
        } else {
            if (typeof document !== 'undefined') {
                document.dispatchEvent(new CustomEvent('tenki:tei-progressive', {
                    detail: teiResult
                }));
            }
        }

        this._log(
            `[TEI] TEI 發送: PR99=${centerPR99}, ` +
            `confidence=${confidence.toFixed(2)}, ` +
            `level=${milestone.level}, ` +
            `margin=±${ci.marginPR99}, ` +
            `samples=${validSamples}`
        );
    }

    _calcConfidence(milestone, validSamples, marginPR99) {
        const sampleRatio = Math.min(1, validSamples / milestone.minValidSamples);
        const sampleFactor = Math.pow(sampleRatio, 0.7);

        const maxAcceptableMargin = milestone.errorMarginBase * 2;
        const marginFactor = clamp(1 - (marginPR99 / maxAcceptableMargin), 0, 1);

        const qualityFactor = clamp(this._calcAvgQuality() - 0.3, 0, 0.7) / 0.7;

        const rawConfidence = (
            0.50 * sampleFactor +
            0.30 * marginFactor +
            0.20 * qualityFactor
        );

        return clamp(
            Math.round(rawConfidence * 100) / 100,
            0,
            milestone.confidenceTarget
        );
    }

    _calcAvgQuality() {
        const accepted = this._allSamples.filter(s => this._validHRV.includes(s.hrv_ms));
        if (accepted.length === 0) return 0;
        return mean(accepted.map(s => s.quality));
    }

    _hasBaseline() {
        return this._validHRV.length >= 15;
    }

    // ── 私有：工具 ──

    _reset() {
        this._scanStartTs = 0;
        this._lastMilestone = null;
        this._validHRV = [];
        this._validHR = [];
        this._allSamples = [];
        this._sources = new Set();
        this._ewmaHR = null;
        this._ewmaHRV = null;
        this._lastSQIWarnTs = 0;
        this._stats = {
            samplesReceived: 0,
            samplesAccepted: 0,
            samplesRejected: 0,
            milestonesHit: [],
            lastTEI: null,
        };
    }

    _log(msg) {
        if (this._verbose) {
            console.log(`[ProgressiveTEI] ${msg}`);
        }
    }
}


// ─────────────────────────────────────────────────────────────────────────────
// 全域單例
// ─────────────────────────────────────────────────────────────────────────────

const _global = typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : this;
_global.TENKI_PROGRESSIVE_TEI = {
    create: function (options) {
        const inst = new ProgressiveTEI(options);
        if (options && options.baselineHR) {
            inst._baselineHR = options.baselineHR;
        }
        return inst;
    }
};

if (typeof window !== 'undefined') {
    if (window.ProgressiveTEI) {
        console.warn('[ProgressiveTEI] 偵測到重複載入，跳過初始化');
    } else {
        window.ProgressiveTEI = new ProgressiveTEI({ verbose: false });
    }
}

// ES Module export（供測試及 bundler 使用）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        ProgressiveTEI,
        MILESTONES,
        normalCDF,
        computeRawPR,
        rawPRtoPR99,
        bootstrapCI,
        ewmaUpdate,
        mean,
        stddev,
    };
}
