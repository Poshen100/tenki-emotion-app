import { shouldFireHaptic } from '../hooks/useBaselineHaptics';
import { RETRY_COPY_KEY } from '../utils/retryReason';
import { PHASE_WEIGHTS } from '../utils/progress';
import { STAGE_ORDER } from '../utils/maturityStage';
import { faceBaselineTokens } from '../tokens/faceBaseline.tokens';
import { FACE_BASELINE_COPY } from '../copy/face-baseline.copy';
import type { RetryReason } from '../types/faceBaseline.types';

describe('haptics gating', () => {
  it('fires only when motion is allowed and an implementation exists', () => {
    expect(shouldFireHaptic(false, true)).toBe(true);
    expect(shouldFireHaptic(true, true)).toBe(false); // reduced motion suppresses
    expect(shouldFireHaptic(false, false)).toBe(false); // no impl
    expect(shouldFireHaptic(true, false)).toBe(false);
  });
});

describe('retry copy keys', () => {
  const ALL_REASONS: RetryReason[] = [
    'lowLight', 'tooClose', 'tooFar', 'movement', 'noFace',
    'multipleFaces', 'glasses', 'lostLock', 'timeout', 'computeError',
  ];

  it('provides a non-empty copy key for every retry reason', () => {
    for (const reason of ALL_REASONS) {
      expect(RETRY_COPY_KEY[reason]).toBeTruthy();
      expect(RETRY_COPY_KEY[reason].startsWith('recovery.')).toBe(true);
    }
    expect(Object.keys(RETRY_COPY_KEY).sort()).toEqual([...ALL_REASONS].sort());
  });
});

describe('token & copy invariants', () => {
  it('capture phase weights sum to 1', () => {
    expect(PHASE_WEIGHTS.neutral + PHASE_WEIGHTS.motion).toBeCloseTo(1);
  });

  it('every maturity stage has a progress color', () => {
    for (const stage of STAGE_ORDER) {
      expect(faceBaselineTokens.progress.stageColors[stage]).toMatch(/^#/);
    }
  });

  it('all motion durations are positive', () => {
    for (const value of Object.values(faceBaselineTokens.motion.duration)) {
      expect(value).toBeGreaterThan(0);
    }
  });

  it('maturity counter copy formats as "{n}/{total} scans completed"', () => {
    expect(FACE_BASELINE_COPY.maturity.counter(3, 5)).toBe('3/5 scans completed');
  });

  it('why-baseline carousel has exactly three pages (one idea each)', () => {
    expect(FACE_BASELINE_COPY.why.pages).toHaveLength(3);
  });
});
