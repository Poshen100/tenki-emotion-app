/**
 * @module face-baseline/utils/pulse
 * @description TENKI Pulse (mobile mirror) — pure, dependency-free haptic
 * pattern + learning logic. Mirrors `packages/engine/src/haptics/haptics.ts`
 * (the canonical spec) so the native feature stays self-contained and testable
 * without the engine in its bundle. **Keep in sync with the engine version.**
 *
 * The actual buzzing is done by {@link ./pulsePlayer}; this file only produces
 * abstract patterns and evolves the on-device {@link PulseProfile}.
 */
import type { MaturityStage } from '../types/faceBaseline.types';
import { maturityStage } from './maturityStage';

/** Readiness zone (3-zone v3). */
export type PulseZone = 'clear' | 'neutral' | 'strain';

/** A single haptic step: buzz at `intensity` for `durationMs`, then wait `gapMs`. */
export interface HapticStep {
  /** Relative strength 0–1 (native → impact style; web → buzz only). */
  intensity: number;
  /** Buzz length in milliseconds. */
  durationMs: number;
  /** Silence after the buzz, in milliseconds. */
  gapMs: number;
}

/** An ordered sequence of haptic steps. */
export type HapticPattern = HapticStep[];

/** Ceremony moments during the baseline scan that emit a haptic. */
export type PulseEvent = 'face_locked' | 'scan_tick' | 'calibration_milestone' | 'baseline_locked';

/** Evolving, on-device personalization of the user's haptic "signature". */
export interface PulseProfile {
  version: number;
  sessions: number;
  maturity: MaturityStage;
  intensityScale: number;
  tempoScale: number;
  refinement: number;
  zoneBias: Record<PulseZone, number>;
  signatureSeed: number;
}

const PROFILE_VERSION = 1;
const LEARN_ALPHA = 0.2;

/** Safe bounds so the signature never drifts into jarring or imperceptible territory. */
export const PULSE_LIMITS = {
  intensityScale: { min: 0.6, max: 1.25 },
  tempoScale: { min: 0.8, max: 1.3 },
} as const;

const REFINEMENT_TARGET: Record<MaturityStage, number> = { new: 0.1, building: 0.4, ready: 0.7, mature: 1.0 };
const ZONE_INTENSITY: Record<PulseZone, number> = { clear: 1.12, neutral: 1.0, strain: 0.85 };
const ZONE_TEMPO: Record<PulseZone, number> = { clear: 0.92, neutral: 1.0, strain: 1.15 };

const EVENT_BASE: Record<PulseEvent, HapticPattern> = {
  face_locked: [{ intensity: 0.5, durationMs: 18, gapMs: 0 }],
  scan_tick: [{ intensity: 0.22, durationMs: 9, gapMs: 0 }],
  calibration_milestone: [
    { intensity: 0.4, durationMs: 14, gapMs: 55 },
    { intensity: 0.45, durationMs: 14, gapMs: 0 },
  ],
  baseline_locked: [
    { intensity: 0.45, durationMs: 16, gapMs: 50 },
    { intensity: 0.6, durationMs: 18, gapMs: 50 },
    { intensity: 0.8, durationMs: 26, gapMs: 0 },
  ],
};

const ZONE_BASE: Record<PulseZone, HapticPattern> = {
  clear: [
    { intensity: 0.45, durationMs: 38, gapMs: 95 },
    { intensity: 0.35, durationMs: 55, gapMs: 0 },
  ],
  neutral: [
    { intensity: 0.5, durationMs: 28, gapMs: 70 },
    { intensity: 0.5, durationMs: 28, gapMs: 0 },
  ],
  strain: [
    { intensity: 0.6, durationMs: 20, gapMs: 38 },
    { intensity: 0.6, durationMs: 20, gapMs: 38 },
    { intensity: 0.5, durationMs: 20, gapMs: 0 },
  ],
};

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));
const clamp01 = (v: number): number => clamp(v, 0, 1);
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

function applyProfile(pattern: HapticPattern, profile: PulseProfile): HapticPattern {
  const seedJitter = (profile.signatureSeed - 0.5) * 6;
  return pattern.map((s) => ({
    intensity: clamp01(s.intensity * profile.intensityScale),
    durationMs: Math.max(6, Math.round(s.durationMs * profile.tempoScale)),
    gapMs: s.gapMs > 0 ? Math.max(0, Math.round(s.gapMs * profile.tempoScale + seedJitter)) : 0,
  }));
}

