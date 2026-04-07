/**
 * @module scoring/edge-score
 * @description Decision Edge Score engine — 8-factor weighted readiness score (0-100).
 * This is the core scoring algorithm for TENKI CORE v3.
 *
 * @version 3.0
 * @see ANTIGRAVITY.md v3.0 Section 1.1
 */

import {
  BiometricReading,
  BaselineProfile,
  SignalQuality,
  SleepRecoveryInput,
  TimeBucket,
  MetricBaseline,
  ConfidenceBreakdown,
  ConfidenceBand,
  CONFIDENCE_BANDS,
} from '../common/types';

import {
  EDGE_WEIGHTS,
  EdgeZone,
  EdgeScoreResult,
  ScoreDriver,
  ScoreDriverKey,
  DriverDirection,
} from './types';

import { generateSafeCopy, getDriverExplanation } from '../compliance/safe-copy';

// ─────────────────────────────────────────────
// Helper: clamp
// ─────────────────────────────────────────────

/**
 * Clamps a value between min and max.
 *
 * @param value - The value to clamp.
 * @param min - Minimum bound.
 * @param max - Maximum bound.
 * @returns Clamped value.
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// ─────────────────────────────────────────────
// Helper: Z-Score Sub-Score
// ─────────────────────────────────────────────

/**
 * Converts a z-score into a 0-100 sub-score.
 * z=0 → 50, z=+2 → ~100, z=-2 → ~0
 *
 * @param zScore - The z-score value.
 * @param invert - If true, inverts direction (higher z = lower score, e.g., HR).
 * @returns Sub-score 0-100.
 */
function zScoreToSubScore(zScore: number, invert: boolean = false): number {
  const adjusted = invert ? -zScore : zScore;
  return clamp(Math.round(50 + adjusted * 25), 0, 100);
}

/**
 * Computes the z-score of a value against a baseline.
 *
 * @param value - Current measurement.
 * @param baseline - Baseline containing mean and std.
 * @returns Z-score, or 0 if baseline is insufficient.
 */
function computeZScore(value: number, baseline: MetricBaseline): number {
  if (baseline.sampleCount === 0 || baseline.std === 0) {
    return 0;
  }
  return (value - baseline.mean) / baseline.std;
}

// ─────────────────────────────────────────────
// Helper: Time Bucket
// ─────────────────────────────────────────────

/**
 * Determines the time bucket for a given timestamp.
 *
 * @param timestamp - Unix ms timestamp.
 * @returns The corresponding TimeBucket.
 */
export function getTimeBucket(timestamp: number): TimeBucket {
  const hour = new Date(timestamp).getHours();
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 18) return 'midday';
  return 'evening';
}

// ─────────────────────────────────────────────
// Helper: Direction from impact
// ─────────────────────────────────────────────

/**
 * Determines the direction of a driver's influence.
 *
 * @param subScore - The 0-100 sub-score.
 * @returns DriverDirection classification.
 */
function getDirection(subScore: number): DriverDirection {
  if (subScore >= 60) return 'positive';
  if (subScore >= 40) return 'neutral';
  return 'negative';
}

// ─────────────────────────────────────────────
// Sub-Score Calculators (Factors 1-8)
// ─────────────────────────────────────────────

/** Input data for Edge Score calculation. */
export interface EdgeScoreInput {
  /** Current biometric reading. */
  reading: BiometricReading;
  /** User's baseline profile. */
  baseline: BaselineProfile;
  /** Current signal quality assessment. */
  signalQuality: SignalQuality;
  /** Sleep recovery input (may be incomplete). */
  sleepRecovery: SleepRecoveryInput;
  /** Recent Edge Scores for trend analysis (newest first, up to 10). */
  recentScores: number[];
}

/**
 * Factor 1: HRV vs personal baseline (weight: 25).
 * Higher HRV relative to baseline → higher sub-score.
 *
 * @param hrvRmssd - Current HRV RMSSD in ms.
 * @param baseline - HRV baseline for current time bucket.
 * @returns Sub-score 0-100.
 */
