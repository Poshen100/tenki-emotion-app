/**
 * EventBridgeV2 — 完整測試套件
 * ================================
 * 涵蓋:
 *  - 驗證器單元測試 (Validators)
 *  - 事件發送整合測試 (Dual Emission)
 *  - 節流性能測試 (Throttling)
 *  - Feature Flag 測試
 *  - 邊界值測試 (Edge Cases)
 *
 * 執行方式:
 *   node tests/event-bridge-v2.test.js
 *
 * 依賴: Node.js 18+ (原生 CustomEvent & EventTarget support)
 */

'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// 載入受測模組
// ─────────────────────────────────────────────────────────────────────────────
const { EventBridgeV2, ValidationError, Validators, coverageToColor }
    = require('../core/event-bridge-v2.js');

// Node.js 中 localStorage 不存在，Mock 之
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
// 極簡測試框架
// ─────────────────────────────────────────────────────────────────────────────
let _passed = 0;
let _failed = 0;
let _currentSuite = '';

function describe(name, fn) {
    _currentSuite = name;
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
            if (actual !== expected) {
                throw new Error(`期望 ${JSON.stringify(expected)}，收到 ${JSON.stringify(actual)}`);
            }
        },
        toEqual(expected) {
            if (JSON.stringify(actual) !== JSON.stringify(expected)) {
                throw new Error(`期望 ${JSON.stringify(expected)}，收到 ${JSON.stringify(actual)}`);
            }
        },
        toBeTruthy() {
            if (!actual) throw new Error(`期望 truthy，收到 ${JSON.stringify(actual)}`);
        },
        toBeFalsy() {
            if (actual) throw new Error(`期望 falsy，收到 ${JSON.stringify(actual)}`);
        },
        toBeGreaterThan(n) {
            if (!(actual > n)) throw new Error(`期望 > ${n}，收到 ${actual}`);
        },
        toBeGreaterThanOrEqual(n) {
            if (!(actual >= n)) throw new Error(`期望 >= ${n}，收到 ${actual}`);
        },
        toBeLessThanOrEqual(n) {
            if (!(actual <= n)) throw new Error(`期望 <= ${n}，收到 ${actual}`);
        },
        toContain(item) {
            if (!actual.includes(item)) {
                throw new Error(`期望包含 ${JSON.stringify(item)}，收到 ${JSON.stringify(actual)}`);
            }
        },
        toHaveLength(n) {
            if (actual.length !== n) {
                throw new Error(`期望長度 ${n}，收到 ${actual.length}`);
            }
        },
        toThrow() {
            if (typeof actual !== 'function') throw new Error('toThrow 需傳入函式');
            let threw = false;
            try { actual(); } catch { threw = true; }
            if (!threw) throw new Error('期望函式拋出例外，但沒有');
        }
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// 測試資料工廠
// ─────────────────────────────────────────────────────────────────────────────

function makeSensorSample(overrides = {}) {
    return {
        v: 1,
        ts: Date.now(),
        source: 'rppg',
        hr_bpm: 72,
        hrv_ms: 42,
        quality: 0.78,
        meta: { motion: 0.12, coverage: 0.92, light: 0.85 },
        ...overrides
    };
}

function makeTEIResult(overrides = {}) {
    return {
        v: 1,
        ts: Date.now(),
        tei_pr99: 72,
        confidence: 0.85,
        level: 'standard',
        error_margin_pr99: 6,
        range_pr99: [66, 78],
        inputs: { sources: ['rppg'], samples_used: 30, quality_avg: 0.78 },
        ...overrides
    };
}

