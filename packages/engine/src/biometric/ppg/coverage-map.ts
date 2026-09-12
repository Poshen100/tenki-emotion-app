/**
 * @module biometric/ppg/coverage-map
 * @description WHERE the fingertip is not covering the lens.
 *
 * 🔴 Why a map and not the camera preview: the old onboarding
 * (`apps/preview/index.html`) showed the live rear-camera feed inside a target
 * ring. That framing is worth reusing; the video is not. A lens that is
 * *properly* covered shows a uniform red field — you cannot see a gap in it,
 * because a gap is a few pixels at one edge that are slightly less red. The
 * scalar `coverage` the gate reads knows a gap exists but not where, and
 * 「蓋滿一點」 leaves the user guessing which edge.
 *
 * 🔴 The load-bearing property: **the map and the gate cannot disagree.**
 * `coverage` here is the pixel-weighted mean of the same per-cell counts the
 * cells are drawn from, so it is arithmetically the whole-ROI fraction
 * `assessFrameComponents` sees. A map that says "all covered" beside a gate
 * that says 40% would be worse than no map at all.
 *
 * ⚠️ Cells are a SQUARE grid because the measured ROI is a square crop
 * (`ROI_FRACTION` of the shorter side). Drawing the map as a circle — which is
 * what the lens looks like — would leave the corner cells unshown while the
 * gate still counts them.
 *
 * 🔴 Privacy: cell fractions are derived scalars computed per frame for the
 * live surface and thrown away with the frame. They are deliberately NOT part
 * of `PpgFrame`, never reach the analysis chain, and are never persisted —
 * `docs/PHONE-PPG.md` §18. A 4×4 grid of coverage fractions is not an image,
 * and the way to keep it that way is to never give it somewhere to be stored.
 *
 * @see docs/PHONE-PPG.md
 */

import { MIN_COVERAGE } from './quality';

/**
 * Cells per side.
 *
 * ⚠️ Chosen against the sampler, not for looks: the page reduces the ROI to a
 * 64×64 canvas, so 4 cells a side is 16×16 = 256 pixels per cell — enough for
 * the fraction to mean something. A finer grid looks more precise and is not:
 * at 6 a side each cell is ~10 px across.
 */
export const COVERAGE_MAP_GRID = 4;

/**
 * Coverage a single cell needs to count as covered.
 *
 * Reuses the gate's own floor rather than inventing a second one — a cell the
 * map calls covered must be a cell that would pass if the whole ROI looked
 * like it.
 */
export const CELL_COVERED_FRACTION = MIN_COVERAGE;

/** Sides of the ROI, for naming where the light is getting in. */
export const COVERAGE_EDGES = ['top', 'bottom', 'left', 'right'] as const;

export type CoverageEdge = typeof COVERAGE_EDGES[number];

/** One cell of the map. */
export interface CoverageCell {
  /** Row from the top, 0-based. */
  row: number;
  /** Column from the left, 0-based. */
  col: number;
  /** Fraction of this cell's pixels under the fingertip, 0..1. */
  fraction: number;
  /** True when this cell alone clears `CELL_COVERED_FRACTION`. */
  covered: boolean;
}

/** Where the fingertip is and is not. */
export interface CoverageMap {
  /** Cells per side. */
  grid: number;
  /** Row-major, `grid * grid` of them. */
  cells: CoverageCell[];
  /**
   * Whole-ROI coverage, 0..1.
   *
   * 🔴 The pixel-weighted mean of `cells` — the same number the gate reads.
   * Not a separate estimate.
   */
  coverage: number;
  /** How many cells are not covered. */
  uncoveredCount: number;
  /**
   * The side(s) leaking worst. Empty when nothing leaks.
   *
   * One entry means one edge; two means a corner. Edges that only pick up a
   * shared corner cell are dropped — see the note in `buildCoverageMap`.
   */
  gapEdges: CoverageEdge[];
  /** True when uncovered cells exist but none of them touch an edge. */
  centreGap: boolean;
}

/**
 * Builds the map from per-cell coverage fractions.
 *
 * @param cellFractions - Row-major coverage fraction per cell, one per cell of
 *   a square grid. Every cell must cover the same pixel count, which the
 *   sampler guarantees by dividing a square canvas evenly.
 * @returns Where the fingertip is, and the whole-ROI coverage implied by it.
 * @throws RangeError when the array is not a non-empty perfect square.
 */
export function buildCoverageMap(cellFractions: readonly number[]): CoverageMap {
  const grid = Math.round(Math.sqrt(cellFractions.length));
  if (cellFractions.length === 0 || grid * grid !== cellFractions.length) {
    throw new RangeError(
      `coverage map needs a square number of cells, got ${cellFractions.length}`,
    );
  }

  const cells: CoverageCell[] = cellFractions.map((fraction, index) => ({
    row: Math.floor(index / grid),
    col: index % grid,
    fraction,
    covered: fraction >= CELL_COVERED_FRACTION,
  }));

  const uncovered = cells.filter((cell) => !cell.covered);

  // Equal cell areas make the pixel-weighted mean a plain mean. Stated rather
  // than assumed: an uneven grid would need the counts passed in.
  const coverage = cellFractions.reduce((sum, f) => sum + f, 0) / cellFractions.length;

  const last = grid - 1;
  const edgeCounts: Array<{ edge: CoverageEdge; count: number }> = [
    { edge: 'top', count: uncovered.filter((c) => c.row === 0).length },
    { edge: 'bottom', count: uncovered.filter((c) => c.row === last).length },
    { edge: 'left', count: uncovered.filter((c) => c.col === 0).length },
    { edge: 'right', count: uncovered.filter((c) => c.col === last).length },
  ];

  // ⚠️ Only the edges tied at the WORST count. Corner cells belong to two
  // edges, so a bare top row also puts one uncovered cell on the left edge and
  // one on the right — reporting all three is arithmetically true and useless
  // as an instruction (「上、左、右都在漏」 when the fix is "move up"). Keeping
  // the maximum leaves one edge for a single leaking side and two for a real
  // corner, which is exactly the distinction the user has to act on.
  const worst = Math.max(...edgeCounts.map((e) => e.count));
  const gapEdges =
    worst === 0 ? [] : edgeCounts.filter((e) => e.count === worst).map((e) => e.edge);

  return {
    grid,
    cells,
    coverage,
    uncoveredCount: uncovered.length,
    gapEdges,
    centreGap: uncovered.length > 0 && gapEdges.length === 0,
  };
}
