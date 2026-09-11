/**
 * ⚠️ GENERATED FILE — DO NOT EDIT.
 *
 * Compiled from packages/engine/src by scripts/build-preview-ppg.mjs so the
 * preview runs the engine's own pipeline instead of a hand-written mirror.
 * Edit the TypeScript, then run: node scripts/build-preview-ppg.mjs
 * The merge gate (scripts/preview-ppg-sync.mjs) fails if the two drift apart.
 */
/**
 * @module biometric/ppg/respiration
 * @description Respiration rate from the beat-interval series (the tachogram).
 *
 * Breathing modulates beat timing — respiratory sinus arrhythmia — so a clean
 * enough interval series carries the breathing rate. "Clean enough" is the
 * whole problem, and it is why this module exists as a replacement rather than
 * a wrapper.
 *
 * 🔴 The estimator this replaces for camera scans (`estimateBrpmFromRRIntervals`
 * in `biometric/rr.ts`) counts sign changes in successive interval differences.
 * When beat-to-beat jitter is larger than the RSA — which is the normal case
 * for optical beat timing — nearly every successive difference changes sign, so
 * the "breath count" becomes a function of the BEAT count. Measured against the
 * synthetic fixtures at a fixed 14 brpm, it returned 14.3 at 50 bpm and 33.8 at
 * 105 bpm: a number that tracked the heart rate and looked entirely
 * physiological the whole way up. It is still exported for the legacy callers
 * that predate this module; nothing on the camera path may use it.
 *
 * The estimate here instead asks whether the tachogram has a dominant component
 * inside the respiratory band at all, and returns null when it does not.
 */
import { bandPass, detrend, dominantPeriod } from './filtering.js';
/** Slowest breathing the band admits, in Hz (6 brpm). */
export const RESPIRATION_MIN_HZ = 0.1;
/** Fastest breathing the band admits, in Hz (30 brpm). */
export const RESPIRATION_MAX_HZ = 0.5;
/** Rate the unevenly-spaced interval series is resampled onto, in Hz. */
export const TACHOGRAM_HZ = 4;
/**
 * How dominant the respiratory component must be before a rate is reported.
 * Below this the tachogram's strongest band component is jitter that happens to
 * sit in the breathing range, and the "rate" is a property of the noise.
 */
export const MIN_RESPIRATION_PERIODICITY = 0.5;
/** Shortest tachogram that can hold enough breath cycles to be checked. */
export const MIN_TACHOGRAM_SEC = 30;
/**
 * Fewest beats that must fall inside one breath cycle for the cycle to be
 * resolvable at all.
 *
 * The tachogram is sampled once per heartbeat, so the heart rate IS the sample
 * rate for breathing, and a fast breath at a slow pulse falls under its own
 * Nyquist limit. 🔴 Measured: at 68 bpm and 20 brpm — 3.4 beats per breath —
 * the estimate reported 10 brpm, a clean halving that looks like a calm
 * breather. The guard refuses that window instead. It costs the estimates that
 * would have been right at that ratio; a respiration rate reported at half is
 * worse than none, because nothing downstream can tell it apart from a real one.
 */
export const MIN_BEATS_PER_BREATH = 4;
/**
 * Estimates breathing rate from accepted beat intervals.
 *
 * @param beatTimesMs - Time of each accepted interval's closing beat, ascending.
 * @param intervalsMs - The accepted intervals, same length and order.
 * @returns The estimate, or null when the tachogram does not support one.
 */
