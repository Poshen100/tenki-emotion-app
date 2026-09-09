/**
 * @module intelligence/copy
 * @description The ONLY place Decision Intelligence produces user-facing words.
 *
 * Everything here is checked, string by string, against
 * `compliance/safe-copy.ts` in this module's tests. Copy written anywhere else
 * in this layer is copy nobody is guarding — that is the whole reason this file
 * exists rather than each module formatting its own sentences.
 *
 * 🔴 The word "prediction" is deliberately absent, including from the denial
 * "this is not a prediction". `PROHIBITED_VOCABULARY` matches `predict` as a
 * blunt substring, so the honest denial and the forbidden claim look identical
 * to the checker. The denial is phrased with "forecast" instead — it says the
 * same thing and stays inside the guard. **Do not "fix" this back**: it will
 * fail the compliance test, and loosening the checker to allow it would open a
 * hole the checker exists to close.
 *
 * @version 3.0
 * @see docs/DECISION-INTELLIGENCE.md § 5 (文案紅線)
 */

import type { ConfidenceBand } from '../common/types';
import type { CalibrationResult } from './calibration';
import type { DriftResult } from './drift';
import type { EvidenceBasis, EvidenceReasonCode } from './evidence';
import type { DecisionTwinResult } from './twin';

// ─────────────────────────────────────────────
// Shared pieces
// ─────────────────────────────────────────────

/** Rendered copy for one insight surface. */
export interface InsightCopy {
  /** Short headline. */
  headline: string;
  /** Explanatory body. */
  body: string;
  /** The number line, or null when there is no number to show. */
  figure: string | null;
  /** What the claim rests on — always present, even for a refusal. */
  evidenceLine: string;
}

/**
 * Renders a confidence band for display.
 *
 * @param band - The confidence band.
 * @returns Capitalized band name.
 */
export function formatConfidence(band: ConfidenceBand): string {
  return band.charAt(0).toUpperCase() + band.slice(1);
}

/**
 * Renders a countable noun with its number, pluralizing only when needed.
 *
 * @param count - How many.
 * @param singular - Singular form of the noun.
 * @returns e.g. "1 session" / "24 sessions".
 */
export function formatCount(count: number, singular: string): string {
  return `${count} ${singular}${count === 1 ? '' : 's'}`;
}

/**
 * Renders the evidence line shown under every insight.
 *
 * @param evidence - The evidence basis behind the claim.
 * @returns e.g. "Based on 24 comparable sessions · Confidence: Moderate".
 */
export function evidenceLine(evidence: EvidenceBasis): string {
  return `Based on ${formatCount(evidence.sampleCount, 'comparable session')} · Confidence: ${formatConfidence(evidence.confidence)}`;
}

/**
 * Renders one Evidence X-Ray row: why the confidence is what it is.
 *
 * @param code - The reason code.
 * @returns A sentence the user can read.
 */
export function evidenceReasonCopy(code: EvidenceReasonCode): string {
  switch (code) {
    case 'sample_floor_not_met':
      return 'There are not yet enough comparable sessions to say anything here.';
    case 'sample_count_below_high':
      return 'Fewer comparable sessions than TENKI wants before calling this high confidence.';
    case 'window_too_short':
      return 'These sessions do not yet span enough separate days.';
    case 'inferred_only':
      return 'Everything behind this line is inferred; nothing here was measured directly.';
    case 'low_variability_reference':
      return 'Your readings have barely varied so far, so this distance is graded roughly.';
    case 'mixed_capture_conditions':
      return 'The two readings were captured differently, so they are not directly comparable.';
  }
}

// ─────────────────────────────────────────────
// Drift Alert
// ─────────────────────────────────────────────

/**
 * Renders the Drift Alert surface.
 *
 * 🔴 The headline and figure carry DISTANCE only. `direction` never reaches the
 * words — see `intelligence/drift.ts` for why higher/lower must not be spoken
 * as above/below baseline. The `+` in the figure marks "away from", not a
 * direction; there is no `-` variant by design.
 *
 * @param result - The drift result, claim or refusal.
 * @returns Headline, body, figure and evidence line.
 */
