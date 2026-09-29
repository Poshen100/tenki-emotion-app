import {
  type DomainTradeResult,
  countsAsTrade,
  isLoss,
  isWin,
  normalizeTradeResult,
} from '../contracts/trade-result';
import {
  DAILY_TRADE_BUDGET,
  resolveDayCadence,
  resolveTradingDayKey,
} from '../policies/day-cadence';

/** 2026-08-04 10:00 ET (14:00 UTC, EDT) — a normal in-session weekday morning. */
const MORNING_ET = Date.parse('2026-08-04T14:00:00Z');

function rec(result: DomainTradeResult | null, offsetMs = 0) {
  return { ts: MORNING_ET + offsetMs, tradeResult: result };
}

const MIN = 60_000;

describe('resolveTradingDayKey', () => {
  it('uses the ET calendar day, not UTC', () => {
    // 2026-08-04 21:00 ET = 2026-08-05 01:00 UTC. A UTC key would say the 5th.
    const eveningET = Date.parse('2026-08-05T01:00:00Z');
    expect(resolveTradingDayKey(eveningET)).toBe('2026-08-04');
  });

  it('is DST-aware (EST vs EDT both land on the ET date)', () => {
    // January = EST (UTC-5): 2026-01-15 20:00 ET = 2026-01-16 01:00 UTC
    expect(resolveTradingDayKey(Date.parse('2026-01-16T01:00:00Z'))).toBe('2026-01-15');
    // July = EDT (UTC-4): 2026-07-15 21:00 ET = 2026-07-16 01:00 UTC
    expect(resolveTradingDayKey(Date.parse('2026-07-16T01:00:00Z'))).toBe('2026-07-15');
  });
});

describe('resolveDayCadence — §6.1 daily cadence', () => {
  it('no records at all → fresh', () => {
    const out = resolveDayCadence([], MORNING_ET);
    expect(out.state).toBe('fresh');
    expect(out.tradesToday).toBe(0);
  });

  it('first trade taken profit → stop_after_win（贏停規則）', () => {
    const out = resolveDayCadence([rec('profit_taken')], MORNING_ET + 30 * MIN);
    expect(out.state).toBe('stop_after_win');
    expect(out.tradesToday).toBe(1);
  });

  it('first trade stopped out → second_chance（輸的續作）', () => {
    const out = resolveDayCadence([rec('stopped_out')], MORNING_ET + 30 * MIN);
    expect(out.state).toBe('second_chance');
    expect(out.tradesToday).toBe(1);
  });

  it('two stop-outs → circuit_break（雙輸熔斷）', () => {
    const out = resolveDayCadence(
      [rec('stopped_out'), rec('stopped_out', 20 * MIN)],
      MORNING_ET + 30 * MIN,
    );
    expect(out.state).toBe('circuit_break');
    expect(out.tradesToday).toBe(2);
  });

  it('win then loss → day_complete, NOT circuit_break', () => {
    const out = resolveDayCadence(
      [rec('profit_taken'), rec('stopped_out', 20 * MIN)],
      MORNING_ET + 30 * MIN,
    );
    expect(out.state).toBe('day_complete');
    expect(out.tradesToday).toBe(2);
  });

  it('scratch is not a win — it does not trigger 贏停', () => {
    const out = resolveDayCadence([rec('scratch')], MORNING_ET + 30 * MIN);
    expect(out.state).toBe('second_chance');
  });

  it('scratch is not a loss — two scratches never circuit-break', () => {
    const out = resolveDayCadence(
      [rec('scratch'), rec('scratch', 20 * MIN)],
      MORNING_ET + 30 * MIN,
    );
    expect(out.state).toBe('day_complete');
  });

  it('one scratch + one stop-out is not a double loss', () => {
    const out = resolveDayCadence(
      [rec('scratch'), rec('stopped_out', 20 * MIN)],
      MORNING_ET + 30 * MIN,
    );
    expect(out.state).toBe('day_complete');
  });

  it('no_entry never consumes the daily budget（§7 step 7 是紀律，不是交易）', () => {
    const out = resolveDayCadence(
      [rec('no_entry'), rec('no_entry', 10 * MIN), rec('no_entry', 20 * MIN)],
      MORNING_ET + 30 * MIN,
    );
    expect(out.tradesToday).toBe(0);
    expect(out.state).toBe('fresh');
  });

  it('records predating the contract (null result) are not guessed at', () => {
    const out = resolveDayCadence([rec(null), rec(null, 10 * MIN)], MORNING_ET + 30 * MIN);
    expect(out.tradesToday).toBe(0);
    expect(out.state).toBe('fresh');
  });

  it('ignores yesterday — the tally resets on the ET day boundary', () => {
    const yesterday = MORNING_ET - 24 * 60 * MIN;
    const out = resolveDayCadence(
      [
        { ts: yesterday, tradeResult: 'stopped_out' },
        { ts: yesterday + 20 * MIN, tradeResult: 'stopped_out' },
      ],
      MORNING_ET,
    );
    expect(out.tradesToday).toBe(0);
    expect(out.state).toBe('fresh');
  });

  it('a late-evening ET trade still belongs to that ET day, not the next UTC day', () => {
    // 2026-08-04 21:00 ET (= 2026-08-05 01:00 UTC)
    const eveningET = Date.parse('2026-08-05T01:00:00Z');
    const out = resolveDayCadence(
      [{ ts: eveningET, tradeResult: 'profit_taken' }],
      eveningET + 10 * MIN,
    );
    expect(out.tradesToday).toBe(1);
    expect(out.state).toBe('stop_after_win');
  });

  it('orders by timestamp, not array order, when deciding "the first two"', () => {
    // Loss recorded second in the array but FIRST in time → first two are both losses.
    const out = resolveDayCadence(
      [rec('stopped_out', 20 * MIN), rec('stopped_out')],
      MORNING_ET + 30 * MIN,
    );
    expect(out.state).toBe('circuit_break');
  });

  it('over-budget days still just state the fact', () => {
    const out = resolveDayCadence(
      [rec('profit_taken'), rec('scratch', 10 * MIN), rec('scratch', 20 * MIN)],
      MORNING_ET + 30 * MIN,
    );
    expect(out.tradesToday).toBe(3);
    expect(out.state).toBe('day_complete');
  });

  it('exposes the §6.1 daily budget as a named constant', () => {
    expect(DAILY_TRADE_BUDGET).toBe(2);
  });
});

