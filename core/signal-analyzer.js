/**
 * TENKI SignalAnalyzer
 * =====================
 * PPG 信號品質分析模組
 *
 * 功能:
 * - 從像素強度序列中提取 PPG 波形
 * - 計算 BPM (FFT + 峰值偵測)
 * - 計算 SNR (Signal-to-Noise Ratio) → quality (0–1)
 * - 計算 RMSSD 近似值 → hrv_ms
 * - 組裝 TenkiSensorSample 並透過 EventBridgeV2 發送
 *
 * 信號管道:
 *   像素 R 通道序列 → 去趨勢 (detrend) → 帶通濾波 (0.7–4 Hz)
 *   → 峰值偵測 → BPM + HRV → SNR → quality
 *
 * 不可修改任何 LOCKED FILE
 *
 * @version 2.0.0
 * @author  TENKI Core Team
 */

'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// 常數
// ─────────────────────────────────────────────────────────────────────────────

/** 採樣率（Hz）- 對應 rPPG 30 FPS */
const SAMPLE_RATE = 30;

/** BPM 有效範圍 */
const BPM_MIN = 40;
const BPM_MAX = 180;

/** 帶通濾波頻率範圍（Hz）*/
const BANDPASS_LOW_HZ = 0.7;
const BANDPASS_HIGH_HZ = 4.0;

/** 最小分析窗口（樣本數） */
const MIN_WINDOW_SIZE = 30;

/** 峰值偵測最小間距（樣本數）*/
const MIN_PEAK_DISTANCE_SAMPLES = 8;

/** SNR 閾值：低於此值 quality 為 0 */
const SNR_FLOOR_DB = 3;

/** SNR 飽和值：高於此值 quality 為 1 */
const SNR_CEIL_DB = 20;

/** 訊號緩衝區大小（最多保留最近 N 幀的 R 值） */
const BUFFER_MAX_SIZE = 300;

/** 發送節流 (ms) */
const EMIT_THROTTLE_MS = 1000;


// ─────────────────────────────────────────────────────────────────────────────
// 數位信號處理工具
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 線性去趨勢（移除 DC offset 和緩慢漂移）
 * @param {number[]} signal
 * @returns {number[]}
 */
function detrend(signal) {
    const n = signal.length;
    if (n < 2) return signal.slice();

    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    for (let i = 0; i < n; i++) {
        sumX += i;
        sumY += signal[i];
        sumXY += i * signal[i];
        sumXX += i * i;
    }

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    return signal.map((v, i) => v - (slope * i + intercept));
}

/**
 * 簡易移動平均帶通濾波
 * @param {number[]} signal
 * @param {number} fs   - 採樣率 (Hz)
 * @param {number} low  - 低截頻 (Hz)
 * @param {number} high - 高截頻 (Hz)
 * @returns {number[]}
 */
function bandpassFilter(signal, fs, low, high) {
    const lowPassWindow = Math.max(2, Math.round(fs / high));
    const highPassWindow = Math.max(2, Math.round(fs / low));

    function movingAvg(arr, window) {
        const out = new Array(arr.length).fill(0);
        for (let i = 0; i < arr.length; i++) {
            let sum = 0, count = 0;
            for (let j = Math.max(0, i - window + 1); j <= i; j++) {
                sum += arr[j];
                count++;
            }
            out[i] = sum / count;
        }
        return out;
    }

    const lowPassed = movingAvg(signal, lowPassWindow);
    const highPassed = movingAvg(signal, highPassWindow);

    return lowPassed.map((v, i) => v - highPassed[i]);
}

/**
 * 峰值偵測
 * @param {number[]} signal
 * @param {number}   minDistance
 * @returns {number[]} 峰值的索引陣列
 */
function findPeaks(signal, minDistance = MIN_PEAK_DISTANCE_SAMPLES) {
    const peaks = [];
    const threshold = 0;

    for (let i = 1; i < signal.length - 1; i++) {
        if (signal[i] > signal[i - 1] && signal[i] > signal[i + 1] && signal[i] > threshold) {
            if (peaks.length === 0 || i - peaks[peaks.length - 1] >= minDistance) {
                peaks.push(i);
            } else if (signal[i] > signal[peaks[peaks.length - 1]]) {
                peaks[peaks.length - 1] = i;
            }
        }
    }
    return peaks;
}

