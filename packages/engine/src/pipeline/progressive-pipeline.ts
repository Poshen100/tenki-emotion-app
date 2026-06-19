/**
 * @module pipeline/progressive-pipeline
 * @description Progressive (partial) scan pipeline for TENKI CORE v3.
 *
 * Implements the Level 1-4 progressive TEI concept:
 *   Level 1 (T+2s,  ≥0 RR)  — Signal lock only. Fast preliminary score.
 *   Level 2 (T+15s, ≥15 RR) — HRV + HR stability active.
 *   Level 3 (T+30s, ≥30 RR) — Full biometric factors. Sleep neutral if absent.
 *   Level 4 (T+60s, ≥60 RR) — All 8 factors. Maximum on-device accuracy.
 *
 * Usage in the scan loop:
 *   1. Call runProgressiveScan() at each checkpoint.
 *   2. Use didLevelAdvance() to decide when to trigger the star-dust animation.
 *   3. Pass the PartialScanResult.level to the UI for the accuracy badge.
 *
 * When the scan ends, hand off the final Level-4 result to runScanPipeline()
 * for gate evaluation and baseline update (progressive pipeline skips these).
 *
 * @version 1.0
 */

import type { BiometricReading, BaselineProfile, SignalQuality, SleepRecoveryInput } from '../common/types';
import { calculateEdgeScore, classifyEdgeZone, type EdgeScoreInput } from '../scoring/edge-score';
import { selectSource, buildFusionLog, type SourceQuality } from '../fusion';
import type { FusionLog } from '../types';
import type { EdgeScoreResult } from '../scoring/types';

// ─────────────────────────────────────────────────────────────────────────────
// Level Definitions
// ─────────────────────────────────────────────────────────────────────────────

/** Precision level emitted during a progressive scan. */
export type ProgressiveLevel = 1 | 2 | 3 | 4;

/**
 * Minimum RR intervals required before each level can be computed.
 * Level 1 requires only signal lock (0 RR intervals).
 */
export const LEVEL_RR_REQUIREMENTS: Record<ProgressiveLevel, number> = {
  1: 0,
  2: 15,
  3: 30,
  4: 60,
};

/**
 * Approximate maximum accuracy at each level (100 - error%).
 * Used for the UI accuracy badge only — not fed into the engine.
 */
export const LEVEL_ACCURACY_CEILING: Record<ProgressiveLevel, number> = {
  1: 80,  // ±20%
  2: 90,  // ±10%
  3: 93,  // ±7%
  4: 96,  // ±4%
};

/**
 * Confidence multiplier per level.
 * Deflates the engine's optimistic confidence to reflect that
 * several factors were neutralised at early levels.
 */
export const LEVEL_CONFIDENCE_MULTIPLIER: Record<ProgressiveLevel, number> = {
  1: 0.35,
  2: 0.55,
  3: 0.75,
  4: 1.00,
};

/** Which of the 8 Edge Score factors are active at each level. */
export const LEVEL_ACTIVE_FACTORS: Record<ProgressiveLevel, string[]> = {
  1: ['signal_quality'],
  2: ['hrv_vs_baseline', 'hr_stability', 'signal_quality'],
  3: [
    'hrv_vs_baseline', 'hr_stability', 'respiration_stability',
    'stress_proxy_vs_baseline', 'signal_quality',
  ],
  4: [
    'hrv_vs_baseline', 'hr_stability', 'respiration_stability',
    'stress_proxy_vs_baseline', 'sleep_recovery',
    'recent_trend', 'baseline_freshness', 'signal_quality',
  ],
};

const ALL_FACTORS = [
  'hrv_vs_baseline', 'hr_stability', 'respiration_stability',
  'stress_proxy_vs_baseline', 'sleep_recovery', 'recent_trend',
  'baseline_freshness', 'signal_quality',
];

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ProgressiveScanInput {
  /** Partial biometric reading available so far. */
  reading: BiometricReading;
  /** Current signal quality. */
  signalQuality: SignalQuality;
  /** User baseline profile. */
  baseline: BaselineProfile;
  /** Sleep recovery data (may be absent at early levels — use neutralSleep). */
  sleepRecovery: SleepRecoveryInput;
  /** Recent edge scores for trend factor (pass [] if not yet available). */
  recentScores: number[];
  /** Number of RR intervals collected so far. Determines the active level. */
  rrIntervalCount: number;
  /** Available sensor sources for fusion selection. */
  availableSources?: SourceQuality[];
  /**
   * Wearable HRV override (RMSSD ms). When present and > 0,
   * replaces rPPG HRV before the engine runs (same logic as scan-pipeline v3.1).
   */
  wearableHrvRmssdMs?: number;
}

