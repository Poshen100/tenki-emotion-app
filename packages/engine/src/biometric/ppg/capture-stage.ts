/**
 * @module biometric/ppg/capture-stage
 * @description One stage, one instruction — what the capture screen may say now.
 *
 * 🔴 Why this exists (founder 2026-09-15, PULSE LENS brief §3/§6): the capture
 * screen had become an engineering diagnostic panel. It showed six numbers and
 * several corrective sentences at once, for ninety seconds, and left the user to
 * work out which one to act on. The measurements are right; the presentation was
 * asking the user to do the triage.
 *
 * So this module does the triage, and it does it **over measurements that
 * already exist** — `CaptureReadiness`, `LiveReading`, `PulseLockState`,
 * `ExposureStability`. It introduces no new threshold, and deliberately so: a
 * stage machine that invented its own bars would be a second opinion about the
 * signal, and the surface would then be able to disagree with the gate.
 *
 * 🔴 The two rules that keep it honest:
 *   - **Exactly one instruction**, chosen by priority, or none. A list of four
 *     things to fix is a list the user reads instead of acting on.
 *   - **Stages never run ahead of the evidence.** `pulse_candidate` needs a
 *     window that actually met the reading gate; `pulse_locked` needs that
 *     sustained. Both come from `live.ts` rather than being re-derived here,
 *     so the picture and the verdict cannot drift apart.
 *
 * ⚠️ What this does NOT do: it never says a beat happened. Per-beat ripples and
 * haptics need a live beat detector with its own gate, which does not exist yet
 * — and until it does, the honest render is no ripple at all (brief §7).
 *
 * @see docs/PHONE-PPG.md
 */

import type { CaptureReadiness } from './capture-readiness';
import type { ExposureStability } from './exposure-stability';
import type { LiveReading, PulseLockState } from './live';

/**
 * How far the capture has got, in the order the user experiences it.
 *
 * `needs_adjustment` is deliberately last and is NOT a step on that path: it is
 * where the capture goes when it had already reached the light field and then
 * something broke. "You had it, fix this" is a different message from "you are
 * still getting there", and collapsing them loses the distinction.
 */
export const CAPTURE_STAGES = [
  'searching_contact',
  'locking_light',
  'searching_rhythm',
  'pulse_candidate',
  'pulse_locked',
  'needs_adjustment',
] as const;

export type CaptureStage = typeof CAPTURE_STAGES[number];

/**
 * The single thing to tell the user to do.
 *
 * 🔴 Tokens, not sentences. Copy lives on the surface, where the compliance
 * layer reviews it; the engine may not hold user-facing wording.
 */
export const CAPTURE_INSTRUCTIONS = [
  'cover_lens',
  'cover_more',
  'relax_touch',
  'hold_still',
  'camera_adapting',
  'warm_fingertip',
] as const;

export type CaptureInstruction = typeof CAPTURE_INSTRUCTIONS[number];

/**
 * The states the capture screen shows, exactly as specified (founder
 * 2026-09-15, COVERAGE LOCK brief).
 *
 * 🔴 These are **display** states, derived from `CaptureStage` and the single
 * instruction — not a second state machine. The engine stage stays the truth;
 * this is the vocabulary the screen speaks, and it is finer in the places the
 * user has to act differently (a coverage gap and an over-exposed field are one
 * engine stage but two different things to do).
 */
export const PULSE_LENS_STATES = [
  'searching_contact',
  'coverage_gap',
  'light_locking',
  'pressure_adjustment',
  'field_shifted',
  'coverage_locked',
  'rhythm_search',
  'pulse_locked',
] as const;

export type PulseLensState = typeof PULSE_LENS_STATES[number];

/**
 * The three things the persistent evidence row reports.
 *
 * 🔴 Each is a live reading of a measured condition, not a memory of having
 * once met it. The brief asks for the row to stay visible through refinement;
 * staying visible is not the same as staying green, and a row that kept
 * claiming "confirmed" after the finger slipped would be the sticky-lock
 * dishonesty the Pulse Lock was specifically built to avoid.
 *
 * ⚠️ None of these claims literal physical coverage or a pressure measurement.
 * `coverageConfirmed` means every cell of the sampled field is transmitting —
 * a statement about the optical field, which is the thing actually measured.
 */
export interface CoverageEvidence {
  /** Every cell of the coverage field is transmitting. */
  coverageConfirmed: boolean;
  /** Exposure has headroom and the camera is not re-deciding its level. */
  lightUniform: boolean;
  /** The hand is still and the contact is not wobbling. */
  contactSteady: boolean;
  /** All three at once — what `coverage_locked` rests on. */
  allConfirmed: boolean;
}

