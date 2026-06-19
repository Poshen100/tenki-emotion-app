/**
 * @module pipeline/scan-pipeline
 * @description The unified execution pipeline for TENKI CORE v3 scan evaluations.
 * Orchestrates biometric smoothing, gate evaluation, and edge score calculation.
 *
 * @version 3.1 — fusion bridge (Action 1) + wearable HRV score blend (Action 2)
 */

import type { BiometricReading, BaselineProfile, SignalQuality, SleepRecoveryInput } from '../common/types';
import { calculateEdgeScore, type EdgeScoreInput } from '../scoring/edge-score';
import { evaluateGate, canProceed } from '../session/gate';
import { updateBaselineProfile } from '../baseline/baseline';
import { selectSource, buildFusionLog, type SourceQuality } from '../fusion';
import type { FusionLog } from '../types';

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
  /**
   * ACTION 1 — Available sensor sources with their instantaneous SQI scores.
   * When provided, fusion.selectSource() picks the highest-quality source
   * (ble_chest > watch_healthkit > rppg_glabella > rppg_forehead > rppg_cheek).
   * Falls back to rppg_cheek when omitted — fully backward-compatible.
   */
  availableSources?: SourceQuality[];
  /**
   * ACTION 2 — Wearable HRV reading (RMSSD ms) from Apple Watch / Garmin / chest belt.
   * When fingerCalibrated=true, fingerConfidence>=0.80, and this value is set,
   * it replaces the rPPG HRV estimate before the 8-factor engine runs.
   * Factor 1 (hrv_vs_baseline, weight 25%) will then reflect true sensor accuracy.
   */
  wearableHrvRmssdMs?: number;
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
  /**
   * ACTION 1 — Fusion log recording which sensor source was selected,
   * its SQI, confidence level, and whether the system degraded.
   * Expose in UI as a source badge: "Apple Watch" | "Camera" | "Chest Belt".
   */
  fusionLog: FusionLog;
  /**
   * ACTION 2 — True when the final Edge Score used wearable HRV data
   * instead of rPPG-estimated HRV. Indicates higher accuracy.
   */
  wearableHrvApplied?: boolean;
}

/**
 * Runs the end-to-end evaluation pipeline for a new scan.
 *
 * v3.1 changes:
 *  - Step 0: fusion source selection wired in (Action 1)
 *  - Step 2: wearable HRV score-level override before engine (Action 2)
 *  - fusionLog always present in return value
 */
export function runScanPipeline(
  rawReading: BiometricReading,
  signalQuality: SignalQuality,
  deps: PipelineDependencies
): PipelineResult {

  // ─── Step 0: Fusion Source Selection (Action 1) ───────────────────────────
  // Determine the highest-quality available sensor source. If the caller
  // provides availableSources (from BLE chest, HealthKit, or rPPG regions),
  // selectSource() returns the best passing the SQI threshold. Otherwise we
  // synthesise a log from the existing signalQuality for backward compatibility.
  const fusionLog: FusionLog = deps.availableSources && deps.availableSources.length > 0
    ? selectSource(deps.availableSources)
    : buildFusionLog('rppg_cheek', signalQuality.score);

  // ─── Step 1: Initial Sanity Checks ───────────────────────────────────────
  if (signalQuality.score < 20 || !signalQuality.acceptable) {
    return {
      success: false,
      updatedBaseline: deps.currentBaseline,
      gateFeedback: {
        result: 'force_hold',
        scoreAtGate: 0,
        confidenceAtGate: 0,
        message: 'Poor signal',
        consecutiveRedGates: 0,
      },
      rejectReason: 'POOR_SIGNAL',
      fusionLog,
    };
  }

  // ─── Step 2: Engine Execution (Action 2 — wearable HRV override) ─────────
  // When a high-confidence wearable is connected, replace the rPPG HRV
  // estimate with the accurate wearable reading BEFORE the engine runs.
  // This improves Factor 1 (hrv_vs_baseline, 25% weight) significantly.
  // Note: Step 4 baseline update still uses rawReading to preserve rPPG
  // calibration data and avoid contaminating the baseline with device drift.
  let effectiveReading = rawReading;
  let wearableHrvApplied = false;

  const fingerConf = deps.fingerConfidence ?? 0;
  const hasHighConfidenceWearable =
    deps.fingerCalibrated === true &&
    fingerConf >= 0.80 &&
    deps.wearableHrvRmssdMs !== undefined &&
    deps.wearableHrvRmssdMs > 0;

  if (hasHighConfidenceWearable && deps.wearableHrvRmssdMs !== undefined) {
    effectiveReading = { ...rawReading, hrvRmssdMs: deps.wearableHrvRmssdMs };
    wearableHrvApplied = true;
  }

  const edgeInput: EdgeScoreInput = {
    reading: effectiveReading,
    baseline: deps.currentBaseline,
    signalQuality,
    sleepRecovery: deps.sleepRecovery,
    recentScores: deps.recentScores,
  };

  const edgeScoreResult = calculateEdgeScore(edgeInput);

  // Stamp the selected fusion source into result metadata for analytics
  edgeScoreResult.metadata.sourceMix = [fusionLog.source];

  // ─── Step 3: Pre-Session Gate Evaluation ─────────────────────────────────
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
      fusionLog,
    };
  }

  // ─── Step 4: Post-Session Baseline Update ────────────────────────────────
  // Only update the baseline if this was a valid, accepted reading.
  // Intentionally uses rawReading (not effectiveReading) so the baseline
  // reflects the camera-measured signal, not the wearable override.
  const stressDriver = edgeScoreResult.drivers.find(d => d.key === 'stress_proxy_vs_baseline');
  const stressScore = stressDriver ? stressDriver.rawSubScore : 50;

  const updatedBaseline = updateBaselineProfile(
    deps.currentBaseline,
    rawReading,
    stressScore
  );

  // ─── Step 5: Multi-modal Confidence Blend ────────────────────────────────
  // Action 2 note: confidence blending is now decoupled from score blending.
  // The score was already corrected in Step 2 when wearable HRV is present.
  // This step only adjusts the reported confidence percentage shown in the UI.
  let blendedConfidence: number | undefined;
  let blendMode: PipelineResult['blendMode'];

  if (deps.fingerCalibrated && deps.fingerConfidence !== undefined) {
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
    fusionLog,
    wearableHrvApplied,
  };
}
