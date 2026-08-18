/**
 * @module face-baseline/utils/choreography
 * @description The perception engine — decides how sight and touch move
 * together during a scan.
 *
 * The point of pulling this out of the components is that "how the ritual
 * feels" becomes a pure function, and a pure function can be verified in jest
 * without a device, without a Mac, and without anyone looking at a screen.
 * Components are left with one job: animate toward the numbers this returns.
 *
 * ## The rule that matters most
 *
 * Visuals are continuous; touch is not. Quality changes every frame, and
 * binding a haptic to it would leave the phone buzzing without pause — which
 * does not read as an instrument, it reads as a fault. So visuals are sampled
 * per frame through {@link composeSensoryFrame}, while haptics are edge
 * triggered through {@link resolveHapticTrigger} and fire only when the phase
 * actually changes.
 *
 * ## Reduced motion
 *
 * When reduced motion is on, scatter collapses and haptics go silent, but no
 * information is removed — brightness and convergence still carry the full
 * state. This follows the existing rule in `utils/haptics.ts`: touch is never
 * the only channel carrying something the user needs.
 *
 * @see apps/mobile/features/face-baseline/utils/pulse.ts
 */
import { scanEventPulse, type HapticPattern, type PulseEvent, type PulseProfile } from './pulse';

// ─────────────────────────────────────────────
// Phases
// ─────────────────────────────────────────────

/** Where the ritual currently is. */
export type RitualPhase =
  | 'idle'
  | 'searching'
  | 'locking'
  | 'capturing'
  | 'stabilizing'
  | 'locked'
  | 'lost';

/** Live signal readings driving the visuals. All 0–1. */
export interface RitualSignals {
  /** Capture signal quality. */
  quality: number;
  /** How steady the subject is holding. */
  stability: number;
  /** Progress through the capture. */
  progress: number;
}

/**
 * Target values for one frame. Components animate toward these rather than
 * computing them, so the choreography stays in one testable place.
 */
export interface SensoryFrame {
  /** How far particles have drawn in toward their anchors, 0–1. */
  convergence: number;
  /** How far particles have blown apart, 0–1. Rises as quality falls. */
  scatter: number;
  /** Particle brightness, 0–1. */
  brightness: number;
  /** Halo strength, 0–1. */
  glow: number;
  /** How long a component should take to reach these values. */
  transitionMs: number;
}

// ─────────────────────────────────────────────
// Tuning
// ─────────────────────────────────────────────

/** Per-phase baselines, before signals modulate them. */
const PHASE_BASE: Readonly<Record<RitualPhase, Omit<SensoryFrame, 'scatter'>>> = {
  idle:        { convergence: 0.15, brightness: 0.25, glow: 0.10, transitionMs: 900 },
  searching:   { convergence: 0.30, brightness: 0.45, glow: 0.25, transitionMs: 600 },
  locking:     { convergence: 0.55, brightness: 0.65, glow: 0.45, transitionMs: 420 },
  capturing:   { convergence: 0.70, brightness: 0.80, glow: 0.60, transitionMs: 320 },
  stabilizing: { convergence: 0.85, brightness: 0.90, glow: 0.75, transitionMs: 260 },
  locked:      { convergence: 1.00, brightness: 1.00, glow: 1.00, transitionMs: 520 },
  lost:        { convergence: 0.10, brightness: 0.30, glow: 0.15, transitionMs: 240 },
};

/** Ceiling on scatter so particles disperse without ever leaving the frame. */
export const MAX_SCATTER = 1;

/** Phases where poor quality should visibly disperse the mesh. */
const SCATTER_PHASES: readonly RitualPhase[] = [
  'searching',
  'locking',
  'capturing',
  'stabilizing',
];

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

// ─────────────────────────────────────────────
// Visual frame
// ─────────────────────────────────────────────

/**
 * Builds the visual target for one frame.
 *
 * Convergence blends the phase baseline with live stability, so holding steady
 * visibly crystallises the mesh and drifting loosens it — within the phase,
 * without needing a phase change to show it.
 *
 * @param phase - Current ritual phase.
 * @param signals - Live readings.
 * @param reducedMotion - Whether the user asked for reduced motion.
 * @returns Target values for this frame.
 */
export function composeSensoryFrame(
  phase: RitualPhase,
  signals: RitualSignals,
  reducedMotion: boolean,
): SensoryFrame {
  const base = PHASE_BASE[phase];
  const quality = clamp01(signals.quality);
  const stability = clamp01(signals.stability);
  const progress = clamp01(signals.progress);

  // Stability pulls convergence around its baseline; progress nudges it up so
  // the mesh tightens as the capture fills.
  const convergence = clamp01(
    base.convergence * (0.75 + 0.25 * stability) + progress * 0.1 * (phase === 'locked' ? 0 : 1),
  );

  // Scatter is the inverse of quality, and only in phases where the user is
  // actually being measured — dispersing while idle would just look broken.
  const scatter = reducedMotion || !SCATTER_PHASES.includes(phase)
    ? 0
    : clamp01((1 - quality) * MAX_SCATTER);

  return {
    convergence,
    scatter,
    brightness: clamp01(base.brightness * (0.7 + 0.3 * quality)),
    glow: clamp01(base.glow * (0.6 + 0.4 * stability)),
    // Reduced motion still transitions, just slower and softer rather than
    // snapping, which is jarring in its own way.
    transitionMs: reducedMotion ? Math.round(base.transitionMs * 1.5) : base.transitionMs,
  };
}

