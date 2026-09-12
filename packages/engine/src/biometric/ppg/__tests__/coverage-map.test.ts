/**
 * Where the fingertip is not covering the lens.
 *
 * 🔴 The load-bearing test is the agreement one: a map that disagrees with the
 * gate is worse than no map, because the user would be fixing a picture while
 * the gate reads something else.
 */
import { assessCaptureReadiness } from '../capture-readiness';
import {
  CELL_COVERED_FRACTION,
  COVERAGE_MAP_GRID,
  buildCoverageMap,
} from '../coverage-map';
import { assessFrameComponents } from '../quality';
import { synthesizePpg } from '../replay';

/** Cell fractions for a grid where `leaking` cells (by index) are bare. */
function cellsWith(leaking: readonly number[], grid = COVERAGE_MAP_GRID): number[] {
  return Array.from({ length: grid * grid }, (_, i) => (leaking.includes(i) ? 0.1 : 1));
}

describe('the map and the gate read the same number', () => {
  it('reports whole-ROI coverage as the mean of its own cells', () => {
    // 🔴 Not a second estimate. If this drifts, the picture and the bar beside
    // it start telling the user different things about the same finger.
    const fractions = [0.2, 0.4, 0.6, 0.8, 1, 1, 1, 1, 0.9, 0.9, 0.9, 0.9, 1, 1, 1, 0.5];
    const map = buildCoverageMap(fractions);
    const mean = fractions.reduce((s, f) => s + f, 0) / fractions.length;
    expect(map.coverage).toBeCloseTo(mean, 10);
  });

  it('lands on the same coverage the frame components do, for a real capture', () => {
    // The sampler divides one square canvas evenly, so the per-cell mean IS the
    // whole-ROI fraction. Modelled here by handing the map a uniform field at
    // the capture's own coverage.
    const frames = synthesizePpg({ durationSec: 5, coverage: 0.82 }).frames;
    const parts = assessFrameComponents(frames);
    const map = buildCoverageMap(
      Array.from({ length: COVERAGE_MAP_GRID ** 2 }, () => parts.coverage),
    );
    expect(map.coverage).toBeCloseTo(parts.coverage, 10);
  });

  it('agrees with the gate about whether the finger is on the lens at all', () => {
    const frames = synthesizePpg({ durationSec: 5, coverage: 0.1 }).frames;
    const parts = assessFrameComponents(frames);
    const map = buildCoverageMap(
      Array.from({ length: COVERAGE_MAP_GRID ** 2 }, () => parts.coverage),
    );
    expect(assessCaptureReadiness(frames, 0).blocker).toBe('no_contact');
    expect(map.uncoveredCount).toBe(COVERAGE_MAP_GRID ** 2);
  });
});

describe('the map says which side the light is getting in', () => {
  it('names one edge when one edge leaks', () => {
    // Top row of a 4×4 is indices 0-3. 「上緣還沒蓋到」 beats 「蓋滿一點」.
    expect(buildCoverageMap(cellsWith([0, 1, 2, 3])).gapEdges).toEqual(['top']);
    expect(buildCoverageMap(cellsWith([0, 4, 8, 12])).gapEdges).toEqual(['left']);
    expect(buildCoverageMap(cellsWith([3, 7, 11, 15])).gapEdges).toEqual(['right']);
    expect(buildCoverageMap(cellsWith([12, 13, 14, 15])).gapEdges).toEqual(['bottom']);
  });

  it('names two edges for a real corner, and one for a plain side', () => {
    // 🔴 The reason edges are not simply "every edge with an uncovered cell":
    // corner cells sit on two edges, so a bare top row (0-3) would report top,
    // left and right. The user needs "move up", not a list.
    expect(buildCoverageMap(cellsWith([0, 1, 2, 3])).gapEdges).toEqual(['top']);
    // A genuine top-left corner gap: 2 uncovered on top, 2 on left → both.
    expect(buildCoverageMap(cellsWith([0, 1, 4, 5])).gapEdges.sort()).toEqual(['left', 'top']);
    // Top leaking more than left drops left rather than ranking it second.
    expect(buildCoverageMap(cellsWith([0, 1, 2, 4])).gapEdges).toEqual(['top']);
  });

  it('says nothing about edges when the lens is covered', () => {
    const map = buildCoverageMap(cellsWith([]));
    expect(map.gapEdges).toEqual([]);
    expect(map.uncoveredCount).toBe(0);
    expect(map.centreGap).toBe(false);
  });

  it('distinguishes a gap that touches no edge', () => {
    // Index 5 is an interior cell of a 4×4. For a fingertip this means the
    // finger is arched off the glass rather than misplaced — different fix.
    const map = buildCoverageMap(cellsWith([5]));
    expect(map.gapEdges).toEqual([]);
    expect(map.centreGap).toBe(true);
  });
});

describe('the map refuses to be something it is not', () => {
  it('uses the gate’s own floor for a cell, not a second threshold', () => {
    const grid = COVERAGE_MAP_GRID;
    const justUnder = Array.from({ length: grid * grid }, () => CELL_COVERED_FRACTION - 0.01);
    const justOver = Array.from({ length: grid * grid }, () => CELL_COVERED_FRACTION);
    expect(buildCoverageMap(justUnder).uncoveredCount).toBe(grid * grid);
    expect(buildCoverageMap(justOver).uncoveredCount).toBe(0);
  });

  it('rejects a cell count that is not a square grid', () => {
    // Row/col would be meaningless, and a map with wrong geometry points the
    // user at the wrong edge.
    expect(() => buildCoverageMap([1, 1, 1])).toThrow(RangeError);
    expect(() => buildCoverageMap([])).toThrow(RangeError);
  });

  it('carries coverage only — no pixels, no colour, no image', () => {
    const cell = buildCoverageMap(cellsWith([0])).cells[0];
    expect(Object.keys(cell).sort()).toEqual(['col', 'covered', 'fraction', 'row']);
  });
});