/** Create a fresh, generic pulse profile for a new user. */
export function createPulseProfile(signatureSeed = 0.5): PulseProfile {
  return {
    version: PROFILE_VERSION,
    sessions: 0,
    maturity: 'new',
    intensityScale: 1,
    tempoScale: 1,
    refinement: REFINEMENT_TARGET.new,
    zoneBias: { clear: 1 / 3, neutral: 1 / 3, strain: 1 / 3 },
    signatureSeed: clamp01(signatureSeed),
  };
}

/**
 * Evolve the profile after one observed scan — the "learning iteration".
 * Pure: returns a new profile, never mutates the input.
 */
export function evolvePulseProfile(
  profile: PulseProfile,
  observation: { zone: PulseZone; score: number },
): PulseProfile {
  const sessions = profile.sessions + 1;
  const maturity = maturityStage(sessions);

  const zoneBias: Record<PulseZone, number> = { ...profile.zoneBias };
  (['clear', 'neutral', 'strain'] as PulseZone[]).forEach((z) => {
    zoneBias[z] = lerp(zoneBias[z], z === observation.zone ? 1 : 0, LEARN_ALPHA);
  });
  const sum = zoneBias.clear + zoneBias.neutral + zoneBias.strain || 1;
  zoneBias.clear /= sum;
  zoneBias.neutral /= sum;
  zoneBias.strain /= sum;

  const tIntensity =
    zoneBias.clear * ZONE_INTENSITY.clear + zoneBias.neutral * ZONE_INTENSITY.neutral + zoneBias.strain * ZONE_INTENSITY.strain;
  const tTempo =
    zoneBias.clear * ZONE_TEMPO.clear + zoneBias.neutral * ZONE_TEMPO.neutral + zoneBias.strain * ZONE_TEMPO.strain;

  return {
    ...profile,
    version: PROFILE_VERSION,
    sessions,
    maturity,
    intensityScale: clamp(lerp(profile.intensityScale, tIntensity, LEARN_ALPHA), PULSE_LIMITS.intensityScale.min, PULSE_LIMITS.intensityScale.max),
    tempoScale: clamp(lerp(profile.tempoScale, tTempo, LEARN_ALPHA), PULSE_LIMITS.tempoScale.min, PULSE_LIMITS.tempoScale.max),
    refinement: clamp01(lerp(profile.refinement, REFINEMENT_TARGET[maturity], 0.35)),
    zoneBias,
  };
}

/** Haptic pattern for a ceremony event, personalized by the profile. */
export function scanEventPulse(event: PulseEvent, profile: PulseProfile): HapticPattern {
  let base = EVENT_BASE[event];
  if (event === 'baseline_locked' && profile.refinement > 0.5) {
    base = [...base, { intensity: clamp01(0.3 + profile.refinement * 0.2), durationMs: 30 + Math.round(profile.refinement * 20), gapMs: 0 }];
  }
  return applyProfile(base, profile);
}

/** Result "pulse" for a readiness zone, felt at the Edge Score reveal. */
export function zonePulse(zone: PulseZone, profile: PulseProfile): HapticPattern {
  let base = ZONE_BASE[zone];
  if (profile.refinement > 0.6) {
    base = [...base, { intensity: clamp01(0.25 * profile.refinement), durationMs: 24, gapMs: 0 }];
  }
  return applyProfile(base, profile);
}

/**
 * Convert a {@link HapticPattern} to the `navigator.vibrate` array format
 * `[buzz, pause, …]` (intensity dropped — web cannot vary it). iOS Safari
 * ignores web vibration entirely; this is for Android/desktop web only.
 */
export function toWebVibration(pattern: HapticPattern): number[] {
  const out: number[] = [];
  for (const s of pattern) {
    out.push(Math.max(1, Math.round(s.durationMs)));
    out.push(Math.max(0, Math.round(s.gapMs)));
  }
  while (out.length > 1 && out[out.length - 1] === 0) out.pop();
  return out;
}
