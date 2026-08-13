import {
  findProhibitedTerms,
  isCompliantCopy,
  PROHIBITED_VOCABULARY_ZH,
} from '../safe-copy';

/**
 * Canonical Decision Entry Panel copy defined in
 * docs/TRADINGVIEW-ALERT-SPEC.md §6. Locked by test so future edits
 * cannot drift into prohibited vocabulary.
 */
const CANONICAL_ALERT_PANEL_COPY = [
  '你要進入決策流程嗎？',
  '進入決策',
  '略過',
  '你目前的狀態：Neutral（Decision Edge Score 58）',
  '在此狀態下，你過去的紀律完成率',
  'NVDA 快訊（已接收）',
  '2 個決策機會：NVDA / TSLA',
];

describe('Chinese prohibited vocabulary', () => {
  it('flags the rejected 勝率 framing from the original alert spec', () => {
    const found = findProhibitedTerms('你過去 Breakout 勝率：42%');
    expect(found).toContain('勝率');
  });

  it('flags financial action-directive terms', () => {
    expect(isCompliantCopy('建議買入 NVDA')).toBe(false);
    expect(isCompliantCopy('現在進場，保證獲利')).toBe(false);
    expect(isCompliantCopy('跌破就停損')).toBe(false);
  });

  it('does not false-positive on Premium purchase copy', () => {
    expect(isCompliantCopy('購買 Premium 解鎖外部快訊')).toBe(true);
  });

  it('keeps every listed term multi-character to limit false positives', () => {
    for (const term of PROHIBITED_VOCABULARY_ZH) {
      expect(term.length).toBeGreaterThanOrEqual(2);
    }
  });
});

/**
 * `PR99` 於 2026-08-11 由 founder **內部解禁**（code 註解／docs／commit message
 * 都可以用），但仍**不得進 user-facing copy**。封鎖點因此從
 * `scripts/check-vocab.sh`（全代碼掃描）搬到這裡（只管用戶看得到的字）。
 *
 * 🔴 理由是台灣語境：「PR 值」壓倒性地指基測／學測 —— **跟別人比的排名**，
 * 而 Edge Score 的承諾恰好相反（跟你自己比）。這個詞會主動誤導目標使用者。
 */
describe('PR99 — internal-only vocabulary', () => {
  it('🔴 is rejected in user-facing copy', () => {
    expect(isCompliantCopy('Your PR99 is 85')).toBe(false);
    expect(findProhibitedTerms('Your PR99 is 85')).toContain('pr99');
  });

  it('is matched case-insensitively', () => {
    expect(isCompliantCopy('your pr99 today')).toBe(false);
  });

  it('does not flag the approved name', () => {
    expect(isCompliantCopy('Your Edge Score is 85')).toBe(true);
  });
});

describe('canonical alert panel copy', () => {
  it.each(CANONICAL_ALERT_PANEL_COPY)('passes compliance: %s', text => {
    expect(findProhibitedTerms(text)).toEqual([]);
  });
});

describe('English behavior regression', () => {
  it('still flags win rate', () => {
    expect(isCompliantCopy('Your past win rate is 42%')).toBe(false);
  });

  it('still passes process language', () => {
    expect(isCompliantCopy('Discipline and process, session by session')).toBe(true);
  });
});
