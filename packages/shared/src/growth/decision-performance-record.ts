/**
 * @module shared/growth/decision-performance-record
 * @description The Decision Performance Dataset (DPD) record — TENKI's deepest
 * data asset and, by construction, a device-only one.
 *
 * A DPD record binds six signal groups to a single decision moment: derived
 * biometrics, self-reported dopamine state, post-decision clarity, temporal
 * bucket, stress proxy level, and the Edge Score context. Individually none of
 * these is scarce — wearables have better physiology and journaling apps have
 * better context. The pairing is what nobody else has, because nobody else asks
 * a question on both sides of a decision.
 *
 * Every record is `local_only`. The aggregate that leaves the device is the
 * benchmark envelope in `domain/src/contracts/benchmark-contract.ts`, which is
 * derived from a record but shares no fields with it by reference.
 *
 * @see docs/GROWTH-ARCHITECTURE.md §3
 * @see docs/PRIVACY_ARCHITECTURE.md §3.2, §4
 */

import type {
  BaselineMaturity,
  ConfidenceBand,
  TimeBucket,
} from '../../../engine/src/common/types';
import type { EdgeZone } from '../../../engine/src/scoring/types';
import type { StressLevel } from '../../../engine/src/biometric/stress-proxy';

// ─────────────────────────────────────────────
// Storage Policy
// ─────────────────────────────────────────────

/**
 * Storage policies a DPD record can carry. There is exactly one, and it is
 * modelled as a union rather than a constant so that adding a cloud policy
 * requires an explicit, reviewable type change.
 */
export const DPD_STORAGE_POLICIES = ['local_only'] as const;
export type DpdStoragePolicy = typeof DPD_STORAGE_POLICIES[number];

// ─────────────────────────────────────────────
// Signal Groups
// ─────────────────────────────────────────────

/**
 * Self-reported dopamine state (ANTIGRAVITY §0.2). Relative and subjective —
 * this is a user's own read on their state, never a measurement, and never
 * presented as one.
 */
export const DOPAMINE_STATES = ['above_baseline', 'at_baseline', 'below_baseline'] as const;
export type DopamineState = typeof DOPAMINE_STATES[number];

/** Post-decision clarity self-rating, 1–5. */
export const CLARITY_RATING_MIN = 1;
export const CLARITY_RATING_MAX = 5;

/**
 * Derived biometric summary. Holds engine outputs, not raw sensor series: RR
 * interval arrays are S1 data with a 90-day rotation and do not belong in a
 * permanently-retained record.
 */
export interface DerivedBiometrics {
  /** RMSSD in ms, as computed by the HRV module. */
  readonly hrvRmssd: number;
  /** Mean heart rate in BPM over the scan window. */
  readonly meanHr: number;
  /** Estimated respiratory rate in breaths per minute. */
  readonly respiratoryRate: number;
  /** Signal quality grade of the underlying capture. */
  readonly signalQuality: number;
  /**
   * Autonomic balance position, -1 (sympathetic-leaning) to +1
   * (parasympathetic-leaning), or null when the baseline was too immature for
   * a trustworthy reading.
   *
   * Persisted rather than recomputed at read time: the position is relative to
   * the baseline as it stood at capture, and that baseline has since moved.
   */
  readonly ansPosition: number | null;
}

/**
 * Sleep preceding the decision, read from HealthKit.
 *
 * Stored on the record because sleep belongs to the night before a specific
 * decision. Resolving it retrospectively means guessing which night a
 * months-old record belonged to, and Edge DNA's sleep trait is only as honest
 * as that pairing.
 */
export interface SleepContext {
  /** Hours slept, or null when no sleep data was available. */
  readonly durationHours: number | null;
  /** Sleep quality 0–100 where available, or null. */
  readonly qualityScore: number | null;
}

/** Edge Score context captured at the decision moment. */
export interface ScoreContext {
  readonly score: number;
  readonly zone: EdgeZone;
  readonly confidenceBand: ConfidenceBand;
  readonly baselineMaturity: BaselineMaturity;
}

// ─────────────────────────────────────────────
// Record
// ─────────────────────────────────────────────

