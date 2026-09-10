/**
 * @module intelligence/twin.test
 * @description Unit tests for Decision Twin. The defended properties: it stays
 * silent below the evidence floor, and it only offers a reason two moments are
 * alike when EVERY match actually shares that reason.
 */

import {
  findDecisionTwins,
  isTwinAssessed,
  sharedFeatures,
  twinSimilarity,
  TWIN_EVIDENCE_REQUIREMENT,
  TWIN_FEATURE_WEIGHTS,
  TWIN_MATCH_THRESHOLD,
  type DecisionMoment,
  type DecisionTwinRecord,
} from '../twin';
import { MS_PER_DAY } from '../evidence';

const NOW = new Date(2026, 8, 9, 21, 0, 0).getTime(); // evening bucket

const MOMENT: DecisionMoment = {
  ts: NOW,
  band: 'neutral',
  driftMagnitude: 'drifting',
  templateId: 'FBD',
};

/** A past record identical to MOMENT except for the day and the fields overridden. */
function past(
  dayOffset: number,
  followedProcess: boolean,
  overrides: Partial<DecisionTwinRecord> = {}
): DecisionTwinRecord {
  return {
    ...MOMENT,
    ts: NOW - dayOffset * MS_PER_DAY,
    followedProcess,
    ...overrides,
  };
}

// ─── similarity ──────────────────────────────

describe('twinSimilarity', () => {
  it('scores an identical moment at 100', () => {
    expect(twinSimilarity(MOMENT, { ...MOMENT })).toBe(100);
  });

  it('subtracts exactly the weight of each differing feature', () => {
    const otherTemplate = { ...MOMENT, templateId: 'CANSLIM' };
    expect(twinSimilarity(MOMENT, otherTemplate)).toBe(100 - TWIN_FEATURE_WEIGHTS.template);
  });

  it('treats a shared absence of template as a shared fact', () => {
    const a = { ...MOMENT, templateId: null };
    const b = { ...MOMENT, templateId: null };
    expect(sharedFeatures(a, b)).toContain('template');
  });

  it('drops below the match threshold once two heavy features differ', () => {
    const different = { ...MOMENT, driftMagnitude: 'within' as const, band: 'clear' as const };
    expect(twinSimilarity(MOMENT, different)).toBeLessThan(TWIN_MATCH_THRESHOLD);
  });
});

// ─── findDecisionTwins: staying quiet ────────

describe('findDecisionTwins (insufficient evidence)', () => {
  it('refuses to speak below the match floor', () => {
    const result = findDecisionTwins(MOMENT, [past(1, true), past(2, false)]);
    expect(result.state).toBe('insufficient');
    if (result.state !== 'insufficient') throw new Error('expected insufficient');
    expect(result.moreSamplesNeeded).toBe(TWIN_EVIDENCE_REQUIREMENT.minSamples - 2);
  });

  it('does not count dissimilar history toward the floor', () => {
    const dissimilar = Array.from({ length: 20 }, (_, i) =>
      past(i + 1, true, {
        ts: new Date(2026, 8, 8 - (i % 20), 9, 0).getTime(),
        band: 'clear',
        driftMagnitude: 'within',
      })
    );
    expect(findDecisionTwins(MOMENT, dissimilar).state).toBe('insufficient');
  });

  it('ignores records dated after the moment being assessed', () => {
    const future = Array.from({ length: 8 }, (_, i) => past(-(i + 1), true));
    expect(findDecisionTwins(MOMENT, future).state).toBe('insufficient');
  });
});

// ─── findDecisionTwins: the claim ────────────

describe('findDecisionTwins (assessed)', () => {
  it('counts matches and splits them by process adherence', () => {
    const history = [
      past(1, false),
      past(2, false),
      past(3, false),
      past(4, true),
      past(5, false),
      past(6, false),
      past(7, false),
      past(8, false),
      past(9, false),
      past(10, true),
      past(11, true),
    ];
    const result = findDecisionTwins(MOMENT, history);
    if (!isTwinAssessed(result)) throw new Error('expected a match');
    expect(result.matchCount).toBe(11);
    expect(result.divergedCount).toBe(8);
    expect(result.followedProcessCount).toBe(3);
    expect(result.divergedCount + result.followedProcessCount).toBe(result.matchCount);
  });

  it('only reports features every single match shares', () => {
    const history = [
      past(1, true),
      past(2, true),
      past(3, true),
      past(4, true),
      // Still a twin (85 ≥ threshold) but on a different template.
      past(5, false, { templateId: 'CANSLIM' }),
    ];
    const result = findDecisionTwins(MOMENT, history);
    if (!isTwinAssessed(result)) throw new Error('expected a match');
    expect(result.matchCount).toBe(5);
    expect(result.sharedFeatures).not.toContain('template');
    expect(result.sharedFeatures).toEqual(
      expect.arrayContaining(['timeBucket', 'driftMagnitude', 'band'])
    );
  });

  it('reaches high confidence only with enough matches across enough days', () => {
    const many = Array.from({ length: 14 }, (_, i) => past(i + 1, i % 3 === 0));
    const result = findDecisionTwins(MOMENT, many);
    if (!isTwinAssessed(result)) throw new Error('expected a match');
    expect(result.evidence.confidence).toBe('high');
    expect(result.evidence.sampleCount).toBe(14);
  });

  it('caps confidence when the matches are crammed into a few days', () => {
    const sameWeek = Array.from({ length: 14 }, (_, i) =>
      past(0, true, { ts: NOW - (i % 3) * MS_PER_DAY - i * 60_000 })
    );
    const result = findDecisionTwins(MOMENT, sameWeek);
    if (!isTwinAssessed(result)) throw new Error('expected a match');
    expect(result.evidence.confidence).toBe('moderate');
    expect(result.evidence.reasons).toContain('window_too_short');
  });
});
