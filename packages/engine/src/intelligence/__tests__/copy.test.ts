/**
 * @module intelligence/copy.test
 * @description Unit tests for the Decision Intelligence copy layer.
 *
 * The load-bearing test is `every generated string is compliant`: it walks every
 * branch of every renderer and pushes each string through
 * `compliance/safe-copy`. Adding a branch without adding it here is how copy
 * gets shipped unguarded.
 */

import { findProhibitedTerms, isCompliantCopy } from '../../compliance/safe-copy';
import type { CalibrationResult } from '../calibration';
import {
  calibrationCopy,
  driftCopy,
  evidenceLine,
  evidenceReasonCopy,
  formatConfidence,
  formatCount,
  twinCopy,
  type InsightCopy,
} from '../copy';
import type { DriftResult } from '../drift';
import { buildEvidence, type EvidenceReasonCode, type EvidenceRequirement } from '../evidence';
import type { DecisionTwinResult } from '../twin';

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

const REASON_CODES: EvidenceReasonCode[] = [
  'sample_floor_not_met',
  'sample_count_below_high',
  'window_too_short',
  'inferred_only',
  'low_variability_reference',
  'mixed_capture_conditions',
];

function drift(overrides: Partial<Extract<DriftResult, { state: 'assessed' }>>): DriftResult {
  return {
    state: 'assessed',
    deviation: 14,
    distance: 14,
    z: 1.4,
    magnitude: 'drifting',
    direction: 'higher',
    reference: { bucket: 'morning', mean: 65, std: 10, sampleCount: 24, windowDays: 24 },
    evidence: EVIDENCE,
    ...overrides,
  };
}

function calibration(
  overrides: Partial<Extract<CalibrationResult, { state: 'assessed' }>>
): CalibrationResult {
  return {
    state: 'assessed',
    verdict: 'no_clear_shift',
    shift: 1,
    threshold: 5,
    before: 43,
    after: 44,
    priorSummary: null,
    evidence: EVIDENCE,
    ...overrides,
  };
}

function twin(
  overrides: Partial<Extract<DecisionTwinResult, { state: 'assessed' }>>
): DecisionTwinResult {
  return {
    state: 'assessed',
    matchCount: 11,
    followedProcessCount: 3,
    divergedCount: 8,
    sharedFeatures: ['timeBucket', 'driftMagnitude'],
    evidence: EVIDENCE,
    ...overrides,
  };
}

/** Every branch of every renderer, so the compliance sweep really is exhaustive. */
const ALL_SURFACES: InsightCopy[] = [
  driftCopy({ state: 'insufficient', moreSamplesNeeded: 6, evidence: EVIDENCE }),
  driftCopy(drift({ magnitude: 'within', distance: 1.2, direction: 'at' })),
  driftCopy(drift({ magnitude: 'drifting' })),
  driftCopy(drift({ magnitude: 'far', distance: 27, direction: 'lower', deviation: -27 })),
  calibrationCopy({ state: 'insufficient', moreSamplesNeeded: 2, evidence: EVIDENCE }),
  calibrationCopy({
    state: 'insufficient',
    moreSamplesNeeded: 2,
    evidence: buildEvidence({
      sampleCount: 0,
      windowDays: 0,
      provenance: ['measured'],
      requirement: REQ,
      extraReasons: ['mixed_capture_conditions'],
    }),
  }),
  calibrationCopy(calibration({ verdict: 'improved', before: 43, after: 61, shift: 18 })),
  calibrationCopy(calibration({ verdict: 'no_clear_shift' })),
  calibrationCopy(calibration({ verdict: 'declined', before: 61, after: 43, shift: -18 })),
  calibrationCopy(
    calibration({ verdict: 'improved', priorSummary: { total: 7, similar: 5 } })
  ),
  calibrationCopy(calibration({ verdict: 'improved', priorSummary: { total: 1, similar: 1 } })),
  twinCopy({ state: 'insufficient', moreSamplesNeeded: 3, evidence: EVIDENCE }),
  twinCopy(twin({})),
  twinCopy(twin({ divergedCount: 0, followedProcessCount: 11 })),
];

// ─── The compliance sweep ────────────────────

describe('Decision Intelligence copy', () => {
  it('produces no prohibited vocabulary on any branch', () => {
    for (const surface of ALL_SURFACES) {
      for (const text of [surface.headline, surface.body, surface.evidenceLine]) {
        expect(findProhibitedTerms(text)).toEqual([]);
      }
      if (surface.figure !== null) {
        expect(findProhibitedTerms(surface.figure)).toEqual([]);
      }
    }
  });

  it('produces no prohibited vocabulary in any Evidence X-Ray row', () => {
    for (const code of REASON_CODES) {
      expect(isCompliantCopy(evidenceReasonCopy(code))).toBe(true);
    }
  });

  it('gives every surface a headline, a body and an evidence line', () => {
    for (const surface of ALL_SURFACES) {
      expect(surface.headline.length).toBeGreaterThan(0);
      expect(surface.body.length).toBeGreaterThan(0);
      expect(surface.evidenceLine).toMatch(/Confidence: (High|Moderate|Low)/);
    }
  });
});

