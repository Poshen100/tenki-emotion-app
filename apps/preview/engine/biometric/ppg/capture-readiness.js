/**
 * ⚠️ GENERATED FILE — DO NOT EDIT.
 *
 * Compiled from packages/engine/src by scripts/build-preview-ppg.mjs so the
 * preview runs the engine's own pipeline instead of a hand-written mirror.
 * Edit the TypeScript, then run: node scripts/build-preview-ppg.mjs
 * The merge gate (scripts/preview-ppg-sync.mjs) fails if the two drift apart.
 */
/**
 * @module biometric/ppg/capture-readiness
 * @description Whether the finger is on the lens well enough to START a capture.
 *
 * 🔴 Why this exists, in one measurement: the first real-device run burned two
 * full 90-second captures. The page started the 90-second clock on tap, so
 * nothing the frames knew at second 1 reached the user until second 90
 * (`docs/PHONE-PPG.md` §12, item 19). This gate is the pre-roll the old
 * onboarding had and `/finger/` did not: the clock does not start until the
 * frames show a finger.
 *
 * 🔴 **It blocks on contact and only on contact**, and that is a measured
 * boundary, not caution. Once `channels.ts` landed, the two candidate blockers
 * I reached for first turn out to be recoverable by the pipeline:
 *
 * | fixture   | component            | outcome at 90 s        |
 * |-----------|----------------------|------------------------|
 * | `clipped` | light **0.00** (red at 255) | reading, on **green** |
 * | `motion`  | stillness **0.00**   | reading, on **green**  |
 *
 * A gate that blocked on either would refuse to start captures that produce a
 * reading — and in the `clipped` case it would re-break the exact torch
 * saturation `channels.ts` was built to survive. So light and stillness are
 * reported and named here, and they do not hold the user back.
 *
 * 🔴 What this must NOT be mistaken for:
 *   - It is **not** a prediction that the capture will succeed. Perfusion and
 *     rhythm need seconds nobody has yet. Readiness is about **position**.
 *   - It is **not** the Pulse Lock (`live.ts`), which is the final reading's
 *     own gate, sustained, and may only be claimed mid-capture.
 *   - It therefore carries no score, no rate and no rhythm claim.
 *
 * @see docs/PHONE-PPG.md
 */
import { MAX_CLIPPING, MIN_COVERAGE, assessFrameComponents } from './quality.js';
/**
 * Stages of getting the finger into position.
 *
 * Ordered by how far along the user is, so a surface can render them as a rail
 * without restating the ordering.
 */
export const READINESS_STAGES = ['approach', 'cover', 'hold', 'ready'];
/**
 * The one thing standing between the user and starting.
 *
 * ⚠️ Contact only — see the module note. Anything the pipeline can recover from
 * belongs in `advisories`, where it informs without blocking.
 */
export const READINESS_BLOCKERS = ['no_signal', 'no_contact', 'partial_contact'];
/**
 * Worth saying, not worth stopping for.
 *
 * `over_exposed` names the torch specifically because 「關掉閃光燈」 is a
 * different instruction from 「換個環境」, and because the user deserves to know
 * the reading came off the green channel.
 */
export const READINESS_ADVISORIES = ['over_exposed', 'moving'];
/** Seconds of recent frames readiness looks at. Short — this must track *now*. */
export const READINESS_WINDOW_SEC = 1.5;
/** Fewest frames worth reducing. Below this nothing is claimed. */
export const MIN_READINESS_FRAMES = 5;
/**
 * Consecutive passing windows before the capture may start.
 *
 * ⚠️ The old onboarding rail said 「穩住 1 秒」 and that number was right for the
 * wrong reason — it counted time, not signal. Here it is three windows that
 * each passed on their own, so a finger merely passing through a good position
 * does not start a 90-second capture.
 */
