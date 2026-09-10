/**
 * @module biometric/ppg/replay
 * @description Deterministic synthetic PPG, and the fixtures the pipeline is
 * held to.
 *
 * This exists so the algorithm can be finished and defended without a Mac, an
 * iPhone, or a fingertip. It is a test instrument, not a data source: nothing
 * it produces may ever reach a user-facing reading.
 *
 * The generator returns the beat times it actually used alongside the frames.
 * Tests compare recovered values against that ground truth rather than against
 * the nominal parameters — respiratory sinus arrhythmia and beat jitter both
 * move the realised intervals away from whatever was asked for, and a test
 * that checked the request instead of the result would be checking nothing.
 */

import type { PpgFrame } from './types';

/** Sensor ceiling for an 8-bit channel. */
const CHANNEL_MAX = 255;

/** Resting red-channel level with a fingertip over the lens and flash on. */
const BASE_DC = 190;

/**
 * Pulse amplitude at `perfusion: 1`, as a fraction of the DC level. Real
 * fingertip PPG modulates the transmitted light by roughly 1-3%; the whole
 * difficulty of camera PPG is that the signal is this small.
 */
const AC_FRACTION_AT_FULL_PERFUSION = 0.025;

/** How the synthetic scan is shaped. */
export interface SyntheticPpgOptions {
  /** Mean heart rate to generate. */
  bpm: number;
  /** Length of the capture in seconds. */
  durationSec: number;
  /** Nominal camera frame rate. */
  sampleRateHz: number;
  /** Beat-to-beat jitter standard deviation in ms — the source of HRV. */
  beatJitterMs: number;
  /** Respiration rate driving both RSA and baseline wander. */
  respirationBrpm: number;
  /** Peak-to-peak RSA modulation of the beat interval, in ms. */
  rsaAmplitudeMs: number;
  /** Pulse strength, 1 = healthy fingertip contact, 0.1 = barely perfused. */
  perfusion: number;
  /** Random-walk motion amplitude in channel units. */
  motionAmplitude: number;
  /** Sensor noise standard deviation in channel units. */
  noiseSd: number;
  /** Extra DC offset pushing the signal toward the sensor ceiling. */
  exposureBias: number;
  /** Fraction of frames dropped at random, 0..1. */
  dropFraction: number;
  /** Mean ROI coverage, 0..1. */
  coverage: number;
  /** How much coverage wobbles frame to frame, 0..1. */
  coverageWobble: number;
  /** Seed — the same seed always produces the same frames. */
  seed: number;
  /** Timestamp of the first frame (Unix ms). */
  startedAtMs: number;
}

/** What the generator actually produced, for tests to compare against. */
export interface SyntheticPpgTruth {
  /** Beat times in ms relative to the first frame. */
  beatTimesMs: number[];
  /** Realised inter-beat intervals in ms. */
  intervalsMs: number[];
  /** RMSSD of the realised intervals, in ms. */
  rmssdMs: number;
  /** Mean heart rate implied by the realised intervals. */
  meanBpm: number;
  /** Respiration rate that drove RSA and wander. */
  respirationBrpm: number;
}

/** A synthetic capture: frames as the camera would hand them over, plus truth. */
export interface SyntheticPpgScan {
  frames: PpgFrame[];
  truth: SyntheticPpgTruth;
}

/**
 * Small, fast, fully deterministic PRNG (mulberry32). Determinism is the point:
 * a fixture that drifts between runs cannot hold a threshold in place.
 *
 * @param seed - Any 32-bit seed.
 * @returns A function returning successive uniforms in [0, 1).
 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Box-Muller normal sample from a uniform generator. */
function gaussian(rand: () => number): number {
  const u = Math.max(rand(), Number.EPSILON);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand());
}

/**
 * Normalized fingertip pulse shape over one cardiac cycle.
 * Two overlapping Gaussians: the systolic upstroke and the smaller dicrotic
 * wave after it. The second bump matters — a naive detector locks onto it and
 * reports double the true rate, which is exactly the failure a sine wave
 * fixture would never expose.
 *
 * @param phase - Position within the beat, 0..1.
 * @returns Relative amplitude, roughly 0..1.
 */
export function pulseShape(phase: number): number {
  const systolic = Math.exp(-(((phase - 0.18) / 0.1) ** 2));
  const dicrotic = 0.35 * Math.exp(-(((phase - 0.45) / 0.13) ** 2));
  return systolic + dicrotic;
}

/** Defaults describing a good scan: still finger, full coverage, clean sensor. */
export const CLEAN_SCAN: SyntheticPpgOptions = {
  bpm: 68,
  durationSec: 60,
  sampleRateHz: 30,
  // At rest, respiratory sinus arrhythmia is the larger share of beat-to-beat
  // variability, not a minor term on top of noise. An earlier version had these
  // the other way round, which made the respiration path untestable: every
  // fixture refused, and the refusal looked like correct caution.
  beatJitterMs: 12,
  respirationBrpm: 14,
  rsaAmplitudeMs: 55,
  perfusion: 1,
  motionAmplitude: 0,
  noiseSd: 0.35,
  exposureBias: 0,
  dropFraction: 0,
  coverage: 0.98,
  coverageWobble: 0.01,
  seed: 20260910,
  startedAtMs: 1_760_000_000_000,
};

/**
 * Generates a synthetic capture.
 *
 * @param overrides - Fields to change from `CLEAN_SCAN`.
 * @returns Frames plus the ground truth used to build them.
 */
