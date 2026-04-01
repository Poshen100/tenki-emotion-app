/**
 * TEIDisplayAdapter — 完整測試套件
 * ===================================
 * 涵蓋:
 *  - 三種 userLevel 格式輸出
 *  - Grade 邊界值 (PR99 = 1, 34, 35, 54, 55, 79, 80, 99)
 *  - PR99 → 百分比轉換
 *  - compareTrend 趨勢比較
 *  - 錯誤輸入防呆
 *  - GRADE_TABLE 完整性
 *
 * 執行方式:
 *   node tests/tei-display-adapter.test.js
 */

'use strict';

const {
    TEIDisplayAdapter,
    GRADE_TABLE,
    LEVEL_LABELS,
    pr99ToDisplayPct,
    confidenceToText,
} = require('../integration/tei-display-adapter.js');

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
        toContain(s) {
            if (typeof actual === 'string') {
                if (!actual.includes(s)) throw new Error(`期望包含 "${s}"，收到 "${actual}"`);
            } else if (Array.isArray(actual)) {
                if (!actual.includes(s)) throw new Error(`期望包含 ${JSON.stringify(s)}`);
            }
        },
        toBeGreaterThan(n) { if (!(actual > n)) throw new Error(`期望 > ${n}，收到 ${actual}`); },
        toBeGreaterThanOrEqual(n) { if (!(actual >= n)) throw new Error(`期望 >= ${n}，收到 ${actual}`); },
        toBeLessThanOrEqual(n) { if (!(actual <= n)) throw new Error(`期望 <= ${n}，收到 ${actual}`); },
        toBeLessThan(n) { if (!(actual < n)) throw new Error(`期望 < ${n}，收到 ${actual}`); },
        toMatch(regex) {
            if (!regex.test(actual))
                throw new Error(`期望符合 ${regex}，收到 "${actual}"`);
        },
        toThrow() {
            if (typeof actual !== 'function') throw new Error('toThrow 需傳入函式');
            let threw = false;
            try { actual(); } catch { threw = true; }
            if (!threw) throw new Error('期望函式拋出例外，但沒有');
        },
        not: {
            toBe(expected) {
                if (actual === expected)
                    throw new Error(`期望不等於 ${JSON.stringify(expected)}`);
            },
            toContain(s) {
                if (typeof actual === 'string' && actual.includes(s))
                    throw new Error(`期望不包含 "${s}"，但包含了`);
            }
        }
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// 測試資料工廠
// ─────────────────────────────────────────────────────────────────────────────

function makeTEIResult(overrides = {}) {
    return {
        v: 1,
        ts: Date.now(),
        tei_pr99: 72,
        confidence: 0.85,
        level: 'standard',
        error_margin_pr99: 6,
        range_pr99: [66, 78],
        inputs: {
            sources: ['rppg'],
            samples_used: 30,
            quality_avg: 0.78
        },
        ...overrides
    };
}

const adapter = new TEIDisplayAdapter();


// ─────────────────────────────────────────────────────────────────────────────
// ❶ GRADE_TABLE 完整性測試
// ─────────────────────────────────────────────────────────────────────────────

describe('GRADE_TABLE 完整性', () => {
    it('包含 4 個 Grade', () => {
        expect(GRADE_TABLE.length).toBe(4);
    });

    it('所有 Grade 包含必要欄位', () => {
        const requiredFields = ['label', 'color', 'colorDim', 'action', 'consumerText', 'emoji', 'advice', 'haptic', 'minPR99', 'maxPR99'];
        GRADE_TABLE.forEach(grade => {
            requiredFields.forEach(field => {
                if (grade[field] === undefined) {
                    throw new Error(`Grade "${grade.label}" 缺少欄位 "${field}"`);
                }
            });
        });
        expect(true).toBeTruthy();
    });

    it('PR99 範圍無縫覆蓋 1–99', () => {
        const allPR = Array.from({ length: 99 }, (_, i) => i + 1);
        allPR.forEach(pr => {
            const found = GRADE_TABLE.some(g => pr >= g.minPR99 && pr <= g.maxPR99);
            if (!found) throw new Error(`PR99 = ${pr} 沒有對應的 Grade`);
        });
        expect(true).toBeTruthy();
    });

    it('PR99 範圍無重疊', () => {
        for (let i = 0; i < GRADE_TABLE.length; i++) {
            for (let j = i + 1; j < GRADE_TABLE.length; j++) {
                const a = GRADE_TABLE[i];
                const b = GRADE_TABLE[j];
                const overlap = a.minPR99 <= b.maxPR99 && b.minPR99 <= a.maxPR99;
                if (overlap) {
                    throw new Error(`Grade "${a.label}" 與 "${b.label}" 範圍重疊`);
                }
            }
        }
        expect(true).toBeTruthy();
    });

    it('GRADE_TABLE 顏色均為有效 Hex', () => {
        const hexRe = /^#[0-9A-Fa-f]{6}$/;
        GRADE_TABLE.forEach(grade => {
            if (!hexRe.test(grade.color)) {
                throw new Error(`Grade "${grade.label}" 顏色 "${grade.color}" 不是有效 Hex`);
            }
        });
        expect(true).toBeTruthy();
    });
});


