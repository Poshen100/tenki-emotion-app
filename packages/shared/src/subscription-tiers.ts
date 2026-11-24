/**
 * @module subscription-tiers
 * @description v3 Subscription model — Free / Premium (two tiers only).
 * Premium has monthly and yearly billing cadences.
 *
 * @version 3.0 — Replaces v2 free/retail/pro 3-tier system.
 * @see ANTIGRAVITY.md v3.0 Section 1.3
 */

import type { SubscriptionTier, BillingCadence } from '../../engine/src/common/types';

export type { SubscriptionTier, BillingCadence };

/** Feature access configuration per tier. */
export interface TierFeatures {
  /** Daily scan limit. */
  dailyScanLimit: number | 'unlimited';
  /** Edge Score access. */
  edgeScore: boolean;
  /** Basic readiness insight. */
  basicInsight: boolean;
  /**
   * How far back the history VIEW reaches (days). Storage is never limited by
   * tier: every record stays on the device, so upgrading opens a full history
   * instead of an empty radar (docs/research/BUSINESS-VALUE-2026-11.md §1).
   */
  historyViewDays: number | 'unlimited';
  /** Personal Edge Graph. */
  edgeGraph: boolean;
  /** Edge Timeline depth. */
  edgeTimeline: 'limited' | 'full';
  /** Replay insights depth. */
  replayInsights: 'basic' | 'advanced';
  /** Edge Detector alerts. */
  detectorAlerts: boolean;
  /** External alert bridge (TradingView webhook → decision flow). */
  externalAlertBridge: boolean;
  /** Advanced AI insights. */
  advancedInsights: boolean;
  /** Multi-mode session archive. */
  sessionArchive: 'limited' | 'full';
  /** Export capability. */
  exportEnabled: boolean;
}

/** Subscription tier configuration. */
export interface TierConfig {
  /** Tier identifier. */
  id: SubscriptionTier;
  /** Display name. */
  name: string;
  /** Feature access. */
  features: TierFeatures;
}

/**
 * Free tier configuration.
 *
 * 🔴 The whole decision-record loop is free: alert → timer → judgement →
 * outcome. That loop is the north star AND the raw material every Premium
 * insight is built from — locking its entry (the alert bridge) or deleting
 * its history meant free users could never produce what Premium sells
 * (founder 2026-11-22, docs/research/BUSINESS-VALUE-2026-11.md §1).
 * Free limits the depth of longitudinal analysis, never the loop itself.
 */
export const FREE_TIER: TierConfig = {
  id: 'free',
  name: 'Free',
  features: {
    dailyScanLimit: 'unlimited',
    edgeScore: true,
    basicInsight: true,
    historyViewDays: 30,
    edgeGraph: false,
    edgeTimeline: 'limited',
    replayInsights: 'basic',
    detectorAlerts: false,
    externalAlertBridge: true,
    advancedInsights: false,
    sessionArchive: 'limited',
    exportEnabled: true, // Privacy controls never paywalled
  },
};

/**
 * Premium tier configuration.
 * Unlocks longitudinal intelligence, not basic trust.
 */
export const PREMIUM_TIER: TierConfig = {
  id: 'premium',
  name: 'Premium',
  features: {
    dailyScanLimit: 'unlimited',
    edgeScore: true,
    basicInsight: true,
    historyViewDays: 'unlimited',
    edgeGraph: true,
    edgeTimeline: 'full',
    replayInsights: 'advanced',
    detectorAlerts: true,
    externalAlertBridge: true,
    advancedInsights: true,
    sessionArchive: 'full',
    exportEnabled: true,
  },
};

/** All tier configs. */
export const SUBSCRIPTION_TIERS: Record<SubscriptionTier, TierConfig> = {
  free: FREE_TIER,
  premium: PREMIUM_TIER,
};

/** Billing cadence options for premium. */
export const BILLING_CADENCES: Record<BillingCadence, { label: string; discount?: string }> = {
  monthly: { label: 'Monthly' },
  yearly: { label: 'Yearly', discount: 'Save ~20%' },
};

/**
 * Checks whether a specific feature is available for a given tier.
 *
 * @param tier - The subscription tier.
 * @param feature - The feature key to check.
 * @returns True if the feature is available.
 */
export function hasFeature(
  tier: SubscriptionTier,
  feature: keyof TierFeatures
): boolean {
  const config = SUBSCRIPTION_TIERS[tier];
  const value = config.features[feature];

  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value > 0;
  if (value === 'unlimited' || value === 'full' || value === 'advanced') return true;
  return false;
}
