/**
 * @module baseline/bootstrap
 * @description Baseline Bootstrap Engine — converts a single 30-60s calibration scan
 * into an initial HR/HRV/RR baseline profile using Welford's online algorithm.
 *
 * This is the engine behind Step 4 (Calibration Scan) of the onboarding flow.
 * It takes a time series of biometric readings, filters by signal quality,
 * and builds the user's very first BaselineProfile.
 *
 * @version 3.0
 * @see ANTIGRAVITY.md v3.0 Section 5.3 (Baseline Engine)
 */

import {
  BiometricReading,
  BaselineProfile,
  SignalQuality,
  ConfidenceBreakdown,
  ConfidenceBand,
  CONFIDENCE_BANDS,
} from '../common/types';
import {
  createEmptyBaselineProfile,
  updateBaselineProfile,
  assessMaturity,
} from './baseline';
import { calculateStressProxy } from '../biometric/stress-proxy';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

/** A single windowed reading with its signal quality. */
export interface WindowedReading {
  /** The biometric reading for this window. */
  reading: BiometricReading;
  /** Signal quality assessment for this window. */
  signalQuality: SignalQuality;
}

/** Result of the baseline bootstrap process. */
export interface BaselineBootstrapResult {
  /** Whether the bootstrap succeeded (at least 1 accepted sample). */
  success: boolean;
  /** The initial baseline profile (empty if failed). */
  profile: BaselineProfile;
  /** Confidence breakdown of the bootstrap. */
  confidence: ConfidenceBreakdown;
  /** Total scan duration in seconds. */
  scanDurationSec: number;
  /** Number of accepted quality windows. */
  acceptedSamples: number;
  /** Number of rejected quality windows. */
  rejectedSamples: number;
  /** Aggregate signal quality of accepted windows. */
  aggregateSignalQuality: SignalQuality;
  /** Human-readable summary message. */
  summaryMessage: string;
  /** Error code if failed. */
  errorCode: BaselineBootstrapError | null;
}

/** Classifiable bootstrap error codes. */
export type BaselineBootstrapError =
  | 'NO_READINGS'
  | 'ALL_REJECTED'
  | 'INSUFFICIENT_DURATION'
  | 'INSUFFICIENT_QUALITY';

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

/** Minimum SQI score to accept a windowed reading. */
export const BOOTSTRAP_MIN_SQI = 40;

/** Minimum number of accepted samples to produce a baseline. */
export const BOOTSTRAP_MIN_ACCEPTED = 3;

/** Minimum scan duration in seconds. */
export const BOOTSTRAP_MIN_DURATION_SEC = 15;

/** Maximum scan duration in seconds. */
export const BOOTSTRAP_MAX_DURATION_SEC = 90;

/** Minimum acceptance ratio for decent confidence. */
export const BOOTSTRAP_MIN_ACCEPTANCE_RATIO = 0.3;

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

/**
 * Computes the aggregate signal quality across accepted windows.
 *
 * @param windows - Array of accepted windowed readings.
 * @returns Aggregated SignalQuality.
 */
function aggregateQuality(windows: WindowedReading[]): SignalQuality {
  if (windows.length === 0) {
    return { score: 0, grade: 'F', coverage: 0, stability: 0, acceptable: false };
  }

  const avgScore = windows.reduce((s, w) => s + w.signalQuality.score, 0) / windows.length;
  const avgCoverage = windows.reduce((s, w) => s + w.signalQuality.coverage, 0) / windows.length;
  const avgStability = windows.reduce((s, w) => s + w.signalQuality.stability, 0) / windows.length;

  const roundedScore = Math.round(avgScore);
  let grade: SignalQuality['grade'];
  if (roundedScore >= 85) grade = 'A';
  else if (roundedScore >= 70) grade = 'B';
  else if (roundedScore >= 55) grade = 'C';
  else if (roundedScore >= 40) grade = 'D';
  else grade = 'F';

  return {
    score: roundedScore,
    grade,
    coverage: Math.round(avgCoverage * 100) / 100,
    stability: Math.round(avgStability * 100) / 100,
    acceptable: roundedScore >= BOOTSTRAP_MIN_SQI,
  };
}

/**
 * Resolves the confidence band from a confidence score.
 *
 * @param score - Confidence score (0-1).
 * @returns The ConfidenceBand classification.
 */
