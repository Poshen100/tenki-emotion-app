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
  /**
   * Daily scan limit.
   *
   * 🔴 **兩層都是 `'unlimited'`（founder 2026-08-11 拍板：限深度，不限次數）。**
   * 欄位留著是因為它是契約的一部分，未來若要對濫用設上限有地方掛 ——
   * 但**不是**用來當付費槓桿。
   *
   * 理由是量出來的，不是慷慨：掃描全在裝置上算，邊際成本是零；
   * 而每一次掃描都讓 personal baseline 更準（Welford bootstrap →
   * baseline maturity `new/building/ready/mature`）。限制次數 = 延後 baseline
   * 成熟 = 延後使用者第一次看到「今天跟你平常不一樣」的那一天，
   * 而那一刻正是唯一有說服力的轉換點。**那是拿護城河換一點點施壓。**
   *
   * 付費槓桿改放在**深度**：跟自己基線的落差、趨勢、決策迴圈、進階洞察。
   * 「今天是 Clear」不太可行動；「你今天比你自己的基線低」才是產品。
   *
   * ⚠️ 另見 `ANTIGRAVITY.md` §12.2「基本掃描能力不得付費牆」——
   * 舊值 `1` 其實跟那條規則就是打架的。
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
  /** Edge Detector alerts. */
  detectorAlerts: boolean;
  /** External alert bridge (TradingView webhook → decision flow). */
  externalAlertBridge: boolean;
  /** Anonymous benchmarks. */
  benchmarks: boolean;
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
 * Provides enough utility to build habit, but limits intelligence depth.
 */
export const FREE_TIER: TierConfig = {
  id: 'free',
  name: 'Free',
  features: {
    dailyScanLimit: 'unlimited', // 量測不設限，槓桿放在深度（見 TierFeatures）
    edgeScore: true,
    basicInsight: true,
    localHistoryDays: 7,
    edgeGraph: false,
    edgePrediction: false,
    edgeTimeline: 'limited',
    replayInsights: 'basic',
    detectorAlerts: false,
    externalAlertBridge: false,
    benchmarks: false,
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
    localHistoryDays: 'unlimited',
    edgeGraph: true,
    edgePrediction: true,
    edgeTimeline: 'full',
    replayInsights: 'advanced',
    detectorAlerts: true,
    externalAlertBridge: true,
    benchmarks: true,
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
