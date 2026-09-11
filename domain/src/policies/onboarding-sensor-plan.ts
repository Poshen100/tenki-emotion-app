/**
 * @module domain/policies/onboarding-sensor-plan
 * @description Which baselines a new user is asked to build, and why.
 *
 * The two baselines measure different things and are not alternatives. The
 * face baseline is Soul Scan's reference — landmark geometry and expression
 * stability. The finger baseline is the HRV reference. A user who builds only
 * the first has no reference point for the metric that carries the most weight
 * in the Edge Score.
 *
 * 🔴 Why this policy exists, in numbers: HRV is worth 25 points of the Edge
 * Score and the stress proxy — another 15 — reads HRV too. **40% of the score.**
 * For someone with no wearable, finger PPG is the only source for it: the
 * repo's own source ranking already puts `camera` (45) below `finger_scan`
 * (60). A phone-only user without a finger baseline has those drivers excluded
 * from every reading, permanently. Measured, such a user's score sits at a
 * standard deviation of 1.0 — steady, and carrying almost no information.
 *
 * founder decision, 2026-09-11: when no wearable can supply HRV, the finger
 * baseline joins the onboarding path. The daily entry point is still the face
 * scan (`docs/SOUL-SCAN-NORTH-STAR.md` §1).
 */

import type { BiometricSourcePlatform } from '../contracts/wearable-sample';

/** A baseline a user can be asked to build during onboarding. */
export const BASELINE_STEPS = ['face_baseline', 'finger_hrv_baseline'] as const;
export type BaselineStepId = typeof BASELINE_STEPS[number];

/**
 * Platforms that can supply an HRV value on their own.
 *
 * `ble_chest` is included because a strap that reports RR intervals yields
 * HRV — but only then, which the link itself cannot promise, so a connected
 * strap is treated as a source here and the actual HRV is still gated by
 * `beat-series.ts`. `garmin_api` is second-wave and supplies nothing yet.
 */
const HRV_CAPABLE_PLATFORMS: readonly BiometricSourcePlatform[] = [
  'healthkit',
  'health_connect',
  'ble_chest',
];

/** What TENKI knows about the user's connected sources at onboarding time. */
export interface ConnectedSourceSnapshot {
  /** Platforms the user has actually granted access to. */
  connectedPlatforms: readonly BiometricSourcePlatform[];
}

/** Why the finger step is or is not part of the plan. */
export type FingerStepRationale =
  /** No connected source can supply HRV, so the camera is the only route to it. */
  | 'only_hrv_source'
  /** A connected wearable already supplies HRV. */
  | 'wearable_supplies_hrv';

/** The baselines this user is asked to build, in order. */
export interface OnboardingBaselinePlan {
  steps: BaselineStepId[];
  /** Present whether or not the step is included — it explains both outcomes. */
  fingerRationale: FingerStepRationale;
  /**
   * Whether the finger step may be skipped. Always true: a baseline built by a
   * user who was cornered into it is a baseline built badly, and the honest
   * move is to say what skipping costs rather than to remove the door.
   */
  fingerSkippable: boolean;
}

/**
 * Whether any connected platform can supply HRV.
 *
 * @param snapshot - The user's connected sources.
 * @returns True when at least one can.
 */
export function hasHrvCapableSource(snapshot: ConnectedSourceSnapshot): boolean {
  return snapshot.connectedPlatforms.some((platform) =>
    HRV_CAPABLE_PLATFORMS.includes(platform),
  );
}

/**
 * Plans the baselines for a new user.
 *
 * The face baseline is always first and always present — it is the daily
 * scan's reference point, and nothing about the finger path replaces it.
 *
 * @param snapshot - What is connected at onboarding time.
 * @returns The ordered plan, with the reasoning attached.
 */
export function planOnboardingBaselines(
  snapshot: ConnectedSourceSnapshot,
): OnboardingBaselinePlan {
  const wearableHasHrv = hasHrvCapableSource(snapshot);

  return {
    steps: wearableHasHrv ? ['face_baseline'] : ['face_baseline', 'finger_hrv_baseline'],
    fingerRationale: wearableHasHrv ? 'wearable_supplies_hrv' : 'only_hrv_source',
    fingerSkippable: true,
  };
}

/** Score drivers that go unmeasured without an HRV reference. */
export const DRIVERS_LOST_WITHOUT_HRV = [
  'hrv_vs_baseline',
  'stress_proxy_vs_baseline',
] as const;

/**
 * Combined Edge Score weight of the drivers that have no input without an HRV
 * baseline. Mirrors `EDGE_WEIGHTS.hrvVsBaseline + stressProxyVsBaseline` in
 * `packages/engine/src/scoring/types.ts`, which is canonical — `domain` is the
 * lower layer and does not depend on the engine.
 */
export const EDGE_WEIGHT_WITHOUT_HRV = 40;
