/**
 * @module compliance/safe-copy
 * @description Compliance Guardrail Engine — safe wording generator.
 * All user-facing copy MUST pass through this module.
 * Ensures no medical, financial, or action-directive language.
 *
 * @version 3.0
 * @see ANTIGRAVITY.md v3.0 Section 2
 */

import type { EdgeZone, StrainSubtype } from '../scoring/types';
import type { ConfidenceBand } from '../common/types';

// ─────────────────────────────────────────────
// Vocabulary Rules
// ─────────────────────────────────────────────

/** Words and phrases that are SAFE to use in user-facing copy. */
export const ALLOWED_VOCABULARY = [
  'clear state', 'focused state', 'stable state', 'recovered state', 'balanced state',
  'elevated strain', 'decision readiness', 'cognitive readiness', 'emotional balance',
  'readiness', 'wellness', 'clarity', 'focus', 'recovery', 'stability',
  'self-awareness', 'check-in', 'pattern', 'insight', 'reflection',
  'discipline', 'process', 'session', 'baseline', 'trend',
] as const;

/** Words and phrases that are PROHIBITED in user-facing copy. */
export const PROHIBITED_VOCABULARY = [
  'trade', 'trading', 'trader', 'buy', 'sell', 'exit now', 'enter now',
  'market edge', 'market', 'profit', 'loss', 'win rate', 'winning',
  'best time to trade', 'high conviction', 'setup',
  'diagnose', 'diagnosis', 'medical-grade', 'clinical',
  'detect illness', 'detect anxiety', 'treatment',
  'predict', 'prediction accuracy', 'guarantee',
  'your body says', 'you should', 'you must',
] as const;

/**
 * Checks whether a string contains any prohibited vocabulary.
 *
 * @param text - The text to check.
 * @returns Array of found prohibited terms, empty if clean.
 */
export function findProhibitedTerms(text: string): string[] {
  const lowerText = text.toLowerCase();
  const found: string[] = [];

  for (const term of PROHIBITED_VOCABULARY) {
    if (lowerText.includes(term.toLowerCase())) {
      found.push(term);
    }
  }

  return found;
}

/**
 * Returns true if the text is free of prohibited vocabulary.
 *
 * @param text - The text to validate.
 * @returns True if compliant, false if violations found.
 */
export function isCompliantCopy(text: string): boolean {
  return findProhibitedTerms(text).length === 0;
}

// ─────────────────────────────────────────────
// Zone Headlines (Compliance-Safe)
// ─────────────────────────────────────────────

/** Safe headline templates by zone and confidence band. */
const ZONE_HEADLINES: Record<EdgeZone, Record<ConfidenceBand, string>> = {
  clear: {
    high: 'Clearer state detected',
    moderate: 'Signals suggest a steadier state',
    low: 'Preliminary signals look more stable',
  },
  neutral: {
    high: 'Mixed signals today',
    moderate: 'State looks variable',
    low: 'Not enough data for a clear picture',
  },
  strain: {
    high: 'Elevated strain detected',
    moderate: 'Signals suggest higher strain',
    low: 'Limited data, but strain indicators present',
  },
};

/** Safe body text templates by zone and confidence band. */
const ZONE_BODIES: Record<EdgeZone, Record<ConfidenceBand, string>> = {
  clear: {
    high: 'Your signals look steadier than usual, with high confidence. You may be in a clearer state for important decisions.',
    moderate: 'Your readings look more stable than recent patterns, with moderate confidence.',
    low: 'Early signals suggest some stability, but your baseline is still forming.',
  },
  neutral: {
    high: 'Your signals are mixed today. Some indicators look stable while others are less consistent.',
    moderate: 'Your state appears variable. Consider a brief check-in or reset if needed.',
    low: 'Not enough reliable data to assess clearly. Try a longer scan or check back later.',
  },
  strain: {
    high: 'Your signals indicate elevated strain compared to your baseline. A reset or break may help.',
    moderate: 'Some strain indicators are present. You might benefit from a pause or breathing exercise.',
    low: 'Limited data available, but some strain markers are detected. More data would help.',
  },
};

/**
 * v0 — unvalidated. Safe headline/body overrides for the `strain` zone when a
 * directional subtype is available (see `StrainSubtype` in `scoring/types`).
 * Only covers the two directional subtypes; `unknown` falls back to the
 * generic ZONE_HEADLINES/ZONE_BODIES strain copy above.
 */
