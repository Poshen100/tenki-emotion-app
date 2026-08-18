/**
 * @module face-baseline/utils/atmosphere
 * @description How the background reacts to the readiness Zone, as pure data.
 *
 * Same reasoning as `choreography.ts` and `orbPhysics.ts`: the rules deciding
 * how the sky *feels* live somewhere jest can reach, and the component is left
 * with one job — animate toward these numbers. No device, no Mac, no eyes
 * required to know whether Strain looks like an alarm.
 *
 * ## Two rules that are not aesthetic
 *
 * 1. **Strain warms slightly; it never alarms.** `GROWTH-ARCHITECTURE.md` §7.5
 *    lists anxiety-driven UI as an explicit anti-pattern. So the warm tint a
 *    Zone can introduce is capped by {@link MAX_WARM_OVERLAY_PEAK}, an order of
 *    magnitude below the gold the deliberate warm modes already paint
 *    ({@link WARM_MODE_PEAK}). A test holds that gap open.
 *
 * 2. **The Zone is an input, never re-derived here.** The 70/40 boundary
 *    already exists in four places (`packages/shared/src/zone-config.ts`,
 *    `packages/engine`, `apps/mobile/theme/index.ts`, the preview pages).
 *    Callers classify with the one they already have — on mobile that is
 *    `getZoneForScore` in `apps/mobile/theme/index.ts` — and pass the result in.
 *
 * @see apps/mobile/features/face-baseline/components/shared/CosmicBackground.tsx
 */
import type { PulseZone } from './pulse';
import { clamp01 } from './progress';

/**
 * Zone driving the sky, plus the honest fourth case: nobody has scanned yet.
 *
 * Built on {@link PulseZone} rather than restating the triple, so the mobile
 * side keeps exactly one spelling of the three zones.
 */
export type AtmosphereZone = PulseZone | 'unknown';

/** Everything the background needs to know about the current state. */
export interface Atmosphere {
  /**
   * Colour temperature, −1 (colder, deeper blue) … +1 (warm).
   * Bounded for Strain by {@link MAX_STRAIN_WARMTH}.
   */
  temperature: number;
  /** Star-count multiplier, 0–1. */
  starDensity: number;
  /** Animation tempo multiplier, 0–{@link MAX_FLOW_RATE}. 0 means fully still. */
  flowRate: number;
  /** Nebula peak-opacity multiplier, 0–1. */
  nebulaIntensity: number;
  /** Circuit-trace visibility, 0–1. Driven by maturity alone — never by Zone. */
  circuitPresence: number;
}

// ─────────────────────────────────────────────
// Bounds
// ─────────────────────────────────────────────

/** Ceiling on how warm a Zone may push the sky. Above this it reads as alarm. */
export const MAX_STRAIN_WARMTH = 0.35;

/** Ceiling on animation tempo. Faster than this stops reading as premium. */
export const MAX_FLOW_RATE = 1.4;

/**
 * Peak opacity of the warm layer the deliberate warm modes already paint
 * (`captureWarm` / `processing` / `success`): `nebulaOpacity` 0.8 × 0.5.
 *
 * Recorded here purely so {@link MAX_WARM_OVERLAY_PEAK} can be tested against
 * something real rather than against a number someone liked.
 */
export const WARM_MODE_PEAK = 0.4;

/** Ceiling on the Zone-driven warm overlay. Deliberately far below the modes'. */
export const MAX_WARM_OVERLAY_PEAK = 0.14;

/**
 * Maturity below which circuit traces stay fully absent.
 *
 * Without a floor, the first completed scan would pop a visible circuit into
 * the sky. The point is that it *emerges*, so nothing shows until the baseline
 * has actually accumulated.
 */
export const CIRCUIT_ONSET = 0.35;

/**
 * The sky as it looks today: no Zone influence at all.
 *
 * Every multiplier is 1 and every additive term is 0, which is what lets
 * `CosmicBackground` take this as its default and render the twelve existing
 * face-baseline call sites unchanged.
 */
export const CALM_ATMOSPHERE: Atmosphere = Object.freeze({
  temperature: 0,
  starDensity: 1,
  flowRate: 1,
  nebulaIntensity: 1,
  circuitPresence: 0,
});

// ─────────────────────────────────────────────
// Per-zone character
// ─────────────────────────────────────────────

