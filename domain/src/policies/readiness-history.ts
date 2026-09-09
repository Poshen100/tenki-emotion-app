/**
 * @module domain/policies/readiness-history
 * @description Append, prune and describe the local readiness history.
 *
 * The describing half is the point of shipping this now: before any drift
 * threshold can be trusted, someone has to look at how the measured signals
 * ACTUALLY move. `CLAUDE.md` carries the scar — a signal normalized to 0..1
 * moved only 0.69° of hue in practice, and the founder's walkthrough was
 * "顏色好像沒變化？". {@link SignalDistribution.span} is that lesson turned
 * into a number: a signal whose span is tiny cannot carry a threshold,
 * however well-normalized it looks.
 *
 * @see docs/DECISION-INTELLIGENCE.md § 4.1, § 6
 */

import {
  READINESS_HISTORY_MAX,
  READINESS_HISTORY_SCHEMA,
  type ReadinessHistoryLoad,
  type ReadinessHistorySample,
} from '../contracts/readiness-history';
import { READINESS_CAPTURE_TIERS } from '../contracts/readiness-reading';
import type { ReadinessReading } from '../contracts/readiness-reading';
import {
  DOMAIN_CONFIDENCE_BANDS,
  DOMAIN_EDGE_ZONES,
  type DomainConfidenceBand,
  type DomainEdgeZone,
} from '../contracts/scan-contract';

// ─────────────────────────────────────────────
// Writing
// ─────────────────────────────────────────────

/**
 * Converts a completed reading into the flat stored shape.
 *
 * @param reading - The reading the scan produced.
 * @returns The row to append.
 */
export function toHistorySample(reading: ReadinessReading): ReadinessHistorySample {
  return {
    schema: READINESS_HISTORY_SCHEMA,
    ts: reading.ts,
    stillness: reading.evidence.stillness,
    lighting: reading.evidence.lighting,
    uniformity: reading.evidence.uniformity,
    blinkCadence: reading.evidence.blinkCadence,
    tier: reading.evidence.tier,
    band: reading.band,
    confidence: reading.confidence,
  };
}

/**
 * Appends a reading to the history: de-duplicated by timestamp, ordered oldest
 * first, and capped at {@link READINESS_HISTORY_MAX} by dropping the oldest.
 *
 * Re-appending an existing timestamp REPLACES that row rather than adding a
 * second one — a double-write (a re-render, a retried save) must not show up
 * later as two scans, which would inflate every sample count downstream.
 *
 * @param history - The history as loaded.
 * @param sample - The row to append.
 * @returns The new history. The input is not mutated.
 */
export function appendHistorySample(
  history: readonly ReadinessHistorySample[],
  sample: ReadinessHistorySample,
): ReadinessHistorySample[] {
  const kept = history.filter((row) => row.ts !== sample.ts);
  kept.push(sample);
  kept.sort((a, b) => a.ts - b.ts);
  return kept.length > READINESS_HISTORY_MAX
    ? kept.slice(kept.length - READINESS_HISTORY_MAX)
    : kept;
}

// ─────────────────────────────────────────────
// Reading
// ─────────────────────────────────────────────

/**
 * Whether a value is a finite number inside 0..1. Signals outside that range
 * are not the thing they claim to be, so they are dropped rather than clamped:
 * clamping would hide a broken producer inside a plausible-looking distribution.
 *
 * @param value - Candidate value.
 * @returns True when usable as a 0..1 signal.
 */
function isUnitSignal(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
}

/**
 * Validates one stored row.
 *
 * @param row - Untrusted parsed JSON.
 * @returns The sample, or null when it cannot be trusted.
 */
function parseSample(row: unknown): ReadinessHistorySample | null {
  if (typeof row !== 'object' || row === null) return null;
  const r = row as Record<string, unknown>;

  // A row written by a NEWER schema is dropped, not guessed at. Reading it with
  // today's field meanings is how a future rename becomes silent bad data.
  if (r.schema !== READINESS_HISTORY_SCHEMA) return null;
  if (typeof r.ts !== 'number' || !Number.isFinite(r.ts)) return null;
  if (!isUnitSignal(r.stillness) || !isUnitSignal(r.lighting) || !isUnitSignal(r.uniformity)) {
    return null;
  }
  if (r.blinkCadence !== null && !isUnitSignal(r.blinkCadence)) return null;
  if (!READINESS_CAPTURE_TIERS.includes(r.tier as never)) return null;
  if (!DOMAIN_EDGE_ZONES.includes(r.band as never)) return null;
  if (!DOMAIN_CONFIDENCE_BANDS.includes(r.confidence as never)) return null;

  return {
    schema: READINESS_HISTORY_SCHEMA,
    ts: r.ts,
    stillness: r.stillness,
    lighting: r.lighting,
    uniformity: r.uniformity,
    blinkCadence: r.blinkCadence as number | null,
    tier: r.tier as ReadinessHistorySample['tier'],
    band: r.band as DomainEdgeZone,
    confidence: r.confidence as DomainConfidenceBand,
  };
}

/**
 * Loads the history from whatever storage returned, reporting how many rows
 * were unreadable instead of quietly shrinking the dataset.
 *
 * @param raw - Parsed JSON from storage, or anything at all.
 * @returns The usable samples (oldest first) and the dropped count.
 */
