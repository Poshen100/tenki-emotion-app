/**
 * @module intelligence/routines.test
 * @description Pre-decision routine tallies (founder 2026-11-22, §4.2 widened).
 */

import { isCompliantCopy } from '../../compliance/safe-copy';
import { type CalibrationResult, assessCalibration } from '../calibration';
import { ROUTINE_LABELS, routineTallyCopy } from '../copy';
import {
  PRE_DECISION_ROUTINES,
  ROUTINE_EVIDENCE_REQUIREMENT,
  type PreDecisionRoutine,
  type RoutineRun,
  summarizeRoutineEffects,
} from '../routines';

const DAY = 86_400_000;
const T0 = Date.UTC(2026, 10, 1, 9);
const reference = { bucket: 'morning' as const, mean: 60, std: 10, sampleCount: 20, windowDays: 14 };

/** A real calibration verdict for a given shift (threshold here is 5). */
function result(shift: number, sameCapture = true): CalibrationResult {
  return assessCalibration({
    before: { value: 55, ts: T0, captureId: 'soul-scan:A' },
    after: { value: 55 + shift, ts: T0 + 180_000, captureId: sameCapture ? 'soul-scan:A' : 'watch:B' },
    reference,
  });
}

function run(routine: PreDecisionRoutine, i: number, shift: number, sameCapture = true): RoutineRun {
  return { routine, ts: T0 + i * DAY, result: result(shift, sameCapture) };
}

describe('summarizeRoutineEffects', () => {
  it('stays silent below the floor and says how many runs are missing', () => {
    const [tally] = summarizeRoutineEffects([run('short_walk', 0, 8), run('short_walk', 1, 0)]);
    expect(tally.state).toBe('insufficient');
    if (tally.state !== 'insufficient') throw new Error('unreachable');
    expect(tally.moreSamplesNeeded).toBe(ROUTINE_EVIDENCE_REQUIREMENT.minSamples - 2);
  });

  it('gives all three counts once the floor is met', () => {
    const runs = [8, 8, 0, 0, 0, -8].map((shift, i) => run('breath_reset', i, shift));
    const [tally] = summarizeRoutineEffects(runs);
    expect(tally).toMatchObject({
      state: 'assessed',
      routine: 'breath_reset',
      total: 6,
      improved: 2,
      noClearShift: 3,
      declined: 1,
      notComparable: 0,
    });
  });

  it('🔴 counts non-comparable pairs separately instead of dropping them or counting them as "no shift"', () => {
    const runs = [
      ...[0, 0, 0, 0, 0].map((shift, i) => run('water', i, shift)),
      run('water', 5, 20, false),
    ];
    const [tally] = summarizeRoutineEffects(runs);
    expect(tally).toMatchObject({ state: 'assessed', total: 5, noClearShift: 5, notComparable: 1 });
  });

  it('a routine whose runs were all on mixed instruments is still insufficient, not "no effect"', () => {
    const runs = [0, 1, 2, 3, 4, 5].map((i) => run('plan_review', i, 10, false));
    const [tally] = summarizeRoutineEffects(runs);
    expect(tally.state).toBe('insufficient');
    expect(tally.notComparable).toBe(6);
  });

  it('🔴 returns routines in the fixed list order — never sorted by how well they "worked"', () => {
    const runs = [
      ...[0, 1, 2, 3, 4].map((i) => run('plan_review', i, 9)), // all "improved"
      ...[0, 1, 2, 3, 4].map((i) => run('breath_reset', i, -9)), // all "declined"
      run('short_walk', 0, 0),
    ];
    expect(summarizeRoutineEffects(runs).map((t) => t.routine)).toEqual([
      'breath_reset',
      'short_walk',
      'plan_review',
    ]);
  });

  it('omits routines that were never tried', () => {
    expect(summarizeRoutineEffects([])).toEqual([]);
  });
});

describe('routineTallyCopy', () => {
  const tallies = summarizeRoutineEffects([
    ...[8, 0, 0, -8, 0, 0].map((shift, i) => run('breath_reset', i, shift)),
    run('breath_reset', 6, 8, false),
    run('short_walk', 0, 0),
    run('short_walk', 1, 0, false),
  ]);

  it('every routine has a label', () => {
    for (const routine of PRE_DECISION_ROUTINES) expect(ROUTINE_LABELS[routine]).toBeTruthy();
  });

  it('🔴 states all three counts in order, and that no shift is a result', () => {
    const copy = routineTallyCopy(tallies[0]);
    expect(copy.body).toContain('closer to your usual range 1, no clear shift 4, further from it 1');
    expect(copy.body).toContain('No clear shift is a result too.');
    expect(copy.body).toContain('1 run left out');
  });

  it('🔴 never ranks, recommends, or talks about trading', () => {
    for (const tally of tallies) {
      const copy = routineTallyCopy(tally);
      const all = [copy.headline, copy.body, copy.figure ?? '', copy.evidenceLine].join(' ');
      expect(all).not.toMatch(/\b(best|worst|most|mostly|should|recommend|try|works?)\b/i);
      expect(all).not.toMatch(/trade|entry|exit|market/i);
    }
  });

  it('every generated string is compliant', () => {
    const labels = Object.values(ROUTINE_LABELS);
    for (const tally of tallies) {
      const copy = routineTallyCopy(tally);
      for (const text of [copy.headline, copy.body, copy.figure ?? '', copy.evidenceLine, ...labels]) {
        expect(isCompliantCopy(text)).toBe(true);
      }
    }
  });
});
