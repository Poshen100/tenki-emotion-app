/**
 * Bundle entry for the browser preview.
 *
 * Re-exports ONLY the Edge Score symbols the preview reveal needs, so the
 * generated `engine-bundle.js` stays focused (no session/scan governance).
 *
 * Build: see `build:engine-bundle` in apps/preview/package.json.
 * The real engine in packages/engine/ remains the single source of truth —
 * this file imports it directly; it never re-implements the scoring math.
 */
export {
  calculateEdgeScore,
  classifyEdgeZone,
  getTimeBucket,
} from '../../packages/engine/src/scoring/edge-score';

export type { EdgeScoreInput } from '../../packages/engine/src/scoring/edge-score';

export {
  createEmptyBaselineProfile,
  createEmptyMetricBaseline,
  resolveTimeBucket,
  assessMaturity,
} from '../../packages/engine/src/baseline/baseline';
