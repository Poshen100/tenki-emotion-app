/**
 * @module analytics/__tests__/analytics.test.ts
 * @description Unit tests for the insight generator and replay timeline.
 */

import { generateInsights } from '../insight-generator';
import { generateReplayTimeline } from '../replay';
import type { EdgeScoreResult as Result, ScoreDriver, EdgeZone } from '../../scoring/types';

function makeResult(overrides: {
  score?: number;
  zone?: EdgeZone;
  hrvImpact?: number;
  computedAt?: number;
} = {}): Result {
  const { score = 75, zone = 'clear', hrvImpact = 0, computedAt = 0 } = overrides;
  const drivers: ScoreDriver[] = [
    { key: 'hrv_vs_baseline', direction: 'positive', impact: hrvImpact, rawSubScore: 70 },
  ];
  return {
    score,
    zone,
    confidence: {
      overall: 0.8,
      band: 'high',
      factors: {
        baselineMaturity: 1,
        inputCompleteness: 1,
        signalQuality: 1,
        recency: 1,
        crossSourceAgreement: 1,
      },
    },
    drivers,
    copy: { headline: 'h', body: 'b' },
    metadata: {
      baselineVersion: '3.0',
      scanQuality: 90,
      dataCompleteness: 1,
      sourceMix: ['finger_scan'],
      computedAt,
    },
  };
}

describe('generateInsights', () => {
  it('returns nothing until there are at least three sessions', () => {
    expect(generateInsights([makeResult(), makeResult()])).toEqual([]);
  });

  it('flags a sustained Clear-zone streak', () => {
    const history = [makeResult(), makeResult(), makeResult(), makeResult(), makeResult()];
    const insights = generateInsights(history);
    expect(insights.some(i => i.driverId === 'stability_streak')).toBe(true);
  });

  it('does not flag stability when a recent session left the Clear zone', () => {
    const history = [
      makeResult(),
      makeResult(),
      makeResult(),
      makeResult(),
      makeResult({ zone: 'neutral' }),
    ];
    expect(generateInsights(history).some(i => i.driverId === 'stability_streak')).toBe(false);
  });

  it('flags improving HRV adaptation and ranks insights by relevance', () => {
    // Rising hrv impact on the last step, all clear → both insights present,
    // sorted by descending relevance (stability_streak 80 before hrv_improving 60).
    const history = [
      makeResult({ hrvImpact: 0.1 }),
      makeResult({ hrvImpact: 0.1 }),
      makeResult({ hrvImpact: 0.1 }),
      makeResult({ hrvImpact: 0.1 }),
      makeResult({ hrvImpact: 0.5 }),
    ];
    const insights = generateInsights(history);
    expect(insights.map(i => i.driverId)).toEqual(['stability_streak', 'hrv_improving']);
    expect(insights[0].relevance).toBeGreaterThanOrEqual(insights[1].relevance);
  });
});

describe('generateReplayTimeline', () => {
  it('returns an empty summary for no scores', () => {
    expect(generateReplayTimeline([])).toEqual({ points: [], globalMax: 0, globalMin: 0, average: 0 });
  });

  it('annotates the peak and trough and averages the run', () => {
    const summary = generateReplayTimeline([
      makeResult({ score: 50, computedAt: 1 }),
      makeResult({ score: 90, computedAt: 2 }),
      makeResult({ score: 30, computedAt: 3 }),
    ]);
    expect(summary.globalMax).toBe(90);
    expect(summary.globalMin).toBe(30);
    expect(summary.average).toBe(57); // round((50+90+30)/3)
    expect(summary.points[1].isPeak).toBe(true);
    expect(summary.points[2].isTrough).toBe(true);
    expect(summary.points[0].isPeak).toBe(false);
  });

  it('does not double-mark when max and min are the same index', () => {
    const summary = generateReplayTimeline([makeResult({ score: 60, computedAt: 5 })]);
    expect(summary.points[0].isPeak).toBe(true);
    expect(summary.points[0].isTrough).toBe(false);
  });
});
