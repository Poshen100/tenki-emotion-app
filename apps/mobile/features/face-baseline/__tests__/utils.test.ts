import { QUALITY_OK, isQualityOk, deriveQualityStatus } from '../utils/qualityThresholds';
import {
  STAGE_THRESHOLDS,
  maturityStage,
  scansRequiredForNextStage,
  stageProgress,
} from '../utils/maturityStage';
import { PHASE_WEIGHTS, clamp01, captureProgress } from '../utils/progress';
import { classifyRetryReason } from '../utils/retryReason';
import { estimateConfidence, confidenceBand } from '../utils/confidence';
import type { QualityMetrics } from '../types/faceBaseline.types';

const PERFECT: QualityMetrics = { sqi: 1, motion: 0, coverage: 1, brightness: 1 };

describe('qualityThresholds', () => {
  it('passes only when every dimension meets its bound', () => {
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
    expect(deriveQualityStatus({ sqi: 1, motion: 0.9, coverage: 0, brightness: 0 })).toBe('movement');
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
  it('weights neutral 0.6 and motion 0.4', () => {
    expect(PHASE_WEIGHTS.neutral + PHASE_WEIGHTS.motion).toBeCloseTo(1);
    expect(captureProgress(1, 0)).toBeCloseTo(0.6);
    expect(captureProgress(0, 1)).toBeCloseTo(0.4);
    expect(captureProgress(1, 1)).toBeCloseTo(1);
  });

  it('clamp01 guards range and NaN', () => {
    expect(clamp01(-1)).toBe(0);
    expect(clamp01(2)).toBe(1);
    expect(clamp01(Number.NaN)).toBe(0);
    expect(captureProgress(5, 5)).toBe(1);
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
});