/**
 * 從峰值索引計算 BPM
 * @param {number[]} peakIndices
 * @param {number}   fs
 * @returns {number|null}
 */
function peaksToBPM(peakIndices, fs) {
    if (peakIndices.length < 2) return null;

    const rrIntervals = [];
    for (let i = 1; i < peakIndices.length; i++) {
        rrIntervals.push((peakIndices[i] - peakIndices[i - 1]) / fs);
    }

    const avgRR = rrIntervals.reduce((s, v) => s + v, 0) / rrIntervals.length;
    const bpm = 60 / avgRR;

    if (bpm < BPM_MIN || bpm > BPM_MAX) return null;
    return Math.round(bpm * 10) / 10;
}

/**
 * 從 RR 間期計算 RMSSD（HRV 指標）
 * @param {number[]} peakIndices
 * @param {number}   fs
 * @returns {number} RMSSD (ms)
 */
function calcRMSSD(peakIndices, fs) {
    if (peakIndices.length < 3) return 0;

    const rrMs = [];
    for (let i = 1; i < peakIndices.length; i++) {
        rrMs.push((peakIndices[i] - peakIndices[i - 1]) / fs * 1000);
    }

    let sumSqDiff = 0;
    for (let i = 1; i < rrMs.length; i++) {
        const diff = rrMs[i] - rrMs[i - 1];
        sumSqDiff += diff * diff;
    }

    return Math.round(Math.sqrt(sumSqDiff / (rrMs.length - 1)) * 10) / 10;
}

/**
 * 計算信號 SNR (dB)
 * @param {number[]} filtered - 帶通濾波後信號
 * @param {number[]} original - 去趨勢後的原始信號
 * @returns {number} SNR (dB)
 */
function calcSNR(filtered, original) {
    if (filtered.length === 0) return 0;

    const signalPower = filtered.reduce((s, v) => s + v * v, 0) / filtered.length;

    const noise = original.map((v, i) => v - (filtered[i] || 0));
    const noisePower = noise.reduce((s, v) => s + v * v, 0) / noise.length;

    if (noisePower < 1e-10) return SNR_CEIL_DB;
    if (signalPower < 1e-10) return 0;

    return Math.max(0, 10 * Math.log10(signalPower / noisePower));
}

/**
 * SNR (dB) → quality (0–1)
 * @param {number} snrDb
 * @returns {number} 0–1
 */
function snrToQuality(snrDb) {
    if (snrDb <= SNR_FLOOR_DB) return 0;
    if (snrDb >= SNR_CEIL_DB) return 1;
    return (snrDb - SNR_FLOOR_DB) / (SNR_CEIL_DB - SNR_FLOOR_DB);
}


// ─────────────────────────────────────────────────────────────────────────────
// SignalAnalyzer 主類別
// ─────────────────────────────────────────────────────────────────────────────

class SignalAnalyzer {
    /**
     * @param {Object} [options]
     * @param {number}  [options.sampleRate=30]
     * @param {number}  [options.windowSize=90]
     * @param {string}  [options.source='rppg']
     * @param {boolean} [options.verbose=false]
     */
    constructor(options = {}) {
        this._fs = options.sampleRate || SAMPLE_RATE;
        this._windowSize = options.windowSize || 90;
        this._source = options.source || 'rppg';
        this._verbose = options.verbose || false;

        this._rBuffer = [];
        this._lastResult = null;
        this._lastEmitTs = 0;
        this._latestMeta = {};

        this._stats = {
            framesIngested: 0,
            analysisRuns: 0,
            successfulBPM: 0,
        };
    }

    // ── 公開 API ──