function calcHrvVsBaseline(hrvRmssd: number, baseline: MetricBaseline): number {
  const z = computeZScore(hrvRmssd, baseline);
  return zScoreToSubScore(z, false); // Higher HRV = better
}

/**
 * Factor 2: HR stability (weight: 15).
 * Stable HR near baseline → higher sub-score.
 *
 * @param hrBpm - Current heart rate BPM.
 * @param baseline - HR baseline for current time bucket.
 * @returns Sub-score 0-100.
 */
function calcHrStability(hrBpm: number, baseline: MetricBaseline): number {
  const z = computeZScore(hrBpm, baseline);
  // For HR, being close to baseline is good. Large deviations (either way) are bad.
  const absZ = Math.abs(z);
  return clamp(Math.round(100 - absZ * 30), 0, 100);
}

/**
 * Factor 3: Respiration stability (weight: 10).
 * Stable respiration within normal range → higher sub-score.
 *
 * @param rrBrpm - Current respiratory rate in breaths per minute.
 * @param baseline - RR baseline for current time bucket.
 * @returns Sub-score 0-100.
 */
function calcRespirationStability(rrBrpm: number, baseline: MetricBaseline): number {
  const z = computeZScore(rrBrpm, baseline);
  const absZ = Math.abs(z);
  return clamp(Math.round(100 - absZ * 30), 0, 100);
}

/**
 * Factor 4: Stress proxy vs baseline (weight: 15).
 * Lower stress relative to baseline → higher sub-score.
 *
 * @param reading - Current biometric reading.
 * @param baseline - Baseline profile.
 * @param timeBucket - Current time bucket.
 * @returns Sub-score 0-100.
 */
function calcStressProxy(
  reading: BiometricReading,
  baseline: BaselineProfile,
  timeBucket: TimeBucket
): number {
  // Stress proxy: combination of HR elevation + HRV depression
  const hrZ = computeZScore(reading.hrBpm, baseline.hr[timeBucket]);
  const hrvZ = computeZScore(reading.hrvRmssdMs, baseline.hrv[timeBucket]);

  // Higher HR + Lower HRV = more stress
  const stressIndicator = hrZ - hrvZ; // positive = more stress
  return zScoreToSubScore(stressIndicator, true); // Invert: less stress = better
}

/**
 * Factor 5: Sleep recovery (weight: 15).
 * Good sleep → higher sub-score. Missing data → neutral 50.
 *
 * @param sleep - Sleep recovery input.
 * @returns Sub-score 0-100.
 */
function calcSleepRecovery(sleep: SleepRecoveryInput): number {
  if (sleep.source === 'none' || sleep.durationHours === null) {
    return 50; // Neutral when no data
  }

  let score = 50;

  // Duration contribution
  if (sleep.durationHours >= 7 && sleep.durationHours <= 9) {
    score += 25; // Optimal range
  } else if (sleep.durationHours >= 6) {
    score += 10;
  } else {
    score -= 15;
  }

  // Quality contribution
  if (sleep.qualityScore !== null) {
    score += Math.round((sleep.qualityScore - 50) * 0.3);
  }

  // Staleness penalty
  if (sleep.stalenessHours > 24) {
    score -= 10;
  }

  return clamp(score, 0, 100);
}

/**
 * Factor 6: Recent trend consistency (weight: 10).
 * Stable/improving trend → higher sub-score.
 *
 * @param recentScores - Recent Edge Scores (newest first, up to 10).
 * @returns Sub-score 0-100.
 */
function calcRecentTrend(recentScores: number[]): number {
  if (recentScores.length < 2) {
    return 50; // Neutral when insufficient history
  }

  // Simple trend: compare recent average to older average
  const half = Math.floor(recentScores.length / 2);
  const recentHalf = recentScores.slice(0, half);
  const olderHalf = recentScores.slice(half);

  const recentAvg = recentHalf.reduce((a, b) => a + b, 0) / recentHalf.length;
  const olderAvg = olderHalf.reduce((a, b) => a + b, 0) / olderHalf.length;

  const trendDelta = recentAvg - olderAvg;
  return clamp(Math.round(50 + trendDelta), 0, 100);
}

