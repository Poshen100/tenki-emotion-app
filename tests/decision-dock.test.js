/**
 * 決策計時器與分段邏輯 — 測試套件
 * ===================================
 * 涵蓋:
 *  - Timer State Machine
 *  - T3 CANSLIM 段落邏輯
 *  - T4 High RS Breakout 邏輯
 *
 * 執行: node tests/decision-dock.test.js
 */

'use strict';

const fs = require('fs');
const path = require('path');

// Mock localStorage
global.localStorage = {
    getItem: () => null,
    setItem: () => { },
    removeItem: () => { }
};

// Mock EventBridge
global.EventBridge = {
    notifyDecisionState: () => { },
    emit: () => { }
};

// 載入被測試的模組
const timerPath = path.join(__dirname, '../core/decision-timer.js');
const timerCode = fs.readFileSync(timerPath, 'utf8');
eval(timerCode);

const logicPath = path.join(__dirname, '../core/canslim-logic.js');
const logicCode = fs.readFileSync(logicPath, 'utf8');
eval(logicCode);

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
        console.log(`  ✅ ${desc}`);
        _passed++;
    } catch (err) {
        console.error(`  ❌ ${desc}`);
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
        toBeFalsy() { if (actual) throw new Error(`期望 falsy，收到 ${JSON.stringify(actual)}`); }
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// 測試用例
// ─────────────────────────────────────────────────────────────────────────────

describe('Timer State Machine', () => {
    it('Preview 狀態轉換正確', () => {
        const timer = new global.DecisionTimer();
        expect(timer.getState()).toBe('IDLE');

        const success = timer.preview('CANSILM_GROWTH', 50);
        expect(success).toBeTruthy();
        expect(timer.getState()).toBe('PREVIEW');
        expect(timer.getTemplate()).toBe('CANSILM_GROWTH');
    });

    it('Running 狀態轉換正確', () => {
        const timer = new global.DecisionTimer();
        timer.preview('CANSILM_GROWTH', 50);

        const success = timer.start();
        expect(success).toBeTruthy();
        expect(timer.getState()).toBe('RUNNING');
        expect(timer.duration).toBe(300);

        timer.abort();
        expect(timer.getState()).toBe('ABORT');
    });
});

describe('T3 CANSLIM 段落邏輯', () => {
    it('T3 Segment 1 (0-60s) - WAIT', () => {
        const logic = global.CANSLIMLogic;
        const seg = logic.getSegment('CANSILM_GROWTH', 30);
        expect(seg.label).toBe('等待方向確認');
        expect(seg.index).toBe(0);

        const bio = logic.checkBioCriteria('CANSILM_GROWTH', 30, 80);
        expect(bio.canEnter).toBeFalsy(); // 0段禁止進場
    });

    it('T3 Segment 2 (60-240s) - OBSERVE', () => {
        const logic = global.CANSLIMLogic;
        const seg = logic.getSegment('CANSILM_GROWTH', 120);
        expect(seg.label).toBe('觀察量能收縮');
        expect(seg.index).toBe(1);
    });

    it('T3 Segment 3 (240-300s) - ENTRY window (TEI<60 fails)', () => {
        const logic = global.CANSLIMLogic;
        const seg = logic.getSegment('CANSILM_GROWTH', 250);
        expect(seg.label).toBe('進場窗口');
        expect(seg.index).toBe(2);

        // TEI < 60 fails
        const bioFails = logic.checkBioCriteria('CANSILM_GROWTH', 250, 50);
        expect(bioFails.canEnter).toBeFalsy();
    });

    it('T3 Segment 3 (240-300s) - ENTRY window (TEI>=60 succeeds)', () => {
        const logic = global.CANSLIMLogic;
        // TEI >= 60 succeeds
        const bioPasses = logic.checkBioCriteria('CANSILM_GROWTH', 250, 65);
        expect(bioPasses.canEnter).toBeTruthy();
    });
});

describe('T4 High RS Breakout 邏輯', () => {
    it('T4 Segment 1 (0-60s) - WAIT', () => {
        const logic = global.CANSLIMLogic;
        const seg = logic.getSegment('CANSILM_HIGHRS', 30);
        expect(seg.label).toBe('等待方向確認');
        expect(seg.index).toBe(0);

        const bio = logic.checkBioCriteria('CANSILM_HIGHRS', 30, 80);
        expect(bio.canEnter).toBeFalsy();
    });

    it('T4 Segment 2 (60-240s) - ENTRY (TEI >= 50)', () => {
        const logic = global.CANSLIMLogic;
        const seg = logic.getSegment('CANSILM_HIGHRS', 120);
        expect(seg.label).toBe('進場窗口🚀');
        expect(seg.index).toBe(1);

        const bio = logic.checkBioCriteria('CANSILM_HIGHRS', 120, 55);
        expect(bio.canEnter).toBeTruthy();
    });
});

console.log('\n' + '─'.repeat(40));
console.log(`測試結果: ${_passed + _failed} 個測試`);
console.log(`  ✅ 通過: ${_passed}`);
console.log(`  ❌ 失敗: ${_failed}`);

if (_failed > 0) process.exit(1);
else process.exit(0);