export function driftCopy(result: DriftResult): InsightCopy {
  if (result.state === 'insufficient') {
    return {
      headline: 'Building your baseline',
      body: 'TENKI needs a few more comparable sessions before it can tell a passing wobble from a real shift.',
      figure: `${formatCount(result.moreSamplesNeeded, 'more comparable session')} needed`,
      evidenceLine: evidenceLine(result.evidence),
    };
  }

  if (result.magnitude === 'within') {
    return {
      headline: 'You are inside your usual range',
      body: 'Your reading sits about where it usually sits at this time of day.',
      figure: `${result.distance} from your baseline`,
      evidenceLine: evidenceLine(result.evidence),
    };
  }

  return {
    headline: 'Your state is shifting',
    body: 'Not worse. Just different from the version of you that usually follows the plan.',
    figure: `+${result.distance} away from your baseline`,
    evidenceLine: evidenceLine(result.evidence),
  };
}

// ─────────────────────────────────────────────
// Calibration Proof
// ─────────────────────────────────────────────

/**
 * Renders the Calibration Proof surface.
 *
 * 🔴 `no_clear_shift` is written as a result, never as a setback and never with
 * an invitation to try again until it "works". Rewriting it into encouragement
 * dismantles the one thing that makes the positive verdict believable.
 *
 * @param result - The calibration result, verdict or refusal.
 * @returns Headline, body, figure and evidence line.
 */
export function calibrationCopy(result: CalibrationResult): InsightCopy {
  if (result.state === 'insufficient') {
    const mixed = result.evidence.reasons.includes('mixed_capture_conditions');
    return {
      headline: 'Not comparable',
      body: mixed
        ? 'These two readings were captured differently, so the difference would describe the instrument rather than you.'
        : 'There is not enough here to compare the two readings honestly.',
      figure: null,
      evidenceLine: evidenceLine(result.evidence),
    };
  }

  const figure = `${result.before} → ${result.after}`;
  const priors = result.priorSummary;
  const priorLine = priors
    ? ` Similar in ${priors.similar} of your last ${formatCount(priors.total, 'session')}.`
    : '';

  if (result.verdict === 'improved') {
    return {
      headline: 'Calibration response',
      body: `Your state moved closer to where it usually sits.${priorLine}`,
      figure,
      evidenceLine: evidenceLine(result.evidence),
    };
  }

  if (result.verdict === 'declined') {
    return {
      headline: 'Further from your usual range',
      body: `This reset did not settle you this time.${priorLine}`,
      figure,
      evidenceLine: evidenceLine(result.evidence),
    };
  }

  return {
    headline: 'No clear shift yet',
    body: `Nothing moved further than your own day-to-day range. That is not a failure — it is your most honest signal right now.${priorLine}`,
    figure,
    evidenceLine: evidenceLine(result.evidence),
  };
}

// ─────────────────────────────────────────────
// Decision Twin
// ─────────────────────────────────────────────

/**
 * Renders the Decision Twin surface.
 *
 * 🔴 History only. Counts are stated in process language, the denial that this
 * forecasts anything is always attached, and a run of divergence is never
 * emphasized as failure.
 *
 * @param result - The twin result, claim or refusal.
 * @returns Headline, body, figure and evidence line.
 */
export function twinCopy(result: DecisionTwinResult): InsightCopy {
  if (result.state === 'insufficient') {
    return {
      headline: 'Building your decision twins',
      body: 'Once enough of your sessions look alike, TENKI can show you what you usually do from here.',
      figure: `${formatCount(result.moreSamplesNeeded, 'more matching session')} needed`,
      evidenceLine: evidenceLine(result.evidence),
    };
  }

  const resemblance = `This moment resembles ${formatCount(result.matchCount, 'of your past decision session')}.`;
  const outcome =
    result.divergedCount === 0
      ? 'In all of them, you followed your own process.'
      : `In ${result.divergedCount} of them, you did not end up following your own process.`;

  return {
    headline: 'TENKI noticed',
    body: `${resemblance} ${outcome} This is not a forecast — it is your own recorded history.`,
    figure: null,
    evidenceLine: evidenceLine(result.evidence),
  };
}