export function estimateRespiration(beatTimesMs, intervalsMs) {
    if (beatTimesMs.length !== intervalsMs.length || intervalsMs.length < 8) {
        return null;
    }
    const spanSec = (beatTimesMs[beatTimesMs.length - 1] - beatTimesMs[0]) / 1000;
    if (spanSec < MIN_TACHOGRAM_SEC)
        return null;
    // The tachogram is unevenly sampled by construction — one value per beat, and
    // the beats are what vary. Resampling onto a uniform grid is what makes a
    // frequency question askable at all.
    const grid = resampleTachogram(beatTimesMs, intervalsMs, TACHOGRAM_HZ);
    if (grid === null)
        return null;
    const detrended = detrend(grid, Math.round(TACHOGRAM_HZ / RESPIRATION_MIN_HZ));
    const band = bandPass(detrended, TACHOGRAM_HZ, RESPIRATION_MIN_HZ, RESPIRATION_MAX_HZ);
    const minLag = Math.floor(TACHOGRAM_HZ / RESPIRATION_MAX_HZ);
    const maxLag = Math.ceil(TACHOGRAM_HZ / RESPIRATION_MIN_HZ);
    const found = dominantPeriod(band, minLag, maxLag);
    if (found === null || found.periodicity < MIN_RESPIRATION_PERIODICITY) {
        return null;
    }
    const brpm = (60 * TACHOGRAM_HZ) / found.lagSamples;
    const meanIntervalMs = intervalsMs.reduce((a, b) => a + b, 0) / intervalsMs.length;
    const breathCycleMs = 60_000 / brpm;
    if (meanIntervalMs <= 0 || breathCycleMs / meanIntervalMs < MIN_BEATS_PER_BREATH) {
        return null;
    }
    if (!agreesAcrossHalves(band, found.lagSamples, spanSec)) {
        return null;
    }
    return {
        brpm: Math.round(brpm * 10) / 10,
        periodicity: Math.round(found.periodicity * 100) / 100,
    };
}
/**
 * Puts a beat-indexed interval series onto a uniform time grid.
 *
 * @param timesMs - Beat times, ascending.
 * @param values - One interval per beat time.
 * @param rateHz - Grid rate.
 * @returns Uniformly spaced values, or null when the span is unusable.
 */
function resampleTachogram(timesMs, values, rateHz) {
    const start = timesMs[0];
    const end = timesMs[timesMs.length - 1];
    const stepMs = 1000 / rateHz;
    const points = Math.floor((end - start) / stepMs) + 1;
    if (points < 4)
        return null;
    const out = new Array(points);
    let cursor = 0;
    for (let i = 0; i < points; i++) {
        const t = start + i * stepMs;
        while (cursor + 2 < timesMs.length && timesMs[cursor + 1] < t) {
            cursor++;
        }
        const t0 = timesMs[cursor];
        const t1 = timesMs[cursor + 1];
        const span = t1 - t0;
        const alpha = span > 0 ? Math.max(0, Math.min(1, (t - t0) / span)) : 0;
        out[i] = values[cursor] + (values[cursor + 1] - values[cursor]) * alpha;
    }
    return out;
}
/** How far the two halves may disagree with the whole before the estimate drops. */
const HALF_AGREEMENT_TOLERANCE = 0.25;
/**
 * Whether both halves of the window find the same breathing period as the whole.
 *
 * A real breathing rhythm is present throughout the capture. A subharmonic
 * produced by sampling the RSA too sparsely is a property of the particular run
 * of beats and does not survive being asked twice. 🔴 This is the only check
 * that catches the remaining halving case — a 20 brpm breather at a 68 bpm
 * pulse, where the true rate is under the beats-per-breath limit and the halved
 * answer passes every other test looking entirely calm and plausible.
 *
 * Skipped for windows too short to split, where each half would hold too few
 * cycles to have an opinion worth acting on.
 */
function agreesAcrossHalves(band, fullLag, spanSec) {
    if (spanSec < MIN_TACHOGRAM_SEC * 2)
        return true;
    const mid = Math.floor(band.length / 2);
    const minLag = Math.floor(TACHOGRAM_HZ / RESPIRATION_MAX_HZ);
    const maxLag = Math.ceil(TACHOGRAM_HZ / RESPIRATION_MIN_HZ);
    for (const half of [band.slice(0, mid), band.slice(mid)]) {
        const found = dominantPeriod(half, minLag, maxLag);
        if (found === null)
            return false;
        if (Math.abs(found.lagSamples - fullLag) / fullLag > HALF_AGREEMENT_TOLERANCE)
            return false;
    }
    return true;
}
