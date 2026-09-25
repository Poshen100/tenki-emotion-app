/**
 * @module intelligence/evidence
 * @description The evidence contract every Decision Intelligence insight must
 * satisfy. One rule, no exceptions: **no evidence, no claim.**
 *
 * Every insight this layer emits — a drift number, a calibration verdict, a
 * "TENKI NOTICED" line — carries an {@link EvidenceBasis} saying how many
 * records it read, how many days those span, what kind of data they are, and
 * why its confidence landed where it did. That basis is what the Evidence
 * X-Ray surface shows the user when they ask "憑什麼".
 *
 * ⚠️ Reasons are **codes, not sentences**. User-facing wording lives in
 * `intelligence/copy.ts`, which is the single place compliance is tested.
 * Emitting an English sentence from here would route copy around that gate.
 *
 * @version 3.0
 * @see docs/DECISION-INTELLIGENCE.md § 3 (Evidence Contract)
 */

import type { ConfidenceBand } from '../common/types';

// ─────────────────────────────────────────────
// Provenance
// ─────────────────────────────────────────────

/**
 * Where a piece of evidence came from. Ordered weakest-claim-last: an insight's
 * provenance is the union of its inputs', and once `inferred` is in the list the
 * UI may not present the insight as a measurement.
 */
export const INSIGHT_PROVENANCES = [
  'measured',
  'reported',
  'behavioral',
  'inferred',
] as const;

/** Provenance of one evidence input. */
export type InsightProvenance = typeof INSIGHT_PROVENANCES[number];

/**
 * Normalizes a provenance list: de-duplicated and sorted into
 * {@link INSIGHT_PROVENANCES} order so two equal sets always serialize equally.
 *
 * @param provenance - Raw provenance list, possibly with duplicates.
 * @returns De-duplicated list in canonical order.
 */
export function normalizeProvenance(
  provenance: readonly InsightProvenance[]
): InsightProvenance[] {
  return INSIGHT_PROVENANCES.filter((p) => provenance.includes(p));
}

// ─────────────────────────────────────────────
// Reason codes
// ─────────────────────────────────────────────

/**
 * Why an insight's confidence is what it is. These are the rows of the Evidence
 * X-Ray; `intelligence/copy.ts` turns each into a sentence.
 */
export type EvidenceReasonCode =
  /** Fewer comparable samples than the claim's floor — nothing may be claimed. */
  | 'sample_floor_not_met'
  /** Enough to speak, but below the bar for high confidence. */
  | 'sample_count_below_high'
  /** Samples do not span enough distinct days to be called high confidence. */
  | 'window_too_short'
  /** Every input is inferred; nothing here was directly measured. */
  | 'inferred_only'
  /** The personal reference barely varies, so a normalized distance is unstable. */
  | 'low_variability_reference'
  /** The two readings compared were captured under different conditions. */
  | 'mixed_capture_conditions';

// ─────────────────────────────────────────────
// Evidence basis
// ─────────────────────────────────────────────

/** The evidence behind a single insight. Attached to every claim this layer makes. */
export interface EvidenceBasis {
  /** How many comparable records the claim read. */
  sampleCount: number;
  /** How many distinct days those records span. */
  windowDays: number;
  /** Kinds of data involved, in canonical order. */
  provenance: InsightProvenance[];
  /** How much the evidence supports the claim. Reuses the canonical band. */
  confidence: ConfidenceBand;
  /** Why the confidence landed there. */
  reasons: EvidenceReasonCode[];
}

/**
 * How much evidence a particular claim demands. Each pillar declares its own —
 * a drift reading and a 30-day pattern are not owed the same bar.
 */
export interface EvidenceRequirement {
  /** Below this sample count nothing may be claimed at all. */
  minSamples: number;
  /** At/above this sample count the claim may reach moderate confidence. */
  moderateSamples: number;
  /** At/above this sample count the claim may reach high confidence. */
  highSamples: number;
  /** Distinct days the samples must span before high confidence is available. */
  highWindowDays: number;
}

/** Inputs to {@link buildEvidence}. */
export interface EvidenceInput {
  /** Comparable records the claim read. */
  sampleCount: number;
  /** Distinct days those records span. */
  windowDays: number;
  /** Provenance of every input that fed the claim. */
  provenance: readonly InsightProvenance[];
  /** The bar this particular claim must clear. */
  requirement: EvidenceRequirement;
  /**
   * Extra reason codes the caller already knows about (e.g. a near-flat personal
   * reference). Each one caps confidence at moderate — see {@link CAPPING_REASONS}.
   */
  extraReasons?: readonly EvidenceReasonCode[];
}

/**
 * Reason codes that cap confidence at `moderate` no matter how many samples
 * exist. They describe evidence that is plentiful but *structurally* weaker,
 * which sample count alone cannot see.
 */
export const CAPPING_REASONS: readonly EvidenceReasonCode[] = [
  'inferred_only',
  'low_variability_reference',
  'mixed_capture_conditions',
] as const;

/** Ranking used to compare bands; higher index = stronger claim. */
const BAND_ORDER: readonly ConfidenceBand[] = ['low', 'moderate', 'high'] as const;

