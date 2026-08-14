/**
 * @module analytics/focus-window
 * @description Focus Window — the hours of the day in which a user's clear
 * states have historically appeared most often.
 *
 * This is retrospective statistics, not forecasting, and the distinction is a
 * hard compliance line rather than a stylistic one: `predict` is prohibited
 * vocabulary. The window says where clear states HAVE been, never where they
 * WILL be.
 *
 * When the sample is thin the module returns nothing rather than a guess. A
 * "your clear window is 10:00–12:00" computed from three records is worse than
 * no window at all, because people schedule real commitments around it and then
 * learn the product is unreliable. Same reasoning as the k-anonymity gate on
 * benchmarks: an honest empty state beats a confident wrong answer.
 *
 * @see docs/EDGE-DETECTOR-ARCHITECTURE.md §9
 */

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

/** Total records required before any window is reported. */
export const MIN_SAMPLES_FOR_WINDOW = 20;

/** Records required within an hour before that hour can join a window. */
export const MIN_SAMPLES_PER_HOUR = 3;

/** Minimum contiguous hours for a run to count as a window. */
export const MIN_WINDOW_HOURS = 2;

/**
 * How far an hour's clear-rate must exceed the personal average to qualify,
 * in absolute proportion. Ten points above your own baseline rate is a real
 * signal; two points is noise.
 */
export const CLEAR_RATE_MARGIN = 0.1;

/** Days of history considered. */
export const LOOKBACK_DAYS = 30;

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

/** One historical observation, reduced to what the window needs. */
export interface FocusWindowSample {
  /** Local hour of day, 0–23. */
  readonly hour: number;
  /** Whether the reading was in the clear zone. */
  readonly wasClear: boolean;
}

/** A detected focus window. */
export interface FocusWindow {
  /** First hour of the window, 0–23. */
  readonly startHour: number;
  /** Hour AFTER the last hour of the window, 0–24 — exclusive, like a slice. */
  readonly endHour: number;
  /** Proportion of readings in this window that were clear, 0–1. */
  readonly clearRate: number;
  /** Total readings behind the window. */
  readonly sampleCount: number;
}

/** Why no window could be reported. */
export const FOCUS_WINDOW_GAPS = ['insufficient_samples', 'no_qualifying_run'] as const;
export type FocusWindowGap = typeof FOCUS_WINDOW_GAPS[number];

/**
 * The result of a focus window computation. "Not enough data yet" is a
 * first-class outcome the interface renders as an accumulating state, not an
 * error and not an empty chart.
 */
export type FocusWindowResult =
  | { readonly status: 'ok'; readonly window: FocusWindow; readonly daysOfData: number }
  | { readonly status: 'unavailable'; readonly gap: FocusWindowGap; readonly sampleCount: number };

// ─────────────────────────────────────────────
// Computation
// ─────────────────────────────────────────────

/** Per-hour tally. */
interface HourStat {
  total: number;
  clear: number;
}

/**
 * Computes the user's focus window from their own history.
 *
 * @param samples - Observations from the lookback period.
 * @param daysOfData - Distinct days the samples span, shown to the user so the
 *   window carries its own evidence.
 * @returns The window, or the reason there is not one to report.
 */
export function computeFocusWindow(
  samples: readonly FocusWindowSample[],
  daysOfData: number
): FocusWindowResult {
  if (samples.length < MIN_SAMPLES_FOR_WINDOW) {
    return {
      status: 'unavailable',
      gap: 'insufficient_samples',
      sampleCount: samples.length,
    };
  }

  const hours: HourStat[] = Array.from({ length: 24 }, () => ({ total: 0, clear: 0 }));
  for (const sample of samples) {
    if (sample.hour < 0 || sample.hour > 23) continue;
    const stat = hours[sample.hour];
    stat.total += 1;
    if (sample.wasClear) stat.clear += 1;
  }

  const overallClear = samples.filter((s) => s.wasClear).length / samples.length;
  const threshold = overallClear + CLEAR_RATE_MARGIN;

  // An hour qualifies on both counts: enough observations to mean anything, and
  // a clear-rate meaningfully above this person's own average.
  const qualifies = hours.map(
    (stat) =>
      stat.total >= MIN_SAMPLES_PER_HOUR && stat.clear / stat.total >= threshold
  );

  const run = longestRun(qualifies);
  if (run === null || run.length < MIN_WINDOW_HOURS) {
    return {
      status: 'unavailable',
      gap: 'no_qualifying_run',
      sampleCount: samples.length,
    };
  }

  let total = 0;
  let clear = 0;
  for (let h = run.start; h < run.start + run.length; h++) {
    total += hours[h].total;
    clear += hours[h].clear;
  }

  return {
    status: 'ok',
    daysOfData,
    window: {
      startHour: run.start,
      endHour: run.start + run.length,
      clearRate: total === 0 ? 0 : clear / total,
      sampleCount: total,
    },
  };
}

/**
 * Finds the longest contiguous run of qualifying hours.
 *
 * Runs do not wrap past midnight: a window spanning 23:00–01:00 would be
 * reported as a single block covering the small hours, which is not what
 * someone reading "your clear window" expects to see.
 *
 * @param flags - Per-hour qualification flags.
 * @returns The longest run, or null when there is none.
 */
function longestRun(
  flags: readonly boolean[]
): { start: number; length: number } | null {
  let best: { start: number; length: number } | null = null;
  let runStart = -1;

  for (let i = 0; i <= flags.length; i++) {
    const on = i < flags.length && flags[i];

    if (on && runStart === -1) {
      runStart = i;
    } else if (!on && runStart !== -1) {
      const length = i - runStart;
      if (best === null || length > best.length) best = { start: runStart, length };
      runStart = -1;
    }
  }

  return best;
}

/**
 * Formats a window as a display range, e.g. "10:00 – 12:00".
 *
 * @param window - The window to format.
 * @returns The formatted range.
 */
export function formatFocusWindow(window: FocusWindow): string {
  const pad = (h: number): string => String(h).padStart(2, '0');
  return `${pad(window.startHour)}:00 – ${pad(window.endHour)}:00`;
}
