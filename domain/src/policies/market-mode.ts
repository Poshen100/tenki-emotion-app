/**
 * @module domain/policies/market-mode
 * @description Derives a market-mode context tag (Mode 1 / Mode 2) from an
 * alert's free-form text. This is a FACT statement about market condition —
 * never a trading instruction. Mode 1 = 趨勢延續傾向 (trend-continuation day),
 * Mode 2 = 區間／陷阱傾向 (range / mean-reversion day). The tag rides in the
 * alert's `condition` or `note` text; no schema change is required.
 * Methodology source: docs/TRADING-METHODOLOGY.md §5 (Mode 1/2), §10 candidate 1.
 */

import type { AlertContract } from '../contracts/alert-contract';

/** Market-mode context tags. */
export const DOMAIN_MARKET_MODES = ['mode_1', 'mode_2'] as const;
export type DomainMarketMode = typeof DOMAIN_MARKET_MODES[number];

/**
 * User-facing context line per mode. Fact statements only — reviewed against
 * the compliance vocabulary (no result/advice language). Do not add
 * directives ("buy"/"enter") here; the mode describes the environment.
 */
export const MARKET_MODE_CONTEXT_ZH: Record<DomainMarketMode, string> = {
  mode_1: 'Mode 1 · 趨勢延續傾向',
  mode_2: 'Mode 2 · 區間／陷阱傾向',
};

/** Matches "Mode 1", "mode2", "MODE  1" etc. Captures the digit. */
const MODE_PATTERN = /mode\s*([12])\b/i;

function matchMode(text: string | null): DomainMarketMode | null {
  if (text === null) {
    return null;
  }
  const match = MODE_PATTERN.exec(text);
  if (match === null) {
    return null;
  }
  return match[1] === '1' ? 'mode_1' : 'mode_2';
}

/**
 * Extracts the market-mode tag from an alert, scanning `condition` first,
 * then `note`. Returns null when no `Mode 1`/`Mode 2` marker is present.
 *
 * @param alert - Canonical alert contract.
 * @returns The market mode, or null when unmarked.
 */
export function extractMarketMode(alert: AlertContract): DomainMarketMode | null {
  return matchMode(alert.condition) ?? matchMode(alert.note);
}

/**
 * Resolves the user-facing context line for an alert's market mode.
 *
 * @param alert - Canonical alert contract.
 * @returns The context line, or null when the alert is unmarked.
 */
export function resolveMarketModeContext(alert: AlertContract): string | null {
  const mode = extractMarketMode(alert);
  return mode === null ? null : MARKET_MODE_CONTEXT_ZH[mode];
}