export const READINESS_HOLD_WINDOWS = 3;
/**
 * Contact quality the gate needs.
 *
 * Same floor `frameLevelReasons` uses to call coverage unstable — the gate and
 * the live readout must not disagree about what "covered" means.
 */
export const MIN_READINESS_CONTACT = 0.5;
/** Below this the advisory fires. Not a blocker — see the module note. */
export const ADVISORY_LIGHT = 0.5;
/** Below this the advisory fires. Not a blocker — see the module note. */
export const ADVISORY_STILLNESS = 0.5;
/**
 * Coverage below which the finger is simply not on the lens, as opposed to
 * badly placed. Separates 「把手指放上鏡頭」 from 「蓋滿一點」.
 */
export const ABSENT_COVERAGE = 0.3;
/**
 * Seconds of continuous blocking after which a surface may offer to start anyway.
 *
 * 🔴 Not a timeout that starts the capture — an escape hatch the **user** takes,
 * because a gate with no exit locks out anyone whose phone reports coverage
 * differently than the heuristic expects. The copy offering it has to say
 * plainly that the capture may well be refused.
 */
export const READINESS_PATIENCE_SEC = 20;
/** Readiness before any frame has arrived. */
export const INITIAL_READINESS = {
    stage: 'approach',
    ready: false,
    blocker: 'no_signal',
    advisories: [],
    contact: 0,
    light: 0,
    stillness: 0,
    held: 0,
};
/**
 * Assesses whether a capture may start, from the most recent frames.
 *
 * @param frames - Recent frames, oldest first. Roughly `READINESS_WINDOW_SEC`.
 * @param held - Passing windows accumulated so far; pass the previous result's
 *   `held`. Reset to 0 by any window that does not pass — a gate that keeps
 *   credit for a position the finger has left is describing the past.
 * @returns The stage, the blocker if any, the advisories, and the components.
 */
export function assessCaptureReadiness(frames, held = 0) {
    if (frames.length < MIN_READINESS_FRAMES) {
        return { ...INITIAL_READINESS, advisories: [] };
    }
    const parts = assessFrameComponents(frames);
    const contact = round2(parts.contactComponent);
    const light = round2(parts.lightComponent);
    const stillness = round2(parts.stability);
    const advisories = [];
    if (light < ADVISORY_LIGHT)
        advisories.push('over_exposed');
    if (stillness < ADVISORY_STILLNESS)
        advisories.push('moving');
    const base = { contact, light, stillness, advisories };
    if (parts.coverage < ABSENT_COVERAGE) {
        return { ...base, stage: 'approach', ready: false, blocker: 'no_contact', held: 0 };
    }
    if (parts.coverage < MIN_COVERAGE || contact < MIN_READINESS_CONTACT) {
        return { ...base, stage: 'cover', ready: false, blocker: 'partial_contact', held: 0 };
    }
    // ⚠️ Capped, not free-running: `held` is documented as "out of
    // `READINESS_HOLD_WINDOWS`", and a surface rendering it as that many dots
    // cannot show a fourth one. In the real loop the capture starts the moment
    // it lands on the cap, so the clamp only ever matters to a replay.
    const next = Math.min(held + 1, READINESS_HOLD_WINDOWS);
    return {
        ...base,
        stage: next >= READINESS_HOLD_WINDOWS ? 'ready' : 'hold',
        ready: next >= READINESS_HOLD_WINDOWS,
        blocker: null,
        held: next,
    };
}
/**
 * Whether a clipping level means a channel is being driven past its range.
 *
 * Exposed so a surface can say which channel saturated rather than just
 * "exposure" — on the first real-device run every red pixel was pinned because
 * the torch was on, and the reading came off green.
 *
 * @param clippedFraction - Fraction of clipped pixels in a frame.
 * @returns True when the channel is saturated.
 */
export function isOverExposed(clippedFraction) {
    return clippedFraction > MAX_CLIPPING;
}
function round2(value) {
    return Math.round(value * 100) / 100;
}