/**
 * Factor 7: Baseline freshness (weight: 5).
 * Fresh baseline → higher sub-score.
 *
 * @param baseline - Baseline profile.
 * @param now - Current timestamp (Unix ms).
 * @returns Sub-score 0-100.
 */
function calcBaselineFreshness(baseline: BaselineProfile, now: number): number {
  if (baseline.totalScanCount === 0) {
    return 20; // Very low confidence without baseline
  }

  // Check freshness of most recent update across all buckets
  const allUpdates = [
    baseline.hr.morning.lastUpdatedAt,
    baseline.hr.midday.lastUpdatedAt,
    baseline.hr.evening.lastUpdatedAt,
    baseline.hrv.morning.lastUpdatedAt,
    baseline.hrv.midday.lastUpdatedAt,
    baseline.hrv.evening.lastUpdatedAt,
  ].filter(t => t > 0);

  if (allUpdates.length === 0) return 20;

  const mostRecent = Math.max(...allUpdates);
  const hoursAgo = (now - mostRecent) / (1000 * 60 * 60);

  if (hoursAgo <= 24) return 100;
  if (hoursAgo <= 48) return 80;
  if (hoursAgo <= 72) return 60;
  if (hoursAgo <= 168) return 40; // 1 week
  return 20;
}

/**
 * Factor 8: Signal quality (weight: 5).
 * Directly maps SQI score to sub-score.
 *
 * @param quality - Signal quality assessment.
 * @returns Sub-score 0-100.
 */
function calcSignalQuality(quality: SignalQuality): number {
  return clamp(quality.score, 0, 100);
}

// ─────────────────────────────────────────────
// Confidence Calculation
// ─────────────────────────────────────────────

/**
 * Calculates the confidence band from an overall confidence score.
 *
 * @param confidence - Overall confidence 0-1.
 * @returns Confidence band classification.
 */
function classifyConfidence(confidence: number): ConfidenceBand {
  if (confidence >= CONFIDENCE_BANDS.HIGH.min) return 'high';
  if (confidence >= CONFIDENCE_BANDS.MODERATE.min) return 'moderate';
  return 'low';
}

/**
 * Calculates multi-dimensional confidence breakdown.
 *
 * @param baseline - User's baseline profile.
 * @param quality - Signal quality.
 * @param sleep - Sleep recovery input.
 * @param recentCount - Count of recent scores.
 * @param now - Current timestamp.
 * @returns Confidence breakdown.
 */
function calcConfidence(
  baseline: BaselineProfile,
  quality: SignalQuality,
  sleep: SleepRecoveryInput,
  recentCount: number,
  now: number
): ConfidenceBreakdown {
  // Baseline maturity
  const maturityMap: Record<string, number> = {
    new: 0.2, building: 0.5, ready: 0.75, mature: 1.0,
  };
  const baselineMaturity = maturityMap[baseline.maturity] ?? 0.2;

  // Input completeness
  let inputs = 0;
  let totalInputs = 3; // HR, HRV, RR are always expected
  inputs += 3; // These are always present in a BiometricReading
  if (sleep.source !== 'none') { inputs += 1; totalInputs += 1; }
  const inputCompleteness = inputs / totalInputs;

  // Signal quality
  const sqiConfidence = quality.score / 100;

  // Recency
  const recency = Math.min(1.0, recentCount / 5);

  // Cross-source (simplified: higher SQI coverage × stability)
  const crossSourceAgreement = quality.coverage * quality.stability;

  // Overall confidence (weighted average)
  const overall = clamp(
    baselineMaturity * 0.30 +
    inputCompleteness * 0.20 +
    sqiConfidence * 0.25 +
    recency * 0.15 +
    crossSourceAgreement * 0.10,
    0, 1
  );

  return {
    overall: Math.round(overall * 100) / 100,
    band: classifyConfidence(overall),
    factors: {
      baselineMaturity,
      inputCompleteness,
      signalQuality: sqiConfidence,
      recency,
      crossSourceAgreement,
    },
  };
}

