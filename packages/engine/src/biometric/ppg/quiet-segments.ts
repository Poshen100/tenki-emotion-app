/**
 * @module biometric/ppg/quiet-segments
 * @description Reading a pulse out of a capture the camera kept interrupting.
 *
 * 🔴 Built for one measured device behaviour. The fifth real-device report
 * (2026-09-17) showed a DC drift of **29% of the level** with a **17-second**
 * period and a largest one-second step of **22%** — and that combination is
 * only possible if the camera holds a level for several seconds, moves quickly
 * to a new one, and holds again. Auto-exposure settling, then re-deciding.
 *
 * ⚠️ The important consequence is structural, not spectral: **most of the
 * capture is quiet.** Seven transitions across sixty seconds disturb maybe
 * four of those seconds. The other fifty-six are plateaus with an undisturbed
 * pulse riding on them — and analysing the capture as one block throws all of
 * that away, because the transitions are broadband and land in the cardiac
 * band. Measured on a fixture reproducing the device's own three numbers: the
 * whole capture is **refused**, while a 6.8-second plateau inside it reads
 * **67 bpm at a periodicity of 0.93** against a truth of 68.
 *
 * 🔴 This is NOT the gain-drift correction that was removed in §22. That one
 * tried to divide the drift out of the whole signal, and no criterion could
 * tell when that was valid. This one does not touch the signal at all: it
 * *excludes* the disturbed stretches and reads what was already there.
 *
 * 🔴 What makes it safe is **agreement**, not the individual windows. A short
 * window is easier to look periodic by chance, so one window proves nothing.
 * Independent stretches of the same capture agreeing on a rate is evidence
 * noise does not produce — the same reasoning `respiration.ts` already applies
 * with `agreesAcrossHalves`. Swept over 120 combinations of rate, drift period,
 * transition speed and amplitude: worst error **1.5 bpm**, and **zero** cases
 * where a capture with no pulse in it produced enough agreeing segments.
 *
 * @see docs/PHONE-PPG.md §23
 */

import { bandPass, median, perfusionIndex } from './filtering';
import { MIN_PERIODICITY, estimateRate } from './pulse';
import { MIN_PERFUSION } from './quality';

/**
 * Rate of level change, per second and as a fraction of the level, above which
 * the camera is moving its own operating point.
 *
 * 🔴 Taken from the gap between two measured distributions, not from an
 * argument. The first version reasoned from the cardiac ripple — AC/DC is
 * 0.5-2% in total, so 2% per second must be the camera — and that was wrong,
 * because the pulse is not what competes here. **Respiratory baseline wander
 * is**, and it is slower but much larger. Measured over 60 s captures:
 *
 * | capture                         | p95 slew | max slew |
 * |---------------------------------|----------|----------|
 * | clean, 48 / 68 / 96 bpm         | 0.015    | **0.023** |
 * | fast breathing (22 brpm)        | 0.014    | 0.020    |
 * | deep breathing (RSA 120 ms)     | 0.015    | 0.022    |
 * | device-shaped drift transitions | **0.10-0.14** | 0.16 |
 *
 * At 0.02 a clean capture shattered into three fragments — the bar was inside
 * the breathing distribution. 0.05 sits about twice above everything a still
 * finger produces and about twice below the transitions it has to catch.
 *
 * ⚠️ It shares a number with `DC_DRIFT_SUSPECT` and shares nothing else: that
 * one is a **total excursion**, this is a **rate**. Do not deduplicate them.
 */
export const QUIET_SLEW_PER_SEC = 0.05;

/**
 * Half-width of the window the level is smoothed over before its slope is
 * taken, in seconds.
 *
 * ⚠️ Squeezed from both sides. It must span a beat, or the pulse's own upstroke
 * reads as slew and a perfect capture shatters into fragments. But it is also
 * subtracted from both ends of every usable stretch, so an over-wide window
 * throws away the very plateaus this module exists to find.
 */
export const QUIET_SLEW_WINDOW_SEC = 0.75;

