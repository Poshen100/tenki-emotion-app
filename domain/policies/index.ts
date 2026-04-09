/**
 * @module domain/policies
 * @description Governance and business rules for scan operations.
 * Implements the rules defined in TENKI CORE v3 Rules.
 *
 * @version 3.0
 */

import { BaselineProfile, SessionState } from '@tenki/engine';
import { ScanRecord, EvaluationSession } from '../schemas';

const POLICY_LIMITS = {
  MAX_DAILY_SCANS_FREE: 2,
  MAX_DAILY_SCANS_PREMIUM: 10,
  MIN_TIME_BETWEEN_SCANS_MS: 30 * 60 * 1000, // 30 minutes
};

export class ScanLimiterPolicy {
  /**
   * Checks if user has exhausted their daily scan quota.
   */
  static canScanToday(
    todaySessionCount: number, 
    tier: 'free' | 'premium'
  ): boolean {
    const limit = tier === 'premium' 
      ? POLICY_LIMITS.MAX_DAILY_SCANS_PREMIUM 
      : POLICY_LIMITS.MAX_DAILY_SCANS_FREE;
    return todaySessionCount < limit;
  }

  /**
   * Prevents back-to-back spam scanning.
   */
  static hasPassedCooldown(lastScanTime: number, now: number): boolean {
    if (!lastScanTime) return true;
    return (now - lastScanTime) >= POLICY_LIMITS.MIN_TIME_BETWEEN_SCANS_MS;
  }
}

export class MaturityPolicy {
  /**
   * Ensures UI gating logic understands when to lock features based on baseline maturity.
   */
  static isEligibleForInsights(maturity: BaselineProfile['maturity']): boolean {
    return maturity === 'ready' || maturity === 'mature';
  }
}
