/**
 * @module domain/policies/reading-claim
 * @description What may honestly be said about one biometric reading.
 *
 * The contract makes every sample carry `derivation` and lets its freshness be
 * classified — but a field nothing reads is a field that changes nothing. This
 * is the layer that reads them, and it exists because the two failures it
 * prevents are invisible at the point they happen:
 *
 *   1. **An estimate presented as a measurement.** A camera HRV and a chest
 *      strap HRV render as the same number in the same font. Only the
 *      derivation distinguishes them, and only if something insists.
 *   2. **Old data presented as current.** "Your HRV is 54" and "your HRV was 54
 *      yesterday morning" are different claims. The first one, made about a
 *      stale sample, is a lie the UI cannot walk back.
 *
 * This produces a structured claim rather than a finished sentence: copy is
 * written per language and per surface, and a string builder here would either
 * be ignored or become a second copy system. What it does instead is decide
 * what the sentence is *allowed* to assert.
 *
 * @see domain/contracts/wearable-sample.ts
 */

import type {
  BiometricMetric,
  BiometricSample,
  BiometricSourcePlatform,
  SampleDerivation,
} from '../contracts/wearable-sample';
import { classifySampleFreshness, sampleAgeMs } from './wearable-source-policy';

/**
 * How a value must be characterised in copy.
 *
 * `measured` and `computed` are both facts about the user's body; `estimated`
 * is an inference, and copy that omits that is making a stronger claim than the
 * data supports.
 */
export const CLAIM_QUALIFIERS = ['measured', 'computed', 'estimated'] as const;
export type ClaimQualifier = typeof CLAIM_QUALIFIERS[number];

/** What tense the reading may be stated in. */
export const CLAIM_TIMINGS = ['now', 'earlier', 'not_current'] as const;
export type ClaimTiming = typeof CLAIM_TIMINGS[number];

/** Derivation → how copy must characterise the value. */
const QUALIFIER_BY_DERIVATION: Readonly<Record<SampleDerivation, ClaimQualifier>> = {
  observed: 'measured',
  derived: 'computed',
  estimated: 'estimated',
};

/** What a surface is permitted to assert about one reading. */
export interface ReadingClaim {
  metric: BiometricMetric;
  value: number;
  /** How the value must be characterised. */
  qualifier: ClaimQualifier;
  /** The strongest tense the sample supports. */
  timing: ClaimTiming;
  /** Age of the sample in ms. */
  ageMs: number;
  sourcePlatform: BiometricSourcePlatform;
  /**
   * True when copy must say the value is an estimate. Derived from
   * `derivation`, never from quality — a pristine camera reading is still an
   * estimate, and a poor strap reading is still computed from real intervals.
   */
  requiresEstimateQualifier: boolean;
}

/**
 * Builds the claim a surface may make about a sample.
 *
 * @param sample - The reading to describe.
 * @param now - Current time (Unix ms).
 * @returns What may be asserted about it.
 */
export function buildReadingClaim(sample: BiometricSample, now: number): ReadingClaim {
  const freshness = classifySampleFreshness(sample, now);

  return {
    metric: sample.metric,
    value: sample.value,
    qualifier: QUALIFIER_BY_DERIVATION[sample.derivation],
    timing: freshness === 'live' ? 'now' : freshness === 'recent' ? 'earlier' : 'not_current',
    ageMs: sampleAgeMs(sample, now),
    sourcePlatform: sample.sourcePlatform,
    requiresEstimateQualifier: sample.derivation === 'estimated',
  };
}

/**
 * Whether a surface may state this reading as the user's state right now.
 *
 * @param sample - The reading.
 * @param now - Current time (Unix ms).
 * @returns False for anything past its metric's usable window.
 */
export function mayClaimAsCurrent(sample: BiometricSample, now: number): boolean {
  return classifySampleFreshness(sample, now) !== 'stale';
}

/**
 * Words that assert a reading describes the present moment.
 * Deliberately short: this list is matched against copy, and every entry is a
 * word a writer could reasonably use innocently, so a false positive costs a
 * real sentence.
 */
export const IMMEDIACY_TERMS = ['right now', 'currently', 'current', 'now', '現在', '目前', '此刻'] as const;

/**
 * Words that mark a value as an inference rather than a measurement.
 * Any one of them satisfies the estimate requirement.
 */
export const ESTIMATE_TERMS = ['estimate', 'estimated', 'approximate', 'approx', '估計', '推估', '約'] as const;

/**
 * Negations that turn an immediacy term into an honest denial.
 *
 * 🔴 This exists because the repo has already been bitten once by the opposite
 * mistake: a compliance checker matching `predict` as a substring flagged the
 * sentence "this is not a prediction" — the honest denial and the banned claim
 * looked identical to it (see MEMORY, 2026-09-09). A checker that cannot tell
 * "your HRV now" from "this is not your HRV now" would push writers toward
 * vaguer copy, which is the opposite of what this module is for.
 */
const NEGATION_PREFIXES = [
  'not ',
  "isn't ",
  'is not ',
  "aren't ",
  'are not ',
  'never ',
  'no longer ',
  '不是',
  '並非',
  '未必',
  '不代表',
] as const;

