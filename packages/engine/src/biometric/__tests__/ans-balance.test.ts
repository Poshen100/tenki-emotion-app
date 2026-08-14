/**
 * @module biometric/ans-balance.test
 * @description Tests for autonomic balance. The bounded-output and
 * confidence-follows-baseline assertions are the ones that keep this a relative
 * wellness observation rather than something that reads like a measurement.
 */

import {
  ANS_BALANCED_BAND,
  ANS_MIN_DISPLAY_CONFIDENCE,
  classifyLean,
  computeAnsBalance,
  isAnsBalanceDisplayable,
} from '../ans-balance';
import type { AnsBalanceInput } from '../ans-balance';
import type { StressProxyResult } from '../stress-proxy';

/** Builds a stress proxy result at a given score. */
function stressAt(score: number): StressProxyResult {
  return {
    score,
    level: score >= 76 ? 'HIGH' : score >= 51 ? 'MEDIUM' : score >= 26 ? 'LOW' : 'REST',
    hrvContribution: score * 0.6,
    hrContribution: score * 0.4,
  };
}

/** Builds inputs with overrides. */
function makeInput(overrides: Partial<AnsBalanceInput> = {}): AnsBalanceInput {
  return {
    hrvZ: 0,
    hrStability: 0.5,
    stress: stressAt(50),
    baselineMaturity: 1,
    ...overrides,
  };
}

describe('position', () => {
  it('stays bounded to -1..+1 under extreme inputs', () => {
    const high = computeAnsBalance(
      makeInput({ hrvZ: 99, hrStability: 1, stress: stressAt(0) })
    );
    const low = computeAnsBalance(
      makeInput({ hrvZ: -99, hrStability: 0, stress: stressAt(100) })
    );
    expect(high.position).toBeLessThanOrEqual(1);
    expect(low.position).toBeGreaterThanOrEqual(-1);
  });

  it('leans parasympathetic when HRV is up, HR steady and stress low', () => {
    const result = computeAnsBalance(
      makeInput({ hrvZ: 2, hrStability: 0.95, stress: stressAt(10) })
    );
    expect(result.position).toBeGreaterThan(ANS_BALANCED_BAND);
    expect(result.lean).toBe('parasympathetic');
  });

  it('leans sympathetic when HRV is down, HR erratic and stress high', () => {
    const result = computeAnsBalance(
      makeInput({ hrvZ: -2, hrStability: 0.1, stress: stressAt(90) })
    );
    expect(result.position).toBeLessThan(-ANS_BALANCED_BAND);
    expect(result.lean).toBe('sympathetic');
  });

  it('reports balanced in the middle', () => {
    const result = computeAnsBalance(
      makeInput({ hrvZ: 0, hrStability: 0.5, stress: stressAt(50) })
    );
    expect(result.lean).toBe('balanced');
  });

  it('weights HRV deviation more heavily than stability', () => {
    const hrvDriven = computeAnsBalance(makeInput({ hrvZ: 2, hrStability: 0.5 }));
    const stabilityDriven = computeAnsBalance(makeInput({ hrvZ: 0, hrStability: 1 }));
    expect(hrvDriven.position).toBeGreaterThan(stabilityDriven.position);
  });
});

describe('lean classification', () => {
  it('uses a dead band around zero', () => {
    expect(classifyLean(0)).toBe('balanced');
    expect(classifyLean(ANS_BALANCED_BAND)).toBe('balanced');
    expect(classifyLean(-ANS_BALANCED_BAND)).toBe('balanced');
  });

  it('classifies outside the dead band', () => {
    expect(classifyLean(ANS_BALANCED_BAND + 0.01)).toBe('parasympathetic');
    expect(classifyLean(-ANS_BALANCED_BAND - 0.01)).toBe('sympathetic');
  });
});

describe('confidence', () => {
  it('follows baseline maturity, not the strength of the signal', () => {
    const strongSignalNewBaseline = computeAnsBalance(
      makeInput({ hrvZ: 3, hrStability: 1, stress: stressAt(0), baselineMaturity: 0 })
    );
    expect(strongSignalNewBaseline.confidence).toBe(0);
    expect(strongSignalNewBaseline.lean).toBe('parasympathetic');
  });

  it('withholds display while the baseline is immature', () => {
    const immature = computeAnsBalance(makeInput({ baselineMaturity: 0.2 }));
    expect(isAnsBalanceDisplayable(immature)).toBe(false);
  });

  it('allows display once the baseline is established', () => {
    const mature = computeAnsBalance(
      makeInput({ baselineMaturity: ANS_MIN_DISPLAY_CONFIDENCE })
    );
    expect(isAnsBalanceDisplayable(mature)).toBe(true);
  });
});
