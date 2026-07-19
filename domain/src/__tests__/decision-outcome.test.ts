import {
  isDisciplinedOutcome,
  resolveOutcomeTag,
  summarizeDisciplineRate,
} from '../policies/decision-outcome';
import type { DecisionOutcomeRecord } from '../policies/decision-outcome';

describe('resolveOutcomeTag', () => {
  it('maps a full timeout to timed_out', () => {
    expect(resolveOutcomeTag({ endType: 'timeout', reachedReadiness: true })).toBe('timed_out');
    expect(resolveOutcomeTag({ endType: 'timeout', reachedReadiness: false })).toBe('timed_out');
  });

  it('maps a cancel to broke_discipline', () => {
    expect(resolveOutcomeTag({ endType: 'cancel', reachedReadiness: true })).toBe(
      'broke_discipline',
    );
  });

  it('maps a close after readiness to stayed_disciplined', () => {
    expect(resolveOutcomeTag({ endType: 'close', reachedReadiness: true })).toBe(
      'stayed_disciplined',
    );
  });

  it('maps an early close (before readiness) to broke_discipline', () => {
    expect(resolveOutcomeTag({ endType: 'close', reachedReadiness: false })).toBe(
      'broke_discipline',
    );
  });
});

describe('isDisciplinedOutcome', () => {
  it('counts stayed_disciplined and timed_out as disciplined', () => {
    expect(isDisciplinedOutcome('stayed_disciplined')).toBe(true);
    expect(isDisciplinedOutcome('timed_out')).toBe(true);
  });

  it('does not count broke_discipline or no_action_taken', () => {
    expect(isDisciplinedOutcome('broke_discipline')).toBe(false);
    expect(isDisciplinedOutcome('no_action_taken')).toBe(false);
  });
});

describe('summarizeDisciplineRate', () => {
  function record(tag: DecisionOutcomeRecord['outcomeTag']): DecisionOutcomeRecord {
    return {
      symbol: 'ES1!',
      templateId: 'FBD',
      outcomeTag: tag,
      contextTag: null,
      reachedReadiness: tag === 'stayed_disciplined',
      durationSec: 180,
      ts: 1,
    };
  }

  it('returns a null rate for no records', () => {
    expect(summarizeDisciplineRate([])).toEqual({ total: 0, disciplined: 0, rate: null });
  });

  it('rates all-disciplined as 1', () => {
    const summary = summarizeDisciplineRate([record('stayed_disciplined'), record('timed_out')]);
    expect(summary).toEqual({ total: 2, disciplined: 2, rate: 1 });
  });

  it('computes a mixed rate', () => {
    const summary = summarizeDisciplineRate([
      record('stayed_disciplined'),
      record('broke_discipline'),
      record('timed_out'),
      record('broke_discipline'),
    ]);
    expect(summary.total).toBe(4);
    expect(summary.disciplined).toBe(2);
    expect(summary.rate).toBe(0.5);
  });
});
