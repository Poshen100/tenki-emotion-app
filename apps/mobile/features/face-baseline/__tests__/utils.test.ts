import {
  QUALITY_OK,
  ARC_POSE_MIN,
  isQualityOk,
  neutralGate,
  arcGate,
  stabilityGate,
  phaseGate,
  deriveQualityStatus,
} from '../utils/qualityThresholds';
import {
  STAGE_THRESHOLDS,
  maturityStage,
  scansRequiredForNextStage,
  stageProgress,
} from '../utils/maturityStage';
import { PHASE_WEIGHTS, clamp01, captureProgress } from '../utils/progress';
import { classifyRetryReason } from '../utils/retryReason';
import { estimateConfidence, totalBaselineConfidence, confidenceBand } from '../utils/confidence';
import type { QualityMetrics } from '../types/faceBaseline.types';

/** Every signal ideal: still face, clean signal, confident landmarks, full pose range. */
const PERFECT: QualityMetrics = {
  sqi: 1,
  motion: 0,
  coverage: 1,
  brightness: 1,
  landmarkConfidence: 1,
  headPoseRange: 1,
  lightingUniformity: 1,
  eyeVisibility: 1,
  neutralExpressionConfidence: 1,
  totalBaselineConfidence: 1,
};

describe('qualityThresholds — generic gate + status', () => {
  it('isQualityOk passes only when every generic dimension meets its bound', () => {
    expect(isQualityOk(PERFECT)).toBe(true);
    expect(isQualityOk({ ...PERFECT, motion: QUALITY_OK.motion + 0.01 })).toBe(false);
    expect(isQualityOk({ ...PERFECT, sqi: QUALITY_OK.sqi - 0.01 })).toBe(false);
  });

  it('derives a single status with movement > lowLight > reframe priority', () => {
    expect(deriveQualityStatus(PERFECT)).toBe('good');
    expect(deriveQualityStatus({ ...PERFECT, motion: 0.9 })).toBe('movement');
    expect(deriveQualityStatus({ ...PERFECT, brightness: 0 })).toBe('lowLight');
    expect(deriveQualityStatus({ ...PERFECT, coverage: 0 })).toBe('reframe');
    // movement wins when several fail at once
    expect(deriveQualityStatus({ ...PERFECT, motion: 0.9, coverage: 0, brightness: 0 })).toBe('movement');
  });

  it('arc phase tolerates the head turn and surfaces a pose-range nudge', () => {
    // 0.5 motion is fine mid-turn (arc ceiling 0.6) — not a movement nudge
    expect(deriveQualityStatus({ ...PERFECT, motion: 0.5 }, 'arc')).toBe('good');
    expect(deriveQualityStatus({ ...PERFECT, headPoseRange: ARC_POSE_MIN - 0.1 }, 'arc')).toBe('poseRange');
    // still phase-aware: a jerky turn past the arc ceiling is movement
    expect(deriveQualityStatus({ ...PERFECT, motion: 0.7 }, 'arc')).toBe('movement');
  });
});

describe('qualityThresholds — per-phase gates', () => {
  it('every phase gate passes on perfect quality (daily and strict)', () => {
    for (const strict of [false, true]) {
      expect(neutralGate(PERFECT, { strict })).toBe(true);
      expect(arcGate(PERFECT, { strict })).toBe(true);
      expect(stabilityGate(PERFECT, { strict })).toBe(true);
    }
  });

  it('neutral gate reads face signals beyond the generic four', () => {
    expect(neutralGate({ ...PERFECT, neutralExpressionConfidence: 0 })).toBe(false);
    expect(neutralGate({ ...PERFECT, eyeVisibility: 0 })).toBe(false);
    expect(neutralGate({ ...PERFECT, landmarkConfidence: 0 })).toBe(false);
  });

  it('arc gate requires head-pose range and confident landmarks', () => {
    expect(arcGate({ ...PERFECT, headPoseRange: 0 })).toBe(false);
    expect(arcGate({ ...PERFECT, landmarkConfidence: 0 })).toBe(false);
  });

  it('stability gate requires a relaxed expression and visible eyes', () => {
    expect(stabilityGate({ ...PERFECT, neutralExpressionConfidence: 0 })).toBe(false);
    expect(stabilityGate({ ...PERFECT, eyeVisibility: 0 })).toBe(false);
  });

  it('strict first-baseline bar rejects borderline-daily quality', () => {
    // neutralExpressionConfidence just over the daily floor (0.6) but under strict (0.68)
    const borderline: QualityMetrics = { ...PERFECT, neutralExpressionConfidence: 0.62 };
    expect(neutralGate(borderline, { strict: false })).toBe(true);
    expect(neutralGate(borderline, { strict: true })).toBe(false);
  });

  it('phaseGate dispatches to the matching phase gate', () => {
    expect(phaseGate('neutral', PERFECT)).toBe(true);
    expect(phaseGate('arc', { ...PERFECT, headPoseRange: 0 })).toBe(false);
    expect(phaseGate('stability', { ...PERFECT, eyeVisibility: 0 })).toBe(false);
  });
});

