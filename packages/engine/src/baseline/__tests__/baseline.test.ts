/**
 * @module baseline/baseline.test
 * @description Unit tests for the v3 baseline engine with time buckets.
 */

import {
  updateMetricBaseline,
  createEmptyMetricBaseline,
  createEmptyBaselineProfile,
  resolveTimeBucket,
  assessMaturity,
  updateBaselineProfile,
  MAX_SAMPLE_COUNT,
} from '../baseline';

// ─── updateMetricBaseline ────────────────────

describe('updateMetricBaseline', () => {
  it('should set mean to first value', () => {
    const empty = createEmptyMetricBaseline();
    const result = updateMetricBaseline(empty, 70, Date.now());
    expect(result.mean).toBe(70);
    expect(result.sampleCount).toBe(1);
    expect(result.std).toBe(0);
  });

  it('should compute running mean correctly', () => {
    let bl = createEmptyMetricBaseline();
    bl = updateMetricBaseline(bl, 60, Date.now());
    bl = updateMetricBaseline(bl, 80, Date.now());
    expect(bl.mean).toBe(70);
    expect(bl.sampleCount).toBe(2);
  });

  it('should compute std > 0 for varying inputs', () => {
    let bl = createEmptyMetricBaseline();
    bl = updateMetricBaseline(bl, 60, Date.now());
    bl = updateMetricBaseline(bl, 80, Date.now());
    bl = updateMetricBaseline(bl, 70, Date.now());
    expect(bl.std).toBeGreaterThan(0);
  });

  it('should apply decay at MAX_SAMPLE_COUNT', () => {
    let bl = createEmptyMetricBaseline();
    for (let i = 0; i < MAX_SAMPLE_COUNT + 5; i++) {
      bl = updateMetricBaseline(bl, 65 + Math.random() * 10, Date.now());
    }
    expect(bl.sampleCount).toBeLessThan(MAX_SAMPLE_COUNT + 5);
  });

  it('should update lastUpdatedAt', () => {
    const ts = Date.now();
    const result = updateMetricBaseline(createEmptyMetricBaseline(), 70, ts);
    expect(result.lastUpdatedAt).toBe(ts);
  });
});

// ─── resolveTimeBucket ──────────────────────

describe('resolveTimeBucket', () => {
  it('8am → morning', () => {
    const d = new Date(); d.setHours(8, 0, 0, 0);
    expect(resolveTimeBucket(d.getTime())).toBe('morning');
  });

  it('14pm → midday', () => {
    const d = new Date(); d.setHours(14, 0, 0, 0);
    expect(resolveTimeBucket(d.getTime())).toBe('midday');
  });

  it('22pm → evening', () => {
    const d = new Date(); d.setHours(22, 0, 0, 0);
    expect(resolveTimeBucket(d.getTime())).toBe('evening');
  });

  it('3am → evening', () => {
    const d = new Date(); d.setHours(3, 0, 0, 0);
    expect(resolveTimeBucket(d.getTime())).toBe('evening');
  });
});

// ─── assessMaturity ─────────────────────────

describe('assessMaturity', () => {
  it('0 scans → new', () => {
    expect(assessMaturity(0)).toBe('new');
  });

  it('1 scan → building', () => {
    expect(assessMaturity(1)).toBe('building');
  });

  it('5 scans → ready', () => {
    expect(assessMaturity(5)).toBe('ready');
  });

  it('15 scans + 3 days → mature', () => {
    expect(assessMaturity(15, 3)).toBe('mature');
  });

  it('15 scans + 1 day → ready (not mature: insufficient days)', () => {
    expect(assessMaturity(15, 1)).toBe('ready');
  });
});

// ─── updateBaselineProfile ──────────────────

describe('updateBaselineProfile', () => {
  it('should increment totalScanCount', () => {
    const profile = createEmptyBaselineProfile();
    const reading = { hrBpm: 70, hrvRmssdMs: 45, rrBrpm: 16, timestamp: Date.now() };
    const updated = updateBaselineProfile(profile, reading, 50);
    expect(updated.totalScanCount).toBe(1);
  });

  it('should update the correct time bucket', () => {
    const profile = createEmptyBaselineProfile();
    const morningTs = new Date(); morningTs.setHours(9, 0, 0, 0);
    const reading = { hrBpm: 70, hrvRmssdMs: 45, rrBrpm: 16, timestamp: morningTs.getTime() };
    const updated = updateBaselineProfile(profile, reading, 50);
    expect(updated.hr.morning.sampleCount).toBe(1);
    expect(updated.hr.midday.sampleCount).toBe(0);
  });

  it('should update stress proxy baseline', () => {
    const profile = createEmptyBaselineProfile();
    const reading = { hrBpm: 70, hrvRmssdMs: 45, rrBrpm: 16, timestamp: Date.now() };
    const updated = updateBaselineProfile(profile, reading, 55);
    expect(updated.stressProxy.mean).toBe(55);
  });

  it('should advance maturity', () => {
    let profile = createEmptyBaselineProfile();
    expect(profile.maturity).toBe('new');
    const reading = { hrBpm: 70, hrvRmssdMs: 45, rrBrpm: 16, timestamp: Date.now() };
    profile = updateBaselineProfile(profile, reading, 50);
    expect(profile.maturity).toBe('building');
  });
});

// ─── createEmptyBaselineProfile ─────────────

describe('createEmptyBaselineProfile', () => {
  it('should create profile with all empty baselines', () => {
    const profile = createEmptyBaselineProfile();
    expect(profile.maturity).toBe('new');
    expect(profile.totalScanCount).toBe(0);
    expect(profile.hr.morning.sampleCount).toBe(0);
    expect(profile.hrv.midday.sampleCount).toBe(0);
    expect(profile.rr.evening.sampleCount).toBe(0);
  });
});
