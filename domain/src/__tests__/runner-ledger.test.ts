/**
 * Runner 帳本的兩個窄事實（founder 2026-11-03「兩個窄事實」）。
 *
 * 🔴 這支守的重點是**「沒答」跟「答了某個值」不可以混**。把沒回報的
 * `firstLevelLock` 當成 `'not_locked'`，就是把「他沒告訴我們」講成
 * 「他沒做」—— 而這一欄看起來最像成績，那個謊代價最大。
 */
import * as runnerLedger from '../contracts/runner-ledger';
import {
  FIRST_LEVEL_LOCKS,
  RUNNER_OUTCOMES,
  allowsRunnerLedger,
  isFirstLevelLock,
  isRunnerOutcome,
  readRunnerLedger,
  runnerLedgerConflict,
} from '../contracts/runner-ledger';

describe('適用範圍', () => {
  it('只有真的進場的那一筆有 runner 可言', () => {
    expect(allowsRunnerLedger('judged_entered')).toBe(true);
  });

  it('🔴 判定不成立／未判定就離開 → 不問（問了會得到一個關於不存在的部位的答案）', () => {
    expect(allowsRunnerLedger('judged_stood_down')).toBe(false);
    expect(allowsRunnerLedger('abandoned_no_judgment')).toBe(false);
    expect(allowsRunnerLedger('timed_out')).toBe(false);
    expect(allowsRunnerLedger(null)).toBe(false);
    expect(allowsRunnerLedger(undefined)).toBe(false);
  });
});

describe('沒答 ≠ 答了', () => {
  it('🔴 兩欄都沒有 → 兩欄都不存在（不是 null、不是預設值）', () => {
    const ledger = readRunnerLedger({});
    expect(ledger).toEqual({});
    expect('firstLevelLock' in ledger).toBe(false);
    expect('runnerOutcome' in ledger).toBe(false);
  });

  it('🔴 認不得的值要**丟掉**，不得退回第一個枚舉值', () => {
    const ledger = readRunnerLedger({ firstLevelLock: 'yes', runnerOutcome: 42 });
    expect(ledger).toEqual({});
    // 成對的另一半：真的值要留得住，否則上面那條用「全部丟掉」也能綠。
    expect(readRunnerLedger({ firstLevelLock: 'locked' })).toEqual({ firstLevelLock: 'locked' });
  });

  it('只答了一半 → 就只有那一半', () => {
    expect(readRunnerLedger({ runnerOutcome: 'cut_early' })).toEqual({ runnerOutcome: 'cut_early' });
  });

  it('守門函式認得每一個合法值，而且只認它們', () => {
    FIRST_LEVEL_LOCKS.forEach((v) => {
      expect(isFirstLevelLock(v)).toBe(true);
    });
    RUNNER_OUTCOMES.forEach((v) => {
      expect(isRunnerOutcome(v)).toBe(true);
    });
    expect(isFirstLevelLock('still_running')).toBe(false);
    expect(isRunnerOutcome('locked')).toBe(false);
    expect(isFirstLevelLock(null)).toBe(false);
    expect(isRunnerOutcome(undefined)).toBe(false);
  });

  it('🔴 「沒到第一級」是一等公民，不是缺值', () => {
    // 價格沒走到第一級是**市場的事實**，混進 not_locked 會讓它讀起來像
    // 一次紀律失誤 —— 而那件事他根本沒得選。
    expect(FIRST_LEVEL_LOCKS).toContain('never_reached');
    expect(readRunnerLedger({ firstLevelLock: 'never_reached' }))
      .toEqual({ firstLevelLock: 'never_reached' });
  });

  it('🔴 「還在跑」也是一等公民 —— 它讓這兩個事實在交易還沒結束前就答得出來', () => {
    expect(RUNNER_OUTCOMES).toContain('still_running');
  });
});

describe('唯一站得住的那個矛盾', () => {
  it('🔴 說「還在跑」而紀錄已經有結束的結果 → 顯示衝突，不挑一邊', () => {
    expect(runnerLedgerConflict({ runnerOutcome: 'still_running' }, { tradeResult: 'profit_taken' }))
      .toBe('still_running_but_closed');
    expect(runnerLedgerConflict({ runnerOutcome: 'still_running' }, { tradeResult: 'stopped_out' }))
      .toBe('still_running_but_closed');
    expect(runnerLedgerConflict({ runnerOutcome: 'still_running' }, { tradeResult: 'scratch' }))
      .toBe('still_running_but_closed');
  });

  it('🔴 有出場時刻也算已經結束（兩條路都要擋，不只看 tradeResult）', () => {
    expect(runnerLedgerConflict({ runnerOutcome: 'still_running' }, { closedAt: 1_762_000_000_000 }))
      .toBe('still_running_but_closed');
  });

  it('還在跑 + 結果還是 pending → 沒有矛盾（這是正常狀態）', () => {
    expect(runnerLedgerConflict({ runnerOutcome: 'still_running' }, { tradeResult: 'pending' }))
      .toBeNull();
    expect(runnerLedgerConflict({ runnerOutcome: 'still_running' }, {})).toBeNull();
    expect(runnerLedgerConflict({ runnerOutcome: 'still_running' }, { closedAt: null })).toBeNull();
  });

  it('🔴 看起來怪但**不是**矛盾的那幾組，一律放行', () => {
    // 這幾條存在的理由是擋下一個人「順手把它們也擋掉」——
    // 每一組都是一份說得通的回報。
    expect(runnerLedgerConflict(
      { firstLevelLock: 'never_reached', runnerOutcome: 'structure_failed' },
      { tradeResult: 'stopped_out', closedAt: 1_762_000_000_000 },
    )).toBeNull();
    expect(runnerLedgerConflict(
      { firstLevelLock: 'not_locked', runnerOutcome: 'no_runner' },
      { tradeResult: 'profit_taken' },
    )).toBeNull();
    expect(runnerLedgerConflict(
      { firstLevelLock: 'locked', runnerOutcome: 'no_runner' },
      { tradeResult: 'profit_taken', closedAt: 1_762_000_000_000 },
    )).toBeNull();
  });

  it('沒回報 runner 結局 → 沒有矛盾可言', () => {
    expect(runnerLedgerConflict({}, { tradeResult: 'profit_taken', closedAt: 1 })).toBeNull();
    expect(runnerLedgerConflict({ firstLevelLock: 'locked' }, { tradeResult: 'profit_taken' }))
      .toBeNull();
  });
});

describe('合規邊界', () => {
  it('🔴 這份契約不得輸出任何分數／比率／連續天數', () => {
    // 這條是機械性的：以後有人加一個 `alignmentRate()` 進來，它會紅。
    // 「對齊率」那一格退場過一次（§10 item 7），不得從這裡回來。
    // 讀整個 module 的 namespace —— `export type` 在執行期不存在，
    // 所以這裡看到的就是它真的輸出的「值」。
    expect(Object.keys(runnerLedger).sort()).toEqual([
      'FIRST_LEVEL_LOCKS',
      'RUNNER_OUTCOMES',
      'allowsRunnerLedger',
      'isFirstLevelLock',
      'isRunnerOutcome',
      'readRunnerLedger',
      'runnerLedgerConflict',
    ]);
  });
});