describe('maturityStage', () => {
  it('maps scan counts to the four stages at the documented thresholds', () => {
    expect(maturityStage(0)).toBe('new');
    expect(maturityStage(STAGE_THRESHOLDS.building)).toBe('building');
    expect(maturityStage(STAGE_THRESHOLDS.ready)).toBe('ready');
    expect(maturityStage(STAGE_THRESHOLDS.mature)).toBe('mature');
    expect(maturityStage(999)).toBe('mature');
  });

  it('reports the next-stage target and clamps progress at mature', () => {
    expect(scansRequiredForNextStage(0)).toBe(STAGE_THRESHOLDS.building);
    expect(scansRequiredForNextStage(2)).toBe(STAGE_THRESHOLDS.ready);
    expect(scansRequiredForNextStage(STAGE_THRESHOLDS.mature)).toBe(STAGE_THRESHOLDS.mature);
    expect(stageProgress(STAGE_THRESHOLDS.mature)).toBe(1);
    expect(stageProgress(STAGE_THRESHOLDS.ready)).toBe(0); // at lower bound of 'ready'
  });
});

describe('progress', () => {
  it('weights the three capture phases and sums to 1', () => {
    expect(PHASE_WEIGHTS.neutral + PHASE_WEIGHTS.arc + PHASE_WEIGHTS.stability).toBeCloseTo(1);
    expect(captureProgress(1, 0, 0)).toBeCloseTo(PHASE_WEIGHTS.neutral);
    expect(captureProgress(0, 1, 0)).toBeCloseTo(PHASE_WEIGHTS.arc);
    expect(captureProgress(0, 0, 1)).toBeCloseTo(PHASE_WEIGHTS.stability);
    expect(captureProgress(1, 1, 1)).toBeCloseTo(1);
  });

  it('clamp01 guards range and NaN', () => {
    expect(clamp01(-1)).toBe(0);
    expect(clamp01(2)).toBe(1);
    expect(clamp01(Number.NaN)).toBe(0);
    expect(captureProgress(5, 5, 5)).toBe(1);
  });
});

describe('classifyRetryReason', () => {
  const base = { quality: PERFECT, faceLock: 'locked' as const, faceCount: 1, timedOut: false, computeError: false };

  it('prioritizes compute error, then multiple faces, then no face', () => {
    expect(classifyRetryReason({ ...base, computeError: true })).toBe('computeError');
    expect(classifyRetryReason({ ...base, faceCount: 2 })).toBe('multipleFaces');
    expect(classifyRetryReason({ ...base, faceCount: 0 })).toBe('noFace');
    expect(classifyRetryReason({ ...base, faceCount: 0, timedOut: true })).toBe('timeout');
  });

  it('falls through to quality-based reasons', () => {
    expect(classifyRetryReason({ ...base, faceLock: 'lost' })).toBe('lostLock');
    expect(classifyRetryReason({ ...base, quality: { ...PERFECT, brightness: 0 } })).toBe('lowLight');
    expect(classifyRetryReason({ ...base, quality: { ...PERFECT, coverage: 0 } })).toBe('tooFar');
    expect(classifyRetryReason({ ...base, quality: { ...PERFECT, motion: 0.9 } })).toBe('movement');
  });
});

describe('confidence', () => {
  it('estimates 1 for perfect quality and bands it as high', () => {
    expect(estimateConfidence(PERFECT)).toBeCloseTo(1);
    expect(confidenceBand(estimateConfidence(PERFECT))).toBe('high');
  });

  it('bands moderate and low ranges', () => {
    expect(confidenceBand(0.6)).toBe('moderate');
    expect(confidenceBand(0.2)).toBe('low');
  });

  it('totalBaselineConfidence is 1 for perfect quality and folds in face signals', () => {
    expect(totalBaselineConfidence(PERFECT)).toBeCloseTo(1);
    // dropping a face-landmark signal lowers total confidence below the generic estimate
    const noLandmarks: QualityMetrics = { ...PERFECT, landmarkConfidence: 0 };
    expect(totalBaselineConfidence(noLandmarks)).toBeLessThan(1);
    expect(totalBaselineConfidence(noLandmarks)).toBeLessThan(estimateConfidence(noLandmarks));
  });
});