// ─────────────────────────────────────────────────────────────────────────────
// ❷ getGrade 邊界值測試
// ─────────────────────────────────────────────────────────────────────────────

describe('getGrade — 邊界值', () => {
    it('PR99 = 1 → DEGRADED', () => {
        expect(adapter.getGrade(1).label).toBe('DEGRADED');
    });

    it('PR99 = 34 → DEGRADED (上限)', () => {
        expect(adapter.getGrade(34).label).toBe('DEGRADED');
    });

    it('PR99 = 35 → NEUTRAL (下限)', () => {
        expect(adapter.getGrade(35).label).toBe('NEUTRAL');
    });

    it('PR99 = 54 → NEUTRAL (上限)', () => {
        expect(adapter.getGrade(54).label).toBe('NEUTRAL');
    });

    it('PR99 = 55 → OPTIMAL (下限)', () => {
        expect(adapter.getGrade(55).label).toBe('OPTIMAL');
    });

    it('PR99 = 79 → OPTIMAL (上限)', () => {
        expect(adapter.getGrade(79).label).toBe('OPTIMAL');
    });

    it('PR99 = 80 → PEAK (下限)', () => {
        expect(adapter.getGrade(80).label).toBe('PEAK');
    });

    it('PR99 = 99 → PEAK (上限)', () => {
        expect(adapter.getGrade(99).label).toBe('PEAK');
    });

    it('PR99 = 50 → NEUTRAL (中間值)', () => {
        expect(adapter.getGrade(50).label).toBe('NEUTRAL');
    });

    it('PR99 = 72 → OPTIMAL', () => {
        expect(adapter.getGrade(72).label).toBe('OPTIMAL');
    });

    it('PR99 超出範圍 → fallback DEGRADED', () => {
        expect(adapter.getGrade(0).label).toBe('DEGRADED');
        expect(adapter.getGrade(100).label).toBe('DEGRADED');
        expect(adapter.getGrade(-5).label).toBe('DEGRADED');
    });

    it('每個 Grade 有正確的 haptic 值', () => {
        expect(adapter.getGrade(90).haptic).toBe('pulse');
        expect(adapter.getGrade(65).haptic).toBe('none');
        expect(adapter.getGrade(45).haptic).toBe('gentle');
        expect(adapter.getGrade(15).haptic).toBe('breath');
    });
});


// ─────────────────────────────────────────────────────────────────────────────
// ❸ pr99ToDisplayPct
// ─────────────────────────────────────────────────────────────────────────────

describe('pr99ToDisplayPct', () => {
    it('PR99 = 1 → 1', () => {
        expect(pr99ToDisplayPct(1)).toBe(1);
    });

    it('PR99 = 72 → 72', () => {
        expect(pr99ToDisplayPct(72)).toBe(72);
    });

    it('PR99 = 99 → 99', () => {
        expect(pr99ToDisplayPct(99)).toBe(99);
    });

    it('超出範圍 0 → clamp 到 1', () => {
        expect(pr99ToDisplayPct(0)).toBe(1);
    });

    it('超出範圍 100 → clamp 到 99', () => {
        expect(pr99ToDisplayPct(100)).toBe(99);
    });

    it('浮點數 → 取整', () => {
        expect(pr99ToDisplayPct(72.7)).toBe(73);
    });
});


// ─────────────────────────────────────────────────────────────────────────────
// ❹ confidenceToText
// ─────────────────────────────────────────────────────────────────────────────

