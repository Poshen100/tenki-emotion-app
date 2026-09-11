/**
 * @module scoring/edge-score
 * @description Decision Edge Score engine — 8-factor weighted readiness score (0-100).
 * This is the core scoring algorithm for TENKI CORE v3.
 *
 * @version 3.0
 * @see ANTIGRAVITY.md v3.0 Section 1.1
 */

import {
  type BiometricReading,
  type BaselineProfile,
  type SignalQuality,
  type SleepRecoveryInput,
  type TimeBucket,
  type MetricBaseline,
  type ConfidenceBreakdown,
  type ConfidenceBand,
  CONFIDENCE_BANDS,
} from '../common/types';

import {
  EDGE_SCORE_ANCHOR,
  EDGE_WEIGHTS,
  PHONE_EVIDENCE_CAPS,
  PHONE_ONLY_PHYSIOLOGY_CAP,
  type PhysiologyEvidenceSources,
  type EdgeZone,
  type EdgeScoreResult,
  type ScoreDriver,
  type ScoreDriverKey,
  type DriverDirection,
  type StrainSubtype,
} from './types';

import { generateSafeCopy, } from '../compliance/safe-copy';
import { resolveEffectiveStd } from '../baseline/noise-floor';

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
function computeZScore(
  value: number,
  baseline: MetricBaseline,
  noiseFloorMs: number | null = null
): number {
  if (baseline.sampleCount === 0 || baseline.std === 0) {
    return 0;
  }
  // Never divide by less than the instrument can resolve. A baseline spread
  // below the user's own noise floor does not mean they are remarkably
  // steady — it means too few samples have been gathered to have seen them
  // move, and dividing by it turns measurement error into a confident z.
  const std = resolveEffectiveStd(baseline.std, noiseFloorMs);
  return (value - baseline.mean) / std;
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

/**
 * Which of a scan's physiological inputs were actually measured.
 *
 * A phone-only scan routinely establishes a heart rate and nothing else — the
 * camera pipeline withholds HRV and respiration whenever beat timing is not
 * good enough (see `biometric/ppg/`). Without this, the only way to run the
 * engine was to hand it a number for every field, which means inventing two.
 *
 * Omit it entirely and every input is assumed present, which is what every
 * caller predating this did — their scores are unchanged.
 */
export interface ReadingAvailability {
  /** False when `reading.hrvRmssdMs` is a placeholder rather than a measurement. */
  hrv: boolean;
  /** False when `reading.rrBrpm` is a placeholder rather than a measurement. */
  respiration: boolean;
}

/** Everything measured — the assumption when no availability is given. */
export const FULL_AVAILABILITY: ReadingAvailability = { hrv: true, respiration: true };

/**
 * Reconciles what the caller declared with what the reading actually holds.
 *
 * A non-finite value is never a measurement, so a field carrying one is treated
 * as unavailable whatever the caller said. This is the second of two layers,
 * and it exists because the first one is a promise the caller has to remember
 * to keep.
 *
 * 🔴 Measured, not hypothetical. A phone-only reading (heart rate established,
 * HRV withheld, `NaN` in the field per `ppg/to-reading.ts`) passed through
 * `runScanPipeline` without an availability record and produced
 * `score: NaN` — which `classifyEdgeZone` then classified as **`strain`**,
 * because `NaN >= 70` and `NaN >= 40` are both false and the last branch wins.
 * The pipeline reported `success: true` and a confidence of 0.67 alongside it.
 * A user whose beat timing was simply too noisy for HRV would have been told
 * their state was poor, on the strength of a number nobody computed.
 *
 * @param reading - The reading about to be scored.
 * @param declared - What the caller said was measured, if anything.
 * @returns Availability narrowed to fields that actually hold a real value.
 */
export function resolveAvailability(
  reading: BiometricReading,
  declared: ReadingAvailability = FULL_AVAILABILITY,
): ReadingAvailability {
  return {
    hrv: declared.hrv && Number.isFinite(reading.hrvRmssdMs),
    respiration: declared.respiration && Number.isFinite(reading.rrBrpm),
  };
}

/**
 * Fills in the evidence sources a caller did not declare.
 *
 * 🔴 Unknown is treated as **phone-derived**, which is the capped case. The cap
 * exists to stop the system claiming more than it saw, so the default must be
 * the claim it can always support. A caller with a chest strap says so; silence
 * is not a wearable.
 *
 * @param declared - What the caller stated, if anything.
 * @param availability - Which metrics actually hold a value.
 * @returns A complete source map.
 */
export function resolveEvidenceSources(
  declared: Partial<PhysiologyEvidenceSources> | undefined,
  availability: ReadingAvailability,
): PhysiologyEvidenceSources {
  return {
    pulse: declared?.pulse ?? 'phone_camera',
    breath: availability.respiration ? declared?.breath ?? 'phone_camera' : 'none',
    hrv: availability.hrv ? declared?.hrv ?? 'rr_sensor' : 'none',
    sleep: declared?.sleep ?? 'none',
  };
}

/**
 * The ceiling on this driver's movement, or null when it is not capped.
 *
 * Only phone-derived physiology is capped. Context drivers (trend, freshness,
 * signal quality) describe the measurement rather than the person, and sensor
 * evidence is not phone evidence.
 *
 * @param key - Which driver.
 * @param evidence - Where this reading's inputs came from.
 * @returns Points, or null for uncapped.
 */
function phoneEvidenceCapFor(
  key: ScoreDriverKey,
  evidence: PhysiologyEvidenceSources,
): number | null {
  if (key === 'hr_stability' && evidence.pulse === 'phone_camera') {
    return PHONE_EVIDENCE_CAPS.pulse;
  }
  if (key === 'respiration_stability' && evidence.breath === 'phone_camera') {
    return PHONE_EVIDENCE_CAPS.breath;
  }
  // HRV can never be phone-derived — the type forbids it — so its drivers are
  // either real sensor evidence at full weight or excluded entirely.
  return null;
}

/** Input data for Edge Score calculation. */
export interface EdgeScoreInput {
  /** Current biometric reading. */
  reading: BiometricReading;
  /**
   * Where each physiological input came from. Anything omitted is treated as
   * phone-derived, which is the capped case — see `resolveEvidenceSources`.
   */
  evidence?: Partial<PhysiologyEvidenceSources>;
  /** User's baseline profile. */
  baseline: BaselineProfile;
  /** Current signal quality assessment. */
  signalQuality: SignalQuality;
  /** Sleep recovery input (may be incomplete). */
  sleepRecovery: SleepRecoveryInput;
  /** Recent Edge Scores for trend analysis (newest first, up to 10). */
  recentScores: number[];
  /**
   * Which physiological inputs were actually measured. Omit when all were.
   * @see ReadingAvailability
   */
  availability?: ReadingAvailability;
  /**
   * The user's measured HRV noise floor in ms, from
   * `baseline/noise-floor.ts`. Omit while there is not yet enough evidence —
   * z-scores then divide by the baseline's own spread, as before.
   */
  hrvNoiseFloorMs?: number | null;
}

/**
 * Factor 1: HRV vs personal baseline (weight: 25).
 * Higher HRV relative to baseline → higher sub-score.
 *
 * @param hrvRmssd - Current HRV RMSSD in ms.
 * @param baseline - HRV baseline for current time bucket.
 * @returns Sub-score 0-100.
 */
function calcHrvVsBaseline(
  hrvRmssd: number,
  baseline: MetricBaseline,
  noiseFloorMs: number | null
): number {
  const z = computeZScore(hrvRmssd, baseline, noiseFloorMs);
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
  timeBucket: TimeBucket,
  noiseFloorMs: number | null
): number {
  // Stress proxy: combination of HR elevation + HRV depression
  const hrZ = computeZScore(reading.hrBpm, baseline.hr[timeBucket]);
  const hrvZ = computeZScore(reading.hrvRmssdMs, baseline.hrv[timeBucket], noiseFloorMs);

  // Higher HR + Lower HRV = more stress
  const stressIndicator = hrZ - hrvZ; // positive = more stress
  return zScoreToSubScore(stressIndicator, true); // Invert: less stress = better
}

// ─────────────────────────────────────────────
// v0 Strain Subtype Heuristic (unvalidated)
// ─────────────────────────────────────────────

/** Z-score magnitude below which a signal is treated as inconclusive. */
const STRAIN_SUBTYPE_NOISE_THRESHOLD = 0.5;

/**
 * v0 — unvalidated heuristic. Infers a directional subtype for the `strain`
 * zone by comparing the current reading's HR/HRV z-scores against the
 * user's personalized baseline (same hrZ/hrvZ signal `calcStressProxy`
 * already computes — no hardcoded baseline defaults are introduced).
 *
 * Resolves the open question in docs/brand.md § 7 (Naming Migration):
 * whether `strain` means overstimulation or depletion depends on which
 * direction HR/HRV moved, not just the Edge Score magnitude.
 *
 * Not validated against real user outcomes yet — treat as exploratory.
 * Intended to be called only when the caller has already classified the
 * zone as `strain`; calling it for other zones is harmless but meaningless.
 *
 * @param reading - Current biometric reading.
 * @param baseline - User's baseline profile.
 * @param timeBucket - Current time bucket.
 * @returns The inferred StrainSubtype, or `unknown` when signals are too
 *   weak or contradictory to call a direction.
 */
export function inferStrainSubtype(
  reading: BiometricReading,
  baseline: BaselineProfile,
  timeBucket: TimeBucket
): StrainSubtype {
  const hrZ = computeZScore(reading.hrBpm, baseline.hr[timeBucket]);
  const hrvZ = computeZScore(reading.hrvRmssdMs, baseline.hrv[timeBucket]);

  if (Math.abs(hrZ) < STRAIN_SUBTYPE_NOISE_THRESHOLD && Math.abs(hrvZ) < STRAIN_SUBTYPE_NOISE_THRESHOLD) {
    return 'unknown';
  }

  // Overstimulated: HR elevated above baseline while HRV is not also elevated.
  if (hrZ > 0 && hrvZ <= 0) {
    return 'overstimulated';
  }

  // Depleted: HR at/below baseline while HRV is also depressed (low arousal, low variability).
  if (hrZ <= 0 && hrvZ < 0) {
    return 'depleted';
  }

  return 'unknown';
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
  now: number,
  availability: ReadingAvailability = FULL_AVAILABILITY
): ConfidenceBreakdown {
  // Baseline maturity
  const maturityMap: Record<string, number> = {
    new: 0.2, building: 0.5, ready: 0.75, mature: 1.0,
  };
  const baselineMaturity = maturityMap[baseline.maturity] ?? 0.2;

  // Input completeness. Counted from what was actually measured — the previous
  // version added 3 unconditionally with the comment "always present in a
  // BiometricReading", which was true of the TYPE and not of the scan: a
  // phone-only reading with HRV withheld reported full completeness.
  const expectedInputs = 4; // HR, HRV, respiration, sleep
  let inputs = 1; // Heart rate: a reading exists at all.
  if (availability.hrv) inputs += 1;
  if (availability.respiration) inputs += 1;
  if (sleep.source !== 'none') inputs += 1;
  const inputCompleteness = inputs / expectedInputs;

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
    hrv_vs_baseline: calcHrvVsBaseline(
      input.reading.hrvRmssdMs,
      input.baseline.hrv[timeBucket],
      input.hrvNoiseFloorMs ?? null
    ),
    hr_stability: calcHrStability(input.reading.hrBpm, input.baseline.hr[timeBucket]),
    respiration_stability: calcRespirationStability(input.reading.rrBrpm, input.baseline.rr[timeBucket]),
    stress_proxy_vs_baseline: calcStressProxy(
      input.reading,
      input.baseline,
      timeBucket,
      input.hrvNoiseFloorMs ?? null
    ),
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

  // ── Aggregation ───────────────────────────────────────────────────────────
  //
  // 🔴 Movement from an anchor, NOT a weighted mean over whatever survived.
  //
  // This used to exclude unmeasured drivers and renormalise the remaining
  // weight across the rest. That was chosen to avoid two real fabrications — a
  // neutral 50 asserts the user is average on a dimension nobody measured, and
  // a 0 asserts they are at the floor of it — but it introduced a third one
  // that is worse, because it is invisible: **the weights of whatever WAS
  // measured silently grow.** Measured on this repo's own weights, a phone-only
  // reading excludes HRV (25), the stress proxy (15) and respiration (10), so
  // `hr_stability` goes from 15% of the score to 30% — and to 43% when sleep is
  // missing too. A single favourable resting pulse could carry someone into the
  // Clear zone. founder rule, 2026-09-11: *"沒有可用生理訊號 ≠ 自動加高其他
  // 分項權重 ≠ Edge Score 變高"*.
  //
  // So: every reading starts at the anchor, and each driver moves it by its own
  // weight times how far its sub-score sits from neutral. A driver with no
  // evidence moves it by nothing. That is not the same claim as scoring it 50 —
  // it asserts nothing about the user at all, and it leaves every other
  // driver's weight exactly where it was. With all eight drivers present the
  // result is identical to the old weighted mean, so nothing changes for a
  // fully-instrumented reading; what changes is that a thin reading now reads
  // as "we could not see much", which is what it is.
  const availability = resolveAvailability(input.reading, input.availability);
  const evidence = resolveEvidenceSources(input.evidence, availability);
  const excludedDrivers: ScoreDriverKey[] = [];

  if (!availability.hrv) {
    // The stress proxy is HR z-score minus HRV z-score. Without HRV it is not a
    // weaker stress proxy, it is a different quantity.
    excludedDrivers.push('hrv_vs_baseline', 'stress_proxy_vs_baseline');
  }
  if (!availability.respiration) {
    excludedDrivers.push('respiration_stability');
  }
  // ⚠️ Sleep is deliberately NOT added here. `calcSleepRecovery` already
  // returns the anchor when there is no sleep data, so under the movement form
  // it contributes nothing — and `calcConfidence` already counts its absence
  // in coverage. Listing it as excluded would change what that field means to
  // every existing reader for no gain.

  const drivers: ScoreDriver[] = [];
  for (const key of Object.keys(subScores) as ScoreDriverKey[]) {
    const raw = subScores[key];
    drivers.push({
      key,
      direction: getDirection(raw),
      impact: Math.round(((raw - 50) / 50) * 100) / 100, // Normalize to -1 to 1
      rawSubScore: raw,
    });
  }

  /**
   * How far this driver moves the score, in points.
   *
   * ⚠️ The denominator is 100, not 50. With 100 this is algebraically the old
   * weighted mean (`50 + Σ(sub−50)·w/100 ≡ Σ sub·w/100` when the weights sum to
   * 100), which is exactly the property that lets a fully-instrumented reading
   * score the same as before. With 50 every deviation is doubled — a reading
   * whose weighted mean is 71.7 comes out at 93.4. The first version of this
   * function had the 50, and the existing suites did not catch it because their
   * score assertions are all ranges.
   */
  const movementOf = (key: ScoreDriverKey): number =>
    excludedDrivers.includes(key)
      ? 0
      : ((subScores[key] - EDGE_SCORE_ANCHOR) * weightMap[key]) / 100;

  // Phone-derived physiology is capped per item and in total. Everything else
  // moves the score by its full weight.
  const cappedDrivers: ScoreDriverKey[] = [];
  let phoneMovement = 0;
  let openMovement = 0;

  for (const key of Object.keys(subScores) as ScoreDriverKey[]) {
    const raw = movementOf(key);
    const cap = phoneEvidenceCapFor(key, evidence);

    if (cap === null) {
      openMovement += raw;
      continue;
    }
    const capped = clamp(raw, -cap, cap);
    if (capped !== raw) cappedDrivers.push(key);
    phoneMovement += capped;
  }

  // The total ceiling, after the per-item ones. Both are needed: per-item stops
  // one signal standing in for the whole picture, the total stops several thin
  // signals adding up to a confident one.
  const cappedPhoneMovement = clamp(
    phoneMovement,
    -PHONE_ONLY_PHYSIOLOGY_CAP,
    PHONE_ONLY_PHYSIOLOGY_CAP,
  );

  const finalScore = clamp(
    Math.round(EDGE_SCORE_ANCHOR + openMovement + cappedPhoneMovement),
    0,
    100,
  );
  const zone = classifyEdgeZone(finalScore);

  // Calculate confidence
  const confidence = calcConfidence(
    input.baseline,
    input.signalQuality,
    input.sleepRecovery,
    input.recentScores.length,
    now,
    availability
  );

  // Generate safe copy (v0: strain zone gets a directional subtype context)
  const copy = zone === 'strain'
    ? generateSafeCopy(zone, confidence.band, {
        strainSubtype: inferStrainSubtype(input.reading, input.baseline, timeBucket),
      })
    : generateSafeCopy(zone, confidence.band);

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
      excludedDrivers,
      cappedDrivers,
      phoneEvidenceMovement: Math.round(cappedPhoneMovement * 10) / 10,
      phoneEvidenceCap: PHONE_ONLY_PHYSIOLOGY_CAP,
      sourceMix: [], // Populated by caller
      computedAt: now,
    },
  };
}
