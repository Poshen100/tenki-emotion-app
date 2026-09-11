/**
 * @module biometric/ppg/live
 * @description What a capture can honestly tell the user WHILE it is running.
 *
 * A 90-second capture that says nothing for 90 seconds wastes the only chance
 * the user has to fix it. But the four dimensions do not all become knowable at
 * the same time, and pretending otherwise is how a progress readout turns into
 * a decoration:
 *
 *   - **Contact, light and stillness** are properties of the frames. A tenth of
 *     a second is enough. Shown immediately.
 *   - **Rhythm** needs enough seconds for a period to repeat. Below
 *     `MIN_LIVE_WINDOW_SEC` it is `null` — not zero, not "poor". Nothing has
 *     been measured yet.
 *
 * 🔴 The lock is the same gate the final reading uses, applied to a recent
 * window, sustained. It means exactly one thing: "if this capture ended now,
 * it would produce a reading." It is not a result and must never be shown as
 * one (gold = SECURED, `docs/VISUAL-DIRECTION.md` §3).
 *
 * ⚠️ What this deliberately does NOT do: lock on agreement between successive
 * BPM estimates. That was measured and rejected — a barely-perfused finger
 * produces highly consistent BPM estimates (68, 68, 70, 71 …) because
 * `heartRateFromIntervals()` takes a median, and medians are robust to exactly
 * the noise that makes the capture unusable. A BPM-agreement lock fires at 48s
 * on `lowPerfusion` even at ±1 bpm tolerance — and that capture's final result
 * is a refusal. Same trap as the noise floor (docs/PHONE-PPG.md §10).
 *
 * @see docs/PHONE-PPG.md
 */

import { PPG_RESAMPLE_HZ, bandPass, perfusionIndex, resampleUniform } from './filtering';
import { MIN_PERIODICITY, estimateRate } from './pulse';
import { assessFrameComponents, assessPpgQuality } from './quality';
import { SCAN_MODE_CONFIGS, type ScanMode } from '../scan-modes';
import type { PpgFrame, PpgQualityReason } from './types';

/** Seconds of recent signal a live reading looks at. */
export const LIVE_WINDOW_SEC = 20;

/**
 * Shortest window a rhythm claim may rest on.
 *
 * ⚠️ Measured, not chosen: at 15 s the live rhythm component separates the
 * fixtures cleanly (clean 1.00, weakly perfused 0.03–0.49, heavy motion
 * 0.00–0.51). Shorter windows have too few beats for the autocorrelation to
 * distinguish a pulse from a wobble.
 */
export const MIN_LIVE_WINDOW_SEC = 15;

/** Fewest frames worth reducing at all. */
export const MIN_LIVE_FRAMES = 10;

/**
 * Consecutive passing windows before the lock holds.
 *
 * ⚠️ Duration is half of what makes the lock honest. A single window's gate is
 * met intermittently by captures that end in a refusal, so the gate has to
 * hold across successive windows — that is what separates "the signal is good"
 * from "the signal was briefly lucky".
 */
export const LOCK_CONSECUTIVE_WINDOWS = 4;

/**
 * Rhythm clarity the lock needs, over and above the mode's reading gate.
 *
 * 🔴 Stricter than the final gate on purpose, and measured rather than chosen.
 * A 20-second autocorrelation can lock onto noise that the full 90 seconds
 * rejects, so `meetsReadingGate` alone (the mode's own threshold, raw
 * periodicity ≥ 0.35) is met by captures that end in a refusal. At a rhythm
 * component of 0.5 the fixtures separate completely — longest run of
 * consecutive passing windows out of 38:
 *
 * | fixture           | final reading | longest run |
 * |-------------------|---------------|-------------|
 * | clean             | 68 bpm        | 38          |
 * | perfusion 0.2-0.35| 68 bpm        | 38          |
 * | motion 0.6        | 68 bpm        | 38          |
 * | dropped frames    | 68 bpm        | 38          |
 * | poor coverage     | 68 bpm        | 38          |
 * | irregular rhythm  | 70 bpm        | 5           |
 * | motion 1.2        | **refused**   | 1           |
 * | weakly perfused   | **refused**   | 0           |
 * | clipped exposure  | **refused**   | 0           |
 *
 * Every capture that yields a reading clears four consecutive windows; no
 * capture that ends in a refusal comes close. Re-measure if the rhythm ramp
 * bounds or the window length change.
 */
export const MIN_LOCK_COHERENCE = 0.5;

/** What the surface may say right now. */
export interface LiveReading {
  /** Seconds of signal in the window. */
  secondsAnalysed: number;
  /** Contact completeness and steadiness, 0..1. */
  contactCoverage: number;
  /** Exposure headroom, 0..1. */
  lightStability: number;
  /** Movement corruption, 0..1 — 1 = worst, as in `PpgSignalQuality`. */
  motionArtifact: number;
  /** Rhythm clarity 0..1, or null while the window is too short to look. */
  rhythmicCoherence: number | null;
  /** Quality 0-100 for the window, or null before a rhythm can be assessed. */
  score: number | null;
  /** What to tell the user, in the same vocabulary as the final result. */
  reasons: PpgQualityReason[];
  /**
   * True when this window on its own meets the gate the final heart rate has
   * to pass. One window is not the lock — see `advancePulseLock`.
   */
  meetsReadingGate: boolean;
}

