/**
 * @module features/scan/hooks/useProgressiveScan
 * @description React hook for the Level 1-4 progressive scan loop.
 *
 * Wires together:
 *  - progressive-pipeline (runProgressiveScan) for interim Level 1-4 scores
 *  - scan-pipeline (runScanPipeline) for the final gate + baseline update
 *
 * Face-only: the product converged to a single face-scan flow, so the finger
 * calibration source is absent. Wearable HRV / finger-calibration inputs are
 * left at their neutral defaults; the multi-source pipeline simply runs with
 * the face signal alone.
 *
 * Usage:
 *   const { partialResult, finalResult, isScanning, startScan, stopScan } =
 *     useProgressiveScan({ baseline, sleepRecovery, recentScores });
 *
 * The hook fires onLevelAdvance(result) each time precision improves
 * (Level 1 → 2 → 3 → 4) so the UI can trigger the star-dust animation.
 *
 * @version 1.0
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import {
  runProgressiveScan,
  didLevelAdvance,
  type ProgressiveScanInput,
  type PartialScanResult,
} from '@tenki/engine/pipeline/progressive-pipeline';
import {
  runScanPipeline,
  type PipelineDependencies,
  type PipelineResult,
} from '@tenki/engine/pipeline/scan-pipeline';
import type { SourceQuality } from '@tenki/engine/fusion';
import type {
  BiometricReading,
  BaselineProfile,
  SignalQuality,
  SleepRecoveryInput,
} from '@tenki/engine/common/types';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface UseProgressiveScanInput {
  /** User's current baseline profile. */
  baseline: BaselineProfile;
  /** Sleep recovery data for the current period. */
  sleepRecovery: SleepRecoveryInput;
  /** Recent edge scores for trend factor (newest first). */
  recentScores: number[];
  /** Consecutive red gates count for gate evaluation. */
  consecutiveRedGates?: number;
  /** Called each time the scan advances to a new level (1→2, 2→3, 3→4). */
  onLevelAdvance?: (result: PartialScanResult) => void;
  /** Called when the final pipeline result is ready (after gate + baseline update). */
  onScanComplete?: (result: PipelineResult) => void;
}

export interface UseProgressiveScanReturn {
  /** True while a scan is in progress. */
  isScanning: boolean;
  /** Latest partial scan result (updated at each level checkpoint). */
  partialResult: PartialScanResult | null;
  /** Final pipeline result after scan ends (includes gate decision + updated baseline). */
  finalResult: PipelineResult | null;
  /** Start the scan. Provide initial reading + signal quality from camera processor. */
  startScan: (reading: BiometricReading, signalQuality: SignalQuality) => void;
  /** Feed a new frame into the running scan (called from camera frame processor). */
  feedFrame: (reading: BiometricReading, signalQuality: SignalQuality, rrCount: number, availableSources?: SourceQuality[]) => void;
  /** Stop the scan and run the final gate + baseline pipeline. */
  stopScan: () => void;
  /** Reset all state (call after result is consumed). */
  reset: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

export function useProgressiveScan({
  baseline,
  sleepRecovery,
  recentScores,
  consecutiveRedGates = 0,
  onLevelAdvance,
  onScanComplete,
}: UseProgressiveScanInput): UseProgressiveScanReturn {

  const [isScanning, setIsScanning] = useState(false);
  const [partialResult, setPartialResult] = useState<PartialScanResult | null>(null);
  const [finalResult, setFinalResult] = useState<PipelineResult | null>(null);

  // Refs for mutable scan state (avoid stale closure issues in frame callbacks)
  const prevRrCountRef = useRef(0);
  const latestReadingRef = useRef<BiometricReading | null>(null);
  const latestSignalQualityRef = useRef<SignalQuality | null>(null);
  const latestSourcesRef = useRef<SourceQuality[] | undefined>(undefined);
  const isScanningRef = useRef(false);

  // Face-only flow: no finger calibration source. Neutral defaults keep the
  // multi-source pipeline running on the face signal alone.
  const wearableHrvRmssdMs: number | undefined = undefined;
  const fingerCalibrated = false;
  const fingerConfidence = 0;

  const feedFrame = useCallback((
    reading: BiometricReading,
    signalQuality: SignalQuality,
    rrCount: number,
    availableSources?: SourceQuality[]
  ) => {
    if (!isScanningRef.current) return;

    // Always keep latest frame data for the final pipeline call
    latestReadingRef.current = reading;
    latestSignalQualityRef.current = signalQuality;
    latestSourcesRef.current = availableSources;

    const prevRrCount = prevRrCountRef.current;
    const levelChanged = didLevelAdvance(prevRrCount, rrCount);
    prevRrCountRef.current = rrCount;

    // Only recompute on level crossings (T+2s, T+15s, T+30s, T+60s)
    // to avoid wasteful re-runs on every camera frame
    if (!levelChanged && rrCount > 0) return;

    const input: ProgressiveScanInput = {
      reading,
      signalQuality,
      baseline,
      sleepRecovery,
      recentScores,
      rrIntervalCount: rrCount,
      availableSources,
      wearableHrvRmssdMs,
    };

    const result = runProgressiveScan(input);
    setPartialResult(result);

    if (levelChanged) {
      onLevelAdvance?.(result);
    }
  }, [baseline, sleepRecovery, recentScores, wearableHrvRmssdMs, onLevelAdvance]);

  const startScan = useCallback((
    reading: BiometricReading,
    signalQuality: SignalQuality
  ) => {
    prevRrCountRef.current = 0;
    latestReadingRef.current = reading;
    latestSignalQualityRef.current = signalQuality;
    isScanningRef.current = true;
    setIsScanning(true);
    setPartialResult(null);
    setFinalResult(null);

    // Immediately emit Level 1 (T+2s signal lock)
    feedFrame(reading, signalQuality, 0);
  }, [feedFrame]);

  const stopScan = useCallback(() => {
    if (!isScanningRef.current) return;
    isScanningRef.current = false;
    setIsScanning(false);

    const reading = latestReadingRef.current;
    const signalQuality = latestSignalQualityRef.current;
    if (!reading || !signalQuality) return;

    // Run the full pipeline for gate evaluation + baseline update
    const deps: PipelineDependencies = {
      currentBaseline: baseline,
      sleepRecovery,
      recentScores,
      consecutiveRedGates,
      fingerCalibrated,
      fingerConfidence,
      availableSources: latestSourcesRef.current,
      wearableHrvRmssdMs,
    };

    const result = runScanPipeline(reading, signalQuality, deps);
    setFinalResult(result);
    onScanComplete?.(result);
  }, [baseline, sleepRecovery, recentScores, consecutiveRedGates,
      fingerCalibrated, fingerConfidence, wearableHrvRmssdMs, onScanComplete]);

  const reset = useCallback(() => {
    prevRrCountRef.current = 0;
    latestReadingRef.current = null;
    latestSignalQualityRef.current = null;
    latestSourcesRef.current = undefined;
    isScanningRef.current = false;
    setIsScanning(false);
    setPartialResult(null);
    setFinalResult(null);
  }, []);

  // Safety: if component unmounts mid-scan, mark as not scanning
  useEffect(() => {
    return () => { isScanningRef.current = false; };
  }, []);

  return { isScanning, partialResult, finalResult, startScan, feedFrame, stopScan, reset };
}
