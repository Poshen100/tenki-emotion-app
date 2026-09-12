/**
 * The three device-validation checks that decide whether this feature is
 * viable, computed from captures that already happened.
 *
 * 🔴 These are the checks a human cannot do by looking at a screen once:
 * #15 (is the PRV gate reachable), #6 (does a lock ever precede a refusal),
 * #14 (how big is real day-to-day variation). Getting them wrong here would
 * mean the founder walks around with a phone and comes back with a number
 * that means nothing.
 */
import {
  type ValidationCapture,
  assessDayToDaySpread,
  assessLockHonesty,
  assessPrvGateReachability,
  formatValidationReport,
} from '../validation-log';

function capture(overrides: Partial<ValidationCapture> = {}): ValidationCapture {
  return {
    atMs: 1_757_000_000_000,
    localDateKey: '2026-09-11',
    durationSec: 90,
    qualityScore: 95,
    accepted: true,
    heartRateBpm: 66,
    prvRmssdMs: 40,
    beatTemplateCorrelation: 0.98,
    lockEverAchieved: true,
    scenario: 'resting',
    ...overrides,
  };
}

describe('#15 — is the PRV gate reachable on a real device', () => {
  it('says nothing from an empty log rather than reporting a rate', () => {
    const result = assessPrvGateReachability([]);
    expect(result.passRate).toBeNull();
    expect(result.templateCorrelation).toBeNull();
  });

  it('counts the pass rate over captures that established a pulse', () => {
    const log = [
      capture({ prvRmssdMs: 40, beatTemplateCorrelation: 0.98 }),
      capture({ prvRmssdMs: null, beatTemplateCorrelation: 0.94 }),
      capture({ prvRmssdMs: null, beatTemplateCorrelation: 0.91 }),
      capture({ prvRmssdMs: 38, beatTemplateCorrelation: 0.97 }),
    ];
    const result = assessPrvGateReachability(log);
    expect(result.captureCount).toBe(4);
    expect(result.passedCount).toBe(2);
    expect(result.passRate).toBe(0.5);
  });

  it('🔴 ignores captures that never established a pulse', () => {
    // The gate is never evaluated on those, so counting them would report a
    // low pass rate for a reason that has nothing to do with beat shape —
    // and the whole point of this check is to learn whether BEAT SHAPE is
    // reachable on a real finger.
    const log = [
      capture({ prvRmssdMs: 40 }),
      capture({ accepted: false, heartRateBpm: null, prvRmssdMs: null, beatTemplateCorrelation: null }),
      capture({ accepted: false, heartRateBpm: null, prvRmssdMs: null, beatTemplateCorrelation: null }),
    ];
    const result = assessPrvGateReachability(log);
    expect(result.captureCount).toBe(1);
    expect(result.passRate).toBe(1);
  });

  it('reports the distribution, not just the verdict', () => {
    // A 0% pass rate means something different at a median of 0.96 than at
    // 0.70: the first says "lower the threshold a little", the second says
    // "this measure does not survive real fingertips".
    const log = [0.91, 0.94, 0.96].map((t) =>
      capture({ beatTemplateCorrelation: t, prvRmssdMs: null }),
    );
    const result = assessPrvGateReachability(log);
    expect(result.templateCorrelation).toEqual({ min: 0.91, median: 0.94, max: 0.96 });
  });
});

describe('#6 — a lock must never precede a refusal', () => {
  it('passes a log where every locked capture produced a reading', () => {
    const result = assessLockHonesty([capture(), capture({ lockEverAchieved: false, accepted: false, heartRateBpm: null })]);
    expect(result.passed).toBe(true);
    expect(result.falseLockCount).toBe(0);
  });

  it('🔴 fails the moment a locked capture came back with nothing', () => {
    // Forty seconds of "signal holding" followed by "no reading" is the exact
    // failure the lock was designed against.
    const result = assessLockHonesty([
      capture(),
      capture({ lockEverAchieved: true, accepted: false, heartRateBpm: null, prvRmssdMs: null }),
    ]);
    expect(result.passed).toBe(false);
    expect(result.falseLockCount).toBe(1);
  });

  it('counts walking captures separately, because that is the scenario', () => {
    const result = assessLockHonesty([
      capture({ scenario: 'walking', lockEverAchieved: false, accepted: false, heartRateBpm: null }),
      capture({ scenario: 'walking', lockEverAchieved: false, accepted: false, heartRateBpm: null }),
      capture({ scenario: 'resting' }),
    ]);
    expect(result.walkingCount).toBe(2);
    expect(result.walkingLockCount).toBe(0);
    expect(result.passed).toBe(true);
  });

  it('⚠️ passes an empty log, which is not the same as having been checked', () => {
    // Deliberate: `passed` means "nothing has contradicted it". The report
    // prints the capture count beside it so an untested pass cannot be read
    // as a tested one.
    const result = assessLockHonesty([]);
    expect(result.passed).toBe(true);
    expect(result.captureCount).toBe(0);
  });
});

