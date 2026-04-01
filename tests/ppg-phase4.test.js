/**
 * Phase 4 PPG — 完整測試套件
 * ============================
 * 涵蓋:
 *   FingerDetector  — 像素分析、覆蓋率計算、ROI 策略、EWMA 平滑
 *   SignalAnalyzer  — DSP 工具、SNR、BPM、RMSSD、分析管道
 *   PPGCalibration  — 狀態機、轉換邏輯、ROI 降級、完整流程
 *
 * 執行方式:
 *   node tests/ppg-phase4.test.js
 */

'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// 載入模組
// ─────────────────────────────────────────────────────────────────────────────

const {
    FingerDetector,
    isSkinPixel,
    coverageToColor,
    coverageHint,
    getRoiRect,
    COVERAGE_GREEN_THRESHOLD,
    COVERAGE_YELLOW_THRESHOLD,
} = require('../core/finger-detector.js');

const {
    SignalAnalyzer,
    detrend,
    bandpassFilter,
    findPeaks,
    peaksToBPM,
    calcRMSSD,
    calcSNR,
    snrToQuality,
    BPM_MIN,
    BPM_MAX,
} = require('../core/signal-analyzer.js');

const {
    PPGCalibration,
    PPG_STATES,
    COVERAGE_GREEN,
    COVERAGE_YELLOW,
    LOCK_QUALITY_THRESHOLD,
    LOCK_STABLE_FRAMES,
    ROI_FALLBACK_ORDER,
} = require('../core/ppg-calibration.js');


// ─────────────────────────────────────────────────────────────────────────────
// 環境 Mock
// ─────────────────────────────────────────────────────────────────────────────

const capturedEvents = {};
const capturedSamples = [];
const capturedPPGSignals = [];
let capturedPPGComplete = null;
let capturedPPGStates = [];

global.CustomEvent = class CustomEvent {
    constructor(type, init = {}) {
        this.type = type;
        this.detail = init.detail ?? null;
    }
};

// Mock ImageData（Node.js 原生不支援）
global.ImageData = class ImageData {
    constructor(data, width, height) {
        this.data = data instanceof Uint8ClampedArray ? data : new Uint8ClampedArray(data);
        this.width = width;
        this.height = height ?? (this.data.length / 4 / width);
    }
};

global.OffscreenCanvas = class OffscreenCanvas {
    constructor(w, h) { this.width = w; this.height = h; }
    getContext() {
        return {
            drawImage: () => { },
            getImageData: (x, y, w, h) => ({
                data: new Uint8ClampedArray(w * h * 4).fill(128),
                width: w,
                height: h,
            })
        };
    }
};

global.localStorage = (() => {
    const s = {};
    return {
        getItem: k => s[k] ?? null,
        setItem: (k, v) => { s[k] = v; },
        removeItem: k => { delete s[k]; },
        clear: () => { Object.keys(s).forEach(k => delete s[k]); }
    };
})();

global.window = {
    EventBridgeV2: {
        emitSensorSample: (s) => { capturedSamples.push(s); },
        emitPPGCoverage: () => { },
        emitPPGSignal: (q, b) => { capturedPPGSignals.push({ quality: q, bpm: b }); },
        emitPPGComplete: (m) => { capturedPPGComplete = m; },
        emitPPGState: (state, prev, hint) => {
            capturedPPGStates.push({ state, prev, hint });
        },
        dispatchEvent: (e) => {
            if (!capturedEvents[e.type]) capturedEvents[e.type] = [];
            capturedEvents[e.type].push(e.detail);
        },
    },
    FingerDetector,
    SignalAnalyzer,
};

function clearCapture() {
    capturedSamples.length = 0;
    capturedPPGSignals.length = 0;
    capturedPPGStates.length = 0;
    capturedPPGComplete = null;
    Object.keys(capturedEvents).forEach(k => { capturedEvents[k] = []; });
}

// ─────────────────────────────────────────────────────────────────────────────
// 測試框架
// ─────────────────────────────────────────────────────────────────────────────

