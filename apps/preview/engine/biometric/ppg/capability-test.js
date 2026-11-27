/**
 * ⚠️ GENERATED FILE — DO NOT EDIT.
 *
 * Compiled from packages/engine/src by scripts/build-preview-ppg.mjs so the
 * preview runs the engine's own pipeline instead of a hand-written mirror.
 * Edit the TypeScript, then run: node scripts/build-preview-ppg.mjs
 * The merge gate (scripts/preview-ppg-sync.mjs) fails if the two drift apart.
 */
/**
 * @module biometric/ppg/capability-test
 * @description The five-second check: can this phone get a fingertip signal at
 * all, and if not, which link in the chain is the problem?
 *
 * founder 2026-11-24 (`docs/P0-CAPABILITY-AND-EVIDENCE.md` §1). It answers
 * whether the SIGNAL PATH works — camera, frame timing, exposure, pulsatile
 * light. It never answers whether a reading would be accurate (that is #27),
 * and it never outputs a physiological number: five seconds is about five
 * beats, and rhythm estimation needs `MIN_LIVE_WINDOW_SEC` (15 s).
 *
 * 🔴 Three outcomes, and "incompatible" is not one of them:
 *   - `signal_path_ok`   — every check passed.
 *   - `not_yet_confirmed` — something did not pass in five seconds, and it is
 *     something that can change (contact, light, the camera re-deciding its
 *     gain). Five seconds of a bad grip is not a verdict on the phone.
 *   - `hardware_limit`   — only for facts a change of grip cannot change: no
 *     camera, permission refused, or a frame rate too low across the WHOLE
 *     window. Even then the copy says what the phone cannot do right now, not
 *     that it is incompatible.
 *
 * No new signal processing. Every check reuses the measurement the full capture
 * already trusts, at the threshold that capture already uses — so a phone that
 * passes here is held to the same bar it will meet in the real capture.
 *
 * ⚠️ Pulsatile light is not "a clear pulse". In-band AC/DC RISES under stepped
 * exposure changes (CLAUDE.md, `strong_pulse`), so it only counts when the
 * exposure check also passed — see the order in {@link assessCapability}.
 *
 * 🔴 Why perfusion alone is not the pulsatile-light check (measured 2026-11-27,
 * synthetic, 5 s): the GREEN channel of pure sensor noise reads 0.0016–0.0020
 * — above `MIN_PERFUSION` (0.0015) — because green's DC is about half of red's,
 * so the same noise is twice the ratio. A clean capture's green reads 0.0024:
 * no discrimination. My first version took "the better channel's perfusion"
 * and passed noise as signal. So the check now matches the full capture: pick
 * the channel by periodicity (`selectPulseChannel`), then require THAT channel
 * to clear both `MIN_PERFUSION` and the Pulse Lock coherence floor.
 * Over 30 seeds at 5 s: noise periodicity 0.16–0.45, clean 0.91–0.98,
 * low perfusion 0.21–0.53 (its red perfusion ~0.0010 fails the other gate).
 * ⚠️ 0.45 against a 0.5 floor is a thin synthetic margin; the founder's real
 * phone is the next measurement (spec §1.5 item 6). Periodicity is used only
 * as a gate here — it is never shown.
 */
import { selectPulseChannel } from './channels.js';
import { DC_DRIFT_SUSPECT, assessExposureStability } from './exposure-stability.js';
import { MIN_LOCK_COHERENCE } from './live.js';
import { MAX_CLIPPING, MAX_MOTION, MIN_COVERAGE, MIN_PERFUSION, assessFrameComponents } from './quality.js';
/** How long the check listens, in seconds. */
export const CAPABILITY_TEST_SEC = 5;
/**
 * Shortest span that still counts as a five-second check. A little slack for
 * the first frame arriving late; anything shorter is `too_short`, not a verdict.
 */
export const MIN_CAPABILITY_SPAN_SEC = 4.5;
/**
 * Sustained frame rate below which the phone cannot carry the signal.
 * The band-pass reaches 3.5 Hz; 20 fps keeps comfortably above twice that.
 * ⚠️ founder 2026-11-24 approved this as a THEORETICAL floor to be checked
 * against the founder's own phone before it is trusted (spec §5, item 1).
 */
export const MIN_CAPABILITY_FPS = 20;
/**
 * Longest single gap between frames that is still a working timebase. A longer
 * one is a stall, which can be transient (a notification, a thermal hiccup), so
 * it makes the result `not_yet_confirmed`, never `hardware_limit`.
 */
