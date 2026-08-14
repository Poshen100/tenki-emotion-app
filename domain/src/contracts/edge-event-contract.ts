/**
 * @module domain/contracts/edge-event-contract
 * @description Contract for the EDGE DETECTED event — what the detector emits
 * when a sustained readiness window is confirmed.
 *
 * The event carries classifications, never measurements: a detected-state label
 * instead of an Edge Score, a confidence band instead of a coefficient, a time
 * bucket alongside the local timestamp. The event stays on the device, but the
 * forbidden-field tripwire is here anyway for the same reason it is on the
 * benchmark envelope — a type stops guaranteeing anything the moment an object
 * is built somewhere the type system was bypassed.
 *
 * @see docs/EDGE-DETECTOR-ARCHITECTURE.md §6
 * @see ANTIGRAVITY.md §5.2
 */

import type { DomainConfidenceBand } from './scan-contract';

// ─────────────────────────────────────────────
// Vocabulary
// ─────────────────────────────────────────────

/**
 * Detected state labels. Mirrors `DetectedState` in the engine's scoring
 * types and stays inside the compliance ALLOWED_VOCABULARY — these strings
 * reach the interface.
 *
 * No 'recovered' member: recovery is relative to a worse prior state, which
 * the score-only classifier cannot express, and the recovery narrative already
 * belongs to the EDGE STATUS chip.
 */
export const EDGE_DETECTED_STATES = [
  'calm',
  'focused',
  'balanced',
  'stable',
  'clear',
] as const;
export type EdgeDetectedState = typeof EDGE_DETECTED_STATES[number];

/** Detection strength. 'soft' cleared the lower threshold, 'strong' the upper. */
export const EDGE_DETECTION_STRENGTHS = ['soft', 'strong'] as const;
export type EdgeDetectionStrength = typeof EDGE_DETECTION_STRENGTHS[number];

/** Time-of-day buckets, matching the baseline engine's bucketing. */
export const EDGE_EVENT_TIME_BUCKETS = ['morning', 'midday', 'evening'] as const;
export type EdgeEventTimeBucket = typeof EDGE_EVENT_TIME_BUCKETS[number];

/**
 * How the tick that produced this event was driven. Background delivery cannot
 * observe a continuous window (iOS decides the cadence, often tens of minutes),
 * so a background-sourced event is a retrospective mark, never grounds for a
 * live alert.
 *
 * @see docs/EDGE-DETECTOR-ARCHITECTURE.md §2.2
 */
export const EDGE_EVENT_SOURCES = [
  'foreground_active',
  'foreground_passive',
  'background_retrospective',
] as const;
export type EdgeEventSource = typeof EDGE_EVENT_SOURCES[number];

// ─────────────────────────────────────────────
// Event
// ─────────────────────────────────────────────

/** A confirmed readiness window. Device-only; never uploaded. */
export interface EdgeDetectedEvent {
  /** Local event id. Not a user id, and it never leaves the device. */
  readonly eventId: string;
  /** Local epoch ms at which the window was confirmed. */
  readonly detectedAtMs: number;
  /** Epoch ms at which the window started accumulating. */
  readonly windowStartedAtMs: number;
  /** Detection strength. */
  readonly strength: EdgeDetectionStrength;
  /** Detected state label. */
  readonly detectedState: EdgeDetectedState;
  /** How long the window had been held when confirmed. */
  readonly heldDurationSec: number;
  /** Time-of-day bucket. */
  readonly timeBucket: EdgeEventTimeBucket;
  /** Bucketed confidence. Never the underlying coefficient. */
  readonly confidenceBand: DomainConfidenceBand;
  /** What drove the tick. */
  readonly source: EdgeEventSource;
}

/**
 * Field names that must never appear on an edge event. Physiological values and
 * the Edge Score itself are the point of the list: the event is a signal that
 * something happened, not a record of what was measured.
 */