describe('confidenceToText', () => {
    it('0.85 → 非常可靠', () => {
        expect(confidenceToText(0.85)).toBe('非常可靠');
    });

    it('0.90 → 非常可靠', () => {
        expect(confidenceToText(0.90)).toBe('非常可靠');
    });

    it('0.65 → 可靠', () => {
        expect(confidenceToText(0.65)).toBe('可靠');
    });

    it('0.75 → 可靠', () => {
        expect(confidenceToText(0.75)).toBe('可靠');
    });

    it('0.40 → 參考', () => {
        expect(confidenceToText(0.40)).toBe('參考');
    });

    it('0.20 → 初步估算', () => {
        expect(confidenceToText(0.20)).toBe('初步估算');
    });

    it('0.0 → 初步估算 (最低)', () => {
        expect(confidenceToText(0.0)).toBe('初步估算');
    });
});


// ─────────────────────────────────────────────────────────────────────────────
// ❺ format() — Consumer 模式
// ─────────────────────────────────────────────────────────────────────────────

describe('format() — Consumer 模式', () => {
    it('mode 欄位為 consumer', () => {
        const d = adapter.format(makeTEIResult(), 'consumer');
        expect(d.mode).toBe('consumer');
    });

    it('primary 為百分比格式 "72%"', () => {
        const d = adapter.format(makeTEIResult({ tei_pr99: 72 }), 'consumer');
        expect(d.primary).toBe('72%');
    });

    it('PR99 = 1 → primary "1%"', () => {
        const d = adapter.format(makeTEIResult({ tei_pr99: 1 }), 'consumer');
        expect(d.primary).toBe('1%');
    });

    it('PR99 = 99 → primary "99%"', () => {
        const d = adapter.format(makeTEIResult({ tei_pr99: 99 }), 'consumer');
        expect(d.primary).toBe('99%');
    });

    it('PEAK zone emoji 是 bolt (Material icon)', () => {
        const d = adapter.format(makeTEIResult({ tei_pr99: 85 }), 'consumer');
        expect(d.emoji).toBe('bolt');
    });

    it('DEGRADED zone emoji 是 block (Material icon)', () => {
        const d = adapter.format(makeTEIResult({ tei_pr99: 20 }), 'consumer');
        expect(d.emoji).toBe('block');
    });

    it('包含 color、colorDim、haptic', () => {
        const d = adapter.format(makeTEIResult(), 'consumer');
        expect(d.color).toBeTruthy();
        expect(d.colorDim).toBeTruthy();
        expect(d.haptic).toBeTruthy();
    });

    it('OPTIMAL zone color 是 #00CCFF', () => {
        const d = adapter.format(makeTEIResult({ tei_pr99: 72 }), 'consumer');
        expect(d.color).toBe('#00CCFF');
    });

    it('PEAK zone color 是 #F5A623 (琥珀金)', () => {
        const d = adapter.format(makeTEIResult({ tei_pr99: 88 }), 'consumer');
        expect(d.color).toBe('#F5A623');
    });

    it('levelBadge 包含 icon 與時間', () => {
        const d = adapter.format(makeTEIResult({ level: 'standard' }), 'consumer');
        expect(d.levelBadge).toContain('monitoring');
        expect(d.levelBadge).toContain('15s');
    });

    it('包含 ariaLabel', () => {
        const d = adapter.format(makeTEIResult(), 'consumer');
        expect(d.ariaLabel).toBeTruthy();
        expect(d.ariaLabel).toContain('TEI');
    });

    it('預設 userLevel 為 consumer', () => {
        const d = adapter.format(makeTEIResult());
        expect(d.mode).toBe('consumer');
    });

    it('所有精度等級的 levelBadge 正確', () => {
        const levels = {
            quick: 'electric_bolt',
            standard: 'monitoring',
            precise: 'track_changes',
            ultra: 'diamond',
        };
        Object.entries(levels).forEach(([level, icon]) => {
            const d = adapter.format(makeTEIResult({ level }), 'consumer');
            expect(d.levelBadge).toContain(icon);
        });
    });
});


// ─────────────────────────────────────────────────────────────────────────────
// ❻ format() — Trader 模式
// ─────────────────────────────────────────────────────────────────────────────

