/**
 * @module biometric/finger-ppg
 * @description ⚠️ SUPERSEDED by `biometric/ppg/` — see docs/PHONE-PPG.md.
 *
 * Kept only for the callers that predate the v2 pipeline. Nothing new may use
 * `processFingerPpgWindow()`: it peak-picks a raw channel mean with no
 * detrending and no band-pass, which cannot separate a 1-3% pulse from
 * exposure drift, and — the reason it is fenced off rather than merely
 * deprecated — it FABRICATES on empty input. With no detectable beats it
 * substituted a 1000 ms mean interval and returned 60 bpm, and substituted 15
 * for the respiratory rate. Both are plausible resting values, indistinguishable
 * downstream from a real measurement.
 *
 * The two fabrications are removed below rather than left in place: they are
 * reachable from the existing export, and a caller that hits them gets a number
 * that never came from a fingertip.
 *
 * @version 1.1 — fabricated fallbacks removed; superseded by biometric/ppg/.
 */

import type { SignalQuality } from '../common/types';
import { estimateBrpmFromRRIntervals } from './rr';

export interface FingerPpgSample {
  timestamp: number;
  redMean: number;         // Mean value of the red channel ROI
  greenMean: number;       // Mean value of the green channel ROI (ambient reference)
  coverage: number;        // 0-1 coverage of camera lens
  motionDelta: number;     // Frame-to-frame pixel change/delta
}

export interface Peak {
  index: number;
  timeMs: number;
  value: number;
}

export interface FingerPpgResult {
  /** Heart rate, or null when no beats were detected. Never a stand-in value. */
  bpm: number | null;
  /** HRV RMSSD, or null when there were too few intervals to compute one. */
  hrvRmssdMs: number | null;
  /** Respiratory rate, or null when the intervals did not support one. */
  rrBrpm: number | null;
  validBeats: number;
  signalQuality: SignalQuality;
  precisionTier: 'quick' | 'stable' | 'strong' | 'best';
}

/**
 * Detects pulse peaks from the raw Red channel intensity timeseries.
 */
export function detectPeaks(redChannel: number[], sampleRate: number): Peak[] {
  const windowSize = Math.max(3, Math.round(sampleRate * 0.3)); // ~300ms window
  const peaks: Peak[] = [];
  
  // Compute local moving average to handle baseline drift
  const maWindow = Math.round(sampleRate * 1.5); // 1.5 second window
  const movingAverages = redChannel.map((_, idx) => {
    const start = Math.max(0, idx - maWindow);
    const end = Math.min(redChannel.length, idx + maWindow);
    const slice = redChannel.slice(start, end);
    return slice.reduce((a, b) => a + b, 0) / slice.length;
  });

  for (let i = windowSize; i < redChannel.length - windowSize; i++) {
    const val = redChannel[i];
    
    // Must be greater than moving average threshold
    if (val <= movingAverages[i]) continue;
    
    // Must be local maximum in window
    let isMax = true;
    for (let j = -windowSize; j <= windowSize; j++) {
      if (j === 0) continue;
      if (redChannel[i + j] > val) {
        isMax = false;
        break;
      }
    }
    
    if (isMax) {
      // Avoid duplicate/double peaks
      if (peaks.length === 0 || i - peaks[peaks.length - 1].index > windowSize) {
        peaks.push({
          index: i,
          timeMs: (i / sampleRate) * 1000,
          value: val,
        });
      }
    }
  }
  
  return peaks;
}

/**
 * Computes Inter-Beat Intervals (IBI) in milliseconds from peak indices.
 */
export function computeIBI(peaks: Peak[]): number[] {
  const ibis: number[] = [];
  for (let i = 1; i < peaks.length; i++) {
    const ibi = peaks[i].timeMs - peaks[i - 1].timeMs;
    // Filter physiologically impossible heart rate intervals (40 to 180 BPM)
    if (ibi >= 333 && ibi <= 1500) {
      ibis.push(ibi);
    }
  }
  return ibis;
}

