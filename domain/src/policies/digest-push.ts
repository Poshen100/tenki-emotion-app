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

/**
 * ET 16:00 —— 交易日結束的時刻。在這之前不推（§4 L2：答案要到那時才存在）。
 */
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

/**
 * 這一則提醒在裝置上的 tag。
 *
 * 🔴 **為什麼這裡可以用一個常數，而快訊不行**：tag 是一句宣稱 ——
 * 「這兩則是同一件事，後到的可以取代先到的」。快訊的「同一件事」是**同一個
 * 標的**（所以 `pushNotificationTag()` 吃 symbol；寫死一個常數曾讓 NQ1! 靜靜
 * 蓋掉 ES1!）。這一則不同：`digestDecision()` 保證**一天最多一則**，所以兩則
 * 提醒一定落在不同的日子，而舊的那一則在新的出現時已經過時 —— 取代是對的。
 *
 * ⚠️ 這個常數的正當性**整個靠 `already_sent_today` 那道閘**。哪天一天會推兩則
 * （例如拆成不同標的），這個 tag 就會開始弄丟其中一則，要跟著改。
 *
 * ⚠️ 而且它必須跟快訊的 tag 不同命名空間（`docs/DECISION-RECORD-LOOP.md` §4
 * L2 的三個洞之一）：共用 tag 會讓提醒**蓋掉一則真正的快訊**。
 */
export const DIGEST_PUSH_TAG = 'tenki-digest';

/**
 * 這一則提醒的文案。
 *
 * 🔴 **刻意不講「今天」**，雖然 §4 L2 的原文是「今天有 1 筆還沒填結果」。
 * cron 排在 ET 收市後，而使用者在 UTC+8 —— 通知抵達時他的日曆已經翻頁了，
 * 「今天」會指到一個**還沒發生的**交易日。講一個數字就好：數字是事實，
 * 日期在這個時區組合下不是。
 *
 * 🔴 沒有 user-facing 的金融／醫療措辭，也不講「該去做什麼」——
 * 它是一句事實（還有幾筆沒記），不是一個催辦。
 *
 * @param count - Records still awaiting a result (must be ≥ 1).
 * @returns Notification title and body.
 * @throws RangeError when `count` is not a positive integer — there is no
 *   honest copy for "zero left to fill", and coercing one would be the
 *   `null → 0` mistake in a different costume.
 */
export function buildDigestCopy(count: number): { title: string; body: string } {
  if (!Number.isInteger(count) || count < 1) {
    throw new RangeError(`buildDigestCopy needs a positive integer, got ${count}`);
  }
  return {
    title: 'TENKI 決策紀錄',
    body: `有 ${count} 筆決策還沒記下結果`,
  };
}