export function synthesizePpg(overrides: Partial<SyntheticPpgOptions> = {}): SyntheticPpgScan {
  const o: SyntheticPpgOptions = { ...CLEAN_SCAN, ...overrides };
  const rand = mulberry32(o.seed);

  // ── Beat times ────────────────────────────────────────────────────────────
  // Interval = mean + RSA(respiration phase) + jitter. RSA is applied at the
  // beat's own position in the breathing cycle, which is what makes the
  // interval series carry a recoverable respiration rate at all.
  const meanIntervalMs = 60_000 / o.bpm;
  const respHz = o.respirationBrpm / 60;
  const durationMs = o.durationSec * 1000;

  const beatTimesMs: number[] = [];
  const intervalsMs: number[] = [];
  let beatAt = 0;

  while (beatAt < durationMs) {
    beatTimesMs.push(beatAt);
    const rsa = (o.rsaAmplitudeMs / 2) * Math.sin(2 * Math.PI * respHz * (beatAt / 1000));
    const jitter = gaussian(rand) * o.beatJitterMs;
    const interval = Math.max(300, meanIntervalMs + rsa + jitter);
    intervalsMs.push(interval);
    beatAt += interval;
  }
  // The last interval runs past the window; it produced no second beat.
  intervalsMs.pop();

  // ── Frames ────────────────────────────────────────────────────────────────
  const acAmplitude = BASE_DC * AC_FRACTION_AT_FULL_PERFUSION * o.perfusion;
  const frameIntervalMs = 1000 / o.sampleRateHz;
  const frameCount = Math.floor(durationMs / frameIntervalMs);

  const frames: PpgFrame[] = [];
  let motionWalk = 0;
  let beatIndex = 0;

  for (let i = 0; i < frameCount; i++) {
    const tMs = i * frameIntervalMs;

    if (rand() < o.dropFraction) continue;

    // Advance to the beat this frame falls inside.
    while (beatIndex + 1 < beatTimesMs.length && beatTimesMs[beatIndex + 1] <= tMs) {
      beatIndex++;
    }
    const beatStart = beatTimesMs[beatIndex];
    const beatLength = intervalsMs[beatIndex] ?? meanIntervalMs;
    const phase = Math.min(1, Math.max(0, (tMs - beatStart) / beatLength));

    // Respiratory baseline wander, scaled with perfusion so a barely-perfused
    // finger does not get a suspiciously clean wander to lock onto.
    const wander = 1.6 * o.perfusion * Math.sin(2 * Math.PI * respHz * (tMs / 1000));

    motionWalk = motionWalk * 0.92 + gaussian(rand) * o.motionAmplitude;

    const raw =
      BASE_DC +
      o.exposureBias +
      acAmplitude * pulseShape(phase) +
      wander +
      motionWalk +
      gaussian(rand) * o.noiseSd;

    const red = Math.min(CHANNEL_MAX, Math.max(0, raw));
    const clippedFraction = raw > CHANNEL_MAX ? Math.min(1, (raw - CHANNEL_MAX) / 6) : 0;

    const coverage = Math.min(
      1,
      Math.max(0, o.coverage + gaussian(rand) * o.coverageWobble),
    );
    // Motion as the capture layer would report it: scaled displacement.
    const motion = Math.min(1, Math.abs(motionWalk) / 12);

    frames.push({
      timestampMs: o.startedAtMs + tMs,
      red,
      // Ambient channels carry a much weaker pulse under a flash.
      green: Math.min(CHANNEL_MAX, 90 + acAmplitude * 0.12 * pulseShape(phase) + gaussian(rand) * o.noiseSd),
      blue: Math.min(CHANNEL_MAX, 70 + gaussian(rand) * o.noiseSd),
      clippedFraction,
      coverage,
      motion,
    });
  }

  const rmssdMs = rootMeanSquareOfSuccessiveDifferences(intervalsMs);
  const meanInterval =
    intervalsMs.length > 0
      ? intervalsMs.reduce((a, b) => a + b, 0) / intervalsMs.length
      : meanIntervalMs;

  return {
    frames,
    truth: {
      beatTimesMs,
      intervalsMs,
      rmssdMs,
      meanBpm: 60_000 / meanInterval,
      respirationBrpm: o.respirationBrpm,
    },
  };
}

/** RMSSD helper used only to describe the generated truth. */
function rootMeanSquareOfSuccessiveDifferences(intervals: readonly number[]): number {
  if (intervals.length < 2) return 0;
  let sum = 0;
  for (let i = 1; i < intervals.length; i++) {
    sum += (intervals[i] - intervals[i - 1]) ** 2;
  }
  return Math.sqrt(sum / (intervals.length - 1));
}

/**
 * The scan conditions the pipeline is held to. Each one is a real failure mode
 * of fingertip camera PPG, and each has a fixed expectation in the tests: what
 * the pipeline must still report, and what it must refuse to report.
 */
export const PPG_FIXTURES: Readonly<Record<string, Partial<SyntheticPpgOptions>>> = {
  /** Still finger, full coverage — everything should be available. */
  clean: {},
  /** Finger moving throughout: heart rate may survive, beat timing should not. */
  motion: { motionAmplitude: 3.2, coverageWobble: 0.08, seed: 4242 },
  /** Cold or poorly pressed fingertip: pulse barely above the noise floor. */
  lowPerfusion: { perfusion: 0.08, seed: 991 },
  /** Flash too close to the sensor: the waveform is flattened at the ceiling. */
  clipped: { exposureBias: 70, seed: 7007 },
  /** Beat timing that is genuinely irregular rather than noisy. */
  irregular: { beatJitterMs: 150, seed: 3131 },
  /** A device dropping a third of its frames under thermal load. */
  frameDrops: { dropFraction: 0.34, seed: 5150 },
  /** Finger lifted part-way through. */
  poorCoverage: { coverage: 0.4, coverageWobble: 0.22, seed: 8080 },
  /** Ten seconds — below what any mode accepts. */
  tooShort: { durationSec: 10, seed: 6060 },
};
