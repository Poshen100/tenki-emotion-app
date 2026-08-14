/**
 * @module analytics/correlation
 * @description Personal correlation analysis — the statistical layer under
 * Edge DNA (AI Coach P2).
 *
 * Everything here answers one shape of question: within THIS person's own
 * history, does one signal move with their decision clarity? Never against a
 * population — a comparison to other people is a health claim, and it is also
 * not something a device-local dataset can honestly make.
 *
 * Three deliberate statistical choices, because a wellness product telling
 * someone "you are highly sleep-dependent" on thin evidence does real harm:
 *
 * 1. **Spearman, not Pearson.** Clarity is a 1–5 ordinal self-rating, not an
 *    interval measure. Rank correlation is the honest tool for it and shrugs
 *    off the outliers a small personal dataset is full of.
 * 2. **Effect size, not significance.** With n in the dozens and four traits
 *    tested, p-values invite the multiple-comparisons trap: at p<0.05 across
 *    four independent tests there is roughly a one-in-five chance of at least
 *    one spurious "trait". We report a magnitude threshold instead and never
 *    claim significance.
 * 3. **Split-half stability.** A correlation must hold in BOTH halves of the
 *    history, in the same direction, before it is reported. Noise rarely
 *    survives that; a real personal pattern usually does. This is the main
 *    defence against telling someone a fluke is part of who they are.
 *
 * @see docs/EDGE-DNA-ARCHITECTURE.md §3
 */

// ─────────────────────────────────────────────
// Gating constants
// ─────────────────────────────────────────────

/** Minimum paired observations before any correlation is reported. */
export const MIN_PAIRS_FOR_CORRELATION = 20;

/** Minimum |rho| for a correlation to be surfaced at all. */
export const MIN_ABS_RHO = 0.35;

/** Minimum |rho| each half must reach for the pattern to count as stable. */
export const MIN_HALF_ABS_RHO = 0.15;

/** Minimum days the observations must span, so a single week cannot form a trait. */
export const MIN_SPAN_DAYS = 14;

/** Strength bands for a reported correlation. */
export const CORRELATION_STRENGTHS = ['moderate', 'strong'] as const;
export type CorrelationStrength = typeof CORRELATION_STRENGTHS[number];

/** |rho| at or above which a correlation is called strong rather than moderate. */
export const STRONG_RHO_THRESHOLD = 0.6;

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

/** One paired observation: a driver value and the clarity that accompanied it. */
export interface CorrelationPair {
  /** The driver value (sleep hours, HRV, stress score, …). */
  readonly value: number;
  /** Post-decision clarity rating, 1–5. */
  readonly clarity: number;
  /** Epoch ms, used for chronological splitting and span checks. */
  readonly atMs: number;
}

/** Why a correlation could not be reported. */
export const CORRELATION_GAPS = [
  'insufficient_pairs',
  'insufficient_span',
  'effect_too_small',
  'unstable_across_halves',
  'no_variance',
] as const;
export type CorrelationGap = typeof CORRELATION_GAPS[number];

/** A correlation that cleared every gate. */
export interface CorrelationFinding {
  /** Spearman's rho over the full sample, -1..1. */
  readonly rho: number;
  /** Direction, for copy that must not imply causation. */
  readonly direction: 'positive' | 'negative';
  readonly strength: CorrelationStrength;
  /** Paired observations behind the finding. */
  readonly pairCount: number;
  /** Days the observations span. */
  readonly spanDays: number;
  /** Rho in the earlier half, kept so the stability claim is auditable. */
  readonly firstHalfRho: number;
  /** Rho in the later half. */
  readonly secondHalfRho: number;
}

/**
 * Result of a correlation analysis. "Not enough signal" is a first-class
 * outcome — the interface renders it as still-learning, never as a weak trait.
 */
export type CorrelationResult =
  | { readonly status: 'found'; readonly finding: CorrelationFinding }
  | { readonly status: 'none'; readonly gap: CorrelationGap; readonly pairCount: number };

// ─────────────────────────────────────────────
// Spearman
// ─────────────────────────────────────────────

/**
 * Converts values to ranks, averaging ranks across ties.
 *
 * Tie handling matters more than usual here: clarity is a 1–5 scale, so ties
 * are the norm rather than the exception, and naive ranking would manufacture
 * an ordering the data does not contain.
 *
 * @param values - Values to rank.
 * @returns Ranks, parallel to the input.
 */
