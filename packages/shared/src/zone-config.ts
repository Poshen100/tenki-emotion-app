/**
 * @module zone-config
 * @description v3 Zone configuration — 3 readiness zones.
 *
 * Clear (70-100) / Neutral (40-69) / Strain (0-39)
 *
 * @version 3.0 — Replaces v2 PEAK/OPTIMAL/NEUTRAL/DEGRADED 4-zone system.
 * @see ANTIGRAVITY.md v3.0 Section 1.2
 */

import type { EdgeZone, } from '../../engine/src/scoring/types';
import { TENKI_THEME } from './design-tokens';

export type { EdgeZone };

/** Zone indicator with safe wording for UI. */
export interface ZoneIndicator {
  /** Zone identifier. */
  zone: EdgeZone;
  /** Display label (safe wording). */
  label: string;
  /** UI background color. */
  color: string;
  /** Text color for contrast. */
  textColor: string;
  /** Edge Score minimum (inclusive). */
  min: number;
  /** Edge Score maximum (inclusive). */
  max: number;
  /** Readiness guidance (safe wording — no action directives). */
  guidance: string;
}

/**
 * Three readiness zone configurations (v3).
 * Ordered from highest to lowest score.
 *
 * @see ANTIGRAVITY.md v3.0 Section 1.2
 */
export const ZONE_CONFIG: readonly ZoneIndicator[] = [
  {
    zone: 'clear',
    label: 'Clear state ✅',
    color: TENKI_THEME.zones.clear.bg,
    textColor: TENKI_THEME.zones.clear.text,
    min: 70,
    max: 100,
    guidance: 'Stable, focused, recovered state. You may be in a clearer state for important decisions.',
  },
  {
    zone: 'neutral',
    label: 'Neutral / mixed ⏸️',
    color: TENKI_THEME.zones.neutral.bg,
    textColor: TENKI_THEME.zones.neutral.text,
    min: 40,
    max: 69,
    guidance: 'Mixed signals today. Consider a brief check-in or reset if needed.',
  },
  {
    zone: 'strain',
    label: 'Elevated strain 🔁',
    color: TENKI_THEME.zones.strain.bg,
    textColor: TENKI_THEME.zones.strain.text,
    min: 0,
    max: 39,
    guidance: 'Elevated strain detected. A reset, break, or breathing exercise may help.',
  },
] as const;

/**
 * Returns the zone indicator for a given Edge Score.
 *
 * @param score - Edge Score (0-100).
 * @returns The matching ZoneIndicator, defaulting to strain if none match.
 */
export function getZoneByScore(score: number): ZoneIndicator {
  return ZONE_CONFIG.find(z => score >= z.min && score <= z.max) || ZONE_CONFIG[2];
}

/**
 * Returns the EdgeZone enum value for a given score.
 *
 * @param score - Edge Score (0-100).
 * @returns The EdgeZone classification.
 */
export function classifyZone(score: number): EdgeZone {
  if (score >= 70) return 'clear';
  if (score >= 40) return 'neutral';
  return 'strain';
}