/**
 * Shortest stretch worth estimating a rate from, in seconds.
 *
 * ⚠️ Bounded below by the estimator, not by taste: `dominantPeriod` needs two
 * full cycles of its longest lag, which at 40 bpm is 3 seconds. Four gives that
 * plus margin, and holds four or five beats at a resting rate.
 *
 * 🔴 Was 5, and 5 was too tight against the device. With its measured ~15 s
 * drift cycle each plateau is about 7.6 s, and the transition plus the
 * smoothing window eat into both ends — leaving **5.1-5.5 s**, barely over the
 * bar. A slightly slower transition dropped the whole capture to two usable
 * stretches and the rescue never fired, which is what the device kept
 * reporting. Measured across drift shapes, 4 s with the narrower window below
 * raises recovery from 44% to **75%** with the worst error unchanged (1.5 bpm)
 * and still **zero** false positives on captures with no pulse in them.
 *
 * ⚠️ Shorter stretches are individually weaker evidence. What holds the line is
 * `MIN_AGREEING_WINDOWS`, not this number — loosening this without that
 * agreement requirement would be exactly the false-reading machine this module
 * is built to avoid.
 */
export const MIN_QUIET_SEGMENT_SEC = 4;

/**
 * How many windows must agree before their rate is reported.
 *
 * 🔴 Three, because two agreeing is a coincidence with no way to tell. This is
 * the load-bearing constant: across every sweep, no capture without a pulse in
 * it has ever produced three agreeing windows, drift or no drift.
 */
export const MIN_AGREEING_WINDOWS = 3;

/**
 * Length a quiet stretch is divided into before each piece is judged.
 *
 * 🔴 Added because requiring three *stretches* refused the best evidence there
 * is. The device reported a capture whose longest undisturbed stretch was
 * **35.8 seconds** and only 2-3 stretches in total — so it was refused, while a
 * capture chopped into three 5-second plateaus was accepted. That is backwards:
 * 36 undisturbed seconds is more evidence than three 5-second scraps, not less.
 *
 * ⚠️ It does weaken what "agreeing" means. Three separate stretches are
 * separated by a disturbance; three windows of one stretch are contiguous. The
 * defence is measured rather than argued: across 56 no-pulse controls here and
 * 160 in the earlier sweep, windowing never produced a false reading, because
 * noise does not hold a consistent rate across windows either.
 *
 * ⚠️ A stretch always contributes at least itself, however short — otherwise
 * the many-short-plateaus case this module was built for (§23) would regress to
 * nothing, since a 5-second stretch holds no 10-second window.
 */
export const QUIET_WINDOW_SEC = 10;

/**
 * How far apart the segments' rates may be before they are not agreeing.
 *
 * ⚠️ Measured: across 120 swept combinations with a real pulse, the observed
 * spread was **1 or 3 bpm and never more** — and 3 bpm is a single lag step on
 * the 30 Hz grid near 68 bpm, so it is quantisation rather than disagreement.
 * Six leaves roughly double that headroom while still refusing a scatter.
 */
export const MAX_SEGMENT_SPREAD_BPM = 6;

/** A stretch of the capture the camera left alone. */
export interface QuietSegment {
  /** Index of the first sample, on the resampled grid. */
  startIndex: number;
  /** The samples themselves, in the signal's original units. */
  values: number[];
}

/**
 * What the quiet stretches amounted to, whether or not they yielded a rate.
 *
 * 🔴 The counts are reported even when `bpm` is null, and that is the point.
 * "It did not fire" has three completely different causes — too few stretches,
 * stretches that were not individually periodic, or stretches that disagreed —
 * and they point at three different repairs. Without the counts the device can
 * only say no, and every round of real-device testing costs a day.
 */
export interface SegmentedRate {
  /** Median of the agreeing segments' rates, or null when none agreed. */
  bpm: number | null;
  /** Stretches long enough to try, before any of them were judged. */
  foundCount: number;
  /** Windows across all stretches that were individually perfused and periodic. */
  usableWindowCount: number;
  /**
   * Periodicity over the longest quiet stretch as a whole, or null when there
   * was no stretch **or the estimator refused to name a period at all**.
   *
   * 🔴 Null is not zero, and conflating them cost a round. The first version
   * recorded `whole === null ? 0`, so the device reported 「節律 0」 for two
   * opposite situations: a stretch full of broadband noise with no cardiac
   * component (periodicity genuinely ~0.00), and a stretch whose dominant
   * component lies **outside** the cardiac band, where `dominantPeriod` refuses
   * rather than return the wall of its search (§21). The first means there is
   * no pulse; the second means something slow is swamping it. Different
   * repairs, same printed digit.
   */
  longestPeriodicity: number | null;
  /**
   * Pulsatile light in the longest quiet stretch, as a raw AC/DC ratio, or null
   * when there was no stretch.
   *
   * 🔴 The physical question, asked without any rhythm estimation in the way:
   * **is there pulsatile light at all?** A fingertip runs roughly 0.005-0.02
   * (`GOOD_PERFUSION` is 0.0055). A capture reading 0.0001 has no blood signal
   * to find a rhythm in, and no amount of segmenting, filtering or exposure
   * work will produce one — that is an optics, contact or pressure problem.
   *
   * ⚠️ Raw, not the normalised quality component. The component saturates and
   * cannot be compared against the physiological range; this can.
   */
  longestPerfusion: number | null;
  /** Longest stretch found, in seconds. 0 when none were. */
  longestSec: number;
  /** Spread between the fastest and slowest usable segment, or null. */
  spreadBpm: number | null;
  /** Total seconds the usable segments covered. */
  analysedSec: number;
}