/** A problem found in copy about a reading. */
export type ReadingCopyProblem =
  | 'stale_stated_as_current'
  | 'estimate_stated_as_measurement';

/** Outcome of checking copy against the reading it describes. */
export interface ReadingCopyCheck {
  ok: boolean;
  problems: ReadingCopyProblem[];
}

/** Whether an immediacy term appears somewhere that is not an honest denial. */
function assertsImmediacy(lowered: string): boolean {
  for (const term of IMMEDIACY_TERMS) {
    let from = 0;
    for (;;) {
      const at = lowered.indexOf(term, from);
      if (at === -1) break;

      const before = lowered.slice(Math.max(0, at - 24), at);
      const negated = NEGATION_PREFIXES.some((prefix) => before.includes(prefix));
      if (!negated) return true;

      from = at + term.length;
    }
  }
  return false;
}

/**
 * Checks user-facing copy against the reading it describes.
 *
 * Only two rules, both about claims the data cannot support. This is not a
 * general copy linter — `packages/engine/src/compliance/safe-copy.ts` is that,
 * and it runs on vocabulary rather than on provenance.
 *
 * @param text - The user-facing copy.
 * @param sample - The reading the copy is about.
 * @param now - Current time (Unix ms).
 * @returns Whether the copy overstates the reading, and how.
 */
export function validateReadingCopy(
  text: string,
  sample: BiometricSample,
  now: number,
): ReadingCopyCheck {
  const lowered = text.toLowerCase();
  const problems: ReadingCopyProblem[] = [];

  if (!mayClaimAsCurrent(sample, now) && assertsImmediacy(lowered)) {
    problems.push('stale_stated_as_current');
  }

  if (sample.derivation === 'estimated') {
    const qualified = ESTIMATE_TERMS.some((term) => lowered.includes(term));
    if (!qualified) problems.push('estimate_stated_as_measurement');
  }

  return { ok: problems.length === 0, problems };
}

// ─────────────────────────────────────────────
// Measurement precision
// ─────────────────────────────────────────────

/**
 * How finely this user's own scans can resolve a change in HRV.
 *
 * The grade exists so a surface can say something useful without printing
 * milliseconds. "±2.3 ms" is true and means nothing to most people; "we can
 * tell apart changes this small" is the same fact in a form someone can act on.
 *
 * Derived from the user's measured noise floor
 * (`packages/engine/src/baseline/noise-floor.ts`), never from a scan's quality
 * score — a single clean scan says nothing about how reproducible the
 * measurement is.
 */
export const PRECISION_GRADES = ['fine', 'usable', 'coarse'] as const;
export type PrecisionGrade = typeof PRECISION_GRADES[number];

/**
 * Boundaries in ms, measured against the synthetic fixtures: a clean finger
 * scan reproduces to about 2-3.5 ms, a weakly perfused one to about 13 ms.
 *
 * ⚠️ These are provisional. They are calibrated against synthetic signals,
 * and the generator carries no day-to-day physiological variation at all —
 * so the boundary that actually matters (how this compares with real human
 * day-to-day spread) cannot be set until there is real-user data.
 * Re-derive them from the first real cohort rather than trusting them.
 */
export const PRECISION_GRADE_BOUNDS = {
  /** At or below this, the instrument resolves finer than most real changes. */
  FINE_MAX_MS: 4,
  /** Above this, only large shifts are distinguishable. */
  USABLE_MAX_MS: 10,
} as const;

/** Grades a measured noise floor. */
export function gradePrecision(noiseFloorMs: number): PrecisionGrade {
  if (noiseFloorMs <= PRECISION_GRADE_BOUNDS.FINE_MAX_MS) return 'fine';
  if (noiseFloorMs <= PRECISION_GRADE_BOUNDS.USABLE_MAX_MS) return 'usable';
  return 'coarse';
}

/** What a surface may state about the instrument's own precision. */
export interface PrecisionClaim {
  grade: PrecisionGrade;
  /** The measured floor in ms — for the evidence layer, not the headline. */
  noiseFloorMs: number;
  /** How many scans the floor rests on. */
  scanCount: number;
  /**
   * True while the floor rests on too few scans to be stated as a fact about
   * the user. A surface may show it as provisional; it may not present it as
   * established.
   */
  provisional: boolean;
}

/** Scans below which a precision claim stays provisional. */
export const MIN_SCANS_FOR_ESTABLISHED_PRECISION = 5;

/**
 * Builds what may be said about measurement precision.
 *
 * @param noiseFloorMs - The measured floor, or null when none is established.
 * @param scanCount - Scans the floor rests on.
 * @returns The claim, or null when there is nothing to say yet.
 */
export function buildPrecisionClaim(
  noiseFloorMs: number | null,
  scanCount: number,
): PrecisionClaim | null {
  if (noiseFloorMs === null || !Number.isFinite(noiseFloorMs) || noiseFloorMs <= 0) {
    return null;
  }

  return {
    grade: gradePrecision(noiseFloorMs),
    noiseFloorMs: Math.round(noiseFloorMs * 10) / 10,
    scanCount,
    provisional: scanCount < MIN_SCANS_FOR_ESTABLISHED_PRECISION,
  };
}
