/**
 * @module session/template-suggestion
 * @description Maps an external alert's strategy hint to a trader template
 * suggestion. A suggestion highlights one template in the picker — it never
 * forces a choice, and an unknown hint yields no suggestion at all.
 * Canonical behavior spec: docs/TRADINGVIEW-ALERT-SPEC.md §7.
 */

import type { TraderTemplateId } from './types';

/** Keyword → template mapping, matched against the normalized hint. */
const STRATEGY_KEYWORD_MAP: ReadonlyArray<{
  keyword: string;
  templateId: TraderTemplateId;
}> = [
  { keyword: 'canslim', templateId: 'CANSLIM' },
  { keyword: 'fbd', templateId: 'FBD' },
  { keyword: 'mancini', templateId: 'FBD' },
  { keyword: 'high rs', templateId: 'MODE_2' },
  { keyword: 'mode 2', templateId: 'MODE_2' },
  { keyword: 'sensitivity', templateId: 'MODE_2' },
];

/**
 * Suggests a trader template for an alert strategy hint.
 * Matching is case-insensitive substring; first match in map order wins
 * (so "canslim high rs" suggests CANSLIM).
 *
 * @param strategyHint - Free-form strategy hint from the alert, or null.
 * @returns Suggested template ID, or null when nothing matches.
 */
export function suggestTemplateForStrategyHint(
  strategyHint: string | null,
): TraderTemplateId | null {
  if (strategyHint === null) {
    return null;
  }

  const normalized = strategyHint.trim().toLowerCase();
  if (normalized.length === 0) {
    return null;
  }

  for (const entry of STRATEGY_KEYWORD_MAP) {
    if (normalized.includes(entry.keyword)) {
      return entry.templateId;
    }
  }

  return null;
}
