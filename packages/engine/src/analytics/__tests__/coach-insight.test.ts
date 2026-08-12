/**
 * @module analytics/coach-insight.test
 * @description Tests for the AI Coach P1 template layer. The compliance
 * assertions here are the point: every string this module can emit must be
 * safe, because a coach insight is user-facing copy by definition.
 */

import {
  COACH_PHASE_LABEL_GATES,
  P1_INSIGHT_TEMPLATES,
  isPhaseUnlocked,
  renderInsight,
} from '../coach-insight';
import type { CoachInsightTemplate } from '../coach-insight';
import { findProhibitedTerms } from '../../compliance/safe-copy';

/** Slot values covering every slot used by the P1 set. */
const ALL_SLOTS = { timeBucket: 'morning', dayCount: 7 };

describe('P1 template set', () => {
  it('renders every template without prohibited vocabulary', () => {
    for (const template of P1_INSIGHT_TEMPLATES) {
      const result = renderInsight(template, ALL_SLOTS);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(findProhibitedTerms(result.insight.text)).toEqual([]);
      }
    }
  });

  it('leaves no unsubstituted placeholders', () => {
    for (const template of P1_INSIGHT_TEMPLATES) {
      const result = renderInsight(template, ALL_SLOTS);
      if (result.ok) {
        expect(result.insight.text).not.toMatch(/\{[a-zA-Z]+\}/);
      }
    }
  });

  it('never issues a directive', () => {
    const directives = ['you should', 'you must', 'you need to', 'make sure'];
    for (const template of P1_INSIGHT_TEMPLATES) {
      const lower = template.template.toLowerCase();
      for (const directive of directives) {
        expect(lower).not.toContain(directive);
      }
    }
  });

  it('never claims causation', () => {
    const causal = ['because', 'causes', 'caused by', 'leads to', 'results in'];
    for (const template of P1_INSIGHT_TEMPLATES) {
      const lower = template.template.toLowerCase();
      for (const claim of causal) {
        expect(lower).not.toContain(claim);
      }
    }
  });

  it('phrases every observation as a tendency', () => {
    for (const template of P1_INSIGHT_TEMPLATES) {
      expect(template.template.toLowerCase()).toContain('tend');
    }
  });

  it('declares slots that match the placeholders in the template', () => {
    for (const template of P1_INSIGHT_TEMPLATES) {
      const placeholders = Array.from(template.template.matchAll(/\{([a-zA-Z]+)\}/g)).map(
        (match) => match[1]
      );
      expect(new Set(placeholders)).toEqual(new Set(template.slots));
    }
  });

  it('uses unique template ids', () => {
    const ids = P1_INSIGHT_TEMPLATES.map((template) => template.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('renderInsight', () => {
  const template = P1_INSIGHT_TEMPLATES[0];

  it('substitutes slot values into the output', () => {
    const result = renderInsight(template, { timeBucket: 'evening' });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.insight.text).toContain('evening');
  });

  it('fails when a declared slot has no value', () => {
    const result = renderInsight(template, {});
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.failure).toBe('missing_slot');
  });

  it('refuses output that a slot value made non-compliant', () => {
    const injected: CoachInsightTemplate = {
      ...template,
      id: 'test_injection',
      template: 'Your clear states tend to appear most often around {context}.',
      slots: ['context'],
    };
    const result = renderInsight(injected, { context: 'the market open' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure).toBe('non_compliant_output');
      expect(result.prohibitedTerms).toContain('market');
    }
  });

  it('carries the template id and subject through to the rendered insight', () => {
    const result = renderInsight(template, ALL_SLOTS);
    if (result.ok) {
      expect(result.insight.templateId).toBe(template.id);
      expect(result.insight.subject).toBe(template.subject);
    }
  });
});

describe('phase gating', () => {
  it('gates on labeled record count, not elapsed time', () => {
    expect(isPhaseUnlocked('P2', COACH_PHASE_LABEL_GATES.P2 - 1)).toBe(false);
    expect(isPhaseUnlocked('P2', COACH_PHASE_LABEL_GATES.P2)).toBe(true);
  });

  it('unlocks P1 with only a handful of labels', () => {
    expect(isPhaseUnlocked('P1', 3)).toBe(true);
    expect(isPhaseUnlocked('P1', 2)).toBe(false);
  });

  it('requires progressively more labels for later phases', () => {
    expect(COACH_PHASE_LABEL_GATES.P1).toBeLessThan(COACH_PHASE_LABEL_GATES.P2);
    expect(COACH_PHASE_LABEL_GATES.P2).toBeLessThan(COACH_PHASE_LABEL_GATES.P3);
  });
});
