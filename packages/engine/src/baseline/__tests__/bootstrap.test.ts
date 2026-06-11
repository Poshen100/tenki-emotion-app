/**
 * @module baseline/__tests__/bootstrap.test
 * @description Tests for the Baseline Bootstrap Engine.
 */
import {
  bootstrapBaseline,
  BOOTSTRAP_MIN_SQI,
  type WindowedReading,
} from '../bootstrap';

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

// Use a timestamp that reliably falls in the 'morning' bucket (05:00-11:59 local).
// We construct it from local time to avoid timezone-dependent bucket resolution.
const BASE_DATE = new Date(2026, 3, 14, 8, 0, 0); // April 14 2026, 08:00 local
const BASE_TS = BASE_DATE.getTime();

/** Resolve which bucket these tests will land in (mirrors engine logic). */
function expectedBucket(): 'morning' | 'midday' | 'evening' {
  const hour = new Date(BASE_TS).getHours();
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 18) return 'midday';
  return 'evening';
}

function makeWindow(
  index: number,
  overrides: Partial<{ hrBpm: number; hrvRmssdMs: number; rrBrpm: number; sqiScore: number }> = {}
): WindowedReading {
  const sqiScore = overrides.sqiScore ?? 70;
  return {
    reading: {
      hrBpm: overrides.hrBpm ?? 72 + Math.sin(index * 0.3) * 3,
      hrvRmssdMs: overrides.hrvRmssdMs ?? 45 + Math.cos(index * 0.2) * 5,
      rrBrpm: overrides.rrBrpm ?? 16 + Math.sin(index * 0.1) * 1,
      timestamp: BASE_TS + index * 5000, // 5s intervals
    },
    signalQuality: {
      score: sqiScore,
      grade: sqiScore >= 85 ? 'A' : sqiScore >= 70 ? 'B' : sqiScore >= 55 ? 'C' : sqiScore >= 40 ? 'D' : 'F',
      coverage: sqiScore >= 70 ? 0.9 : 0.6,
      stability: sqiScore >= 70 ? 0.85 : 0.5,
      acceptable: sqiScore >= BOOTSTRAP_MIN_SQI,
    },
  };
}

function makeGoodSeries(count: number): WindowedReading[] {
  return Array.from({ length: count }, (_, i) => makeWindow(i));
}

function makeBadSeries(count: number): WindowedReading[] {
  return Array.from({ length: count }, (_, i) => makeWindow(i, { sqiScore: 20 }));
}

// ─────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────

