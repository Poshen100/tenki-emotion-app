/**
 * ⚠️ GENERATED FILE — DO NOT EDIT.
 *
 * Compiled from packages/engine/src by scripts/build-preview-ppg.mjs so the
 * preview runs the engine's own pipeline instead of a hand-written mirror.
 * Edit the TypeScript, then run: node scripts/build-preview-ppg.mjs
 * The merge gate (scripts/preview-ppg-sync.mjs) fails if the two drift apart.
 */
/**
 * @module biometric/pulse-anchor
 * @description A Pulse Anchor: one accepted, camera-derived resting pulse
 * reference, and how a personal reference is built out of several of them.
 *
 * 🔴 **One capture is not a baseline.** A single fingertip reading is one
 * number taken once, in one posture, at one time of day, on one day. It is
 * useful — it is the user's first reference point — but the word "baseline"
 * describes a distribution, and a distribution needs repetition across days.
 * The stages below exist so a surface can say exactly which of those two
 * things it has, and never the wrong one.
 *
 * Privacy: an anchor holds derived numbers and quality metadata only. No
 * frames, no pixel streams, no waveform. `PpgFrame` never reaches this module
 * and a `PulseAnchor` has nowhere to put one.
 *
 * @see docs/PHONE-PPG.md
 */
import { toSignalQuality } from './ppg/signal-quality.js';
/**
 * What produced the anchor. One value today; the field exists because a
 * fingertip pulse and a chest strap's pulse must never merge into one series
 * silently, and a set of anchors is where that would happen.
 */
export const PULSE_ANCHOR_SOURCES = ['camera_fingertip_ppg'];
/**
 * Provenance of the number, in the vocabulary of the biometric contract:
 * a camera pulse is inferred from an optical waveform, so it is `estimated`.
 *
 * ⚠️ Mirrors `SampleDerivation` in `domain/src/contracts/wearable-sample.ts`,
 * which is canonical. The engine does not import domain (PLAYBOOK §7) — if the
 * triad there changes, this changes with it.
 */
export const PULSE_ANCHOR_DERIVATION = 'estimated';
/** Coarse time-of-day buckets. Resting pulse is not the same across them. */
export const PULSE_ANCHOR_TIMES_OF_DAY = ['morning', 'midday', 'evening', 'night'];
/** Posture at capture. Sitting and lying differ by several bpm in most people. */
export const PULSE_ANCHOR_POSTURES = ['sitting', 'lying', 'standing', 'unknown'];
/**
 * How much of a personal reference the anchors so far add up to.
 *
 * The user-facing names for these are the canonical ones: First Pulse
 * Reference, Emerging Rhythm, Personal Resting Band, Contextual Pulse
 * Baseline. Only the last is a baseline, and only it may be called one.
 *
 * ⚠️ Deliberately NOT `BaselineMaturity` (`common/types.ts`), which is the
 * engine's generic scan-count maturity used by haptics and scoring. Different
 * quantity, different thresholds, and renaming that one is forbidden
 * (`docs/SOUL-SCAN-NORTH-STAR.md` §2.4). The two are not synonyms and must not
 * be mapped onto each other.
 */
export const PULSE_BASELINE_STAGES = [
    'none',
    'first_reference',
    'emerging_rhythm',
    'personal_resting_band',
    'contextual_baseline',
];
/**
 * What each stage requires: accepted anchors, and how many separate local days
 * they are spread across.
 *
 * ⚠️ These are **disclosure** thresholds, not measured ones. They say how much
 * evidence must exist before a surface may use a stronger word, and they are
 * set conservatively on purpose. They are not calibrated against real spread
 * (that needs real users) and nothing downstream should read them as such.
 */
export const PULSE_BASELINE_THRESHOLDS = {
    first_reference: { anchors: 1, dates: 1 },
    emerging_rhythm: { anchors: 3, dates: 2 },
    personal_resting_band: { anchors: 7, dates: 3 },
    contextual_baseline: { anchors: 20, dates: 5 },
};
/**
 * Builds an anchor from a completed capture.
 *
 * @param analysis - The pipeline's output for one capture.
 * @param at - When it finished, its local day, and the conditions it ran under.
 * @returns The anchor, or null when the capture established no pulse.
 */
export function buildPulseAnchor(analysis, at) {
    // 🔴 A rejected capture is not a weak anchor, it is not an anchor. Returning
    // one with a null reading would put the decision of whether to count it in
    // every caller, and one of them would get it wrong.
    if (analysis.heartRateBpm === null)
        return null;
    return {
        restingPulseBpm: analysis.heartRateBpm,
        prvRmssdMs: analysis.prvRmssdMs,
        beatTemplateCorrelation: analysis.beatTemplateCorrelation,
        capturedAtMs: at.capturedAtMs,
        localDateKey: at.localDateKey,
        source: 'camera_fingertip_ppg',
        derivation: PULSE_ANCHOR_DERIVATION,
        quality: toSignalQuality(analysis),
        context: at.context,
    };
}
/**
 * Where a set of anchors stands on the way to a baseline.
 *
 * @param anchors - Every anchor kept for this user, in any order.
 * @returns The stage reached and what the next one still needs.
 */
