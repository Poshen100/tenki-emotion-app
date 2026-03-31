/**
 * TEI RS99 Display — clampTeiDisplay 單元測試
 * =============================================
 * 驗證 TEI PR99 → RS-style 1–99 顯示映射邏輯
 *
 * 涵蓋:
 *  - 邊界值 (null, NaN, -10, 0, 1, 50, 99, 100, 120)
 *  - 輸出永遠落在 [1, 99]
 *  - 單調遞增
 *  - 整數輸出
 *
 * 執行方式:
 *   node tests/tei-rs99-display.test.js
 */

'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// 測試框架 (同專案慣例)
// ─────────────────────────────────────────────────────────────────────────────

let _passed = 0;
let _failed = 0;
const _failures = [];

function assert(condition, label) {
    if (condition) {
        _passed++;
    } else {
        _failed++;
        _failures.push(label);
        console.error('  ✗ ' + label);
    }
}

function assertEq(actual, expected, label) {
    if (actual === expected) {
        _passed++;
    } else {
        _failed++;
        const msg = label + ' — expected ' + expected + ', got ' + actual;
        _failures.push(msg);
        console.error('  ✗ ' + msg);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// 被測函式 — 與 results-renderer.js 中的 clampTeiDisplay 完全一致
// ─────────────────────────────────────────────────────────────────────────────

function clampTeiDisplay(raw) {
    if (raw == null || isNaN(raw)) return 1;
    return Math.max(1, Math.min(99, Math.round(raw)));
}

// ─────────────────────────────────────────────────────────────────────────────
// 測試套件
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n=== TEI RS99 Display Tests ===\n');

// ── 1. Null / undefined / NaN 防呆 ──
console.log('── Null / undefined / NaN guard ──');
assertEq(clampTeiDisplay(null),      1, 'null → 1');
assertEq(clampTeiDisplay(undefined), 1, 'undefined → 1');
assertEq(clampTeiDisplay(NaN),       1, 'NaN → 1');

// ── 2. 負數與零邊界 ──
console.log('── Negative & zero boundary ──');
assertEq(clampTeiDisplay(-10), 1, 'tei_raw = -10 → 1');
assertEq(clampTeiDisplay(-1),  1, 'tei_raw = -1 → 1');
assertEq(clampTeiDisplay(0),   1, 'tei_raw = 0 → 1');

// ── 3. 最小有效值 ──
console.log('── Minimum valid ──');
assertEq(clampTeiDisplay(1), 1, 'tei_raw = 1 → 1');

// ── 4. 代表性中間值 ──
console.log('── Representative values ──');
assertEq(clampTeiDisplay(5),   5,  'tei_raw = 5 → 5');
assertEq(clampTeiDisplay(34),  34, 'tei_raw = 34 → 34 (DEGRADED upper)');
assertEq(clampTeiDisplay(35),  35, 'tei_raw = 35 → 35 (NEUTRAL lower)');
assertEq(clampTeiDisplay(50),  50, 'tei_raw = 50 → 50');
assertEq(clampTeiDisplay(54),  54, 'tei_raw = 54 → 54 (NEUTRAL upper)');
assertEq(clampTeiDisplay(55),  55, 'tei_raw = 55 → 55 (OPTIMAL lower)');
assertEq(clampTeiDisplay(72),  72, 'tei_raw = 72 → 72');
assertEq(clampTeiDisplay(79),  79, 'tei_raw = 79 → 79 (OPTIMAL upper)');
assertEq(clampTeiDisplay(80),  80, 'tei_raw = 80 → 80 (PEAK lower)');
assertEq(clampTeiDisplay(95),  95, 'tei_raw = 95 → 95');
assertEq(clampTeiDisplay(99),  99, 'tei_raw = 99 → 99 (max display)');

// ── 5. 上界溢出 ──
console.log('── Upper overflow ──');
assertEq(clampTeiDisplay(100), 99, 'tei_raw = 100 → 99 (clamped)');
assertEq(clampTeiDisplay(120), 99, 'tei_raw = 120 → 99 (clamped)');
assertEq(clampTeiDisplay(999), 99, 'tei_raw = 999 → 99 (clamped)');

// ── 6. 浮點數四捨五入 ──
console.log('── Float rounding ──');
assertEq(clampTeiDisplay(49.4), 49, 'tei_raw = 49.4 → 49 (round down)');
assertEq(clampTeiDisplay(49.5), 50, 'tei_raw = 49.5 → 50 (round up)');
assertEq(clampTeiDisplay(0.4),   1, 'tei_raw = 0.4 → 1 (round→0, clamp→1)');
assertEq(clampTeiDisplay(99.4), 99, 'tei_raw = 99.4 → 99');
assertEq(clampTeiDisplay(99.5), 99, 'tei_raw = 99.5 → round 100, clamp 99');

// ── 7. 單調遞增驗證 ──
console.log('── Monotonic increase ──');
let monotonic = true;
let prev = clampTeiDisplay(0);
for (let i = 1; i <= 100; i++) {
    const curr = clampTeiDisplay(i);
    if (curr < prev) {
        monotonic = false;
        console.error('  ✗ Monotonic break at i=' + i + ': ' + prev + ' → ' + curr);
        break;
    }
    prev = curr;
}
assert(monotonic, 'clampTeiDisplay is monotonically non-decreasing over 0–100');

// ── 8. 輸出範圍驗證 ──
console.log('── Output range [1, 99] ──');
let allInRange = true;
for (let i = -20; i <= 150; i++) {
    const v = clampTeiDisplay(i);
    if (v < 1 || v > 99) {
        allInRange = false;
        console.error('  ✗ Out of range at i=' + i + ': ' + v);
        break;
    }
}
assert(allInRange, 'All outputs in [1, 99] for inputs -20 to 150');

// ── 9. 整數輸出驗證 ──
console.log('── Integer output ──');
let allIntegers = true;
for (let i = -5; i <= 105; i += 0.3) {
    const v = clampTeiDisplay(i);
    if (v !== Math.floor(v)) {
        allIntegers = false;
        console.error('  ✗ Non-integer at i=' + i + ': ' + v);
        break;
    }
}
assert(allIntegers, 'All outputs are integers');

// ─────────────────────────────────────────────────────────────────────────────
// 結果
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n────────────────────────────');
console.log('Passed: ' + _passed + '  Failed: ' + _failed);
if (_failures.length > 0) {
    console.log('\nFailed tests:');
    _failures.forEach(function (f) { console.log('  • ' + f); });
}
console.log('────────────────────────────\n');

process.exit(_failed > 0 ? 1 : 0);
