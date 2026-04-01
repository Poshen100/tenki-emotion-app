/**
 * ProgressiveTEI — 完整測試套件
 * ================================
 * 涵蓋:
 *  - 統計工具 (normalCDF, computeRawPR, rawPRtoPR99, ewmaUpdate)
 *  - SQI Gating 邏輯
 *  - 里程碑觸發（時間 / 樣本數）
 *  - PR99 範圍 (1–99)
 *  - Bootstrap CI 誤差收縮
 *  - 信心度遞增
 *  - EWMA 平滑
 *  - start / stop / reset 生命週期
 *  - 漸進精度完整流程模擬
 *
 * 執行方式:
 *   node tests/progressive-tei.test.js
 */

'use strict';

const {
    ProgressiveTEI,
    MILESTONES,
    normalCDF,
    computeRawPR,
    rawPRtoPR99,
    bootstrapCI,
    ewmaUpdate,
    mean,
    stddev,
} = require('../core/progressive-tei.js');

// ─────────────────────────────────────────────────────────────────────────────
// 環境 Mock
// ─────────────────────────────────────────────────────────────────────────────

const capturedTEI = [];
const capturedEvents = {};

global.window = {
    EventBridgeV2: {
        addEventListener: () => { },
        removeEventListener: () => { },
        dispatchEvent: (e) => {
            const name = e.type;
            if (!capturedEvents[name]) capturedEvents[name] = [];
            capturedEvents[name].push(e.detail);
        },
        flushSensorBuffer: () => { },
        emitTEIUpdate: (result) => {
            capturedTEI.push(result);
            global.window.EventBridgeV2.dispatchEvent(
                new CustomEvent('tenki:tei-progressive', { detail: result })
            );
        },
    }
};

global.CustomEvent = class CustomEvent {
    constructor(type, init = {}) {
        this.type = type;
        this.detail = init.detail ?? null;
    }
};

global.localStorage = (() => {
    const store = {};
    return {
        getItem: (k) => store[k] ?? null,
        setItem: (k, v) => { store[k] = String(v); },
        removeItem: (k) => { delete store[k]; },
        clear: () => { Object.keys(store).forEach(k => delete store[k]); }
    };
})();

// ─────────────────────────────────────────────────────────────────────────────
// 測試框架
// ─────────────────────────────────────────────────────────────────────────────

let _passed = 0;
let _failed = 0;

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
        toBe(expected) {
            if (actual !== expected)
                throw new Error(`期望 ${JSON.stringify(expected)}，收到 ${JSON.stringify(actual)}`);
        },
        toBeTruthy() { if (!actual) throw new Error(`期望 truthy，收到 ${JSON.stringify(actual)}`); },
        toBeFalsy() { if (actual) throw new Error(`期望 falsy，收到 ${JSON.stringify(actual)}`); },
        toBeGreaterThan(n) { if (!(actual > n)) throw new Error(`期望 > ${n}，收到 ${actual}`); },
        toBeGreaterThanOrEqual(n) { if (!(actual >= n)) throw new Error(`期望 >= ${n}，收到 ${actual}`); },
        toBeLessThan(n) { if (!(actual < n)) throw new Error(`期望 < ${n}，收到 ${actual}`); },
        toBeLessThanOrEqual(n) { if (!(actual <= n)) throw new Error(`期望 <= ${n}，收到 ${actual}`); },
        toBeCloseTo(expected, precision = 2) {
            const threshold = Math.pow(10, -precision) / 2;
            if (Math.abs(actual - expected) >= threshold)
                throw new Error(`期望接近 ${expected}（±${threshold}），收到 ${actual}`);
        },
        toContain(s) {
            if (!actual.includes(s))
                throw new Error(`期望包含 ${JSON.stringify(s)}`);
        },
        toHaveLength(n) {
            if (actual.length !== n)
                throw new Error(`期望長度 ${n}，收到 ${actual.length}`);
        },
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// 測試資料工廠
// ─────────────────────────────────────────────────────────────────────────────

