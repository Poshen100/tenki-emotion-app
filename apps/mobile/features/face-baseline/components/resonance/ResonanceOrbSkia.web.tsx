/**
 * Web resolves the shared no-canvas orb. The same component backs Expo Go via
 * `ResonanceOrbSkia.native.tsx`, so there is one fallback rather than two.
 */
export { ResonanceOrbFallback as ResonanceOrbSkia } from './ResonanceOrbFallback';
