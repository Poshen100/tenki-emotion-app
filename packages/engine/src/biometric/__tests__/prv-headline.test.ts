/**
 * Check #27: may this device headline its camera Pulse Rhythm?
 *
 * 🔴 founder 2026-11-22: the number may leave the evidence layer only on a phone
 * that agreed with a chest strap measured at the same time. Every test here is
 * one way that permission could be granted when it should not be.
 */
import {
  MAX_MEDIAN_RELATIVE_ERROR,
  MAX_REFERENCE_ENTRY_DELAY_MS,
  MAX_TAIL_RELATIVE_ERROR,
  MIN_REFERENCE_DAYS,
  MIN_REFERENCE_PAIRS,
  MIN_REFERENCE_RMSSD_MS,
  assessReferenceAgreement,
  resolvePrvHeadline,
} from '../ppg/prv-headline';
import { type ValidationCapture, formatValidationReport } from '../validation-log';

function capture(overrides: Partial<ValidationCapture> = {}): ValidationCapture {
  return {
    atMs: 1_763_800_000_000,
    localDateKey: '2026-11-22',
    durationSec: 90,
    qualityScore: 95,
    accepted: true,
    heartRateBpm: 64,
    prvRmssdMs: 40,
    beatTemplateCorrelation: 0.98,
    lockEverAchieved: true,
    channel: 'red',
    channelPeriodicity: { red: 0.93, green: 0.4 },
    channelDcMean: { red: 190, green: 92 },
    exposure: null,
    exposureLock: null,
    torchOn: null,
    quietSegments: null,
    scenario: 'resting',
    referenceRmssdMs: 42,
    referenceSameWindow: true,
    referenceEnteredAtMs: 1_763_800_000_000 + 60_000,
    ...overrides,
  };
}

/** `n` pairs alternating over two days, camera/strap ratio taken from `ratios` in turn. */
function pairs(n: number, ratios: readonly number[]): ValidationCapture[] {
  return Array.from({ length: n }, (_, i) =>
    capture({
      localDateKey: i % 2 === 0 ? '2026-11-21' : '2026-11-22',
      referenceRmssdMs: 50,
      prvRmssdMs: Math.round(50 * ratios[i % ratios.length] * 10) / 10,
    }),
  );
}

