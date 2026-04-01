/**
 * @module templates/selector
 * @description Selects the optimal trader template based on emotion score
 * and current market condition.
 */

import type { TraderTemplate, MarketCondition } from './types';

/**
 * Selects a trader template based on current biometric and market state.
 *
 * Selection logic:
 * - Choppy market → Mode2 (single-trade, maximum discipline)
 * - Breakout + emotion score >= 60 → CANSLIM (growth breakout)
 * - All other conditions → FBD (default focused decision)
 *
 * @param emotionScore - Current TEI PR99 score (1–99)
 * @param marketCondition - Current market regime classification
 * @returns The recommended trader template
 */
export function selectTemplate(
  emotionScore: number,
  marketCondition: MarketCondition
): TraderTemplate {
  if (marketCondition === 'choppy') {
    return 'mode2';
  }

  if (marketCondition === 'breakout' && emotionScore >= 60) {
    return 'canslim';
  }

  return 'fbd';
}
