/**
 * @module face-baseline/__tests__/orbPhysics
 * @description Tests for the orb's physics.
 *
 * The frame-rate independence tests are the ones worth having. A per-frame
 * lerp looks fine on the machine it was tuned on and then runs at a different
 * speed on a 120Hz phone or a throttled tab; stepping the same total time in
 * different sized chunks is the cheapest way to prove that cannot happen here.
 */
import {
  MAX_PARALLAX_PX,
  NO_TILT,
  RING_COUNT,
  advanceAngle,
  dampedApproach,
  parallaxOffset,
  ringGeometry,
  ringSpeeds,
} from '../utils/orbPhysics';
import type { SensoryFrame } from '../utils/choreography';

function frame(overrides: Partial<SensoryFrame> = {}): SensoryFrame {
  return {
    convergence: 0.5,
    scatter: 0.2,
    brightness: 0.7,
    glow: 0.5,
    transitionMs: 400,
    ...overrides,
  };
}

describe('dampedApproach', () => {
  it('halves the remaining gap over one half-life', () => {
    expect(dampedApproach(0, 1, 100, 100)).toBeCloseTo(0.5, 6);
  });

  it('reaches the same place regardless of step size', () => {
    // 400ms in one step, versus forty steps of 10ms.
    const oneStep = dampedApproach(0, 1, 400, 100);

    let many = 0;
    for (let i = 0; i < 40; i++) many = dampedApproach(many, 1, 10, 100);

    expect(many).toBeCloseTo(oneStep, 6);
  });

  it('converges toward the target without overshooting', () => {
    let v = 0;
    for (let i = 0; i < 200; i++) v = dampedApproach(v, 1, 16, 80);
    expect(v).toBeGreaterThan(0.99);
    expect(v).toBeLessThanOrEqual(1);
  });

  it('holds still when no time has passed', () => {
    expect(dampedApproach(0.3, 1, 0, 100)).toBe(0.3);
  });

  it('snaps when the half-life is zero', () => {
    expect(dampedApproach(0, 1, 16, 0)).toBe(1);
  });

  it('recovers from a non-finite current value', () => {
    expect(dampedApproach(Number.NaN, 0.5, 16, 100)).toBe(0.5);
  });
});

describe('ringSpeeds', () => {
  it('gives every ring a speed', () => {
    expect(ringSpeeds(frame())).toHaveLength(RING_COUNT);
  });

  it('counter-rotates adjacent rings', () => {
    const speeds = ringSpeeds(frame());
    for (let i = 1; i < speeds.length; i++) {
      expect(Math.sign(speeds[i])).toBe(-Math.sign(speeds[i - 1]));
    }
  });

  it('speeds up as the signal scatters', () => {
    const calm = ringSpeeds(frame({ scatter: 0 }))[0];
    const agitated = ringSpeeds(frame({ scatter: 1 }))[0];
    expect(Math.abs(agitated)).toBeGreaterThan(Math.abs(calm));
  });

  it('calms down as the orb converges', () => {
    const loose = ringSpeeds(frame({ convergence: 0, scatter: 0 }))[0];
    const settled = ringSpeeds(frame({ convergence: 1, scatter: 0 }))[0];
    expect(Math.abs(settled)).toBeLessThan(Math.abs(loose));
  });

  it('never stops entirely, even fully converged', () => {
    for (const s of ringSpeeds(frame({ convergence: 1, scatter: 0 }))) {
      expect(Math.abs(s)).toBeGreaterThan(0);
    }
  });
});

describe('advanceAngle', () => {
  it('wraps within a single turn', () => {
    const a = advanceAngle(6.2, 5, 1000);
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThan(Math.PI * 2);
  });

  it('wraps negative rotation into range', () => {
    const a = advanceAngle(0.1, -5, 1000);
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThan(Math.PI * 2);
  });

  it('advances the same total for one big step or many small ones', () => {
    const one = advanceAngle(0, 1, 500);
    let many = 0;
    for (let i = 0; i < 50; i++) many = advanceAngle(many, 1, 10);
    expect(many).toBeCloseTo(one, 9);
  });
});

