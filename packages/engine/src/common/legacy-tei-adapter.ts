/**
 * @module legacy-tei-adapter
 * @description Compatibility adapter between legacy TEI PR99 and v3 Edge Score.
 * Used ONLY for migration, diff testing, and rollback scenarios.
 * NOT exposed to product UI.
 *
 * @deprecated This adapter exists only for migration. Remove once v3 is stable.
 * @version 3.0
 */

import { EdgeZone } from '../scoring/types';

// Legacy types (inline, not re-exported)
type LegacyTeiZone = 'PEAK' | 'OPTIMAL' | 'NEUTRAL' | 'DEGRADED';

/**
 * Approximate conversion from legacy TEI PR99 (1-99) to Edge Score (0-100).
 * This is NOT an exact mapping — it's a best-effort approximation for migration.
 *
 * Legacy PR99 was a percentile rank against personal history.
 * Edge Score is a weighted multi-factor score.
 * They measure different things, but this helps with diff testing.
 *
 * @deprecated Use Edge Score engine directly for new code.
 * @param teiPr - Legacy TEI PR99 value (1-99).
 * @returns Approximate Edge Score (0-100).
 */
export function teiToEdgeScoreApprox(teiPr: number): number {
  // Linear mapping: PR 1 → ~5, PR 50 → ~50, PR 99 → ~100
  const clamped = Math.max(1, Math.min(99, teiPr));
  return Math.round((clamped / 99) * 100);
}

/**
 * Converts a legacy TEI zone to v3 Edge Zone.
 *
 * @deprecated Use classifyZone from zone-config for new code.
 * @param zone - Legacy 4-zone classification.
 * @returns V3 3-zone classification.
 */
export function legacyZoneToEdgeZone(zone: LegacyTeiZone): EdgeZone {
  switch (zone) {
    case 'PEAK':
    case 'OPTIMAL':
      return 'clear';
    case 'NEUTRAL':
      return 'neutral';
    case 'DEGRADED':
      return 'strain';
    default:
      return 'strain';
  }
}

/**
 * Converts v3 Edge Zone back to legacy TEI zone (for test comparison).
 *
 * @deprecated Use Edge zones directly for new code.
 * @param zone - V3 Edge zone.
 * @param score - Edge Score for disambiguation.
 * @returns Legacy 4-zone classification.
 */
export function edgeZoneToLegacyZone(zone: EdgeZone, score: number): LegacyTeiZone {
  switch (zone) {
    case 'clear':
      return score >= 80 ? 'PEAK' : 'OPTIMAL';
    case 'neutral':
      return 'NEUTRAL';
    case 'strain':
      return 'DEGRADED';
    default:
      return 'DEGRADED';
  }
}
