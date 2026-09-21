import type { BiometricSample } from '../contracts/wearable-sample';
import { METRIC_FRESHNESS_MS } from '../policies/wearable-source-policy';
import {
  buildReadingClaim,
  mayClaimAsCurrent,
  validateReadingCopy,
} from '../policies/reading-claim';

const NOW = 1_760_000_000_000;

function sample(overrides: Partial<BiometricSample> = {}): BiometricSample {
  return {
    metric: 'hrv_rmssd_ms',
    value: 54,
    observedAt: NOW - 30_000,
    sourcePlatform: 'ble_chest',
    sourceDevice: 'Polar H10',
    sourceApp: null,
    quality: 5,
    confidence: 0.95,
    derivation: 'derived',
    permissionScope: 'scan',
    ...overrides,
  };
}

describe('what a reading may claim', () => {
  it('characterises each derivation differently', () => {
    expect(buildReadingClaim(sample({ derivation: 'observed' }), NOW).qualifier).toBe('measured');
    expect(buildReadingClaim(sample({ derivation: 'derived' }), NOW).qualifier).toBe('computed');
    expect(buildReadingClaim(sample({ derivation: 'estimated' }), NOW).qualifier).toBe('estimated');
  });

  it('requires the estimate qualifier from derivation, not from quality', () => {
    // A pristine camera reading is still an estimate; a poor strap reading is
    // still computed from real inter-beat intervals.
    const goodCamera = sample({ sourcePlatform: 'finger_scan', derivation: 'estimated', quality: 5 });
    const poorStrap = sample({ derivation: 'derived', quality: 2 });

    expect(buildReadingClaim(goodCamera, NOW).requiresEstimateQualifier).toBe(true);
    expect(buildReadingClaim(poorStrap, NOW).requiresEstimateQualifier).toBe(false);
  });

  it('drops the tense as the reading ages', () => {
    expect(buildReadingClaim(sample({ observedAt: NOW - 10_000 }), NOW).timing).toBe('now');
    expect(buildReadingClaim(sample({ observedAt: NOW - 10 * 60_000 }), NOW).timing).toBe('earlier');

    const stale = sample({ observedAt: NOW - METRIC_FRESHNESS_MS.hrv_rmssd_ms - 1 });
    expect(buildReadingClaim(stale, NOW).timing).toBe('not_current');
    expect(mayClaimAsCurrent(stale, NOW)).toBe(false);
  });
});

describe('copy that overstates the reading', () => {
  const staleWatch = sample({
    sourcePlatform: 'healthkit',
    derivation: 'observed',
    observedAt: NOW - 24 * 60 * 60_000,
  });

  it("refuses yesterday's reading stated as the user's state now", () => {
    const check = validateReadingCopy('Your HRV right now is 54 ms.', staleWatch, NOW);

    expect(check.ok).toBe(false);
    expect(check.problems).toContain('stale_stated_as_current');
  });

  it('accepts the same reading stated in the past tense', () => {
    const check = validateReadingCopy('Apple Watch measured 54 ms yesterday morning.', staleWatch, NOW);

    expect(check.ok).toBe(true);
  });

  it('refuses a camera estimate presented as a measurement', () => {
    const camera = sample({ sourcePlatform: 'finger_scan', derivation: 'estimated' });
    const check = validateReadingCopy('Your HRV is 54 ms.', camera, NOW);

    expect(check.problems).toContain('estimate_stated_as_measurement');
  });

  it('accepts the estimate once copy says so', () => {
    const camera = sample({ sourcePlatform: 'finger_scan', derivation: 'estimated' });

    expect(validateReadingCopy('Estimated HRV 54 ms.', camera, NOW).ok).toBe(true);
    expect(validateReadingCopy('推估 HRV 54 ms。', camera, NOW).ok).toBe(true);
  });

  it('does not require a qualifier from a strap reading', () => {
    expect(validateReadingCopy('HRV 54 ms, right now.', sample(), NOW).ok).toBe(true);
  });
});

describe('honest denials are not banned claims', () => {
  // 🔴 The repo has been bitten by the mirror image of this: a checker matching
  // `predict` as a substring flagged "this is not a prediction" (MEMORY,
  // 2026-09-09). A checker that cannot tell a denial from an assertion pushes
  // writers toward vaguer copy, which is the opposite of the point.
  const staleWatch = sample({ observedAt: NOW - 24 * 60 * 60_000 });

  it('allows copy that explicitly denies the reading is current', () => {
    for (const text of [
      'This is not your current HRV.',
      "That reading isn't current — it is from yesterday.",
      '這不是你現在的讀數。',
      '此數值並非目前狀態。',
    ]) {
      const check = validateReadingCopy(text, staleWatch, NOW);
      expect(check.problems).not.toContain('stale_stated_as_current');
    }
  });

  it('still catches an assertion that appears after a denial', () => {
    // A denial earlier in the sentence must not license a later claim.
    const check = validateReadingCopy(
      'This is not a forecast. Your HRV right now is 54 ms.',
      staleWatch,
      NOW,
    );

    expect(check.problems).toContain('stale_stated_as_current');
  });
});

import {
  MIN_SCANS_FOR_ESTABLISHED_PRECISION,
  PRECISION_GRADE_BOUNDS,
  buildPrecisionClaim,
  gradePrecision,
} from '../policies/reading-claim';

describe('what the system may say about its own precision', () => {
  it('grades a measured floor rather than printing milliseconds', () => {
    expect(gradePrecision(2.5)).toBe('fine');
    expect(gradePrecision(7)).toBe('usable');
    expect(gradePrecision(13)).toBe('coarse');
  });

  it('treats the boundaries as inclusive', () => {
    expect(gradePrecision(PRECISION_GRADE_BOUNDS.FINE_MAX_MS)).toBe('fine');
    expect(gradePrecision(PRECISION_GRADE_BOUNDS.FINE_MAX_MS + 0.1)).toBe('usable');
    expect(gradePrecision(PRECISION_GRADE_BOUNDS.USABLE_MAX_MS)).toBe('usable');
    expect(gradePrecision(PRECISION_GRADE_BOUNDS.USABLE_MAX_MS + 0.1)).toBe('coarse');
  });

  it('says nothing when no floor has been established', () => {
    expect(buildPrecisionClaim(null, 0)).toBeNull();
    expect(buildPrecisionClaim(Number.NaN, 9)).toBeNull();
    expect(buildPrecisionClaim(0, 9)).toBeNull();
  });

  it('marks a claim provisional until enough scans back it', () => {
    // A floor from three scans is a real number and a weak claim. The surface
    // may show it as provisional; it may not state it as established fact.
    expect(buildPrecisionClaim(2.4, 3)?.provisional).toBe(true);
    expect(buildPrecisionClaim(2.4, MIN_SCANS_FOR_ESTABLISHED_PRECISION)?.provisional).toBe(false);
  });

  it('carries the raw floor for the evidence layer, not the headline', () => {
    const claim = buildPrecisionClaim(2.44, 9);
    expect(claim?.noiseFloorMs).toBe(2.4);
    expect(claim?.scanCount).toBe(9);
  });
});