describe('format() — Trader 模式', () => {
    it('mode 欄位為 trader', () => {
        const d = adapter.format(makeTEIResult(), 'trader');
        expect(d.mode).toBe('trader');
    });

    it('primary 格式為 "TEI 72"', () => {
        const d = adapter.format(makeTEIResult({ tei_pr99: 72 }), 'trader');
        expect(d.primary).toBe('TEI 72');
    });

    it('grade 欄位為 Grade label', () => {
        const d = adapter.format(makeTEIResult({ tei_pr99: 72 }), 'trader');
        expect(d.grade).toBe('OPTIMAL');
    });

    it('errorMargin 格式為 "±6"', () => {
        const d = adapter.format(makeTEIResult({ error_margin_pr99: 6 }), 'trader');
        expect(d.errorMargin).toBe('±6');
    });

    it('rangeText 格式為 "[66, 78]"', () => {
        const d = adapter.format(makeTEIResult({ range_pr99: [66, 78] }), 'trader');
        expect(d.rangeText).toBe('[66, 78]');
    });

    it('action 是非空字串', () => {
        const d = adapter.format(makeTEIResult(), 'trader');
        expect(d.action).toBeTruthy();
    });

    it('PEAK zone action 包含「嚴守風控」', () => {
        const d = adapter.format(makeTEIResult({ tei_pr99: 85 }), 'trader');
        expect(d.action).toContain('嚴守風控');
    });

    it('DEGRADED zone action 包含「暫停」', () => {
        const d = adapter.format(makeTEIResult({ tei_pr99: 20 }), 'trader');
        expect(d.action).toContain('暫停');
    });

    it('sources 包含 rPPG', () => {
        const d = adapter.format(makeTEIResult(), 'trader');
        expect(d.sources).toContain('rPPG');
    });

    it('多來源 sources 正確顯示', () => {
        const d = adapter.format(makeTEIResult({
            inputs: { sources: ['rppg', 'healthkit'], samples_used: 45, quality_avg: 0.82 }
        }), 'trader');
        expect(d.sources).toContain('rPPG');
        expect(d.sources).toContain('HealthKit');
    });

    it('confidencePct 是 0–100 整數', () => {
        const d = adapter.format(makeTEIResult({ confidence: 0.85 }), 'trader');
        expect(d.confidencePct).toBe(85);
    });

    it('qualityPct 是 0–100 整數', () => {
        const d = adapter.format(makeTEIResult({
            inputs: { sources: ['rppg'], samples_used: 30, quality_avg: 0.78 }
        }), 'trader');
        expect(d.qualityPct).toBe(78);
    });

    it('levelBadge 包含精度描述', () => {
        const d = adapter.format(makeTEIResult({ level: 'precise' }), 'trader');
        expect(d.levelBadge).toContain('高精度');
    });

    it('不包含 primary 中的百分比符號', () => {
        const d = adapter.format(makeTEIResult(), 'trader');
        expect(d.primary).not.toContain('%');
    });
});


// ─────────────────────────────────────────────────────────────────────────────
// ❼ format() — Expert 模式
// ─────────────────────────────────────────────────────────────────────────────

describe('format() — Expert 模式', () => {
    it('mode 欄位為 expert', () => {
        const d = adapter.format(makeTEIResult(), 'expert');
        expect(d.mode).toBe('expert');
    });

    it('primary 格式為 "TEI 72/99"', () => {
        const d = adapter.format(makeTEIResult({ tei_pr99: 72 }), 'expert');
        expect(d.primary).toBe('TEI 72/99');
    });

    it('subtitle 包含信心度百分比', () => {
        const d = adapter.format(makeTEIResult({ confidence: 0.85 }), 'expert');
        expect(d.subtitle).toContain('85%');
    });

    it('subtitle 包含信心度文字描述', () => {
        const d = adapter.format(makeTEIResult({ confidence: 0.85 }), 'expert');
        expect(d.subtitle).toContain('非常可靠');
    });

    it('rangeDetail 包含區間與誤差', () => {
        const d = adapter.format(makeTEIResult({ range_pr99: [66, 78], error_margin_pr99: 6 }), 'expert');
        expect(d.rangeDetail).toContain('[66, 78]');
        expect(d.rangeDetail).toContain('±6');
    });

    it('tooltip 包含 Percentile Rank 說明', () => {
        const d = adapter.format(makeTEIResult({ tei_pr99: 72 }), 'expert');
        expect(d.tooltip).toContain('72%');
        expect(d.tooltip).toContain('Percentile Rank');
    });

    it('raw 欄位是完整的 teiResult', () => {
        const result = makeTEIResult({ tei_pr99: 77 });
        const d = adapter.format(result, 'expert');
        expect(d.raw.tei_pr99).toBe(77);
        expect(d.raw.confidence).toBe(result.confidence);
    });

    it('gradeRaw 包含完整 Grade 資料', () => {
        const d = adapter.format(makeTEIResult({ tei_pr99: 72 }), 'expert');
        expect(d.gradeRaw.label).toBe('OPTIMAL');
        expect(d.gradeRaw.color).toBeTruthy();
        expect(d.gradeRaw.haptic).toBeTruthy();
    });

    it('raw 是原始資料的副本（防止外部修改）', () => {
        const result = makeTEIResult();
        const d = adapter.format(result, 'expert');
        d.raw.tei_pr99 = 999;
        expect(result.tei_pr99).toBe(72);
    });
});


