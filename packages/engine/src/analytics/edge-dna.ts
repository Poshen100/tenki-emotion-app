/**
 * @module analytics/edge-dna
 * @description Edge DNA — the personal decision profile assembled from a
 * user's own long-term history.
 *
 * Edge DNA is NOT a new analysis engine. It is the user-facing name for what
 * AI Coach P2 and P3 already produce: `correlation.ts` supplies the personal
 * correlations, `focus-window.ts` supplies the timing pattern, and this module
 * turns those into named traits. Building a second correlation path here would
 * create two versions of "how sleep affects you" computed different ways —
 * the duplicate-concept drift this codebase has already been bitten by twice.
 *
 * ## The name
 *
 * "DNA" is a metaphor for a personal signature and nothing more. Copy must
 * never imply anything genetic, inherited, or fixed: a Health & Fitness app
 * suggesting it reads genetics is a different review category and a claim the
 * product cannot support. The profile is explicitly revisable — traits change
 * as evidence accumulates, and `PROFILE_REVISABILITY_NOTE` says so on screen.
 *
 * ## No population comparison, ever
 *
 * Every trait is relative to the user's own history. "More sensitive than
 * average" would need population data the device does not have, and would be a
 * comparative health claim even if it did.
 *
 * @see docs/EDGE-DNA-ARCHITECTURE.md
 */

import type { CorrelationFinding, CorrelationResult } from './correlation';
import type { FocusWindowResult } from './focus-window';

// ─────────────────────────────────────────────
// Traits
// ─────────────────────────────────────────────

/** The dimensions a profile can describe. */
export const EDGE_DNA_TRAIT_KINDS = [
  'focus_timing',
  'sleep_sensitivity',
  'stress_tolerance',
  'hrv_coupling',
] as const;
export type EdgeDnaTraitKind = typeof EDGE_DNA_TRAIT_KINDS[number];

/** How pronounced a trait is. Three bands only — finer grading implies precision we do not have. */
export const TRAIT_LEVELS = ['low', 'moderate', 'high'] as const;
export type TraitLevel = typeof TRAIT_LEVELS[number];

/** A single derived trait. */
export interface EdgeDnaTrait {
  readonly kind: EdgeDnaTraitKind;
  /** Display label, e.g. "High Sleep Dependence". */
  readonly label: string;
  /** One line of description. Observational, never causal, never comparative. */
  readonly description: string;
  readonly level: TraitLevel;
  /** Observations behind this trait, shown so the claim carries its evidence. */
  readonly sampleCount: number;
  /** Days of history behind it. */
  readonly spanDays: number;
}

/** Trait label and copy per kind and level. */
interface TraitCopy {
  readonly label: string;
  readonly description: string;
}

/**
 * Trait copy, indexed by kind then level.
 *
 * Every description is phrased as a tendency in the user's own record. Note
 * what is absent: no "because", no "than most people", no instruction about
 * what to do differently.
 */
export const TRAIT_COPY: Readonly<
  Record<EdgeDnaTraitKind, Readonly<Record<TraitLevel, TraitCopy>>>
> = {
  focus_timing: {
    low: {
      label: 'Even Clarity Spread',
      description: 'Your clear states have appeared fairly evenly across the day.',
    },
    moderate: {
      label: 'Loose Focus Window',
      description: 'Your clear states have leaned toward one part of the day.',
    },
    high: {
      label: 'Defined Focus Window',
      description: 'Your clear states have clustered strongly in one part of the day.',
    },
  },
  sleep_sensitivity: {
    low: {
      label: 'Low Sleep Dependence',
      description: 'Your clarity ratings have moved with sleep only loosely.',
    },
    moderate: {
      label: 'Moderate Sleep Dependence',
      description: 'Your clarity ratings have tended to track your sleep.',
    },
    high: {
      label: 'High Sleep Dependence',
      description: 'Your clarity ratings have tracked your sleep closely.',
    },
  },
  stress_tolerance: {
    low: {
      label: 'Sensitive To Strain',
      description: 'Your clarity ratings have tended to fall as strain signals rise.',
    },
    moderate: {
      label: 'Moderate Strain Tolerance',
      description: 'Your clarity ratings have shifted somewhat as strain signals rise.',
    },
    high: {
      label: 'Steady Under Strain',
      description: 'Your clarity ratings have held fairly steady as strain signals rise.',
    },
  },
  hrv_coupling: {
    low: {
      label: 'Loose Recovery Coupling',
      description: 'Your clarity ratings have moved with your recovery signals only loosely.',
    },
    moderate: {
      label: 'Moderate Recovery Coupling',
      description: 'Your clarity ratings have tended to follow your recovery signals.',
    },
    high: {
      label: 'Stable Recovery Focus Zone',
      description: 'Your clarity ratings have followed your recovery signals closely.',
    },
  },
};

/** Shown alongside the profile so it never reads as a fixed verdict. */
export const PROFILE_REVISABILITY_NOTE =
  'This profile describes patterns in your own history so far. It updates as ' +
  'you record more, and it is not a fixed trait.';

// ─────────────────────────────────────────────
// Trait derivation
// ─────────────────────────────────────────────

/**
 * Maps a correlation's magnitude onto a trait level.
 *
 * @param rho - Spearman's rho.
 * @returns The level band.
 */
export function levelFromRho(rho: number): TraitLevel {
  const magnitude = Math.abs(rho);
  if (magnitude >= 0.6) return 'high';
  if (magnitude >= 0.45) return 'moderate';
  return 'low';
}