/**
 * Assesses the most recent frames of a running capture.
 *
 * @param frames - The recent window's frames, oldest first.
 * @param mode - The scan the user actually started; its gate is the one quoted.
 * @returns What may be said right now.
 */
export function assessLiveWindow(frames: readonly PpgFrame[], mode: ScanMode): LiveReading {
  const frameParts = assessFrameComponents(frames);
  const base = {
    contactCoverage: round2(frameParts.contactComponent),
    lightStability: round2(frameParts.lightComponent),
    motionArtifact: round2(1 - frameParts.stability),
  };

  if (frames.length < MIN_LIVE_FRAMES) {
    return {
      ...base,
      secondsAnalysed: 0,
      rhythmicCoherence: null,
      score: null,
      reasons: [],
      meetsReadingGate: false,
    };
  }

  const spanSec = (frames[frames.length - 1].timestampMs - frames[0].timestampMs) / 1000;

  // Below the rhythm minimum the frames still say plenty about contact and
  // light — but nothing about a pulse, so nothing is claimed about one.
  if (spanSec < MIN_LIVE_WINDOW_SEC) {
    return {
      ...base,
      secondsAnalysed: round1(spanSec),
      rhythmicCoherence: null,
      score: null,
      reasons: frameLevelReasons(frameParts),
      meetsReadingGate: false,
    };
  }

  const resampled = resampleUniform(
    frames.map((f) => f.timestampMs),
    frames.map((f) => f.red),
    PPG_RESAMPLE_HZ,
  );
  if (resampled === null) {
    return {
      ...base,
      secondsAnalysed: round1(spanSec),
      rhythmicCoherence: null,
      score: null,
      reasons: ['unstable_sampling'],
      meetsReadingGate: false,
    };
  }

  const durationSec = resampled.values.length / resampled.sampleRateHz;
  const cardiac = bandPass(resampled.values, resampled.sampleRateHz);
  const rate = estimateRate(cardiac, resampled.sampleRateHz);
  const periodicity = rate?.periodicity ?? 0;

  const quality = assessPpgQuality({
    frames,
    periodicity,
    perfusion: perfusionIndex(resampled.values, cardiac),
    frameDropFraction: resampled.gapFraction,
    durationSec,
    // The window's own minimum, not the mode's: a 20-second live window is not
    // an incomplete 90-second capture, and flooring its score as if it were
    // would make every live readout say "too short" for the whole capture.
    minDurationSec: MIN_LIVE_WINDOW_SEC,
  });

  return {
    contactCoverage: quality.components.coverage,
    lightStability: quality.components.clipping,
    motionArtifact: round2(1 - quality.components.motion),
    rhythmicCoherence: quality.components.periodicity,
    secondsAnalysed: round1(durationSec),
    score: quality.score,
    reasons: quality.reasons,
    // 🔴 The same two conditions `analyzePpgScan` applies to the heart rate.
    // Quoted from the mode's own config rather than restated, so a change to
    // the gate cannot leave the live readout promising the old one.
    meetsReadingGate:
      quality.score >= SCAN_MODE_CONFIGS[mode].minQualityForHeartRate &&
      periodicity >= MIN_PERIODICITY,
  };
}

/** Reasons derivable from frames alone, before any rhythm is assessed. */
function frameLevelReasons(parts: ReturnType<typeof assessFrameComponents>): PpgQualityReason[] {
  const reasons: PpgQualityReason[] = [];
  if (parts.contactComponent < 0.5) reasons.push('unstable_coverage');
  else if (parts.coverage >= 0.95) reasons.push('full_coverage');
  if (parts.stability < 0.5) reasons.push('motion_detected');
  else if (parts.stability > 0.8) reasons.push('low_motion');
  if (parts.lightComponent < 0.5) reasons.push('sensor_clipping');
  return reasons;
}

/** How long the signal has held the reading gate. */
export interface PulseLockState {
  /** Consecutive windows that met the gate. Reset by any that did not. */
  consecutive: number;
  /** True while the signal has held long enough to say so. */
  locked: boolean;
}

export const INITIAL_PULSE_LOCK: PulseLockState = { consecutive: 0, locked: false };

/**
 * Advances the lock with one live reading.
 *
 * 🔴 Not sticky. A capture whose finger slips after locking loses the lock —
 * a lock that survives the condition it describes is a claim about the past
 * presented as the present.
 *
 * @param state - The lock so far.
 * @param reading - The window just assessed.
 * @returns The new lock state.
 */
export function advancePulseLock(state: PulseLockState, reading: LiveReading): PulseLockState {
  const holds =
    reading.meetsReadingGate && (reading.rhythmicCoherence ?? 0) >= MIN_LOCK_COHERENCE;
  const consecutive = holds ? state.consecutive + 1 : 0;
  return { consecutive, locked: consecutive >= LOCK_CONSECUTIVE_WINDOWS };
}

/** The frames of the last `seconds` of a capture, by timestamp rather than count. */
export function recentFrames(
  frames: readonly PpgFrame[],
  seconds: number = LIVE_WINDOW_SEC,
): readonly PpgFrame[] {
  if (frames.length === 0) return frames;
  const cutoff = frames[frames.length - 1].timestampMs - seconds * 1000;
  let start = frames.length;
  // Dropped frames make a count-based window lie about how much time it covers.
  while (start > 0 && frames[start - 1].timestampMs >= cutoff) start--;
  return frames.slice(start);
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