/**
 * The instructions in the order the problems have to be FIXED, each with the
 * condition that raises it. First match wins; that is the whole rule.
 *
 * ⚠️ This is one table, not a priority list beside a separate set of checks.
 * The first version had both, and they happened to be written in the same
 * order — so reordering the priority list changed nothing observable and a test
 * could not tell a correct implementation from one that ignored priority
 * entirely. One ordering in one place cannot drift from itself.
 *
 * 🔴 The order is fix-order, not severity: there is no point telling someone to
 * hold still while their finger is off the lens, and a pressure reading is not
 * trustworthy while the exposure is still hunting.
 */
const INSTRUCTION_RULES: readonly {
  instruction: CaptureInstruction;
  applies: (input: CaptureStageInput) => boolean;
}[] = [
  {
    instruction: 'cover_lens',
    applies: ({ readiness }) =>
      readiness !== undefined &&
      !readiness.ready &&
      (readiness.blocker === 'no_contact' || readiness.blocker === 'no_signal'),
  },
  {
    instruction: 'cover_more',
    applies: ({ reading, readiness }) =>
      (readiness !== undefined && !readiness.ready && readiness.blocker === 'partial_contact') ||
      reading.contactCoverage < CONTACT_FOR_LIGHT,
  },
  {
    // 🔴 BEFORE `relax_touch`, and the reason is written two paragraphs up:
    // a pressure reading is not trustworthy while the exposure is still
    // hunting. The first version had these the other way round — the comment
    // said one thing and the table did the other, so a capture whose camera was
    // re-deciding its own gain would blame the user's grip. founder caught it
    // in the COVERAGE LOCK brief ("exposure drift triggers light_locking, not a
    // false pressure claim").
    instruction: 'camera_adapting',
    // `=== true` rather than an optional chain's `boolean | undefined`: null
    // means "too few frames to say", and that is not "the camera is hunting".
    applies: ({ exposure }) => exposure?.slowDriftDominates === true,
  },
  {
    instruction: 'relax_touch',
    applies: ({ reading }) => reading.lightStability < LIGHT_SETTLED,
  },
  {
    instruction: 'hold_still',
    applies: ({ reading }) => 1 - reading.motionArtifact < STILLNESS_FOR_RHYTHM,
  },
  {
    instruction: 'warm_fingertip',
    applies: ({ reading }) => reading.reasons.includes('low_perfusion'),
  },
];

/** The fix order, exposed so a surface can render the rail in the same order. */
export const INSTRUCTION_PRIORITY: readonly CaptureInstruction[] = INSTRUCTION_RULES.map(
  (r) => r.instruction,
);

/** What the capture screen may show right now. */
export interface CaptureStageView {
  stage: CaptureStage;
  /** The state the screen names, in the brief's own vocabulary. */
  lensState: PulseLensState;
  /** Live status of the three evidence items. */
  evidence: CoverageEvidence;
  /** The one thing to do, or null when nothing needs doing. */
  instruction: CaptureInstruction | null;
  /**
   * True once a reading would be produced if the capture ended now.
   *
   * Quoted from the lock rather than recomputed — same reason the stages are.
   */
  wouldYieldReading: boolean;
}

/** Everything the stage machine is allowed to look at. */
export interface CaptureStageInput {
  /** The running window's assessment. */
  reading: LiveReading;
  /** How long the reading gate has held. */
  lock: PulseLockState;
  /** Camera steadiness, or null when too few frames to say. Null is not "fine". */
  exposure: ExposureStability | null;
  /**
   * Positioning, for the phase before the capture starts. Pass it while the
   * pre-roll gate is running; omit it once the clock is going.
   */
  readiness?: CaptureReadiness;
  /**
   * The stage the previous window resolved to.
   *
   * 🔴 Required for `needs_adjustment`, and an explicit input rather than a
   * guess. "You had the light field and lost it" is a claim about **history**,
   * and a function that sees one window cannot make it. The first version tried
   * to infer it from the window being long enough to assess rhythm — which is
   * true of a capture that never had a light field at all, so it would have
   * told a user they lost something they never got.
   */
  previousStage?: CaptureStage;
  /**
   * Uncovered cells in the coverage field, or null when no field was computed.
   *
   * 🔴 Null is NOT zero. "We did not look" must never render as "confirmed".
   */
  uncoveredCells?: number | null;
}

/**
 * Stages that mean the light field was established.
 *
 * Reaching any of these and then hitting a blocking problem is a regression,
 * which is a different message from still getting there.
 */
const PAST_LIGHT_LOCK: readonly CaptureStage[] = [
  'searching_rhythm',
  'pulse_candidate',
  'pulse_locked',
  'needs_adjustment',
];

/**
 * Reduces every live measurement to one stage and at most one instruction.
 *
 * @param input - The measurements already taken this window.
 * @returns What the screen may say now.
 */