/**
 * Lifecycle state of a record.
 *
 * `pending` records still feed the baseline engine — the physiology is valid
 * whether or not the user came back to reflect. They just never enter the
 * labeled set, which is what the moat is actually made of.
 */
export const DPD_RECORD_STATES = ['pending', 'complete', 'unlabeled'] as const;
export type DpdRecordState = typeof DPD_RECORD_STATES[number];

/** Hours a record waits for a reflection before it is marked `unlabeled`. */
export const REFLECTION_WINDOW_HOURS = 24;

/** A single decision moment, stored device-side in encrypted SQLite. */
export interface DecisionPerformanceRecord {
  /** Local record id. Not a user id and never leaves the device. */
  readonly id: string;
  /** Always `local_only`. */
  readonly storagePolicy: DpdStoragePolicy;
  /** Lifecycle state. */
  readonly state: DpdRecordState;
  /** Epoch ms of the scan. Local-only, so full precision is fine here. */
  readonly capturedAtMs: number;
  /** Time-of-day bucket, matching the baseline engine's bucketing. */
  readonly timeBucket: TimeBucket;
  /** Day of week, 0 (Sunday) – 6 (Saturday). */
  readonly dayOfWeek: number;
  /** Derived biometrics. */
  readonly biometrics: DerivedBiometrics;
  /** Stress proxy level at capture. */
  readonly stressLevel: StressLevel;
  /** Sleep preceding this decision. */
  readonly sleep: SleepContext;
  /** Edge Score context. */
  readonly scoreContext: ScoreContext;
  /** Self-reported dopamine state, or null if not logged. */
  readonly dopamineState: DopamineState | null;
  /** Post-decision clarity 1–5, or null until the reflection is completed. */
  readonly clarityRating: number | null;
}

// ─────────────────────────────────────────────
// Lifecycle
// ─────────────────────────────────────────────

/**
 * Resolves the lifecycle state of a record.
 *
 * @param record - The record, without its state field.
 * @param nowMs - Current time in epoch ms.
 * @returns The state the record should be in.
 */
export function resolveRecordState(
  record: Omit<DecisionPerformanceRecord, 'state'>,
  nowMs: number
): DpdRecordState {
  if (record.clarityRating !== null) return 'complete';

  const elapsedMs = nowMs - record.capturedAtMs;
  if (elapsedMs >= REFLECTION_WINDOW_HOURS * 60 * 60 * 1000) return 'unlabeled';

  return 'pending';
}

/**
 * Whether a record contributes to the labeling moat — i.e. carries the
 * physiology-to-clarity pairing that competitors cannot reconstruct.
 *
 * @param record - The record to check.
 * @returns True when the record is a usable label.
 */
export function isLabeledRecord(record: DecisionPerformanceRecord): boolean {
  return (
    record.clarityRating !== null &&
    record.clarityRating >= CLARITY_RATING_MIN &&
    record.clarityRating <= CLARITY_RATING_MAX
  );
}

/**
 * Counts records that qualify as labels.
 *
 * Drives the timing-based conversion triggers in GROWTH-ARCHITECTURE §7.2 and
 * the AI Coach phase gates in §6.2 — both key off label count, not install age,
 * because a user who never reflects has no patterns to surface.
 *
 * @param records - Records to count.
 * @returns The number of labeled records.
 */
export function countLabels(records: readonly DecisionPerformanceRecord[]): number {
  return records.filter(isLabeledRecord).length;
}

/**
 * Time buckets covered by a set of records. Coverage across all three buckets
 * is one of the three multiplicative factors in the user-value model
 * (GROWTH-ARCHITECTURE §2.4): a user who only ever scans in the morning cannot
 * be told when their clear windows are.
 *
 * @param records - Records to inspect.
 * @returns The distinct time buckets present.
 */
export function coveredTimeBuckets(
  records: readonly DecisionPerformanceRecord[]
): readonly TimeBucket[] {
  const seen = new Set<TimeBucket>();
  for (const record of records) seen.add(record.timeBucket);
  return Array.from(seen);
}
