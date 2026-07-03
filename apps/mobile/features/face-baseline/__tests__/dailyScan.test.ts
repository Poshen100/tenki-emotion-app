/**
 * @description Unit tests for the daily Soul Scan pure helpers — refinement
 * detection, mock Edge Score derivation, and result-payload mapping.
 */

import type { QualityMetrics } from '../types/faceBaseline.types';
import {
  DAILY_SCORE_MIN,
  DAILY_SCORE_MAX,
  FALLBACK_SCORE_BASE,
  FALLBACK_SCORE_SPREAD,
  isDailyRefinement,
  deriveDailyEdgeScore,
  buildRefinementEntry,
  toScanMetrics,
  formatHistoryTime,
} from '../utils/dailyScan';

const NOW = 1_780_000_000_000;

describe('isDailyRefinement', () => {
  it('is true only for standalone entry with an established baseline', () => {
    expect(isDailyRefinement('standalone', true)).toBe(true);
  });

  it('is false for a standalone first baseline', () => {
    expect(isDailyRefinement('standalone', false)).toBe(false);
  });

  it('is false for onboarding regardless of baseline state', () => {
    expect(isDailyRefinement('onboarding', true)).toBe(false);
    expect(isDailyRefinement('onboarding', false)).toBe(false);
  });
});

describe('deriveDailyEdgeScore', () => {
  it('maps confidence linearly into the score band', () => {
    expect(deriveDailyEdgeScore(1, NOW)).toBe(DAILY_SCORE_MAX);
    expect(deriveDailyEdgeScore(0.5, NOW)).toBe(
      Math.round(DAILY_SCORE_MIN + (DAILY_SCORE_MAX - DAILY_SCORE_MIN) * 0.5),
    );
  });

  it('clamps confidence above 1', () => {
    expect(deriveDailyEdgeScore(1.7, NOW)).toBe(DAILY_SCORE_MAX);
  });

  it('is deterministic for the same timestamp when signals are absent', () => {
    expect(deriveDailyEdgeScore(0, NOW)).toBe(deriveDailyEdgeScore(0, NOW));
  });

  it('stays inside the synthetic fallback band when signals are absent', () => {
    for (let day = 0; day < 30; day++) {
      const score = deriveDailyEdgeScore(0, NOW + day * 86_400_000);
      expect(score).toBeGreaterThanOrEqual(FALLBACK_SCORE_BASE - FALLBACK_SCORE_SPREAD);
      expect(score).toBeLessThanOrEqual(FALLBACK_SCORE_BASE + FALLBACK_SCORE_SPREAD);
    }
  });

  it('varies across days when signals are absent', () => {
    const scores = new Set<number>();
    for (let day = 0; day < 7; day++) {
      scores.add(deriveDailyEdgeScore(0, NOW + day * 86_400_000));
    }
    expect(scores.size).toBeGreaterThan(1);
  });
});

describe('formatHistoryTime', () => {
  const base = new Date(2026, 5, 14, 9, 45).getTime(); // local Jun 14 2026, 9:45

  it('formats a same-day timestamp as Today', () => {
    expect(formatHistoryTime(base, base + 3 * 3_600_000)).toBe('Today, 9:45 AM');
  });

  it('formats the previous day as Yesterday', () => {
    expect(formatHistoryTime(base, base + 86_400_000)).toBe('Yesterday, 9:45 AM');
  });

  it('formats older timestamps as a short date', () => {
    expect(formatHistoryTime(base, base + 3 * 86_400_000)).toBe('Jun 14, 9:45 AM');
  });

  it('handles PM and midnight hours', () => {
    const pm = new Date(2026, 5, 14, 22, 5).getTime();
    expect(formatHistoryTime(pm, pm)).toBe('Today, 10:05 PM');
    const midnight = new Date(2026, 5, 14, 0, 30).getTime();
    expect(formatHistoryTime(midnight, midnight)).toBe('Today, 12:30 AM');
  });
});

describe('buildRefinementEntry', () => {
  it('builds a refined-type history entry at the given time', () => {
    expect(buildRefinementEntry(NOW)).toEqual({
      at: NOW,
      label: 'Baseline refined',
      type: 'refined',
    });
  });
});

describe('toScanMetrics', () => {
  const quality: QualityMetrics = {
    sqi: 0.92,
    motion: 0.25,
    coverage: 0.84,
    brightness: 0.7,
    landmarkConfidence: 0,
    headPoseRange: 0,
    lightingUniformity: 0,
    eyeVisibility: 0,
    neutralExpressionConfidence: 0,
    totalBaselineConfidence: 0,
  };

  it('maps 0-1 quality onto 0-100 integer scan metrics', () => {
    expect(toScanMetrics(quality)).toEqual({
      coverage: 84,
      stability: 75,
      signalQuality: 92,
    });
  });

  it('clamps out-of-range inputs', () => {
    expect(toScanMetrics({ ...quality, motion: 1.8, coverage: -0.2, sqi: 1.4 })).toEqual({
      coverage: 0,
      stability: 0,
      signalQuality: 100,
    });
  });
});
