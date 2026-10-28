/**
 * @module domain/contracts/readiness-history
 * @description The append-only local history of readiness readings.
 *
 * 🔴 Why this exists: the app used to keep exactly ONE reading
 * (`tenki.readiness.reading.v1`, written with `setItem`), so every scan
 * overwrote the last. Everything in `packages/engine/src/intelligence/` —
 * Drift Alert, Decision Twin, Clear Window — compares the user against their
 * own past, and none of it can ever run on a store that keeps one row. The
 * moat the product is built on (a personal decision history nobody can copy)
 * was being erased daily.
 *
 * 🔴 A stored sample carries RAW EVIDENCE, never a derived score. The capture
 * tier cannot measure HRV, so a 0-100 number here would be fabrication — the
 * same rule `domain/policies/readiness-band.ts` already states. Band and
 * confidence ARE stored, but only as a record of what the app told the user at
 * the time; the raw signals are what any future analysis re-derives from.
 *
 * ⚠️ The drift axis is deliberately NOT decided here. Storing raw evidence is
 * what lets that decision be made later from real data instead of guessed now
 * — see `docs/DECISION-INTELLIGENCE.md` § 6 Phase 2.
 *
 * @see docs/DECISION-INTELLIGENCE.md
 */

import type { DomainConfidenceBand, DomainEdgeZone } from './scan-contract';
import type { ReadinessCaptureTier } from './readiness-reading';

/**
 * localStorage key for the append-only history.
 *
 * ⚠️ Deliberately a NEW key. `tenki.readiness.reading.v1` keeps its meaning
 * ("the current reading") and its single-row shape — other code reads it, and
 * repurposing a persisted key is how existing records get silently broken.
 */
export const READINESS_HISTORY_KEY = 'tenki.readiness.history.v1';

/** Schema version stamped on every stored sample. */
export const READINESS_HISTORY_SCHEMA = 1;

/**
 * How many samples are kept. At a few scans a day this is well over a year of
 * history, and it bounds localStorage (~200 bytes a sample, so ~100 KB).
 */
export const READINESS_HISTORY_MAX = 500;

/**
 * One stored reading. Flat by design: a nested `evidence` object costs bytes
 * per row and buys nothing here.
 */
export interface ReadinessHistorySample {
  /** Schema version this row was written under. */
  schema: number;
  /** When the reading was captured (Unix ms). */
  ts: number;
  /** Frame-to-frame steadiness, 0..1. */
  stillness: number;
  /** Exposure adequacy, 0..1. */
  lighting: number;
  /** Evenness of illumination, 0..1. */
  uniformity: number;
  /** Blink-cadence regularity 0..1, or null when too few blinks were seen. */
  blinkCadence: number | null;
  /** Capture tier the reading was produced under. */
  tier: ReadinessCaptureTier;
  /** The band the app showed for this reading. */
  band: DomainEdgeZone;
  /** The confidence the app showed for this reading. */
  confidence: DomainConfidenceBand;
}

/**
 * Result of loading the history from storage. `dropped` is part of the result
 * on purpose: silently discarding unreadable rows is the `|| fallback` failure
 * this codebase has paid for before — a distribution computed from half the
 * data must be able to say so.
 */
export interface ReadinessHistoryLoad {
  /** Valid samples, oldest first. */
  samples: ReadinessHistorySample[];
  /** How many stored rows were unreadable and discarded. */
  dropped: number;
}
