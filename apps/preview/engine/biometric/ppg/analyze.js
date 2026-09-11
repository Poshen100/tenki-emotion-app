/**
 * ⚠️ GENERATED FILE — DO NOT EDIT.
 *
 * Compiled from packages/engine/src by scripts/build-preview-ppg.mjs so the
 * preview runs the engine's own pipeline instead of a hand-written mirror.
 * Edit the TypeScript, then run: node scripts/build-preview-ppg.mjs
 * The merge gate (scripts/preview-ppg-sync.mjs) fails if the two drift apart.
 */
/**
 * @module biometric/ppg/analyze
 * @description The camera PPG pipeline end to end.
 *
 * Frames in, a state reading out — or an honest account of why one could not be
 * produced. The gates below are the product: anyone can compute a heart rate
 * from an array of numbers, and every one of those numbers will look plausible.
 * What makes this a measurement rather than a decoration is that it refuses.
 */
import { PPG_RESAMPLE_HZ, bandPass, perfusionIndex, resampleUniform, } from './filtering.js';
import { MAX_ARTIFACT_FRACTION, MIN_INTERVALS_FOR_HRV, MIN_INTERVALS_FOR_RESPIRATION, computeRmssd, heartRateFromIntervals, intervalTimes, rejectArtifacts, toIntervals, } from './beats.js';
import { MAX_PLAUSIBLE_BPM, MIN_PERIODICITY, MIN_PLAUSIBLE_BPM, detectPulsePeaks, estimateRate, } from './pulse.js';
import { MAX_FRAME_DROPS, assessPpgQuality } from './quality.js';
import { estimateRepeatability } from './repeatability.js';
import { estimateRespiration } from './respiration.js';
import { SCAN_MODE_CONFIGS, isCameraMode, modeReports, } from '../scan-modes.js';
/** Fewest frames worth attempting anything with. */
export const MIN_FRAMES = 60;
/**
 * Why a derived metric is absent when the heart rate itself could not be read.
 *
 * The mode gate outranks the signal: a metric this scan mode does not report
 * would have been withheld even from a perfect recording.
 */
function rateFailureReason(mode, metric, options) {
    return modeReports(mode, metric, options) ? 'irregular_periodicity' : 'mode_excludes_metric';
}
/**
 * Runs a camera scan window through the full pipeline.
 *
 * The order matters and each step exists for a failure it prevents:
 * resample (camera timestamps jitter) → band-pass (the pulse is 1-3% of the
 * light) → autocorrelate (is there a pulse at all?) → detect peaks (beat times)
 * → reject artifacts → gate each metric on quality, mode and evidence.
 *
 * @param frames - Frames already reduced to scalars by the capture layer.
 * @param mode - Which scan the user started.
 * @param options - Which gated metrics this build may report at all.
 * @returns The analysis, or a rejection when nothing could be attempted.
 */
