/**
 * @module domain/policies/digest-push
 * @description L2 的判準：收盤後那一則「還有幾筆沒填」要不要推。
 * Canonical behavior spec: `docs/DECISION-RECORD-LOOP.md` §4 L2。
 *
 * 🔴 **為什麼需要一個「回報」而不是伺服器自己算**：決策紀錄只活在裝置的
 * `localStorage`（local-first）。伺服器存的是快訊佇列、頻道標記、預設 symbol、
 * 推播訂閱 —— **它從來沒看過任何一筆紀錄**。而 §4 原則 1 要求「只在它確知
 * 有東西沒記的時候提醒 —— 零猜測」。兩件事湊不起來，所以 founder 2026-10-30
 * 裁決：**裝置只回報一個整數＋一個時間戳**（沒有標的、沒有結果、沒有判定）。
 *
 * 🔴 這份判準最重要的性質：**沒有新鮮的事實就不推**。回報過期 ＝ 我們不知道
 * 現在幾筆 ＝ 不猜（§4 原則 5「問不到就不問了」）。它不是一個保險閥，
 * 它就是「零猜測」這條原則在程式裡的樣子。
 *
 * Pure functions —— 狀態由 `api/` 從 Upstash 讀進來再傳進這裡。
 */

import { TRADING_DAY_TZ, resolveTradingDayKey } from './day-cadence';

/** 回報在 Upstash 的存活時間。跨過它的回報一定算過期。 */
export const DIGEST_REPORT_TTL_SEC = 172_800;

/**
 * 連續幾天推了沒反應就停（§4 原則 5：永不放棄的提醒會變成噪音）。
 *
 * 「沒反應」的判準是**待填數字沒有下降** —— 那是我們唯一真的觀測得到的事。
 * 「他有沒有點開通知」伺服器看不到，拿它當判準會是在猜。
 */
export const DIGEST_SILENT_STREAK_MAX = 3;

/** ET 收盤（16:00）。在這之前不推 —— 答案要到收盤才存在（§4 L2）。 */
export const TRADING_CLOSE_ET_HOUR = 16;

/** 不推的時候，為什麼不推。每一個都是一句**事實**，不是一個藉口。 */
export type DigestSkipReason =
  | 'before_close'
  | 'no_report'
  | 'stale_report'
  | 'nothing_open'
  | 'already_sent_today'
  | 'silent_streak';

/** 伺服器手上關於某個頻道的全部狀態。 */
export interface DigestState {
  /** 裝置最後一次回報的「今天還沒填結果」筆數。沒回報過就是 null。 */
  openCount: number | null;
  /** 那次回報的時刻。沒回報過就是 null。 */
  reportedAtMs: number | null;
  /** 最後一次推播是哪個 ET 交易日。沒推過就是 null。 */
  lastSentDayKey: string | null;
  /** 最後一次推播當下的筆數 —— 用來判斷「有沒有反應」。 */
  lastSentCount: number | null;
  /** 連續幾天推了沒反應。 */
  silentStreak: number;
}

export interface DigestDecision {
  send: boolean;
  /** 不推的理由。`send` 為 true 時不存在。 */
  reason?: DigestSkipReason;
  /** 要推的筆數。`send` 為 true 時才有。 */
  count?: number;
}

/**
 * 這個時刻在 ET 是幾點。
 *
 * 用 `Intl` 而不是自己算時差 —— DST 一年動兩次，手算一定會在某一週錯。
 * 同 `resolveTradingDayKey` 的既有做法。
 *
 * @param nowMs - Instant to resolve (Unix ms).
 * @returns Hour 0-23 in ET.
 */
export function etHour(nowMs: number): number {
  const hour = new Intl.DateTimeFormat('en-US', {
    timeZone: TRADING_DAY_TZ,
    hour: '2-digit',
    hour12: false,
  }).format(new Date(nowMs));
  // `en-US` 的 24 小時制在午夜回 '24'，不是 '00'。
  const n = Number(hour);
  return n === 24 ? 0 : n;
}

/**
 * 現在是不是收盤之後。
 *
 * 🔴 **為什麼要擋**：§4 L2 的理由是「答案在這一刻才存在」。盤中問是在問一件
 * 還沒發生的事。cron 本身排在兩種 DST 下都落在收盤後，所以這條平常不會擋到
 * 任何東西 —— 它擋的是**有人手動打這個端點**。照實說：它是縱深防禦。
 *
 * @param nowMs - Instant to test (Unix ms).
 * @returns True once ET has passed the close hour that day.
 */
export function isAfterTradingClose(nowMs: number): boolean {
  return etHour(nowMs) >= TRADING_CLOSE_ET_HOUR;
}

/**
 * 推完之後，連續沒反應的天數變成多少。
 *
 * 🔴 「反應」＝ **待填數字下降了**。那是伺服器唯一真的觀測得到的事；
 * 「他點開通知了嗎」看不到，拿它當判準會是在猜。
 *
 * @param prevStreak - Streak before this report.
 * @param lastSentCount - Open count at the moment of the last push.
 * @param currentCount - Open count the device just reported.
 * @returns The streak after accounting for this report.
 */
export function nextSilentStreak(
  prevStreak: number,
  lastSentCount: number | null,
  currentCount: number,
): number {
  if (lastSentCount === null) return prevStreak;
  // 下降 ＝ 他真的去填了 → 歸零。
  if (currentCount < lastSentCount) return 0;
  return prevStreak + 1;
}

/**
 * 這一則收盤提醒要不要推。
 *
 * 判準順序是刻意的：**先擋「我不知道」，再擋「沒必要」**。
 * 反過來的話，一個過期的回報會先被當成 `nothing_open`，而那是一句
 * 我們說不出口的話（我們不知道他現在有沒有東西要填）。
 *
 * @param state - What the server holds for this channel.
 * @param nowMs - Instant the cron fired (Unix ms).
 * @returns Whether to push, and the count or the reason why not.
 */
export function digestDecision(state: DigestState, nowMs: number): DigestDecision {
  if (!isAfterTradingClose(nowMs)) return { send: false, reason: 'before_close' };

  // 🔴 「我不知道」排在最前面。
  if (state.reportedAtMs === null || state.openCount === null) {
    return { send: false, reason: 'no_report' };
  }
  const today = resolveTradingDayKey(nowMs);
  if (resolveTradingDayKey(state.reportedAtMs) !== today) {
    return { send: false, reason: 'stale_report' };
  }

  if (state.silentStreak >= DIGEST_SILENT_STREAK_MAX) {
    return { send: false, reason: 'silent_streak' };
  }
  if (state.lastSentDayKey === today) {
    return { send: false, reason: 'already_sent_today' };
  }
  if (state.openCount <= 0) return { send: false, reason: 'nothing_open' };

  return { send: true, count: state.openCount };
}
