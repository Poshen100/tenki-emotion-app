/**
 * @module intelligence/drift.test
 * @description Unit tests for Drift Alert. Two things are being defended here:
 * the engine refuses to report a number it cannot back, and it never reports
 * direction as a verdict.
 */

import {
  assessDrift,
  buildPersonalReference,
  isDriftAssessed,
  selectComparableSamples,
  AT_REFERENCE_POINTS,
  DRIFT_ABSOLUTE_THRESHOLDS,
  DRIFT_EVIDENCE_REQUIREMENT,
  MIN_MEANINGFUL_STD,
  REFERENCE_WINDOW_DAYS,
  type ReadinessSample,
} from '../drift';
import { MS_PER_DAY } from '../evidence';

/** 2026-09-09 10:00 local — inside the `morning` bucket. */
const NOW = new Date(2026, 8, 9, 10, 0, 0).getTime();

/**
 * Builds `count` daily samples in the same time bucket as NOW, cycling through
 * `values` so the reference has a known mean and spread.
 */
function history(count: number, values: number[]): ReadinessSample[] {
  return Array.from({ length: count }, (_, i) => ({
    value: values[i % values.length],
    ts: NOW - (i + 1) * MS_PER_DAY,
  }));
}

// ─── selectComparableSamples ─────────────────

describe('selectComparableSamples', () => {
  it('keeps only samples in the same time bucket', () => {
    const morning = { value: 65, ts: new Date(2026, 8, 8, 9, 0).getTime() };
    const evening = { value: 65, ts: new Date(2026, 8, 8, 21, 0).getTime() };
    const kept = selectComparableSamples([morning, evening], { now: NOW });
    expect(kept).toEqual([morning]);
  });

  it('drops samples older than the recency window', () => {
    const recent = { value: 65, ts: NOW - 5 * MS_PER_DAY };
    const ancient = { value: 65, ts: NOW - (REFERENCE_WINDOW_DAYS + 5) * MS_PER_DAY };
    const kept = selectComparableSamples([recent, ancient], { now: NOW });
    expect(kept).toEqual([recent]);
  });

  it('drops samples from the future', () => {
    const future = { value: 65, ts: NOW + MS_PER_DAY };
    expect(selectComparableSamples([future], { now: NOW })).toEqual([]);
  });

  it('drops samples whose value is not a finite number', () => {
    const broken = { value: Number.NaN, ts: NOW - MS_PER_DAY };
    expect(selectComparableSamples([broken], { now: NOW })).toEqual([]);
  });
});

// ─── buildPersonalReference ──────────────────

describe('buildPersonalReference', () => {
  it('computes mean and spread from comparable samples', () => {
    const ref = buildPersonalReference(history(24, [60, 70]), 'morning');
    expect(ref.mean).toBeCloseTo(65, 5);
    expect(ref.std).toBeCloseTo(5, 5);
    expect(ref.sampleCount).toBe(24);
  });

  it('reports zero spread when every reading is identical', () => {
    const ref = buildPersonalReference(history(24, [65]), 'morning');
    expect(ref.std).toBe(0);
  });

  it('counts distinct days, not sample count', () => {
    const twicePerDay: ReadinessSample[] = [
      { value: 60, ts: new Date(2026, 8, 8, 9, 0).getTime() },
      { value: 70, ts: new Date(2026, 8, 8, 11, 0).getTime() },
    ];
    expect(buildPersonalReference(twicePerDay, 'morning').windowDays).toBe(1);
  });
});

// ─── assessDrift: refusing to speak ──────────

describe('assessDrift (insufficient evidence)', () => {
  it('refuses to report a number below the sample floor', () => {
    const result = assessDrift(75, history(3, [60, 70]), { now: NOW });
    expect(result.state).toBe('insufficient');
    if (result.state !== 'insufficient') throw new Error('expected insufficient');
    expect(result.moreSamplesNeeded).toBe(DRIFT_EVIDENCE_REQUIREMENT.minSamples - 3);
  });

  it('refuses when the history is all in a different time bucket', () => {
    const evenings: ReadinessSample[] = Array.from({ length: 30 }, (_, i) => ({
      value: 65,
      ts: new Date(2026, 8, 8 - i, 21, 0).getTime(),
    }));
    expect(assessDrift(75, evenings, { now: NOW }).state).toBe('insufficient');
  });

  it('refuses when the current reading is not a finite number', () => {
    const result = assessDrift(Number.NaN, history(30, [60, 70]), { now: NOW });
    expect(result.state).toBe('insufficient');
  });

  it('speaks as soon as the sample floor is met', () => {
    const result = assessDrift(75, history(8, [60, 70]), { now: NOW });
    expect(result.state).toBe('assessed');
  });
});

