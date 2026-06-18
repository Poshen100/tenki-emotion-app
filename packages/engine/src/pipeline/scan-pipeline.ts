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
  /** Has the user calibrated finger PPG? */
  fingerCalibrated?: boolean;
  /** Finger scan quality confidence if calibrated. */
  fingerConfidence?: number;
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
  /** Optional blended confidence when finger scan is calibrated */
  blendedConfidence?: number;
  /** Optional blend mode applied */
  blendMode?: 'high_confidence_blend' | 'signal_added' | 'face_only';
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

  // 5. Multi-modal confidence blend
  let blendedConfidence: number | undefined ;
  let blendMode: PipelineResult['blendMode'] ;

  if (deps.fingerCalibrated && deps.fingerConfidence !== undefined) {
    const fingerConf = deps.fingerConfidence;
    const faceConf = edgeScoreResult.confidence.overall;

    if (fingerConf >= 0.80) {
      blendMode = 'high_confidence_blend';
      blendedConfidence = faceConf * 0.55 + fingerConf * 0.45;
    } else if (fingerConf >= 0.55) {
      blendMode = 'signal_added';
      blendedConfidence = faceConf * 0.70 + fingerConf * 0.30;
    } else {
      blendMode = 'face_only';
      blendedConfidence = faceConf * 0.85 + fingerConf * 0.15;
    }
    blendedConfidence = Math.min(1, Math.max(0, blendedConfidence));
    blendedConfidence = Math.round(blendedConfidence * 100) / 100;
  }

  return {
    success: true,
    edgeScoreResult,
    updatedBaseline,
    gateFeedback: gateResult,
    blendedConfidence,
    blendMode,
  };
}