describe('#14 — day-to-day variation against within-day variation', () => {
  it('refuses to compute a ratio from a single day', () => {
    const log = [capture({ localDateKey: '2026-09-11', heartRateBpm: 64 }), capture({ localDateKey: '2026-09-11', heartRateBpm: 68 })];
    const result = assessDayToDaySpread(log).pulseBpm;
    expect(result.dayCount).toBe(1);
    expect(result.acrossDaySd).toBeNull();
    expect(result.ratio).toBeNull();
  });

  it('refuses a within-day figure when no day has two captures', () => {
    // 🔴 One capture a day says nothing about how much the instrument wobbles
    // within a sitting, so the denominator does not exist.
    const log = [
      capture({ localDateKey: '2026-09-11', heartRateBpm: 64 }),
      capture({ localDateKey: '2026-09-12', heartRateBpm: 70 }),
    ];
    const result = assessDayToDaySpread(log).pulseBpm;
    expect(result.acrossDaySd).not.toBeNull();
    expect(result.withinDaySd).toBeNull();
    expect(result.ratio).toBeNull();
  });

  it('computes the ratio once both halves exist', () => {
    const log = [
      capture({ localDateKey: '2026-09-11', heartRateBpm: 60 }),
      capture({ localDateKey: '2026-09-11', heartRateBpm: 62 }),
      capture({ localDateKey: '2026-09-12', heartRateBpm: 70 }),
      capture({ localDateKey: '2026-09-12', heartRateBpm: 72 }),
    ];
    const result = assessDayToDaySpread(log).pulseBpm;
    // Day means 61 and 71 → across-day SD 5; each day's own SD is 1.
    expect(result.acrossDaySd).toBe(5);
    expect(result.withinDaySd).toBe(1);
    expect(result.ratio).toBe(5);
  });

  it('measures Pulse Rhythm separately, skipping captures whose gate failed', () => {
    const log = [
      capture({ localDateKey: '2026-09-11', prvRmssdMs: 40 }),
      capture({ localDateKey: '2026-09-11', prvRmssdMs: 44 }),
      capture({ localDateKey: '2026-09-11', prvRmssdMs: null }),
      capture({ localDateKey: '2026-09-12', prvRmssdMs: 50 }),
      capture({ localDateKey: '2026-09-12', prvRmssdMs: 54 }),
    ];
    const result = assessDayToDaySpread(log).pulseRhythmMs;
    expect(result.valueCount).toBe(4);
    expect(result.ratio).not.toBeNull();
  });
});

describe('the report is safe to paste', () => {
  it('carries statistics only — no per-capture rows and no timestamps', () => {
    // 🔴 It is meant to be copied out of a phone into a conversation, which is
    // exactly why it may not carry anything that would be uncomfortable to
    // paste. Day keys appear only inside aggregates, never as a row.
    const report = formatValidationReport([
      capture({ atMs: 1_757_123_456_789 }),
      capture({ atMs: 1_757_123_999_999, localDateKey: '2026-09-12' }),
    ]);
    // ⚠️ Asserted as a PATTERN, not as the specific values in this fixture.
    // The first version checked `not.toContain(<first atMs>)`, so printing the
    // LAST capture's timestamp in the header sailed straight through it.
    expect(report).not.toMatch(/\d{13}/);
    expect(report).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    expect(report.split('\n').length).toBeLessThan(20);
  });

  it('says what is missing rather than printing a number it does not have', () => {
    const report = formatValidationReport([capture()]);
    expect(report).toContain('資料不足');
  });

  it('states the three checks by their checklist numbers', () => {
    const report = formatValidationReport([capture()]);
    expect(report).toContain('#15');
    expect(report).toContain('#6');
    expect(report).toContain('#14');
  });

  it('🔴 marks the lock check as failed in the report, not just in the object', () => {
    const report = formatValidationReport([
      capture({ lockEverAchieved: true, accepted: false, heartRateBpm: null, prvRmssdMs: null }),
    ]);
    expect(report).toContain('這條不過');
  });
});