function resolveConfidenceBand(score: number): ConfidenceBand {
  if (score >= CONFIDENCE_BANDS.HIGH.min) return 'high';
  if (score >= CONFIDENCE_BANDS.MODERATE.min) return 'moderate';
  return 'low';
}

/**
 * Computes the confidence breakdown for a bootstrap result.
 *
 * @param acceptedCount - Number of accepted samples.
 * @param totalCount - Total number of readings.
 * @param aggQuality - Aggregate signal quality.
 * @param scanDurationSec - Scan duration in seconds.
 * @returns ConfidenceBreakdown.
 */
function computeBootstrapConfidence(
  acceptedCount: number,
  totalCount: number,
  aggQuality: SignalQuality,
  scanDurationSec: number
): ConfidenceBreakdown {
  // Baseline maturity — first scan is always low
  const baselineMaturity = Math.min(1.0, acceptedCount / 15) * 0.5;

  // Input completeness — ratio of accepted vs total
  const acceptanceRatio = totalCount > 0 ? acceptedCount / totalCount : 0;
  const inputCompleteness = Math.min(1.0, acceptanceRatio * 1.2);

  // Signal quality factor
  const signalQuality = Math.min(1.0, aggQuality.score / 100);

  // Recency — always fresh for a bootstrap
  const recency = 1.0;

  // Cross-source agreement — single source for bootstrap
  const crossSourceAgreement = 0.5;

  // Duration factor
  const durationFactor = Math.min(1.0, scanDurationSec / 60);

  const overall = Math.round(
    (baselineMaturity * 0.15 +
     inputCompleteness * 0.25 +
     signalQuality * 0.25 +
     recency * 0.10 +
     crossSourceAgreement * 0.10 +
     durationFactor * 0.15) * 100
  ) / 100;

  return {
    overall,
    band: resolveConfidenceBand(overall),
    factors: {
      baselineMaturity: Math.round(baselineMaturity * 100) / 100,
      inputCompleteness: Math.round(inputCompleteness * 100) / 100,
      signalQuality: Math.round(signalQuality * 100) / 100,
      recency,
      crossSourceAgreement,
    },
  };
}

/**
 * Generates a human-readable summary message based on bootstrap result.
 *
 * @param success - Whether bootstrap succeeded.
 * @param acceptedCount - Number of accepted samples.
 * @param confidence - Confidence breakdown.
 * @param errorCode - Error code if failed.
 * @returns Human-readable message (UX Standard: "講人話").
 */
function generateSummaryMessage(
  success: boolean,
  acceptedCount: number,
  confidence: ConfidenceBreakdown,
  errorCode: BaselineBootstrapError | null
): string {
  if (!success) {
    switch (errorCode) {
      case 'NO_READINGS':
        return '沒有收到任何數據，請確認手指位置後重試';
      case 'ALL_REJECTED':
        return '信號品質不足，請調整光線和手指位置後重試';
      case 'INSUFFICIENT_DURATION':
        return '掃描時間太短，請保持至少 15 秒';
      case 'INSUFFICIENT_QUALITY':
        return '有效數據不足，建議改善光線環境後重試';
      default:
        return '基線建立未完成，請重試';
    }
  }

  if (confidence.band === 'high') {
    return '基線已建立，數據品質優秀。每次掃描都會讓 TENKI 更了解你的正常狀態';
  }
  if (confidence.band === 'moderate') {
    return '基線已建立。持續掃描會讓你的個人基線越來越準確';
  }
  return '基線已初步建立，目前數據較少。多掃幾次，TENKI 會更懂你';
}

// ─────────────────────────────────────────────
// Core
// ─────────────────────────────────────────────

/**
 * Runs the baseline bootstrap process.
 *
 * Takes a series of windowed biometric readings from a 30-60s calibration scan,
 * filters by signal quality, and builds the user's initial BaselineProfile
 * using Welford's online algorithm.
 *
 * This is NOT a score — it is establishing the user's "normal state reference".
 *
 * @param windows - Array of windowed readings with signal quality from the scan.
 * @returns BaselineBootstrapResult with the initial profile and confidence metrics.
 */