// ─── assessDrift: the claim ──────────────────

describe('assessDrift (assessed)', () => {
  it('reports distance in readiness points against the personal reference', () => {
    const result = assessDrift(82, history(24, [60, 70]), { now: NOW });
    if (!isDriftAssessed(result)) throw new Error('expected an assessment');
    expect(result.reference.mean).toBe(65);
    expect(result.deviation).toBe(17);
    expect(result.distance).toBe(17);
  });

  it('always reports distance as the absolute of deviation', () => {
    const result = assessDrift(48, history(24, [60, 70]), { now: NOW });
    if (!isDriftAssessed(result)) throw new Error('expected an assessment');
    expect(result.deviation).toBeLessThan(0);
    expect(result.distance).toBe(Math.abs(result.deviation));
  });

  it('grades magnitude from the normalized distance', () => {
    const near = assessDrift(66, history(24, [60, 70]), { now: NOW });
    const mid = assessDrift(71, history(24, [60, 70]), { now: NOW });
    const far = assessDrift(75, history(24, [60, 70]), { now: NOW });
    if (!isDriftAssessed(near) || !isDriftAssessed(mid) || !isDriftAssessed(far)) {
      throw new Error('expected assessments');
    }
    expect(near.magnitude).toBe('within');
    expect(mid.magnitude).toBe('drifting');
    expect(far.magnitude).toBe('far');
  });

  it('treats a reading above the reference as drift, not as better', () => {
    const above = assessDrift(75, history(24, [60, 70]), { now: NOW });
    const below = assessDrift(55, history(24, [60, 70]), { now: NOW });
    if (!isDriftAssessed(above) || !isDriftAssessed(below)) {
      throw new Error('expected assessments');
    }
    expect(above.magnitude).toBe('far');
    expect(below.magnitude).toBe('far');
    expect(above.direction).toBe('higher');
    expect(below.direction).toBe('lower');
  });

  it('calls direction `at` while the deviation is within the noise band', () => {
    const result = assessDrift(65 + AT_REFERENCE_POINTS, history(24, [60, 70]), { now: NOW });
    if (!isDriftAssessed(result)) throw new Error('expected an assessment');
    expect(result.direction).toBe('at');
  });

  it('reaches high confidence with a long, day-spread history', () => {
    const result = assessDrift(75, history(28, [60, 70]), { now: NOW });
    if (!isDriftAssessed(result)) throw new Error('expected an assessment');
    expect(result.evidence.confidence).toBe('high');
    expect(result.evidence.sampleCount).toBe(28);
  });

  it('clamps a reading above the readiness axis instead of propagating it', () => {
    const result = assessDrift(150, history(24, [60, 70]), { now: NOW });
    if (!isDriftAssessed(result)) throw new Error('expected an assessment');
    expect(result.deviation).toBe(35);
  });
});

// ─── assessDrift: the flat-reference trap ────

describe('assessDrift (near-flat personal reference)', () => {
  it('does not normalize a distance it cannot normalize', () => {
    const result = assessDrift(75, history(24, [65]), { now: NOW });
    if (!isDriftAssessed(result)) throw new Error('expected an assessment');
    expect(result.z).toBeNull();
    expect(result.reference.std).toBeLessThan(MIN_MEANINGFUL_STD);
  });

  it('grades magnitude by absolute distance and says why in the evidence', () => {
    const drifting = assessDrift(65 + DRIFT_ABSOLUTE_THRESHOLDS.DRIFTING, history(24, [65]), {
      now: NOW,
    });
    const far = assessDrift(65 + DRIFT_ABSOLUTE_THRESHOLDS.FAR, history(24, [65]), { now: NOW });
    if (!isDriftAssessed(drifting) || !isDriftAssessed(far)) {
      throw new Error('expected assessments');
    }
    expect(drifting.magnitude).toBe('drifting');
    expect(far.magnitude).toBe('far');
    expect(far.evidence.reasons).toContain('low_variability_reference');
  });

  it('caps confidence at moderate however many samples a flat reference has', () => {
    const result = assessDrift(75, history(60, [65]), { now: NOW });
    if (!isDriftAssessed(result)) throw new Error('expected an assessment');
    expect(result.evidence.confidence).toBe('moderate');
  });
});