export function resolvePulseBaselineProgress(anchors) {
    const accepted = anchors.filter((a) => a.quality.accepted);
    const anchorCount = accepted.length;
    const dateCount = new Set(accepted.map((a) => a.localDateKey)).size;
    const met = (stage) => anchorCount >= PULSE_BASELINE_THRESHOLDS[stage].anchors &&
        dateCount >= PULSE_BASELINE_THRESHOLDS[stage].dates;
    const stage = met('contextual_baseline')
        ? 'contextual_baseline'
        : met('personal_resting_band')
            ? 'personal_resting_band'
            : met('emerging_rhythm')
                ? 'emerging_rhythm'
                : met('first_reference')
                    ? 'first_reference'
                    : 'none';
    const order = PULSE_BASELINE_STAGES.filter((s) => s !== 'none');
    const nextStage = order[order.indexOf(stage) + 1] ?? null;
    const next = stage === 'none' ? 'first_reference' : nextStage;
    return {
        stage,
        anchorCount,
        dateCount,
        nextStage: next,
        anchorsNeeded: next ? Math.max(0, PULSE_BASELINE_THRESHOLDS[next].anchors - anchorCount) : 0,
        datesNeeded: next ? Math.max(0, PULSE_BASELINE_THRESHOLDS[next].dates - dateCount) : 0,
    };
}
/**
 * The user's resting band, or null while there is not enough to state one.
 *
 * 🔴 Returns null below the `personal_resting_band` stage rather than a band
 * computed from two readings. A range drawn from too few points is not a
 * cautious estimate of the real one — it is a different, narrower claim, and it
 * will be wrong in the confident direction.
 *
 * ⚠️ Interquartile rather than min-max: one cold-hands morning should not
 * widen a user's stated range for good.
 *
 * @param anchors - Every anchor kept for this user.
 * @returns The band, or null.
 */
export function resolveRestingBand(anchors) {
    const progress = resolvePulseBaselineProgress(anchors);
    if (progress.stage !== 'personal_resting_band' && progress.stage !== 'contextual_baseline') {
        return null;
    }
    const values = anchors
        .filter((a) => a.quality.accepted)
        .map((a) => a.restingPulseBpm)
        .sort((a, b) => a - b);
    return {
        medianBpm: round1(percentile(values, 0.5)),
        lowBpm: round1(percentile(values, 0.25)),
        highBpm: round1(percentile(values, 0.75)),
        anchorCount: values.length,
    };
}
/** True when two captures happened under conditions worth comparing. */
export function contextsAreComparable(a, b) {
    // Exertion is only disqualifying when it is known to differ: `null` means it
    // was never asked, and treating unknown as "no" would quietly compare a
    // post-stairs reading with a resting one.
    const exertionDiffers = a.afterExertion !== null && b.afterExertion !== null && a.afterExertion !== b.afterExertion;
    return a.timeOfDay === b.timeOfDay && a.posture === b.posture && !exertionDiffers;
}
/** Linear-interpolated percentile of a sorted, non-empty array. */
function percentile(sorted, p) {
    if (sorted.length === 1)
        return sorted[0];
    const index = (sorted.length - 1) * p;
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
}
function round1(value) {
    return Math.round(value * 10) / 10;
}
// ─────────────────────────────────────────────
// Pulse Rhythm (camera-derived resting PRV)
// ─────────────────────────────────────────────
/**
 * Comparable high-quality anchors needed before a PRV reading may be compared
 * against the user's own history.
 *
 * 🔴 founder rule, 2026-09-11: *"only show personal comparison after sufficient
 * comparable high-quality resting anchors"*. Matched to the resting-band stage
 * (7 anchors across 3 days) because it is the same question — how much of this
 * person have we actually seen — and inventing a second, looser number for the
 * shakier measurement would be backwards.
 *
 * ⚠️ These are anchors whose PRV gate PASSED, which is a much smaller set than
 * anchors overall: the beat-shape threshold admits only near-perfect captures.
 * Reaching this on a real device may take considerably longer than reaching the
 * pulse band, and that is the honest consequence of the gate.
 */
export const MIN_PRV_ANCHORS_FOR_COMPARISON = 7;
/** Separate days those anchors must span. */
export const MIN_PRV_DATES_FOR_COMPARISON = 3;
/**
 * Where this capture's Pulse Rhythm sits relative to comparable history.
 *
 * @param anchors - Every anchor kept for this user.
 * @param currentPrvMs - This capture's PRV, or null when its gate did not pass.
 * @param context - The context to compare within; defaults to the latest anchor's.
 * @returns The comparison, or the accumulating state when there is not enough.
 */
export function resolvePrvComparison(anchors, currentPrvMs, context) {
    const reference = context ?? anchors[anchors.length - 1]?.context;
    // Comparable means: accepted, PRV actually reported, and taken under
    // conditions worth comparing. All three, or the comparison is between two
    // different things.
    const comparable = anchors.filter((a) => a.quality.accepted &&
        a.prvRmssdMs !== null &&
        (reference === undefined || contextsAreComparable(a.context, reference)));
    const dateCount = new Set(comparable.map((a) => a.localDateKey)).size;
    const sampleCount = comparable.length;
    if (currentPrvMs === null ||
        sampleCount < MIN_PRV_ANCHORS_FOR_COMPARISON ||
        dateCount < MIN_PRV_DATES_FOR_COMPARISON) {
        return { status: 'accumulating', sampleCount, required: MIN_PRV_ANCHORS_FOR_COMPARISON };
    }
    const values = comparable
        .map((a) => a.prvRmssdMs)
        .sort((a, b) => a - b);
    const low = percentile(values, 0.25);
    const high = percentile(values, 0.75);
    return {
        status: 'established',
        sampleCount,
        required: MIN_PRV_ANCHORS_FOR_COMPARISON,
        placement: currentPrvMs < low ? 'below_usual' : currentPrvMs > high ? 'above_usual' : 'usual',
    };
}