export function loadHistory(raw: unknown): ReadinessHistoryLoad {
  if (!Array.isArray(raw)) {
    return { samples: [], dropped: 0 };
  }
  const samples: ReadinessHistorySample[] = [];
  let dropped = 0;
  for (const row of raw) {
    const sample = parseSample(row);
    if (sample === null) {
      dropped++;
    } else {
      samples.push(sample);
    }
  }
  samples.sort((a, b) => a.ts - b.ts);
  return { samples, dropped };
}

// ─────────────────────────────────────────────
// Describing
// ─────────────────────────────────────────────

/** How one measured signal actually behaves across the history. */
export interface SignalDistribution {
  /** How many samples carried this signal. */
  count: number;
  /** Smallest observed value. */
  min: number;
  /** 25th percentile. */
  p25: number;
  /** Median. */
  median: number;
  /** 75th percentile. */
  p75: number;
  /** Largest observed value. */
  max: number;
  /** Arithmetic mean. */
  mean: number;
  /** Population standard deviation. */
  std: number;
  /**
   * How much of its nominal range the signal actually traverses (max − min).
   * 🔴 The number to look at before trusting ANY threshold built on it.
   */
  span: number;
}

/**
 * Value at a percentile of an already-sorted list, by linear interpolation.
 *
 * @param sorted - Ascending values, non-empty.
 * @param q - Percentile in 0..1.
 * @returns The interpolated value.
 */
function percentile(sorted: readonly number[], q: number): number {
  if (sorted.length === 1) return sorted[0];
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

/**
 * Describes how a signal is distributed.
 *
 * @param values - Observed values, in any order.
 * @returns The distribution, or null when nothing was observed.
 */
export function summarizeSignal(values: readonly number[]): SignalDistribution | null {
  const usable = values.filter((v) => Number.isFinite(v));
  if (usable.length === 0) return null;

  const sorted = [...usable].sort((a, b) => a - b);
  const mean = usable.reduce((sum, v) => sum + v, 0) / usable.length;
  const variance = usable.reduce((sum, v) => sum + (v - mean) ** 2, 0) / usable.length;

  return {
    count: usable.length,
    min: sorted[0],
    p25: percentile(sorted, 0.25),
    median: percentile(sorted, 0.5),
    p75: percentile(sorted, 0.75),
    max: sorted[sorted.length - 1],
    mean,
    std: Math.sqrt(variance),
    span: sorted[sorted.length - 1] - sorted[0],
  };
}

/** What the accumulated history looks like so far. */
export interface ReadinessHistorySummary {
  /** How many samples are stored. */
  sampleCount: number;
  /** How many distinct local days they span. */
  distinctDays: number;
  /** Oldest sample timestamp, or null when empty. */
  firstTs: number | null;
  /** Newest sample timestamp, or null when empty. */
  lastTs: number | null;
  /** Distribution of each measured signal, null when never observed. */
  signals: {
    stillness: SignalDistribution | null;
    lighting: SignalDistribution | null;
    uniformity: SignalDistribution | null;
    blinkCadence: SignalDistribution | null;
  };
  /** How many samples came from each capture tier. */
  tierCounts: Record<string, number>;
}

/**
 * Counts the distinct local calendar days a set of timestamps falls on.
 *
 * @param timestamps - Unix ms timestamps.
 * @returns Number of distinct local days.
 */
function countDistinctDays(timestamps: readonly number[]): number {
  const days = new Set<string>();
  for (const ts of timestamps) {
    const d = new Date(ts);
    days.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
  }
  return days.size;
}

/**
 * Summarizes the history, including how far each signal actually travels.
 *
 * This is the input to deciding what a drift axis can honestly be built on —
 * not a user-facing insight. It makes no claim about the person.
 *
 * @param samples - The loaded history.
 * @returns The summary.
 */
export function summarizeHistory(
  samples: readonly ReadinessHistorySample[],
): ReadinessHistorySummary {
  const tierCounts: Record<string, number> = {};
  for (const sample of samples) {
    tierCounts[sample.tier] = (tierCounts[sample.tier] ?? 0) + 1;
  }

  const blinks = samples
    .map((s) => s.blinkCadence)
    .filter((v): v is number => v !== null);

  return {
    sampleCount: samples.length,
    distinctDays: countDistinctDays(samples.map((s) => s.ts)),
    firstTs: samples.length > 0 ? samples[0].ts : null,
    lastTs: samples.length > 0 ? samples[samples.length - 1].ts : null,
    signals: {
      stillness: summarizeSignal(samples.map((s) => s.stillness)),
      lighting: summarizeSignal(samples.map((s) => s.lighting)),
      uniformity: summarizeSignal(samples.map((s) => s.uniformity)),
      blinkCadence: summarizeSignal(blinks),
    },
    tierCounts,
  };
}

/**
 * Buckets a signal's values into a fixed-width histogram over 0..1, so the
 * shape of the distribution is visible rather than just its summary numbers.
 *
 * @param values - Observed values.
 * @param bucketCount - How many buckets to split 0..1 into.
 * @returns Counts per bucket, lowest first.
 */
export function histogram(values: readonly number[], bucketCount: number): number[] {
  const buckets = new Array<number>(Math.max(1, bucketCount)).fill(0);
  for (const value of values) {
    if (!Number.isFinite(value)) continue;
    const clamped = Math.min(1, Math.max(0, value));
    // 1.0 belongs in the last bucket, not in a phantom one past the end.
    const index = Math.min(buckets.length - 1, Math.floor(clamped * buckets.length));
    buckets[index]++;
  }
  return buckets;
}