/**
 * Builds a trait from a correlation finding.
 *
 * Stress tolerance inverts: a strongly NEGATIVE clarity-versus-strain
 * correlation means low tolerance, so the level is flipped before copy is
 * chosen. Getting this backwards would tell a strain-sensitive person they are
 * steady under pressure, which is both wrong and the opposite of useful.
 *
 * @param kind - Which trait to build.
 * @param finding - The correlation behind it.
 * @returns The derived trait.
 */
export function traitFromCorrelation(
  kind: EdgeDnaTraitKind,
  finding: CorrelationFinding
): EdgeDnaTrait {
  const magnitudeLevel = levelFromRho(finding.rho);

  const level: TraitLevel =
    kind === 'stress_tolerance' ? invertLevel(magnitudeLevel) : magnitudeLevel;

  const copy = TRAIT_COPY[kind][level];

  return {
    kind,
    label: copy.label,
    description: copy.description,
    level,
    sampleCount: finding.pairCount,
    spanDays: finding.spanDays,
  };
}

/** Flips a level, for traits where a stronger coupling means less tolerance. */
function invertLevel(level: TraitLevel): TraitLevel {
  if (level === 'high') return 'low';
  if (level === 'low') return 'high';
  return 'moderate';
}

// ─────────────────────────────────────────────
// Profile
// ─────────────────────────────────────────────

/** Minimum traits before a profile is shown at all. */
export const MIN_TRAITS_FOR_PROFILE = 2;

/** Inputs to profile assembly — outputs of the analyses that already exist. */
export interface EdgeDnaInput {
  /** Clarity against sleep duration. */
  readonly sleep: CorrelationResult;
  /** Clarity against strain level. */
  readonly stress: CorrelationResult;
  /** Clarity against a recovery signal such as HRV or autonomic balance. */
  readonly recovery: CorrelationResult;
  /** Focus window from `focus-window.ts`. */
  readonly focusWindow: FocusWindowResult;
}

/** A completed profile. */
export interface EdgeDnaProfile {
  readonly traits: readonly EdgeDnaTrait[];
  /** Total distinct observations behind the profile. */
  readonly evidenceCount: number;
  /** Longest span any trait draws on. */
  readonly spanDays: number;
  /** Always present, always shown. */
  readonly revisabilityNote: string;
}

/** Why no profile could be produced. */
export const PROFILE_GAPS = ['not_enough_traits'] as const;
export type ProfileGap = typeof PROFILE_GAPS[number];

/** Result of assembling a profile. */
export type EdgeDnaResult =
  | { readonly status: 'ready'; readonly profile: EdgeDnaProfile }
  | {
      readonly status: 'building';
      readonly gap: ProfileGap;
      /** Traits found so far, so the UI can show progress honestly. */
      readonly traitsFound: number;
    };

/**
 * Assembles the Edge DNA profile.
 *
 * A profile needs at least two traits. One trait is not a decision style — it
 * is a single observation, and presenting it as a profile would overstate what
 * the data supports.
 *
 * @param input - Results from the underlying analyses.
 * @returns The profile, or the fact that it is still building.
 */
export function buildEdgeDnaProfile(input: EdgeDnaInput): EdgeDnaResult {
  const traits: EdgeDnaTrait[] = [];

  if (input.focusWindow.status === 'ok') {
    const { window, daysOfData } = input.focusWindow;
    const width = window.endHour - window.startHour;
    // A narrow window that captures a high share of clear states is a defined
    // pattern; a wide one is a lean at most.
    const level: TraitLevel =
      width <= 3 && window.clearRate >= 0.6 ? 'high' : width <= 5 ? 'moderate' : 'low';
    const copy = TRAIT_COPY.focus_timing[level];
    traits.push({
      kind: 'focus_timing',
      label: copy.label,
      description: copy.description,
      level,
      sampleCount: window.sampleCount,
      spanDays: daysOfData,
    });
  }

  const correlationTraits: readonly [EdgeDnaTraitKind, CorrelationResult][] = [
    ['sleep_sensitivity', input.sleep],
    ['stress_tolerance', input.stress],
    ['hrv_coupling', input.recovery],
  ];

  for (const [kind, result] of correlationTraits) {
    if (result.status === 'found') {
      traits.push(traitFromCorrelation(kind, result.finding));
    }
  }

  if (traits.length < MIN_TRAITS_FOR_PROFILE) {
    return { status: 'building', gap: 'not_enough_traits', traitsFound: traits.length };
  }

  return {
    status: 'ready',
    profile: {
      traits,
      evidenceCount: traits.reduce((max, t) => Math.max(max, t.sampleCount), 0),
      spanDays: traits.reduce((max, t) => Math.max(max, t.spanDays), 0),
      revisabilityNote: PROFILE_REVISABILITY_NOTE,
    },
  };
}

/**
 * Every trait string the module can emit, for compliance checking.
 *
 * Enumerated by walking the copy table so a newly added trait cannot slip past
 * the compliance test by being forgotten here.
 *
 * @returns All labels and descriptions, plus the revisability note.
 */
export function allEdgeDnaCopy(): string[] {
  const out: string[] = [PROFILE_REVISABILITY_NOTE];
  for (const kind of EDGE_DNA_TRAIT_KINDS) {
    for (const level of TRAIT_LEVELS) {
      out.push(TRAIT_COPY[kind][level].label);
      out.push(TRAIT_COPY[kind][level].description);
    }
  }
  return out;
}
