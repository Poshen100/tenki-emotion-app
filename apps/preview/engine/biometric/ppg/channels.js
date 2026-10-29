/**
 * ⚠️ GENERATED FILE — DO NOT EDIT.
 *
 * Compiled from packages/engine/src by scripts/build-preview-ppg.mjs so the
 * preview runs the engine's own pipeline instead of a hand-written mirror.
 * Edit the TypeScript, then run: node scripts/build-preview-ppg.mjs
 * The merge gate (scripts/preview-ppg-sync.mjs) fails if the two drift apart.
 */
/**
 * @module biometric/ppg/channels
 * @description Which colour channel the pulse is actually in.
 *
 * 🔴 This module exists because of a real-device result. On a synthetic
 * fingertip the pulse lives in red — the generator puts 100% of the pulsatile
 * amplitude there and 12% in green, which is what a fingertip under a flash
 * looks like in principle. On a real iPhone with the torch on, the first
 * capture came back with a rhythm score of **8%** (raw periodicity ≈ 0.24
 * against 0.93 on synthetic data), full contact, and no reading at all.
 *
 * The known cause, and the reason this was already flagged as a real-device
 * question: **red saturates under the torch**. A finger pressed against a lit
 * lens pins the red channel near the sensor ceiling, and a clipped signal has
 * no pulsatile component left to find — while green, further from saturation,
 * still carries one. The pipeline was reading the one channel that had been
 * flattened.
 *
 * ⚠️ The fix is NOT "use green instead". Which channel carries the pulse
 * depends on the device, the exposure and whether a torch exists at all —
 * swapping one hardcoded channel for another would just move the failure to a
 * different phone. So the pipeline measures both and picks the one with the
 * stronger periodicity, and reports what it saw in each: on a device where
 * this diagnosis is wrong, the report says so instead of hiding it.
 *
 * @see docs/PHONE-PPG.md
 */
import { PPG_RESAMPLE_HZ, bandPass, mean, perfusionIndex, resampleUniform } from './filtering.js';
import { estimateRate } from './pulse.js';
/** Channels a fingertip pulse can be read from. */
export const PPG_CHANNELS = ['red', 'green'];
/** Values for one channel, in frame order. */
function channelValues(frames, channel) {
    return channel === 'red' ? frames.map((f) => f.red) : frames.map((f) => f.green);
}
/**
 * Analyses one channel on its own.
 *
 * @param frames - The capture's frames.
 * @param channel - Which channel to read.
 * @returns The channel's signal and what it looked like, or null when the
 *   timebase could not be resampled at all.
 */
export function analyseChannel(frames, channel) {
    const resampled = resampleUniform(frames.map((f) => f.timestampMs), channelValues(frames, channel), PPG_RESAMPLE_HZ);
    if (resampled === null)
        return null;
    const cardiac = bandPass(resampled.values, resampled.sampleRateHz);
    const rate = estimateRate(cardiac, resampled.sampleRateHz);
    return {
        channel,
        values: resampled.values,
        cardiac,
        sampleRateHz: resampled.sampleRateHz,
        gapFraction: resampled.gapFraction,
        perfusion: perfusionIndex(resampled.values, cardiac),
        periodicity: rate?.periodicity ?? 0,
        periodSamples: rate?.periodSamples ?? 0,
        bpm: rate === null ? null : Math.round(rate.bpm),
        dcMean: mean(resampled.values),
    };
}
/**
 * Picks the channel the pulse is actually in.
 *
 * 🔴 Chosen by measured periodicity, not by a rule about which channel
 * "should" carry a fingertip pulse. The rule is right in principle and was
 * wrong on the first real phone.
 *
 * ⚠️ Ties go to red. It is the channel with the stronger physiological claim
 * when both look equal, and leaving the tie-break to floating-point noise
 * would make the chosen channel flicker between captures of the same finger —
 * which would then show up as day-to-day variation that is really just
 * arithmetic.
 *
 * @param frames - The capture's frames.
 * @returns The chosen channel and every channel's diagnostic, or null when no
 *   channel could be resampled.
 */
export function selectPulseChannel(frames) {
    const analyses = PPG_CHANNELS.map((channel) => analyseChannel(frames, channel)).filter((a) => a !== null);
    if (analyses.length === 0)
        return null;
    const chosen = analyses.reduce((best, candidate) => candidate.periodicity > best.periodicity ? candidate : best);
    return {
        chosen,
        diagnostics: analyses.map((a) => ({
            channel: a.channel,
            dcMean: Math.round(a.dcMean * 10) / 10,
            perfusion: Math.round(a.perfusion * 10_000) / 10_000,
            periodicity: Math.round(a.periodicity * 100) / 100,
            bpm: a.bpm,
        })),
    };
}