// ─────────────────────────────────────────────────────────────────────────────
// ❽ compareTrend
// ─────────────────────────────────────────────────────────────────────────────

describe('compareTrend', () => {
    it('上升超過 1 → direction: up', () => {
        const prev = makeTEIResult({ tei_pr99: 60 });
        const curr = makeTEIResult({ tei_pr99: 65 });
        const trend = adapter.compareTrend(prev, curr);
        expect(trend.direction).toBe('up');
        expect(trend.delta).toBe(5);
    });

    it('下降超過 1 → direction: down', () => {
        const prev = makeTEIResult({ tei_pr99: 65 });
        const curr = makeTEIResult({ tei_pr99: 60 });
        const trend = adapter.compareTrend(prev, curr);
        expect(trend.direction).toBe('down');
        expect(trend.delta).toBe(-5);
    });

    it('變化在 ±1 內 → direction: stable', () => {
        const prev = makeTEIResult({ tei_pr99: 60 });
        const curr = makeTEIResult({ tei_pr99: 61 });
        const trend = adapter.compareTrend(prev, curr);
        expect(trend.direction).toBe('stable');
    });

    it('跨越 Grade 邊界 → significant: true', () => {
        const prev = makeTEIResult({ tei_pr99: 79 });
        const curr = makeTEIResult({ tei_pr99: 80 });
        const trend = adapter.compareTrend(prev, curr);
        expect(trend.significant).toBeTruthy();
    });

    it('同一 Grade 內 → significant: false', () => {
        const prev = makeTEIResult({ tei_pr99: 60 });
        const curr = makeTEIResult({ tei_pr99: 70 });
        const trend = adapter.compareTrend(prev, curr);
        expect(trend.significant).toBeFalsy();
    });

    it('上升 → arrow ↑', () => {
        const prev = makeTEIResult({ tei_pr99: 60 });
        const curr = makeTEIResult({ tei_pr99: 70 });
        expect(adapter.compareTrend(prev, curr).arrow).toBe('↑');
    });

    it('下降 → arrow ↓', () => {
        const prev = makeTEIResult({ tei_pr99: 70 });
        const curr = makeTEIResult({ tei_pr99: 60 });
        expect(adapter.compareTrend(prev, curr).arrow).toBe('↓');
    });

    it('穩定 → arrow →', () => {
        const prev = makeTEIResult({ tei_pr99: 70 });
        const curr = makeTEIResult({ tei_pr99: 70 });
        expect(adapter.compareTrend(prev, curr).arrow).toBe('→');
    });

    it('DEGRADED(34) → NEUTRAL(35) 是 significant', () => {
        const prev = makeTEIResult({ tei_pr99: 34 });
        const curr = makeTEIResult({ tei_pr99: 35 });
        expect(adapter.compareTrend(prev, curr).significant).toBeTruthy();
    });
});


// ─────────────────────────────────────────────────────────────────────────────
// ❾ toAriaLabel
// ─────────────────────────────────────────────────────────────────────────────

describe('toAriaLabel', () => {
    it('包含 TEI 值', () => {
        const label = adapter.toAriaLabel(makeTEIResult({ tei_pr99: 72 }));
        expect(label).toContain('72');
    });

    it('包含 consumerText', () => {
        const label = adapter.toAriaLabel(makeTEIResult({ tei_pr99: 72 }));
        expect(label).toContain('良好狀態');
    });

    it('包含信心度百分比', () => {
        const label = adapter.toAriaLabel(makeTEIResult({ confidence: 0.85 }));
        expect(label).toContain('85%');
    });
});