// ─────────────────────────────────────────────
// Haptics
// ─────────────────────────────────────────────

/** A haptic to play, plus the pulse event it came from. */
export interface HapticTrigger {
  pattern: HapticPattern;
  event: PulseEvent;
}

/** Phase transitions that deserve a pulse, and which pulse. */
const TRANSITION_EVENTS: Readonly<Partial<Record<RitualPhase, PulseEvent>>> = {
  locking: 'scan_tick',
  capturing: 'scan_tick',
  stabilizing: 'calibration_milestone',
  locked: 'face_locked',
};

/**
 * Decides whether a phase change earns a haptic.
 *
 * Returns null when the phase has not changed, which is what keeps a
 * continuously-updating quality reading from turning into continuous
 * vibration. Callers can therefore invoke this every frame safely.
 *
 * `lost` is deliberately absent from the table: a failed lock already shows
 * itself visually, and buzzing on every drop-out would punish someone who is
 * probably already struggling to hold still.
 *
 * @param previous - Phase on the last frame.
 * @param next - Phase on this frame.
 * @param profile - The user's learned pulse profile.
 * @param reducedMotion - Whether the user asked for reduced motion.
 * @returns The haptic to play, or null.
 */
export function resolveHapticTrigger(
  previous: RitualPhase,
  next: RitualPhase,
  profile: PulseProfile,
  reducedMotion: boolean,
): HapticTrigger | null {
  if (reducedMotion) return null;
  if (previous === next) return null;

  const event = TRANSITION_EVENTS[next];
  if (event === undefined) return null;

  return { pattern: scanEventPulse(event, profile), event };
}

/**
 * Whether a phase change should show a non-haptic alert instead.
 *
 * Losing the lock is the one moment worth surfacing without vibration, so it
 * has its own signal that a component can render visually.
 *
 * @param previous - Phase on the last frame.
 * @param next - Phase on this frame.
 * @returns True on a fresh transition into `lost`.
 */
export function isRecoveryMoment(previous: RitualPhase, next: RitualPhase): boolean {
  return next === 'lost' && previous !== 'lost';
}

// ─────────────────────────────────────────────
// Quality adapter
// ─────────────────────────────────────────────

/**
 * The subset of `QualityMetrics` the choreography actually reads.
 *
 * Declared structurally rather than importing the full type, so it is obvious
 * which four numbers drive the ritual — `QualityMetrics` satisfies this.
 */
export interface QualityLike {
  /** Signal Quality Index, higher is better. */
  sqi: number;
  /** Motion magnitude, **lower** is better. */
  motion: number;
  /** Face-in-frame coverage, higher is better. */
  coverage: number;
  /** Landmark tracking confidence, higher is better. */
  landmarkConfidence: number;
}

/**
 * Whether the capture pipeline is actually producing readings yet.
 *
 * The store initialises every metric to zero, and zero is indistinguishable
 * from "the camera is telling us the signal is terrible". Those two mean very
 * different things on screen: an un-instrumented build should not render as a
 * failing scan. Callers use this to fall back to a legible demo state instead
 * of showing a mesh that has blown apart for no reason.
 *
 * Once the native camera pipeline lands this returns true in normal operation
 * and the fallback stops being reachable.
 *
 * @param quality - Current metrics.
 * @returns True when at least one positive reading exists.
 */
export function isQualityInstrumented(quality: QualityLike): boolean {
  return quality.sqi > 0 || quality.coverage > 0 || quality.landmarkConfidence > 0;
}

/**
 * Maps capture metrics onto ritual signals.
 *
 * Quality averages the three higher-is-better readings; stability inverts
 * motion, since holding still is what the mesh is meant to reward.
 *
 * @param quality - Current metrics.
 * @param progress - Capture progress, 0–1.
 * @returns Signals for {@link composeSensoryFrame}.
 */
export function signalsFromQuality(quality: QualityLike, progress: number): RitualSignals {
  return {
    quality: clamp01((clamp01(quality.sqi) + clamp01(quality.coverage) + clamp01(quality.landmarkConfidence)) / 3),
    stability: clamp01(1 - clamp01(quality.motion)),
    progress: clamp01(progress),
  };
}

/**
 * Signals for a build where the capture pipeline is not yet wired.
 *
 * Derived from progress alone, so the ritual still reads as advancing rather
 * than failing. This is a placeholder for a missing input, not a simulation of
 * a good scan — it is only reachable while `isQualityInstrumented` is false.
 *
 * @param progress - Capture progress, 0–1.
 * @returns Signals driven by progress.
 */
export function placeholderSignals(progress: number): RitualSignals {
  const p = clamp01(progress);
  return { quality: 0.8, stability: 0.5 + p * 0.5, progress: p };
}
