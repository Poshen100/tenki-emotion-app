/**
 * @module shared/edge-status.test
 * @description Tests for the EDGE STATUS chip: the zone-to-status translation,
 * the compliance of its always-on-screen copy, and the rule that closing a
 * window is never announced.
 */

import {
  EDGE_STATUS_COPY,
  EDGE_STATUS_STATES,
  formatHeldDuration,
  resolveEdgeStatus,
  resolveEdgeStatusView,
  shouldAnnounceExit,
} from '../growth/edge-status';
import type { EdgeStatusState } from '../growth/edge-status';
import { findProhibitedTerms } from '../../../engine/src/compliance/safe-copy';

describe('state resolution', () => {
  it('reports Edge Active whenever the detector has confirmed a window', () => {
    expect(resolveEdgeStatus({ detectionConfirmed: true, zone: 'clear' })).toBe(
      'edge_active'
    );
  });

  it('lets detection win over the zone of the last scoring pass', () => {
    expect(resolveEdgeStatus({ detectionConfirmed: true, zone: 'strain' })).toBe(
      'edge_active'
    );
  });

  it('translates the strain zone to Recovery', () => {
    expect(resolveEdgeStatus({ detectionConfirmed: false, zone: 'strain' })).toBe(
      'recovery'
    );
  });

  it('reports Neutral for clear and neutral zones without a detection', () => {
    expect(resolveEdgeStatus({ detectionConfirmed: false, zone: 'clear' })).toBe(
      'neutral'
    );
    expect(resolveEdgeStatus({ detectionConfirmed: false, zone: 'neutral' })).toBe(
      'neutral'
    );
  });

  it('resolves a full view for every state', () => {
    const view = resolveEdgeStatusView({ detectionConfirmed: true, zone: 'clear' });
    expect(view.label).toBe('Edge Active');
    expect(view.tone).toBe('cyan');
  });
});

describe('copy compliance', () => {
  it('emits no prohibited vocabulary in any state', () => {
    for (const state of EDGE_STATUS_STATES) {
      const view = EDGE_STATUS_COPY[state];
      expect(findProhibitedTerms(`${view.label} ${view.description}`)).toEqual([]);
    }
  });

  it('never issues an instruction', () => {
    const directives = ['you should', 'you must', 'now is', 'good time', 'act now'];
    for (const state of EDGE_STATUS_STATES) {
      const lower = EDGE_STATUS_COPY[state].description.toLowerCase();
      for (const directive of directives) {
        expect(lower).not.toContain(directive);
      }
    }
  });

  it('describes the strain state as recovery rather than as a problem', () => {
    const view = EDGE_STATUS_COPY.recovery;
    expect(view.label).toBe('Recovery');
    expect(view.description.toLowerCase()).toContain('recovering');
    expect(view.description.toLowerCase()).not.toContain('strain');
  });

  it('gives every state its own label, description and tone', () => {
    for (const state of EDGE_STATUS_STATES) {
      const view = EDGE_STATUS_COPY[state];
      expect(view.state).toBe(state);
      expect(view.label.length).toBeGreaterThan(0);
      expect(view.description.length).toBeGreaterThan(0);
    }
  });
});

describe('exit announcements', () => {
  it('never announces a closing window', () => {
    expect(shouldAnnounceExit('edge_active')).toBe(false);
  });

  it('announces no state exit at all', () => {
    for (const state of EDGE_STATUS_STATES as readonly EdgeStatusState[]) {
      expect(shouldAnnounceExit(state)).toBe(false);
    }
  });
});

describe('held duration', () => {
  it('renders seconds alone under a minute', () => {
    expect(formatHeldDuration(45)).toBe('45s');
    expect(formatHeldDuration(0)).toBe('0s');
  });

  it('renders minutes and seconds above a minute', () => {
    expect(formatHeldDuration(260)).toBe('4m 20s');
    expect(formatHeldDuration(60)).toBe('1m 0s');
  });

  it('never renders a negative duration', () => {
    expect(formatHeldDuration(-5)).toBe('0s');
  });
});