// ─────────────────────────────────────────────
// Zone Classification
// ─────────────────────────────────────────────

/**
 * Classifies an Edge Score into a readiness zone.
 *
 * @param score - Edge Score 0-100.
 * @returns EdgeZone classification.
 */
export function classifyEdgeZone(score: number): EdgeZone {
  if (score >= 70) return 'clear';
  if (score >= 40) return 'neutral';
  return 'strain';
}

// ─────────────────────────────────────────────
// Main Engine
// ─────────────────────────────────────────────

/**
 * Calculates the Decision Edge Score — the core metric of TENKI CORE.
 *
 * @param input - All inputs required for Edge Score calculation.
 * @returns Complete EdgeScoreResult with score, zone, confidence, drivers, and safe copy.
 */
export function calculateEdgeScore(input: EdgeScoreInput): EdgeScoreResult {
  const now = input.reading.timestamp;
  const timeBucket = getTimeBucket(now);

  // Calculate 8 sub-scores
  const subScores: Record<ScoreDriverKey, number> = {
    hrv_vs_baseline: calcHrvVsBaseline(input.reading.hrvRmssdMs, input.baseline.hrv[timeBucket]),
    hr_stability: calcHrStability(input.reading.hrBpm, input.baseline.hr[timeBucket]),
    respiration_stability: calcRespirationStability(input.reading.rrBrpm, input.baseline.rr[timeBucket]),
    stress_proxy_vs_baseline: calcStressProxy(input.reading, input.baseline, timeBucket),
    sleep_recovery: calcSleepRecovery(input.sleepRecovery),
    recent_trend: calcRecentTrend(input.recentScores),
    baseline_freshness: calcBaselineFreshness(input.baseline, now),
    signal_quality: calcSignalQuality(input.signalQuality),
  };

  // Build drivers
  const weightMap: Record<ScoreDriverKey, number> = {
    hrv_vs_baseline: EDGE_WEIGHTS.hrvVsBaseline,
    hr_stability: EDGE_WEIGHTS.hrStability,
    respiration_stability: EDGE_WEIGHTS.respirationStability,
    stress_proxy_vs_baseline: EDGE_WEIGHTS.stressProxyVsBaseline,
    sleep_recovery: EDGE_WEIGHTS.sleepRecovery,
    recent_trend: EDGE_WEIGHTS.recentTrend,
    baseline_freshness: EDGE_WEIGHTS.baselineFreshness,
    signal_quality: EDGE_WEIGHTS.signalQuality,
  };

  const drivers: ScoreDriver[] = [];
  let weightedSum = 0;

  for (const key of Object.keys(subScores) as ScoreDriverKey[]) {
    const raw = subScores[key];
    const weight = weightMap[key];
    const direction = getDirection(raw);

    drivers.push({
      key,
      direction,
      impact: Math.round(((raw - 50) / 50) * 100) / 100, // Normalize to -1 to 1
      rawSubScore: raw,
    });

    weightedSum += raw * (weight / 100);
  }

  const finalScore = clamp(Math.round(weightedSum), 0, 100);
  const zone = classifyEdgeZone(finalScore);

  // Calculate confidence
  const confidence = calcConfidence(
    input.baseline,
    input.signalQuality,
    input.sleepRecovery,
    input.recentScores.length,
    now
  );

  // Generate safe copy
  const copy = generateSafeCopy(zone, confidence.band);

  return {
    score: finalScore,
    zone,
    confidence,
    drivers,
    copy,
    metadata: {
      baselineVersion: input.baseline.version,
      scanQuality: input.signalQuality.score,
      dataCompleteness: confidence.factors.inputCompleteness,
      sourceMix: [], // Populated by caller
      computedAt: now,
    },
  };
}
