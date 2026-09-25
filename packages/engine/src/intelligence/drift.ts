/**
 * @module intelligence/drift
 * @description Drift Alert — the flagship Decision Intelligence pillar.
 *
 * Every other wellness tool compares the user to a population: "your HRV is
 * low." This module compares the user **only to themselves**: "you are 17
 * points away from your own usual range, and that distance has 24 comparable
 * sessions behind it."
 *
 * 🔴 The user-facing claim is DISTANCE, never direction. `docs/brand.md` § 4.2
 * uses "above/below baseline" to mean overstimulated/depleted — both bad —
 * while a higher Edge Score is better. The same two words therefore mean
 * opposite things in the two models, and `docs/brand.md` § 7 explicitly forbids
 * guessing the mapping. So {@link DriftAssessment.direction} is deliberately
 * named `higher`/`at`/`lower` (not above/below), is fact-only context for the
 * Evidence X-Ray, and must never be headlined or read as good/bad. `higher` is
 * still drift: leaving your usual range in either direction is the signal.
 *
 * @version 3.0
 * @see docs/DECISION-INTELLIGENCE.md § 2, § 4.1
 */

import { resolveTimeBucket, updateMetricBaseline, createEmptyMetricBaseline } from '../baseline/baseline';
import type { TimeBucket } from '../common/types';
import {
  buildEvidence,
  countDistinctDays,
  insufficientEvidence,
  MS_PER_DAY,
  type EvidenceBasis,
  type EvidenceReasonCode,
  type EvidenceRequirement,
  type InsufficientEvidence,
} from './evidence';

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

/** Evidence a drift claim must clear before it may report a number at all. */
export const DRIFT_EVIDENCE_REQUIREMENT: EvidenceRequirement = {
  minSamples: 8,
  moderateSamples: 12,
  highSamples: 24,
  highWindowDays: 10,
};

/**
 * How far back a sample may be and still count as comparable. Older readings
 * describe a person who no longer exists — a baseline from six months ago is
 * not "more evidence", it is a different reference.
 */
export const REFERENCE_WINDOW_DAYS = 60;

/**
 * Smallest spread (in readiness points) for which a normalized distance is
 * meaningful. Below it, `deviation / std` explodes: a user whose readings never
 * moved would be reported as wildly drifting on a 3-point change. That is not
 * drift, it is an unrepresentative sample — so magnitude falls back to absolute
 * distance and confidence is capped.
 */
export const MIN_MEANINGFUL_STD = 2;

/** Normalized-distance gates for drift magnitude (1σ / 2σ). */
export const DRIFT_Z_THRESHOLDS = {
  DRIFTING: 1,
  FAR: 2,
} as const;

/**
 * v0 — unvalidated heuristic. Absolute-distance gates (readiness points) used
 * only when the personal reference is too flat for {@link DRIFT_Z_THRESHOLDS}.
 * Not yet checked against real user outcomes; treat as exploratory.
 */
export const DRIFT_ABSOLUTE_THRESHOLDS = {
  DRIFTING: 8,
  FAR: 16,
} as const;

/**
 * Distance (readiness points) within which direction reads as `at` rather than
 * higher/lower. Below this, the sign of the deviation is noise, and reporting it
 * would dress noise up as a fact.
 */
export const AT_REFERENCE_POINTS = 2;

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

/** One historical readiness reading, comparable to the one being assessed. */
export interface ReadinessSample {
  /** Readiness value on the canonical 0-100 axis. */
  value: number;
  /** When the reading was taken (Unix ms). */
  ts: number;
}

/** The user's own reference range, for one time bucket. */
export interface PersonalReference {
  /** Time bucket this reference describes. */
  bucket: TimeBucket;
  /** Mean of the comparable readings. */
  mean: number;
  /** Standard deviation of the comparable readings. */
  std: number;
  /** How many comparable readings built it. */
  sampleCount: number;
  /** How many distinct days those readings span. */
  windowDays: number;
}

