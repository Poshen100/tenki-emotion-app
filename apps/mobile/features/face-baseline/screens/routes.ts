/**
 * @module face-baseline/screens/routes
 * @description Canonical expo-router paths for the Face Baseline flow. Screens
 * reference these constants so navigation stays decoupled from string literals.
 */

const BASE = '/face-baseline' as const;

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