/**
 * Returns the weaker of two confidence bands. Used to apply a ceiling without
 * ever accidentally raising confidence.
 *
 * @param band - The band computed so far.
 * @param ceiling - The strongest band still allowed.
 * @returns The weaker of the two.
 */
export function capBand(band: ConfidenceBand, ceiling: ConfidenceBand): ConfidenceBand {
  return BAND_ORDER.indexOf(band) <= BAND_ORDER.indexOf(ceiling) ? band : ceiling;
}

/**
 * Builds the evidence basis for a claim. Pure and total: the same inputs always
 * produce the same basis, and removing any input can only weaken it.
 *
 * Confidence is derived, never asserted:
 * 1. sample count picks the starting band,
 * 2. a too-short day window caps it at moderate,
 * 3. any {@link CAPPING_REASONS} code caps it at moderate,
 * 4. missing the sample floor forces low.
 *
 * @param input - Sample counts, provenance and the claim's requirement.
 * @returns The evidence basis to attach to the claim.
 */
export function buildEvidence(input: EvidenceInput): EvidenceBasis {
  const { requirement } = input;
  const sampleCount = Math.max(0, Math.floor(input.sampleCount));
  const windowDays = Math.max(0, Math.floor(input.windowDays));
  const provenance = normalizeProvenance(input.provenance);
  const reasons: EvidenceReasonCode[] = [];

  let band: ConfidenceBand;
  if (sampleCount >= requirement.highSamples) {
    band = 'high';
  } else if (sampleCount >= requirement.moderateSamples) {
    band = 'moderate';
  } else {
    band = 'low';
  }

  if (sampleCount < requirement.highSamples) {
    reasons.push('sample_count_below_high');
  }

  if (windowDays < requirement.highWindowDays) {
    reasons.push('window_too_short');
    band = capBand(band, 'moderate');
  }

  // An insight assembled purely from inference cannot claim high confidence,
  // however many samples it read — nothing under it was actually measured.
  if (provenance.length > 0 && provenance.every((p) => p === 'inferred')) {
    reasons.push('inferred_only');
    band = capBand(band, 'moderate');
  }

  for (const reason of input.extraReasons ?? []) {
    if (!reasons.includes(reason)) reasons.push(reason);
    if (CAPPING_REASONS.includes(reason)) band = capBand(band, 'moderate');
  }

  if (sampleCount < requirement.minSamples) {
    if (!reasons.includes('sample_floor_not_met')) reasons.push('sample_floor_not_met');
    band = 'low';
  }

  return { sampleCount, windowDays, provenance, confidence: band, reasons };
}

// ─────────────────────────────────────────────
// Insufficient evidence
// ─────────────────────────────────────────────

/**
 * What the engine returns when it may not speak yet. A first-class result, not
 * `null` — the UI has to be able to say "6 more comparable sessions needed"
 * instead of inventing a placeholder number.
 */
export interface InsufficientEvidence {
  /** Discriminant: this insight has no claim in it. */
  state: 'insufficient';
  /** How many more comparable samples are needed before any claim is allowed. */
  moreSamplesNeeded: number;
  /** The evidence gathered so far, for the Evidence X-Ray. */
  evidence: EvidenceBasis;
}

/**
 * How many more comparable samples a claim needs before it may be made.
 *
 * @param sampleCount - Comparable samples available now.
 * @param requirement - The claim's evidence requirement.
 * @returns Samples still missing; 0 once the floor is met.
 */
export function samplesShortOfFloor(
  sampleCount: number,
  requirement: EvidenceRequirement
): number {
  return Math.max(0, requirement.minSamples - Math.max(0, Math.floor(sampleCount)));
}

/**
 * Builds an {@link InsufficientEvidence} result. Callers use this instead of
 * returning a degraded claim when the evidence floor is not met.
 *
 * @param input - The evidence gathered so far.
 * @returns The insufficient-evidence result, including how many samples are missing.
 */
export function insufficientEvidence(input: EvidenceInput): InsufficientEvidence {
  return {
    state: 'insufficient',
    moreSamplesNeeded: samplesShortOfFloor(input.sampleCount, input.requirement),
    evidence: buildEvidence(input),
  };
}

// ─────────────────────────────────────────────
// Sample window helpers
// ─────────────────────────────────────────────

/** Milliseconds in one day, used to count the distinct days a sample set spans. */
export const MS_PER_DAY = 86_400_000;

/**
 * Counts the distinct local calendar days a set of timestamps falls on.
 *
 * Distinct days matter because 30 records taken in one afternoon are not the
 * same evidence as 30 records taken over 30 days — sample count alone cannot
 * tell those apart.
 *
 * @param timestamps - Unix ms timestamps, in any order.
 * @returns Number of distinct local days represented.
 */
export function countDistinctDays(timestamps: readonly number[]): number {
  const days = new Set<string>();
  for (const ts of timestamps) {
    if (!Number.isFinite(ts)) continue;
    const d = new Date(ts);
    days.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
  }
  return days.size;
}
