/**
 * @module pipeline/scan-pipeline
 * @description The unified execution pipeline for TENKI CORE v3 scan evaluations.
 * Orchestrates biometric smoothing, gate evaluation, and edge score calculation.
 *
 * @version 3.1 — fusion bridge (Action 1) + wearable HRV score blend (Action 2)
 */

import type { BiometricReading, BaselineProfile, SignalQuality, SleepRecoveryInput } from '../common/types';
import {
  calculateEdgeScore,
  type EdgeScoreInput,
  type ReadingAvailability,
  resolveAvailability,
} from '../scoring/edge-score';
import { evaluateGate, canProceed } from '../session/gate';
import { updateBaselineProfile } from '../baseline/baseline';
import { selectSource, buildFusionLog, type SourceQuality } from '../fusion';
import {
  HRV_DERIVATION_BY_SOURCE,
  type HrvDerivation,
  type HrvMetric,
  type HrvSource,
} from '../biometric/hrv';
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
   * Which of the reading's physiological fields are real measurements.
   *
   * A phone-only scan routinely establishes a heart rate and withholds the
   * rest; omit this and every field is assumed measured, which is what callers
   * predating the camera pipeline did. Fields holding a non-finite value are
   * treated as unavailable regardless of what is declared here.
   */
  availability?: ReadingAvailability;
  /**
   * HRV from a connected wearable, WITH the provenance needed to decide whether
   * it may be used at all.
   *
   * Replaces the bare `wearableHrvRmssdMs` number this took before. A bare
   * number could not answer the three questions that decide the outcome:
   * which HRV statistic it is (an SDNN value silently entering the RMSSD field
   * is the exact failure `docs/WEARABLE-INTEGRATION.md` §3 exists to prevent),
   * when it was measured, and what kind of measurement it was.
   */
  wearableHrv?: WearableHrvContext;
  /** Current time, injected for the freshness check. Defaults to `Date.now()`. */
  now?: number;
}

/** An HRV value from a wearable, with everything needed to arbitrate it. */
export interface WearableHrvContext {
  /** Which HRV statistic this value actually is. Never assumed. */
  metric: HrvMetric;
  /** The value in milliseconds. */
  valueMs: number;
  /** When it was measured — not when it was read (Unix ms). */
  observedAt: number;
  /** Which platform produced it. */
  source: HrvSource;
}

/**
 * How recent a wearable HRV value must be to describe the user right now.
 *
 * Mirrors `METRIC_FRESHNESS_MS.hrv_rmssd_ms` in
 * `domain/src/policies/wearable-source-policy.ts`, which is canonical — the
 * engine package does not depend on `domain`. Keep the two in step.
 */
export const WEARABLE_HRV_FRESHNESS_MS = 60 * 60_000;

/** Why a wearable HRV value was not used for this scan. */
export type WearableHrvRejection = 'wrong_metric' | 'stale' | 'implausible';

/** What happened to the wearable HRV value, for the caller and the UI. */
export interface WearableHrvOutcome {
  applied: boolean;
  derivation: HrvDerivation | null;
  rejectedBecause: WearableHrvRejection | null;
}

/**
 * Decides whether a wearable HRV value may stand in for this scan's HRV.
 *
 * Three refusals, each for a failure that is silent otherwise:
 *
 *  - **Wrong metric.** Only RMSSD can enter `BiometricReading.hrvRmssdMs`.
 *    An SDNN value is not a worse RMSSD, it is a different statistic, and no
 *    fixed ratio converts one into the other for a given person. It belongs on
 *    the SDNN baseline track, which this pipeline does not yet read.
 *  - **Stale.** Yesterday morning's watch HRV is not "your HRV". The reading
 *    would look identical and describe a different moment.
 *  - **Implausible.** A non-finite or non-positive value is not a measurement.
 *
 * @param context - The wearable value and its provenance.
 * @param now - Current time (Unix ms).
 * @returns The value to use, or the reason it was refused.
 */
