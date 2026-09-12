/**
 * ⚠️ GENERATED FILE — DO NOT EDIT.
 *
 * Compiled from packages/engine/src by scripts/build-preview-ppg.mjs so the
 * preview runs the engine's own pipeline instead of a hand-written mirror.
 * Edit the TypeScript, then run: node scripts/build-preview-ppg.mjs
 * The merge gate (scripts/preview-ppg-sync.mjs) fails if the two drift apart.
 */
/**
 * @module biometric/ppg/exposure-stability
 * @description Is the camera holding still, or re-deciding its own exposure?
 *
 * 🔴 Built to settle one real-device result. Second run, torch on:
 *
 * | dimension | value  |
 * |-----------|--------|
 * | 接觸       | 100%   |
 * | 光         | 100%   (nothing clipped — so NOT the §16 saturation case) |
 * | 穩定       | 83%    |
 * | 節律       | **0%** |
 *
 * and the reasons said `strong_pulse` **and** `irregular_periodicity` at the
 * same time. That pair is the whole clue: there is plenty of energy in the
 * cardiac band — `perfusionIndex` is AC/DC over the band-passed signal — and
 * none of it repeats. A finger with no pulse in it would read low perfusion.
 *
 * The leading suspect is the camera itself. Auto-exposure and auto-white-balance
 * run continuously against a torch-lit fingertip and keep re-adjusting gain.
 * Those adjustments are large, step-shaped and irregular, so they land in the
 * cardiac band, dominate the small cardiac ripple, and carry no period. That is
 * why phone PPG normally locks exposure before it measures anything.
 *
 * 🔴 This module does not assert that diagnosis — it measures the thing that
 * separates it from the alternatives, so the device can answer instead of us
 * guessing:
 *
 *   - **A cardiac ripple is small.** AC/DC for a fingertip runs about 0.5-2%.
 *     So a slow DC excursion of 5% or more is several times the pulse and
 *     cannot be cardiac — it is the camera moving its own operating point.
 *   - **A stuttering timebase looks the same from the outside.** Frames per
 *     second and the longest gap separate "the camera is re-exposing" from
 *     "the page is not getting frames".
 *
 * @see docs/PHONE-PPG.md
 */
import { mean } from './filtering.js';
/**
 * Slow DC excursion, as a fraction of DC, above which the drift is bigger than
 * any pulse could be.
 *
 * ⚠️ Derived, not picked: a fingertip's pulsatile AC/DC is roughly 0.5-2%
 * (`perfusionIndex` returns that range on real captures, and `GOOD_PERFUSION`
 * is 0.0055). At 5% the slow movement is at least 2.5× the strongest cardiac
 * ripple, so whatever is moving the level is not the heart. It marks a
 * suspicion, never a verdict — the report prints the number either way.
 */
export const DC_DRIFT_SUSPECT = 0.05;
/** Seconds per bucket when reducing DC to a slow series. */
export const DC_BUCKET_SEC = 1;
/** Fewest frames worth assessing. */
export const MIN_EXPOSURE_FRAMES = 15;
/**
 * Measures how steady the camera's own operating point was.
 *
 * @param frames - The capture's frames, oldest first.
 * @param channel - Which channel's level to follow; use the one the pulse was
 *   read from when it is known, so the drift measured is the drift that
 *   mattered.
 * @returns The camera's behaviour, or null when there are too few frames to
 *   say anything. Null is not "steady".
 */
export function assessExposureStability(frames, channel = 'red') {
    if (frames.length < MIN_EXPOSURE_FRAMES)
        return null;
    const values = frames.map((f) => (channel === 'red' ? f.red : f.green));
    const spanSec = (frames[frames.length - 1].timestampMs - frames[0].timestampMs) / 1000;
    if (spanSec <= 0)
        return null;
    const dcMedian = median(values);
    if (dcMedian <= 0)
        return null;
    // One-second buckets: the cardiac ripple averages out inside a bucket, so
    // what is left between buckets is the slow movement — which is the thing
    // auto-exposure does and the heart does not.
    const startMs = frames[0].timestampMs;
    const buckets = new Map();
    for (const [i, frame] of frames.entries()) {
        const bucket = Math.floor((frame.timestampMs - startMs) / (DC_BUCKET_SEC * 1000));
        const list = buckets.get(bucket);
        if (list === undefined)
            buckets.set(bucket, [values[i]]);
        else
            list.push(values[i]);
    }
    const slow = [...buckets.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([, list]) => mean(list));
    const sorted = [...slow].sort((a, b) => a - b);
    const drift = sorted.length < 2 ? 0 : percentile(sorted, 0.95) - percentile(sorted, 0.05);
    let largestStep = 0;
    for (let i = 1; i < slow.length; i++) {
        largestStep = Math.max(largestStep, Math.abs(slow[i] - slow[i - 1]));
    }
    let longestGapMs = 0;
    for (let i = 1; i < frames.length; i++) {
        longestGapMs = Math.max(longestGapMs, frames[i].timestampMs - frames[i - 1].timestampMs);
    }
    const dcDriftFraction = drift / dcMedian;
    return {
        dcMedian: round2(dcMedian),
        dcDriftFraction: round4(dcDriftFraction),
        largestStepFraction: round4(largestStep / dcMedian),
        slowDriftDominates: dcDriftFraction >= DC_DRIFT_SUSPECT,
        framesPerSecond: round2((frames.length - 1) / spanSec),
        longestGapMs: Math.round(longestGapMs),
        frameCount: frames.length,
    };
}
function median(values) {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}
/** Linear-interpolated percentile of an already-sorted array. */
function percentile(sorted, p) {
    const pos = (sorted.length - 1) * p;
    const lower = Math.floor(pos);
    const upper = Math.ceil(pos);
    return lower === upper
        ? sorted[lower]
        : sorted[lower] + (sorted[upper] - sorted[lower]) * (pos - lower);
}
function round2(value) {
    return Math.round(value * 100) / 100;
}
function round4(value) {
    return Math.round(value * 10_000) / 10_000;
}
