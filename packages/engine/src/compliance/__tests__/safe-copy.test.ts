/**
 * @module compliance/safe-copy.test
 * @description Unit tests for the Compliance Guardrail Engine.
 */

import {
  findProhibitedTerms,
  isCompliantCopy,
  generateSafeCopy,
  getDriverExplanation,
  ALLOWED_VOCABULARY,
  PROHIBITED_VOCABULARY,
} from '../compliance/safe-copy';

// ─── findProhibitedTerms ───────────────────

describe('findProhibitedTerms', () => {
  it('should return empty array for clean text', () => {
    expect(findProhibitedTerms('Your signals look stable and balanced.')).toEqual([]);
  });

  it('should detect "trade" in text', () => {
    const result = findProhibitedTerms('Good time to trade stocks');
    expect(result).toContain('trade');
  });

  it('should detect "buy" in text', () => {
    const result = findProhibitedTerms('You should buy now');
    expect(result).toContain('buy');
  });

  it('should detect multiple violations', () => {
    const result = findProhibitedTerms('Best time to trade, guaranteed profit');
    expect(result.length).toBeGreaterThanOrEqual(2);
  });

  it('should be case insensitive', () => {
    const result = findProhibitedTerms('BEST TIME TO TRADE');
    expect(result.length).toBeGreaterThan(0);
  });

  it('should detect "diagnose" as medical language', () => {
    const result = findProhibitedTerms('This app can diagnose anxiety');
    expect(result).toContain('diagnose');
  });

  it('should detect "predict" as prohibited', () => {
    const result = findProhibitedTerms('We can predict your performance');
    expect(result).toContain('predict');
  });

  it('should detect "your body says" as directive', () => {
    const result = findProhibitedTerms('Your body says buy more');
    expect(result).toContain('your body says');
  });

  it('should allow safe wellness vocabulary', () => {
    const safeTexts = [
      'Clear state detected',
      'Elevated strain compared to baseline',
      'Decision readiness assessment',
      'Focus and recovery insights',
      'Self-awareness and reflection',
    ];
    for (const text of safeTexts) {
      expect(findProhibitedTerms(text)).toEqual([]);
    }
  });
});

// ─── isCompliantCopy ────────────────────────

describe('isCompliantCopy', () => {
  it('should return true for compliant text', () => {
    expect(isCompliantCopy('Your signals look steadier than usual.')).toBe(true);
  });

  it('should return false for non-compliant text', () => {
    expect(isCompliantCopy('Best time to trade right now')).toBe(false);
  });

  it('should return true for empty string', () => {
    expect(isCompliantCopy('')).toBe(true);
  });
});

// ─── generateSafeCopy ───────────────────────

describe('generateSafeCopy', () => {
  it('should generate copy for clear / high confidence', () => {
    const copy = generateSafeCopy('clear', 'high');
    expect(copy.headline).toBeTruthy();
    expect(copy.body).toBeTruthy();
    expect(isCompliantCopy(copy.headline)).toBe(true);
    expect(isCompliantCopy(copy.body)).toBe(true);
  });

  it('should generate copy for strain / low confidence', () => {
    const copy = generateSafeCopy('strain', 'low');
    expect(copy.headline).toBeTruthy();
    expect(copy.body).toBeTruthy();
    expect(isCompliantCopy(copy.headline)).toBe(true);
    expect(isCompliantCopy(copy.body)).toBe(true);
  });

  it('should generate compliant copy for all zone × confidence combinations', () => {
    const zones = ['clear', 'neutral', 'strain'] as const;
    const bands = ['high', 'moderate', 'low'] as const;

    for (const zone of zones) {
      for (const band of bands) {
        const copy = generateSafeCopy(zone, band);
        expect(isCompliantCopy(copy.headline)).toBe(true);
        expect(isCompliantCopy(copy.body)).toBe(true);
      }
    }
  });
});

// ─── getDriverExplanation ───────────────────

describe('getDriverExplanation', () => {
  it('should return explanation for hrv_vs_baseline positive', () => {
    const explanation = getDriverExplanation('hrv_vs_baseline', 'positive');
    expect(explanation).toBeTruthy();
    expect(isCompliantCopy(explanation)).toBe(true);
  });

  it('should return explanation for stress_proxy negative', () => {
    const explanation = getDriverExplanation('stress_proxy_vs_baseline', 'negative');
    expect(explanation).toBeTruthy();
    expect(isCompliantCopy(explanation)).toBe(true);
  });

  it('should generate compliant explanations for all driver × direction combinations', () => {
    const keys = [
      'hrv_vs_baseline', 'hr_stability', 'respiration_stability',
      'stress_proxy_vs_baseline', 'sleep_recovery', 'recent_trend',
      'baseline_freshness', 'signal_quality',
    ] as const;
    const directions = ['positive', 'neutral', 'negative'] as const;

    for (const key of keys) {
      for (const dir of directions) {
        const explanation = getDriverExplanation(key, dir);
        expect(explanation).toBeTruthy();
        expect(typeof explanation).toBe('string');
        expect(isCompliantCopy(explanation)).toBe(true);
      }
    }
  });
});

// ─── Vocabulary Lists ───────────────────────

describe('vocabulary lists', () => {
  it('should have no overlap between allowed and prohibited', () => {
    for (const allowed of ALLOWED_VOCABULARY) {
      for (const prohibited of PROHIBITED_VOCABULARY) {
        expect(allowed.toLowerCase()).not.toBe(prohibited.toLowerCase());
      }
    }
  });

  it('should have at least 10 allowed terms', () => {
    expect(ALLOWED_VOCABULARY.length).toBeGreaterThanOrEqual(10);
  });

  it('should have at least 10 prohibited terms', () => {
    expect(PROHIBITED_VOCABULARY.length).toBeGreaterThanOrEqual(10);
  });
});
