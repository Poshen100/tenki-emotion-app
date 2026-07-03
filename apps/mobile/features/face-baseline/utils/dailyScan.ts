/**
 * @module face-baseline/utils/dailyScan
 * @description Pure helpers for the daily (standalone, post-baseline) Soul Scan:
 * decide whether a completed ceremony was a daily refinement scan, and derive
 * the mock Edge Score reveal payload.
 *
 * MOCK STAGE: until the native camera pipeline feeds real signals into
 * `packages/engine` scoring, the daily Edge Score here is a deterministic
 * placeholder (see {@link deriveDailyEdgeScore}). Values are readiness signals
 * only — never medical or financial guidance.
 */

import type { EntryContext, QualityMetrics, RefinementEntry } from '../types/faceBaseline.types';
import { clamp01 } from './progress';

/** Lower bound of the mock daily Edge Score when confidence signals exist. */
export const DAILY_SCORE_MIN = 32;

/** Upper bound of the mock daily Edge Score when confidence signals exist. */
export const DAILY_SCORE_MAX = 96;

/** Centre of the synthetic no-signal fallback band (mock flow has zero quality signals). */
export const FALLBACK_SCORE_BASE = 62;

/** Half-width of the synthetic no-signal fallback band (62 ± 14 → 48–76). */
export const FALLBACK_SCORE_SPREAD = 14;

/**
 * True when a completed ceremony was a daily refinement scan: entered
 * standalone (Scan tab) while a baseline was already established. First-time
 * baselines (onboarding or standalone) return false.
 */
export function isDailyRefinement(
  entryContext: EntryContext,
  baselineAlreadyEstablished: boolean,
): boolean {
  return entryContext === 'standalone' && baselineAlreadyEstablished;
}

/**
 * Mock daily Edge Score (0–100) for the reveal screen.
 *
 * With real confidence signals (> 0) it maps confidence linearly into
 * [DAILY_SCORE_MIN, DAILY_SCORE_MAX]. In the current timer-mocked flow the
 * quality metrics stay at zero, so it falls back to a deterministic per-day
 * synthetic value inside the neutral↔clear band — same day, same score
 * (testable), different days vary (plausible demo).
 */
export function deriveDailyEdgeScore(confidence: number, at: number): number {
  const c = clamp01(confidence);
  if (c > 0) {
    return Math.round(DAILY_SCORE_MIN + (DAILY_SCORE_MAX - DAILY_SCORE_MIN) * c);
  }
  const day = Math.floor(at / 86_400_000);
  // Golden-angle-ish multiplier spreads consecutive days across the band.
  const wave = Math.sin(day * 2.399963);
  return Math.round(FALLBACK_SCORE_BASE + wave * FALLBACK_SCORE_SPREAD);
}

/** Builds the maturity-history entry recorded for a completed daily scan. */
export function buildRefinementEntry(at: number): RefinementEntry {
  return { at, label: 'Baseline refined', type: 'refined' };
}

/**
 * Maps ceremony quality metrics (0–1) onto the scan-store metrics shape
 * (0–100 integers) consumed by the existing result screen.
 */
export function toScanMetrics(q: QualityMetrics): {
  coverage: number;
  stability: number;
  signalQuality: number;
} {
  return {
    coverage: Math.round(clamp01(q.coverage) * 100),
    stability: Math.round((1 - clamp01(q.motion)) * 100),
    signalQuality: Math.round(clamp01(q.sqi) * 100),
  };
}
