import {
  DIGEST_SILENT_STREAK_MAX,
  TRADING_CLOSE_ET_HOUR,
  digestDecision,
  etHour,
  isAfterTradingClose,
  nextSilentStreak,
} from '../policies/digest-push';
import type { DigestState } from '../policies/digest-push';

/** 某個 ET 日期與時刻對應的 UTC 瞬間（夏令／冬令各自換算）。 */
const ET = (iso: string): number => new Date(iso).getTime();
// 2026-07-15 是 EDT（UTC-4）；2026-01-15 是 EST（UTC-5）。
const SUMMER_CLOSE = ET('2026-07-15T20:05:00Z'); // ET 16:05
const SUMMER_NOON = ET('2026-07-15T16:00:00Z'); // ET 12:00
const WINTER_CLOSE = ET('2026-01-15T21:05:00Z'); // ET 16:05
const WINTER_NOON = ET('2026-01-15T17:00:00Z'); // ET 12:00

const base: DigestState = {
  openCount: 1,
  reportedAtMs: SUMMER_CLOSE - 60 * 60 * 1000,
  lastSentDayKey: null,
  lastSentCount: null,
  silentStreak: 0,
};

describe('etHour / isAfterTradingClose', () => {
  // 🔴 DST 兩邊都要測。只測一邊的話，固定時差的寫法會在半年裡是對的。
  it('夏令（EDT）：UTC 20:05 ＝ ET 16:05', () => {
    expect(etHour(SUMMER_CLOSE)).toBe(16);
  });

  it('冬令（EST）：UTC 21:05 ＝ ET 16:05', () => {
    expect(etHour(WINTER_CLOSE)).toBe(16);
  });

  it('🔴 同一個 UTC 時刻在兩個季節是不同的 ET 小時（證明它真的在換算）', () => {
    const utc2005 = ET('2026-01-15T20:05:00Z');
    expect(etHour(utc2005)).toBe(TRADING_CLOSE_ET_HOUR - 1);
  });

  it('收盤後為真，盤中為假（夏令）', () => {
    expect(isAfterTradingClose(SUMMER_CLOSE)).toBe(true);
    expect(isAfterTradingClose(SUMMER_NOON)).toBe(false);
  });

  it('收盤後為真，盤中為假（冬令）', () => {
    expect(isAfterTradingClose(WINTER_CLOSE)).toBe(true);
    expect(isAfterTradingClose(WINTER_NOON)).toBe(false);
  });

  it('午夜回 0，不是 24', () => {
    expect(etHour(ET('2026-07-15T04:30:00Z'))).toBe(0);
  });
});

describe('nextSilentStreak', () => {
  it('還沒推過就不動它', () => {
    expect(nextSilentStreak(2, null, 5)).toBe(2);
  });

  // 🔴 「反應」＝ 數字下降。那是伺服器唯一觀測得到的事。
  it('數字下降 → 歸零（他真的去填了）', () => {
    expect(nextSilentStreak(2, 3, 1)).toBe(0);
  });

  it('數字沒動 → +1', () => {
    expect(nextSilentStreak(2, 3, 3)).toBe(3);
  });

  it('數字變多 → 也算沒反應（他沒填，只是又多了一筆）', () => {
    expect(nextSilentStreak(1, 3, 5)).toBe(2);
  });
});

describe('digestDecision', () => {
  it('有新鮮回報、有待填、今天還沒推 → 推', () => {
    expect(digestDecision(base, SUMMER_CLOSE)).toEqual({ send: true, count: 1 });
  });

  it('🔴 盤中不推（答案要到收盤才存在）', () => {
    expect(digestDecision(base, SUMMER_NOON)).toEqual({
      send: false,
      reason: 'before_close',
    });
  });

  it('🔴 從來沒回報過 → 不推，而且理由是「不知道」不是「沒有」', () => {
    expect(
      digestDecision({ ...base, openCount: null, reportedAtMs: null }, SUMMER_CLOSE),
    ).toEqual({ send: false, reason: 'no_report' });
  });

  // 🔴 這一條是「零猜測」在程式裡的樣子：回報不是今天的 → 我們不知道他現在
  //    有沒有東西要填 → 不推。而且理由不得退化成 nothing_open。
  it('🔴 回報不是今天的交易日 → stale_report（不是 nothing_open）', () => {
    const yesterday = ET('2026-07-14T20:05:00Z');
    expect(
      digestDecision({ ...base, reportedAtMs: yesterday }, SUMMER_CLOSE),
    ).toEqual({ send: false, reason: 'stale_report' });
  });

  it('🔴 過期的回報就算數字是 0 也回 stale_report —— 順序不能反', () => {
    const yesterday = ET('2026-07-14T20:05:00Z');
    expect(
      digestDecision({ ...base, openCount: 0, reportedAtMs: yesterday }, SUMMER_CLOSE),
    ).toEqual({ send: false, reason: 'stale_report' });
  });

  it('今天沒有待填 → 不推', () => {
    expect(digestDecision({ ...base, openCount: 0 }, SUMMER_CLOSE)).toEqual({
      send: false,
      reason: 'nothing_open',
    });
  });

  it('今天推過了 → 一天最多一則', () => {
    expect(
      digestDecision({ ...base, lastSentDayKey: '2026-07-15' }, SUMMER_CLOSE),
    ).toEqual({ send: false, reason: 'already_sent_today' });
  });

  it('昨天推過不影響今天', () => {
    expect(
      digestDecision({ ...base, lastSentDayKey: '2026-07-14' }, SUMMER_CLOSE),
    ).toEqual({ send: true, count: 1 });
  });

  it(`🔴 連續 ${DIGEST_SILENT_STREAK_MAX} 天沒反應就停`, () => {
    expect(
      digestDecision({ ...base, silentStreak: DIGEST_SILENT_STREAK_MAX }, SUMMER_CLOSE),
    ).toEqual({ send: false, reason: 'silent_streak' });
  });

  it(`差一天還沒到上限 → 照推`, () => {
    expect(
      digestDecision({ ...base, silentStreak: DIGEST_SILENT_STREAK_MAX - 1 }, SUMMER_CLOSE),
    ).toEqual({ send: true, count: 1 });
  });

  it('冬令也走同一條路（ET 判斷不是寫死的時差）', () => {
    expect(
      digestDecision({ ...base, reportedAtMs: WINTER_CLOSE - 3600e3 }, WINTER_CLOSE),
    ).toEqual({ send: true, count: 1 });
  });
});
