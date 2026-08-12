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

  it('should limit daily scans to 1', () => {
    expect(FREE_TIER.features.dailyScanLimit).toBe(1);
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

  it('should NOT provide the external alert bridge', () => {
    expect(FREE_TIER.features.externalAlertBridge).toBe(false);
  });

  it('should always allow export (privacy never paywalled)', () => {
    expect(FREE_TIER.features.exportEnabled).toBe(true);
  });

  it('should limit history to 7 days', () => {
    expect(FREE_TIER.features.localHistoryDays).toBe(7);
  });

  it('should provide the basic AI Coach', () => {
    expect(FREE_TIER.features.aiCoach).toBe('basic');
  });

  it('should always allow Edge Snapshot (sharing never paywalled)', () => {
    expect(FREE_TIER.features.edgeSnapshot).toBe(true);
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
    expect(PREMIUM_TIER.features.localHistoryDays).toBe('unlimited');
  });

  it('should provide the advanced AI Coach', () => {
    expect(PREMIUM_TIER.features.aiCoach).toBe('advanced');
  });

  it('should allow Edge Snapshot', () => {
    expect(PREMIUM_TIER.features.edgeSnapshot).toBe(true);
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

  it('free tier should have limited history (truthy as number > 0)', () => {
    expect(hasFeature('free', 'localHistoryDays')).toBe(true);
  });

  it('both tiers should have Edge Snapshot (growth surface)', () => {
    expect(hasFeature('free', 'edgeSnapshot')).toBe(true);
    expect(hasFeature('premium', 'edgeSnapshot')).toBe(true);
  });

  it('only premium should have the advanced coach', () => {
    expect(hasFeature('free', 'aiCoach')).toBe(false);
    expect(hasFeature('premium', 'aiCoach')).toBe(true);
  });
});
