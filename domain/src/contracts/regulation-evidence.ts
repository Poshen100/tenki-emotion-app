/**
 * @module domain/contracts/regulation-evidence
 * @description What TENKI records about autonomic regulation — and the shape
 * that makes the claims it cannot support unrepresentable.
 *
 * 🔴 **A phone cannot measure sympathetic or parasympathetic activity.** It can
 * measure pulse, and under strict conditions the variation between beats and a
 * respiratory rhythm. Those are indirect evidence of how the autonomic system
 * is regulating the heart and the breath — not the nervous system itself.
 *
 * So this contract has no `sympatheticScore`, no `parasympatheticScore`, no
 * `balance`, and no LF/HF ratio. That is the point of writing it down: modern
 * methodological guidance is explicit that LF is not a selective sympathetic
 * index and that LF/HF should not be described as sympathovagal balance, and a
 * field named `balance` would be filled in by someone eventually. There is
 * nothing here to fill in.
 *
 * What it records instead is evidence, with its provenance attached:
 *   - what was measured,
 *   - how well it was seen,
 *   - where it came from,
 *   - and how much of a claim that supports.
 *
 * Wearables raise evidence coverage; they never invalidate the phone-only
 * history that came before them, because every entry says what produced it.
 *
 * @see docs/PHONE-PPG.md
 */

/** How well a signal was seen. Separate from where it came from. */
export const EVIDENCE_QUALITY_LEVELS = ['low', 'moderate', 'high'] as const;
export type EvidenceQuality = typeof EVIDENCE_QUALITY_LEVELS[number];

/** How much of a claim the evidence supports. */
export const EVIDENCE_CONFIDENCE_LEVELS = ['low', 'moderate', 'high'] as const;
export type EvidenceConfidence = typeof EVIDENCE_CONFIDENCE_LEVELS[number];

/** Where a pulse reading came from. */
export const PULSE_PROVENANCE = ['camera_fingertip_ppg', 'ble_chest_strap', 'wearable'] as const;
export type PulseProvenance = typeof PULSE_PROVENANCE[number];

/** Where a respiratory reading came from. */
export const BREATH_PROVENANCE = [
  'camera_ppg_derived',
  'front_camera_motion',
  'phone_imu',
  'wearable',
] as const;
export type BreathProvenance = typeof BREATH_PROVENANCE[number];

/** The pulse half of one regulation check. */
export interface PulseEvidence {
  /** Beats per minute, or null when nothing was established. */
  bpm: number | null;
  quality: EvidenceQuality;
  provenance: PulseProvenance;
  /**
   * Pulse-rate variability in ms, or null.
   *
   * 🔴 Present on the PULSE side and named PRV, never `hrv`. A camera infers
   * beat times from a light curve; a chest strap measures the intervals. They
   * are different quantities and this contract never lets one stand in for the
   * other — see `packages/engine/src/biometric/ppg/beat-template.ts` for what
   * happens when they are confused.
   */
  prvRmssdMs: number | null;
}

/** The breath half of one regulation check. */
export interface BreathEvidence {
  /**
   * Breaths per minute, or null.
   *
   * Labelled camera-derived respiratory rate wherever it is shown. Never
   * clinical respiratory monitoring.
   */
  rateBpm: number | null;
  /** How consistent the respiratory cycle was, 0..1, or null. */
  rhythmStability: number | null;
  quality: EvidenceQuality;
  provenance: BreathProvenance;
}

/** How strongly the pulse rhythm tracked the breath rhythm. */
export const COUPLING_STATUSES = ['unavailable', 'weak', 'present', 'strong'] as const;
export type CouplingStatus = typeof COUPLING_STATUSES[number];

/**
 * Breath-pulse coupling.
 *
 * ⚠️ `unavailable` is the only value TENKI can produce today — nothing computes
 * this yet, and its Edge Score budget is reserved and unspent
 * (`PHONE_EVIDENCE_CAPS.coupling`). It is in the contract so the surfaces and
 * the storage are already shaped for it, not because it works.
 */
export interface CouplingEvidence {
  status: CouplingStatus;
  confidence: EvidenceConfidence;
}

/** How the evidence was arrived at. */
export const INTERPRETATION_MODES = ['measured', 'mixed', 'inferred'] as const;
export type InterpretationMode = typeof INTERPRETATION_MODES[number];

/** What may be said about this check relative to the user's own history. */
export interface RegulationInterpretation {
  mode: InterpretationMode;
  /**
   * How far this check sits from the user's comparable history, in standard
   * deviations, or null when there is not enough comparable history.
   *
   * 🔴 Null is the honest answer for most users for most of their first weeks,
   * and a surface must render that as "not enough yet" rather than as zero.
   */
  baselineDeviation: number | null;
  /** How many comparable checks the deviation rests on. */
  sampleCount: number;
  confidence: EvidenceConfidence;
}

/**
 * One regulation check: what was measured, how well, from where, and what that
 * supports.
 *
 * 🔴 There is deliberately no overall "regulation score" field. A single number
 * would be read as a measurement of the nervous system, which is the one claim
 * this whole contract exists to avoid.
 */
export interface RegulationEvidence {
  measuredAt: number;
  pulse: PulseEvidence;
  breath: BreathEvidence;
  coupling: CouplingEvidence;
  interpretation: RegulationInterpretation;
}

/** Phrases that must never describe this evidence to a user. */
export const FORBIDDEN_AUTONOMIC_CLAIMS = [
  'sympathetic score',
  'parasympathetic score',
  'sympathovagal balance',
  'vagal score',
  'lf/hf',
  'nervous system score',
  'camera hrv',
  '交感神經值',
  '副交感神經值',
  '交感副交感平衡',
  '自律神經分數',
] as const;

/**
 * Whether a line of user-facing copy makes a claim this contract forbids.
 *
 * ⚠️ Substring matching, so it is a floor and not a proof — but the floor is
 * what stops the specific phrasings that are known to be wrong from being
 * typed back in later.
 *
 * @param copy - The user-facing line.
 * @returns Every forbidden phrase it contains.
 */
export function findForbiddenAutonomicClaims(copy: string): string[] {
  const lower = copy.toLowerCase();
  return FORBIDDEN_AUTONOMIC_CLAIMS.filter((phrase) => lower.includes(phrase));
}
