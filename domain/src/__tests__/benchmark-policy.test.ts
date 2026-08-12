import {
  BENCHMARK_K_THRESHOLD,
  MAX_UPLOADS_PER_DAY,
  MIN_UPLOAD_INTERVAL_MS,
  UPLOAD_BUFFER_HOURS,
  canContribute,
  isBufferDue,
  isThrottled,
  resolveComparison,
} from '../index';
import type {
  AnonymousBenchmarkEnvelope,
  BenchmarkCohortDistribution,
  BenchmarkParticipationState,
} from '../index';

const NOW = 1_775_000_000_000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Builds a valid envelope with overrides. */
function makeEnvelope(
  overrides: Partial<AnonymousBenchmarkEnvelope> = {}
): AnonymousBenchmarkEnvelope {
  return {
    deviceIdHash: 'b'.repeat(64),
    zone: 'neutral',
    confidenceBand: 'moderate',
    timeBucket: 'evening',
    dayOfWeek: 5,
    baselineMaturity: 'ready',
    scenarioMode: 'focus',
    clarityBand: 'mid',
    ...overrides,
  };
}

/** Builds a participation state that would otherwise allow an upload. */
function makeState(
  overrides: Partial<BenchmarkParticipationState> = {}
): BenchmarkParticipationState {
  return { optedIn: true, featureEnabled: true, lastUploadAtMs: null, ...overrides };
}

/** Builds a cohort distribution with a given device count. */
function makeDistribution(distinctDevices: number): BenchmarkCohortDistribution {
  return {
    cohortKey: 'S1|tb:evening',
    distinctDevices,
    zoneShare: { clear: 0.4, neutral: 0.4, strain: 0.2 },
    clarityShare: { low: 0.2, mid: 0.5, high: 0.3 },
  };
}

describe('participation preconditions', () => {
  it('allows an opted-in, enabled, un-throttled device with a valid envelope', () => {
    const decision = canContribute(makeEnvelope(), makeState(), NOW);
    expect(decision.allowed).toBe(true);
    expect(decision.blockers).toEqual([]);
  });

  it('blocks a device that has not opted in', () => {
    const decision = canContribute(makeEnvelope(), makeState({ optedIn: false }), NOW);
    expect(decision.allowed).toBe(false);
    expect(decision.blockers).toContain('not_opted_in');
  });

  it('blocks opt-out devices even when every other condition passes', () => {
    const decision = canContribute(
      makeEnvelope(),
      makeState({ optedIn: false, featureEnabled: true, lastUploadAtMs: null }),
      NOW
    );
    expect(decision.allowed).toBe(false);
  });

  it('blocks when the feature flag is off', () => {
    const decision = canContribute(makeEnvelope(), makeState({ featureEnabled: false }), NOW);
    expect(decision.blockers).toContain('feature_disabled');
  });

  it('blocks an envelope carrying a raw physiological value', () => {
    const decision = canContribute({ ...makeEnvelope(), hrv: 61 }, makeState(), NOW);
    expect(decision.allowed).toBe(false);
    expect(decision.blockers).toContain('invalid_envelope');
  });

  it('reports every blocker at once rather than short-circuiting', () => {
    const decision = canContribute(
      { ...makeEnvelope(), edgeScore: 82 },
      makeState({ optedIn: false, featureEnabled: false, lastUploadAtMs: NOW }),
      NOW
    );
    expect(decision.blockers).toEqual(
      expect.arrayContaining([
        'not_opted_in',
        'feature_disabled',
        'throttled',
        'invalid_envelope',
      ])
    );
  });
});

describe('upload throttling', () => {
  it('allows the first ever upload', () => {
    expect(isThrottled(null, NOW)).toBe(false);
  });

  it('caps uploads at one per day', () => {
    expect(MAX_UPLOADS_PER_DAY).toBe(1);
    expect(MIN_UPLOAD_INTERVAL_MS).toBe(DAY_MS);
  });

  it('throttles a second upload inside the same day', () => {
    expect(isThrottled(NOW - 60_000, NOW)).toBe(true);
    expect(isThrottled(NOW - DAY_MS + 1, NOW)).toBe(true);
  });

  it('releases the throttle once a full day has passed', () => {
    expect(isThrottled(NOW - DAY_MS, NOW)).toBe(false);
    expect(isThrottled(NOW - 2 * DAY_MS, NOW)).toBe(false);
  });
});

describe('buffer window', () => {
  it('is not due with an empty buffer', () => {
    expect(isBufferDue(null, NOW)).toBe(false);
  });

  it('is not due before the window elapses', () => {
    expect(isBufferDue(NOW - 60_000, NOW)).toBe(false);
  });

  it('is due once the window elapses', () => {
    expect(isBufferDue(NOW - UPLOAD_BUFFER_HOURS * 60 * 60 * 1000, NOW)).toBe(true);
  });
});

describe('comparison gating', () => {
  it('returns the distribution once the cohort clears k', () => {
    const result = resolveComparison(
      makeEnvelope(),
      'S1',
      makeDistribution(BENCHMARK_K_THRESHOLD)
    );
    expect(result.status).toBe('ok');
  });

  it('returns insufficient — never a partial distribution — below k', () => {
    const result = resolveComparison(
      makeEnvelope(),
      'S1',
      makeDistribution(BENCHMARK_K_THRESHOLD - 1)
    );
    expect(result.status).toBe('insufficient');
    if (result.status === 'insufficient') {
      expect(result.cohortKey).toBe('S1|tb:evening');
    }
  });

  it('returns insufficient when the cohort has no aggregate at all', () => {
    const result = resolveComparison(makeEnvelope(), 'S1', null);
    expect(result.status).toBe('insufficient');
  });

  it('derives the cohort key from the open rollout stage', () => {
    const result = resolveComparison(makeEnvelope(), 'S3', null);
    if (result.status === 'insufficient') {
      expect(result.cohortKey).toBe('S3|tb:evening|dw:5|bm:ready');
    }
  });
});