export interface PartialScanResult {
  /** Current progressive level (1–4). */
  level: ProgressiveLevel;
  /** Preliminary Edge Score at this level (0–100). */
  score: number;
  /** Edge zone classification at this level. */
  zone: ReturnType<typeof classifyEdgeZone>;
  /** Adjusted confidence 0–1 (deflated for early levels). */
  confidence: number;
  /** Maximum accuracy ceiling at this level — for UI badge (e.g. "±10%"). */
  accuracyCeiling: number;
  /** Which of the 8 factors were active at this level. */
  activeFactors: string[];
  /** Which factors were skipped due to insufficient data. */
  skippedFactors: string[];
  /** Fusion source log — which sensor was selected. */
  fusionLog: FusionLog;
  /** Whether the score used wearable HRV instead of rPPG. */
  wearableHrvApplied: boolean;
  /** Full EdgeScoreResult for consumers that need the driver breakdown. */
  edgeScoreResult: EdgeScoreResult;
  /** Unix ms timestamp of this partial result. */
  computedAt: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Determines the highest level achievable given the current RR interval count.
 *
 * @param rrCount - Number of RR intervals collected.
 * @returns Current progressive level.
 */
export function resolveLevel(rrCount: number): ProgressiveLevel {
  if (rrCount >= LEVEL_RR_REQUIREMENTS[4]) return 4;
  if (rrCount >= LEVEL_RR_REQUIREMENTS[3]) return 3;
  if (rrCount >= LEVEL_RR_REQUIREMENTS[2]) return 2;
  return 1;
}

/** Returns a SleepRecoveryInput that produces a neutral 50 sub-score. */
function neutralSleep(): SleepRecoveryInput {
  return { source: 'none', durationHours: null, qualityScore: null, stalenessHours: 0 };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Progressive Runner
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Computes a partial scan result for the current progressive level.
 *
 * Call this at each time checkpoint (T+2s, T+15s, T+30s, T+60s).
 * The UI should animate the score display whenever didLevelAdvance() returns true.
 *
 * When the scan ends, pass the Level-4 edgeScoreResult.score and reading into
 * runScanPipeline() for the final gate evaluation and baseline update.
 *
 * @param input - Current scan state including RR interval count.
 * @returns PartialScanResult for the current level.
 */
export function runProgressiveScan(input: ProgressiveScanInput): PartialScanResult {
  const now = input.reading.timestamp;
  const level = resolveLevel(input.rrIntervalCount);

  // ── Fusion source selection (mirrors scan-pipeline Step 0) ──────────────
  const fusionLog: FusionLog = input.availableSources && input.availableSources.length > 0
    ? selectSource(input.availableSources)
    : buildFusionLog('rppg_cheek', input.signalQuality.score);

  // ── Wearable HRV override (mirrors scan-pipeline Step 2) ────────────────
  let effectiveReading = input.reading;
  let wearableHrvApplied = false;

  if (input.wearableHrvRmssdMs && input.wearableHrvRmssdMs > 0) {
    effectiveReading = { ...input.reading, hrvRmssdMs: input.wearableHrvRmssdMs };
    wearableHrvApplied = true;
  }

  // ── Level-appropriate factor masking ────────────────────────────────────
  // At Level 1-2: neutralise sleep so it contributes 50 (not 0).
  // At Level 1-3: pass empty recent scores so trend scores neutral.
  // This prevents early scores being dragged down by missing long-window data.
  const sleepInput: SleepRecoveryInput = level >= 3 ? input.sleepRecovery : neutralSleep();
  const recentScoresInput: number[] = level >= 4 ? input.recentScores : [];

  const edgeInput: EdgeScoreInput = {
    reading: effectiveReading,
    baseline: input.baseline,
    signalQuality: input.signalQuality,
    sleepRecovery: sleepInput,
    recentScores: recentScoresInput,
  };

  const edgeScoreResult = calculateEdgeScore(edgeInput);
  edgeScoreResult.metadata.sourceMix = [fusionLog.source];

  // ── Level-specific confidence deflation ─────────────────────────────────
  // The engine returns an optimistic confidence. Deflate it to signal that
  // precision is still building — users see this as the accuracy badge growing.
  const adjustedConfidence = Math.round(
    edgeScoreResult.confidence.overall * LEVEL_CONFIDENCE_MULTIPLIER[level] * 100
  ) / 100;

  const activeFactors = LEVEL_ACTIVE_FACTORS[level];
  const skippedFactors = ALL_FACTORS.filter(f => !activeFactors.includes(f));

  return {
    level,
    score: edgeScoreResult.score,
    zone: edgeScoreResult.zone,
    confidence: adjustedConfidence,
    accuracyCeiling: LEVEL_ACCURACY_CEILING[level],
    activeFactors,
    skippedFactors,
    fusionLog,
    wearableHrvApplied,
    edgeScoreResult,
    computedAt: now,
  };
}

/**
 * Returns true if the progressive level advanced between two RR counts.
 *
 * Use this in the scan loop to trigger the star-dust score animation
 * and update the accuracy badge in the UI.
 *
 * @example
 * if (didLevelAdvance(prevRrCount, currentRrCount)) {
 *   triggerScoreUpdateAnimation(partialResult.level);
 * }
 *
 * @param prevRrCount - Previous RR interval count.
 * @param nextRrCount - New RR interval count.
 * @returns True if the level increased.
 */
export function didLevelAdvance(prevRrCount: number, nextRrCount: number): boolean {
  return resolveLevel(prevRrCount) !== resolveLevel(nextRrCount);
}