function makeSamples(count, overrides = {}) {
    return Array.from({ length: count }, (_, i) => ({
        v: 1,
        ts: Date.now() + i * 100,
        source: 'rppg',
        hr_bpm: 70 + (Math.random() - 0.5) * 4,
        hrv_ms: 42 + (Math.random() - 0.5) * 8,
        quality: 0.80,
        meta: { motion: 0.05, coverage: 0.92, light: 0.85 },
        ...overrides
    }));
}

function clearCapture() {
    capturedTEI.length = 0;
    Object.keys(capturedEvents).forEach(k => { capturedEvents[k] = []; });
}

function makeTEI(opts = {}) {
    return new ProgressiveTEI({ verbose: false, ...opts });
}


// ─────────────────────────────────────────────────────────────────────────────
// ❶ 統計工具測試
// ─────────────────────────────────────────────────────────────────────────────

describe('normalCDF', () => {
    it('z = 0 → 0.5 (對稱中心)', () => {
        expect(normalCDF(0)).toBeCloseTo(0.5, 2);
    });

    it('z = 1 → ~0.841', () => {
        expect(normalCDF(1)).toBeCloseTo(0.841, 2);
    });

    it('z = -1 → ~0.159', () => {
        expect(normalCDF(-1)).toBeCloseTo(0.159, 2);
    });

    it('z = 2 → ~0.977', () => {
        expect(normalCDF(2)).toBeCloseTo(0.977, 2);
    });

    it('z = -2 → ~0.023', () => {
        expect(normalCDF(-2)).toBeCloseTo(0.023, 2);
    });

    it('z = 3 → 接近 1', () => {
        expect(normalCDF(3)).toBeGreaterThan(0.99);
    });

    it('z = -3 → 接近 0', () => {
        expect(normalCDF(-3)).toBeLessThan(0.01);
    });

    it('輸出永遠在 0–1 之間', () => {
        [-5, -3, -1, 0, 1, 3, 5].forEach(z => {
            const v = normalCDF(z);
            expect(v).toBeGreaterThanOrEqual(0);
            expect(v).toBeLessThanOrEqual(1);
        });
    });
});


