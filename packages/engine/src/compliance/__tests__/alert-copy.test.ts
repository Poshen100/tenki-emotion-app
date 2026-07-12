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