export function resolveCaptureStage(input: CaptureStageInput): CaptureStageView {
  const { reading, lock, exposure, readiness } = input;

  const instruction = pickInstruction(input);
  const wouldYieldReading = lock.locked;
  const evidence = assessCoverageEvidence(input);
  const decorate = (stage: CaptureStage, yieldsReading: boolean): CaptureStageView => ({
    stage,
    lensState: resolveLensState(stage, instruction, evidence, reading),
    evidence,
    instruction,
    wouldYieldReading: yieldsReading,
  });

  // Before the clock starts the readiness gate owns the verdict — it is the
  // thing that decides whether the capture may begin at all.
  if (readiness !== undefined && !readiness.ready) {
    return decorate(
      readiness.blocker === 'no_signal' || readiness.blocker === 'no_contact'
        ? 'searching_contact'
        : 'locking_light',
      false,
    );
  }

  if (lock.locked) return decorate('pulse_locked', wouldYieldReading);

  // Contact is the only thing that stops the capture being about light at all.
  if (reading.contactCoverage < CONTACT_FOR_LIGHT) {
    return decorate('searching_contact', wouldYieldReading);
  }

  // 🔴 A problem AFTER the light field was established is a regression, and it
  // is named as one — but only on the evidence that there was something to
  // lose, which is `previousStage`, not a guess from this window.
  const regressed =
    instruction !== null &&
    input.previousStage !== undefined &&
    PAST_LIGHT_LOCK.includes(input.previousStage);
  if (regressed) return decorate('needs_adjustment', wouldYieldReading);

  const lightSettled =
    reading.lightStability >= LIGHT_SETTLED && (exposure === null || !exposure.slowDriftDominates);
  if (!lightSettled || instruction !== null) {
    return decorate('locking_light', wouldYieldReading);
  }

  // Candidate vs searching is quoted from the gate the final reading uses, via
  // `meetsReadingGate` — never re-derived from the rhythm number here.
  return decorate(
    reading.meetsReadingGate ? 'pulse_candidate' : 'searching_rhythm',
    wouldYieldReading,
  );
}

/**
 * Reads the three evidence items off the measurements.
 *
 * @param input - The same measurements the stage rests on.
 * @returns Live status of each item; `coverageConfirmed` is false when no
 *   coverage field was computed, because "we did not look" is not "confirmed".
 */
export function assessCoverageEvidence(input: CaptureStageInput): CoverageEvidence {
  const { reading, exposure, uncoveredCells } = input;

  const coverageConfirmed =
    uncoveredCells !== undefined && uncoveredCells !== null && uncoveredCells === 0;
  const lightUniform =
    reading.lightStability >= LIGHT_SETTLED && exposure?.slowDriftDominates !== true;
  const contactSteady =
    1 - reading.motionArtifact >= STILLNESS_FOR_RHYTHM &&
    reading.contactCoverage >= CONTACT_FOR_LIGHT;

  return {
    coverageConfirmed,
    lightUniform,
    contactSteady,
    allConfirmed: coverageConfirmed && lightUniform && contactSteady,
  };
}

/**
 * Names the display state.
 *
 * 🔴 An instruction, when there is one, decides the state — the screen shows
 * the thing to do. Only when nothing needs fixing does the stage speak.
 *
 * ⚠️ `warm_fingertip` is the one instruction with no state of its own: a cold
 * fingertip is not a coverage, light or movement problem, so the state stays
 * whatever the capture is actually doing and the instruction line carries it.
 * Inventing a ninth state for it would break "these exact display states".
 */
function resolveLensState(
  stage: CaptureStage,
  instruction: CaptureInstruction | null,
  evidence: CoverageEvidence,
  reading: LiveReading,
): PulseLensState {
  switch (instruction) {
    case 'cover_lens':
      return 'searching_contact';
    case 'cover_more':
      return 'coverage_gap';
    case 'camera_adapting':
      return 'light_locking';
    case 'relax_touch':
      return 'pressure_adjustment';
    case 'hold_still':
      return 'field_shifted';
    default:
      break;
  }

  if (stage === 'pulse_locked') return 'pulse_locked';
  // Rhythm becomes assessable only once the window is long enough to look;
  // before that the honest headline is the coverage milestone, not a search
  // for something nobody has started looking for.
  if (reading.rhythmicCoherence !== null) return 'rhythm_search';
  if (evidence.allConfirmed) return 'coverage_locked';
  return 'light_locking';
}

/**
 * Contact below which the capture is not yet about light.
 *
 * Reuses the readiness gate's own floor so the two cannot disagree about what
 * "on the lens" means.
 */
export const CONTACT_FOR_LIGHT = 0.5;

/** Exposure headroom the light field needs before rhythm is worth discussing. */
export const LIGHT_SETTLED = 0.5;

/** Stillness below which movement is the thing to fix. */
export const STILLNESS_FOR_RHYTHM = 0.5;

/** The first rule whose condition holds, or null when none does. */
function pickInstruction(input: CaptureStageInput): CaptureInstruction | null {
  return INSTRUCTION_RULES.find((rule) => rule.applies(input))?.instruction ?? null;
}
