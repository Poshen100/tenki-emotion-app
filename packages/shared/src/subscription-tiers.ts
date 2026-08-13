/**
 * @module subscription-tiers
 * @description v3 Subscription model — Free / Pro (two tiers only), with
 * monthly and yearly billing cadences on the paid tier.
 *
 * Scanning is unlimited on both tiers. That is a deliberate growth decision,
 * not generosity: every free scan deepens that user's own baseline, produces a
 * potential label, and (when opted in) pushes a benchmark cohort closer to its
 * k threshold. Charging per scan would mean charging users to build the moat,
 * and scans cost nothing to serve — the engine runs on-device.
 *
 * The line between tiers is time and derived intelligence, never measurement
 * fidelity. The free Edge Score uses all eight dimensions and the full baseline
 * engine; a deliberately degraded free score would teach users the product does
 * not work, and accuracy is the trust foundation of a health app.
 *
 * @version 3.1 — Unlimited free scanning; Premium renamed Pro (id unchanged).
 * @see ANTIGRAVITY.md §12
 * @see docs/GROWTH-ARCHITECTURE.md §7
 */

import type { SubscriptionTier, BillingCadence } from '../../engine/src/common/types';

export type { SubscriptionTier, BillingCadence };

/** Feature access configuration per tier. */
export interface TierFeatures {
  /**
   * Daily scan limit. 'unlimited' on both tiers — scanning is on the
   * never-paywall list. The field is kept rather than deleted so a limit can
   * be reintroduced if abuse ever appears, but it is not a tier differentiator.
   *
   * @see ANTIGRAVITY.md §12.2
   */
  dailyScanLimit: number | 'unlimited';
  /** Edge Score access. */
  edgeScore: boolean;
  /** Basic readiness insight. */
  basicInsight: boolean;
  /** Guest mode local history limit (days). */
  localHistoryDays: number | 'unlimited';
  /** Personal Edge Graph. */
  edgeGraph: boolean;
  /** Edge Prediction. */
  edgePrediction: boolean;
  /** Edge Timeline depth. */
  edgeTimeline: 'limited' | 'full';
  /** Replay insights depth. */
  replayInsights: 'basic' | 'advanced';
  /**
   * Live Edge Detector alerts — the app taps you on the shoulder the moment a
   * clear window opens. This is the proactive axis and the single strongest
   * conversion surface in the product.
   */
  detectorAlerts: boolean;
  /**
   * End-of-day recap of the windows the detector observed. True on every tier:
   * the free version runs the detector silently and reports afterwards, which
   * demonstrates value that already happened to that user rather than
   * advertising a feature they have never seen.
   */
  detectorDailyRecap: boolean;
  /** External alert bridge (TradingView webhook → decision flow). */
  externalAlertBridge: boolean;
  /** Anonymous benchmarks. */
  benchmarks: boolean;
  /** Advanced AI insights. */
  advancedInsights: boolean;
  /**
   * AI Coach depth. 'basic' is the P1 template set; 'advanced' adds the
   * correlation and personal-model phases.
   */
  aiCoach: 'basic' | 'advanced';
  /**
   * Shareable Edge Snapshot card. True on every tier — this is a growth
   * surface, not a premium feature, and it is on the never-paywall list.
   *
   * @see ANTIGRAVITY.md §12.2
   */
  edgeSnapshot: boolean;
  /**
   * Access to every scenario mode (Focus, Performance, Trader) and their
   * templates. Free is Health Reset only — the context axis, not a limit on
   * the engine, which is identical across modes.
   */
  allScenarioModes: boolean;
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
 * Free tier configuration — "know where you are".
 *
 * Full-fidelity measurement with no quota, plus seven days of history. What it
 * withholds is the compounding half: depth of history, derived patterns,
 * comparison, and proactive alerting.
 */
export const FREE_TIER: TierConfig = {
  id: 'free',
  name: 'Free',
  features: {
    dailyScanLimit: 'unlimited', // Never paywalled — see module doc
    edgeScore: true,
    basicInsight: true,
    localHistoryDays: 7,
    edgeGraph: false,
    edgePrediction: false,
    edgeTimeline: 'limited',
    replayInsights: 'basic',
    detectorAlerts: false,
    detectorDailyRecap: true, // Detector runs silently, reports at end of day
    externalAlertBridge: false,
    benchmarks: false,
    advancedInsights: false,
    aiCoach: 'basic',
    edgeSnapshot: true, // Growth surface — sharing is never paywalled
    allScenarioModes: false,
    sessionArchive: 'limited',
    exportEnabled: true, // Privacy controls never paywalled
  },
};

/**
 * Pro tier configuration — "know how you work".
 *
 * Unlocks longitudinal intelligence, not basic trust. The tier id stays
 * `premium` so stored subscription state and receipts need no migration; only
 * the display name is Pro.
 */
export const PREMIUM_TIER: TierConfig = {
  id: 'premium',
  name: 'Pro',
  features: {
    dailyScanLimit: 'unlimited',
    edgeScore: true,
    basicInsight: true,
    localHistoryDays: 'unlimited',
    edgeGraph: true,
    edgePrediction: true,
    edgeTimeline: 'full',
    replayInsights: 'advanced',
    detectorAlerts: true,
    detectorDailyRecap: true,
    externalAlertBridge: true,
    benchmarks: true,
    advancedInsights: true,
    aiCoach: 'advanced',
    edgeSnapshot: true,
    allScenarioModes: true,
    sessionArchive: 'full',
    exportEnabled: true,
  },
};

/** All tier configs. */
export const SUBSCRIPTION_TIERS: Record<SubscriptionTier, TierConfig> = {
  free: FREE_TIER,
  premium: PREMIUM_TIER,
};

/** Display configuration for one billing cadence. */
export interface BillingCadenceConfig {
  /** Display label. */
  label: string;
  /**
   * List price in USD, for display only.
   *
   * App Store Connect and Google Play are the authoritative source of what a
   * user is actually charged. Anything read from here is a label on a screen,
   * never a basis for entitlement — otherwise a price change in the store
   * silently disagrees with the app.
   */
  priceUsd: number;
  /** Savings badge, where one applies. */
  discount?: string;
}

/**
 * Billing cadence options for the paid tier.
 *
 * Yearly is $89.99 rather than a straight 20% off $119.88. Twelve months at
 * $9.99 is $119.88; a ~20% cut lands on $95.99, which reads as an awkward
 * number. $89.99 is a cleaner anchor at roughly 25% off and still under the
 * $90 threshold.
 */
export const BILLING_CADENCES: Record<BillingCadence, BillingCadenceConfig> = {
  monthly: { label: 'Monthly', priceUsd: 9.99 },
  yearly: { label: 'Yearly', priceUsd: 89.99, discount: 'Save ~25%' },
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
