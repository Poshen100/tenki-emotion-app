/**
 * @module shared/decision-performance-record.test
 * @description Tests for the DPD record: lifecycle resolution, what counts as a
 * label, and the local-only storage guarantee.
 */

import {
  DPD_STORAGE_POLICIES,
  REFLECTION_WINDOW_HOURS,
  countLabels,
  coveredTimeBuckets,
  isLabeledRecord,
  resolveRecordState,
} from '../growth/decision-performance-record';
import type { DecisionPerformanceRecord } from '../growth/decision-performance-record';

const NOW = 1_775_000_000_000;
const HOUR_MS = 60 * 60 * 1000;

/** Builds a complete DPD record with overrides. */
function makeRecord(
  overrides: Partial<DecisionPerformanceRecord> = {}
): DecisionPerformanceRecord {
  return {
    id: 'rec_1',
    storagePolicy: 'local_only',
    state: 'complete',
    capturedAtMs: NOW - HOUR_MS,
    timeBucket: 'morning',
    dayOfWeek: 3,
    biometrics: {
      hrvRmssd: 48,
      meanHr: 62,
      respiratoryRate: 13,
      signalQuality: 0.9,
    },
    stressLevel: 'LOW',
    scoreContext: {
      score: 74,
      zone: 'clear',
      confidenceBand: 'high',
      baselineMaturity: 'mature',
    },
    dopamineState: 'at_baseline',
    clarityRating: 4,
    ...overrides,
  };
}

describe('storage policy', () => {
  it('offers local_only and nothing else', () => {
    expect(DPD_STORAGE_POLICIES).toEqual(['local_only']);
  });

  it('marks records local_only', () => {
    expect(makeRecord().storagePolicy).toBe('local_only');
  });
});

describe('record lifecycle', () => {
  it('is complete once a clarity rating exists', () => {
    const record = makeRecord({ clarityRating: 3 });
    expect(resolveRecordState(record, NOW)).toBe('complete');
  });

  it('stays pending inside the reflection window', () => {
    const record = makeRecord({ clarityRating: null, capturedAtMs: NOW - HOUR_MS });
    expect(resolveRecordState(record, NOW)).toBe('pending');
  });

  it('becomes unlabeled once the reflection window elapses', () => {
    const record = makeRecord({
      clarityRating: null,
      capturedAtMs: NOW - REFLECTION_WINDOW_HOURS * HOUR_MS,
    });
    expect(resolveRecordState(record, NOW)).toBe('unlabeled');
  });

  it('completes a late reflection rather than expiring it', () => {
    const record = makeRecord({
      clarityRating: 5,
      capturedAtMs: NOW - 72 * HOUR_MS,
    });
    expect(resolveRecordState(record, NOW)).toBe('complete');
  });
});

describe('labels', () => {
  it('counts a rated record as a label', () => {
    expect(isLabeledRecord(makeRecord({ clarityRating: 1 }))).toBe(true);
    expect(isLabeledRecord(makeRecord({ clarityRating: 5 }))).toBe(true);
  });

  it('does not count an unrated record', () => {
    expect(isLabeledRecord(makeRecord({ clarityRating: null }))).toBe(false);
  });

  it('rejects ratings outside the 1-5 scale', () => {
    expect(isLabeledRecord(makeRecord({ clarityRating: 0 }))).toBe(false);
    expect(isLabeledRecord(makeRecord({ clarityRating: 6 }))).toBe(false);
  });

  it('counts only labeled records in a mixed set', () => {
    const records = [
      makeRecord({ id: 'a', clarityRating: 4 }),
      makeRecord({ id: 'b', clarityRating: null }),
      makeRecord({ id: 'c', clarityRating: 2 }),
    ];
    expect(countLabels(records)).toBe(2);
  });

  it('counts nothing in an empty set', () => {
    expect(countLabels([])).toBe(0);
  });
});

describe('time bucket coverage', () => {
  it('reports distinct buckets only', () => {
    const records = [
      makeRecord({ id: 'a', timeBucket: 'morning' }),
      makeRecord({ id: 'b', timeBucket: 'morning' }),
      makeRecord({ id: 'c', timeBucket: 'evening' }),
    ];
    expect(new Set(coveredTimeBuckets(records))).toEqual(new Set(['morning', 'evening']));
  });

  it('reports partial coverage for a single-bucket user', () => {
    const records = [makeRecord({ timeBucket: 'morning' })];
    expect(coveredTimeBuckets(records)).toHaveLength(1);
  });

  it('reports nothing for an empty set', () => {
    expect(coveredTimeBuckets([])).toEqual([]);
  });
});
