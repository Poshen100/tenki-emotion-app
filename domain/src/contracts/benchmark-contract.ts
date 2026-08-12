/**
 * @module domain/contracts/benchmark-contract
 * @description Contract for the anonymous benchmark envelope — the ONLY
 * scan-derived payload that is ever allowed to leave the device.
 *
 * The envelope carries bucketed classifications, never measurements: a zone
 * instead of an Edge Score, a confidence band instead of a coefficient, a time
 * bucket instead of a timestamp. Raw HR/HRV/RR and reflection text are S1–S3
 * data and never appear here under any circumstance.
 *
 * Comparison results are gated on k-anonymity: a cohort with fewer than
 * BENCHMARK_K_THRESHOLD distinct devices returns nothing at all rather than a
 * degraded answer. That is both a privacy requirement and a product one — a
 * "global comparison" computed from six samples is worse than no comparison.
 *
 * @see docs/GROWTH-ARCHITECTURE.md §4
 * @see docs/PRIVACY_ARCHITECTURE.md §5.1, §10
 */

import type {
  DomainConfidenceBand,
  DomainEdgeZone,
  DomainSessionMode,
} from './scan-contract';

// ─────────────────────────────────────────────
// Cohort Dimensions
// ─────────────────────────────────────────────

/**
 * Time-of-day buckets. Mirrors the baseline engine's bucketing so a benchmark
 * comparison is always made against the same slice the personal baseline uses.
 */
export const BENCHMARK_TIME_BUCKETS = ['morning', 'midday', 'evening'] as const;
export type BenchmarkTimeBucket = typeof BENCHMARK_TIME_BUCKETS[number];

/** Baseline maturity stages. Scores across different stages are not comparable. */
export const BENCHMARK_MATURITY_STAGES = ['new', 'building', 'ready', 'mature'] as const;
export type BenchmarkMaturityStage = typeof BENCHMARK_MATURITY_STAGES[number];

/**
 * Post-decision clarity self-rating, bucketed from the raw 1–5 scale.
 * Null when the user never completed a reflection for that scan.
 */
export const BENCHMARK_CLARITY_BANDS = ['low', 'mid', 'high'] as const;
export type BenchmarkClarityBand = typeof BENCHMARK_CLARITY_BANDS[number];

/**
 * Cohort dimensions, in the order they appear in a cohort key.
 *
 * Deliberately EXCLUDED: age, gender, region, device model. Those shatter
 * cohorts below the k threshold while acting as quasi-identifiers — high risk,
 * low product value.
 */
export const BENCHMARK_COHORT_DIMENSIONS = [
  'timeBucket',
  'dayOfWeek',
  'baselineMaturity',
  'scenarioMode',
] as const;
export type BenchmarkCohortDimension = typeof BENCHMARK_COHORT_DIMENSIONS[number];

// ─────────────────────────────────────────────
// k-anonymity
// ─────────────────────────────────────────────

/**
 * Minimum distinct devices in a cohort before any comparison is returned.
 * Fixed by docs/PRIVACY_ARCHITECTURE.md §5.1 — do not lower this to make a
 * cohort "work" during cold start; open a coarser rollout stage instead.
 */
export const BENCHMARK_K_THRESHOLD = 50;

/**
 * Cold-start rollout stages. Cohorts are opened coarse-to-fine so that early
 * cohorts can actually clear the k threshold. Controlled remotely by the
 * `benchmark_cohorts_v1` feature flag.
 *
 * @see docs/GROWTH-ARCHITECTURE.md §4.5
 */
export const BENCHMARK_ROLLOUT_STAGES = ['S1', 'S2', 'S3', 'S4'] as const;
export type BenchmarkRolloutStage = typeof BENCHMARK_ROLLOUT_STAGES[number];

/** Which cohort dimensions are active at each rollout stage. */
export const ROLLOUT_STAGE_DIMENSIONS: Record<
  BenchmarkRolloutStage,
  readonly BenchmarkCohortDimension[]
> = {
  S1: ['timeBucket'],
  S2: ['timeBucket', 'dayOfWeek'],
  S3: ['timeBucket', 'dayOfWeek', 'baselineMaturity'],
  S4: ['timeBucket', 'dayOfWeek', 'baselineMaturity', 'scenarioMode'],
};

// ─────────────────────────────────────────────
// Upload Envelope
// ─────────────────────────────────────────────

/**
 * The complete set of fields uploaded for one opt-in benchmark contribution.
 *
 * Every field is a bucket or a hash. There is intentionally no numeric score,
 * no physiological measurement, no free text, and no precise timestamp —
 * a precise timestamp is itself a quasi-identifier.
 */
export interface AnonymousBenchmarkEnvelope {
  /**
   * SHA256(random_device_id + keychain_salt). The random id is generated on the
   * device and never associated with an account, email, or purchase receipt.
   */
  readonly deviceIdHash: string;
  /** Bucketed readiness classification. Never the underlying Edge Score. */
  readonly zone: DomainEdgeZone;
  /** Bucketed confidence. Never the underlying coefficient. */
  readonly confidenceBand: DomainConfidenceBand;
  /** Time-of-day bucket. Never a timestamp. */
  readonly timeBucket: BenchmarkTimeBucket;
  /** Day of week, 0 (Sunday) – 6 (Saturday). Never a calendar date. */
  readonly dayOfWeek: number;
  /** Baseline maturity stage at the time of the scan. */
  readonly baselineMaturity: BenchmarkMaturityStage;
  /** Scenario mode the scan was taken under. */
  readonly scenarioMode: DomainSessionMode;
  /** Bucketed post-decision clarity, or null when no reflection was completed. */
  readonly clarityBand: BenchmarkClarityBand | null;
}