// 前半是節奏語言的紅線（評價／指示），後半直接照 `PROHIBITED_VOCABULARY_ZH`
// 抄過來 —— 這份清單原本漏了它們，於是 `contextZh` 曾經有兩句帶著「獲利」
// 與「停損」出貨（2026-09-26 抓到）。
//
// 🔴 為什麼是手抄而不是 import：`domain` 刻意不相依 `packages/engine`，
//    跨套件的文字檢查住 `scripts/check-vocab.sh`（PLAYBOOK：不要為一條斷言
//    開新的相依邊）。這裡只抄**這個檔案的文案可能撞到**的那幾個。
//
// 模組層宣告：`pending` 那組斷言也要掃同一份清單 —— 兩份清單遲早會漂移，
// 而漂移的那一份會靜靜地少掃幾個詞。
const BANNED = [
  '勝率', '建議', '應該', '休息', '表現', '獲利率', '期望值', '停手吧',
  '獲利', '虧損', '停損', '停利', '買入', '賣出', '交易建議',
];

describe('resolveDayCadence — compliance of the context line', () => {
  it('every state produces a factual line with no advice or evaluation', () => {
    const cases = [
      resolveDayCadence([], MORNING_ET),
      resolveDayCadence([rec('profit_taken')], MORNING_ET + 30 * MIN),
      resolveDayCadence([rec('stopped_out')], MORNING_ET + 30 * MIN),
      resolveDayCadence(
        [rec('stopped_out'), rec('stopped_out', 20 * MIN)],
        MORNING_ET + 30 * MIN,
      ),
      resolveDayCadence(
        [rec('profit_taken'), rec('scratch', 20 * MIN)],
        MORNING_ET + 30 * MIN,
      ),
    ];
    for (const out of cases) {
      expect(out.contextZh.length).toBeGreaterThan(0);
      for (const word of BANNED) {
        expect(out.contextZh).not.toContain(word);
      }
    }
  });
});

