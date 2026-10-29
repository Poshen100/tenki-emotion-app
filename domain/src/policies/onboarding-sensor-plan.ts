/**
 * @module domain/policies/onboarding-sensor-plan
 * @description Which baselines a new user is asked to build, and why.
 *
 * The two references measure different things and are not alternatives. The
 * face baseline is Soul Scan's reference — landmark geometry and expression
 * stability. The finger capture is the **resting pulse** reference.
 *
 * 🔴 This rationale was rewritten, and the rewrite matters. It used to read:
 * "the finger baseline is the HRV reference … HRV is 25 points and the stress
 * proxy another 15, so 40% of the Edge Score". That justification is **no
 * longer true**: camera HRV is withheld (`camera_hrv_estimates`, default off,
 * see docs/PHONE-PPG.md §10), so the camera is not an HRV source at all. A
 * phone-only user loses those two drivers whether or not they do the finger
 * capture — the Edge Score excludes them and renormalises over the rest, which
 * is the honest behaviour and already implemented.
 *
 * What the finger capture actually buys, in numbers: `hrStability` is 15 points
 * of the Edge Score, and a fingertip pulse is a far better source for it than a
 * face scan's — the repo's own source ranking puts `camera` (45) below
 * `finger_scan` (60). That is the whole claim now. It is smaller than the old
 * one, and it is true.
 *
 * founder decision, 2026-09-11: for a phone-only user the finger capture joins
 * the onboarding path. The daily entry point is still the face scan
 * (`docs/SOUL-SCAN-NORTH-STAR.md` §1).
 */

import type { BiometricSourcePlatform } from '../contracts/wearable-sample';

/**
 * A reference a user can be asked to establish during onboarding.
 *
 * ⚠️ `finger_pulse_baseline` was `finger_hrv_baseline`. The camera does not
 * report HRV, so the old id named something the step cannot do.
 */
export const BASELINE_STEPS = ['face_baseline', 'finger_pulse_baseline'] as const;
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
  /**
   * No connected source can supply a resting pulse reference, so the camera is
   * the only route to one.
   *
   * ⚠️ Was `only_hrv_source`, which is now false — the camera supplies no HRV.
   */
  | 'only_pulse_reference'
  /** A connected wearable already supplies resting heart rate (and HRV). */
  | 'wearable_supplies_hrv';

/** The baselines this user is asked to build, in order. */
export interface OnboardingBaselinePlan {
  steps: BaselineStepId[];
  /** Present whether or not the step is included — it explains both outcomes. */
  fingerRationale: FingerStepRationale;
  /**
   * Whether the finger step may be skipped. Always true: a reference built by a
   * user who was cornered into it is a reference built badly, and the honest
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
    steps: wearableHasHrv ? ['face_baseline'] : ['face_baseline', 'finger_pulse_baseline'],
    fingerRationale: wearableHasHrv ? 'wearable_supplies_hrv' : 'only_pulse_reference',
    fingerSkippable: true,
  };
}

/**
 * Score drivers a phone-only user has no input for.
 *
 * 🔴 The finger capture does **not** recover these. The camera reports no HRV,
 * so for a user with no wearable these two drivers are excluded from every
 * reading and the remaining weight is renormalised (`scoring/edge-score.ts`).
 * Only a chest strap or a platform HRV source brings them back.
 */
export const DRIVERS_LOST_WITHOUT_HRV = [
  'hrv_vs_baseline',
  'stress_proxy_vs_baseline',
] as const;

/**
 * Combined Edge Score weight of the drivers that have no input without an HRV
 * source. Mirrors `EDGE_WEIGHTS.hrvVsBaseline + stressProxyVsBaseline` in
 * `packages/engine/src/scoring/types.ts`, which is canonical — `domain` is the
 * lower layer and does not depend on the engine.
 */
export const EDGE_WEIGHT_WITHOUT_HRV = 40;

/**
 * Edge Score weight the finger capture actually improves: `hrStability`.
 *
 * Mirrors `EDGE_WEIGHTS.hrStability`. This — not the 40 above — is what the
 * finger step buys a phone-only user, and it is the number its copy may quote.
 */
export const EDGE_WEIGHT_FROM_PULSE_REFERENCE = 15;