export function bootstrapBaseline(windows: WindowedReading[]): BaselineBootstrapResult {
  // Guard: no readings
  if (!windows || windows.length === 0) {
    return makeFailure('NO_READINGS', 0, 0, 0);
  }

  // Compute scan duration
  const timestamps = windows.map(w => w.reading.timestamp);
  const minTs = Math.min(...timestamps);
  const maxTs = Math.max(...timestamps);
  const scanDurationSec = Math.round((maxTs - minTs) / 1000);

  // Guard: too short
  if (scanDurationSec < BOOTSTRAP_MIN_DURATION_SEC && windows.length > 1) {
    return makeFailure('INSUFFICIENT_DURATION', scanDurationSec, windows.length, 0);
  }

  // Filter by SQI
  const accepted: WindowedReading[] = [];
  const rejected: WindowedReading[] = [];

  for (const w of windows) {
    if (w.signalQuality.score >= BOOTSTRAP_MIN_SQI && w.signalQuality.acceptable) {
      accepted.push(w);
    } else {
      rejected.push(w);
    }
  }

  // Guard: all rejected
  if (accepted.length === 0) {
    return makeFailure('ALL_REJECTED', scanDurationSec, windows.length, 0);
  }

  // Guard: insufficient quality
  if (accepted.length < BOOTSTRAP_MIN_ACCEPTED) {
    return makeFailure('INSUFFICIENT_QUALITY', scanDurationSec, windows.length, accepted.length);
  }

  // Build the baseline profile by feeding each accepted reading sequentially
  let profile = createEmptyBaselineProfile();

  for (const w of accepted) {
    // Compute stress proxy for this reading using current baseline
    const bucket = resolveBucket(w.reading.timestamp);
    const stressResult = calculateStressProxy(
      w.reading,
      profile.hr[bucket],
      profile.hrv[bucket]
    );

    profile = updateBaselineProfile(profile, w.reading, stressResult.score);
  }

  // Compute aggregate quality
  const aggQuality = aggregateQuality(accepted);

  // Compute confidence
  const confidence = computeBootstrapConfidence(
    accepted.length,
    windows.length,
    aggQuality,
    scanDurationSec
  );

  // Generate summary message
  const summaryMessage = generateSummaryMessage(true, accepted.length, confidence, null);

  return {
    success: true,
    profile,
    confidence,
    scanDurationSec,
    acceptedSamples: accepted.length,
    rejectedSamples: rejected.length,
    aggregateSignalQuality: aggQuality,
    summaryMessage,
    errorCode: null,
  };
}

// ─────────────────────────────────────────────
// Internal Helpers
// ─────────────────────────────────────────────

/**
 * Creates a failure result with the given error code.
 *
 * @param errorCode - Classifiable error code.
 * @param scanDurationSec - Duration of the scan.
 * @param totalReadings - Total readings received.
 * @param acceptedReadings - Accepted readings count.
 * @returns BaselineBootstrapResult indicating failure.
 */
function makeFailure(
  errorCode: BaselineBootstrapError,
  scanDurationSec: number,
  totalReadings: number,
  acceptedReadings: number
): BaselineBootstrapResult {
  const emptyQuality: SignalQuality = {
    score: 0, grade: 'F', coverage: 0, stability: 0, acceptable: false,
  };
  const emptyConfidence: ConfidenceBreakdown = {
    overall: 0,
    band: 'low',
    factors: {
      baselineMaturity: 0,
      inputCompleteness: 0,
      signalQuality: 0,
      recency: 0,
      crossSourceAgreement: 0,
    },
  };

  return {
    success: false,
    profile: createEmptyBaselineProfile(),
    confidence: emptyConfidence,
    scanDurationSec,
    acceptedSamples: acceptedReadings,
    rejectedSamples: totalReadings - acceptedReadings,
    aggregateSignalQuality: emptyQuality,
    summaryMessage: generateSummaryMessage(false, acceptedReadings, emptyConfidence, errorCode),
    errorCode,
  };
}

/**
 * Resolves time bucket from timestamp (duplicated to avoid circular dependency).
 *
 * @param timestamp - Unix ms.
 * @returns Time bucket.
 */
function resolveBucket(timestamp: number): 'morning' | 'midday' | 'evening' {
  const hour = new Date(timestamp).getHours();
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 18) return 'midday';
  return 'evening';
}