/** How far from the personal reference a reading sits. */
export type DriftMagnitude = 'within' | 'drifting' | 'far';

/**
 * Which side of the reference the reading sits on. Fact-only context —
 * see the module header: this is NOT `docs/brand.md`'s above/below baseline,
 * and neither value means "better".
 */
export type DriftDirection = 'higher' | 'at' | 'lower';

/** A drift claim, with the evidence that permits it. */
export interface DriftAssessment {
  /** Discriminant: this result carries a claim. */
  state: 'assessed';
  /** Signed distance from the reference mean, in readiness points. */
  deviation: number;
  /** Absolute distance — the only number the UI may headline. */
  distance: number;
  /** Normalized distance, or null when the reference is too flat to normalize. */
  z: number | null;
  /** How far out the reading is. */
  magnitude: DriftMagnitude;
  /** Which side of the reference — context only, never a headline. */
  direction: DriftDirection;
  /** The personal reference it was compared against. */
  reference: PersonalReference;
  /** What backs the claim. */
  evidence: EvidenceBasis;
}

/** Either a drift claim, or an honest refusal to make one. */
export type DriftResult = DriftAssessment | InsufficientEvidence;

/** Options for {@link assessDrift}. */
export interface DriftOptions {
  /** "Now" in Unix ms — the reference window and time bucket are resolved from it. */
  now: number;
  /** Override the comparable window; defaults to {@link REFERENCE_WINDOW_DAYS}. */
  windowDays?: number;
}

// ─────────────────────────────────────────────
// Personal reference
// ─────────────────────────────────────────────

/**
 * Clamps a value onto the canonical 0-100 readiness axis. Values outside it are
 * not representable readiness, so they are pinned rather than propagated.
 *
 * @param value - Raw readiness value.
 * @returns The value clamped to 0-100, or null when it is not a finite number.
 */
function clampReadiness(value: number): number | null {
  if (!Number.isFinite(value)) return null;
  return Math.min(100, Math.max(0, value));
}

/**
 * Selects the samples comparable to a moment: same time bucket, inside the
 * recency window, finite value. Comparability is the whole game — a morning
 * reading judged against evening history is a number that looks valid and means
 * nothing (the same trap `selectHrvBaseline` guards in the baseline engine).
 *
 * @param samples - The user's readiness history, in any order.
 * @param options - Reference moment and window.
 * @returns Only the samples that may be compared against that moment.
 */
export function selectComparableSamples(
  samples: readonly ReadinessSample[],
  options: DriftOptions
): ReadinessSample[] {
  const bucket = resolveTimeBucket(options.now);
  const windowDays = options.windowDays ?? REFERENCE_WINDOW_DAYS;
  const oldestAllowed = options.now - windowDays * MS_PER_DAY;

  return samples.filter((s) => {
    if (!Number.isFinite(s.ts) || s.ts > options.now || s.ts < oldestAllowed) return false;
    if (clampReadiness(s.value) === null) return false;
    return resolveTimeBucket(s.ts) === bucket;
  });
}

/**
 * Builds the user's personal reference from comparable samples, reusing the
 * baseline engine's Welford accumulator rather than growing a second statistics
 * implementation.
 *
 * @param samples - Already-comparable samples (see {@link selectComparableSamples}).
 * @param bucket - The time bucket these samples describe.
 * @returns The personal reference.
 */
export function buildPersonalReference(
  samples: readonly ReadinessSample[],
  bucket: TimeBucket
): PersonalReference {
  let metric = createEmptyMetricBaseline();
  for (const s of samples) {
    const value = clampReadiness(s.value);
    if (value === null) continue;
    metric = updateMetricBaseline(metric, value, s.ts);
  }

  return {
    bucket,
    mean: metric.mean,
    std: metric.std,
    sampleCount: metric.sampleCount,
    windowDays: countDistinctDays(samples.map((s) => s.ts)),
  };
}

// ─────────────────────────────────────────────
// Assessment
// ─────────────────────────────────────────────

