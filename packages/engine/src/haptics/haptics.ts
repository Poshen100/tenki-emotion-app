/**
 * @module haptics/haptics
 * @description TENKI Pulse — a platform-neutral haptic engine that makes the
 * scan feel *alive* and *learns the user over time*.
 *
 * Pure & deterministic: it maps ceremony events and readiness zones to abstract
 * {@link HapticPattern}s, and evolves a per-user {@link PulseProfile} as the
 * baseline matures. The actual buzzing is done by a platform adapter
 * (native: Expo Haptics / Core Haptics; web: navigator.vibrate — Android only,
 * iOS Safari has no web vibration API). This engine never touches a device, so
 * it is fully unit-testable and reusable across native + web.
 *
 * Privacy-first: the PulseProfile is derived on-device and meant to be stored
 * locally — no raw biometric data, no cloud.
 *
 * @version 3.0
 */

import type { BaselineMaturity } from '../common/types';
import { BASELINE_THRESHOLDS } from '../common/types';
import type { EdgeZone } from '../scoring/types';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

/** A single haptic step: buzz at `intensity` for `durationMs`, then wait `gapMs`. */
export interface HapticStep {
  /** Relative strength 0–1 (native → impact strength; web → buzz only, intensity dropped). */
  intensity: number;
  /** Buzz length in milliseconds. */
  durationMs: number;
  /** Silence after the buzz, in milliseconds. */
  gapMs: number;
}

/** An ordered sequence of haptic steps. */
export type HapticPattern = HapticStep[];

/** Ceremony moments during the baseline scan that emit a haptic. */
export type PulseEvent =
  | 'face_locked'
  | 'scan_tick'
  | 'calibration_milestone'
  | 'baseline_locked';

/**
 * Evolving, on-device personalization of the user's haptic "signature".
 * Carries the learning that makes TENKI feel like it is getting to know you.
 */
export interface PulseProfile {
  /** Profile schema version. */
  version: number;
  /** Number of scans observed (drives maturity). */
  sessions: number;
  /** Baseline maturity derived from `sessions`. */
  maturity: BaselineMaturity;
  /** Learned overall strength multiplier (clamped to {@link PULSE_LIMITS}). */
  intensityScale: number;
  /** Learned tempo multiplier — >1 = slower/calmer, <1 = crisper (clamped). */
  tempoScale: number;
  /** Envelope detail 0–1 — grows with maturity, adds personalized "alive" tails. */
  refinement: number;
  /** EWMA share of each zone the user tends to land in (sums to ~1). */
  zoneBias: Record<EdgeZone, number>;
  /** Stable, subtle per-user timing variation 0–1 (makes the signature unique). */
  signatureSeed: number;
}

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

const PROFILE_VERSION = 1;

/** EWMA rate for learning zone tendency + adapting intensity/tempo. */
const LEARN_ALPHA = 0.2;

/** Safe bounds so the signature never drifts into jarring or imperceptible territory. */
export const PULSE_LIMITS = {
  intensityScale: { min: 0.6, max: 1.25 },
  tempoScale: { min: 0.8, max: 1.3 },
} as const;

/** Envelope refinement the profile converges toward at each maturity stage. */
const REFINEMENT_TARGET: Record<BaselineMaturity, number> = {
  new: 0.1,
  building: 0.4,
  ready: 0.7,
  mature: 1.0,
};

/** Per-zone intensity tendency: Clear a touch crisper, Strain softened (never jarring). */
const ZONE_INTENSITY: Record<EdgeZone, number> = { clear: 1.12, neutral: 1.0, strain: 0.85 };

/** Per-zone tempo tendency: Strain slower/soothing, Clear slightly quicker. */
const ZONE_TEMPO: Record<EdgeZone, number> = { clear: 0.92, neutral: 1.0, strain: 1.15 };

/** Base patterns per ceremony event (before profile scaling). */
const EVENT_BASE: Record<PulseEvent, HapticPattern> = {
  // a single soft tap — "I've got you"
  face_locked: [{ intensity: 0.5, durationMs: 18, gapMs: 0 }],
  // a tiny tick as each scanline passes — alive, responsive
  scan_tick: [{ intensity: 0.22, durationMs: 9, gapMs: 0 }],
  // a gentle double-tap at a calibration milestone
  calibration_milestone: [
    { intensity: 0.4, durationMs: 14, gapMs: 55 },
    { intensity: 0.45, durationMs: 14, gapMs: 0 },
  ],
  // ascending triple that settles — the lock ritual
  baseline_locked: [
    { intensity: 0.45, durationMs: 16, gapMs: 50 },
    { intensity: 0.6, durationMs: 18, gapMs: 50 },
    { intensity: 0.8, durationMs: 26, gapMs: 0 },
  ],
};

/** Base result "pulse" per readiness zone (felt at the score reveal). */
const ZONE_BASE: Record<EdgeZone, HapticPattern> = {
  // slow, smooth breaths
  clear: [
    { intensity: 0.45, durationMs: 38, gapMs: 95 },
    { intensity: 0.35, durationMs: 55, gapMs: 0 },
  ],
  // steady, even
  neutral: [
    { intensity: 0.5, durationMs: 28, gapMs: 70 },
    { intensity: 0.5, durationMs: 28, gapMs: 0 },
  ],
  // quicker, sharper — but contained, never an alarm
  strain: [
    { intensity: 0.6, durationMs: 20, gapMs: 38 },
    { intensity: 0.6, durationMs: 20, gapMs: 38 },
    { intensity: 0.5, durationMs: 20, gapMs: 0 },
  ],
};

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));
const clamp01 = (v: number): number => clamp(v, 0, 1);
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Scale a base pattern by the learned profile (intensity, tempo, personal timing). */
function applyProfile(pattern: HapticPattern, profile: PulseProfile): HapticPattern {
  const seedJitter = (profile.signatureSeed - 0.5) * 6; // ±3ms personal timing on gaps
  return pattern.map((s) => ({
    intensity: clamp01(s.intensity * profile.intensityScale),
    durationMs: Math.max(6, Math.round(s.durationMs * profile.tempoScale)),
    gapMs: s.gapMs > 0 ? Math.max(0, Math.round(s.gapMs * profile.tempoScale + seedJitter)) : 0,
  }));
}

