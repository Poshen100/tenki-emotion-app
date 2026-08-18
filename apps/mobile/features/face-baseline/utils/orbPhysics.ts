/**
 * @module face-baseline/utils/orbPhysics
 * @description The orb's physics — orbit speed, ring geometry, parallax and
 * damping, as pure functions.
 *
 * Same reasoning as `choreography.ts`: the rules that decide how the orb
 * *behaves* belong somewhere a test can reach without a device, a Mac, or a
 * Skia canvas. Components keep only the drawing.
 *
 * Everything here is frame-rate independent. {@link dampedApproach} takes a
 * real elapsed time rather than assuming 60fps, so the same motion plays back
 * identically on a 120Hz phone, a throttled background tab, and a jest test
 * stepping time by hand.
 *
 * @see apps/mobile/features/face-baseline/utils/choreography.ts
 */
import type { SensoryFrame } from './choreography';

// ─────────────────────────────────────────────
// Damping
// ─────────────────────────────────────────────

/**
 * Moves a value toward a target with exponential damping.
 *
 * `halfLifeMs` is the time for the remaining distance to halve, which is a
 * property of the material rather than of the frame rate — the reason this is
 * expressed as a half-life instead of a per-frame lerp factor.
 *
 * @param current - Where the value is now.
 * @param target - Where it is heading.
 * @param dtMs - Milliseconds elapsed since the last step.
 * @param halfLifeMs - Time for the gap to halve. Smaller is snappier.
 * @returns The stepped value.
 */
export function dampedApproach(
  current: number,
  target: number,
  dtMs: number,
  halfLifeMs: number,
): number {
  if (!Number.isFinite(current) || !Number.isFinite(target)) return target;
  if (dtMs <= 0) return current;
  if (halfLifeMs <= 0) return target;

  const k = 1 - 2 ** (-dtMs / halfLifeMs);
  return current + (target - current) * k;
}

// ─────────────────────────────────────────────
// Orbit
// ─────────────────────────────────────────────

/** Rings, outermost first. */
export const RING_COUNT = 4;

/** Base angular velocity in radians per second, per ring. */
const BASE_SPEEDS: readonly number[] = [0.9, -1.17, 1.44, -1.8];

/**
 * Angular velocity for each ring, in radians per second.
 *
 * Agitation speeds the rings up and convergence calms them down, so the orb
 * reads as settling rather than merely brightening as a capture succeeds. The
 * signs alternate so adjacent rings counter-rotate, which is what stops the
 * whole thing looking like a single spinning object.
 *
 * @param frame - Current sensory frame.
 * @returns Angular velocity per ring, radians per second.
 */
export function ringSpeeds(frame: SensoryFrame): number[] {
  // Scatter is agitation; convergence is calm. Their difference sets the tempo.
  const agitation = clamp01(frame.scatter);
  const calm = clamp01(frame.convergence);
  const tempo = 0.55 + agitation * 0.9 - calm * 0.25;

  return BASE_SPEEDS.map((base) => base * Math.max(0.2, tempo));
}

/**
 * Advances an angle by one step, wrapped to a single turn.
 *
 * @param angle - Current angle in radians.
 * @param speed - Angular velocity, radians per second.
 * @param dtMs - Milliseconds elapsed.
 * @returns The new angle, within 0..2π.
 */
export function advanceAngle(angle: number, speed: number, dtMs: number): number {
  const TAU = Math.PI * 2;
  const next = (angle + (speed * dtMs) / 1000) % TAU;
  return next < 0 ? next + TAU : next;
}

// ─────────────────────────────────────────────
// Ring geometry
// ─────────────────────────────────────────────

/** How a single ring should be drawn this frame. */
export interface RingGeometry {
  /** Radius as a fraction of the orb radius, 0–1. */
  radiusRatio: number;
  strokeWidth: number;
  /** Blur radius in pixels. */
  blur: number;
  opacity: number;
}

/** Resting radius ratios, outermost first. */
const BASE_RADII: readonly number[] = [0.94, 0.82, 0.66, 0.48];

/**
 * Geometry for one ring.
 *
 * Scatter pushes rings outward and convergence draws them in — attraction and
 * repulsion as two separate terms rather than one inverted number, matching
 * how the particle mesh treats the same pair. Maturity thickens and brightens
 * the rings, so a long-established baseline visibly reads as more substantial
 * than a new one.
 *
 * @param index - Ring index, 0 = outermost.
 * @param frame - Current sensory frame.
 * @param maturityRatio - Baseline maturity, 0–1.
 * @returns Drawing parameters for the ring.
 */
export function ringGeometry(
  index: number,
  frame: SensoryFrame,
  maturityRatio: number,
): RingGeometry {
  const base = BASE_RADII[Math.min(Math.max(index, 0), BASE_RADII.length - 1)];
  const maturity = clamp01(maturityRatio);
  const scatter = clamp01(frame.scatter);
  const convergence = clamp01(frame.convergence);

  // Outer rings react more, so dispersal opens the orb rather than inflating
  // it uniformly.
  const depth = 1 - index / RING_COUNT;
  const push = scatter * 0.18 * depth;
  const pull = convergence * 0.08 * depth;

  return {
    radiusRatio: clamp(base + push - pull, 0.2, 1.15),
    strokeWidth: 1 + maturity * 1.6 + convergence * 0.6,
    blur: 0.8 + frame.glow * 2.4 + scatter * 1.5,
    opacity: clamp(0.35 + frame.brightness * 0.5 + maturity * 0.15, 0, 1),
  };
}

// ─────────────────────────────────────────────
// Parallax
// ─────────────────────────────────────────────

/** Device tilt, each axis normalised to roughly -1..1. */
export interface Tilt {
  x: number;
  y: number;
}

/** No tilt — used when motion is unavailable or reduced motion is on. */
export const NO_TILT: Tilt = { x: 0, y: 0 };

/**
 * Maximum parallax shift in pixels, for the outermost ring at full tilt.
 *
 * Small on purpose. The effect should register as the orb sitting *in* the
 * device rather than as anything anyone would describe as movement; past a few
 * pixels it stops feeling like depth and starts feeling like drift.
 */
export const MAX_PARALLAX_PX = 6;

/**
 * Pixel offset for a ring at a given depth.
 *
 * Nearer rings — lower index — travel further, which is the direction real
 * parallax runs. Inverting it reads as wrong even to someone who could not say
 * why.
 *
 * @param tilt - Current device tilt.
 * @param index - Ring index, 0 = outermost/nearest.
 * @returns Offset in pixels.
 */
export function parallaxOffset(tilt: Tilt, index: number): { dx: number; dy: number } {
  const depth = 1 - index / RING_COUNT;
  return {
    dx: clamp(tilt.x, -1, 1) * MAX_PARALLAX_PX * depth,
    dy: clamp(tilt.y, -1, 1) * MAX_PARALLAX_PX * depth,
  };
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

function clamp01(n: number): number {
  return clamp(n, 0, 1);
}