/**
 * Calculates HRV RMSSD in milliseconds from IBI intervals.
 * Returns 0 for fewer than two intervals — retained for the legacy callers that
 * depend on that; new code uses `computeRmssd()` in `ppg/beats.ts`, which
 * returns null instead of a value that reads as "no variability".
 */
export function estimateHrvFromIBI(ibis: number[]): number {
  if (ibis.length < 2) return 0;
  let sumSqDiff = 0;
  for (let i = 1; i < ibis.length; i++) {
    sumSqDiff += (ibis[i] - ibis[i - 1]) ** 2;
  }
  const rmssd = Math.sqrt(sumSqDiff / (ibis.length - 1));
  return Math.round(rmssd * 100) / 100;
}

/**
 * Assesses beat interval regularity (1 - Coefficient of Variation).
 * Returns a score between 0 and 1.
 */
export function assessBeatRegularity(ibis: number[]): number {
  if (ibis.length === 0) return 0;
  const mean = ibis.reduce((a, b) => a + b, 0) / ibis.length;
  if (mean === 0) return 0;
  const variance = ibis.reduce((a, b) => a + (b - mean) ** 2, 0) / ibis.length;
  const std = Math.sqrt(variance);
  const cv = std / mean;
  const regularity = Math.max(0, 1 - cv * 3.5);
  return Math.round(regularity * 100) / 100;
}

/**
 * Processes a window of raw PPG samples to calculate biometric metrics.
 */
export function processFingerPpgWindow(
  samples: FingerPpgSample[],
  sampleRate: number = 30
): FingerPpgResult {
  if (!samples || samples.length === 0) {
    throw new Error('PPG window is empty');
  }

  // 1. Peak & Beat Detection
  const redValues = samples.map((s) => s.redMean);
  const peaks = detectPeaks(redValues, sampleRate);
  const ibis = computeIBI(peaks);

  // 2. Metrics calculation
  // Each of these is null rather than a substituted value. The previous version
  // defaulted the mean interval to 1000 ms (reporting 60 bpm from a window with
  // no beats in it) and the respiratory rate to 15.
  const validBeats = peaks.length;
  const bpm =
    ibis.length > 0
      ? Math.round(60000 / (ibis.reduce((a, b) => a + b, 0) / ibis.length))
      : null;
  const hrvRmssdMs = ibis.length >= 2 ? estimateHrvFromIBI(ibis) : null;
  const rrBrpm = estimateBrpmFromRRIntervals(ibis);

  // 3. Quality evaluation
  const avgCoverage = samples.reduce((sum, s) => sum + s.coverage, 0) / samples.length;
  const avgMotion = samples.reduce((sum, s) => sum + s.motionDelta, 0) / samples.length;
  
  // Convert motion delta to stability (0-1) where 0 is high motion, 1 is stable.
  const stability = Math.max(0, Math.min(1, 1 - avgMotion * 4));
  const regularity = assessBeatRegularity(ibis);

  // Estimate signal quality score 0-100
  const score = Math.round(
    (avgCoverage * 0.3 + stability * 0.4 + regularity * 0.3) * 100
  );
  
  let grade: SignalQuality['grade'] = 'F';
  if (score >= 90) grade = 'A';
  else if (score >= 80) grade = 'B';
  else if (score >= 70) grade = 'C';
  else if (score >= 50) grade = 'D';

  const signalQuality: SignalQuality = {
    score,
    grade,
    coverage: avgCoverage,
    stability,
    acceptable: score >= 50,
  };

  // 4. Precision Tier mapping
  let precisionTier: FingerPpgResult['precisionTier'] = 'quick';
  if (validBeats >= 150) precisionTier = 'best';
  else if (validBeats >= 90) precisionTier = 'strong';
  else if (validBeats >= 60) precisionTier = 'stable';

  return {
    bpm,
    hrvRmssdMs,
    rrBrpm,
    validBeats,
    signalQuality,
    precisionTier,
  };
}