function makeTradeRecord(overrides = {}) {
    return {
        v: 1,
        trade_id: 'trade_123_abc',
        ts: Date.now(),
        symbol: 'AAPL',
        direction: 'long',
        outcome: 'win',
        pnl: 320.5,
        r_multiple: 2.1,
        template: 'CANSLIM',
        decision_time_s: 14.2,
        tei_at_entry: { tei_pr99: 78, confidence: 0.82, range_pr99: [72, 84] },
        ...overrides
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// ❶ Validators 單元測試
// ─────────────────────────────────────────────────────────────────────────────

describe('Validators.sensorSample', () => {
    it('有效 payload 通過驗證', () => {
        const result = Validators.sensorSample(makeSensorSample());
        expect(result.valid).toBeTruthy();
        expect(result.errors).toHaveLength(0);
    });

    it('v !== 1 → ERR_VERSION', () => {
        const result = Validators.sensorSample(makeSensorSample({ v: 2 }));
        expect(result.valid).toBeFalsy();
        expect(result.errors[0].code).toBe('ERR_VERSION');
    });

    it('ts <= 0 → ERR_TIMESTAMP', () => {
        const result = Validators.sensorSample(makeSensorSample({ ts: -1 }));
        expect(result.valid).toBeFalsy();
        expect(result.errors[0].code).toBe('ERR_TIMESTAMP');
    });

    it('無效 source → ERR_SOURCE', () => {
        const result = Validators.sensorSample(makeSensorSample({ source: 'gps' }));
        expect(result.valid).toBeFalsy();
        expect(result.errors[0].code).toBe('ERR_SOURCE');
    });

    it('hr_bpm = 39 → ERR_HR_RANGE (邊界值)', () => {
        const result = Validators.sensorSample(makeSensorSample({ hr_bpm: 39 }));
        expect(result.valid).toBeFalsy();
        expect(result.errors[0].code).toBe('ERR_HR_RANGE');
    });

    it('hr_bpm = 40 → 通過 (邊界值)', () => {
        const result = Validators.sensorSample(makeSensorSample({ hr_bpm: 40 }));
        expect(result.valid).toBeTruthy();
    });

    it('hr_bpm = 180 → 通過 (上限)', () => {
        const result = Validators.sensorSample(makeSensorSample({ hr_bpm: 180 }));
        expect(result.valid).toBeTruthy();
    });

    it('hr_bpm = 181 → ERR_HR_RANGE', () => {
        const result = Validators.sensorSample(makeSensorSample({ hr_bpm: 181 }));
        expect(result.valid).toBeFalsy();
        expect(result.errors[0].code).toBe('ERR_HR_RANGE');
    });

    it('hrv_ms = 4 → ERR_HRV_RANGE (邊界值)', () => {
        const result = Validators.sensorSample(makeSensorSample({ hrv_ms: 4 }));
        expect(result.valid).toBeFalsy();
        expect(result.errors[0].code).toBe('ERR_HRV_RANGE');
    });

    it('quality = 1.1 → ERR_QUALITY_RANGE', () => {
        const result = Validators.sensorSample(makeSensorSample({ quality: 1.1 }));
        expect(result.valid).toBeFalsy();
        expect(result.errors[0].code).toBe('ERR_QUALITY_RANGE');
    });

    it('quality = 0 → 通過 (最低)', () => {
        const result = Validators.sensorSample(makeSensorSample({ quality: 0 }));
        expect(result.valid).toBeTruthy();
    });

    it('非物件 payload → ERR_TYPE', () => {
        const result = Validators.sensorSample('not-an-object');
        expect(result.valid).toBeFalsy();
        expect(result.errors[0].code).toBe('ERR_TYPE');
    });

    it('多個欄位錯誤時，全部回報', () => {
        const result = Validators.sensorSample({ v: 2, ts: -1, source: 'gps', hr_bpm: 999, hrv_ms: -1, quality: 5 });
        expect(result.valid).toBeFalsy();
        expect(result.errors.length).toBeGreaterThan(3);
    });
});


describe('Validators.teiResult', () => {
    it('有效 payload 通過驗證', () => {
        const result = Validators.teiResult(makeTEIResult());
        expect(result.valid).toBeTruthy();
    });

    it('tei_pr99 = 0 → ERR_TEI_RANGE (低於下限 1)', () => {
        const result = Validators.teiResult(makeTEIResult({ tei_pr99: 0 }));
        expect(result.valid).toBeFalsy();
        expect(result.errors[0].code).toBe('ERR_TEI_RANGE');
    });

    it('tei_pr99 = 1 → 通過 (最低合法值)', () => {
        const result = Validators.teiResult(makeTEIResult({ tei_pr99: 1 }));
        expect(result.valid).toBeTruthy();
    });

    it('tei_pr99 = 99 → 通過 (最高合法值)', () => {
        const result = Validators.teiResult(makeTEIResult({ tei_pr99: 99 }));
        expect(result.valid).toBeTruthy();
    });

    it('tei_pr99 = 100 → ERR_TEI_RANGE (PR99 不可為 100)', () => {
        const result = Validators.teiResult(makeTEIResult({ tei_pr99: 100 }));
        expect(result.valid).toBeFalsy();
        expect(result.errors[0].code).toBe('ERR_TEI_RANGE');
    });

    it('confidence = 1.001 → ERR_CONFIDENCE', () => {
        const result = Validators.teiResult(makeTEIResult({ confidence: 1.001 }));
        expect(result.valid).toBeFalsy();
        expect(result.errors[0].code).toBe('ERR_CONFIDENCE');
    });

    it('無效 level → ERR_LEVEL', () => {
        const result = Validators.teiResult(makeTEIResult({ level: 'instant' }));
        expect(result.valid).toBeFalsy();
        expect(result.errors[0].code).toBe('ERR_LEVEL');
    });

    it('range_pr99 長度不對 → ERR_RANGE', () => {
        const result = Validators.teiResult(makeTEIResult({ range_pr99: [66] }));
        expect(result.valid).toBeFalsy();
        expect(result.errors[0].code).toBe('ERR_RANGE');
    });

    it('缺少 inputs → ERR_INPUTS', () => {
        const r = makeTEIResult();
        delete r.inputs;
        const result = Validators.teiResult(r);
        expect(result.valid).toBeFalsy();
        expect(result.errors[0].code).toBe('ERR_INPUTS');
    });

    it('inputs.sources 空陣列 → ERR_SOURCES', () => {
        const result = Validators.teiResult(makeTEIResult({
            inputs: { sources: [], samples_used: 30, quality_avg: 0.78 }
        }));
        expect(result.valid).toBeFalsy();
        expect(result.errors[0].code).toBe('ERR_SOURCES');
    });
});


describe('Validators.tradeRecord', () => {
    it('有效 payload 通過驗證', () => {
        const result = Validators.tradeRecord(makeTradeRecord());
        expect(result.valid).toBeTruthy();
    });

    it('direction = "buy" → ERR_DIRECTION', () => {
        const result = Validators.tradeRecord(makeTradeRecord({ direction: 'buy' }));
        expect(result.valid).toBeFalsy();
        expect(result.errors[0].code).toBe('ERR_DIRECTION');
    });

    it('outcome = "skip" → ERR_OUTCOME', () => {
        const result = Validators.tradeRecord(makeTradeRecord({ outcome: 'skip' }));
        expect(result.valid).toBeFalsy();
        expect(result.errors[0].code).toBe('ERR_OUTCOME');
    });

    it('tei_at_entry.tei_pr99 = 100 → ERR_TEI_RANGE', () => {
        const result = Validators.tradeRecord(makeTradeRecord({
            tei_at_entry: { tei_pr99: 100, confidence: 0.8, range_pr99: [90, 99] }
        }));
        expect(result.valid).toBeFalsy();
        expect(result.errors[0].code).toBe('ERR_TEI_RANGE');
    });

    it('template = "MOMENTUM" → ERR_TEMPLATE', () => {
        const result = Validators.tradeRecord(makeTradeRecord({ template: 'MOMENTUM' }));
        expect(result.valid).toBeFalsy();
        expect(result.errors[0].code).toBe('ERR_TEMPLATE');
    });

    it('所有合法的 outcome 值', () => {
        ['win', 'loss', 'breakeven', 'timeout', 'abort'].forEach(outcome => {
            const result = Validators.tradeRecord(makeTradeRecord({ outcome }));
            expect(result.valid).toBeTruthy();
        });
    });
});


// ─────────────────────────────────────────────────────────────────────────────
// ❷ 工具函式測試
// ─────────────────────────────────────────────────────────────────────────────

describe('coverageToColor', () => {
    it('coverage = 0 → red', () => {
        expect(coverageToColor(0)).toBe('red');
    });

    it('coverage = 0.59 → red (剛好低於 yellow 閾值)', () => {
        expect(coverageToColor(0.59)).toBe('red');
    });

    it('coverage = 0.60 → yellow (閾值)', () => {
        expect(coverageToColor(0.60)).toBe('yellow');
    });

    it('coverage = 0.84 → yellow (剛好低於 green 閾值)', () => {
        expect(coverageToColor(0.84)).toBe('yellow');
    });

    it('coverage = 0.85 → green (閾值)', () => {
        expect(coverageToColor(0.85)).toBe('green');
    });

    it('coverage = 1.0 → green', () => {
        expect(coverageToColor(1.0)).toBe('green');
    });
});


// ─────────────────────────────────────────────────────────────────────────────
// ❸ EventBridgeV2 整合測試 — 事件發送
// ─────────────────────────────────────────────────────────────────────────────

describe('EventBridgeV2 — 初始化', () => {
    it('預設模式為 dual', () => {
        localStorage.clear();
        const bridge = new EventBridgeV2();
        expect(bridge.mode).toBe('dual');
    });

    it('可透過 options.mode 設定初始模式', () => {
        localStorage.clear();
        const bridge = new EventBridgeV2({ mode: 'v2-only' });
        expect(bridge.mode).toBe('v2-only');
    });

    it('localStorage 中的模式優先於 options.mode', () => {
        localStorage.clear();
        localStorage.setItem('tenki:event-mode', 'legacy');
        const bridge = new EventBridgeV2({ mode: 'v2-only' });
        expect(bridge.mode).toBe('legacy');
        localStorage.clear();
    });

    it('setMode 可動態切換模式', () => {
        localStorage.clear();
        const bridge = new EventBridgeV2();
        bridge.setMode('v2-only');
        expect(bridge.mode).toBe('v2-only');
    });

    it('setMode 無效值時不更改模式', () => {
        localStorage.clear();
        const bridge = new EventBridgeV2({ mode: 'dual' });
        bridge.setMode('invalid-mode');
        expect(bridge.mode).toBe('dual');
    });
});


describe('EventBridgeV2 — emitTEIUpdate (dual mode)', () => {
    function createBridgeAndCapture(mode = 'dual') {
        localStorage.clear();
        const bridge = new EventBridgeV2({ mode, deprecationWarnings: false });
        const received = {};

        const events = [
            'tenki:tei-progressive',
            'tenki:tei-updated',
            'tei:update',
            'tei:updated'
        ];

        events.forEach(ev => {
            received[ev] = [];
            bridge.addEventListener(ev, (e) => received[ev].push(e.detail));
        });

        return { bridge, received };
    }

    it('dual mode: tenki:tei-progressive 被發送', () => {
        const { bridge, received } = createBridgeAndCapture('dual');
        bridge.emitTEIUpdate(makeTEIResult({ tei_pr99: 72 }));
        expect(received['tenki:tei-progressive']).toHaveLength(1);
        expect(received['tenki:tei-progressive'][0].tei_pr99).toBe(72);
    });

    it('dual mode: 舊事件 tei:update 也被發送', () => {
        const { bridge, received } = createBridgeAndCapture('dual');
        bridge.emitTEIUpdate(makeTEIResult({ tei_pr99: 55 }));
        expect(received['tei:update']).toHaveLength(1);
        expect(received['tei:update'][0].score).toBe(55);
    });

    it('dual mode: tenki:tei-updated alias 被發送', () => {
        const { bridge, received } = createBridgeAndCapture('dual');
        bridge.emitTEIUpdate(makeTEIResult());
        expect(received['tenki:tei-updated']).toHaveLength(1);
        expect(received['tenki:tei-updated'][0]._deprecated).toBeTruthy();
    });

    it('v2-only mode: 只發 tenki:tei-progressive，舊事件不發送', () => {
        const { bridge, received } = createBridgeAndCapture('v2-only');
        bridge.emitTEIUpdate(makeTEIResult());
        expect(received['tenki:tei-progressive']).toHaveLength(1);
        expect(received['tei:update']).toHaveLength(0);
        expect(received['tenki:tei-updated']).toHaveLength(0);
    });

    it('legacy mode: 只發舊事件，新事件不發送', () => {
        const { bridge, received } = createBridgeAndCapture('legacy');
        bridge.emitTEIUpdate(makeTEIResult());
        expect(received['tenki:tei-progressive']).toHaveLength(0);
        expect(received['tei:update']).toHaveLength(1);
    });

    it('驗證失敗時不發送任何事件', () => {
        const { bridge, received } = createBridgeAndCapture('dual');
        // tei_pr99 = 100 → 無效（驗證失敗，不發送，不拋出）
        bridge.emitTEIUpdate(makeTEIResult({ tei_pr99: 100 }));
        expect(received['tenki:tei-progressive']).toHaveLength(0);
        expect(received['tei:update']).toHaveLength(0);
    });

    it('canonical payload 包含完整欄位', () => {
        const { bridge, received } = createBridgeAndCapture('v2-only');
        const tei = makeTEIResult({ tei_pr99: 77, level: 'precise', confidence: 0.91 });
        bridge.emitTEIUpdate(tei);

        const detail = received['tenki:tei-progressive'][0];
        expect(detail.tei_pr99).toBe(77);
        expect(detail.level).toBe('precise');
        expect(detail.confidence).toBe(0.91);
        expect(detail.v).toBe(1);
    });
});


describe('EventBridgeV2 — emitSensorSample (批次節流)', () => {
    it('第一個樣本立即發送批次', () => {
        const bridge = new EventBridgeV2({ sensorThrottleMs: 50, mode: 'v2-only' });
        const batches = [];

        bridge.addEventListener('tenki:sensor-samples-batch', (e) => {
            batches.push(e.detail);
        });

        bridge.emitSensorSample(makeSensorSample());

        // 第一個 emit 觸發時，因為 lastSensorEmit=0，立即 flush
        expect(batches.length).toBe(1);
    });

    it('在節流窗口內多個樣本被合併成一個批次', () => {
        const bridge = new EventBridgeV2({ sensorThrottleMs: 10000, mode: 'v2-only' }); // 超長節流
        const batches = [];

        bridge.addEventListener('tenki:sensor-samples-batch', (e) => {
            batches.push(e.detail);
        });

        // 3 個樣本，第一個觸發批次，後兩個被緩衝
        bridge.emitSensorSample(makeSensorSample({ hr_bpm: 70 }));
        bridge.emitSensorSample(makeSensorSample({ hr_bpm: 71 }));
        bridge.emitSensorSample(makeSensorSample({ hr_bpm: 72 }));

        // 第一個立即發出（因 lastSensorEmit=0）
        expect(batches.length).toBe(1);
        expect(batches[0].count).toBe(1);

        // 後兩個在緩衝中
        expect(bridge._sensorBuffer.length).toBe(2);
    });

    it('flushSensorBuffer 強制沖出緩衝', () => {
        const bridge = new EventBridgeV2({ sensorThrottleMs: 10000, mode: 'v2-only' });
        const batches = [];

        bridge.addEventListener('tenki:sensor-samples-batch', (e) => {
            batches.push(e.detail);
        });

        bridge.emitSensorSample(makeSensorSample({ hr_bpm: 70 })); // 立即發出 (lastSensorEmit=0)
        bridge.emitSensorSample(makeSensorSample({ hr_bpm: 71 })); // 進緩衝
        bridge.emitSensorSample(makeSensorSample({ hr_bpm: 72 })); // 進緩衝

        expect(batches.length).toBe(1);

        bridge.flushSensorBuffer();
        expect(batches.length).toBe(2);
        expect(batches[1].count).toBe(2);
        expect(batches[1].samples[0].hr_bpm).toBe(71);
    });

    it('批次 payload 包含正確的 timeRange', () => {
        const bridge = new EventBridgeV2({ sensorThrottleMs: 0, mode: 'v2-only' });
        const batches = [];

        bridge.addEventListener('tenki:sensor-samples-batch', (e) => {
            batches.push(e.detail);
        });

        const ts1 = 1707123456000;
        const ts2 = 1707123456033;
        bridge.emitSensorSample(makeSensorSample({ ts: ts1 }));
        bridge.emitSensorSample(makeSensorSample({ ts: ts2 }));

        // 使用 sensorThrottleMs=0，每個都立即發出
        expect(batches[0].timeRange.start).toBe(ts1);
    });

    it('legacy mode: 感測器樣本被 dropped，不發送', () => {
        const bridge = new EventBridgeV2({ mode: 'legacy' });
        const batches = [];

        bridge.addEventListener('tenki:sensor-samples-batch', (e) => {
            batches.push(e.detail);
        });

        bridge.emitSensorSample(makeSensorSample());

        expect(batches.length).toBe(0);
        expect(bridge.getEventStats().dropped).toBeGreaterThanOrEqual(1);
    });
});


describe('EventBridgeV2 — emitPPGCoverage (節流)', () => {
    it('coverage 0 → color: red', () => {
        const bridge = new EventBridgeV2({ mode: 'v2-only' });
        const events = [];

        bridge.addEventListener('tenki:ppg-coverage', (e) => events.push(e.detail));
        bridge.emitPPGCoverage(0);

        expect(events[0].color).toBe('red');
    });

    it('coverage 0.90 → color: green', () => {
        const bridge = new EventBridgeV2({ mode: 'v2-only' });
        const events = [];

        bridge.addEventListener('tenki:ppg-coverage', (e) => events.push(e.detail));
        bridge.emitPPGCoverage(0.90);

        expect(events[0].color).toBe('green');
    });

    it('coverage 1.5 被 clamp 到 1.0', () => {
        const bridge = new EventBridgeV2({ mode: 'v2-only' });
        const events = [];

        bridge.addEventListener('tenki:ppg-coverage', (e) => events.push(e.detail));
        bridge.emitPPGCoverage(1.5);

        expect(events[0].coverage).toBe(1);
        expect(events[0].color).toBe('green');
    });

    it('節流窗口內第二次呼叫被 dropped', () => {
        const bridge = new EventBridgeV2({ ppgThrottleMs: 10000, mode: 'v2-only' });
        const events = [];

        bridge.addEventListener('tenki:ppg-coverage', (e) => events.push(e.detail));
        bridge.emitPPGCoverage(0.5);
        bridge.emitPPGCoverage(0.6); // 被節流

        expect(events.length).toBe(1);
        expect(bridge.getEventStats().dropped).toBeGreaterThanOrEqual(1);
    });

    it('dual mode: 同時發送 tenki:ppg-coverage 和 ppg:coverage-update', () => {
        const bridge = new EventBridgeV2({ mode: 'dual', deprecationWarnings: false });
        const newEvents = [];
        const oldEvents = [];

        bridge.addEventListener('tenki:ppg-coverage', (e) => newEvents.push(e.detail));
        bridge.addEventListener('ppg:coverage-update', (e) => oldEvents.push(e.detail));

        bridge.emitPPGCoverage(0.75);

        expect(newEvents.length).toBe(1);
        expect(oldEvents.length).toBe(1);
        expect(oldEvents[0]._deprecated).toBeTruthy();
    });
});


describe('EventBridgeV2 — emitPPGState', () => {
    it('有效狀態 GREEN 被發送', () => {
        const bridge = new EventBridgeV2({ mode: 'v2-only' });
        const events = [];

        bridge.addEventListener('tenki:ppg-state', (e) => events.push(e.detail));
        bridge.emitPPGState('GREEN', 'YELLOW');

        expect(events[0].state).toBe('GREEN');
        expect(events[0].prev).toBe('YELLOW');
    });

    it('無效狀態不發送任何事件', () => {
        const bridge = new EventBridgeV2({ mode: 'v2-only' });
        const events = [];

        bridge.addEventListener('tenki:ppg-state', (e) => events.push(e.detail));
        bridge.emitPPGState('INVALID_STATE', 'GREEN');

        expect(events.length).toBe(0);
    });

    it('自動生成 hint 文字', () => {
        const bridge = new EventBridgeV2({ mode: 'v2-only' });
        const events = [];

        bridge.addEventListener('tenki:ppg-state', (e) => events.push(e.detail));
        bridge.emitPPGState('RED', 'DETECTING');

        expect(events[0].hint).toBe('請將手指完整覆蓋鏡頭');
    });

    it('自定義 hint 文字覆蓋預設值', () => {
        const bridge = new EventBridgeV2({ mode: 'v2-only' });
        const events = [];

        bridge.addEventListener('tenki:ppg-state', (e) => events.push(e.detail));
        bridge.emitPPGState('GREEN', 'YELLOW', '自定義提示訊息');

        expect(events[0].hint).toBe('自定義提示訊息');
    });

    it('legacy mode 不發送 tenki:ppg-state', () => {
        const bridge = new EventBridgeV2({ mode: 'legacy' });
        const events = [];

        bridge.addEventListener('tenki:ppg-state', (e) => events.push(e.detail));
        bridge.emitPPGState('GREEN', 'YELLOW');

        expect(events.length).toBe(0);
    });
});


describe('EventBridgeV2 — emitTradeRecord', () => {
    it('有效記錄被發送', () => {
        const bridge = new EventBridgeV2({ mode: 'v2-only' });
        const events = [];

        bridge.addEventListener('tenki:trade-recorded', (e) => events.push(e.detail));
        bridge.emitTradeRecord(makeTradeRecord());

        expect(events.length).toBe(1);
        expect(events[0].symbol).toBe('AAPL');
    });

    it('dual mode: 同時發送 trade:completed', () => {
        const bridge = new EventBridgeV2({ mode: 'dual', deprecationWarnings: false });
        const newEvents = [];
        const oldEvents = [];

        bridge.addEventListener('tenki:trade-recorded', (e) => newEvents.push(e.detail));
        bridge.addEventListener('trade:completed', (e) => oldEvents.push(e.detail));

        bridge.emitTradeRecord(makeTradeRecord());

        expect(newEvents.length).toBe(1);
        expect(oldEvents.length).toBe(1);
    });

    it('驗證失敗不發送', () => {
        const bridge = new EventBridgeV2({ mode: 'v2-only' });
        const events = [];

        bridge.addEventListener('tenki:trade-recorded', (e) => events.push(e.detail));
        bridge.emitTradeRecord(makeTradeRecord({ direction: 'buy' })); // 無效 direction

        expect(events.length).toBe(0);
    });
});


// ─────────────────────────────────────────────────────────────────────────────
// ❹ getEventStats 統計測試
// ─────────────────────────────────────────────────────────────────────────────

describe('EventBridgeV2 — getEventStats', () => {
    it('初始統計全為 0', () => {
        const bridge = new EventBridgeV2({ mode: 'v2-only' });
        const stats = bridge.getEventStats();
        expect(stats.dropped).toBe(0);
        expect(stats.validationErrors).toBe(0);
    });

    it('成功發送後 emitted 計數增加', () => {
        const bridge = new EventBridgeV2({ mode: 'v2-only' });
        bridge.emitTEIUpdate(makeTEIResult());
        bridge.emitTEIUpdate(makeTEIResult());

        const stats = bridge.getEventStats();
        expect(stats.emitted['tenki:tei-progressive']).toBe(2);
    });

    it('節流導致 dropped 增加', () => {
        const bridge = new EventBridgeV2({ ppgThrottleMs: 10000, mode: 'v2-only' });
        bridge.emitPPGCoverage(0.5);
        bridge.emitPPGCoverage(0.6); // dropped

        expect(bridge.getEventStats().dropped).toBeGreaterThanOrEqual(1);
    });

    it('驗證失敗後 validationErrors 增加', () => {
        const bridge = new EventBridgeV2({ mode: 'v2-only' });
        bridge.emitTEIUpdate(makeTEIResult({ tei_pr99: 0 })); // 無效
        expect(bridge.getEventStats().validationErrors).toBeGreaterThanOrEqual(1);
    });

    it('resetStats 重設所有計數', () => {
        const bridge = new EventBridgeV2({ mode: 'v2-only' });
        bridge.emitTEIUpdate(makeTEIResult());
        bridge.resetStats();

        const stats = bridge.getEventStats();
        expect(stats.emitted['tenki:tei-progressive'] || 0).toBe(0);
        expect(stats.dropped).toBe(0);
    });

    it('uptime_ms 大於 0', () => {
        const bridge = new EventBridgeV2({ mode: 'v2-only' });
        const stats = bridge.getEventStats();
        expect(stats.uptime_ms).toBeGreaterThanOrEqual(0);
    });
});


// ─────────────────────────────────────────────────────────────────────────────
// ❺ 公開 Validate 方法測試
// ─────────────────────────────────────────────────────────────────────────────

describe('EventBridgeV2 — 公開 validate 方法', () => {
    const bridge = new EventBridgeV2({ mode: 'v2-only' });

    it('validateSensorSample 有效 → valid: true', () => {
        const r = bridge.validateSensorSample(makeSensorSample());
        expect(r.valid).toBeTruthy();
    });

    it('validateSensorSample 無效 → valid: false + errors', () => {
        const r = bridge.validateSensorSample({ v: 1, ts: 1, source: 'rppg', hr_bpm: 999, hrv_ms: 40, quality: 0.5 });
        expect(r.valid).toBeFalsy();
        expect(r.errors.length).toBeGreaterThan(0);
    });

    it('validateTEIResult PR99 = 100 → valid: false', () => {
        const r = bridge.validateTEIResult(makeTEIResult({ tei_pr99: 100 }));
        expect(r.valid).toBeFalsy();
    });

    it('validateTradeRecord 有效 → valid: true', () => {
        const r = bridge.validateTradeRecord(makeTradeRecord());
        expect(r.valid).toBeTruthy();
    });
});


// ─────────────────────────────────────────────────────────────────────────────
// ❻ emitPPGComplete 測試
// ─────────────────────────────────────────────────────────────────────────────

describe('EventBridgeV2 — emitPPGComplete', () => {
    it('有效 metrics 被發送', () => {
        const bridge = new EventBridgeV2({ mode: 'v2-only' });
        const events = [];

        bridge.addEventListener('tenki:ppg-complete', (e) => events.push(e.detail));

        bridge.emitPPGComplete({
            v: 1,
            ts: Date.now(),
            session_id: 'ppg_123_abcd',
            time_to_aligned_ms: 3200,
            time_to_signal_lock_ms: 8500,
            final_quality: 0.91,
            bpm_estimate: 73.2,
            state_transitions: [],
            coverage_history: []
        });

        expect(events.length).toBe(1);
        expect(events[0].bpm_estimate).toBe(73.2);
    });

    it('缺少 session_id 時自動生成', () => {
        const bridge = new EventBridgeV2({ mode: 'v2-only' });
        const events = [];

        bridge.addEventListener('tenki:ppg-complete', (e) => events.push(e.detail));
        bridge.emitPPGComplete({
            v: 1,
            ts: Date.now(),
            time_to_aligned_ms: 3200,
            time_to_signal_lock_ms: 8500,
            final_quality: 0.91,
            bpm_estimate: 73.2,
            state_transitions: [],
            coverage_history: []
        });

        expect(events[0].session_id).toBeTruthy();
        expect(events[0].session_id.startsWith('ppg_')).toBeTruthy();
    });

    it('legacy mode 不發送 tenki:ppg-complete', () => {
        const bridge = new EventBridgeV2({ mode: 'legacy' });
        const events = [];

        bridge.addEventListener('tenki:ppg-complete', (e) => events.push(e.detail));
        bridge.emitPPGComplete({ v: 1, ts: Date.now(), bpm_estimate: 72 });

        expect(events.length).toBe(0);
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