describe('ringGeometry', () => {
  it('keeps radius, opacity and stroke in sane ranges for any frame', () => {
    for (const scatter of [0, 0.5, 1]) {
      for (const convergence of [0, 0.5, 1]) {
        for (let i = 0; i < RING_COUNT; i++) {
          const g = ringGeometry(i, frame({ scatter, convergence }), 1);
          expect(g.radiusRatio).toBeGreaterThan(0);
          expect(g.radiusRatio).toBeLessThanOrEqual(1.15);
          expect(g.opacity).toBeGreaterThanOrEqual(0);
          expect(g.opacity).toBeLessThanOrEqual(1);
          expect(g.strokeWidth).toBeGreaterThan(0);
          expect(g.blur).toBeGreaterThan(0);
        }
      }
    }
  });

  it('pushes rings outward as the signal scatters', () => {
    const calm = ringGeometry(0, frame({ scatter: 0, convergence: 0 }), 0.5);
    const blown = ringGeometry(0, frame({ scatter: 1, convergence: 0 }), 0.5);
    expect(blown.radiusRatio).toBeGreaterThan(calm.radiusRatio);
  });

  it('draws rings in as the orb converges', () => {
    const loose = ringGeometry(0, frame({ scatter: 0, convergence: 0 }), 0.5);
    const tight = ringGeometry(0, frame({ scatter: 0, convergence: 1 }), 0.5);
    expect(tight.radiusRatio).toBeLessThan(loose.radiusRatio);
  });

  it('moves outer rings more than inner ones', () => {
    const f = frame({ scatter: 1, convergence: 0 });
    const outerShift = ringGeometry(0, f, 0.5).radiusRatio - ringGeometry(0, frame({ scatter: 0, convergence: 0 }), 0.5).radiusRatio;
    const innerShift = ringGeometry(3, f, 0.5).radiusRatio - ringGeometry(3, frame({ scatter: 0, convergence: 0 }), 0.5).radiusRatio;
    expect(outerShift).toBeGreaterThan(innerShift);
  });

  it('thickens and brightens with maturity', () => {
    const young = ringGeometry(0, frame(), 0);
    const old = ringGeometry(0, frame(), 1);
    expect(old.strokeWidth).toBeGreaterThan(young.strokeWidth);
    expect(old.opacity).toBeGreaterThan(young.opacity);
  });

  it('clamps an out-of-range ring index rather than producing NaN', () => {
    const g = ringGeometry(99, frame(), 0.5);
    expect(Number.isFinite(g.radiusRatio)).toBe(true);
  });
});

describe('parallax', () => {
  it('is still when there is no tilt', () => {
    expect(parallaxOffset(NO_TILT, 0)).toEqual({ dx: 0, dy: 0 });
  });

  it('moves nearer rings further than deeper ones', () => {
    const near = parallaxOffset({ x: 1, y: 1 }, 0);
    const far = parallaxOffset({ x: 1, y: 1 }, 3);
    expect(Math.abs(near.dx)).toBeGreaterThan(Math.abs(far.dx));
  });

  it('never exceeds the pixel ceiling', () => {
    const extreme = parallaxOffset({ x: 99, y: -99 }, 0);
    expect(Math.abs(extreme.dx)).toBeLessThanOrEqual(MAX_PARALLAX_PX);
    expect(Math.abs(extreme.dy)).toBeLessThanOrEqual(MAX_PARALLAX_PX);
  });

  it('follows the sign of the tilt', () => {
    expect(parallaxOffset({ x: 1, y: 0 }, 0).dx).toBeGreaterThan(0);
    expect(parallaxOffset({ x: -1, y: 0 }, 0).dx).toBeLessThan(0);
  });
});