describe('bootstrapBaseline', () => {
  it('succeeds with good signal data and produces a valid baseline', () => {
    const windows = makeGoodSeries(10);
    const result = bootstrapBaseline(windows);

    expect(result.success).toBe(true);
    expect(result.errorCode).toBeNull();
    expect(result.acceptedSamples).toBe(10);
    expect(result.rejectedSamples).toBe(0);
    expect(result.profile.totalScanCount).toBe(10);
    expect(result.profile.maturity).not.toBe('new');
    expect(result.profile.hr[expectedBucket()].sampleCount).toBeGreaterThan(0);
    expect(result.confidence.overall).toBeGreaterThan(0);
    expect(result.summaryMessage).toContain('基線已建立');
  });

  it('returns NO_READINGS error for empty input', () => {
    const result = bootstrapBaseline([]);
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('NO_READINGS');
    expect(result.summaryMessage).toContain('沒有收到任何數據');
  });

  it('returns NO_READINGS error for null-ish input', () => {
    const result = bootstrapBaseline(null as unknown as WindowedReading[]);
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('NO_READINGS');
  });

  it('returns ALL_REJECTED when all readings have poor SQI', () => {
    const windows = makeBadSeries(10);
    const result = bootstrapBaseline(windows);

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('ALL_REJECTED');
    expect(result.summaryMessage).toContain('信號品質不足');
  });

  it('returns INSUFFICIENT_QUALITY when too few readings pass SQI', () => {
    const windows = [
      makeWindow(0, { sqiScore: 70 }), // good
      makeWindow(1, { sqiScore: 70 }), // good (only 2 < MIN_ACCEPTED=3)
      ...makeBadSeries(8).map((w, i) => ({
        ...w,
        reading: { ...w.reading, timestamp: BASE_TS + (i + 2) * 5000 },
      })),
    ];
    const result = bootstrapBaseline(windows);

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('INSUFFICIENT_QUALITY');
    expect(result.summaryMessage).toContain('有效數據不足');
  });

  it('returns INSUFFICIENT_DURATION when scan is too short', () => {
    // Two readings 3 seconds apart (< 15s minimum)
    const windows: WindowedReading[] = [
      makeWindow(0),
      {
        ...makeWindow(1),
        reading: { ...makeWindow(1).reading, timestamp: BASE_TS + 3000 },
      },
    ];
    const result = bootstrapBaseline(windows);

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('INSUFFICIENT_DURATION');
    expect(result.summaryMessage).toContain('掃描時間太短');
  });

  it('handles mixed quality — accepts good, rejects bad', () => {
    const windows: WindowedReading[] = [
      makeWindow(0, { sqiScore: 80 }),  // good
      makeWindow(1, { sqiScore: 25 }),  // bad
      makeWindow(2, { sqiScore: 75 }),  // good
      makeWindow(3, { sqiScore: 15 }),  // bad
      makeWindow(4, { sqiScore: 90 }),  // good
      makeWindow(5, { sqiScore: 10 }),  // bad
      makeWindow(6, { sqiScore: 85 }),  // good
    ];
    const result = bootstrapBaseline(windows);

    expect(result.success).toBe(true);
    expect(result.acceptedSamples).toBe(4);
    expect(result.rejectedSamples).toBe(3);
  });

  it('produces correct baseline statistics from consistent readings', () => {
    // All readings have HR=72, HRV=45, RR=16
    const windows: WindowedReading[] = Array.from({ length: 8 }, (_, i) =>
      makeWindow(i, { hrBpm: 72, hrvRmssdMs: 45, rrBrpm: 16 })
    );
    const result = bootstrapBaseline(windows);

    expect(result.success).toBe(true);
    // Mean should be very close to 72
    expect(result.profile.hr[expectedBucket()].mean).toBeCloseTo(72, 0);
    // Std should be ~0 for identical values
    expect(result.profile.hr[expectedBucket()].std).toBeCloseTo(0, 1);
  });

  it('computes confidence breakdown with correct factors', () => {
    const windows = makeGoodSeries(10);
    const result = bootstrapBaseline(windows);

    expect(result.confidence.band).toBeDefined();
    expect(result.confidence.factors.baselineMaturity).toBeGreaterThanOrEqual(0);
    expect(result.confidence.factors.baselineMaturity).toBeLessThanOrEqual(1);
    expect(result.confidence.factors.inputCompleteness).toBeGreaterThan(0);
    expect(result.confidence.factors.signalQuality).toBeGreaterThan(0);
    expect(result.confidence.factors.recency).toBe(1);
    expect(result.confidence.factors.crossSourceAgreement).toBe(0.5);
  });

  it('aggregate signal quality reflects accepted windows only', () => {
    const windows: WindowedReading[] = [
      makeWindow(0, { sqiScore: 90 }),
      makeWindow(1, { sqiScore: 80 }),
      makeWindow(2, { sqiScore: 10 }), // rejected
      makeWindow(3, { sqiScore: 85 }),
    ];
    const result = bootstrapBaseline(windows);

    expect(result.aggregateSignalQuality.score).toBeGreaterThanOrEqual(80);
    expect(result.aggregateSignalQuality.grade).toMatch(/[AB]/);
  });

  it('single sample is handled gracefully', () => {
    // Single reading — should fail with INSUFFICIENT_QUALITY since we need >= 3
    const windows = [makeWindow(0)];
    // Single window has scanDuration = 0, but we only check duration for length > 1
    const result = bootstrapBaseline(windows);
    expect(result.success).toBe(false);
  });
});