// ─────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────

/**
 * Maturity stage for a given number of observed scans.
 * Mirrors {@link BASELINE_THRESHOLDS} (building ≥1, ready ≥5, mature ≥15).
 * Note: the 'mature' distinct-days requirement is not modeled here; the haptic
 * profile approximates maturity by scan count only.
 *
 * @param sessions - Number of scans observed (≥0).
 * @returns The maturity stage.
 */
export function maturityForSessions(sessions: number): BaselineMaturity {
  if (sessions >= BASELINE_THRESHOLDS.MATURE) return 'mature';
  if (sessions >= BASELINE_THRESHOLDS.READY) return 'ready';
  if (sessions >= BASELINE_THRESHOLDS.BUILDING) return 'building';
  return 'new';
}

/**
 * Create a fresh, generic pulse profile for a new user.
 *
 * @param signatureSeed - Stable per-user seed 0–1 (e.g. derived from the baseline). Default 0.5.
 * @returns A new {@link PulseProfile}.
 */
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
 *
 * @param profile - The current profile.
 * @param observation - The scan's zone + Edge Score (0–100).
 * @returns The updated {@link PulseProfile}.
 */
export function evolvePulseProfile(
  profile: PulseProfile,
  observation: { zone: EdgeZone; score: number },
): PulseProfile {
  const sessions = profile.sessions + 1;
  const maturity = maturityForSessions(sessions);

  // EWMA zone tendency toward the one-hot observed zone, then renormalize.
  const zoneBias: Record<EdgeZone, number> = { ...profile.zoneBias };
  (['clear', 'neutral', 'strain'] as EdgeZone[]).forEach((z) => {
    zoneBias[z] = lerp(zoneBias[z], z === observation.zone ? 1 : 0, LEARN_ALPHA);
  });
  const sum = zoneBias.clear + zoneBias.neutral + zoneBias.strain || 1;
  zoneBias.clear /= sum;
  zoneBias.neutral /= sum;
  zoneBias.strain /= sum;

  // Adapt intensity + tempo toward the learned zone tendency.
  const tIntensity =
    zoneBias.clear * ZONE_INTENSITY.clear +
    zoneBias.neutral * ZONE_INTENSITY.neutral +
    zoneBias.strain * ZONE_INTENSITY.strain;
  const tTempo =
    zoneBias.clear * ZONE_TEMPO.clear +
    zoneBias.neutral * ZONE_TEMPO.neutral +
    zoneBias.strain * ZONE_TEMPO.strain;

  return {
    ...profile,
    version: PROFILE_VERSION,
    sessions,
    maturity,
    intensityScale: clamp(
      lerp(profile.intensityScale, tIntensity, LEARN_ALPHA),
      PULSE_LIMITS.intensityScale.min,
      PULSE_LIMITS.intensityScale.max,
    ),
    tempoScale: clamp(
      lerp(profile.tempoScale, tTempo, LEARN_ALPHA),
      PULSE_LIMITS.tempoScale.min,
      PULSE_LIMITS.tempoScale.max,
    ),
    refinement: clamp01(lerp(profile.refinement, REFINEMENT_TARGET[maturity], 0.35)),
    zoneBias,
  };
}

/**
 * Haptic pattern for a ceremony event, personalized by the profile.
 * The lock moment gains a soft personalized "settle" tail once refined.
 *
 * @param event - The ceremony moment.
 * @param profile - The user's pulse profile.
 * @returns A {@link HapticPattern}.
 */
export function scanEventPulse(event: PulseEvent, profile: PulseProfile): HapticPattern {
  let base = EVENT_BASE[event];
  if (event === 'baseline_locked' && profile.refinement > 0.5) {
    base = [
      ...base,
      { intensity: clamp01(0.3 + profile.refinement * 0.2), durationMs: 30 + Math.round(profile.refinement * 20), gapMs: 0 },
    ];
  }
  return applyProfile(base, profile);
}

/**
 * Result "pulse" for a readiness zone, felt at the Edge Score reveal.
 * A mature profile adds a faint personalized after-glow — it feels alive.
 *
 * @param zone - The readiness zone.
 * @param profile - The user's pulse profile.
 * @returns A {@link HapticPattern}.
 */
export function zonePulse(zone: EdgeZone, profile: PulseProfile): HapticPattern {
  let base = ZONE_BASE[zone];
  if (profile.refinement > 0.6) {
    base = [...base, { intensity: clamp01(0.25 * profile.refinement), durationMs: 24, gapMs: 0 }];
  }
  return applyProfile(base, profile);
}

/**
 * Convert a {@link HapticPattern} to the `navigator.vibrate` array format
 * `[buzz, pause, buzz, pause, …]` (intensity is dropped — web cannot vary it).
 * iOS Safari ignores vibration entirely; this is for Android/desktop.
 *
 * @param pattern - The haptic pattern.
 * @returns A flat duration array for `navigator.vibrate`.
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