// ═══════════════════════════════════════════════
// `pending` —— 進場了，結果還沒回填
// ═══════════════════════════════════════════════
// founder 2026-09-28 裁決：收束當下就問結果，但「還沒有結果」是預設且完全正常
// 的選項（部位常常在 30 分鐘決策窗關掉之後好幾小時才平倉）。
//
// 🔴 那個裁決如果存成 `null`，整條規則會**靜默失效** —— `resolveDayCadence`
//    用 `countsAsTrade()` 過濾當天紀錄，而 `countsAsTrade(null)` 是 false，
//    於是那筆決策從計數裡整個消失：額度永遠用不完、面板照樣彈、畫面上看不出
//    任何異狀。`pending` 就是為了擋這件事而存在的。
// @see docs/TRADINGVIEW-ALERT-SPEC.md §9b
describe('pending —— 未回填的結果', () => {
  it('算一筆交易（這是它存在的唯一理由）', () => {
    expect(countsAsTrade('pending')).toBe(true);
  });

  it('既不是贏也不是輸 —— 未知不等於好，也不等於壞', () => {
    expect(isWin('pending')).toBe(false);
    expect(isLoss('pending')).toBe(false);
  });

  it('跟 null 是兩件事：null 不算一筆，pending 算', () => {
    // null ＝ 連有沒有交易都不知道（契約前紀錄／未判定就離開）
    expect(countsAsTrade(null)).toBe(false);
    // pending ＝ 交易發生了，只是結果還沒回填
    expect(countsAsTrade('pending')).toBe(true);
  });

  it('存得回來（不會被 normalize 成 null）', () => {
    expect(normalizeTradeResult('pending')).toBe('pending');
  });

  // ⚠️ 這條是本組的核心：它直接驗「額度會被消耗」。
  // 把 pending 換成 null（也就是回到裁決被誤實作的樣子）→ tradesToday 變 0、
  // state 變 fresh，這條紅。
  it('🔴 一筆未回填的決策仍然消耗當日額度', () => {
    const out = resolveDayCadence([rec('pending')], MORNING_ET + 30 * MIN);
    expect(out.tradesToday).toBe(1);
    expect(out.state).not.toBe('fresh');
  });

  it('一筆 pending → second_chance，不是 stop_after_win（未知 ≠ 贏，第二次機會保持開著）', () => {
    const out = resolveDayCadence([rec('pending')], MORNING_ET + 30 * MIN);
    expect(out.state).toBe('second_chance');
  });

  it('兩筆 pending → day_complete，不是 circuit_break（額度用完是事實，雙輸不是）', () => {
    const out = resolveDayCadence(
      [rec('pending'), rec('pending', 40 * MIN)],
      MORNING_ET + 60 * MIN,
    );
    expect(out.tradesToday).toBe(2);
    expect(out.state).toBe('day_complete');
  });

  it('pending + 停損 → day_complete，不得宣稱一個驗證不了的雙輸', () => {
    const out = resolveDayCadence(
      [rec('pending'), rec('stopped_out', 40 * MIN)],
      MORNING_ET + 60 * MIN,
    );
    expect(out.state).toBe('day_complete');
  });

  it('回填之後節奏狀態會回溯改變（狀態是從紀錄重算的，不能快取）', () => {
    const before = resolveDayCadence([rec('pending')], MORNING_ET + 30 * MIN);
    expect(before.state).toBe('second_chance');
    // 同一筆決策，結果回填成獲利了結之後，贏停規則才成立
    const after = resolveDayCadence([rec('profit_taken')], MORNING_ET + 30 * MIN);
    expect(after.state).toBe('stop_after_win');
  });

  it('contextZh 在 pending 的路徑上仍然只陳述事實', () => {
    const out = resolveDayCadence([rec('pending')], MORNING_ET + 30 * MIN);
    for (const banned of BANNED) {
      expect(out.contextZh).not.toContain(banned);
    }
  });
});