/**
 * Zone → sky, before maturity and reduced motion are applied.
 *
 * Ordering is the design: temperature and tempo both rise clear → neutral →
 * strain, so the sky reads as cooler and calmer when the user is clear, and
 * warmer and more alive when they are strained — within the caps above.
 */
const ZONE_CHARACTER: Readonly<Record<AtmosphereZone, Omit<Atmosphere, 'circuitPresence'>>> = {
  clear:   { temperature: -0.45, starDensity: 0.75, flowRate: 0.70, nebulaIntensity: 0.85 },
  neutral: { temperature:  0.00, starDensity: 1.00, flowRate: 1.00, nebulaIntensity: 1.00 },
  strain:  { temperature:  0.30, starDensity: 1.00, flowRate: 1.35, nebulaIntensity: 1.00 },
  unknown: {
    temperature: CALM_ATMOSPHERE.temperature,
    starDensity: CALM_ATMOSPHERE.starDensity,
    flowRate: CALM_ATMOSPHERE.flowRate,
    nebulaIntensity: CALM_ATMOSPHERE.nebulaIntensity,
  },
};

// ─────────────────────────────────────────────
// Composition
// ─────────────────────────────────────────────

/** Clamps into [min, max], treating NaN as `min`. */
function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.max(min, Math.min(max, value));
}

/**
 * How visible the Zone-driven warm layer should be.
 *
 * Only positive temperature paints gold; a cold Zone simply leaves the existing
 * violet wisps alone rather than painting blue on blue.
 *
 * @param temperature - Colour temperature from an {@link Atmosphere}.
 * @returns Peak opacity for the warm overlay, never above
 *   {@link MAX_WARM_OVERLAY_PEAK}.
 */
export function warmOverlayPeak(temperature: number): number {
  return clamp01(temperature) * MAX_WARM_OVERLAY_PEAK;
}

/** Most the cyan aurora may be strengthened when the Zone is cold. */
export const MAX_COOL_AURORA_GAIN = 0.5;

/**
 * How much to strengthen the existing cyan aurora when the Zone is cold.
 *
 * The counterpart to {@link warmOverlayPeak}: rather than painting a new blue
 * on top of an already-blue sky, a clear Zone simply deepens the accent that is
 * there. Returns 1 (no change) for any non-negative temperature.
 *
 * @param temperature - Colour temperature from an {@link Atmosphere}.
 * @returns A multiplier, 1–(1 + {@link MAX_COOL_AURORA_GAIN}).
 */
export function coolAuroraGain(temperature: number): number {
  return 1 + clamp01(-temperature) * MAX_COOL_AURORA_GAIN;
}

/**
 * Circuit-trace visibility for a given baseline maturity.
 *
 * Zero until {@link CIRCUIT_ONSET}, then rising linearly to 1 — monotonic, so
 * traces can only ever fade in as the baseline matures, never flicker.
 *
 * @param maturityRatio - Baseline maturity, 0–1.
 * @returns Visibility 0–1.
 */
export function circuitPresence(maturityRatio: number): number {
  const m = clamp01(maturityRatio);
  if (m <= CIRCUIT_ONSET) return 0;
  return (m - CIRCUIT_ONSET) / (1 - CIRCUIT_ONSET);
}

/**
 * The sky for the current state.
 *
 * @param zone - Readiness zone, classified by the caller. `'unknown'` when no
 *   scan has produced a score yet.
 * @param maturityRatio - Baseline maturity, 0–1. Drives circuit traces only.
 * @param reducedMotion - When true, motion stops but nothing else changes:
 *   colour, density and nebula strength still carry the full state. Same rule
 *   as `choreography.ts` — take away the movement, not the information.
 * @returns A bounded {@link Atmosphere}.
 */
export function composeAtmosphere(
  zone: AtmosphereZone,
  maturityRatio: number,
  reducedMotion: boolean,
): Atmosphere {
  const character = ZONE_CHARACTER[zone] ?? ZONE_CHARACTER.unknown;

  return {
    temperature: clamp(character.temperature, -1, MAX_STRAIN_WARMTH),
    starDensity: clamp01(character.starDensity),
    flowRate: reducedMotion ? 0 : clamp(character.flowRate, 0, MAX_FLOW_RATE),
    nebulaIntensity: clamp01(character.nebulaIntensity),
    circuitPresence: circuitPresence(maturityRatio),
  };
}
