/**
 * @module session/gate.test
 * @description Unit tests for the pre-session gate evaluation.
 */

import { evaluateGate, canProceed, shouldSuggestReset } from '../session/gate';
import { ConfidenceBreakdown } from '../common/types';

function createConfidence(overall: number): ConfidenceBreakdown {
  return {
    overall,
    band: overall >= 0.80 ? 'high' : overall >= 0.55 ? 'moderate' : 'low',
    factors: {
      baselineMaturity: 1.0,
      inputCompleteness: 1.0,
      signalQuality: overall,
      recency: 1.0,
      crossSourceAgreement: 0.9,
    },
  };
}

describe('evaluateGate', () => {
  it('should return clear_pass for high score + high confidence', () => {
    const result = evaluateGate(75, createConfidence(0.85));
    expect(result.result).toBe('clear_pass');
    expect(result.consecutiveRedGates).toBe(0);
  });

  it('should return soft_caution for medium score', () => {
    const result = evaluateGate(55, createConfidence(0.80));
    expect(result.result).toBe('soft_caution');
  });

  it('should return soft_caution for high score but low confidence', () => {
    const result = evaluateGate(75, createConfidence(0.50));
    expect(result.result).toBe('soft_caution');
  });

  it('should return red_gate for low score', () => {
    const result = evaluateGate(30, createConfidence(0.85));
    expect(result.result).toBe('red_gate');
    expect(result.consecutiveRedGates).toBe(1);
  });

  it('should return force_hold for 2+ consecutive red gates', () => {
    const result = evaluateGate(25, createConfidence(0.85), 2);
    expect(result.result).toBe('force_hold');
    expect(result.consecutiveRedGates).toBe(3);
  });

  it('should reset consecutive red gates on non-red result', () => {
    const result = evaluateGate(75, createConfidence(0.85), 3);
    expect(result.result).toBe('clear_pass');
    expect(result.consecutiveRedGates).toBe(0);
  });

  it('should include a message', () => {
    const result = evaluateGate(75, createConfidence(0.85));
    expect(result.message).toBeTruthy();
    expect(typeof result.message).toBe('string');
  });

  it('boundary: score 70 + confidence 0.70 should be clear_pass', () => {
    const result = evaluateGate(70, createConfidence(0.70));
    expect(result.result).toBe('clear_pass');
  });

  it('boundary: score 39 should be red_gate', () => {
    const result = evaluateGate(39, createConfidence(0.90));
    expect(result.result).toBe('red_gate');
  });

  it('boundary: score 40 should be soft_caution (not red_gate)', () => {
    const result = evaluateGate(40, createConfidence(0.90));
    expect(result.result).toBe('soft_caution');
  });
});

describe('canProceed', () => {
  it('clear_pass should allow proceed', () => {
    expect(canProceed('clear_pass')).toBe(true);
  });

  it('soft_caution should allow proceed', () => {
    expect(canProceed('soft_caution')).toBe(true);
  });

  it('red_gate should not allow proceed', () => {
    expect(canProceed('red_gate')).toBe(false);
  });

  it('force_hold should not allow proceed', () => {
    expect(canProceed('force_hold')).toBe(false);
  });
});

describe('shouldSuggestReset', () => {
  it('force_hold should suggest reset', () => {
    expect(shouldSuggestReset('force_hold')).toBe(true);
  });

  it('red_gate should not suggest reset', () => {
    expect(shouldSuggestReset('red_gate')).toBe(false);
  });

  it('clear_pass should not suggest reset', () => {
    expect(shouldSuggestReset('clear_pass')).toBe(false);
  });
});
