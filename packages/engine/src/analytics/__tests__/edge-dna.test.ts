/**
 * @module analytics/edge-dna.test
 * @description Tests for Edge DNA profile assembly. Two things matter most:
 * the stress-tolerance inversion (getting it backwards tells a strain-sensitive
 * person they are steady under pressure) and the copy compliance, since these
 * strings describe someone's own body back to them.
 */

import {
  EDGE_DNA_TRAIT_KINDS,
  MIN_TRAITS_FOR_PROFILE,
  PROFILE_REVISABILITY_NOTE,
  TRAIT_COPY,
  TRAIT_LEVELS,
  allEdgeDnaCopy,
  buildEdgeDnaProfile,
  levelFromRho,
  traitFromCorrelation,
} from '../edge-dna';
import type { EdgeDnaInput } from '../edge-dna';
import type { CorrelationFinding, CorrelationResult } from '../correlation';
import type { FocusWindowResult } from '../focus-window';
import { findProhibitedTerms } from '../../compliance/safe-copy';

/** Builds a correlation finding at a given rho. */
function finding(rho: number): CorrelationFinding {
  return {
    rho,
    direction: rho > 0 ? 'positive' : 'negative',
    strength: Math.abs(rho) >= 0.6 ? 'strong' : 'moderate',
    pairCount: 40,
    spanDays: 60,
    firstHalfRho: rho * 0.9,
    secondHalfRho: rho * 1.1,
  };
}

/** Wraps a finding as a found result. */
function found(rho: number): CorrelationResult {
  return { status: 'found', finding: finding(rho) };
}

/** A result with no usable pattern. */
const NONE: CorrelationResult = {
  status: 'none',
  gap: 'insufficient_pairs',
  pairCount: 4,
};

/** A usable focus window. */
const WINDOW: FocusWindowResult = {
  status: 'ok',
  daysOfData: 30,
  window: { startHour: 10, endHour: 12, clearRate: 0.7, sampleCount: 40 },
};

/** No focus window yet. */
const NO_WINDOW: FocusWindowResult = {
  status: 'unavailable',
  gap: 'insufficient_samples',
  sampleCount: 5,
};

/** Builds profile input with overrides. */
function makeInput(overrides: Partial<EdgeDnaInput> = {}): EdgeDnaInput {
  return {
    sleep: found(0.7),
    stress: found(-0.7),
    recovery: found(0.5),
    focusWindow: WINDOW,
    ...overrides,
  };
}

describe('level derivation', () => {
  it('bands on magnitude, ignoring sign', () => {
    expect(levelFromRho(0.7)).toBe('high');
    expect(levelFromRho(-0.7)).toBe('high');
    expect(levelFromRho(0.5)).toBe('moderate');
    expect(levelFromRho(0.2)).toBe('low');
  });
});

describe('stress tolerance inversion', () => {
  it('reads a strong negative clarity-vs-strain coupling as LOW tolerance', () => {
    const trait = traitFromCorrelation('stress_tolerance', finding(-0.75));
    expect(trait.level).toBe('low');
    expect(trait.label).toBe('Sensitive To Strain');
  });

  it('reads a weak coupling as HIGH tolerance', () => {
    const trait = traitFromCorrelation('stress_tolerance', finding(-0.2));
    expect(trait.level).toBe('high');
    expect(trait.label).toBe('Steady Under Strain');
  });

  it('does not invert the other traits', () => {
    expect(traitFromCorrelation('sleep_sensitivity', finding(0.75)).level).toBe('high');
    expect(traitFromCorrelation('hrv_coupling', finding(0.75)).level).toBe('high');
  });

  it('carries the evidence through onto the trait', () => {
    const trait = traitFromCorrelation('sleep_sensitivity', finding(0.7));
    expect(trait.sampleCount).toBe(40);
    expect(trait.spanDays).toBe(60);
  });
});