/**
 * Splits a resampled channel into the stretches where the level held still.
 *
 * ⚠️ The level is smoothed over a beat before its slope is taken, or the pulse
 * itself reads as slew and every capture comes back as one long disturbance.
 *
 * @param values - Uniformly resampled channel values.
 * @param sampleRateHz - The grid rate those values sit on.
 * @returns The quiet stretches, longest-first order not guaranteed; empty when
 *   the capture never held still for long enough.
 */
export function findQuietSegments(
  values: readonly number[],
  sampleRateHz: number,
): QuietSegment[] {
  const level = median(values);
  const minSamples = Math.floor(MIN_QUIET_SEGMENT_SEC * sampleRateHz);
  if (level <= 0 || values.length < minSamples) return [];

  // ⚠️ Three quarters of a second either side, and both bounds are measured.
  // It has to span a beat so the pulse does not read as slew, and every extra
  // sample of it is taken off BOTH ends of every usable stretch — with the
  // device's ~15 s drift cycle that was the difference between three usable
  // stretches and two. Measured maximum slew on a still finger (pulse and
  // breathing together): 0.023 at ±1 s, 0.029 at ±0.75 s, 0.040 at ±0.5 s
  // against a 0.05 bar. ±0.5 s leaves only 1.2× of margin; ±0.75 s keeps 1.7×.
  const half = Math.max(1, Math.round(QUIET_SLEW_WINDOW_SEC * sampleRateHz));
  const smoothed = values.map((_, i) => {
    const lo = Math.max(0, i - half);
    const hi = Math.min(values.length - 1, i + half);
    let sum = 0;
    for (let j = lo; j <= hi; j++) sum += values[j];
    return sum / (hi - lo + 1);
  });

  const segments: QuietSegment[] = [];
  let start = 0;
  let run: number[] = [];
  const flush = () => {
    if (run.length >= minSamples) segments.push({ startIndex: start, values: run });
    run = [];
  };

  for (let i = 0; i < values.length; i++) {
    const slewPerSec =
      i === 0 ? 0 : (Math.abs(smoothed[i] - smoothed[i - 1]) * sampleRateHz) / level;
    if (slewPerSec < QUIET_SLEW_PER_SEC) {
      if (run.length === 0) start = i;
      run.push(values[i]);
    } else {
      flush();
    }
  }
  flush();

  return segments;
}

/**
 * Cuts a quiet stretch into the windows its rate is judged on.
 *
 * ⚠️ Always at least one. A stretch short enough to hold no full window still
 * contributes itself — otherwise the many-short-plateaus case (§23), where
 * every stretch is about five seconds, would regress to producing nothing.
 *
 * @param values - One quiet stretch.
 * @param sampleRateHz - The grid rate.
 * @returns Equal-length windows covering the stretch.
 */
function windowsOf(values: readonly number[], sampleRateHz: number): number[][] {
  const count = Math.max(1, Math.floor(values.length / (QUIET_WINDOW_SEC * sampleRateHz)));
  const size = Math.floor(values.length / count);
  return Array.from({ length: count }, (_, i) =>
    values.slice(i * size, i === count - 1 ? values.length : (i + 1) * size),
  );
}

