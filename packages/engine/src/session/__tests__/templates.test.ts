/**
 * @module session/__tests__/templates.test.ts
 * @description Unit tests for trader discipline templates (process governance,
 * not financial decisions).
 */

import {
  TRADER_TEMPLATES,
  getTraderTemplate,
  getAllTraderTemplates,
} from '../templates';
import type { TraderTemplateId } from '../types';

const ALL_IDS: TraderTemplateId[] = ['FBD', 'CANSLIM', 'MODE_2'];

describe('TRADER_TEMPLATES', () => {
  it('defines exactly the three canonical templates keyed by their own id', () => {
    expect(Object.keys(TRADER_TEMPLATES).sort()).toEqual([...ALL_IDS].sort());
    for (const id of ALL_IDS) {
      expect(TRADER_TEMPLATES[id].id).toBe(id);
    }
  });

  it.each(ALL_IDS)('%s has a positive duration and a readiness window inside it', (id) => {
    const t = TRADER_TEMPLATES[id];
    expect(t.durationSec).toBeGreaterThan(0);
    const window = t.rules.readinessWindow;
    expect(window).toBeDefined();
    if (!window) return;
    expect(window.startSec).toBeGreaterThanOrEqual(0);
    expect(window.endSec).toBeGreaterThan(window.startSec);
    expect(window.endSec).toBeLessThanOrEqual(t.durationSec);
  });

  it.each(ALL_IDS)('%s segments are contiguous and span the full duration', (id) => {
    const { segments } = TRADER_TEMPLATES[id].rules;
    expect(segments[0].startSec).toBe(0);
    expect(segments[segments.length - 1].endSec).toBe(TRADER_TEMPLATES[id].durationSec);
    for (let i = 1; i < segments.length; i++) {
      expect(segments[i].startSec).toBe(segments[i - 1].endSec);
    }
  });
});

describe('getTraderTemplate', () => {
  it.each(ALL_IDS)('returns the template matching id %s', (id) => {
    expect(getTraderTemplate(id)).toBe(TRADER_TEMPLATES[id]);
  });
});

describe('getAllTraderTemplates', () => {
  it('returns every template exactly once', () => {
    const all = getAllTraderTemplates();
    expect(all).toHaveLength(ALL_IDS.length);
    expect(all.map(t => t.id).sort()).toEqual([...ALL_IDS].sort());
  });
});