describe('assessReferenceAgreement', () => {
  it('needs both the pair count and the day count before it judges anything', () => {
    expect(MIN_REFERENCE_PAIRS).toBe(10);
    expect(MIN_REFERENCE_DAYS).toBe(2);
    expect(assessReferenceAgreement(pairs(MIN_REFERENCE_PAIRS - 1, [1])).status).toBe('accumulating');
    // 🔴 Ten perfect pairs from one sitting is one context, not a validation.
    const oneDay = pairs(MIN_REFERENCE_PAIRS, [1]).map((c) => ({ ...c, localDateKey: '2026-11-22' }));
    expect(assessReferenceAgreement(oneDay).status).toBe('accumulating');
    expect(assessReferenceAgreement(pairs(MIN_REFERENCE_PAIRS, [1])).status).toBe('passed');
  });

  it('passes a camera that is consistently close (the §13 clean under-read of ~8%)', () => {
    const r = assessReferenceAgreement(pairs(12, [0.92, 0.95, 0.97, 1.02]));
    expect(r.status).toBe('passed');
    expect(r.medianBias).toBeLessThan(0);
    expect(r.medianAbsError).toBeLessThanOrEqual(MAX_MEDIAN_RELATIVE_ERROR);
  });

  it('🔴 fails on the tail even when the median looks fine', () => {
    // 9 near-perfect, 3 off by 40%: the median is ~0, the tail is not.
    // A camera that is right most days and badly wrong some days must not
    // headline — the user cannot tell which day it is.
    const r = assessReferenceAgreement(pairs(12, [1, 1, 1, 1.4]));
    expect(r.medianAbsError).toBeLessThanOrEqual(MAX_MEDIAN_RELATIVE_ERROR);
    expect([r.tailCount, r.tailAllowed]).toEqual([3, 1]);
    expect(r.status).toBe('failed');
  });

  it('🔴 the tail rule is a count: at n = 10 exactly one pair may exceed the bound, two may not', () => {
    const ratios = (bad: number) => Array.from({ length: 10 }, (_, i) => (i < bad ? 1.3 : 1));
    const one = assessReferenceAgreement(pairs(10, ratios(1)));
    expect([one.tailCount, one.tailAllowed, one.status]).toEqual([1, 1, 'passed']);
    expect(one.worstAbsError).toBeCloseTo(0.3, 3);
    expect(assessReferenceAgreement(pairs(10, ratios(2))).status).toBe('failed');
    expect(MAX_TAIL_RELATIVE_ERROR).toBe(0.17);
  });

  it('🔴 only pairs confirmed as the same window AND typed in time', () => {
    const base = pairs(10, [1]);
    const unconfirmed = base.map((c) => ({ ...c, referenceSameWindow: false }));
    expect(assessReferenceAgreement(unconfirmed)).toMatchObject({ pairCount: 0, unsyncedCount: 10 });
    const late = base.map((c) => ({ ...c, referenceEnteredAtMs: c.atMs + MAX_REFERENCE_ENTRY_DELAY_MS + 1 }));
    expect(assessReferenceAgreement(late)).toMatchObject({ pairCount: 0, unsyncedCount: 10 });
    const before = base.map((c) => ({ ...c, referenceEnteredAtMs: c.atMs - 1 }));
    expect(assessReferenceAgreement(before).pairCount).toBe(0);
    // An older record carries neither field.
    const old = base.map(({ referenceSameWindow: _a, referenceEnteredAtMs: _b, ...rest }) => rest as ValidationCapture);
    expect(assessReferenceAgreement(old).status).toBe('accumulating');
  });

  it('🔴 a near-zero strap value is left out and counted, not allowed to blow up the ratio', () => {
    const low = pairs(10, [1]).map((c) => ({ ...c, referenceRmssdMs: MIN_REFERENCE_RMSSD_MS - 1, prvRmssdMs: 12 }));
    expect(assessReferenceAgreement(low)).toMatchObject({ pairCount: 0, lowReferenceCount: 10, status: 'accumulating' });
  });

  it('fails a consistent bias larger than the bound', () => {
    expect(assessReferenceAgreement(pairs(10, [0.85])).status).toBe('failed');
  });

  it('only counts resting captures that established a pulse, passed the gate, and carry a strap value', () => {
    const good = pairs(10, [1]);
    const noise = [
      capture({ scenario: 'walking' }),
      capture({ accepted: false }),
      capture({ prvRmssdMs: null }),
      capture({ referenceRmssdMs: null }),
      capture({ referenceRmssdMs: 0 }),
      // 🔴 A record from before the field existed: `undefined`, not null.
      (({ referenceRmssdMs: _omit, ...rest }) => rest)(capture()) as ValidationCapture,
    ];
    expect(assessReferenceAgreement([...good, ...noise]).pairCount).toBe(10);
  });

  it('says nothing numeric with no pairs (null, never 0)', () => {
    const r = assessReferenceAgreement([]);
    expect(r).toEqual({
      status: 'accumulating',
      pairCount: 0,
      dayCount: 0,
      unsyncedCount: 0,
      lowReferenceCount: 0,
      medianBias: null,
      medianAbsError: null,
      tailCount: 0,
      tailAllowed: 0,
      worstAbsError: null,
    });
  });
});

describe('resolvePrvHeadline', () => {
  const passed = assessReferenceAgreement(pairs(10, [1]));
  const failed = assessReferenceAgreement(pairs(10, [0.7]));
  const accumulating = assessReferenceAgreement([]);

  it('shows the number on a validated device, labelled as the calculated layer', () => {
    expect(resolvePrvHeadline(passed, 41)).toEqual({ show: true, valueMs: 41, layer: 'calculated' });
  });

  it('🔴 a validated device does not rescue a capture whose own gate failed', () => {
    expect(resolvePrvHeadline(passed, null)).toEqual({ show: false, reason: 'gate_not_passed' });
  });

  it('keeps it in the evidence layer until the device is validated, and says which way it stands', () => {
    expect(resolvePrvHeadline(accumulating, 41)).toEqual({ show: false, reason: 'device_not_validated' });
    expect(resolvePrvHeadline(failed, 41)).toEqual({ show: false, reason: 'device_failed_validation' });
  });
});

describe('#27 in the validation report', () => {
  it('says plainly that the sample is not enough yet', () => {
    const report = formatValidationReport(pairs(3, [1]));
    expect(report).toContain('#27 胸帶對照（只代表這台手機的初步驗證）');
    expect(report).toContain('樣本不足，還不能判定：靜坐配對 3/10 次、2/2 天');
  });

  it('prints the verdict as preliminary, with the tail as a count and the worst pair', () => {
    const report = formatValidationReport(pairs(10, [1]));
    expect(report).toContain('✓ 初步通過：10 對、2 天');
    expect(report).toContain('（≤ 10%）');
    expect(report).toContain('超過 17% 的 0 對（容許 ≤ 1）');
    expect(report).toContain('最差 0%');
  });

  it('says which strap values were left out and why', () => {
    const log = [...pairs(3, [1]), capture({ referenceSameWindow: false }), capture({ referenceRmssdMs: 5 })];
    expect(formatValidationReport(log)).toContain('不計：沒確認同一段時間 1、胸帶值低於 10ms 1');
  });
});
