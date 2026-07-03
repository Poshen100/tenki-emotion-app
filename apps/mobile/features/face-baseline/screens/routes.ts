/**
 * @module face-baseline/screens/routes
 * @description Canonical expo-router paths for the Face Baseline flow. Screens
 * reference these constants so navigation stays decoupled from string literals.
 */

import type { EntryContext } from '../types/faceBaseline.types';

const BASE = '/face-baseline' as const;

/** Onboarding completion route — lives outside the face-baseline stack. */
export const ONBOARDING_COMPLETE_ROUTE = '/onboarding/complete' as const;

/**
 * Daily-scan reveal route — the existing result screen (今日內在天氣) that
 * renders the Edge Score / Zone from the scan store. Lives outside the
 * face-baseline stack; daily refinement scans exit processing directly here.
 */
export const DAILY_RESULT_ROUTE = '/scan/result' as const;

export const FB_ROUTES = {
  intro: BASE,
  why: `${BASE}/why`,
  secure: `${BASE}/secure`,
  environment: `${BASE}/environment`,
  faceLock: `${BASE}/face-lock`,
  captureNeutral: `${BASE}/capture-neutral`,
  captureArc: `${BASE}/capture-arc`,
  captureStability: `${BASE}/capture-stability`,
  processing: `${BASE}/processing`,
  recovery: `${BASE}/recovery`,
  established: `${BASE}/established`,
  maturity: `${BASE}/maturity`,
} as const;

export type FbRoute = (typeof FB_ROUTES)[keyof typeof FB_ROUTES];

/**
 * Where the established (success) screen exits to, based on how the ceremony
 * was entered: back into onboarding when it was the onboarding baseline, or the
 * standalone maturity loop otherwise.
 */
export function establishedExitRoute(
  entryContext: EntryContext,
): typeof ONBOARDING_COMPLETE_ROUTE | typeof FB_ROUTES.maturity {
  return entryContext === 'onboarding' ? ONBOARDING_COMPLETE_ROUTE : FB_ROUTES.maturity;
}
