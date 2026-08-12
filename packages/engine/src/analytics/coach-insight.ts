/**
 * @module analytics/coach-insight
 * @description AI Coach P1 — the template layer.
 *
 * Insights are rendered from a fixed template set, never generated freely. The
 * template grammar is deliberately narrow:
 *
 *   {subject} tends to {direction} when {condition}.
 *
 * "Tends to" is doing real work there. It is the difference between an
 * observation about the user's own data and a causal claim about their body,
 * and the second one is a medical statement. Every template in this module is
 * an observation.
 *
 * Later phases (P2 correlation, P3 personal models) add new templates and new
 * gating conditions but keep this rendering path. P4 introduces cloud-generated
 * language and therefore re-runs its output through the compliance engine
 * before display — see GROWTH-ARCHITECTURE §6.4.
 *
 * @see docs/GROWTH-ARCHITECTURE.md §6
 * @see ANTIGRAVITY.md §13.5
 */

import { findProhibitedTerms } from '../compliance/safe-copy';

// ─────────────────────────────────────────────
// Phases
// ─────────────────────────────────────────────

/** AI Coach rollout phases. */
export const COACH_PHASES = ['P1', 'P2', 'P3', 'P4'] as const;
export type CoachPhase = typeof COACH_PHASES[number];

/** Minimum labeled DPD records required to unlock each phase. */
export const COACH_PHASE_LABEL_GATES: Readonly<Record<CoachPhase, number>> = {
  P1: 3,
  P2: 30,
  P3: 90,
  P4: 90,
};

// ─────────────────────────────────────────────
// Templates
// ─────────────────────────────────────────────

/** What an insight is about. */
export const COACH_INSIGHT_SUBJECTS = [
  'clarity',
  'focus_window',
  'stress_pattern',
  'recovery_trend',
] as const;
export type CoachInsightSubject = typeof COACH_INSIGHT_SUBJECTS[number];

/**
 * A renderable insight template.
 *
 * Templates hold no numbers of their own. Values are substituted at render
 * time from the user's own data, which keeps the compliance surface fixed and
 * auditable: the set of strings this module can ever emit is enumerable.
 */
export interface CoachInsightTemplate {
  readonly id: string;
  readonly subject: CoachInsightSubject;
  readonly phase: CoachPhase;
  /** Template with `{placeholder}` slots. */
  readonly template: string;
  /** Slot names the template expects. */
  readonly slots: readonly string[];
  /** Ranking weight, 0–100. */
  readonly relevance: number;
}

/**
 * P1 template set — pattern observation only, no correlation and no modelling.
 *
 * Note what is absent: no template tells the user to do anything, none names a
 * cause, and none compares the user to anyone else.
 */
export const P1_INSIGHT_TEMPLATES: readonly CoachInsightTemplate[] = [
  {
    id: 'clarity_by_time_bucket',
    subject: 'focus_window',
    phase: 'P1',
    template: 'Your clear states tend to appear most often in the {timeBucket} window.',
    slots: ['timeBucket'],
    relevance: 80,
  },
  {
    id: 'clarity_trend_up',
    subject: 'clarity',
    phase: 'P1',
    template:
      'Over the last {dayCount} days your readiness has tended to sit above your own baseline.',
    slots: ['dayCount'],
    relevance: 70,
  },
  {
    id: 'clarity_trend_down',
    subject: 'clarity',
    phase: 'P1',
    template:
      'Over the last {dayCount} days your readiness has tended to sit below your own baseline.',
    slots: ['dayCount'],
    relevance: 70,
  },
  {
    id: 'stress_above_baseline',
    subject: 'stress_pattern',
    phase: 'P1',
    template:
      'Your strain signals have tended to run higher than your baseline in the {timeBucket} window.',
    slots: ['timeBucket'],
    relevance: 65,
  },
  {
    id: 'recovery_steady',
    subject: 'recovery_trend',
    phase: 'P1',
    template: 'Your recovery signals have tended to stay steady across the last {dayCount} days.',
    slots: ['dayCount'],
    relevance: 55,
  },
] as const;

// ─────────────────────────────────────────────
// Rendering
// ─────────────────────────────────────────────

/** Values substituted into a template's slots. */
export type CoachInsightSlots = Readonly<Record<string, string | number>>;

/** A rendered insight, ready for display. */
export interface RenderedCoachInsight {
  readonly templateId: string;
  readonly subject: CoachInsightSubject;
  readonly text: string;
  readonly relevance: number;
}

/** Why an insight could not be rendered. */
export const COACH_RENDER_FAILURES = ['missing_slot', 'non_compliant_output'] as const;
export type CoachRenderFailure = typeof COACH_RENDER_FAILURES[number];

/** Outcome of rendering a template. */
export type CoachRenderResult =
  | { readonly ok: true; readonly insight: RenderedCoachInsight }
  | {
      readonly ok: false;
      readonly failure: CoachRenderFailure;
      /** Prohibited terms found, when the failure was a compliance failure. */
      readonly prohibitedTerms: readonly string[];
    };

/**
 * Renders a template with the given slot values, then checks the result against
 * the compliance vocabulary before returning it.
 *
 * The check runs on rendered output rather than on the template, because a slot
 * value is user-derived and could carry text the template author never saw.
 *
 * @param template - The template to render.
 * @param slots - Values for the template's slots.
 * @returns The rendered insight, or the reason it was refused.
 */
export function renderInsight(
  template: CoachInsightTemplate,
  slots: CoachInsightSlots
): CoachRenderResult {
  let text = template.template;

  for (const slot of template.slots) {
    const value = slots[slot];
    if (value === undefined) {
      return { ok: false, failure: 'missing_slot', prohibitedTerms: [] };
    }
    text = text.split(`{${slot}}`).join(String(value));
  }

  const prohibitedTerms = findProhibitedTerms(text);
  if (prohibitedTerms.length > 0) {
    return { ok: false, failure: 'non_compliant_output', prohibitedTerms };
  }

  return {
    ok: true,
    insight: {
      templateId: template.id,
      subject: template.subject,
      text,
      relevance: template.relevance,
    },
  };
}

/**
 * Whether a phase is unlocked for a given number of labeled DPD records.
 *
 * Phases gate on label count rather than on install age or subscription date:
 * a user who has never completed a reflection has nothing for the coach to
 * observe, and showing them an empty coach is worse than not showing one.
 *
 * @param phase - The phase to check.
 * @param labelCount - Number of labeled DPD records available.
 * @returns True when the phase has enough data behind it.
 */
export function isPhaseUnlocked(phase: CoachPhase, labelCount: number): boolean {
  return labelCount >= COACH_PHASE_LABEL_GATES[phase];
}