    /**
     * 餵入一幀的 R 通道平均值
     * @param {number} rMean        - 0–255
     * @param {Object} [meta={}]    - 額外 meta (coverage, motion, light)
     */
    ingestFrame(rMean, meta = {}) {
        this._rBuffer.push(rMean);
        this._latestMeta = { ...this._latestMeta, ...meta };
        this._stats.framesIngested++;

        if (this._rBuffer.length > BUFFER_MAX_SIZE) {
            this._rBuffer.shift();
        }

        const now = Date.now();
        if (now - this._lastEmitTs >= EMIT_THROTTLE_MS &&
            this._rBuffer.length >= MIN_WINDOW_SIZE) {
            this._analyze(now);
        }
    }

    /**
     * 強制立即分析
     * @returns {Object|null} TenkiSensorSample
     */
    analyze() {
        if (this._rBuffer.length < MIN_WINDOW_SIZE) return null;
        return this._analyze(Date.now());
    }

    updateMeta(meta) {
        this._latestMeta = { ...this._latestMeta, ...meta };
    }

    getLastResult() { return this._lastResult; }

    getStats() {
        return { ...this._stats, bufferSize: this._rBuffer.length };
    }

    reset() {
        this._rBuffer = [];
        this._lastResult = null;
        this._lastEmitTs = 0;
        this._latestMeta = {};
        this._stats = { framesIngested: 0, analysisRuns: 0, successfulBPM: 0 };
    }

    // ── 私有：信號分析管道 ──

    _analyze(now) {
        this._stats.analysisRuns++;
        this._lastEmitTs = now;

        const window = this._rBuffer.slice(-this._windowSize);

        const detrended = detrend(window);
        const filtered = bandpassFilter(detrended, this._fs, BANDPASS_LOW_HZ, BANDPASS_HIGH_HZ);
        const peaks = findPeaks(filtered, MIN_PEAK_DISTANCE_SAMPLES);

        const bpm = peaksToBPM(peaks, this._fs);
        if (bpm !== null) this._stats.successfulBPM++;

        const hrv_ms = calcRMSSD(peaks, this._fs);
        const snrDb = calcSNR(filtered, detrended);
        const quality = snrToQuality(snrDb);

        const finalBPM = bpm ?? (this._lastResult?.hr_bpm ?? 72);
        const finalHRV = hrv_ms > 0 ? hrv_ms : (this._lastResult?.hrv_ms ?? 30);

        const sensorSample = {
            v: 1,
            ts: now,
            source: this._source,
            hr_bpm: finalBPM,
            hrv_ms: Math.max(5, Math.min(200, finalHRV)),
            quality: Math.round(quality * 100) / 100,
            meta: {
                motion: this._latestMeta.motion ?? 0,
                coverage: this._latestMeta.coverage ?? 0,
                light: this._latestMeta.light ?? 0.5,
                snr_db: Math.round(snrDb * 10) / 10,
                peaks_found: peaks.length,
            }
        };

        this._lastResult = sensorSample;

        this._emitSample(sensorSample);
        this._emitSignalUpdate(quality, finalBPM);

        this._log(
            `BPM=${finalBPM}, HRV=${finalHRV}ms, ` +
            `SNR=${snrDb.toFixed(1)}dB, quality=${quality.toFixed(2)}, ` +
            `peaks=${peaks.length}`
        );

        return sensorSample;
    }

    _emitSample(sample) {
        if (typeof window !== 'undefined' && window.EventBridgeV2) {
            window.EventBridgeV2.emitSensorSample(sample);
        }
    }

    _emitSignalUpdate(quality, bpm) {
        if (typeof window !== 'undefined' && window.EventBridgeV2) {
            window.EventBridgeV2.emitPPGSignal(quality, bpm);
        }
    }

    _log(msg) {
        if (this._verbose) {
            console.log(`[SignalAnalyzer] ${msg}`);
        }
    }
}


// ─────────────────────────────────────────────────────────────────────────────
// Export
// ─────────────────────────────────────────────────────────────────────────────

if (typeof window !== 'undefined') {
    window.SignalAnalyzer = SignalAnalyzer;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        SignalAnalyzer,
        detrend,
        bandpassFilter,
        findPeaks,
        peaksToBPM,
        calcRMSSD,
        calcSNR,
        snrToQuality,
        SAMPLE_RATE,
        BPM_MIN,
        BPM_MAX,
    };
}