describe('profile assembly', () => {
  it('builds a profile from all four dimensions', () => {
    const result = buildEdgeDnaProfile(makeInput());
    expect(result.status).toBe('ready');
    if (result.status === 'ready') {
      expect(result.profile.traits).toHaveLength(4);
      expect(result.profile.traits.map((t) => t.kind)).toEqual(
        expect.arrayContaining([...EDGE_DNA_TRAIT_KINDS])
      );
    }
  });

  it('stays in building below the trait floor', () => {
    const result = buildEdgeDnaProfile(
      makeInput({ sleep: NONE, stress: NONE, recovery: NONE, focusWindow: NO_WINDOW })
    );
    expect(result.status).toBe('building');
    if (result.status === 'building') expect(result.traitsFound).toBe(0);
  });

  it('refuses to call a single trait a profile', () => {
    const result = buildEdgeDnaProfile(
      makeInput({ sleep: found(0.7), stress: NONE, recovery: NONE, focusWindow: NO_WINDOW })
    );
    expect(result.status).toBe('building');
    if (result.status === 'building') {
      expect(result.traitsFound).toBe(1);
      expect(result.traitsFound).toBeLessThan(MIN_TRAITS_FOR_PROFILE);
    }
  });

  it('builds once the floor is reached', () => {
    const result = buildEdgeDnaProfile(
      makeInput({ sleep: found(0.7), stress: NONE, recovery: NONE, focusWindow: WINDOW })
    );
    expect(result.status).toBe('ready');
  });

  it('always attaches the revisability note', () => {
    const result = buildEdgeDnaProfile(makeInput());
    if (result.status === 'ready') {
      expect(result.profile.revisabilityNote).toBe(PROFILE_REVISABILITY_NOTE);
    }
  });

  it('reports the widest evidence behind any trait', () => {
    const result = buildEdgeDnaProfile(makeInput());
    if (result.status === 'ready') {
      expect(result.profile.evidenceCount).toBeGreaterThan(0);
      expect(result.profile.spanDays).toBeGreaterThan(0);
    }
  });

  it('grades a narrow high-clarity window as a defined pattern', () => {
    const result = buildEdgeDnaProfile(makeInput({ focusWindow: WINDOW }));
    if (result.status === 'ready') {
      const focus = result.profile.traits.find((t) => t.kind === 'focus_timing');
      expect(focus?.level).toBe('high');
    }
  });

  it('grades a wide window as only a lean', () => {
    const wide: FocusWindowResult = {
      status: 'ok',
      daysOfData: 30,
      window: { startHour: 8, endHour: 16, clearRate: 0.4, sampleCount: 40 },
    };
    const result = buildEdgeDnaProfile(makeInput({ focusWindow: wide }));
    if (result.status === 'ready') {
      const focus = result.profile.traits.find((t) => t.kind === 'focus_timing');
      expect(focus?.level).toBe('low');
    }
  });
});

describe('copy compliance', () => {
  it('emits no prohibited vocabulary anywhere', () => {
    for (const line of allEdgeDnaCopy()) {
      expect(findProhibitedTerms(line)).toEqual([]);
    }
  });

  it('never compares the user to other people', () => {
    const comparative = [
      'than average',
      'than most',
      'compared to others',
      'other users',
      'people like you',
      'percentile',
    ];
    for (const line of allEdgeDnaCopy()) {
      const lower = line.toLowerCase();
      for (const phrase of comparative) {
        expect(lower).not.toContain(phrase);
      }
    }
  });

  it('never implies anything genetic or fixed', () => {
    const genetic = ['genetic', 'genes', 'inherited', 'hardwired', 'born with', 'dna'];
    for (const line of allEdgeDnaCopy()) {
      const lower = line.toLowerCase();
      for (const word of genetic) {
        expect(lower).not.toContain(word);
      }
    }
  });

  it('never claims causation', () => {
    const causal = ['because', 'causes', 'caused by', 'leads to', 'due to', 'results in'];
    for (const line of allEdgeDnaCopy()) {
      const lower = line.toLowerCase();
      for (const claim of causal) {
        expect(lower).not.toContain(claim);
      }
    }
  });

  it('never instructs the user', () => {
    for (const line of allEdgeDnaCopy()) {
      const lower = line.toLowerCase();
      expect(lower).not.toContain('you should');
      expect(lower).not.toContain('you must');
      expect(lower).not.toContain('try to');
    }
  });

  it('phrases descriptions in the past tense of the user own record', () => {
    for (const kind of EDGE_DNA_TRAIT_KINDS) {
      for (const level of TRAIT_LEVELS) {
        expect(TRAIT_COPY[kind][level].description.toLowerCase()).toContain('your');
      }
    }
  });

  it('says the profile updates rather than fixes the user in place', () => {
    const lower = PROFILE_REVISABILITY_NOTE.toLowerCase();
    expect(lower).toContain('updates');
    expect(lower).toContain('not a fixed trait');
  });

  it('gives every kind and level a distinct label', () => {
    const labels = new Set<string>();
    for (const kind of EDGE_DNA_TRAIT_KINDS) {
      for (const level of TRAIT_LEVELS) {
        labels.add(TRAIT_COPY[kind][level].label);
      }
    }
    expect(labels.size).toBe(EDGE_DNA_TRAIT_KINDS.length * TRAIT_LEVELS.length);
  });
});
