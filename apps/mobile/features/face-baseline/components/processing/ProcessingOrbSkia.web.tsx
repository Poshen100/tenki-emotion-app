/**
 * Web resolves the shared no-canvas orb. The same component backs Expo Go via
 * `ProcessingOrbSkia.native.tsx`, so there is one fallback rather than two.
 */
export { ProcessingOrbFallback as ProcessingOrbSkia } from './ProcessingOrbFallback';
