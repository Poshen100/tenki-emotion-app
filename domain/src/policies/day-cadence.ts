/**
 * @module domain/policies/day-cadence
 * @description Machine-readable form of the daily cadence rules in
 * `docs/TRADING-METHODOLOGY.md` §6.1 — stop after the first win, take a second
 * shot after a loss, stand down after two losses.
 *
 * These are the highest-leverage behavioural rules in the whole method and
 * they were previously unenforceable: nothing persisted said how a decision
 * ended (see `contracts/trade-result`). Without this, a winning first trade
 * was followed by business as usual — the product was helping the trader break
 * their own rule.
 *
 * ⚠️ This policy reports STATE, never instructions. It exists to let a surface
 * state a fact ("today's 2nd decision · the previous one stopped out") and, at
 * most, fold an alert into the silent area. It must never block a decision, and
 * per §10 item 3 (勝率語言已禁) its inputs must never become a win rate.
 */

import type { DomainTradeResult } from '../contracts/trade-result';
import { countsAsTrade, isLoss, isWin } from '../contracts/trade-result';

/** Timezone the trading day is measured in — the methodology's clock (§6.1). */
export const TRADING_DAY_TZ = 'America/New_York';

/** §6.1 頻率：每天 1–2 筆. Reaching this spends the day's budget. */
export const DAILY_TRADE_BUDGET = 2;

/** A persisted decision, reduced to what the cadence rules need. */
export interface DayCadenceRecord {
  /** When the decision was recorded (Unix ms). */
  ts: number;
  /** Self-reported result, or null for records predating the contract. */
  tradeResult: DomainTradeResult | null;
}

/**
 * Where the trader stands in today's cadence.
 *
 * `circuit_break` is deliberately distinct from `day_complete`: two losses is
 * the methodology's explicit stop (§6.1 雙輸熔斷), whereas simply having spent
 * the day's budget is a milder fact.
 */
export const DAY_CADENCE_STATES = [
  'fresh',
  'second_chance',
  'stop_after_win',
  'circuit_break',
  'day_complete',
] as const;
export type DayCadenceState = typeof DAY_CADENCE_STATES[number];

/** Today's cadence position plus a factual line a surface may show verbatim. */
export interface DayCadence {
  /** Decisions that reached the market today (`no_entry` excluded). */
  tradesToday: number;
  state: DayCadenceState;
  /** Factual Chinese context line — states what happened, never what to do. */
  contextZh: string;
}

/**
 * The ET calendar day an instant belongs to.
 *
 * Must NOT reuse `alert-policy`'s `resolveAlertDayKey()` — that one is UTC
 * (`toISOString`), which rolls over at 19:00/20:00 ET and would file an evening
 * trade under tomorrow. §6.1's windows are ET clock times, so the trading day
 * is an ET day. `en-CA` yields YYYY-MM-DD directly; `Intl` handles DST.
 *
 * @param nowMs - Instant to resolve (Unix ms).
 * @returns ET day key in YYYY-MM-DD form.
 */
export function resolveTradingDayKey(nowMs: number): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TRADING_DAY_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(nowMs));
}

function contextFor(state: DayCadenceState, tradesToday: number): string {
  switch (state) {
    case 'fresh':
      return '今天還沒有決策紀錄';
    case 'stop_after_win':
      return '今天第 1 筆 · 上一筆獲利了結';
    case 'second_chance':
      return '今天第 1 筆 · 已收束';
    case 'circuit_break':
      return '今天 2 筆 · 兩筆都停損';
    default:
      return '今天已完成 ' + String(tradesToday) + ' 筆';
  }
}

/**
 * Resolves today's cadence position from the decision history.
 *
 * Only today's ET records count, and only ones that reached the market —
 * standing down (`no_entry`) is discipline, not a trade, so it never spends the
 * daily budget. Records are ordered by timestamp before "the first two" is
 * decided, so caller-side array order cannot change the verdict.
 *
 * @param records - All persisted decisions (any order, any day).
 * @param nowMs - Current time (Unix ms).
 * @returns Today's cadence state, trade count, and a factual context line.
 */
export function resolveDayCadence(
  records: readonly DayCadenceRecord[],
  nowMs: number,
): DayCadence {
  const today = resolveTradingDayKey(nowMs);
  const todays = records
    .filter(
      (record) =>
        countsAsTrade(record.tradeResult) && resolveTradingDayKey(record.ts) === today,
    )
    .slice()
    .sort((a, b) => a.ts - b.ts);

  const tradesToday = todays.length;
  let state: DayCadenceState;
  if (tradesToday === 0) {
    state = 'fresh';
  } else if (tradesToday === 1) {
    // 贏停規則 only fires on an actual win; a scratch leaves the second shot open.
    state = isWin(todays[0].tradeResult) ? 'stop_after_win' : 'second_chance';
  } else if (isLoss(todays[0].tradeResult) && isLoss(todays[1].tradeResult)) {
    state = 'circuit_break';
  } else {
    state = 'day_complete';
  }

  return { tradesToday, state, contextZh: contextFor(state, tradesToday) };
}
