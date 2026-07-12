/**
 * @module shared/feature-flags
 * @description Feature flag system for v3 dark launch.
 * Controls visibility of unfinished or unreleased features.
 * Critical for App Store review — reviewer_demo_mode enables sample data.
 *
 * @version 3.0
 * @see ANTIGRAVITY.md v3.0 Section 13
 */

import type { FeatureFlagId } from '../../../engine/src/common/types';

/** Feature flag definition. */
export interface FeatureFlagDef {
  /** Flag identifier. */
  id: FeatureFlagId;
  /** Human-readable name. */
  name: string;
  /** Description. */
  description: string;
  /** Default value. */
  defaultValue: boolean;
  /** Whether this flag can be overridden by remote config. */
  remoteConfigurable: boolean;
}

/** All feature flag definitions. */
export const FEATURE_FLAGS: Record<FeatureFlagId, FeatureFlagDef> = {
  edge_score_v3: {
    id: 'edge_score_v3',
    name: 'Edge Score v3',
    description: 'Enable new 8-factor Decision Edge Score engine.',
    defaultValue: true,
    remoteConfigurable: false,
  },
  session_governance_v3: {
    id: 'session_governance_v3',
    name: 'Session Governance v3',
    description: 'Enable new 10-state session governance system.',
    defaultValue: true,
    remoteConfigurable: false,
  },
  scan_pipeline_v1: {
    id: 'scan_pipeline_v1',
    name: 'Scan Pipeline v1',
    description: 'Enable Finger Heat Zone camera scan pipeline.',
    defaultValue: false,
    remoteConfigurable: true,
  },
  lab_prediction: {
    id: 'lab_prediction',
    name: 'Lab Prediction',
    description: 'Enable pattern forecast and prediction cards in Lab.',
    defaultValue: false,
    remoteConfigurable: true,
  },
  benchmark_opt_in: {
    id: 'benchmark_opt_in',
    name: 'Benchmark Opt-in',
    description: 'Enable anonymous benchmark comparisons.',
    defaultValue: false,
    remoteConfigurable: true,
  },
  reviewer_demo_mode: {
    id: 'reviewer_demo_mode',
    name: 'Reviewer Demo Mode',
    description: 'Enable demo mode with sample data for App Store review.',
    defaultValue: false,
    remoteConfigurable: false,
  },
  tradingview_alerts_v1: {
    id: 'tradingview_alerts_v1',
    name: 'TradingView Alert Bridge v1',
    description: 'Enable external alert ingestion into the decision flow.',
    defaultValue: false,
    remoteConfigurable: true,
  },
} as const;

/** Runtime feature flag state. */
export type FeatureFlagState = Record<FeatureFlagId, boolean>;

/**
 * Creates default feature flag state from definitions.
 *
 * @returns FeatureFlagState with all defaults applied.
 */
export function createDefaultFlags(): FeatureFlagState {
  const state: Partial<FeatureFlagState> = {};
  for (const [id, def] of Object.entries(FEATURE_FLAGS)) {
    state[id as FeatureFlagId] = def.defaultValue;
  }
  return state as FeatureFlagState;
}

/**
 * Checks if a feature is enabled.
 *
 * @param flags - Current feature flag state.
 * @param flagId - The flag to check.
 * @returns True if the feature is enabled.
 */
export function isFeatureEnabled(flags: FeatureFlagState, flagId: FeatureFlagId): boolean {
  return flags[flagId] === true;
}

/**
 * Applies remote config overrides to feature flags.
 * Only overrides flags marked as remoteConfigurable.
 *
 * @param current - Current feature flag state.
 * @param overrides - Remote config overrides.
 * @returns Updated feature flag state.
 */
export function applyRemoteOverrides(
  current: FeatureFlagState,
  overrides: Partial<Record<FeatureFlagId, boolean>>
): FeatureFlagState {
  const updated = { ...current };

  for (const [id, value] of Object.entries(overrides)) {
    const flagId = id as FeatureFlagId;
    if (FEATURE_FLAGS[flagId]?.remoteConfigurable && value !== undefined) {
      updated[flagId] = value;
    }
  }

  return updated;
}
