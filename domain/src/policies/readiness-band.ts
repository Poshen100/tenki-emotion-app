/**
 * @module domain/policies/readiness-band
 * @description Derives a qualitative readiness band from the signals a
 * browser-tier Soul Scan can honestly measure, and decides whether an existing
 * reading is still fresh enough to carry into a decision.
 *
 * Deliberately produces NO numeric score. The capture tier cannot measure HRV,
 * so inventing a 0-100 "Edge Score" here would be fabrication; the output is a
 * band plus a confidence level that degrades when evidence is weak.
 * All language is calibration/process only — never medical or financial.
 */

import type {
  ReadinessCaptureTier,
  ReadinessEvidence,
  ReadinessReading,
} from '../contracts/readiness-reading';
import type { DomainConfidenceBand, DomainEdgeZone } from '../contracts/scan-contract';

/**
 * How long a reading stays fresh enough to carry into a new decision without
 * re-scanning. Chosen for trading tempo: long enough that a burst of alerts
 * doesn't force repeated ceremonies, short enough that the reading still
 * describes now.
 */
export const READING_FRESHNESS_MS = 15 * 60 * 1000;

/** Minimum samples of a band before a comparison rate is worth showing. */
export const MIN_BAND_SAMPLES_FOR_RATE = 3;

/** Band thresholds on the composite evidence value (0..1). */
const CLEAR_AT = 0.7;
const NEUTRAL_AT = 0.45;

/** Confidence thresholds on capture quality (0..1). */
const HIGH_CONFIDENCE_AT = 0.75;
const MODERATE_CONFIDENCE_AT = 0.5;

/** Weights for the composite. Stillness dominates: it is the most direct and
 * most reliably measured signal of settledness across both capture tiers. */
const WEIGHT_STILLNESS = 0.5;
const WEIGHT_BLINK = 0.3;
const WEIGHT_CAPTURE = 0.2;

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(1, Math.max(0, value));
}

/**
 * Capture quality — how trustworthy the reading's conditions were. Lighting and
 * uniformity say nothing about the person; they only say how much the other
 * signals can be believed.
 *
 * @param evidence - Measured scan signals.
 * @returns Capture quality in 0..1.
 */
export function captureQuality(evidence: ReadinessEvidence): number {
  return clamp01(clamp01(evidence.lighting) * 0.6 + clamp01(evidence.uniformity) * 0.4);
}

/**
 * Resolves the confidence level for a reading. Tier B (no real face detection)
 * is capped at moderate — it must never claim high confidence, because framing
 * is inferred rather than measured. Missing blink data also caps confidence.
 *
 * @param evidence - Measured scan signals.
 * @returns Confidence band.
 */
export function resolveConfidence(evidence: ReadinessEvidence): DomainConfidenceBand {
  const quality = captureQuality(evidence);
  const hasBlink = evidence.blinkCadence !== null;
  if (quality >= HIGH_CONFIDENCE_AT && hasBlink && evidence.tier === 'A') {
    return 'high';
  }
  if (quality >= MODERATE_CONFIDENCE_AT) {
    return 'moderate';
  }
  return 'low';
}

/**
 * Derives the qualitative band from measured evidence. When blink cadence is
 * unavailable its weight is redistributed to stillness rather than assumed —
 * an absent signal must not push the band up or down on its own.
 *
 * @param evidence - Measured scan signals.
 * @returns The readiness band.
 */
export function deriveBand(evidence: ReadinessEvidence): DomainEdgeZone {
  const stillness = clamp01(evidence.stillness);
  const quality = captureQuality(evidence);
  let composite: number;
  if (evidence.blinkCadence === null) {
    composite =
      stillness * (WEIGHT_STILLNESS + WEIGHT_BLINK) + quality * WEIGHT_CAPTURE;
  } else {
    composite =
      stillness * WEIGHT_STILLNESS +
      clamp01(evidence.blinkCadence) * WEIGHT_BLINK +
      quality * WEIGHT_CAPTURE;
  }
  if (composite >= CLEAR_AT) {
    return 'clear';
  }
  if (composite >= NEUTRAL_AT) {
    return 'neutral';
  }
  return 'strain';
}

