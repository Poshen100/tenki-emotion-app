/**
 * @module intelligence/calibration.test
 * @description Unit tests for Calibration Proof. The defended property is that
 * "nothing changed" survives — no code path may quietly round a null result up
 * into a success.
 */

import {
  assessCalibration,
  classifyShift,
  isCalibrationAssessed,
  meaningfulShiftThreshold,
  summarizePriors,
  MIN_MEANINGFUL_SHIFT,
  SHIFT_STD_FRACTION,
  type CalibrationReading,
} from '../calibration';
import type { PersonalReference } from '../drift';
import { MS_PER_DAY } from '../evidence';

const NOW = new Date(2026, 8, 9, 10, 0, 0).getTime();

/** A reference with a known spread, so the threshold is predictable. */
function reference(std: number, sampleCount = 24): PersonalReference {
  return { bucket: 'morning', mean: 65, std, sampleCount, windowDays: sampleCount };
}

function reading(value: number, offsetMs = 0, captureId = 'soul-scan:A'): CalibrationReading {
  return { value, ts: NOW + offsetMs, captureId };
}

// ─── meaningfulShiftThreshold ────────────────

describe('meaningfulShiftThreshold', () => {
  it('scales with the user own spread', () => {
    expect(meaningfulShiftThreshold(reference(20))).toBe(20 * SHIFT_STD_FRACTION);
  });

  it('never drops below the absolute floor for a steady user', () => {
    expect(meaningfulShiftThreshold(reference(4))).toBe(MIN_MEANINGFUL_SHIFT);
  });

  it('falls back to the floor when there is no reference yet', () => {
    expect(meaningfulShiftThreshold(null)).toBe(MIN_MEANINGFUL_SHIFT);
  });

  it('does not personalize a threshold from a near-flat reference', () => {
    expect(meaningfulShiftThreshold(reference(0))).toBe(MIN_MEANINGFUL_SHIFT);
  });
});

// ─── classifyShift ───────────────────────────

describe('classifyShift', () => {
  it('calls a shift at the threshold a change', () => {
    expect(classifyShift(5, 5)).toBe('improved');
    expect(classifyShift(-5, 5)).toBe('declined');
  });

  it('calls anything inside the threshold no clear shift', () => {
    expect(classifyShift(4.9, 5)).toBe('no_clear_shift');
    expect(classifyShift(-4.9, 5)).toBe('no_clear_shift');
    expect(classifyShift(0, 5)).toBe('no_clear_shift');
  });
});

// ─── assessCalibration ───────────────────────

describe('assessCalibration', () => {
  it('reports an improvement that clears the personal threshold', () => {
    const result = assessCalibration({
      before: reading(43),
      after: reading(61, 90_000),
      reference: reference(10),
    });
    if (!isCalibrationAssessed(result)) throw new Error('expected a proof');
    expect(result.verdict).toBe('improved');
    expect(result.shift).toBe(18);
    expect(result.threshold).toBe(5);
  });

  it('keeps no_clear_shift for a change inside the noise band', () => {
    const result = assessCalibration({
      before: reading(43),
      after: reading(44, 90_000),
      reference: reference(10),
    });
    if (!isCalibrationAssessed(result)) throw new Error('expected a proof');
    expect(result.verdict).toBe('no_clear_shift');
    expect(result.shift).toBe(1);
  });

  it('calls the same +4 differently for a steady and a swingy user', () => {
    const steady = assessCalibration({
      before: reading(43),
      after: reading(47, 90_000),
      reference: reference(4),
    });
    const swingy = assessCalibration({
      before: reading(43),
      after: reading(47, 90_000),
      reference: reference(20),
    });
    if (!isCalibrationAssessed(steady) || !isCalibrationAssessed(swingy)) {
      throw new Error('expected proofs');
    }
    expect(steady.verdict).toBe('improved');
    expect(swingy.verdict).toBe('no_clear_shift');
  });

  it('reports a decline rather than hiding it', () => {
    const result = assessCalibration({
      before: reading(61),
      after: reading(43, 90_000),
      reference: reference(10),
    });
    if (!isCalibrationAssessed(result)) throw new Error('expected a proof');
    expect(result.verdict).toBe('declined');
  });

  it('refuses when the two readings came from different capture conditions', () => {
    const result = assessCalibration({
      before: reading(43, 0, 'soul-scan:A'),
      after: reading(61, 90_000, 'wearable:hrv'),
      reference: reference(10),
    });
    expect(result.state).toBe('insufficient');
    if (result.state !== 'insufficient') throw new Error('expected insufficient');
    expect(result.evidence.reasons).toContain('mixed_capture_conditions');
  });

  it('refuses when a reading is not a finite number', () => {
    const result = assessCalibration({
      before: reading(Number.NaN),
      after: reading(61, 90_000),
      reference: reference(10),
    });
    expect(result.state).toBe('insufficient');
  });

  it('flags the fallback threshold when no reference exists yet', () => {
    const result = assessCalibration({
      before: reading(43),
      after: reading(61, 90_000),
      reference: null,
    });
    if (!isCalibrationAssessed(result)) throw new Error('expected a proof');
    expect(result.evidence.reasons).toContain('low_variability_reference');
    expect(result.evidence.confidence).not.toBe('high');
  });

  it('cannot reach high confidence from a single pair', () => {
    const result = assessCalibration({
      before: reading(43),
      after: reading(61, 90_000),
      reference: reference(10),
    });
    if (!isCalibrationAssessed(result)) throw new Error('expected a proof');
    expect(result.evidence.confidence).toBe('moderate');
    expect(result.priorSummary).toBeNull();
  });

  it('reaches high confidence once enough prior calibrations exist', () => {
    const priors = Array.from({ length: 8 }, (_, i) => ({
      shift: i < 5 ? 12 : 1,
      ts: NOW - (i + 1) * MS_PER_DAY,
    }));
    const result = assessCalibration({
      before: reading(43),
      after: reading(61, 90_000),
      reference: reference(10),
      priors,
    });
    if (!isCalibrationAssessed(result)) throw new Error('expected a proof');
    expect(result.evidence.confidence).toBe('high');
    expect(result.priorSummary).toEqual({ total: 8, similar: 5 });
  });
});

// ─── summarizePriors ─────────────────────────

describe('summarizePriors', () => {
  it('returns null when there is nothing to compare with', () => {
    expect(summarizePriors([], 5, 'improved')).toBeNull();
  });

  it('ignores priors whose shift is not a finite number', () => {
    const priors = [
      { shift: 12, ts: NOW - MS_PER_DAY },
      { shift: Number.NaN, ts: NOW - 2 * MS_PER_DAY },
    ];
    expect(summarizePriors(priors, 5, 'improved')).toEqual({ total: 1, similar: 1 });
  });

  it('counts a no_clear_shift history as its own kind of match', () => {
    const priors = [
      { shift: 1, ts: NOW - MS_PER_DAY },
      { shift: -2, ts: NOW - 2 * MS_PER_DAY },
      { shift: 12, ts: NOW - 3 * MS_PER_DAY },
    ];
    expect(summarizePriors(priors, 5, 'no_clear_shift')).toEqual({ total: 3, similar: 2 });
  });
});
