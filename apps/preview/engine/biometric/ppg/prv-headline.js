/**
 * ⚠️ GENERATED FILE — DO NOT EDIT.
 *
 * Compiled from packages/engine/src by scripts/build-preview-ppg.mjs so the
 * preview runs the engine's own pipeline instead of a hand-written mirror.
 * Edit the TypeScript, then run: node scripts/build-preview-ppg.mjs
 * The merge gate (scripts/preview-ppg-sync.mjs) fails if the two drift apart.
 */
/**
 * @module biometric/ppg/prv-headline
 * @description May this device show the camera Pulse Rhythm as a number on the
 * reading screen?
 *
 * 🔴 founder 2026-11-22 relaxed "Pulse Rhythm lives only in the evidence layer"
 * into "it may headline once **this phone** has been checked against a chest
 * strap". Synthetic signals cannot answer that: photon noise leaves the quality
 * score at 99 while the beat intervals are off by up to 156%
 * (`docs/PHONE-PPG.md` §13). Only paired real captures can.
 *
 * Two questions, kept separate on purpose:
 *   1. {@link assessReferenceAgreement} — did this device's camera agree with a
 *      chest strap measured AT THE SAME TIME, often enough, on more than one day?
 *   2. {@link resolvePrvHeadline} — given that, may THIS capture headline?
 *      (Its own beat-template gate still has to pass.)
 *
 * ⚠️ Why not ICC (the threshold first written in
 * `docs/research/BUSINESS-VALUE-2026-11.md`): a device is validated by the
 * people who use it, usually one. ICC divides by between-subject spread, and one
 * person's resting RMSSD barely spreads — so ICC fails a camera that is within
 * 3% every time, and could pass a sloppy one on a household with very different
 * hearts. It measures the sample, not the instrument. Relative error does not.
 *
 * What this never does: call it HRV, feed `hrvRmssdMs`, or touch Edge Score.
 * Passing here moves a number up the screen; it changes no downstream maths.
 *
 * 🔴 What `passed` means, and only that (founder review 2026-11-23): a
 * PRELIMINARY engineering gate for ONE phone and the people who used it. It is
 * not evidence that the model of phone is accurate, and relative error within
 * bounds is not a full accuracy proof. Copy must say "this phone", never "this
 * model" — and cross-device display needs the wider ECG study (next rounds).
 *
 * Four guards added in that review:
 *   1. **Same window.** A strap value only pairs when the user confirmed it was
 *      measured over the same window AND typed it within
 *      {@link MAX_REFERENCE_ENTRY_DELAY_MS} of the capture. A typed number
 *      cannot PROVE synchrony; this only refuses the pairs that are clearly not.
 *   2. **Small-sample tail, stated as a count.** At n = 10 a "90th percentile"
 *      is just the second-worst pair. So the rule is written as what it is: at
 *      most ⌊n/10⌋ pairs may exceed {@link MAX_TAIL_RELATIVE_ERROR}, and the
 *      report prints that count and the worst pair.
 *   3. **Near-zero reference.** Below {@link MIN_REFERENCE_RMSSD_MS} a 2 ms
 *      difference is 20%+ — relative error explodes. Those pairs are left out
 *      and counted, never silently.
 *   4. **Scope in the words** — see above.
 *
 * @see docs/PHONE-PPG.md §12 (#27), §13
 */
/** Paired captures needed before the device is judged at all. */
export const MIN_REFERENCE_PAIRS = 10;
/** …spread over at least this many local days (one sitting is one context). */
export const MIN_REFERENCE_DAYS = 2;
/**
 * Median |camera − strap| / strap must stay at or below this.
 * The clean synthetic capture already under-reads by 7–9% (§13), so 10% leaves
 * almost no room beyond what the method costs by itself.
 */
export const MAX_MEDIAN_RELATIVE_ERROR = 0.1;
/**
 * The tail bound: at most ⌊n/10⌋ pairs may be further off than this. 17% is the
 * §13 knee: the error the 0.96 template threshold would have let through,
 * rejected because RMSSD's own day-to-day variation is that size — an error as
 * large as the signal is not a reading.
 */
export const MAX_TAIL_RELATIVE_ERROR = 0.17;
/**
 * Strap RMSSD below this is left out of the relative-error maths. At 8 ms a
 * 2 ms disagreement is 25% — the ratio measures the denominator, not the camera.
 */