/**
 * Builds a complete reading from measured evidence.
 *
 * @param evidence - Measured scan signals.
 * @param ts - Capture timestamp (Unix ms).
 * @returns The readiness reading.
 */
export function buildReading(evidence: ReadinessEvidence, ts: number): ReadinessReading {
  return {
    band: deriveBand(evidence),
    confidence: resolveConfidence(evidence),
    ts,
    evidence,
  };
}

/**
 * Whether a reading is still fresh enough to carry into a decision without
 * re-scanning. A reading from the future (clock skew) is treated as fresh.
 *
 * @param reading - The existing reading, or null when none has been taken.
 * @param now - Current time (Unix ms).
 * @returns True when the reading may be carried forward.
 */
export function isReadingFresh(reading: ReadinessReading | null, now: number): boolean {
  if (reading === null) {
    return false;
  }
  return now - reading.ts < READING_FRESHNESS_MS;
}

/** What the decision entry should do about the current reading. */
export type ReadingGate = 'carry_forward' | 'suggest_rescan' | 'no_reading';

/**
 * Decides how the decision entry should treat the existing reading:
 * carry a fresh one forward, suggest a re-scan for a stale one, or note that
 * none exists yet. Never blocks the decision — the trader always may proceed.
 *
 * @param reading - The existing reading, or null.
 * @param now - Current time (Unix ms).
 * @returns The gate decision.
 */
export function resolveReadingGate(
  reading: ReadinessReading | null,
  now: number,
): ReadingGate {
  if (reading === null) {
    return 'no_reading';
  }
  return isReadingFresh(reading, now) ? 'carry_forward' : 'suggest_rescan';
}

/** Discipline rate for one band, or null when the sample is too small. */
export interface BandDisciplineStat {
  /** The band these records share. */
  band: DomainEdgeZone;
  /** How many records were in this band. */
  total: number;
  /** How many of them followed the process. */
  disciplined: number;
  /** disciplined / total, or null when below the minimum sample. */
  rate: number | null;
}

/**
 * Summarizes discipline completion grouped by the band the decision was taken
 * in. Records without a reading are excluded — they cannot be attributed to a
 * band, and guessing one would fabricate the very insight this exists to give.
 * A band below `MIN_BAND_SAMPLES_FOR_RATE` reports its counts with a null rate
 * so the UI can honestly say "資料累積中" instead of showing a noisy percentage.
 *
 * @param records - Decision records paired with the band they were taken in.
 * @returns One stat per band that has at least one record, ordered clear → strain.
 */
export function summarizeDisciplineByBand(
  records: readonly { band: DomainEdgeZone | null; disciplined: boolean }[],
): BandDisciplineStat[] {
  const order: DomainEdgeZone[] = ['clear', 'neutral', 'strain'];
  const stats: BandDisciplineStat[] = [];
  for (const band of order) {
    const inBand = records.filter((record) => record.band === band);
    if (inBand.length === 0) {
      continue;
    }
    const disciplined = inBand.reduce(
      (count, record) => (record.disciplined ? count + 1 : count),
      0,
    );
    stats.push({
      band,
      total: inBand.length,
      disciplined,
      rate:
        inBand.length >= MIN_BAND_SAMPLES_FOR_RATE ? disciplined / inBand.length : null,
    });
  }
  return stats;
}

/**
 * Whether a capture tier is allowed to claim high confidence. Exposed so the
 * capture layer can surface the honest ceiling before a scan starts.
 *
 * @param tier - The capture tier.
 * @returns True only for tier A.
 */
export function tierSupportsHighConfidence(tier: ReadinessCaptureTier): boolean {
  return tier === 'A';
}
