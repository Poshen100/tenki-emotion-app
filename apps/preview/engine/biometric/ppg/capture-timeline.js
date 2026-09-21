/**
 * ⚠️ GENERATED FILE — DO NOT EDIT.
 *
 * Compiled from packages/engine/src by scripts/build-preview-ppg.mjs so the
 * preview runs the engine's own pipeline instead of a hand-written mirror.
 * Edit the TypeScript, then run: node scripts/build-preview-ppg.mjs
 * The merge gate (scripts/preview-ppg-sync.mjs) fails if the two drift apart.
 */
/**
 * @module biometric/ppg/capture-timeline
 * @description Anchor first, refine naturally — the capture's own timeline.
 *
 * 🔴 The product decision this encodes (founder 2026-09-15): a user must never
 * feel trapped in a ninety-second scan. They should get a useful result quickly,
 * and keep seeing more only for as long as they choose to stay.
 *
 *   - **30 s** — the moment `quick_check` clears the SAME heart-rate quality bar
 *     the long scan uses, an anchor is accepted and the user is told. They may
 *     leave with it immediately, at no cost.
 *   - **30-60 s** — refinement runs silently. Doing nothing is a valid choice
 *     and is rewarded; leaving is also a valid choice and is not punished.
 *   - **60 s** — refinement auto-completes and the result is presented.
 *   - **60-90 s** — never automatic. An explicitly chosen Precision Session.
 *
 * 🔴 Why 30 s is not a weakened gate, measured rather than assumed: across the
 * replay fixtures a 30-second `quick_check` **never accepted a capture the
 * 90-second `full_scan` refused** — it is strictly the more conservative of the
 * two (the irregular-rhythm fixture is accepted at 90 s and refused at 30 s).
 * Where both accepted, they agreed within 1 bpm over 24 seeds. `quick_check`
 * also carries `minQualityForHeartRate: 45`, identical to `full_scan`.
 *
 * ⚠️ What the synthetic result does NOT show: the generator's heart rate is
 * near-constant, so this establishes that the *estimator* converges quickly, not
 * that a *person's* rate is stable across ninety seconds. That one needs a real
 * finger — `docs/PHONE-PPG.md` §12.
 *
 * 🔴 The two load-bearing rules, both about not taking something away:
 *   - An accepted anchor is **immutable**. Degradation afterwards marks the
 *     *refinement* incomplete and never touches the anchor.
 *   - A later estimate may only supersede it by being **better on the same
 *     measure the gate uses**, and the state says so rather than swapping
 *     silently.
 *
 * ⚠️ NAMING: the user-facing "Precision Session" here is NOT `ScanMode`
 * `'precision'`. That mode is defined with `signalSource: 'external_beat_sensor'`
 * — a chest strap. Letting a camera capture borrow its name would let a phone
 * reading claim a grade of evidence it cannot have.
 *
 * @see docs/PHONE-PPG.md
 */
import { SCAN_MODE_CONFIGS } from '../scan-modes.js';
/** When an anchor may first be accepted. Matches `quick_check`'s target. */
export const ANCHOR_AT_SEC = SCAN_MODE_CONFIGS.quick_check.targetDurationSec;
/** When silent refinement auto-completes. */
export const REFINEMENT_ENDS_SEC = 60;
/** The longest an explicitly chosen Precision Session runs. */
export const PRECISION_ENDS_SEC = SCAN_MODE_CONFIGS.full_scan.targetDurationSec;
/**
 * Where the capture is on its timeline.
 *
 * `anchor_ready` and `refining` are separate because the brief requires the
 * user to be able to tell "you have a result" from "and it is still improving".
 */
export const CAPTURE_PHASES = [
    'anchoring',
    'anchor_ready',
    'refining',
    'refined',
    'precision',
];
/** A capture that has not produced anything yet. */
export const INITIAL_TIMELINE = {
    phase: 'anchoring',
    anchor: null,
    refinementIncomplete: false,
    canLeaveWithResult: false,
    anchorSuperseded: false,
};
/**
 * Whether a candidate is good enough to take the anchor's place.
 *
 * 🔴 "Better" is the quality score the gate itself uses — not a second opinion
 * invented here. A longer capture is not automatically better: a refinement
 * whose last thirty seconds were ruined scores worse than the clean first
 * thirty, and rule 9 says that reading must not silently replace the good one.
 *
 * ⚠️ Quality score is a proxy for accuracy, not accuracy itself. It is used
 * because it is the repo's single existing measure of how good a capture was;
 * a second criterion here would be a second opinion the gate does not share.
 *
 * @param candidate - The newer reading.
 * @param anchor - The reading already accepted.
 * @returns True when the newer one should take over.
 */
