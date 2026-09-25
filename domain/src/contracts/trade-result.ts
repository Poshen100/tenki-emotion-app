/**
 * @module domain/contracts/trade-result
 * @description What the trader reports happened to a decision after the
 * decision environment closed. This is a self-reported journal entry, not a
 * broker feed and not a performance claim.
 *
 * It exists for exactly one reason: the daily cadence rules in
 * `docs/TRADING-METHODOLOGY.md` §6.1 (stop after the first win; stand down
 * after two losses) cannot be evaluated without knowing how a trade ended.
 * Everything already persisted describes *discipline* (did the process get
 * followed), never *result* — so the cadence rules were previously unbuildable.
 *
 * ⚠️ Compliance boundary (`docs/TRADING-METHODOLOGY.md` §10 item 3 — 勝率語言已禁):
 * this field drives cadence state ONLY. It must never be aggregated into a win
 * rate, expectancy, P&L or any other performance figure, and no user-facing
 * copy may evaluate it ("good day", "you should stop"). Surfaces state facts —
 * how many decisions today, how the previous one ended — and nothing more.
 */

/**
 * How a decision ended, from the trader's own report.
 *
 * `no_entry` is a first-class outcome, not a missing value: standing down when
 * the structure never formed is the methodology's §7 step 7, and it must not
 * count toward the daily trade tally.
 */
export const DOMAIN_TRADE_RESULTS = [
  'profit_taken',
  'stopped_out',
  'scratch',
  'no_entry',
] as const;
export type DomainTradeResult = typeof DOMAIN_TRADE_RESULTS[number];

/**
 * Whether a reported result counts as one of the day's trades.
 *
 * Only decisions that actually reached the market count. Standing down is
 * discipline, not a trade — counting it would burn the day's budget for doing
 * the right thing.
 *
 * @param result - The reported result, or null when not yet reported.
 * @returns True when this decision consumes one of the day's trades.
 */
export function countsAsTrade(result: DomainTradeResult | null): boolean {
  return result !== null && result !== 'no_entry';
}

/**
 * Whether a reported result is a loss for cadence purposes.
 *
 * `scratch` (flat) is deliberately NOT a loss: the two-loss circuit breaker
 * exists to stop a bleeding session, and a flat trade is not bleeding.
 *
 * @param result - The reported result, or null when not yet reported.
 * @returns True only for a stop-out.
 */
export function isLoss(result: DomainTradeResult | null): boolean {
  return result === 'stopped_out';
}

/**
 * Whether a reported result is a win for cadence purposes.
 *
 * @param result - The reported result, or null when not yet reported.
 * @returns True only when profit was taken.
 */
export function isWin(result: DomainTradeResult | null): boolean {
  return result === 'profit_taken';
}

/**
 * Normalizes a persisted value that may predate this contract.
 *
 * Records written before `tradeResult` existed carry no result at all. They
 * must read back as null (unknown) rather than being coerced into any outcome —
 * guessing would silently corrupt the cadence tally with invented history.
 *
 * @param value - Raw value off a persisted record.
 * @returns A valid result, or null when absent/unrecognized.
 */
export function normalizeTradeResult(value: unknown): DomainTradeResult | null {
  return DOMAIN_TRADE_RESULTS.includes(value as DomainTradeResult)
    ? (value as DomainTradeResult)
    : null;
}
