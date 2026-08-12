/**
 * @module shared/edge-snapshot.test
 * @description Tests for the shareable readiness card. A share card is the one
 * surface where copy leaves the device irrevocably, so the compliance and
 * field-leakage assertions here are load-bearing.
 */

import {
  FORBIDDEN_SNAPSHOT_FIELDS,
  SNAPSHOT_HEADLINE,
  buildSnapshotCopy,
  isSnapshotAvailable,
} from '../growth/edge-snapshot';
import type { EdgeSnapshotPayload } from '../growth/edge-snapshot';
import { findProhibitedTerms } from '../../../engine/src/compliance/safe-copy';

/** Builds a valid snapshot payload with overrides. */
function makePayload(overrides: Partial<EdgeSnapshotPayload> = {}): EdgeSnapshotPayload {
  return {
    score: 82,
    zone: 'clear',
    date: '2026-08-12',
    timeBucket: 'morning',
    ...overrides,
  };
}

describe('snapshot copy', () => {
  it('builds the canonical card', () => {
    const result = buildSnapshotCopy(makePayload());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.copy.headline).toBe(SNAPSHOT_HEADLINE);
      expect(result.copy.value).toBe('82');
      expect(result.copy.zoneLabel).toBe('Clear');
      expect(result.copy.context).toBe('2026-08-12 · morning');
    }
  });

  it('emits no prohibited vocabulary for any zone', () => {
    for (const zone of ['clear', 'neutral', 'strain'] as const) {
      const result = buildSnapshotCopy(makePayload({ zone }));
      expect(result.ok).toBe(true);
      if (result.ok) {
        const all = Object.values(result.copy).join(' ');
        expect(findProhibitedTerms(all)).toEqual([]);
      }
    }
  });

  it('shares low scores as readily as high ones', () => {
    const strain = buildSnapshotCopy(makePayload({ score: 12, zone: 'strain' }));
    expect(strain.ok).toBe(true);
    if (strain.ok) expect(strain.copy.value).toBe('12');
  });

  it('rounds the score to an integer', () => {
    const result = buildSnapshotCopy(makePayload({ score: 81.6 }));
    if (result.ok) expect(result.copy.value).toBe('82');
  });

  it('rejects a score outside 0-100', () => {
    for (const score of [-1, 101, Number.NaN]) {
      const result = buildSnapshotCopy(makePayload({ score }));
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reasons).toContain('score_out_of_range');
    }
  });

  it('accepts the boundary scores', () => {
    expect(buildSnapshotCopy(makePayload({ score: 0, zone: 'strain' })).ok).toBe(true);
    expect(buildSnapshotCopy(makePayload({ score: 100 })).ok).toBe(true);
  });

  it('carries no time more precise than a bucket', () => {
    const result = buildSnapshotCopy(makePayload());
    if (result.ok) {
      expect(result.copy.context).not.toMatch(/\d{2}:\d{2}/);
    }
  });

  it('rejects a payload smuggling a physiological value', () => {
    for (const field of ['hrv', 'heartRate', 'sleepHours'] as const) {
      const payload = { ...makePayload(), [field]: 61 } as EdgeSnapshotPayload;
      const result = buildSnapshotCopy(payload);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reasons).toContain('forbidden_field');
    }
  });

  it('rejects a payload smuggling a social comparison', () => {
    for (const field of ['percentile', 'rank', 'comparison'] as const) {
      const payload = { ...makePayload(), [field]: 73 } as EdgeSnapshotPayload;
      expect(buildSnapshotCopy(payload).ok).toBe(false);
    }
  });

  it('guards every documented forbidden field', () => {
    for (const field of FORBIDDEN_SNAPSHOT_FIELDS) {
      const payload = { ...makePayload(), [field]: 'x' } as EdgeSnapshotPayload;
      expect(buildSnapshotCopy(payload).ok).toBe(false);
    }
  });

  it('exposes exactly one number on the card', () => {
    const result = buildSnapshotCopy(makePayload());
    if (result.ok) {
      const numericFields = Object.values(result.copy).filter((value) =>
        /^\d+$/.test(value)
      );
      expect(numericFields).toEqual(['82']);
    }
  });
});

describe('tier access', () => {
  it('is available regardless of tier — sharing is never paywalled', () => {
    expect(isSnapshotAvailable()).toBe(true);
  });
});
