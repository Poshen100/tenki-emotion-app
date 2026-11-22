/**
 * @module shared/subscription-tiers.test
 * @description Unit tests for v3 subscription tiers (2 tiers).
 */

import {
  SUBSCRIPTION_TIERS,
  FREE_TIER,
  PREMIUM_TIER,
  BILLING_CADENCES,
  hasFeature,
} from '../subscription-tiers';

describe('SUBSCRIPTION_TIERS', () => {
  it('should have exactly 2 tiers', () => {
    expect(Object.keys(SUBSCRIPTION_TIERS).length).toBe(2);
  });

  it('should have free and premium tiers', () => {
    expect(SUBSCRIPTION_TIERS.free).toBeDefined();
    expect(SUBSCRIPTION_TIERS.premium).toBeDefined();
  });
});

describe('FREE_TIER', () => {
  it('should have id "free"', () => {
    expect(FREE_TIER.id).toBe('free');
  });

  it('🔴 does not limit scans — the scan is the ritual that opens the loop', () => {
    expect(FREE_TIER.features.dailyScanLimit).toBe('unlimited');
  });

  it('should provide basic Edge Score', () => {
    expect(FREE_TIER.features.edgeScore).toBe(true);
  });

  it('should NOT provide Edge Graph', () => {
    expect(FREE_TIER.features.edgeGraph).toBe(false);
  });

  it('should NOT provide Detector alerts', () => {
    expect(FREE_TIER.features.detectorAlerts).toBe(false);
  });

  it('🔴 includes the alert bridge — the entry of the north-star loop is never paywalled', () => {
    expect(FREE_TIER.features.externalAlertBridge).toBe(true);
  });

  it('should always allow export (privacy never paywalled)', () => {
    expect(FREE_TIER.features.exportEnabled).toBe(true);
  });

  it('shows the last 30 days (storage itself is never limited by tier)', () => {
    expect(FREE_TIER.features.historyViewDays).toBe(30);
  });
});

describe('PREMIUM_TIER', () => {
  it('should have id "premium"', () => {
    expect(PREMIUM_TIER.id).toBe('premium');
  });

  it('should allow unlimited daily scans', () => {
    expect(PREMIUM_TIER.features.dailyScanLimit).toBe('unlimited');
  });

  it('should provide Edge Graph', () => {
    expect(PREMIUM_TIER.features.edgeGraph).toBe(true);
  });

  it('should provide Detector alerts', () => {
    expect(PREMIUM_TIER.features.detectorAlerts).toBe(true);
  });

  it('should provide the external alert bridge', () => {
    expect(PREMIUM_TIER.features.externalAlertBridge).toBe(true);
  });

  it('should provide advanced insights', () => {
    expect(PREMIUM_TIER.features.advancedInsights).toBe(true);
  });

  it('should provide full session archive', () => {
    expect(PREMIUM_TIER.features.sessionArchive).toBe('full');
  });

  it('should allow export', () => {
    expect(PREMIUM_TIER.features.exportEnabled).toBe(true);
  });

  it('should provide unlimited history', () => {
    expect(PREMIUM_TIER.features.historyViewDays).toBe('unlimited');
  });
});

describe('BILLING_CADENCES', () => {
  it('should have monthly and yearly', () => {
    expect(BILLING_CADENCES.monthly).toBeDefined();
    expect(BILLING_CADENCES.yearly).toBeDefined();
  });

  it('yearly should have discount label', () => {
    expect(BILLING_CADENCES.yearly.discount).toBeTruthy();
  });
});

describe('hasFeature', () => {
  it('free tier should have edgeScore', () => {
    expect(hasFeature('free', 'edgeScore')).toBe(true);
  });

  it('free tier should not have edgeGraph', () => {
    expect(hasFeature('free', 'edgeGraph')).toBe(false);
  });

  it('premium tier should have edgeGraph', () => {
    expect(hasFeature('premium', 'edgeGraph')).toBe(true);
  });

  it('both tiers should have export (privacy)', () => {
    expect(hasFeature('free', 'exportEnabled')).toBe(true);
    expect(hasFeature('premium', 'exportEnabled')).toBe(true);
  });

  it('free tier should have a history view (truthy as number > 0)', () => {
    expect(hasFeature('free', 'historyViewDays')).toBe(true);
  });
});

describe('🔴 v2 leftovers that contradict the decision-intelligence copy rules', () => {
  // DECISION-INTELLIGENCE.md §5: no outcome prediction; compare only with yourself.
  // Re-adding either key to a tier would invite the next session to build it.
  it.each(['edgePrediction', 'benchmarks'])('no tier carries %s', (key) => {
    for (const tier of Object.values(SUBSCRIPTION_TIERS)) {
      expect(Object.keys(tier.features)).not.toContain(key);
    }
  });
});