export const MIN_REFERENCE_RMSSD_MS = 10;
/**
 * A strap value typed later than this after the capture finished is not paired.
 * The result page is where it is typed; ten minutes covers reading it off the
 * strap app and no more.
 */
export const MAX_REFERENCE_ENTRY_DELAY_MS = 10 * 60 * 1000;
/**
 * Whether a value is a usable positive number. The log is persisted across app
 * versions, so a field added later arrives as `undefined` on old rows — never
 * test those with `!== null` (see `present()` in validation-log.ts).
 */
function positive(value) {
    return typeof value === 'number' && Number.isFinite(value) && value > 0;
}
/**
 * Judges this device's camera Pulse Rhythm against simultaneous chest-strap
 * RMSSD values the user typed in.
 *
 * Only resting captures count: §13's own evidence (and the 2026 meta-analysis
 * the founder's report cites) is that camera-vs-ECG agreement holds at rest and
 * not in motion — validating on a walk would test a claim nobody makes.
 *
 * @param log - Every capture attempt on this device.
 * @returns The status and the numbers behind it. Below the minimums the status
 *   is `accumulating` and no verdict is given, whatever the errors look like.
 */
export function assessReferenceAgreement(log) {
    const withStrap = log.filter((c) => c.scenario === 'resting' &&
        c.accepted &&
        positive(c.prvRmssdMs) &&
        positive(c.referenceRmssdMs));
    const synced = withStrap.filter((c) => {
        const delay = typeof c.referenceEnteredAtMs === 'number' ? c.referenceEnteredAtMs - c.atMs : NaN;
        // 🔴 Both conditions must be TRUE; a missing field (old record) fails them.
        return c.referenceSameWindow === true && delay >= 0 && delay <= MAX_REFERENCE_ENTRY_DELAY_MS;
    });
    const pairs = synced.filter((c) => c.referenceRmssdMs >= MIN_REFERENCE_RMSSD_MS);
    const relative = pairs.map((c) => (c.prvRmssdMs - c.referenceRmssdMs) / c.referenceRmssdMs);
    const absolute = relative.map(Math.abs).sort((a, b) => a - b);
    const dayCount = new Set(pairs.map((c) => c.localDateKey)).size;
    const medianBias = median(relative);
    const medianAbsError = median(absolute);
    const tailCount = absolute.filter((e) => e > MAX_TAIL_RELATIVE_ERROR).length;
    const tailAllowed = Math.floor(pairs.length / 10);
    const worstAbsError = absolute.length === 0 ? null : round3(absolute[absolute.length - 1]);
    let status = 'accumulating';
    if (pairs.length >= MIN_REFERENCE_PAIRS && dayCount >= MIN_REFERENCE_DAYS) {
        // 🔴 `passed` has to be EARNED by both bounds holding. Anything else —
        // including a null that should be impossible past the minimums — fails.
        const ok = medianAbsError !== null && medianAbsError <= MAX_MEDIAN_RELATIVE_ERROR && tailCount <= tailAllowed;
        status = ok ? 'passed' : 'failed';
    }
    return {
        status,
        pairCount: pairs.length,
        dayCount,
        unsyncedCount: withStrap.length - synced.length,
        lowReferenceCount: synced.length - pairs.length,
        medianBias,
        medianAbsError,
        tailCount,
        tailAllowed,
        worstAbsError,
    };
}
/**
 * May this capture's Pulse Rhythm appear on the reading screen?
 *
 * The capture's own gate is checked first: a device that passed validation
 * does not make a capture with unstable beat shapes trustworthy.
 *
 * @param agreement - This device's standing, from {@link assessReferenceAgreement}.
 * @param prvRmssdMs - This capture's Pulse Rhythm, null when its gate failed.
 * @returns Show it (always labelled as the calculated layer), or why not.
 */
export function resolvePrvHeadline(agreement, prvRmssdMs) {
    if (!positive(prvRmssdMs))
        return { show: false, reason: 'gate_not_passed' };
    if (agreement.status === 'passed')
        return { show: true, valueMs: prvRmssdMs, layer: 'calculated' };
    return {
        show: false,
        reason: agreement.status === 'failed' ? 'device_failed_validation' : 'device_not_validated',
    };
}
function median(values) {
    if (values.length === 0)
        return null;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const value = sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    return round3(value);
}
function round3(value) {
    return Math.round(value * 1000) / 1000;
}
