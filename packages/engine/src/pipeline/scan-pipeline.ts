/**
 * @module pipeline/scan-pipeline
 * @description The unified execution pipeline for TENKI CORE v3 scan evaluations.
 * Orchestrates biometric smoothing, gate evaluation, and edge score calculation.
 *
 * @version 3.0
 */

import type { BiometricReading, BaselineProfile, SignalQuality, SleepRecoveryInput } from '../common/types';
import { calculateEdgeScore, type EdgeScoreInput, } from '../scoring/edge-score';
import { evaluateGate, canProceed } from '../session/gate';
import { updateBaselineProfile } from '../baseline/baseline';

export interface PipelineDependencies {
  /** The current user's baseline. Will be mutated and returned if the scan is accepted. */
  currentBaseline: BaselineProfile;
  /** The user's sleep data for the night. */
  sleepRecovery: SleepRecoveryInput;
  /** Recently recorded edge scores for the trends factor. */
  recentScores: number[];
  /** Consecutive red gates count */
  consecutiveRedGates?: number;
  /** Optional overrides for gate thresholds. */
  configOverrides?: Record<string, unknown>;
}

export interface PipelineResult {
  /** Was the scan accepted by the gate and engine? */
  success: boolean;
  /** The calculated Edge Score (if successful) */
  edgeScoreResult?: ReturnType<typeof calculateEdgeScore>;
  /** The updated Baseline Profile */
  updatedBaseline: BaselineProfile;
  /** Gate evaluation details for feedback */
  gateFeedback: ReturnType<typeof evaluateGate>;
  /** Pipeline error code if failed */
  rejectReason?: 'POOR_SIGNAL' | 'TOO_SHORT' | 'GATE_REJECTED';
}

/**
 * Runs the end-to-end evaluation pipeline for a new scan.
 */
export function runScanPipeline(
  rawReading: BiometricReading,
  signalQuality: SignalQuality,
  deps: PipelineDependencies
): PipelineResult {
  
  // 1. Initial Sanity Checks
  if (signalQuality.score < 20 || !signalQuality.acceptable) {
    return {
      success: false,
      updatedBaseline: deps.currentBaseline,
      gateFeedback: { result: 'force_hold', scoreAtGate: 0, confidenceAtGate: 0, message: 'Poor signal', consecutiveRedGates: 0 },
      rejectReason: 'POOR_SIGNAL',
    };
  }

  // 2. Engine Execution (Edge Score)
  const edgeInput: EdgeScoreInput = {
    reading: rawReading,
    baseline: deps.currentBaseline,
    signalQuality,
    sleepRecovery: deps.sleepRecovery,
    recentScores: deps.recentScores
  };

  const edgeScoreResult = calculateEdgeScore(edgeInput);

  // 3. Pre-Session Gate Evaluation
  const gateResult = evaluateGate(
    edgeScoreResult.score,
    edgeScoreResult.confidence,
    deps.consecutiveRedGates || 0
  );

  if (!canProceed(gateResult.result)) {
    return {
      success: false,
      updatedBaseline: deps.currentBaseline,
      gateFeedback: gateResult,
      rejectReason: 'GATE_REJECTED',
    };
  }

  // 4. Post-Session Baseline Update
  // Only update the baseline if this was a valid, accepted reading.
  const stressDriver = edgeScoreResult.drivers.find(d => d.key === 'stress_proxy_vs_baseline');
  const stressScore = stressDriver ? stressDriver.rawSubScore : 50;
  
  const updatedBaseline = updateBaselineProfile(
    deps.currentBaseline,
    rawReading,
    stressScore
  );

  return {
    success: true,
    edgeScoreResult,
    updatedBaseline,
    gateFeedback: gateResult,
  };
}
