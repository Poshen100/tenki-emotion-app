/**
 * ⚠️ GENERATED FILE — DO NOT EDIT.
 *
 * Compiled from packages/engine/src by scripts/build-preview-ppg.mjs so the
 * preview runs the engine's own pipeline instead of a hand-written mirror.
 * Edit the TypeScript, then run: node scripts/build-preview-ppg.mjs
 * The merge gate (scripts/preview-ppg-sync.mjs) fails if the two drift apart.
 */
/**
 * @module compliance/evidence-label
 * @description 量到／算出／推論 —— the label every displayed number carries.
 *
 * founder 2026-11-24 (`docs/P0-CAPABILITY-AND-EVIDENCE.md` §2). A label is not
 * one word, it is four fields, because one word is exactly how an unvalidated
 * camera number ends up looking as trustworthy as a strap's:
 *
 *   - `layer`      — how far the number was processed (measured → calculated → inferred)
 *   - `source`     — what produced it
 *   - `beatTiming` — for anything built on beats: is the beat timing guaranteed?
 *   - `quality` + `validation` — this capture's state, and whether the device
 *     has been checked against a reference
 *
 * 🔴 **Headline eligibility is NOT decided here and never reads `layer`.**
 * "Calculated" says how a number was made, not that it may be believed. The
 * Pulse Rhythm headline is decided by `resolvePrvHeadline()` (#27) alone; a
 * label for a headline number is built FROM that decision, so the explanation
 * and the thing explained cannot drift into two stories (CLAUDE.md).
 *
 * 🔴 Self-report (P1) is a fourth SOURCE, "你填的" (founder 2026-11-27). It
 * takes the `reported` layer and never one of the three data layers — a typed
 * feeling must not pass as something the camera measured.
 *
 * Lives in engine, not domain: the engine does not import domain (PLAYBOOK §7)
 * and the preview bundle is built from engine — one definition, not two.
 * `beatTiming` mirrors `SampleDerivation` in
 * `domain/src/contracts/wearable-sample.ts` (canonical), the same way
 * `PULSE_ANCHOR_DERIVATION` does.
 */
/** How far a number was processed. Ordered: measured < calculated < inferred. */
export const EVIDENCE_LAYERS = ['measured', 'calculated', 'inferred'];
/** The layer a self-reported value takes — never one of the three above. */
export const REPORTED_LAYER = 'reported';
/** What produced the number. */
export const EVIDENCE_SOURCES = [
    'camera_fingertip',
    'camera_face_framing',
    'chest_strap',
    'your_records',
    'self_report',
];
/** Mirrors `SampleDerivation` (domain, canonical). */
export const BEAT_TIMINGS = ['observed', 'derived', 'estimated'];
export const EVIDENCE_QUALITIES = ['passed', 'limited', 'withheld'];
export const EVIDENCE_VALIDATIONS = ['none', 'this_device_preliminary'];
const LAYER_COPY = {
    measured: '量到',
    calculated: '算出',
    inferred: '推論',
    reported: '你填的',
};
const SOURCE_COPY = {
    camera_fingertip: '手機相機・指尖',
    camera_face_framing: '手機相機・臉部取景',
    chest_strap: '胸帶',
    your_records: '你自己的紀錄',
    self_report: '你自己填的',
};
const BEAT_TIMING_COPY = {
    observed: '拍點由裝置直接量到',
    derived: '從裝置量到的拍間距算出',
    estimated: '拍點時間不保證（從光的波形推回來的）',
};
const QUALITY_COPY = {
    passed: '這次的品質過關',
    limited: '這次的品質有限',
    withheld: '這次品質不夠，沒有報',
};
const VALIDATION_COPY = {
    none: '還沒有對照驗證',
    // Same sentence as the #27 headline note — one wording for one fact.
    this_device_preliminary: '這台手機做過初步的胸帶對照（只代表這台手機）',
};
/**
 * Checks that a label is internally consistent. A label that breaks these is a
 * programming error, not a display choice.
 *
 * @param label - The label to check.
 * @returns Why it is inconsistent, or null when it is fine.
 */
export function evidenceLabelProblem(label) {
    const reported = label.layer === REPORTED_LAYER;
    if (reported !== (label.source === 'self_report')) {
        return 'self_report and the reported layer go together, and only together';
    }
    if (label.source.startsWith('camera_') && label.beatTiming !== undefined && label.beatTiming !== 'estimated') {
        return 'a camera cannot guarantee beat timing';
    }
    if (label.validation === 'this_device_preliminary' && label.source !== 'camera_fingertip') {
        return 'only the fingertip camera has a chest-strap check (#27)';
    }
    return null;
}
/**
 * Renders a label. The ONLY place label words are produced.
 *
 * @param label - The label.
 * @returns One string per field.
 * @throws When the label is inconsistent — see {@link evidenceLabelProblem}.
 */
export function evidenceLabelCopy(label) {
    const problem = evidenceLabelProblem(label);
    if (problem !== null)
        throw new Error(`Inconsistent evidence label: ${problem}`);
    return {
        layer: LAYER_COPY[label.layer],
        source: SOURCE_COPY[label.source],
        beatTiming: label.beatTiming === undefined ? null : BEAT_TIMING_COPY[label.beatTiming],
        quality: QUALITY_COPY[label.quality],
        validation: VALIDATION_COPY[label.validation],
    };
}
/**
 * The label as one line (`算出 · 手機相機・指尖 · 拍點時間不保證… · …`).
 *
 * @param label - The label.
 * @returns All fields, joined in a fixed order.
 */
export function evidenceLabelLine(label) {
    const c = evidenceLabelCopy(label);
    return [c.layer, c.source, c.beatTiming, c.quality, c.validation].filter((s) => s !== null).join(' · ');
}
