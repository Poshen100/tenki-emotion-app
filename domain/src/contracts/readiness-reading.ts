/**
 * @module domain/contracts/readiness-reading
 * @description Contract for a single readiness reading taken from a Soul Scan
 * immediately before a decision. A reading is QUALITATIVE by design: the
 * browser-tier scan can genuinely measure framing, lighting and stillness, but
 * it cannot measure HRV — so a reading carries a band plus a confidence level
 * and the evidence behind it, never a fabricated 0-100 score.
 *
 * Language is process/calibration only: no medical, diagnostic, emotion-
 * recognition or financial-advice framing ever enters this contract.
 * Canonical flow: docs/SOUL-SCAN-NORTH-STAR.md + docs/TRADINGVIEW-ALERT-SPEC.md §9.
 */

import type { DomainConfidenceBand, DomainEdgeZone } from './scan-contract';

/**
 * Capture tier the reading was produced under. Mirrors the tiering in
 * `apps/preview/soul-enroll.js`: Tier A has a real `FaceDetector` (Chrome /
 * Edge) and can measure framing directly; Tier B (iOS Safari) falls back to
 * honest frame heuristics and therefore never claims high confidence.
 */
export const READINESS_CAPTURE_TIERS = ['A', 'B'] as const;
export type ReadinessCaptureTier = typeof READINESS_CAPTURE_TIERS[number];

/**
 * Raw signals a browser-tier scan can honestly measure, each normalized to
 * 0..1 where 1 is best. These are the ONLY inputs allowed to drive a band.
 */
export interface ReadinessEvidence {
  /** Frame-to-frame steadiness (1 = perfectly still). */
  stillness: number;
  /** Overall exposure adequacy (1 = well lit). */
  lighting: number;
  /** Evenness of illumination across the frame (1 = uniform). */
  uniformity: number;
  /**
   * Blink-cadence regularity (1 = steady cadence), or null when too few
   * blinks were observed in the capture window to say anything.
   */
  blinkCadence: number | null;
  /** Capture tier the reading was produced under. */
  tier: ReadinessCaptureTier;
}

/** A completed readiness reading, persisted alongside a decision outcome. */
export interface ReadinessReading {
  /** Qualitative band — reuses the canonical v3 zone vocabulary. */
  band: DomainEdgeZone;
  /** How much the evidence supports the band. */
  confidence: DomainConfidenceBand;
  /** When the reading was taken (Unix ms). */
  ts: number;
  /** The measured signals the band was derived from. */
  evidence: ReadinessEvidence;
}

/**
 * A reading as attached to a decision record. `staleAtDecision` records whether
 * the reading was already past its freshness window when the decision started —
 * carried forward rather than re-scanned.
 */
export interface AttachedReadinessReading extends ReadinessReading {
  /** True when this reading was already stale when the decision began. */
  staleAtDecision: boolean;
}
