/**
 * @module shared/growth/edge-snapshot
 * @description Edge Snapshot — the shareable daily readiness card.
 *
 * The card is deliberately impoverished: one number, one zone band, one date
 * bucket, the TENKI mark. That is not a v1 shortcut, it is the design. Every
 * additional field is a way for a physiological measurement, a comparison, or
 * an action directive to escape onto a public social feed.
 *
 * Copy is built through `buildSnapshotCopy`, which runs the compliance engine
 * over its own output and refuses to produce a card if anything trips. A share
 * card is the one surface where non-compliant copy leaves the device and can
 * never be recalled, so the check happens at construction, not at render.
 *
 * @see docs/GROWTH-ARCHITECTURE.md §5
 * @see ANTIGRAVITY.md §13.4
 */

import type { EdgeZone } from '../../../engine/src/scoring/types';
import { findProhibitedTerms } from '../../../engine/src/compliance/safe-copy';

// ─────────────────────────────────────────────
// Payload
// ─────────────────────────────────────────────

/** Time-of-day bucket shown on the card. Never a precise time. */
export const SNAPSHOT_TIME_BUCKETS = ['morning', 'midday', 'evening'] as const;
export type SnapshotTimeBucket = typeof SNAPSHOT_TIME_BUCKETS[number];

/**
 * Everything an Edge Snapshot card is allowed to contain.
 *
 * The Edge Score is the ONLY number here, and it is the only measurement in the
 * product abstract enough to be safe in public: it carries no units, no
 * physiological meaning, and no clinical interpretation.
 */
export interface EdgeSnapshotPayload {
  /** Edge Score, 0–100. The only numeric field permitted on the card. */
  readonly score: number;
  /** Readiness zone, drives the colour band. */
  readonly zone: EdgeZone;
  /** Calendar date in YYYY-MM-DD. Day granularity only. */
  readonly date: string;
  /** Time-of-day bucket. */
  readonly timeBucket: SnapshotTimeBucket;
}

/**
 * Field names that must never reach a share card. Mirrors the reasoning in
 * `domain/src/contracts/benchmark-contract.ts`: the type says what should be
 * there, this says what must not be, and the second one survives a cast.
 */
export const FORBIDDEN_SNAPSHOT_FIELDS = [
  'hr',
  'heartRate',
  'hrv',
  'rmssd',
  'rr',
  'rrIntervals',
  'respiratoryRate',
  'stressProxy',
  'sleepHours',
  'reflection',
  'note',
  'percentile',
  'rank',
  'comparison',
] as const;

// ─────────────────────────────────────────────
// Copy
// ─────────────────────────────────────────────

/** Fixed card headline. Contains no directive and no comparison. */
export const SNAPSHOT_HEADLINE = 'Decision Readiness Today';

/**
 * Zone labels used on the card. Descriptive states only — never a verdict on
 * what the viewer should do about them.
 */
export const SNAPSHOT_ZONE_LABELS: Readonly<Record<EdgeZone, string>> = {
  clear: 'Clear',
  neutral: 'Neutral',
  strain: 'Strain',
};

/** The rendered text of a snapshot card. */
export interface EdgeSnapshotCopy {
  readonly headline: string;
  /** The score rendered as a string, e.g. "82". */
  readonly value: string;
  readonly zoneLabel: string;
  /** Date plus time bucket, e.g. "2026-08-12 · morning". */
  readonly context: string;
}

/** Why a snapshot could not be built. */
export const SNAPSHOT_REJECTION_REASONS = [
  'score_out_of_range',
  'forbidden_field',
  'non_compliant_copy',
] as const;
export type SnapshotRejectionReason = typeof SNAPSHOT_REJECTION_REASONS[number];

/**
 * The result of building a card. Failure is a value, not an exception: a caller
 * that cannot produce a compliant card should hide the share affordance, not
 * crash the results screen.
 */
export type EdgeSnapshotResult =
  | { readonly ok: true; readonly copy: EdgeSnapshotCopy }
  | {
      readonly ok: false;
      readonly reasons: readonly SnapshotRejectionReason[];
      /** Prohibited terms found, when the failure was a copy failure. */
      readonly prohibitedTerms: readonly string[];
    };

/**
 * Builds the copy for an Edge Snapshot card, refusing to produce one if any
 * rendered string contains prohibited vocabulary.
 *
 * Low scores are shareable by design. Gating sharing on a high score turns the
 * card into a brag, which contradicts the wellness positioning and — because
 * most days are not high-score days — collapses share volume.
 *
 * @param payload - The snapshot payload.
 * @returns The rendered copy, or the reasons it was refused.
 */
export function buildSnapshotCopy(payload: EdgeSnapshotPayload): EdgeSnapshotResult {
  const reasons: SnapshotRejectionReason[] = [];

  if (
    !Number.isFinite(payload.score) ||
    payload.score < 0 ||
    payload.score > 100
  ) {
    reasons.push('score_out_of_range');
  }

  const fields = payload as unknown as Readonly<Record<string, unknown>>;
  for (const field of FORBIDDEN_SNAPSHOT_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(fields, field)) {
      reasons.push('forbidden_field');
      break;
    }
  }

  const copy: EdgeSnapshotCopy = {
    headline: SNAPSHOT_HEADLINE,
    value: String(Math.round(payload.score)),
    zoneLabel: SNAPSHOT_ZONE_LABELS[payload.zone],
    context: `${payload.date} · ${payload.timeBucket}`,
  };

  const prohibitedTerms = findProhibitedTerms(
    [copy.headline, copy.zoneLabel, copy.context].join(' ')
  );
  if (prohibitedTerms.length > 0) reasons.push('non_compliant_copy');

  if (reasons.length > 0) return { ok: false, reasons, prohibitedTerms };
  return { ok: true, copy };
}

// ─────────────────────────────────────────────
// Tier Access
// ─────────────────────────────────────────────

/**
 * Whether Edge Snapshot is available to a tier.
 *
 * Always true. This exists as a named function rather than an inline `true` so
 * that any future attempt to paywall sharing has to delete a documented rule
 * instead of quietly flipping a boolean: with a 5% paid conversion, gating the
 * share surface removes 95% of the shareable population and the viral loop
 * stops existing.
 *
 * @see ANTIGRAVITY.md §12.2 (never-paywall list)
 * @returns Always true.
 */
export function isSnapshotAvailable(): boolean {
  return true;
}