export function rank(values: readonly number[]): number[] {
  const indexed = values.map((value, index) => ({ value, index }));
  indexed.sort((a, b) => a.value - b.value);

  const ranks = new Array<number>(values.length);
  let i = 0;
  while (i < indexed.length) {
    let j = i;
    while (j + 1 < indexed.length && indexed[j + 1].value === indexed[i].value) j++;
    // Ranks are 1-based; tied entries all take the average of their positions.
    const averageRank = (i + j + 2) / 2;
    for (let k = i; k <= j; k++) ranks[indexed[k].index] = averageRank;
    i = j + 1;
  }

  return ranks;
}

/**
 * Pearson correlation. Returns null when either series has no variance, since
 * a correlation with a constant is undefined rather than zero.
 *
 * @param xs - First series.
 * @param ys - Second series, same length.
 * @returns Correlation coefficient, or null when undefined.
 */
export function pearson(xs: readonly number[], ys: readonly number[]): number | null {
  const n = xs.length;
  if (n === 0 || n !== ys.length) return null;

  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;

  let numerator = 0;
  let sumSqX = 0;
  let sumSqY = 0;

  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX;
    const dy = ys[i] - meanY;
    numerator += dx * dy;
    sumSqX += dx * dx;
    sumSqY += dy * dy;
  }

  if (sumSqX === 0 || sumSqY === 0) return null;
  return numerator / Math.sqrt(sumSqX * sumSqY);
}

/**
 * Spearman rank correlation.
 *
 * @param xs - First series.
 * @param ys - Second series, same length.
 * @returns Rho, or null when either series is constant.
 */
export function spearman(xs: readonly number[], ys: readonly number[]): number | null {
  if (xs.length !== ys.length || xs.length === 0) return null;
  return pearson(rank(xs), rank(ys));
}

// ─────────────────────────────────────────────
// Analysis
// ─────────────────────────────────────────────

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Analyses whether a driver moves with clarity in this person's own history.
 *
 * Gates run in order: pair count, time span, computable rho, effect size,
 * split-half stability. The first failure is reported, so callers can tell a
 * user "still learning" versus "no pattern here" rather than a single opaque
 * empty state.
 *
 * @param pairs - Paired driver/clarity observations.
 * @returns The finding, or the gate that stopped it.
 */
export function analyzeCorrelation(pairs: readonly CorrelationPair[]): CorrelationResult {
  if (pairs.length < MIN_PAIRS_FOR_CORRELATION) {
    return { status: 'none', gap: 'insufficient_pairs', pairCount: pairs.length };
  }

  const sorted = [...pairs].sort((a, b) => a.atMs - b.atMs);
  const spanDays = (sorted[sorted.length - 1].atMs - sorted[0].atMs) / DAY_MS;
  if (spanDays < MIN_SPAN_DAYS) {
    return { status: 'none', gap: 'insufficient_span', pairCount: pairs.length };
  }

  const values = sorted.map((p) => p.value);
  const clarities = sorted.map((p) => p.clarity);
  const rho = spearman(values, clarities);

  if (rho === null) {
    return { status: 'none', gap: 'no_variance', pairCount: pairs.length };
  }

  if (Math.abs(rho) < MIN_ABS_RHO) {
    return { status: 'none', gap: 'effect_too_small', pairCount: pairs.length };
  }

  const mid = Math.floor(sorted.length / 2);
  const firstHalf = sorted.slice(0, mid);
  const secondHalf = sorted.slice(mid);

  const firstRho = spearman(
    firstHalf.map((p) => p.value),
    firstHalf.map((p) => p.clarity)
  );
  const secondRho = spearman(
    secondHalf.map((p) => p.value),
    secondHalf.map((p) => p.clarity)
  );

  if (firstRho === null || secondRho === null) {
    return { status: 'none', gap: 'no_variance', pairCount: pairs.length };
  }

  const sameDirection = Math.sign(firstRho) === Math.sign(rho) &&
    Math.sign(secondRho) === Math.sign(rho);
  const bothLean =
    Math.abs(firstRho) >= MIN_HALF_ABS_RHO && Math.abs(secondRho) >= MIN_HALF_ABS_RHO;

  if (!sameDirection || !bothLean) {
    return { status: 'none', gap: 'unstable_across_halves', pairCount: pairs.length };
  }

  return {
    status: 'found',
    finding: {
      rho,
      direction: rho > 0 ? 'positive' : 'negative',
      strength: Math.abs(rho) >= STRONG_RHO_THRESHOLD ? 'strong' : 'moderate',
      pairCount: sorted.length,
      spanDays: Math.round(spanDays),
      firstHalfRho: firstRho,
      secondHalfRho: secondRho,
    },
  };
}