export const FORBIDDEN_EVENT_FIELDS = [
  'edgeScore',
  'score',
  'confidence',
  'hr',
  'heartRate',
  'hrv',
  'rmssd',
  'rr',
  'rrIntervals',
  'respiratoryRate',
  'stressProxy',
  'stressScore',
  'ansBalance',
  'sleepHours',
  'reflection',
  'note',
] as const;

/** Reasons an event can be rejected. */
export const EVENT_REJECTION_REASONS = [
  'forbidden_field',
  'missing_event_id',
  'negative_hold_duration',
  'window_start_after_detection',
] as const;
export type EventRejectionReason = typeof EVENT_REJECTION_REASONS[number];

/** Outcome of validating an event. */
export interface EdgeEventValidation {
  readonly valid: boolean;
  readonly reasons: readonly EventRejectionReason[];
  /** Any forbidden field names actually found, for debugging. */
  readonly forbiddenFields: readonly string[];
}

/**
 * Validates an edge event before it is persisted or handed to the delivery
 * layer.
 *
 * Accepts a bare `object` rather than the event type: the check exists to catch
 * fields added where the type system was bypassed, so a well-typed parameter
 * would defeat it.
 *
 * @param event - The candidate event.
 * @returns The validation outcome.
 */
export function validateEdgeEvent(event: object): EdgeEventValidation {
  const fields = event as Readonly<Record<string, unknown>>;
  const reasons: EventRejectionReason[] = [];
  const forbiddenFields: string[] = [];

  for (const field of FORBIDDEN_EVENT_FIELDS) {
    if (Object.hasOwn(event, field)) {
      forbiddenFields.push(field);
    }
  }
  if (forbiddenFields.length > 0) reasons.push('forbidden_field');

  const eventId = fields.eventId;
  if (typeof eventId !== 'string' || eventId.length === 0) {
    reasons.push('missing_event_id');
  }

  const held = fields.heldDurationSec;
  if (typeof held !== 'number' || !Number.isFinite(held) || held < 0) {
    reasons.push('negative_hold_duration');
  }

  const started = fields.windowStartedAtMs;
  const detected = fields.detectedAtMs;
  if (
    typeof started === 'number' &&
    typeof detected === 'number' &&
    started > detected
  ) {
    reasons.push('window_start_after_detection');
  }

  return { valid: reasons.length === 0, reasons, forbiddenFields };
}

// ─────────────────────────────────────────────
// Deduplication
// ─────────────────────────────────────────────

/**
 * Builds the deduplication key for an event.
 *
 * One sustained window emits exactly one EDGE DETECTED. The key is derived from
 * when the window started rather than when it was confirmed, so the same window
 * re-confirming on later ticks collapses onto the same key.
 *
 * @param event - The event to key.
 * @returns The dedupe key.
 */
export function buildEventDedupeKey(event: EdgeDetectedEvent): string {
  return `${event.windowStartedAtMs}|${event.timeBucket}`;
}

/**
 * Whether an event is a duplicate of one already recorded.
 *
 * @param event - The candidate event.
 * @param seenKeys - Dedupe keys already recorded.
 * @returns True when this window has already emitted an event.
 */
export function isDuplicateEvent(
  event: EdgeDetectedEvent,
  seenKeys: readonly string[]
): boolean {
  return seenKeys.includes(buildEventDedupeKey(event));
}

// ─────────────────────────────────────────────
// Live-alert eligibility
// ─────────────────────────────────────────────

/**
 * Whether an event may drive a live notification at all.
 *
 * Background-sourced events never can: background delivery cannot observe a
 * continuous window, so a "live" alert from one would be describing a state the
 * user may have left half an hour ago. Those events feed the end-of-day recap
 * and the Focus Window statistics instead.
 *
 * This is eligibility only — throttling, quiet hours, tier and session checks
 * all live in the delivery layer (`policies/alert-policy.ts`).
 *
 * @param event - The event to check.
 * @returns True when a live alert is even a possibility.
 */
export function isLiveAlertEligible(event: EdgeDetectedEvent): boolean {
  return event.source !== 'background_retrospective';
}
