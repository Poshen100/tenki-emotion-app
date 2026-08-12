import {
  BENCHMARK_K_THRESHOLD,
  FORBIDDEN_ENVELOPE_FIELDS,
  ROLLOUT_STAGE_DIMENSIONS,
  buildCohortKey,
  isCohortEligible,
  validateEnvelope,
} from '../index';
import type { AnonymousBenchmarkEnvelope, BenchmarkRolloutStage } from '../index';

/** Builds a valid envelope with overrides for cohort and validation scenarios. */
function makeEnvelope(
  overrides: Partial<AnonymousBenchmarkEnvelope> = {}
): AnonymousBenchmarkEnvelope {
  return {
    deviceIdHash: 'a'.repeat(64),
    zone: 'clear',
    confidenceBand: 'high',
    timeBucket: 'morning',
    dayOfWeek: 3,
    baselineMaturity: 'mature',
    scenarioMode: 'health_reset',
    clarityBand: 'high',
    ...overrides,
  };
}

describe('cohort keys', () => {
  it('includes only the dimensions open at the given rollout stage', () => {
    const envelope = makeEnvelope();

    expect(buildCohortKey(envelope, 'S1')).toBe('S1|tb:morning');
    expect(buildCohortKey(envelope, 'S2')).toBe('S2|tb:morning|dw:3');
    expect(buildCohortKey(envelope, 'S3')).toBe('S3|tb:morning|dw:3|bm:mature');
    expect(buildCohortKey(envelope, 'S4')).toBe(
      'S4|tb:morning|dw:3|bm:mature|sm:health_reset'
    );
  });

  it('ignores dimensions that are not yet open', () => {
    const morning = makeEnvelope({ scenarioMode: 'health_reset' });
    const trader = makeEnvelope({ scenarioMode: 'trader' });

    // At S1 the scenario mode is not a cohort dimension yet.
    expect(buildCohortKey(morning, 'S1')).toBe(buildCohortKey(trader, 'S1'));
    // At S4 it is.
    expect(buildCohortKey(morning, 'S4')).not.toBe(buildCohortKey(trader, 'S4'));
  });

  it('opens dimensions coarse-to-fine across stages', () => {
    const stages: BenchmarkRolloutStage[] = ['S1', 'S2', 'S3', 'S4'];
    const widths = stages.map((stage) => ROLLOUT_STAGE_DIMENSIONS[stage].length);
    expect(widths).toEqual([1, 2, 3, 4]);
  });

  it('never uses age, gender, region or device model as a dimension', () => {
    const quasiIdentifiers = ['age', 'gender', 'region', 'deviceModel'];
    for (const stage of ['S1', 'S2', 'S3', 'S4'] as BenchmarkRolloutStage[]) {
      for (const dimension of ROLLOUT_STAGE_DIMENSIONS[stage]) {
        expect(quasiIdentifiers).not.toContain(dimension);
      }
    }
  });
});

describe('k-anonymity threshold', () => {
  it('is 50 per PRIVACY_ARCHITECTURE §5.1', () => {
    expect(BENCHMARK_K_THRESHOLD).toBe(50);
  });

  it('rejects cohorts below the threshold', () => {
    expect(isCohortEligible(0)).toBe(false);
    expect(isCohortEligible(49)).toBe(false);
  });

  it('accepts cohorts at or above the threshold', () => {
    expect(isCohortEligible(50)).toBe(true);
    expect(isCohortEligible(5000)).toBe(true);
  });

  it('rejects non-finite device counts', () => {
    expect(isCohortEligible(Number.NaN)).toBe(false);
    expect(isCohortEligible(Number.POSITIVE_INFINITY)).toBe(false);
  });
});

describe('envelope validation', () => {
  it('accepts a well-formed envelope', () => {
    const result = validateEnvelope(makeEnvelope());
    expect(result.valid).toBe(true);
    expect(result.reasons).toEqual([]);
  });

  it('rejects any envelope carrying a raw physiological value', () => {
    for (const field of ['hrv', 'rmssd', 'heartRate', 'rrIntervals'] as const) {
      const result = validateEnvelope({ ...makeEnvelope(), [field]: 42 });
      expect(result.valid).toBe(false);
      expect(result.reasons).toContain('forbidden_field');
      expect(result.forbiddenFields).toContain(field);
    }
  });

  it('rejects an envelope carrying the Edge Score itself', () => {
    const result = validateEnvelope({ ...makeEnvelope(), edgeScore: 82 });
    expect(result.valid).toBe(false);
    expect(result.forbiddenFields).toContain('edgeScore');
  });

  it('rejects an envelope carrying a precise timestamp', () => {
    const result = validateEnvelope({ ...makeEnvelope(), timestamp: 1_775_000_000_000 });
    expect(result.valid).toBe(false);
    expect(result.forbiddenFields).toContain('timestamp');
  });

  it('rejects an envelope carrying reflection text', () => {
    const result = validateEnvelope({ ...makeEnvelope(), reflection: 'felt calm today' });
    expect(result.valid).toBe(false);
    expect(result.forbiddenFields).toContain('reflection');
  });

  it('rejects a day of week outside 0-6', () => {
    expect(validateEnvelope(makeEnvelope({ dayOfWeek: 7 })).reasons).toContain(
      'invalid_day_of_week'
    );
    expect(validateEnvelope(makeEnvelope({ dayOfWeek: -1 })).reasons).toContain(
      'invalid_day_of_week'
    );
    expect(validateEnvelope({ ...makeEnvelope(), dayOfWeek: 2.5 }).reasons).toContain(
      'invalid_day_of_week'
    );
  });

  it('rejects a missing device hash', () => {
    expect(validateEnvelope(makeEnvelope({ deviceIdHash: '' })).reasons).toContain(
      'missing_device_hash'
    );
  });

  it('guards every documented forbidden field', () => {
    for (const field of FORBIDDEN_ENVELOPE_FIELDS) {
      const result = validateEnvelope({ ...makeEnvelope(), [field]: 'x' });
      expect(result.forbiddenFields).toContain(field);
    }
  });
});
