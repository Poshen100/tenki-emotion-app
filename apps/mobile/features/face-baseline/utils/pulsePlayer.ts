/**
 * @module face-baseline/utils/pulsePlayer
 * @description Plays a {@link HapticPattern} as real device haptics.
 *
 * iOS/expo-haptics exposes transient *impacts* (no per-buzz amplitude/duration),
 * so a pattern is rendered as a sequence of impacts whose **style** encodes
 * intensity and whose **timing** (durations + gaps) encodes the rhythm. The
 * `trigger` is injected (the hook supplies `Haptics.impactAsync`) so the
 * scheduling logic stays pure and unit-testable without the native stack.
 */
import type { HapticPattern } from './pulse';

/** Impact strength buckets (map to `Haptics.ImpactFeedbackStyle` in the hook). */
export type ImpactStyle = 'Soft' | 'Light' | 'Medium' | 'Heavy';

/** A single scheduled impact: fire `style` at `atMs` from the start. */
export interface ScheduledImpact {
  atMs: number;
  style: ImpactStyle;
  intensity: number;
}

/** Map a 0–1 intensity to an impact style bucket. */
export function intensityToImpactStyle(intensity: number): ImpactStyle {
  if (intensity < 0.3) return 'Soft';
  if (intensity < 0.55) return 'Light';
  if (intensity < 0.8) return 'Medium';
  return 'Heavy';
}

/**
 * Build the impact timeline for a pattern. Each step fires once at its start
 * time; the step's `durationMs + gapMs` advances the clock to the next step.
 */
export function buildSchedule(pattern: HapticPattern): ScheduledImpact[] {
  const out: ScheduledImpact[] = [];
  let t = 0;
  for (const s of pattern) {
    out.push({ atMs: t, style: intensityToImpactStyle(s.intensity), intensity: s.intensity });
    t += Math.max(0, s.durationMs) + Math.max(0, s.gapMs);
  }
  return out;
}

/** Fires an impact of the given style (e.g. `Haptics.impactAsync(...)`). */
export type ImpactTrigger = (style: ImpactStyle, intensity: number) => void;

/** Schedules timers; injectable so tests can use fake timers. */
export interface TimerScheduler {
  set: (cb: () => void, ms: number) => unknown;
  clear: (handle: unknown) => void;
}

const defaultScheduler: TimerScheduler = {
  set: (cb, ms) => setTimeout(cb, ms),
  clear: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
};

/**
 * Play a pattern by firing `trigger` at each scheduled impact.
 * The first impact fires synchronously (at 0ms); the rest are scheduled.
 *
 * @returns A `cancel()` that clears any pending impacts.
 */
export function playPattern(
  pattern: HapticPattern,
  trigger: ImpactTrigger,
  scheduler: TimerScheduler = defaultScheduler,
): () => void {
  const schedule = buildSchedule(pattern);
  const handles: unknown[] = [];
  for (const imp of schedule) {
    if (imp.atMs <= 0) {
      trigger(imp.style, imp.intensity);
    } else {
      handles.push(scheduler.set(() => trigger(imp.style, imp.intensity), imp.atMs));
    }
  }
  return () => {
    for (const h of handles) scheduler.clear(h);
    handles.length = 0;
  };
}
