/**
 * @module intelligence/black-box.test
 * @description Unit tests for the Decision Black Box. The defended property:
 * a result the engine refused to make a claim about never becomes a line in
 * the chain.
 */

import { buildBlackBox } from '../black-box';
import type { CalibrationResult } from '../calibration';
import type { DriftResult } from '../drift';
import { buildEvidence, MS_PER_DAY, type EvidenceRequirement } from '../evidence';
import type { DecisionTwinResult } from '../twin';

const NOW = new Date(2026, 8, 9, 9, 12, 0).getTime();

const REQ: EvidenceRequirement = {
  minSamples: 8,
  moderateSamples: 12,
  highSamples: 24,
  highWindowDays: 10,
};

const EVIDENCE = buildEvidence({
  sampleCount: 24,
  windowDays: 24,
  provenance: ['measured', 'inferred'],
  requirement: REQ,
});

const ASSESSED_DRIFT: DriftResult = {
  state: 'assessed',
  deviation: 14,
  distance: 14,
  z: 1.4,
  magnitude: 'drifting',
  direction: 'higher',
  reference: { bucket: 'morning', mean: 65, std: 10, sampleCount: 24, windowDays: 24 },
  evidence: EVIDENCE,
};

const REFUSED_DRIFT: DriftResult = {
  state: 'insufficient',
  moreSamplesNeeded: 6,
  evidence: EVIDENCE,
};

const ASSESSED_CALIBRATION: CalibrationResult = {
  state: 'assessed',
  verdict: 'no_clear_shift',
  shift: 1,
  threshold: 5,
  before: 43,
  after: 44,
  priorSummary: null,
  evidence: EVIDENCE,
};

const REFUSED_TWIN: DecisionTwinResult = {
  state: 'insufficient',
  moreSamplesNeeded: 3,
  evidence: EVIDENCE,
};

describe('buildBlackBox', () => {
  it('orders every event chronologically regardless of input order', () => {
    const timeline = buildBlackBox({
      decisions: [{ ts: NOW + 27 * 60_000, templateId: 'FBD', followedProcess: false }],
      scans: [{ ts: NOW, value: 61 }],
      drifts: [{ ts: NOW + 19 * 60_000, result: ASSESSED_DRIFT }],
      calibrations: [{ ts: NOW + 22 * 60_000, result: ASSESSED_CALIBRATION }],
    });
    expect(timeline.events.map((e) => e.detail.kind)).toEqual([
      'scan',
      'drift',
      'calibration',
      'decision',
    ]);
  });

  it('never records a result the engine refused to claim', () => {
    const timeline = buildBlackBox({
      drifts: [{ ts: NOW, result: REFUSED_DRIFT }],
      noticed: [{ ts: NOW + 60_000, result: REFUSED_TWIN }],
    });
    expect(timeline.events).toEqual([]);
    expect(timeline.claimCount).toBe(0);
  });

  it('attaches evidence to claims and leaves plain facts without any', () => {
    const timeline = buildBlackBox({
      scans: [{ ts: NOW, value: 61 }],
      drifts: [{ ts: NOW + 60_000, result: ASSESSED_DRIFT }],
    });
    const [scan, drift] = timeline.events;
    expect(scan.evidence).toBeNull();
    expect(drift.evidence).toBe(EVIDENCE);
    expect(timeline.claimCount).toBe(1);
  });

  it('reports how many days the chain spans', () => {
    const timeline = buildBlackBox({
      scans: [
        { ts: NOW, value: 61 },
        { ts: NOW - MS_PER_DAY, value: 58 },
        { ts: NOW - MS_PER_DAY - 60_000, value: 57 },
      ],
    });
    expect(timeline.windowDays).toBe(2);
  });

  it('drops entries with a broken timestamp instead of sorting them somewhere', () => {
    const timeline = buildBlackBox({
      scans: [
        { ts: Number.NaN, value: 61 },
        { ts: NOW, value: 58 },
      ],
    });
    expect(timeline.events).toHaveLength(1);
  });

  it('returns an empty chain for an empty source', () => {
    expect(buildBlackBox({})).toEqual({ events: [], windowDays: 0, claimCount: 0 });
  });
});