export function evaluateWearableHrv(
  context: WearableHrvContext,
  now: number,
): { valueMs: number; derivation: HrvDerivation } | { rejectedBecause: WearableHrvRejection } {
  if (context.metric !== 'rmssd') {
    return { rejectedBecause: 'wrong_metric' };
  }
  if (!Number.isFinite(context.valueMs) || context.valueMs <= 0) {
    return { rejectedBecause: 'implausible' };
  }
  if (now - context.observedAt > WEARABLE_HRV_FRESHNESS_MS) {
    return { rejectedBecause: 'stale' };
  }

  return { valueMs: context.valueMs, derivation: HRV_DERIVATION_BY_SOURCE[context.source] };
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
  rejectReason?: 'POOR_SIGNAL' | 'TOO_SHORT' | 'GATE_REJECTED' | 'NO_HEART_RATE';
  /**
   * Which drivers the Edge Score left out for want of a measurement. Empty for
   * a complete reading; non-empty is normal for a phone-only scan.
   */
  excludedDrivers?: string[];
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
  /** What happened to the wearable HRV value, including why it was refused. */
  wearableHrv?: WearableHrvOutcome;
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
  // No heart rate means there is no reading to score. HRV and respiration can
  // be excluded and the score renormalized over what remains; the heart rate
  // cannot — every remaining physiological driver reads from it. Scoring it
  // anyway produced NaN, which `classifyEdgeZone` then called `strain`.
  if (!Number.isFinite(rawReading.hrBpm)) {
    return {
      success: false,
      updatedBaseline: deps.currentBaseline,
      gateFeedback: {
        result: 'force_hold',
        scoreAtGate: 0,
        confidenceAtGate: 0,
        message: 'No heart rate established',
        consecutiveRedGates: 0,
      },
      rejectReason: 'NO_HEART_RATE',
      fusionLog,
    };
  }

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
  let wearableHrv: WearableHrvOutcome | undefined;

  const fingerConf = deps.fingerConfidence ?? 0;

  if (deps.wearableHrv !== undefined) {
    const verdict = evaluateWearableHrv(deps.wearableHrv, deps.now ?? Date.now());

    if ('valueMs' in verdict) {
      // A watch or strap measures beats directly; the camera infers them from
      // a light curve. When both are present the directly-measured value wins
      // — and, just as importantly, it FILLS a gap the camera left, which the
      // previous rule could not do: it required the finger scan to have already
      // succeeded at high confidence, so the wearable only ever helped when it
      // was least needed.
      effectiveReading = { ...rawReading, hrvRmssdMs: verdict.valueMs };
      wearableHrvApplied = true;
      wearableHrv = { applied: true, derivation: verdict.derivation, rejectedBecause: null };
    } else {
      wearableHrv = {
        applied: false,
        derivation: null,
        rejectedBecause: verdict.rejectedBecause,
      };
    }
  }

  // Narrowed against the reading actually being scored, so a wearable value
  // that filled a gap above counts as available and a placeholder does not.
  const availability = resolveAvailability(effectiveReading, deps.availability);

  // 🔴 Where each input came from, so the Edge Score knows what it may claim.
  // This scan is a camera scan: its pulse and any respiratory rate are
  // phone-derived and capped (`PHONE_EVIDENCE_CAPS`). HRV is the exception —
  // it only ever reaches here from a beat sensor, because the camera is not
  // allowed to populate that field at all.
  const edgeInput: EdgeScoreInput = {
    reading: effectiveReading,
    baseline: deps.currentBaseline,
    signalQuality,
    sleepRecovery: deps.sleepRecovery,
    recentScores: deps.recentScores,
    availability,
    evidence: {
      pulse: 'phone_camera',
      breath: availability.respiration ? 'phone_camera' : 'none',
      hrv: wearableHrvApplied ? 'rr_sensor' : availability.hrv ? 'rr_sensor' : 'none',
      sleep: deps.sleepRecovery.source === 'none' ? 'none' : 'wearable',
    },
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

  // Availability is resolved against rawReading, not effectiveReading: the
  // baseline tracks what the CAMERA measured, so a wearable value that filled
  // a gap for scoring must not also fill it for the baseline.
  const updatedBaseline = updateBaselineProfile(
    deps.currentBaseline,
    rawReading,
    stressScore,
    0,
    null,
    resolveAvailability(rawReading, deps.availability)
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
    wearableHrv,
    excludedDrivers: edgeScoreResult.metadata.excludedDrivers ?? [],
  };
}