export function analyzePpgScan(frames, mode, options = {}) {
    if (!isCameraMode(mode)) {
        return { status: 'rejected', reason: 'not_a_camera_mode' };
    }
    if (frames.length < MIN_FRAMES) {
        return { status: 'rejected', reason: 'too_few_frames' };
    }
    const config = SCAN_MODE_CONFIGS[mode];
    const resampled = resampleUniform(frames.map((f) => f.timestampMs), frames.map((f) => f.red), PPG_RESAMPLE_HZ);
    if (resampled === null) {
        return { status: 'rejected', reason: 'unusable_timebase' };
    }
    const durationSec = resampled.values.length / resampled.sampleRateHz;
    const cardiac = bandPass(resampled.values, resampled.sampleRateHz);
    const perfusion = perfusionIndex(resampled.values, cardiac);
    const rate = estimateRate(cardiac, resampled.sampleRateHz);
    const quality = assessPpgQuality({
        frames,
        periodicity: rate?.periodicity ?? 0,
        perfusion,
        frameDropFraction: resampled.gapFraction,
        durationSec,
        minDurationSec: config.minDurationSec,
    });
    const withheld = [];
    // ── Heart rate ───────────────────────────────────────────────────────────
    // Two independent conditions. Quality says the light was readable;
    // periodicity says there was something repeating in it. Noise can pass the
    // first — only the second distinguishes a pulse from a well-lit still frame.
    const qualityBlocksRate = quality.score < config.minQualityForHeartRate;
    const noPulse = rate === null || rate.periodicity < MIN_PERIODICITY;
    if (qualityBlocksRate || noPulse) {
        // Prefer the reason the user can act on. `irregular_periodicity` is what
        // low perfusion, motion and clipping all collapse into, so naming it first
        // would tell someone whose finger is barely on the lens that their pulse
        // was irregular.
        withheld.push({ metric: 'heart_rate', reason: dominantNegativeReason(quality.reasons) });
        return {
            status: 'analysed',
            analysis: {
                quality,
                heartRateBpm: null,
                hrvRmssdMs: null,
                respiratoryRateBrpm: null,
                beatCount: 0,
                artifactFraction: 0,
                repeatabilitySdMs: null,
                durationSec: round1(durationSec),
                sampleRateHz: resampled.sampleRateHz,
                // ⚠️ 這條早退路徑也要吃 mode 閘門。否則相機 HRV 被關掉時，
                // 訊號不足的掃描會回報「節律不穩」—— 那是個更弱的理由，而真正的
                // 理由是這個模式根本不報這一項。兩個原因要照同一個優先序講。
                withheld: [
                    ...withheld,
                    { metric: 'hrv', reason: rateFailureReason(mode, 'hrv', options) },
                    { metric: 'respiration', reason: rateFailureReason(mode, 'respiration', options) },
                ],
            },
        };
    }
    const peaks = detectPulsePeaks(cardiac, resampled.sampleRateHz, rate.periodSamples);
    const peakTimesMs = peaks.map((p) => p.timeMs);
    const series = rejectArtifacts(toIntervals(peakTimesMs), intervalTimes(peakTimesMs));
    // Prefer the beat-derived rate when the beats survived, because it is the
    // rate the intervals actually describe; fall back to autocorrelation, which
    // needs no individual beat to have been detected.
    const beatRate = heartRateFromIntervals(series.accepted);
    const candidate = beatRate ?? Math.round(rate.bpm);
    const heartRateBpm = candidate >= MIN_PLAUSIBLE_BPM && candidate <= MAX_PLAUSIBLE_BPM ? candidate : null;
    if (heartRateBpm === null) {
        withheld.push({ metric: 'heart_rate', reason: 'irregular_periodicity' });
    }
    // ── HRV ──────────────────────────────────────────────────────────────────
    let hrvRmssdMs = null;
    let hrvBlockedBy = null;
    if (!modeReports(mode, 'hrv', options)) {
        hrvBlockedBy = 'mode_excludes_metric';
    }
    else if (quality.score < config.minQualityForHrv) {
        hrvBlockedBy = dominantNegativeReason(quality.reasons);
    }
    else if (quality.frameDropFraction > MAX_FRAME_DROPS) {
        // Beat timing recovered across interpolated gaps is timing TENKI invented.
        // A heart rate survives that; the millisecond differences HRV is made of
        // do not.
        hrvBlockedBy = 'frame_drops';
    }
    else if (series.artifactFraction > MAX_ARTIFACT_FRACTION) {
        hrvBlockedBy = 'too_many_artifacts';
    }
    else if (series.accepted.length < MIN_INTERVALS_FOR_HRV) {
        hrvBlockedBy = 'too_few_beats';
    }
    else {
        hrvRmssdMs = computeRmssd(series.accepted);
        if (hrvRmssdMs === null) {
            hrvBlockedBy = 'too_few_beats';
        }
    }
    if (hrvBlockedBy !== null) {
        withheld.push({ metric: 'hrv', reason: hrvBlockedBy });
    }
    // ── Respiration ──────────────────────────────────────────────────────────
    // Derived from respiratory sinus arrhythmia in the beat intervals, so it can
    // never be better founded than the beat timing HRV was refused for.
    let respiratoryRateBrpm = null;
    if (!modeReports(mode, 'respiration', options)) {
        withheld.push({ metric: 'respiration', reason: 'mode_excludes_metric' });
    }
    else if (hrvRmssdMs === null) {
        // Respiration is read out of the same beat timing, so it inherits whatever
        // stopped HRV rather than inventing a reason of its own.
        withheld.push({ metric: 'respiration', reason: hrvBlockedBy ?? 'too_many_artifacts' });
    }
    else if (series.accepted.length < MIN_INTERVALS_FOR_RESPIRATION) {
        withheld.push({ metric: 'respiration', reason: 'too_few_beats' });
    }
    else {
        const estimate = estimateRespiration(series.acceptedAtMs, series.accepted);
        if (estimate === null) {
            withheld.push({ metric: 'respiration', reason: 'irregular_periodicity' });
        }
        else {
            respiratoryRateBrpm = estimate.brpm;
        }
    }
    // Only measured when HRV was actually reported. A scan whose HRV was
    // withheld never reaches a baseline, so its noise tells us nothing about how
    // trustworthy the baseline is.
    const repeatability = hrvRmssdMs === null
        ? null
        : estimateRepeatability(series.accepted, series.acceptedAtMs);
    return {
        status: 'analysed',
        analysis: {
            quality,
            heartRateBpm,
            hrvRmssdMs,
            respiratoryRateBrpm,
            repeatabilitySdMs: repeatability?.sdMs ?? null,
            beatCount: series.accepted.length + (series.accepted.length > 0 ? 1 : 0),
            artifactFraction: Math.round(series.artifactFraction * 100) / 100,
            durationSec: round1(durationSec),
            sampleRateHz: resampled.sampleRateHz,
            withheld,
        },
    };
}
/**
 * Picks the reason to show the user when quality blocked a metric.
 * Returns the first negative reason present, so the message names something
 * they can act on rather than restating the score.
 */
function dominantNegativeReason(reasons) {
    const ordered = [
        'insufficient_duration',
        'low_perfusion',
        'motion_detected',
        'sensor_clipping',
        'unstable_coverage',
        'frame_drops',
        'irregular_periodicity',
        'weak_pulse',
    ];
    for (const reason of ordered) {
        if (reasons.includes(reason))
            return reason;
    }
    return 'weak_pulse';
}
function round1(value) {
    return Math.round(value * 10) / 10;
}
/**
 * Whether an analysis produced anything the user can act on.
 *
 * @param analysis - A completed analysis.
 * @returns True when at least a heart rate was established.
 */
export function hasUsableReading(analysis) {
    return analysis.heartRateBpm !== null;
}
/**
 * Whether a metric is missing from an analysis.
 *
 * @param analysis - A completed analysis.
 * @param metric - The metric to look for.
 * @returns True when the pipeline declined to report it.
 */
export function wasWithheld(analysis, metric) {
    return analysis.withheld.some((entry) => entry.metric === metric);
}