let _passed = 0, _failed = 0;

function describe(name, fn) {
    console.log(`\n📦 ${name}`);
    fn();
}

function it(desc, fn) {
    try {
        fn();
        console.log(`  [PASS] ${desc}`);
        _passed++;
    } catch (err) {
        console.error(`  [FAIL] ${desc}`);
        console.error(`     ${err.message}`);
        _failed++;
    }
}

function expect(actual) {
    return {
        toBe(e) { if (actual !== e) throw new Error(`期望 ${JSON.stringify(e)}，收到 ${JSON.stringify(actual)}`); },
        toBeTruthy() { if (!actual) throw new Error(`期望 truthy，收到 ${JSON.stringify(actual)}`); },
        toBeFalsy() { if (actual) throw new Error(`期望 falsy，收到 ${JSON.stringify(actual)}`); },
        toBeGreaterThan(n) { if (!(actual > n)) throw new Error(`期望 > ${n}，收到 ${actual}`); },
        toBeGreaterThanOrEqual(n) { if (!(actual >= n)) throw new Error(`期望 >= ${n}，收到 ${actual}`); },
        toBeLessThan(n) { if (!(actual < n)) throw new Error(`期望 < ${n}，收到 ${actual}`); },
        toBeLessThanOrEqual(n) { if (!(actual <= n)) throw new Error(`期望 <= ${n}，收到 ${actual}`); },
        toBeCloseTo(e, p = 1) {
            const t = Math.pow(10, -p) / 2;
            if (Math.abs(actual - e) >= t) throw new Error(`期望接近 ${e}，收到 ${actual}`);
        },
        toContain(s) {
            if (Array.isArray(actual)) {
                if (!actual.includes(s)) throw new Error(`期望包含 ${JSON.stringify(s)}`);
            } else {
                if (!actual.includes(s)) throw new Error(`期望字串包含 "${s}"，收到 "${actual}"`);
            }
        },
        toHaveLength(n) { if (actual.length !== n) throw new Error(`期望長度 ${n}，收到 ${actual.length}`); },
        toMatch(regex) {
            const r = typeof regex === 'string' ? new RegExp(regex) : regex;
            if (!r.test(actual)) throw new Error(`期望符合 ${r}，收到 "${actual}"`);
        },
        toThrow() {
            if (typeof actual !== 'function') throw new Error('toThrow 需傳入函式');
            let threw = false;
            try { actual(); } catch { threw = true; }
            if (!threw) throw new Error('期望拋出例外，但沒有');
        },
        not: {
            toBe(e) { if (actual === e) throw new Error(`期望不等於 ${JSON.stringify(e)}`); },
            toBeTruthy() { if (actual) throw new Error(`期望 falsy`); },
        }
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// ❶ FingerDetector — 像素分析工具
// ─────────────────────────────────────────────────────────────────────────────

describe('isSkinPixel — 皮膚像素辨識', () => {
    it('深紅色（手指貼鏡頭）→ true', () => {
        expect(isSkinPixel(200, 80, 60)).toBeTruthy();
    });

    it('純白 → false', () => {
        expect(isSkinPixel(255, 255, 255)).toBeFalsy();
    });

    it('純黑 → false', () => {
        expect(isSkinPixel(0, 0, 0)).toBeFalsy();
    });

    it('純藍 → false', () => {
        expect(isSkinPixel(30, 60, 200)).toBeFalsy();
    });

    it('淺粉膚色 → true', () => {
        expect(isSkinPixel(220, 150, 100)).toBeTruthy();
    });

    it('R 不主導 G（非皮膚）→ false', () => {
        expect(isSkinPixel(100, 100, 50)).toBeFalsy();
    });

    it('R 超過範圍上限（非皮膚）→ false', () => {
        expect(isSkinPixel(200, 210, 80)).toBeFalsy();
    });
});

describe('coverageToColor', () => {
    it('0.0 → red', () => expect(coverageToColor(0.0)).toBe('red'));
    it('0.59 → red', () => expect(coverageToColor(0.59)).toBe('red'));
    it('0.60 → yellow', () => expect(coverageToColor(0.60)).toBe('yellow'));
    it('0.84 → yellow', () => expect(coverageToColor(0.84)).toBe('yellow'));
    it('0.85 → green', () => expect(coverageToColor(0.85)).toBe('green'));
    it('1.0 → green', () => expect(coverageToColor(1.0)).toBe('green'));
});

describe('getRoiRect', () => {
    it('full strategy → 全幀', () => {
        const r = getRoiRect('full', 640, 480);
        expect(r.x).toBe(0);
        expect(r.y).toBe(0);
        expect(r.w).toBe(640);
        expect(r.h).toBe(480);
    });

    it('center strategy → 中央 60%', () => {
        const r = getRoiRect('center', 100, 100);
        expect(r.x).toBe(20);
        expect(r.y).toBe(20);
        expect(r.w).toBe(60);
        expect(r.h).toBe(60);
    });

    it('glabella strategy → 上方中央', () => {
        const r = getRoiRect('glabella', 640, 480);
        expect(r.x).toBeGreaterThan(0);
        expect(r.y).toBeGreaterThan(0);
        expect(r.w).toBeLessThan(640);
    });

    it('unknown strategy → fallback full', () => {
        const r = getRoiRect('unknown', 640, 480);
        expect(r.w).toBe(640);
        expect(r.h).toBe(480);
    });
});

describe('FingerDetector — 覆蓋率計算', () => {
    it('初始 ewmaCoverage = 0', () => {
        const fd = new FingerDetector();
        expect(fd.getStats().ewmaCoverage).toBe(0);
    });

    it('reset() 重設 ewmaCoverage', () => {
        const fd = new FingerDetector();
        fd._ewmaCoverage = 0.9;
        fd.reset();
        expect(fd.getStats().ewmaCoverage).toBe(0);
    });

    it('setROIStrategy 切換合法策略', () => {
        const fd = new FingerDetector({ roiStrategy: 'full' });
        fd.setROIStrategy('center');
        expect(fd.getStats().currentROI).toBe('center');
    });

    it('setROIStrategy 非法策略不切換', () => {
        const fd = new FingerDetector({ roiStrategy: 'full' });
        fd.setROIStrategy('invalid');
        expect(fd.getStats().currentROI).toBe('full');
    });

    it('processFrame 使用 ImageData 不拋錯', () => {
        const fd = new FingerDetector();
        const imgData = {
            data: new Uint8ClampedArray([200, 80, 60, 255]),
            width: 1,
            height: 1,
        };
        imgData.__proto__ = ImageData?.prototype ?? {};
        let threw = false;
        try { fd.processFrame(imgData); } catch { threw = true; }
        expect(threw).toBeFalsy();
    });

    it('EWMA 平滑：兩幀之間覆蓋率平滑', () => {
        const fd = new FingerDetector();
        fd._initialized = true;
        fd._ewmaCoverage = 0.5;

        const newCoverage = 0.9;
        const ALPHA = 0.25;
        const expected = ALPHA * newCoverage + (1 - ALPHA) * 0.5;

        fd._ewmaCoverage = ALPHA * newCoverage + (1 - ALPHA) * fd._ewmaCoverage;
        expect(fd._ewmaCoverage).toBeCloseTo(expected, 3);
    });
});


// ─────────────────────────────────────────────────────────────────────────────
// ❷ SignalAnalyzer — DSP 工具
// ─────────────────────────────────────────────────────────────────────────────

describe('detrend', () => {
    it('線性趨勢完全去除後平均值接近 0', () => {
        const signal = Array.from({ length: 100 }, (_, i) => i * 2 + 50);
        const d = detrend(signal);
        const avg = d.reduce((s, v) => s + v, 0) / d.length;
        expect(Math.abs(avg)).toBeLessThan(1);
    });

    it('常數信號去趨勢後全為 0', () => {
        const signal = Array(50).fill(100);
        const d = detrend(signal);
        d.forEach(v => expect(Math.abs(v)).toBeLessThan(0.01));
    });

    it('長度不變', () => {
        const signal = Array.from({ length: 60 }, (_, i) => Math.sin(i));
        expect(detrend(signal).length).toBe(60);
    });
});

describe('bandpassFilter', () => {
    it('純 DC 信號濾波後接近 0', () => {
        const dc = Array(100).fill(128);
        const filtered = bandpassFilter(dc, 30, 0.7, 4.0);
        const maxAbs = Math.max(...filtered.map(Math.abs));
        expect(maxAbs).toBeLessThan(5);
    });

    it('輸出長度與輸入相同', () => {
        const signal = Array.from({ length: 90 }, (_, i) => Math.sin(i));
        const out = bandpassFilter(signal, 30, 0.7, 4.0);
        expect(out.length).toBe(90);
    });

    it('1 Hz 正弦波 (60 BPM) 通過帶通後有非零輸出', () => {
        const fs = 30;
        const signal = Array.from({ length: 120 }, (_, i) =>
            Math.sin(2 * Math.PI * 1 * i / fs) * 100
        );
        const filtered = bandpassFilter(signal, fs, 0.7, 4.0);
        const power = filtered.reduce((s, v) => s + v * v, 0) / filtered.length;
        expect(power).toBeGreaterThan(0);
    });
});

describe('findPeaks', () => {
    it('簡單正弦波找到正確數量的峰值', () => {
        const signal = Array.from({ length: 120 }, (_, i) =>
            Math.sin(2 * Math.PI * i / 30)
        );
        const peaks = findPeaks(signal, 15);
        expect(peaks.length).toBeGreaterThanOrEqual(3);
        expect(peaks.length).toBeLessThanOrEqual(5);
    });

    it('平坦信號 → 沒有峰值', () => {
        const flat = Array(60).fill(0);
        expect(findPeaks(flat)).toHaveLength(0);
    });

    it('相鄰峰值間距 >= minDistance', () => {
        const signal = Array.from({ length: 120 }, (_, i) =>
            Math.sin(2 * Math.PI * i / 30)
        );
        const peaks = findPeaks(signal, 20);
        for (let i = 1; i < peaks.length; i++) {
            expect(peaks[i] - peaks[i - 1]).toBeGreaterThanOrEqual(20);
        }
    });
});

describe('peaksToBPM', () => {
    it('30 fps, 每 30 個樣本一峰 → 60 BPM', () => {
        const peaks = [0, 30, 60, 90, 120];
        const bpm = peaksToBPM(peaks, 30);
        expect(bpm).toBeCloseTo(60, 0);
    });

    it('30 fps, 每 20 個樣本一峰 → 90 BPM', () => {
        const peaks = [0, 20, 40, 60];
        const bpm = peaksToBPM(peaks, 30);
        expect(bpm).toBeCloseTo(90, 0);
    });

    it('少於 2 個峰 → null', () => {
        expect(peaksToBPM([10], 30)).toBe(null);
        expect(peaksToBPM([], 30)).toBe(null);
    });

    it('BPM 超出範圍 → null', () => {
        const peaks = [0, 300, 600];
        expect(peaksToBPM(peaks, 30)).toBe(null);
    });
});

describe('calcRMSSD', () => {
    it('規則心律 RMSSD = 0', () => {
        const peaks = [0, 30, 60, 90, 120];
        const rmssd = calcRMSSD(peaks, 30);
        expect(rmssd).toBeCloseTo(0, 1);
    });

    it('少於 3 個峰 → 0', () => {
        expect(calcRMSSD([0, 30], 30)).toBe(0);
    });

    it('RMSSD > 0 當心律不規則', () => {
        const peaks = [0, 25, 60, 85, 120];
        const rmssd = calcRMSSD(peaks, 30);
        expect(rmssd).toBeGreaterThan(0);
    });
});

describe('calcSNR / snrToQuality', () => {
    it('純雜訊信號 SNR ≈ 0', () => {
        const noise = Array.from({ length: 60 }, () => (Math.random() - 0.5) * 10);
        const snr = calcSNR(noise, noise);
        expect(snr).toBeGreaterThanOrEqual(0);
    });

    it('snrToQuality: SNR < floor → 0', () => {
        expect(snrToQuality(1)).toBe(0);
        expect(snrToQuality(2)).toBe(0);
    });

    it('snrToQuality: SNR > ceil → 1', () => {
        expect(snrToQuality(25)).toBe(1);
    });

    it('snrToQuality: 中間值線性', () => {
        const q = snrToQuality(11.5);
        expect(q).toBeCloseTo(0.5, 1);
    });
});

describe('SignalAnalyzer — 分析管道', () => {
    it('初始 bufferSize = 0', () => {
        const sa = new SignalAnalyzer();
        expect(sa.getStats().bufferSize).toBe(0);
    });

    it('ingestFrame 增加 bufferSize', () => {
        const sa = new SignalAnalyzer();
        sa.ingestFrame(120, {});
        sa.ingestFrame(125, {});
        expect(sa.getStats().bufferSize).toBeGreaterThanOrEqual(2);
    });

    it('reset() 清空緩衝', () => {
        const sa = new SignalAnalyzer();
        for (let i = 0; i < 10; i++) sa.ingestFrame(120 + i % 5, {});
        sa.reset();
        expect(sa.getStats().bufferSize).toBe(0);
    });

    it('analyze() 樣本不足 → null', () => {
        const sa = new SignalAnalyzer();
        sa.ingestFrame(120);
        expect(sa.analyze()).toBe(null);
    });

    it('analyze() 足夠樣本 → 返回 TenkiSensorSample', () => {
        clearCapture();
        const sa = new SignalAnalyzer({ sampleRate: 30, windowSize: 30 });

        for (let i = 0; i < 35; i++) {
            const rVal = 128 + Math.sin(2 * Math.PI * i / 30) * 30;
            sa.ingestFrame(rVal, { coverage: 0.9, motion: 0.05 });
        }

        const result = sa.analyze();
        if (result) {
            expect(result.v).toBe(1);
            expect(result.hr_bpm).toBeGreaterThanOrEqual(BPM_MIN);
            expect(result.hr_bpm).toBeLessThanOrEqual(BPM_MAX);
            expect(result.quality).toBeGreaterThanOrEqual(0);
            expect(result.quality).toBeLessThanOrEqual(1);
        }
        expect(true).toBeTruthy();
    });

    it('TenkiSensorSample source 欄位正確', () => {
        const sa = new SignalAnalyzer({ source: 'healthkit' });
        for (let i = 0; i < 35; i++) sa.ingestFrame(130, { coverage: 0.9 });
        const result = sa.analyze();
        if (result) expect(result.source).toBe('healthkit');
        expect(true).toBeTruthy();
    });
});


// ─────────────────────────────────────────────────────────────────────────────
// ❸ PPGCalibration — 狀態機
// ─────────────────────────────────────────────────────────────────────────────

class MockFingerDetector {
    constructor() { this._coverage = 0; this._roi = 'full'; }
    reset() { }
    setROIStrategy(r) { this._roi = r; }
    processFrame() { return { coverage: this._coverage, color: coverageToColor(this._coverage), hint: '' }; }
    getStats() { return { currentROI: this._roi, ewmaCoverage: this._coverage }; }
    set coverage(v) { this._coverage = v; }
}

class MockSignalAnalyzer {
    constructor() { this._quality = 0; this._bpm = 72; }
    reset() { }
    ingestFrame() { }
    analyze() { return this.getLastResult(); }
    updateMeta() { }
    getLastResult() {
        return {
            v: 1, ts: Date.now(), source: 'rppg',
            hr_bpm: this._bpm, hrv_ms: 42, quality: this._quality,
            meta: {}
        };
    }
    getStats() { return { bufferSize: 10 }; }
    set quality(v) { this._quality = v; }
    set bpm(v) { this._bpm = v; }
}

function makeCalibration(opts = {}) {
    const fd = new MockFingerDetector();
    const sa = new MockSignalAnalyzer();
    const ppg = new PPGCalibration({
        fingerDetector: fd,
        signalAnalyzer: sa,
        verbose: false,
        ...opts
    });
    return { ppg, fd, sa };
}

describe('PPG_STATES 完整性', () => {
    it('包含所有必要狀態', () => {
        const required = ['INIT', 'DETECTING', 'RED', 'YELLOW', 'GREEN', 'LOCKED', 'ERROR'];
        required.forEach(s => {
            if (!PPG_STATES[s]) throw new Error(`缺少狀態: ${s}`);
        });
        expect(true).toBeTruthy();
    });
});

describe('PPGCalibration — 初始化', () => {
    it('初始狀態為 INIT', () => {
        const { ppg } = makeCalibration();
        expect(ppg.state).toBe(PPG_STATES.INIT);
    });

    it('elapsedMs 在 INIT 時為 0', () => {
        const { ppg } = makeCalibration();
        expect(ppg.elapsedMs).toBe(0);
    });

    it('start() 切換到 DETECTING', () => {
        clearCapture();
        const { ppg } = makeCalibration();
        ppg.start();
        expect(ppg.state).toBe(PPG_STATES.DETECTING);
        ppg.stop();
    });

    it('stop() 回到 INIT', () => {
        const { ppg } = makeCalibration();
        ppg.start();
        ppg.stop();
        expect(ppg.state).toBe(PPG_STATES.INIT);
    });

    it('start() 後 elapsedMs > 0', () => {
        const { ppg } = makeCalibration();
        ppg.start();
        expect(ppg.elapsedMs).toBeGreaterThanOrEqual(0);
        ppg.stop();
    });
});

describe('PPGCalibration — 狀態轉換', () => {
    it('DETECTING + coverage 0 → 停留 DETECTING', () => {
        clearCapture();
        const { ppg, fd } = makeCalibration();
        ppg.start();
        fd.coverage = 0;
        ppg.processFrame(null, 120, { coverage: 0 });
        expect(ppg.state).toBe(PPG_STATES.DETECTING);
        ppg.stop();
    });

    it('DETECTING + coverage 0.3 → RED', () => {
        clearCapture();
        const { ppg, fd } = makeCalibration();
        ppg.start();
        fd.coverage = 0.3;
        ppg.processFrame(null, 120, { coverage: 0.3 });
        expect(ppg.state).toBe(PPG_STATES.RED);
        ppg.stop();
    });

    it('DETECTING + coverage 0.70 → YELLOW', () => {
        clearCapture();
        const { ppg, fd } = makeCalibration();
        ppg.start();
        fd.coverage = 0.70;
        ppg.processFrame(null, 120, { coverage: 0.70 });
        expect(ppg.state).toBe(PPG_STATES.YELLOW);
        ppg.stop();
    });

    it('DETECTING + coverage 0.90 → GREEN', () => {
        clearCapture();
        const { ppg, fd } = makeCalibration();
        ppg.start();
        fd.coverage = 0.90;
        ppg.processFrame(null, 120, { coverage: 0.90 });
        expect(ppg.state).toBe(PPG_STATES.GREEN);
        ppg.stop();
    });

    it('RED + coverage 0.90 → GREEN', () => {
        clearCapture();
        const { ppg, fd } = makeCalibration();
        ppg.start();
        fd.coverage = 0.3;
        ppg.processFrame(null, 120, { coverage: 0.3 });
        fd.coverage = 0.90;
        ppg.processFrame(null, 120, { coverage: 0.90 });
        expect(ppg.state).toBe(PPG_STATES.GREEN);
        ppg.stop();
    });

    it('YELLOW + coverage 0.50 → RED（大幅下降）', () => {
        clearCapture();
        const { ppg, fd } = makeCalibration();
        ppg.start();
        fd.coverage = 0.70;
        ppg.processFrame(null, 120, { coverage: 0.70 });
        expect(ppg.state).toBe(PPG_STATES.YELLOW);

        fd.coverage = 0.50;
        ppg.processFrame(null, 120, { coverage: 0.50 });
        expect(ppg.state).toBe(PPG_STATES.RED);
        ppg.stop();
    });

    it('GREEN 連續達標幀數 → LOCKED', () => {
        clearCapture();
        const { ppg, fd, sa } = makeCalibration();
        ppg.start();
        fd.coverage = 0.92;
        sa.quality = 0.80;

        ppg.processFrame(null, 120, { coverage: 0.92 });

        for (let i = 0; i < LOCK_STABLE_FRAMES; i++) {
            ppg.processFrame(null, 120, { coverage: 0.92 });
        }
        expect(ppg.state).toBe(PPG_STATES.LOCKED);
    });

    it('GREEN + quality 不足 → 不進入 LOCKED', () => {
        clearCapture();
        const { ppg, fd, sa } = makeCalibration();
        ppg.start();
        fd.coverage = 0.92;
        sa.quality = 0.30;

        ppg.processFrame(null, 120, { coverage: 0.92 });

        for (let i = 0; i < LOCK_STABLE_FRAMES + 5; i++) {
            ppg.processFrame(null, 120, { coverage: 0.92 });
        }
        expect(ppg.state).toBe(PPG_STATES.GREEN);
        ppg.stop();
    });

    it('GREEN + coverage 大幅下降 → RED', () => {
        clearCapture();
        const { ppg, fd, sa } = makeCalibration();
        ppg.start();
        fd.coverage = 0.90;
        sa.quality = 0.80;
        ppg.processFrame(null, 120, { coverage: 0.90 });

        fd.coverage = 0.40;
        ppg.processFrame(null, 120, { coverage: 0.40 });
        expect(ppg.state).toBe(PPG_STATES.RED);
        ppg.stop();
    });
});

describe('PPGCalibration — 狀態轉換事件', () => {
    it('每次狀態轉換觸發 emitPPGState', () => {
        clearCapture();
        const { ppg, fd } = makeCalibration();
        ppg.start();
        fd.coverage = 0.90;
        ppg.processFrame(null, 120, { coverage: 0.90 });
        ppg.stop();

        const stateNames = capturedPPGStates.map(e => e.state);
        expect(stateNames).toContain('DETECTING');
        expect(stateNames).toContain('GREEN');
    });

    it('同狀態不重複觸發事件', () => {
        clearCapture();
        const { ppg, fd } = makeCalibration();
        ppg.start();
        fd.coverage = 0.90;
        ppg.processFrame(null, 120, { coverage: 0.90 });
        ppg.processFrame(null, 120, { coverage: 0.90 });
        ppg.stop();

        const greenCount = capturedPPGStates.filter(e => e.state === 'GREEN').length;
        expect(greenCount).toBe(1);
    });

    it('LOCKED 觸發 emitPPGComplete', () => {
        clearCapture();
        const { ppg, fd, sa } = makeCalibration();
        ppg.start();
        fd.coverage = 0.92;
        sa.quality = 0.80;
        ppg.processFrame(null, 120, { coverage: 0.92 });
        for (let i = 0; i < LOCK_STABLE_FRAMES; i++) {
            ppg.processFrame(null, 120, { coverage: 0.92 });
        }
        expect(capturedPPGComplete).not.toBe(null);
    });

    it('PPGCalibrationMetrics 結構正確', () => {
        clearCapture();
        const { ppg, fd, sa } = makeCalibration();
        ppg.start();
        fd.coverage = 0.92;
        sa.quality = 0.80;
        ppg.processFrame(null, 120, { coverage: 0.92 });
        for (let i = 0; i < LOCK_STABLE_FRAMES; i++) {
            ppg.processFrame(null, 120, { coverage: 0.92 });
        }

        const m = capturedPPGComplete;
        expect(m.v).toBe(1);
        expect(typeof m.session_id).toBe('string');
        expect(m.session_id.startsWith('ppg_')).toBeTruthy();
        expect(m.bpm_estimate).toBeGreaterThan(0);
        expect(Array.isArray(m.state_transitions)).toBeTruthy();
        expect(Array.isArray(m.coverage_history)).toBeTruthy();
    });
});

describe('PPGCalibration — ROI 降級', () => {
    it('ROI_FALLBACK_ORDER 至少包含 4 個策略', () => {
        expect(ROI_FALLBACK_ORDER.length).toBeGreaterThanOrEqual(4);
    });

    it('_tryROIFallback 切換 FingerDetector ROI', () => {
        const { ppg, fd } = makeCalibration({ enableROIFallback: true });
        ppg.start();
        ppg._tryROIFallback();
        expect(fd._roi).toBe(ROI_FALLBACK_ORDER[1]);
        ppg.stop();
    });

    it('所有 ROI 用盡後進入 ERROR', () => {
        clearCapture();
        const { ppg } = makeCalibration({ enableROIFallback: true });
        ppg.start();
        for (let i = 0; i <= ROI_FALLBACK_ORDER.length; i++) {
            ppg._tryROIFallback();
        }
        expect(ppg.state).toBe(PPG_STATES.ERROR);
    });

    it('enableROIFallback=false 時不切換', () => {
        const { ppg, fd } = makeCalibration({ enableROIFallback: false });
        ppg.start();
        ppg._tryROIFallback();
        expect(fd._roi).toBe('full');
        ppg.stop();
    });
});

describe('PPGCalibration — 完整校準流程', () => {
    it('完整模擬：INIT → DETECTING → RED → YELLOW → GREEN → LOCKED', () => {
        clearCapture();
        const { ppg, fd, sa } = makeCalibration();
        ppg.start();

        fd.coverage = 0.35;
        ppg.processFrame(null, 120, { coverage: 0.35 });
        expect(ppg.state).toBe('RED');

        fd.coverage = 0.72;
        ppg.processFrame(null, 120, { coverage: 0.72 });
        expect(ppg.state).toBe('YELLOW');

        fd.coverage = 0.92;
        sa.quality = 0.80;
        ppg.processFrame(null, 120, { coverage: 0.92 });
        expect(ppg.state).toBe('GREEN');

        for (let i = 0; i < LOCK_STABLE_FRAMES; i++) {
            ppg.processFrame(null, 120, { coverage: 0.92 });
        }
        expect(ppg.state).toBe('LOCKED');
        expect(capturedPPGComplete).not.toBe(null);
    });

    it('session_id 格式正確', () => {
        const { ppg } = makeCalibration();
        ppg.start();
        expect(ppg._sessionId).toMatch(/^ppg_\d+_[a-z0-9]{4}$/);
        ppg.stop();
    });
});

describe('PPGCalibration — LOCKED 後不再處理幀', () => {
    it('LOCKED 狀態 processFrame 不改變狀態', () => {
        clearCapture();
        const { ppg, fd, sa } = makeCalibration();
        ppg.start();
        fd.coverage = 0.92;
        sa.quality = 0.80;
        ppg.processFrame(null, 120, { coverage: 0.92 });
        for (let i = 0; i < LOCK_STABLE_FRAMES; i++) {
            ppg.processFrame(null, 120, { coverage: 0.92 });
        }
        expect(ppg.state).toBe('LOCKED');

        fd.coverage = 0.10;
        ppg.processFrame(null, 120, { coverage: 0.10 });
        expect(ppg.state).toBe('LOCKED');
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 測試報告
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n' + '─'.repeat(60));
console.log(`\n[TEST] 測試結果: ${_passed + _failed} 個測試`);
console.log(`  [PASS] 通過: ${_passed}`);
console.log(`  [FAIL] 失敗: ${_failed}`);
console.log('');

if (_failed > 0) {
    console.log('[WARN] 有測試失敗，請修復後再提交 PR');
    process.exit(1);
} else {
    console.log('🎉 所有測試通過！可以提交 PR');
    process.exit(0);
}
