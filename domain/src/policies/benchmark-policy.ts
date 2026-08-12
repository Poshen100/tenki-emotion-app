/**
 * @module domain/policies/benchmark-policy
 * @description Business rules governing anonymous benchmark participation:
 * opt-in preconditions, upload throttling, and the degraded response returned
 * when a cohort has not yet cleared k-anonymity.
 *
 * Three rules are non-negotiable and encoded here rather than left to callers:
 * participation is opt-in only and defaults to off; at most one aggregated
 * upload per device per day; and an under-populated cohort returns nothing
 * rather than a partial answer.
 *
 * @see docs/GROWTH-ARCHITECTURE.md §4
 * @see docs/PRIVACY_ARCHITECTURE.md §8.1, §10.2
 */

import {
  type AnonymousBenchmarkEnvelope,
  type BenchmarkComparisonResult,
  type BenchmarkCohortDistribution,
  type BenchmarkRolloutStage,
  buildCohortKey,
  isCohortEligible,
  validateEnvelope,
} from '../contracts/benchmark-contract';

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

/** Maximum aggregated uploads per device per day (PRIVACY_ARCHITECTURE §10.2). */
export const MAX_UPLOADS_PER_DAY = 1;

/** Device-side buffer window before a batched upload, in hours. */
export const UPLOAD_BUFFER_HOURS = 24;

/**
 * Milliseconds that must elapse between uploads. Derived from
 * MAX_UPLOADS_PER_DAY so the two can never drift apart.
 */
export const MIN_UPLOAD_INTERVAL_MS = Math.floor(
  (24 * 60 * 60 * 1000) / MAX_UPLOADS_PER_DAY
);

// ─────────────────────────────────────────────
// Participation Preconditions
// ─────────────────────────────────────────────

/** Reasons a device is not allowed to contribute a benchmark envelope. */
export const PARTICIPATION_BLOCKERS = [
  'not_opted_in',
  'feature_disabled',
  'throttled',
  'invalid_envelope',
] as const;
export type ParticipationBlocker = typeof PARTICIPATION_BLOCKERS[number];

/** Device-side state needed to decide whether an upload may proceed. */
export interface BenchmarkParticipationState {
  /** User has explicitly opted in via Settings → Privacy. Defaults to false. */
  readonly optedIn: boolean;
  /** `benchmark_cohorts_v1` feature flag state. */
  readonly featureEnabled: boolean;
  /** Epoch ms of the last successful upload, or null if never uploaded. */
  readonly lastUploadAtMs: number | null;
}

/** Outcome of the participation check. */
export interface ParticipationDecision {
  readonly allowed: boolean;
  readonly blockers: readonly ParticipationBlocker[];
}

/**
 * Decides whether a device may upload a benchmark envelope right now.
 *
 * Opt-in is checked first and independently of everything else: a device that
 * has not opted in is never eligible, regardless of flags or timing.
 *
 * @param envelope - The candidate envelope.
 * @param state - Current device participation state.
 * @param nowMs - Current time in epoch ms.
 * @returns Whether the upload may proceed, and why not if it may not.
 */
export function canContribute(
  envelope: object,
  state: BenchmarkParticipationState,
  nowMs: number
): ParticipationDecision {
  const blockers: ParticipationBlocker[] = [];

  if (!state.optedIn) blockers.push('not_opted_in');
  if (!state.featureEnabled) blockers.push('feature_disabled');
  if (isThrottled(state.lastUploadAtMs, nowMs)) blockers.push('throttled');
  if (!validateEnvelope(envelope).valid) blockers.push('invalid_envelope');

  return { allowed: blockers.length === 0, blockers };
}

/**
 * Whether the daily upload allowance has already been used.
 *
 * @param lastUploadAtMs - Epoch ms of the last upload, or null.
 * @param nowMs - Current time in epoch ms.
 * @returns True when another upload would exceed the daily allowance.
 */
export function isThrottled(lastUploadAtMs: number | null, nowMs: number): boolean {
  if (lastUploadAtMs === null) return false;
  return nowMs - lastUploadAtMs < MIN_UPLOAD_INTERVAL_MS;
}

// ─────────────────────────────────────────────
// Comparison Gating
// ─────────────────────────────────────────────

/**
 * Resolves a comparison request against a cohort's aggregate.
 *
 * Returns `insufficient` — never a partial distribution — when the cohort has
 * not cleared the k-anonymity threshold. Callers must render that state as
 * "samples are still accumulating", not as an error and not as an empty chart.
 *
 * @param envelope - The requesting device's envelope, used to derive the cohort.
 * @param stage - The rollout stage currently open.
 * @param distribution - The server-side aggregate for that cohort, if any.
 * @returns The comparison result.
 */
export function resolveComparison(
  envelope: AnonymousBenchmarkEnvelope,
  stage: BenchmarkRolloutStage,
  distribution: BenchmarkCohortDistribution | null
): BenchmarkComparisonResult {
  const cohortKey = buildCohortKey(envelope, stage);

  if (distribution === null || !isCohortEligible(distribution.distinctDevices)) {
    return { status: 'insufficient', cohortKey };
  }

  return { status: 'ok', distribution };
}

// ─────────────────────────────────────────────
// Buffering
// ─────────────────────────────────────────────

/**
 * Whether a buffered batch is due for upload.
 *
 * Offline batches are dropped rather than backfilled (PRIVACY_ARCHITECTURE
 * §10.2), so callers should clear the buffer after a failed window rather than
 * retrying it later.
 *
 * @param oldestBufferedAtMs - Epoch ms of the oldest buffered envelope, or null.
 * @param nowMs - Current time in epoch ms.
 * @returns True when the buffer window has elapsed.
 */
export function isBufferDue(oldestBufferedAtMs: number | null, nowMs: number): boolean {
  if (oldestBufferedAtMs === null) return false;
  return nowMs - oldestBufferedAtMs >= UPLOAD_BUFFER_HOURS * 60 * 60 * 1000;
}