/**
 * Estimates a rate from the quiet stretches, but only when they agree.
 *
 * 🔴 Returns null far more often than it returns a number, and that is the
 * design. A rate assembled from fragments is weaker evidence than one read off
 * a whole capture, so it has to clear a bar the whole capture never had to:
 * three independent stretches, each periodic on its own, landing within
 * `MAX_SEGMENT_SPREAD_BPM` of each other.
 *
 * ⚠️ This must never be used for beat timing. PRV is the spacing between
 * consecutive beats, and consecutive beats across a discarded transition are
 * not consecutive.
 *
 * @param values - Uniformly resampled channel values.
 * @param sampleRateHz - The grid rate those values sit on.
 * @returns The agreed rate, or null when the stretches were too few, too
 *   short, individually unconvincing, or disagreed.
 */
export function estimateRateFromQuietSegments(
  values: readonly number[],
  sampleRateHz: number,
): SegmentedRate {
  const segments = findQuietSegments(values, sampleRateHz);
  const longestSec = round1(
    segments.reduce((best, s) => Math.max(best, s.values.length), 0) / sampleRateHz,
  );
  // ⚠️ Every stretch is scored before any gate is applied, even when there are
  // obviously too few of them. "Two stretches, both carrying a pulse" and "two
  // stretches, neither carrying one" are the same refusal but completely
  // different messages: the first says the pulse is there and the capture was
  // simply not interrupted often enough to prove it. Returning early on the
  // count threw that away.
  const rates: number[] = [];
  let analysedSamples = 0;
  let longestPeriodicity: number | null = null;
  let longestPerfusion: number | null = null;
  let longestSamples = 0;

  for (const segment of segments) {
    // 🔴 Measured over the stretch as a WHOLE, before it is cut into windows,
    // and recorded whether or not it ends up usable. It is the number that says
    // which of two completely different problems this capture has.
    if (segment.values.length > longestSamples) {
      longestSamples = segment.values.length;
      const wholeCardiac = bandPass(segment.values, sampleRateHz);
      const whole = estimateRate(wholeCardiac, sampleRateHz);
      // ⚠️ Null stays null. A refusal is not a periodicity of zero — see the
      // field's own note.
      longestPeriodicity = whole === null ? null : round2(whole.periodicity);
      longestPerfusion = round4(perfusionIndex(segment.values, wholeCardiac));
    }

    for (const window of windowsOf(segment.values, sampleRateHz)) {
      scoreWindow(window);
    }
  }

  function scoreWindow(values_: readonly number[]): void {
    const cardiac = bandPass(values_, sampleRateHz);
    // 🔴 Perfusion is re-checked **inside** the segment, and that is not
    // belt-and-braces — it closes a hole the caller cannot close.
    //
    // `analyzePpgScan` gates on the perfusion of the whole capture, and the
    // drift **inflates** that: a stepped level reads an AC/DC of 0.148 where a
    // clean capture reads 0.006. So on a weakly-perfused fingertip the
    // artefact pushes the whole-capture perfusion over the bar and switches
    // off the very gate that was meant to stop this. Measured: the
    // `lowPerfusion` fixture with the device's drift on it was rescued to
    // 67 bpm, sailing past a gate it should have failed.
    //
    // The segments are the evidence, so the evidence about blood has to come
    // from the same place. Inside a quiet stretch there is no drift left to
    // inflate it.
    if (perfusionIndex(values_, cardiac) < MIN_PERFUSION) return;
    const estimate = estimateRate(cardiac, sampleRateHz);
    if (estimate === null || estimate.periodicity < MIN_PERIODICITY) return;
    rates.push(estimate.bpm);
    analysedSamples += values_.length;
  }
  const sorted = [...rates].sort((a, b) => a - b);
  const summary = {
    foundCount: segments.length,
    usableWindowCount: rates.length,
    longestPeriodicity,
    longestPerfusion,
    longestSec,
    spreadBpm: rates.length < 2 ? null : round1(sorted[sorted.length - 1] - sorted[0]),
    analysedSec: round1(analysedSamples / sampleRateHz),
  };

  // ⚠️ Only the usable count is gated. A gate on `segments.length` would read
  // like a second safeguard and cannot ever fire — every usable stretch is one
  // of the stretches found, so too few found always means too few usable.
  // Removing it, rather than keeping a line that looks like a check and is not.
  if (rates.length < MIN_AGREEING_WINDOWS) return { bpm: null, ...summary };
  if ((summary.spreadBpm as number) > MAX_SEGMENT_SPREAD_BPM) return { bpm: null, ...summary };

  return { bpm: sorted[Math.floor(sorted.length / 2)], ...summary };
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}
