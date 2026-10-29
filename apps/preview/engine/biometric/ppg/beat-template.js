/**
 * ⚠️ GENERATED FILE — DO NOT EDIT.
 *
 * Compiled from packages/engine/src by scripts/build-preview-ppg.mjs so the
 * preview runs the engine's own pipeline instead of a hand-written mirror.
 * Edit the TypeScript, then run: node scripts/build-preview-ppg.mjs
 * The merge gate (scripts/preview-ppg-sync.mjs) fails if the two drift apart.
 */
/**
 * @module biometric/ppg/beat-template
 * @description How alike this capture's individual beats are — the only
 * measure here that predicts whether beat TIMING can be trusted.
 *
 * 🔴 Why this module exists, measured rather than assumed. The quality score is
 * built from perfusion, periodicity, coverage, motion and frame drops. None of
 * those notice sensor noise: a capture with a strong, steady, well-covered
 * pulse and a noisy sensor scores **99** — and its pulse-rate variability comes
 * out **156% wrong**, because the noise moves where each peak appears to be
 * without touching anything the score measures. Repeatability does not catch it
 * either (a 0.4 ms spread alongside a 177% error).
 *
 * Correlating each beat against the capture's own average beat does catch it,
 * because noise is what makes one beat's shape differ from the next:
 *
 * | capture          | quality | template corr | PRV error   |
 * |------------------|--------:|--------------:|------------:|
 * | clean            |      99 |          0.98 |   −8…−11%   |
 * | coverage wobble  |      85 |          0.98 |        1%   |
 * | perfusion 0.5    |      85 |          0.96 |    10–17%   |
 * | motion 0.3       |      96 |          0.95 |     4–5%    |
 * | **sensor noise** |  **99** |      **0.95** | **20–35%**  |
 * | perfusion 0.35   |      80 |          0.93 |    35–55%   |
 * | motion 0.6       |      90 |          0.86 |    36–46%   |
 * | **sensor noise** |  **99** |      **0.85** | **105–156%**|
 *
 * ⚠️ Calibrated against the synthetic generator. Real fingertips have more
 * beat-to-beat morphology variation than a synthesiser does, so the threshold
 * below may be unreachable in practice — which would mean PRV essentially never
 * appears on a real device. That is a real-device question, listed in
 * docs/PHONE-PPG.md §12.
 *
 * @see docs/PHONE-PPG.md
 */
/**
 * Template correlation a capture must reach before its pulse-rate variability
 * may be reported.
 *
 * ⚠️ 0.97 rather than the 0.96 knee in the table: at 0.96 a capture with 17%
 * PRV error is admitted, and RMSSD's own day-to-day variation is of that order
 * — a reading whose error is the size of the signal is not a reading. Taking
 * the stricter side costs captures; taking the looser side costs the claim.
 */
export const PRV_MIN_TEMPLATE_CORRELATION = 0.97;
/** Fewest beats worth building a template from. */
export const MIN_BEATS_FOR_TEMPLATE = 4;
/** Fraction of a beat period captured before the peak in each segment. */
const PRE_PEAK_FRACTION = 0.3;
/**
 * Mean correlation between each beat's waveform and the capture's average beat.
 *
 * @param values - The band-passed cardiac signal, uniformly sampled.
 * @param periodSamples - Samples per beat, from the rate estimate.
 * @param peakIndices - Sample index of each detected peak.
 * @returns 0..1, or null when there are too few complete beats to compare.
 */
export function beatTemplateCorrelation(values, periodSamples, peakIndices) {
    const length = Math.round(periodSamples);
    if (length < 4 || peakIndices.length < MIN_BEATS_FOR_TEMPLATE)
        return null;
    const before = Math.floor(length * PRE_PEAK_FRACTION);
    const segments = [];
    for (const peak of peakIndices) {
        const start = peak - before;
        // Partial beats at either end would drag the template toward whatever the
        // capture happened to be doing when it started.
        if (start < 0 || start + length >= values.length)
            continue;
        segments.push(values.slice(start, start + length));
    }
    if (segments.length < MIN_BEATS_FOR_TEMPLATE)
        return null;
    const template = Array.from({ length }, (_, i) => segments.reduce((sum, seg) => sum + seg[i], 0) / segments.length);
    const correlations = segments.map((seg) => pearson(seg, template));
    const mean = correlations.reduce((sum, c) => sum + c, 0) / correlations.length;
    return Math.round(Math.max(0, Math.min(1, mean)) * 100) / 100;
}
/** Pearson correlation of two equal-length series; 0 when either is flat. */
function pearson(a, b) {
    const meanA = a.reduce((s, v) => s + v, 0) / a.length;
    const meanB = b.reduce((s, v) => s + v, 0) / b.length;
    let numerator = 0;
    let varA = 0;
    let varB = 0;
    for (let i = 0; i < a.length; i++) {
        const da = a[i] - meanA;
        const db = b[i] - meanB;
        numerator += da * db;
        varA += da * da;
        varB += db * db;
    }
    return varA === 0 || varB === 0 ? 0 : numerator / Math.sqrt(varA * varB);
}