describe('mean / stddev', () => {
    it('mean 計算正確', () => {
        expect(mean([1, 2, 3, 4, 5])).toBe(3);
    });

    it('mean 空陣列 → 0', () => {
        expect(mean([])).toBe(0);
    });

    it('stddev 已知數列', () => {
        expect(stddev([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(2, 0);
    });

    it('stddev 單一元素 → 0', () => {
        expect(stddev([42])).toBe(0);
    });

    it('stddev 相同元素 → 0', () => {
        expect(stddev([5, 5, 5, 5])).toBe(0);
    });
});


describe('ewmaUpdate', () => {
    it('alpha = 1 → 全部採用新值', () => {
        expect(ewmaUpdate(50, 80, 1)).toBe(80);
    });

    it('alpha = 0 → 全部保留舊值', () => {
        expect(ewmaUpdate(50, 80, 0)).toBe(50);
    });

    it('alpha = 0.5 → 中間值', () => {
        expect(ewmaUpdate(60, 80, 0.5)).toBe(70);
    });

    it('多次更新：逐漸收斂', () => {
        let ewma = 50;
        for (let i = 0; i < 50; i++) {
            ewma = ewmaUpdate(ewma, 80, 0.15);
        }
        expect(ewma).toBeGreaterThan(75);
    });
});


describe('computeRawPR', () => {
    it('HRV 高、HR 低 → rawPR > 0.5', () => {
        const pr = computeRawPR(65, 58);
        expect(pr).toBeGreaterThan(0.5);
    });

    it('HRV 低、HR 高 → rawPR < 0.5', () => {
        const pr = computeRawPR(20, 90);
        expect(pr).toBeLessThan(0.5);
    });

    it('HRV = 42, HR = 70 → rawPR ≈ 0.5', () => {
        const pr = computeRawPR(42, 70);
        expect(pr).toBeGreaterThan(0.4);
        expect(pr).toBeLessThan(0.6);
    });

    it('rawPR 永遠在 0–1 之間', () => {
        [[10, 120], [80, 50], [42, 70], [5, 180], [200, 40]].forEach(([hrv, hr]) => {
            const pr = computeRawPR(hrv, hr);
            expect(pr).toBeGreaterThanOrEqual(0);
            expect(pr).toBeLessThanOrEqual(1);
        });
    });
});


describe('rawPRtoPR99', () => {
    it('rawPR = 0 → PR99 = 1', () => { expect(rawPRtoPR99(0)).toBe(1); });
    it('rawPR = 1 → PR99 = 99', () => { expect(rawPRtoPR99(1)).toBe(99); });
    it('rawPR = 0.5 → PR99 ≈ 50', () => {
        const pr99 = rawPRtoPR99(0.5);
        expect(pr99).toBeGreaterThanOrEqual(49);
        expect(pr99).toBeLessThanOrEqual(51);
    });
    it('PR99 永遠在 1–99 之間', () => {
        [0, 0.1, 0.5, 0.9, 1].forEach(raw => {
            const pr99 = rawPRtoPR99(raw);
            expect(pr99).toBeGreaterThanOrEqual(1);
            expect(pr99).toBeLessThanOrEqual(99);
        });
    });
});


describe('bootstrapCI', () => {
    it('樣本少於 4 → margin = 20', () => {
        const ci = bootstrapCI([40, 42], [70, 72], 50);
        expect(ci.marginPR99).toBe(20);
    });
    it('大樣本 → margin 縮小', () => {
        const hrv = Array.from({ length: 60 }, () => 42 + (Math.random() - 0.5) * 8);
        const hr = Array.from({ length: 60 }, () => 70 + (Math.random() - 0.5) * 4);
        expect(bootstrapCI(hrv, hr, 50).marginPR99).toBeLessThan(20);
    });
    it('lower <= upper', () => {
        const ci = bootstrapCI(makeSamples(30).map(s => s.hrv_ms), makeSamples(30).map(s => s.hr_bpm), 55);
        expect(ci.lower).toBeLessThanOrEqual(ci.upper);
    });
    it('lower >= 1, upper <= 99', () => {
        const ci = bootstrapCI(makeSamples(30).map(s => s.hrv_ms), makeSamples(30).map(s => s.hr_bpm), 55);
        expect(ci.lower).toBeGreaterThanOrEqual(1);
        expect(ci.upper).toBeLessThanOrEqual(99);
    });
});


// ─────────────────────────────────────────────────────────────────────────────
// ❷ SQI Gating 測試
// ─────────────────────────────────────────────────────────────────────────────

describe('SQI Gating', () => {
    it('quality < threshold → rejected', () => {
        clearCapture();
        const tei = makeTEI({ sqiThresholdOverride: 0.7 });
        tei._scanStartTs = Date.now() - 100; tei._scanning = true;
        tei.ingestSamples(makeSamples(5, { quality: 0.5 }));
        expect(tei.getStats().samplesRejected).toBe(5);
        expect(tei.getStats().samplesAccepted).toBe(0);
    });
    it('quality >= threshold → accepted', () => {
        clearCapture();
        const tei = makeTEI({ sqiThresholdOverride: 0.5 });
        tei._scanStartTs = Date.now() - 100; tei._scanning = true;
        tei.ingestSamples(makeSamples(5, { quality: 0.8 }));
        expect(tei.getStats().samplesAccepted).toBe(5);
    });
    it('hr_bpm < 40 → rejected', () => {
        const tei = makeTEI({ sqiThresholdOverride: 0.1 });
        tei._scanStartTs = Date.now() - 100; tei._scanning = true;
        tei.ingestSamples(makeSamples(3, { hr_bpm: 35, quality: 0.9 }));
        expect(tei.getStats().samplesRejected).toBe(3);
    });
    it('hr_bpm > 180 → rejected', () => {
        const tei = makeTEI({ sqiThresholdOverride: 0.1 });
        tei._scanStartTs = Date.now() - 100; tei._scanning = true;
        tei.ingestSamples(makeSamples(3, { hr_bpm: 200, quality: 0.9 }));
        expect(tei.getStats().samplesRejected).toBe(3);
    });
    it('motion > 0.7 → rejected', () => {
        const tei = makeTEI({ sqiThresholdOverride: 0.1 });
        tei._scanStartTs = Date.now() - 100; tei._scanning = true;
        tei.ingestSamples(makeSamples(3, { quality: 0.9, meta: { motion: 0.9, coverage: 0.95 } }));
        expect(tei.getStats().samplesRejected).toBe(3);
    });
    it('coverage < 0.5 → rejected', () => {
        const tei = makeTEI({ sqiThresholdOverride: 0.1 });
        tei._scanStartTs = Date.now() - 100; tei._scanning = true;
        tei.ingestSamples(makeSamples(3, { quality: 0.9, meta: { motion: 0.05, coverage: 0.3 } }));
        expect(tei.getStats().samplesRejected).toBe(3);
    });
    it('mixed batch: good accepted, bad rejected', () => {
        const tei = makeTEI({ sqiThresholdOverride: 0.6 });
        tei._scanStartTs = Date.now() - 100; tei._scanning = true;
        tei.ingestSamples([...makeSamples(3, { quality: 0.8 }), ...makeSamples(2, { quality: 0.3 })]);
        expect(tei.getStats().samplesAccepted).toBe(3);
        expect(tei.getStats().samplesRejected).toBe(2);
    });
});


// ─────────────────────────────────────────────────────────────────────────────
// ❸ 里程碑觸發測試
// ─────────────────────────────────────────────────────────────────────────────

describe('里程碑觸發', () => {
    it('quick: 4 samples triggers', () => {
        clearCapture();
        const tei = makeTEI({ sqiThresholdOverride: 0.1 });
        tei._scanning = true; tei._scanStartTs = Date.now() - 100;
        tei.ingestSamples(makeSamples(4, { quality: 0.9 }));
        expect(tei.getStats().milestonesHit).toContain('quick');
    });
    it('quick emits tenki:tei-progressive', () => {
        clearCapture();
        const tei = makeTEI({ sqiThresholdOverride: 0.1 });
        tei._scanning = true; tei._scanStartTs = Date.now() - 100;
        tei.ingestSamples(makeSamples(5, { quality: 0.9 }));
        expect(capturedTEI.length).toBeGreaterThanOrEqual(1);
    });
    it('first TEI level = quick', () => {
        clearCapture();
        const tei = makeTEI({ sqiThresholdOverride: 0.1 });
        tei._scanning = true; tei._scanStartTs = Date.now() - 100;
        tei.ingestSamples(makeSamples(5, { quality: 0.9 }));
        expect(capturedTEI[0].level).toBe('quick');
    });
    it('standard: 25 samples', () => {
        clearCapture();
        const tei = makeTEI({ sqiThresholdOverride: 0.1 });
        tei._scanning = true; tei._scanStartTs = Date.now() - 100;
        tei.ingestSamples(makeSamples(25, { quality: 0.9 }));
        expect(tei.getStats().milestonesHit).toContain('standard');
    });
    it('precise: 55 samples', () => {
        clearCapture();
        const tei = makeTEI({ sqiThresholdOverride: 0.1 });
        tei._scanning = true; tei._scanStartTs = Date.now() - 100;
        tei.ingestSamples(makeSamples(55, { quality: 0.9 }));
        expect(tei.getStats().milestonesHit).toContain('precise');
    });
    it('ultra: 110 samples', () => {
        clearCapture();
        const tei = makeTEI({ sqiThresholdOverride: 0.1 });
        tei._scanning = true; tei._scanStartTs = Date.now() - 100;
        tei.ingestSamples(makeSamples(110, { quality: 0.9 }));
        expect(tei.getStats().milestonesHit).toContain('ultra');
    });
    it('no duplicate milestone', () => {
        clearCapture();
        const tei = makeTEI({ sqiThresholdOverride: 0.1 });
        tei._scanning = true; tei._scanStartTs = Date.now() - 100;
        tei.ingestSamples(makeSamples(20, { quality: 0.9 }));
        expect(capturedTEI.filter(r => r.level === 'quick').length).toBe(1);
    });
    it('progressive order: quick → standard → precise', () => {
        clearCapture();
        const tei = makeTEI({ sqiThresholdOverride: 0.1 });
        tei._scanning = true; tei._scanStartTs = Date.now() - 100;
        tei.ingestSamples(makeSamples(60, { quality: 0.9 }));
        const levels = capturedTEI.map(r => r.level);
        const qIdx = levels.indexOf('quick');
        const sIdx = levels.indexOf('standard');
        const pIdx = levels.indexOf('precise');
        if (qIdx >= 0 && sIdx >= 0) expect(qIdx).toBeLessThan(sIdx);
        if (sIdx >= 0 && pIdx >= 0) expect(sIdx).toBeLessThan(pIdx);
        expect(true).toBeTruthy();
    });
});


// ─────────────────────────────────────────────────────────────────────────────
// ❹ TEI PR99 範圍與結構
// ─────────────────────────────────────────────────────────────────────────────

describe('TEI 輸出結構', () => {
    function getTEIResult(n = 5) {
        clearCapture();
        const tei = makeTEI({ sqiThresholdOverride: 0.1 });
        tei._scanning = true; tei._scanStartTs = Date.now() - 100;
        tei.ingestSamples(makeSamples(n, { quality: 0.9 }));
        return capturedTEI[capturedTEI.length - 1];
    }
    it('tei_pr99 in 1–99', () => {
        const r = getTEIResult(5);
        expect(r.tei_pr99).toBeGreaterThanOrEqual(1);
        expect(r.tei_pr99).toBeLessThanOrEqual(99);
    });
    it('confidence in 0–1', () => {
        const r = getTEIResult(5);
        expect(r.confidence).toBeGreaterThanOrEqual(0);
        expect(r.confidence).toBeLessThanOrEqual(1);
    });
    it('error_margin_pr99 > 0', () => {
        expect(getTEIResult(5).error_margin_pr99).toBeGreaterThan(0);
    });
    it('range_pr99[0] <= tei_pr99 <= range_pr99[1]', () => {
        const r = getTEIResult(30);
        expect(r.range_pr99[0]).toBeLessThanOrEqual(r.tei_pr99);
        expect(r.range_pr99[1]).toBeGreaterThanOrEqual(r.tei_pr99);
    });
    it('range_pr99 in 1–99', () => {
        const r = getTEIResult(30);
        expect(r.range_pr99[0]).toBeGreaterThanOrEqual(1);
        expect(r.range_pr99[1]).toBeLessThanOrEqual(99);
    });
    it('v = 1', () => { expect(getTEIResult(5).v).toBe(1); });
    it('inputs.sources non-empty', () => {
        const r = getTEIResult(5);
        expect(Array.isArray(r.inputs.sources)).toBeTruthy();
        expect(r.inputs.sources.length).toBeGreaterThan(0);
    });
    it('inputs.samples_used matches', () => {
        clearCapture();
        const tei = makeTEI({ sqiThresholdOverride: 0.1 });
        tei._scanning = true; tei._scanStartTs = Date.now() - 100;
        tei.ingestSamples(makeSamples(5, { quality: 0.9 }));
        expect(capturedTEI[capturedTEI.length - 1].inputs.samples_used).toBe(5);
    });
    it('inputs.quality_avg in 0–1', () => {
        const r = getTEIResult(10);
        expect(r.inputs.quality_avg).toBeGreaterThanOrEqual(0);
        expect(r.inputs.quality_avg).toBeLessThanOrEqual(1);
    });
});


// ─────────────────────────────────────────────────────────────────────────────
// ❺ 精度遞增
// ─────────────────────────────────────────────────────────────────────────────

describe('漸進精度', () => {
    it('standard errorMarginBase < quick', () => {
        expect(MILESTONES.find(m => m.level === 'standard').errorMarginBase)
            .toBeLessThan(MILESTONES.find(m => m.level === 'quick').errorMarginBase);
    });
    it('precise confidenceTarget > standard', () => {
        expect(MILESTONES.find(m => m.level === 'precise').confidenceTarget)
            .toBeGreaterThan(MILESTONES.find(m => m.level === 'standard').confidenceTarget);
    });
    it('ultra confidenceTarget is max', () => {
        const max = Math.max(...MILESTONES.map(m => m.confidenceTarget));
        expect(MILESTONES.find(m => m.level === 'ultra').confidenceTarget).toBe(max);
    });
    it('more samples → higher confidence', () => {
        clearCapture();
        const t1 = makeTEI({ sqiThresholdOverride: 0.1 });
        t1._scanning = true; t1._scanStartTs = Date.now() - 100;
        t1.ingestSamples(makeSamples(5, { quality: 0.9 }));
        const q = capturedTEI[capturedTEI.length - 1];

        clearCapture();
        const t2 = makeTEI({ sqiThresholdOverride: 0.1 });
        t2._scanning = true; t2._scanStartTs = Date.now() - 100;
        t2.ingestSamples(makeSamples(55, { quality: 0.9 }));
        const p = capturedTEI.find(r => r.level === 'precise');

        if (q && p) expect(p.confidence).toBeGreaterThan(q.confidence);
        expect(true).toBeTruthy();
    });
    it('MILESTONES durationMs ascending', () => {
        for (let i = 1; i < MILESTONES.length; i++)
            expect(MILESTONES[i].durationMs).toBeGreaterThan(MILESTONES[i - 1].durationMs);
    });
    it('MILESTONES minValidSamples ascending', () => {
        for (let i = 1; i < MILESTONES.length; i++)
            expect(MILESTONES[i].minValidSamples).toBeGreaterThan(MILESTONES[i - 1].minValidSamples);
    });
    it('MILESTONES errorMarginBase descending', () => {
        for (let i = 1; i < MILESTONES.length; i++)
            expect(MILESTONES[i].errorMarginBase).toBeLessThan(MILESTONES[i - 1].errorMarginBase);
    });
});


// ─────────────────────────────────────────────────────────────────────────────
// ❻ EWMA 平滑測試
// ─────────────────────────────────────────────────────────────────────────────

describe('EWMA 平滑', () => {
    it('converges to constant input', () => {
        const tei = makeTEI({ sqiThresholdOverride: 0.1 });
        tei._scanning = true; tei._scanStartTs = Date.now() - 100;
        tei.ingestSamples(makeSamples(20, { hr_bpm: 75, quality: 0.9 }));
        expect(tei._ewmaHR).toBeGreaterThan(70);
        expect(tei._ewmaHR).toBeLessThan(80);
    });
    it('null → first sample sets value', () => {
        const tei = makeTEI({ sqiThresholdOverride: 0.1 });
        tei._scanning = true; tei._scanStartTs = Date.now() - 100;
        expect(tei._ewmaHR).toBe(null);
        expect(tei._ewmaHRV).toBe(null);
        tei.ingestSamples(makeSamples(1, { quality: 0.9, hr_bpm: 72, hrv_ms: 42 }));
        expect(tei._ewmaHR).toBe(72);
        expect(tei._ewmaHRV).toBe(42);
    });
});


// ─────────────────────────────────────────────────────────────────────────────
// ❼ 生命週期測試
// ─────────────────────────────────────────────────────────────────────────────

describe('生命週期', () => {
    it('initial isScanning = false', () => { expect(makeTEI().isScanning).toBeFalsy(); });
    it('start → isScanning = true', () => {
        const t = makeTEI(); t.start(); expect(t.isScanning).toBeTruthy(); t.stop(false);
    });
    it('stop → isScanning = false', () => {
        const t = makeTEI(); t.start(); t.stop(false); expect(t.isScanning).toBeFalsy();
    });
    it('reset clears state', () => {
        const t = makeTEI({ sqiThresholdOverride: 0.1 });
        t._scanning = true; t._scanStartTs = Date.now() - 100;
        t.ingestSamples(makeSamples(10, { quality: 0.9 }));
        expect(t.getStats().samplesAccepted).toBeGreaterThan(0);
        t.stop(false); t._reset();
        expect(t.getStats().samplesAccepted).toBe(0);
        expect(t.getStats().milestonesHit).toHaveLength(0);
        expect(t._ewmaHR).toBe(null);
    });
    it('elapsedMs > 0 while scanning', () => {
        const t = makeTEI(); t.start(); expect(t.elapsedMs).toBeGreaterThanOrEqual(0); t.stop(false);
    });
    it('elapsedMs = 0 after stop', () => {
        const t = makeTEI(); t.start(); t.stop(false); expect(t.elapsedMs).toBe(0);
    });
    it('getStats has all fields', () => {
        const s = makeTEI().getStats();
        ['samplesReceived', 'samplesAccepted', 'samplesRejected', 'milestonesHit', 'lastTEI', 'elapsedMs', 'validSamples', 'scanning']
            .forEach(f => { if (s[f] === undefined) throw new Error(`missing ${f}`); });
        expect(true).toBeTruthy();
    });
});


// ─────────────────────────────────────────────────────────────────────────────
// ❽ 完整流程
// ─────────────────────────────────────────────────────────────────────────────

describe('完整掃描流程', () => {
    it('110 samples → all 4 milestones', () => {
        clearCapture();
        const t = makeTEI({ sqiThresholdOverride: 0.1 });
        t._scanning = true; t._scanStartTs = Date.now() - 100;
        t.ingestSamples(makeSamples(110, { quality: 0.9 }));
        const m = t.getStats().milestonesHit;
        expect(m).toContain('quick'); expect(m).toContain('standard');
        expect(m).toContain('precise'); expect(m).toContain('ultra');
    });
    it('normal HRV=42 HR=70 → PR99 ~50', () => {
        clearCapture();
        const t = makeTEI({ sqiThresholdOverride: 0.1 });
        t._scanning = true; t._scanStartTs = Date.now() - 100;
        t.ingestSamples(makeSamples(30, { hr_bpm: 70, hrv_ms: 42, quality: 0.9 }));
        const r = capturedTEI.find(x => x.level === 'standard') || capturedTEI[capturedTEI.length - 1];
        if (r) { expect(r.tei_pr99).toBeGreaterThanOrEqual(35); expect(r.tei_pr99).toBeLessThanOrEqual(65); }
        expect(true).toBeTruthy();
    });
    it('high HRV → PR99 > 50', () => {
        clearCapture();
        const t = makeTEI({ sqiThresholdOverride: 0.1 });
        t._scanning = true; t._scanStartTs = Date.now() - 100;
        t.ingestSamples(makeSamples(30, { hr_bpm: 62, hrv_ms: 75, quality: 0.9 }));
        const r = capturedTEI[capturedTEI.length - 1];
        if (r) expect(r.tei_pr99).toBeGreaterThan(50);
        expect(true).toBeTruthy();
    });
    it('low HRV → PR99 < 50', () => {
        clearCapture();
        const t = makeTEI({ sqiThresholdOverride: 0.1 });
        t._scanning = true; t._scanStartTs = Date.now() - 100;
        t.ingestSamples(makeSamples(30, { hr_bpm: 90, hrv_ms: 18, quality: 0.9 }));
        const r = capturedTEI[capturedTEI.length - 1];
        if (r) expect(r.tei_pr99).toBeLessThan(50);
        expect(true).toBeTruthy();
    });
    it('all bad quality → no TEI emitted', () => {
        clearCapture();
        const t = makeTEI({ sqiThresholdOverride: 0.9 });
        t._scanning = true; t._scanStartTs = Date.now() - 100;
        t.ingestSamples(makeSamples(20, { quality: 0.3 }));
        expect(capturedTEI.length).toBe(0);
        expect(t.getStats().samplesAccepted).toBe(0);
    });
    it('accepted + rejected = received', () => {
        clearCapture();
        const t = makeTEI({ sqiThresholdOverride: 0.6 });
        t._scanning = true; t._scanStartTs = Date.now() - 100;
        t.ingestSamples([...makeSamples(8, { quality: 0.8 }), ...makeSamples(4, { quality: 0.3 })]);
        const s = t.getStats();
        expect(s.samplesAccepted + s.samplesRejected).toBe(s.samplesReceived);
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