export const MAX_CAPABILITY_GAP_MS = 200;
/** The three outcomes. */
export const CAPABILITY_RESULTS = ['signal_path_ok', 'not_yet_confirmed', 'hardware_limit'];
/**
 * Why the check did not pass. The first three are hardware facts; the rest can
 * change on the next try.
 */
export const CAPABILITY_REASONS = [
    'camera_unavailable',
    'permission_denied',
    'frame_rate_too_low',
    'too_short',
    'frame_stall',
    'no_contact',
    'over_exposed',
    'moving',
    'exposure_hunting',
    'no_pulsatile_light',
];
/** Reasons that are facts about the phone rather than about this attempt. */
export const HARDWARE_REASONS = [
    'camera_unavailable',
    'permission_denied',
    'frame_rate_too_low',
];
/**
 * Recorded, never a reason to fail. No torch is every iOS Safari, and a bright
 * enough room works (founder 2026-09-11).
 */
export const CAPABILITY_ADVISORIES = ['no_torch'];
const NOTHING_MEASURED = {
    framesPerSecond: null,
    longestGapMs: null,
    clipped: null,
    coverage: null,
    pulsatileLight: null,
};
/**
 * Runs the five-second check over frames the page already reduced to scalars.
 *
 * @param frames - Five seconds of fingertip frames, oldest first.
 * @param context - Camera and torch facts the frames cannot carry.
 * @returns The outcome, every failed check, advisories, and what was measured.
 */
export function assessCapability(frames, context) {
    const advisories = context.torch === true ? [] : ['no_torch'];
    if (context.camera !== 'available') {
        const reason = context.camera === 'permission_denied' ? 'permission_denied' : 'camera_unavailable';
        return { result: 'hardware_limit', reasons: [reason], advisories, measured: NOTHING_MEASURED };
    }
    const reasons = new Set();
    const spanSec = frames.length < 2 ? 0 : (frames[frames.length - 1].timestampMs - frames[0].timestampMs) / 1000;
    const exposure = spanSec >= MIN_CAPABILITY_SPAN_SEC ? assessExposureStability(frames) : null;
    if (spanSec < MIN_CAPABILITY_SPAN_SEC || exposure === null) {
        // Not enough to judge anything — including the frame rate. A short window
        // is never evidence against the phone.
        reasons.add('too_short');
        return {
            result: 'not_yet_confirmed',
            reasons: [...reasons],
            advisories,
            measured: NOTHING_MEASURED,
        };
    }
    if (exposure.framesPerSecond < MIN_CAPABILITY_FPS)
        reasons.add('frame_rate_too_low');
    if (exposure.longestGapMs > MAX_CAPABILITY_GAP_MS)
        reasons.add('frame_stall');
    const components = assessFrameComponents(frames);
    if (components.coverage < MIN_COVERAGE)
        reasons.add('no_contact');
    if (components.clipping > MAX_CLIPPING)
        reasons.add('over_exposed');
    // Motion makes noise repeat (the synthetic motion fixture reaches 0.68
    // periodicity on green) — a moving finger cannot confirm the path.
    if (components.motion > MAX_MOTION)
        reasons.add('moving');
    if (exposure.dcDriftFraction >= DC_DRIFT_SUSPECT)
        reasons.add('exposure_hunting');
    // The same channel choice the full capture makes (a saturated red with a
    // pulsing green was the first real phone's signature), judged on THAT channel.
    const selection = selectPulseChannel(frames);
    const pulsatileLight = selection === null
        ? null
        : selection.chosen.perfusion >= MIN_PERFUSION && selection.chosen.periodicity >= MIN_LOCK_COHERENCE;
    // 🔴 "No pulsatile light" only when the measurement exists and says so. A
    // null here (timebase could not be resampled) is already covered by the
    // timing reasons; it must not be converted into a verdict about the finger.
    if (pulsatileLight === false)
        reasons.add('no_pulsatile_light');
    const ordered = CAPABILITY_REASONS.filter((r) => reasons.has(r));
    // 🔴 The good outcome is EARNED by an empty failure list AND a positive
    // pulsatile-light measurement — not reached by falling through.
    const result = ordered.some((r) => HARDWARE_REASONS.includes(r))
        ? 'hardware_limit'
        : ordered.length === 0 && pulsatileLight === true
            ? 'signal_path_ok'
            : 'not_yet_confirmed';
    return {
        result,
        reasons: ordered,
        advisories,
        measured: {
            framesPerSecond: round1(exposure.framesPerSecond),
            longestGapMs: Math.round(exposure.longestGapMs),
            clipped: round3(components.clipping),
            coverage: round3(components.coverage),
            pulsatileLight,
        },
    };
}
function round1(v) {
    return Math.round(v * 10) / 10;
}
function round3(v) {
    return Math.round(v * 1000) / 1000;
}
