/**
 * @module intelligence/twin
 * @description Decision Twin — "this moment resembles the state you were in
 * before 11 of your past decisions."
 *
 * 🔴 It states history, it never predicts. Allowed: "in 8 of those, you did not
 * end up following your own process." Forbidden: "you will diverge this time."
 * The difference is not stylistic — a prediction is a claim about the future
 * that no personal history can support, and `SYSTEM.md` § 2 says this is not a
 * prediction engine.
 *
 * 🔴 It never shames. Counts are reported in process language; failure tallies
 * are not headlines and never carry emphasis.
 *
 * 🔴 Similarity is computed from features the user can read back — time of day,
 * band, drift magnitude, which process they were running. No opaque embedding:
 * "why is it alike" has to be answerable, or the insight is a black box, which
 * is exactly what this product refuses to be.
 *
 * @version 3.0
 * @see docs/DECISION-INTELLIGENCE.md § 4.3
 */

import { resolveTimeBucket } from '../baseline/baseline';
import type { EdgeZone } from '../scoring/types';
import type { DriftMagnitude } from './drift';
import {
  buildEvidence,
  countDistinctDays,
  insufficientEvidence,
  type EvidenceBasis,
  type EvidenceRequirement,
  type InsufficientEvidence,
} from './evidence';

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

/** Evidence a twin claim must clear before it may be spoken at all. */
export const TWIN_EVIDENCE_REQUIREMENT: EvidenceRequirement = {
  minSamples: 5,
  moderateSamples: 8,
  highSamples: 12,
  highWindowDays: 14,
};

/**
 * The comparable features and what each contributes to similarity. Weights sum
 * to 100 and are deliberately blunt: this is a "how alike, and in what way"
 * summary the user can audit, not a tuned model.
 */
export const TWIN_FEATURE_WEIGHTS = {
  timeBucket: 30,
  driftMagnitude: 30,
  band: 25,
  template: 15,
} as const;

/** A comparable feature of a decision moment. */
export type TwinFeature = keyof typeof TWIN_FEATURE_WEIGHTS;

/** Similarity at or above which two moments count as twins. */
export const TWIN_MATCH_THRESHOLD = 70;

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

/** The comparable shape of a moment before a decision. */
export interface DecisionMoment {
  /** When the moment was (Unix ms) — the time bucket is derived from it. */
  ts: number;
  /** Readiness band at the moment. */
  band: EdgeZone;
  /** How far from the personal reference the reading sat. */
  driftMagnitude: DriftMagnitude;
  /** Which process/template was running, or null when none was chosen. */
  templateId: string | null;
}

/** A past decision moment, with what the user actually did. */
export interface DecisionTwinRecord extends DecisionMoment {
  /**
   * Whether the user followed their own process that time. Behavioral fact from
   * the decision record — never an outcome or a financial result.
   */
  followedProcess: boolean;
}

/** A twin claim, with the evidence that permits it. */
export interface DecisionTwinMatch {
  /** Discriminant: this result carries a claim. */
  state: 'assessed';
  /** How many past moments resemble this one. */
  matchCount: number;
  /** Of those, how many the user followed their own process in. */
  followedProcessCount: number;
  /** Of those, how many the user did not follow their own process in. */
  divergedCount: number;
  /** Features every match shares with now — the answer to "why is it alike". */
  sharedFeatures: TwinFeature[];
  /** What backs the claim. */
  evidence: EvidenceBasis;
}

/** Either a twin claim, or an honest refusal to make one. */
export type DecisionTwinResult = DecisionTwinMatch | InsufficientEvidence;

// ─────────────────────────────────────────────
// Similarity
// ─────────────────────────────────────────────

/**
 * Reports which comparable features two moments share.
 *
 * @param a - One moment.
 * @param b - The other.
 * @returns The shared features, in weight order.
 */
export function sharedFeatures(a: DecisionMoment, b: DecisionMoment): TwinFeature[] {
  const shared: TwinFeature[] = [];
  if (resolveTimeBucket(a.ts) === resolveTimeBucket(b.ts)) shared.push('timeBucket');
  if (a.driftMagnitude === b.driftMagnitude) shared.push('driftMagnitude');
  if (a.band === b.band) shared.push('band');
  // A null template on both sides means "neither was running a process" — that
  // is a real shared fact, not a pair of missing values.
  if (a.templateId === b.templateId) shared.push('template');
  return shared;
}

/**
 * Scores how alike two decision moments are, 0-100.
 *
 * @param a - One moment.
 * @param b - The other.
 * @returns Weighted similarity score.
 */
export function twinSimilarity(a: DecisionMoment, b: DecisionMoment): number {
  return sharedFeatures(a, b).reduce((sum, f) => sum + TWIN_FEATURE_WEIGHTS[f], 0);
}

// ─────────────────────────────────────────────
// Matching
// ─────────────────────────────────────────────

/**
 * Finds the past moments that resemble the current one and reports what the
 * user did in them.
 *
 * Returns {@link InsufficientEvidence} — with how many more matching sessions
 * are needed — when too few resemble it. A twin claim built on two matches
 * would read as insight and be noise.
 *
 * @param now - The current decision moment.
 * @param history - Past decision moments with their process outcome.
 * @returns A twin claim with its evidence, or an insufficient-evidence result.
 */
export function findDecisionTwins(
  now: DecisionMoment,
  history: readonly DecisionTwinRecord[]
): DecisionTwinResult {
  const matches = history.filter(
    (record) =>
      Number.isFinite(record.ts) &&
      record.ts <= now.ts &&
      twinSimilarity(now, record) >= TWIN_MATCH_THRESHOLD
  );

  const evidenceInput = {
    sampleCount: matches.length,
    windowDays: countDistinctDays(matches.map((m) => m.ts)),
    provenance: ['behavioral', 'inferred'] as const,
    requirement: TWIN_EVIDENCE_REQUIREMENT,
  };

  if (matches.length < TWIN_EVIDENCE_REQUIREMENT.minSamples) {
    return insufficientEvidence(evidenceInput);
  }

  const followedProcessCount = matches.filter((m) => m.followedProcess).length;

  // Only features shared by EVERY match may be presented as the reason they are
  // alike. A feature two thirds of them share is not an explanation, and
  // reporting it as one would be the "looks reasonable, means nothing" failure
  // this layer exists to avoid.
  const universal = matches.reduce<TwinFeature[]>(
    (acc, m) => acc.filter((f) => sharedFeatures(now, m).includes(f)),
    Object.keys(TWIN_FEATURE_WEIGHTS) as TwinFeature[]
  );

  return {
    state: 'assessed',
    matchCount: matches.length,
    followedProcessCount,
    divergedCount: matches.length - followedProcessCount,
    sharedFeatures: universal,
    evidence: buildEvidence(evidenceInput),
  };
}

/**
 * Type guard for a twin result that carries a claim.
 *
 * @param result - The twin result to narrow.
 * @returns True when the result is a match rather than a refusal.
 */
export function isTwinAssessed(result: DecisionTwinResult): result is DecisionTwinMatch {
  return result.state === 'assessed';
}