/** Opaque cohort key: the join key for server-side aggregation. */
export type BenchmarkCohortKey = string;

/**
 * A cohort's aggregate result, as returned to a client that cleared the
 * k threshold. Distributions are proportions in 0..1 that sum to 1.
 */
export interface BenchmarkCohortDistribution {
  readonly cohortKey: BenchmarkCohortKey;
  /** Number of distinct devices behind this distribution (always >= k). */
  readonly distinctDevices: number;
  /** Proportion of contributions in each zone. */
  readonly zoneShare: Readonly<Record<DomainEdgeZone, number>>;
  /** Proportion of contributions in each clarity band (unlabeled excluded). */
  readonly clarityShare: Readonly<Record<BenchmarkClarityBand, number>>;
}

/**
 * Result of a benchmark comparison request. The `insufficient` variant is a
 * first-class outcome, not an error: it is what the client renders as
 * "samples are still accumulating".
 */
export type BenchmarkComparisonResult =
  | { readonly status: 'ok'; readonly distribution: BenchmarkCohortDistribution }
  | { readonly status: 'insufficient'; readonly cohortKey: BenchmarkCohortKey };

// ─────────────────────────────────────────────
// Cohort Key Construction
// ─────────────────────────────────────────────

/**
 * Builds the cohort key for an envelope at a given rollout stage.
 *
 * Only the dimensions active at that stage are included, so a stage-S1 key and
 * a stage-S4 key for the same envelope are different cohorts by construction.
 *
 * @param envelope - The benchmark envelope to derive a cohort from.
 * @param stage - The rollout stage currently open.
 * @returns The cohort key.
 */
export function buildCohortKey(
  envelope: AnonymousBenchmarkEnvelope,
  stage: BenchmarkRolloutStage
): BenchmarkCohortKey {
  const parts: string[] = [stage];

  for (const dimension of ROLLOUT_STAGE_DIMENSIONS[stage]) {
    switch (dimension) {
      case 'timeBucket':
        parts.push(`tb:${envelope.timeBucket}`);
        break;
      case 'dayOfWeek':
        parts.push(`dw:${envelope.dayOfWeek}`);
        break;
      case 'baselineMaturity':
        parts.push(`bm:${envelope.baselineMaturity}`);
        break;
      case 'scenarioMode':
        parts.push(`sm:${envelope.scenarioMode}`);
        break;
    }
  }

  return parts.join('|');
}

/**
 * Whether a cohort has enough distinct devices to be reported at all.
 *
 * @param distinctDevices - Distinct devices contributing to the cohort.
 * @returns True when the cohort clears the k-anonymity threshold.
 */
export function isCohortEligible(distinctDevices: number): boolean {
  return Number.isFinite(distinctDevices) && distinctDevices >= BENCHMARK_K_THRESHOLD;
}

// ─────────────────────────────────────────────
// Envelope Validation
// ─────────────────────────────────────────────

/**
 * Field names that must never appear on an outbound benchmark envelope.
 * Used as a runtime tripwire against accidental widening of the payload —
 * a type-level guarantee is not enough once objects cross a network boundary.
 */
export const FORBIDDEN_ENVELOPE_FIELDS = [
  'edgeScore',
  'score',
  'hr',
  'heartRate',
  'hrv',
  'rmssd',
  'rr',
  'rrIntervals',
  'respiratoryRate',
  'stressProxy',
  'reflection',
  'note',
  'timestamp',
  'capturedAt',
  'latitude',
  'longitude',
  'email',
  'userId',
] as const;

/** Reasons an envelope can be rejected before upload. */
export const ENVELOPE_REJECTION_REASONS = [
  'forbidden_field',
  'invalid_day_of_week',
  'missing_device_hash',
] as const;
export type EnvelopeRejectionReason = typeof ENVELOPE_REJECTION_REASONS[number];

/** Outcome of validating an envelope before it is allowed to leave the device. */
export interface EnvelopeValidation {
  readonly valid: boolean;
  readonly reasons: readonly EnvelopeRejectionReason[];
  /** Any forbidden field names actually found, for debugging. */
  readonly forbiddenFields: readonly string[];
}

/**
 * Validates an outbound envelope. Rejects on any forbidden field, a day-of-week
 * outside 0–6, or a missing device hash.
 *
 * Accepts a bare `object` rather than the envelope type: the whole point of the
 * check is to catch fields that were added somewhere the type system was
 * bypassed, so a well-typed parameter would defeat it.
 *
 * @param envelope - The candidate envelope.
 * @returns The validation outcome.
 */
export function validateEnvelope(envelope: object): EnvelopeValidation {
  const fields = envelope as Readonly<Record<string, unknown>>;
  const reasons: EnvelopeRejectionReason[] = [];
  const forbiddenFields: string[] = [];

  for (const field of FORBIDDEN_ENVELOPE_FIELDS) {
    if (Object.hasOwn(envelope, field)) {
      forbiddenFields.push(field);
    }
  }
  if (forbiddenFields.length > 0) reasons.push('forbidden_field');

  const dayOfWeek = fields.dayOfWeek;
  if (typeof dayOfWeek !== 'number' || !Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
    reasons.push('invalid_day_of_week');
  }

  const deviceIdHash = fields.deviceIdHash;
  if (typeof deviceIdHash !== 'string' || deviceIdHash.length === 0) {
    reasons.push('missing_device_hash');
  }

  return { valid: reasons.length === 0, reasons, forbiddenFields };
}