// ─── Drift: distance without direction ───────

describe('driftCopy', () => {
  it('never speaks the direction of the drift', () => {
    const forbidden = /\b(above|below|higher|lower)\b/i;
    for (const magnitude of ['within', 'drifting', 'far'] as const) {
      for (const direction of ['higher', 'at', 'lower'] as const) {
        const copy = driftCopy(drift({ magnitude, direction }));
        expect(copy.headline).not.toMatch(forbidden);
        expect(copy.body).not.toMatch(forbidden);
        expect(copy.figure ?? '').not.toMatch(forbidden);
      }
    }
  });

  it('renders the same figure whichever side of the reference the reading is on', () => {
    const above = driftCopy(drift({ deviation: 17, distance: 17, direction: 'higher' }));
    const below = driftCopy(drift({ deviation: -17, distance: 17, direction: 'lower' }));
    expect(above.figure).toBe(below.figure);
    expect(above.figure).toBe('+17 away from your baseline');
  });

  it('shows how many more sessions are needed instead of a number it cannot back', () => {
    const copy = driftCopy({ state: 'insufficient', moreSamplesNeeded: 6, evidence: EVIDENCE });
    expect(copy.figure).toBe('6 more comparable sessions needed');
    expect(copy.headline).toBe('Building your baseline');
  });
});

// ─── Calibration: no_clear_shift survives ────

describe('calibrationCopy', () => {
  it('states no_clear_shift as a result, not as a setback', () => {
    const copy = calibrationCopy(calibration({ verdict: 'no_clear_shift' }));
    expect(copy.headline).toBe('No clear shift yet');
    expect(copy.body).toContain('not a failure');
    expect(copy.body).not.toMatch(/try again|keep going|almost/i);
  });

  it('shows the before and after readings for every verdict', () => {
    for (const verdict of ['improved', 'no_clear_shift', 'declined'] as const) {
      expect(calibrationCopy(calibration({ verdict })).figure).toBe('43 → 44');
    }
  });

  it('names the instrument mismatch when that is why it refused', () => {
    const copy = calibrationCopy({
      state: 'insufficient',
      moreSamplesNeeded: 2,
      evidence: buildEvidence({
        sampleCount: 0,
        windowDays: 0,
        provenance: ['measured'],
        requirement: REQ,
        extraReasons: ['mixed_capture_conditions'],
      }),
    });
    expect(copy.body).toContain('captured differently');
  });

  it('adds the prior-sessions line only when priors exist', () => {
    expect(calibrationCopy(calibration({ verdict: 'improved' })).body).not.toContain('Similar in');
    expect(
      calibrationCopy(calibration({ verdict: 'improved', priorSummary: { total: 7, similar: 5 } }))
        .body
    ).toContain('Similar in 5 of your last 7 sessions.');
  });
});

// ─── Twin: history, never a forecast ─────────

describe('twinCopy', () => {
  it('always attaches the denial that it forecasts anything', () => {
    expect(twinCopy(twin({})).body).toContain('not a forecast');
  });

  it('does not claim divergence when there was none', () => {
    const copy = twinCopy(twin({ divergedCount: 0, followedProcessCount: 11 }));
    expect(copy.body).toContain('In all of them, you followed your own process.');
  });

  it('reports divergence in process language only', () => {
    const copy = twinCopy(twin({}));
    expect(copy.body).toContain('did not end up following your own process');
    expect(copy.body).not.toMatch(/fail|mistake|wrong/i);
  });
});

// ─── Formatting helpers ──────────────────────

describe('formatting helpers', () => {
  it('pluralizes only when there is more than one', () => {
    expect(formatCount(1, 'comparable session')).toBe('1 comparable session');
    expect(formatCount(24, 'comparable session')).toBe('24 comparable sessions');
    expect(formatCount(0, 'comparable session')).toBe('0 comparable sessions');
  });

  it('capitalizes the confidence band', () => {
    expect(formatConfidence('high')).toBe('High');
    expect(formatConfidence('moderate')).toBe('Moderate');
    expect(formatConfidence('low')).toBe('Low');
  });

  it('always states both the sample count and the confidence', () => {
    expect(evidenceLine(EVIDENCE)).toBe('Based on 24 comparable sessions · Confidence: High');
  });
});