const STRAIN_SUBTYPE_HEADLINES: Record<Exclude<StrainSubtype, 'unknown'>, string> = {
  overstimulated: 'Elevated activation detected',
  depleted: 'Lower energy signals detected',
};

const STRAIN_SUBTYPE_BODIES: Record<Exclude<StrainSubtype, 'unknown'>, string> = {
  overstimulated: 'Your signals suggest heightened activation compared to your baseline — elevated heart rate paired with lower variability. A brief pause or breathing exercise may help you settle.',
  depleted: 'Your signals suggest reduced energy and variability compared to your baseline. Rest or a recovery break may help.',
};

/** Optional context for safe-copy generation. */
export interface SafeCopyContext {
  /** v0 directional subtype, only meaningful when zone is `strain`. */
  strainSubtype?: StrainSubtype;
}

/**
 * Generates compliance-safe copy for a given zone and confidence band.
 * When `zone` is `strain` and `context.strainSubtype` is a resolved
 * direction (not `unknown`), returns subtype-specific copy instead of the
 * generic strain copy.
 *
 * @param zone - The Edge Score zone.
 * @param band - The confidence band.
 * @param context - Optional v0 strain-subtype context.
 * @returns Object with headline and body text, guaranteed compliant.
 */
export function generateSafeCopy(
  zone: EdgeZone,
  band: ConfidenceBand,
  context?: SafeCopyContext
): { headline: string; body: string } {
  if (zone === 'strain' && context?.strainSubtype && context.strainSubtype !== 'unknown') {
    return {
      headline: STRAIN_SUBTYPE_HEADLINES[context.strainSubtype],
      body: STRAIN_SUBTYPE_BODIES[context.strainSubtype],
    };
  }

  return {
    headline: ZONE_HEADLINES[zone][band],
    body: ZONE_BODIES[zone][band],
  };
}

// ─────────────────────────────────────────────
// Score Driver Explanations
// ─────────────────────────────────────────────

import type { ScoreDriverKey, DriverDirection } from '../scoring/types';

/** Safe explanation fragments for score drivers. */
const DRIVER_EXPLANATIONS: Record<ScoreDriverKey, Record<DriverDirection, string>> = {
  hrv_vs_baseline: {
    positive: 'Higher than usual HRV contributed to your readiness.',
    neutral: 'HRV is near your personal baseline.',
    negative: 'Lower HRV than usual reduced your readiness score.',
  },
  hr_stability: {
    positive: 'Steady heart rate signals stability.',
    neutral: 'Heart rate variability is within normal range.',
    negative: 'Inconsistent heart rate pattern reduced stability.',
  },
  respiration_stability: {
    positive: 'Steady breathing pattern increased your score.',
    neutral: 'Respiration is within your normal range.',
    negative: 'Irregular breathing pattern reduced your score.',
  },
  stress_proxy_vs_baseline: {
    positive: 'Lower stress indicators compared to your baseline.',
    neutral: 'Stress indicators are near your typical level.',
    negative: 'Elevated stress indicators compared to your baseline.',
  },
  sleep_recovery: {
    positive: 'Good recovery signals from recent rest.',
    neutral: 'Sleep and recovery data is neutral or unavailable.',
    negative: 'Recovery indicators suggest insufficient rest.',
  },
  recent_trend: {
    positive: 'Your recent trend shows improving stability.',
    neutral: 'Recent readings are stable with no clear trend.',
    negative: 'Recent trend shows declining stability.',
  },
  baseline_freshness: {
    positive: 'Your baseline is fresh and well-calibrated.',
    neutral: 'Baseline is reasonably current.',
    negative: 'Your baseline may be stale. Consider a new scan.',
  },
  signal_quality: {
    positive: 'Signal quality is excellent.',
    neutral: 'Signal quality is acceptable.',
    negative: 'Signal quality was limited. Results may be less certain.',
  },
};

/**
 * Generates a safe explanation for a single score driver.
 *
 * @param key - The score driver key.
 * @param direction - The driver's direction of influence.
 * @returns Compliance-safe explanation string.
 */
export function getDriverExplanation(key: ScoreDriverKey, direction: DriverDirection): string {
  return DRIVER_EXPLANATIONS[key][direction];
}