export function supersedesAnchor(candidate, anchor) {
    return (candidate.meetsGate &&
        candidate.heartRateBpm !== null &&
        candidate.qualityScore >= anchor.qualityScore);
}
/**
 * Advances the capture timeline by one tick.
 *
 * @param prev - The state from the previous tick.
 * @param tick - What this tick knows.
 * @returns The new state. Never mutates `prev` or its anchor.
 */
export function advanceCaptureTimeline(prev, tick) {
    const { elapsedSec, candidate, precisionOptIn = false } = tick;
    // ── No anchor yet ────────────────────────────────────────────────────────
    if (prev.anchor === null) {
        const acceptable = elapsedSec >= ANCHOR_AT_SEC &&
            candidate !== null &&
            candidate.meetsGate &&
            candidate.heartRateBpm !== null;
        if (!acceptable) {
            return { ...prev, phase: 'anchoring', anchorSuperseded: false };
        }
        return {
            // ⚠️ The clock decides the phase, not the fact that an anchor just
            // arrived. An anchor first accepted AT the end of refinement used to
            // report `anchor_ready` — so the capture was over while the screen said
            // it was still refining, and the Precision opt-in never appeared.
            phase: resolvePhase(elapsedSec, precisionOptIn),
            anchor: {
                heartRateBpm: candidate.heartRateBpm,
                qualityScore: candidate.qualityScore,
                durationSec: candidate.durationSec,
                acceptedAtSec: elapsedSec,
            },
            refinementIncomplete: false,
            canLeaveWithResult: true,
            anchorSuperseded: false,
        };
    }
    // ── An anchor exists; from here nothing may take it away ─────────────────
    const anchor = prev.anchor;
    const superseded = candidate !== null && supersedesAnchor(candidate, anchor)
        ? {
            heartRateBpm: candidate.heartRateBpm,
            qualityScore: candidate.qualityScore,
            durationSec: candidate.durationSec,
            acceptedAtSec: elapsedSec,
        }
        : null;
    // 🔴 A candidate that fails now does NOT undo the anchor — it only means the
    // refinement has nothing better to offer. Rule 8.
    const refinementFailed = candidate !== null && !candidate.meetsGate && elapsedSec >= REFINEMENT_ENDS_SEC;
    const phase = resolvePhase(elapsedSec, precisionOptIn);
    return {
        phase,
        anchor: superseded ?? anchor,
        refinementIncomplete: refinementFailed,
        canLeaveWithResult: true,
        anchorSuperseded: superseded !== null,
    };
}
/**
 * The phase for a given moment, once an anchor exists.
 *
 * 🔴 Past `REFINEMENT_ENDS_SEC` the capture stops on its own unless the user
 * opted in. Rule 7: 60-90 s is never automatic.
 */
function resolvePhase(elapsedSec, precisionOptIn) {
    if (elapsedSec >= REFINEMENT_ENDS_SEC) {
        return precisionOptIn ? 'precision' : 'refined';
    }
    return elapsedSec > ANCHOR_AT_SEC ? 'refining' : 'anchor_ready';
}
/**
 * Whether the capture should keep sampling.
 *
 * @param state - The current timeline state.
 * @param elapsedSec - Seconds since the clock started.
 * @param precisionOptIn - Whether the user chose a Precision Session.
 * @returns False once the capture has no reason to keep the camera running.
 */
export function shouldKeepCapturing(_state, elapsedSec, precisionOptIn = false) {
    // ⚠️ The first version kept sampling past 60 s whenever no anchor had been
    // accepted — reasoning that a marginal capture might still land one. That is
    // exactly what rule 7 forbids: the user would be held past a minute without
    // ever choosing to be. A capture that has nothing by 60 s ends with nothing,
    // and says so.
    return elapsedSec < (precisionOptIn ? PRECISION_ENDS_SEC : REFINEMENT_ENDS_SEC);
}
