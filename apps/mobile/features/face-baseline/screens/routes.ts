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
 * Daily-scan reveal route — the Today tab, whose Edge Score ring renders the
 * fresh result from the scan store. (The standalone result screens — web
 * scan-result.html and RN app/scan/result.tsx — were both retired by founder
 * decision 2026-07-03: the reveal experience follows /preview/v6/. A v6-style
 * cinematic RN reveal is an Antigravity design task; until then Today IS the
 * reveal.)
 */
export const DAILY_RESULT_ROUTE = '/' as const;

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