/**
 * Resolves drift magnitude from the normalized distance when the reference has
 * enough spread, and from absolute distance when it does not.
 *
 * @param z - Normalized distance, or null when the reference is too flat.
 * @param distance - Absolute distance in readiness points.
 * @returns The magnitude band.
 */
function resolveMagnitude(z: number | null, distance: number): DriftMagnitude {
  if (z === null) {
    if (distance >= DRIFT_ABSOLUTE_THRESHOLDS.FAR) return 'far';
    if (distance >= DRIFT_ABSOLUTE_THRESHOLDS.DRIFTING) return 'drifting';
    return 'within';
  }
  const abs = Math.abs(z);
  if (abs >= DRIFT_Z_THRESHOLDS.FAR) return 'far';
  if (abs >= DRIFT_Z_THRESHOLDS.DRIFTING) return 'drifting';
  return 'within';
}

/**
 * Assesses how far the current reading sits from the user's own usual range for
 * this time of day.
 *
 * Returns {@link InsufficientEvidence} — never a degraded number — when there is
 * not enough comparable history to say anything. That refusal is the feature:
 * a drift number invented from three samples would be the most convincing lie
 * this product could tell.
 *
 * @param currentValue - The reading being assessed, on the 0-100 readiness axis.
 * @param history - The user's readiness history (all buckets; filtered here).
 * @param options - Reference moment and optional window override.
 * @returns A drift claim with its evidence, or an insufficient-evidence result.
 */
export function assessDrift(
  currentValue: number,
  history: readonly ReadinessSample[],
  options: DriftOptions
): DriftResult {
  const bucket = resolveTimeBucket(options.now);
  const comparable = selectComparableSamples(history, options);
  const reference = buildPersonalReference(comparable, bucket);
  const current = clampReadiness(currentValue);

  const evidenceInput = {
    sampleCount: reference.sampleCount,
    windowDays: reference.windowDays,
    provenance: ['measured', 'inferred'] as const,
    requirement: DRIFT_EVIDENCE_REQUIREMENT,
  };

  if (current === null || reference.sampleCount < DRIFT_EVIDENCE_REQUIREMENT.minSamples) {
    return insufficientEvidence(evidenceInput);
  }

  const deviation = current - reference.mean;
  const distance = Math.abs(deviation);

  // A near-flat reference cannot normalize a distance: dividing by ~0 turns a
  // 3-point change into "wildly drifting". Fall back to absolute distance and
  // say so in the evidence rather than reporting a confident nonsense number.
  const flatReference = reference.std < MIN_MEANINGFUL_STD;
  const z = flatReference ? null : deviation / reference.std;
  const extraReasons: EvidenceReasonCode[] = flatReference ? ['low_variability_reference'] : [];

  let direction: DriftDirection = 'at';
  if (deviation > AT_REFERENCE_POINTS) direction = 'higher';
  else if (deviation < -AT_REFERENCE_POINTS) direction = 'lower';

  return {
    state: 'assessed',
    deviation: round1(deviation),
    distance: round1(distance),
    z: z === null ? null : round2(z),
    magnitude: resolveMagnitude(z, distance),
    direction,
    reference: {
      ...reference,
      mean: round1(reference.mean),
      std: round1(reference.std),
    },
    evidence: buildEvidence({ ...evidenceInput, extraReasons }),
  };
}

/**
 * Type guard for a drift result that carries a claim.
 *
 * @param result - The drift result to narrow.
 * @returns True when the result is an assessment rather than a refusal.
 */
export function isDriftAssessed(result: DriftResult): result is DriftAssessment {
  return result.state === 'assessed';
}

/**
 * Rounds to one decimal — readiness points are reported to the tenth, never
 * further. Extra digits are false precision (spec § 5 red line 8).
 *
 * @param value - Raw value.
 * @returns Value rounded to one decimal place.
 */
function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Rounds a normalized distance to two decimals.
 *
 * @param value - Raw z value.
 * @returns Value rounded to two decimal places.
 */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