// ─────────────────────────────────────────────────────────────────────────────
// ❿ 錯誤輸入防呆
// ─────────────────────────────────────────────────────────────────────────────

describe('錯誤輸入防呆', () => {
    it('非物件 teiResult → TypeError', () => {
        expect(() => adapter.format('invalid', 'consumer')).toThrow();
    });

    it('tei_pr99 = 0 → RangeError', () => {
        expect(() => adapter.format(makeTEIResult({ tei_pr99: 0 }), 'consumer')).toThrow();
    });

    it('tei_pr99 = 100 → RangeError', () => {
        expect(() => adapter.format(makeTEIResult({ tei_pr99: 100 }), 'consumer')).toThrow();
    });

    it('null teiResult → TypeError', () => {
        expect(() => adapter.format(null, 'consumer')).toThrow();
    });

    it('缺少 inputs.sources → TypeError', () => {
        const r = makeTEIResult();
        delete r.inputs;
        expect(() => adapter.format(r, 'consumer')).toThrow();
    });

    it('無效 userLevel → fallback consumer', () => {
        const d = adapter.format(makeTEIResult(), 'unknown-level');
        expect(d.mode).toBe('consumer');
    });
});


// ─────────────────────────────────────────────────────────────────────────────
// ⓫ getAllGrades / getLevelMeta
// ─────────────────────────────────────────────────────────────────────────────

describe('getAllGrades / getLevelMeta', () => {
    it('getAllGrades 返回 4 個 grade 的副本', () => {
        const grades = adapter.getAllGrades();
        expect(grades.length).toBe(4);
    });

    it('getAllGrades 返回副本，修改不影響原始資料', () => {
        const grades = adapter.getAllGrades();
        grades[0].color = '#FFFFFF';
        const grades2 = adapter.getAllGrades();
        expect(grades2[0].color).toBe('#F5A623');
    });

    it('getLevelMeta quick 包含 electric_bolt', () => {
        const meta = adapter.getLevelMeta('quick');
        expect(meta.icon).toBe('electric_bolt');
    });

    it('getLevelMeta ultra 包含 diamond', () => {
        const meta = adapter.getLevelMeta('ultra');
        expect(meta.icon).toBe('diamond');
    });

    it('getLevelMeta 未知等級 fallback 到 quick', () => {
        const meta = adapter.getLevelMeta('unknown');
        expect(meta.icon).toBe('electric_bolt');
    });
});


// ─────────────────────────────────────────────────────────────────────────────
// ⓬ EventBridgeV2 整合使用情境
// ─────────────────────────────────────────────────────────────────────────────

describe('EventBridgeV2 整合情境模擬', () => {
    it('模擬 tenki:tei-progressive 事件 → consumer 格式化', () => {
        const teiResult = makeTEIResult({ tei_pr99: 78, level: 'precise', confidence: 0.91 });

        const display = adapter.format(teiResult, 'consumer');

        expect(display.primary).toBe('78%');
        expect(display.mode).toBe('consumer');
        expect(display.color).toBe('#00CCFF');
        expect(display.haptic).toBe('none');
    });

    it('模擬 PEAK 狀態 trader 格式化', () => {
        const teiResult = makeTEIResult({ tei_pr99: 85, level: 'ultra', confidence: 0.95 });

        const display = adapter.format(teiResult, 'trader');

        expect(display.grade).toBe('PEAK');
        expect(display.color).toBe('#F5A623');
        expect(display.haptic).toBe('pulse');
        expect(display.action).toContain('嚴守風控');
    });

    it('模擬快速掃描後精度提升流程', () => {
        const quick = makeTEIResult({ tei_pr99: 65, level: 'quick', confidence: 0.2, error_margin_pr99: 15 });
        const standard = makeTEIResult({ tei_pr99: 70, level: 'standard', confidence: 0.7, error_margin_pr99: 7 });
        const precise = makeTEIResult({ tei_pr99: 72, level: 'precise', confidence: 0.88, error_margin_pr99: 4 });

        const d1 = adapter.format(quick, 'expert');
        const d2 = adapter.format(standard, 'expert');
        const d3 = adapter.format(precise, 'expert');

        expect(d1.rangeDetail).toContain('±15');
        expect(d2.rangeDetail).toContain('±7');
        expect(d3.rangeDetail).toContain('±4');

        expect(d1.subtitle).toContain('初步估算');
        expect(d3.subtitle).toContain('非常可靠');
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
