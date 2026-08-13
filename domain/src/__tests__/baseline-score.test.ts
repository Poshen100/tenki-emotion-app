import {
  MIN_DAYS_FOR_SCORE,
  MIN_SAMPLES_FOR_SCORE,
  Z_CLAMP,
  SCORE_CLEAR_AT,
  SCORE_MAX,
  SCORE_MIN,
  SCORE_NEUTRAL_AT,
  type BaselineSample,
  type ReadinessEvidence,
  normalCdf,
  personSignalComposite,
  personalScore,
  scoreBand,
  summarizeSamples,
  weightedPercentile,
} from '../index';

const DAY_MS = 86_400_000;
/** Fixed local-noon start so day bucketing never straddles a boundary. */
const T0 = new Date(2026, 0, 5, 12, 0, 0).getTime();

/**
 * A sample series with an **exact** mean and sample standard deviation.
 *
 * Even n: half at `mean ± d` with `d = std·√((n−1)/n)`.
 * Odd n: one at the mean, the rest split — which makes `d = std` exactly.
 * Built this way so the assertions below can use round numbers (50 / 84 / 16)
 * instead of tolerances that would hide a real drift.
 */
function series(
  count = MIN_SAMPLES_FOR_SCORE,
  opts: { mean?: number; std?: number; days?: number } = {},
): BaselineSample[] {
  const mean = opts.mean ?? 0.5;
  const std = opts.std ?? 0.1;
  const days = opts.days ?? count;
  const even = count % 2 === 0;
  const d = even ? std * Math.sqrt((count - 1) / count) : std;
  const values: number[] = [];
  if (!even) {
    values.push(mean);
  }
  const pairs = Math.floor(count / 2);
  for (let i = 0; i < pairs; i += 1) {
    values.push(mean + d, mean - d);
  }
  return values.map((composite, i) => ({
    ts: T0 + (i % days) * DAY_MS,
    composite,
  }));
}

function evidence(overrides: Partial<ReadinessEvidence> = {}): ReadinessEvidence {
  return {
    stillness: 0.8,
    lighting: 0.9,
    uniformity: 0.9,
    blinkCadence: null,
    tier: 'A',
    ...overrides,
  };
}

describe('normalCdf', () => {
  it('is 0.5 at zero', () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 6);
  });

  it('matches the textbook value at 1.96 (two-tailed 95%)', () => {
    expect(normalCdf(1.96)).toBeCloseTo(0.975, 4);
  });

  it('matches the textbook value at 2.33', () => {
    expect(normalCdf(2.33)).toBeCloseTo(0.99, 3);
  });

  it('is symmetric about zero', () => {
    expect(normalCdf(-1.4) + normalCdf(1.4)).toBeCloseTo(1, 6);
  });

  // ⚠️ 這條原本寫「再極端也取不到 0 或 1」，測出來是**錯的**：
  // |z| 大到約 38 之後 exp(-x²) 在 float64 underflow，normalCdf 會回傳正好 0/1。
  // 數學上 Φ 是開區間，浮點數上不是。
  // 🔴 所以「不會出現 0 或 100」的保證**不在這條曲線上，在 Z_CLAMP 上** ——
  // personalScore 先把 z 夾在 ±2.33，遠在尾巴變薄之前。
  it('stays strictly inside (0,1) across the range personalScore can reach', () => {
    for (let z = -Z_CLAMP; z <= Z_CLAMP; z += 0.01) {
      expect(normalCdf(z)).toBeGreaterThan(0);
      expect(normalCdf(z)).toBeLessThan(1);
    }
  });

  it('underflows to exactly 0/1 far outside that range (documented limit)', () => {
    expect(normalCdf(-40)).toBe(0);
    expect(normalCdf(40)).toBe(1);
  });
});

describe('personSignalComposite', () => {
  it('is stillness alone when blink cadence is unavailable', () => {
    expect(personSignalComposite(evidence({ stillness: 0.72 }))).toBeCloseTo(0.72, 6);
  });

  it('blends stillness and blink cadence when both exist', () => {
    const value = personSignalComposite(
      evidence({ stillness: 1, blinkCadence: 0 }),
    );
    expect(value).toBeCloseTo(0.6, 6);
  });

  // 🔴 最重要的一條：分數排名的對象**不准包含環境**。
  // lighting/uniformity 描述的是房間，不是人 —— 把它算進去，
  // 就變成「房間暗一點你的分數就低」。環境歸 resolveConfidence 管。
  it('🔴 ignores capture quality entirely — the room is not the person', () => {
    const bright = personSignalComposite(
      evidence({ stillness: 0.6, lighting: 1, uniformity: 1 }),
    );
    const dim = personSignalComposite(
      evidence({ stillness: 0.6, lighting: 0.1, uniformity: 0.1 }),
    );
    expect(bright).toBe(dim);
  });

  it('clamps out-of-range inputs', () => {
    expect(personSignalComposite(evidence({ stillness: 5 }))).toBe(1);
    expect(personSignalComposite(evidence({ stillness: -5 }))).toBe(0);
  });
});

describe('summarizeSamples', () => {
  it('returns null when there is nothing usable', () => {
    expect(summarizeSamples([])).toBeNull();
  });

  // 🔴 一筆資料的離散度不是零，是未知。回 0 會讓 z 變成 ±Infinity 而不自知。
  it('🔴 leaves std null for a single sample rather than calling it 0', () => {
    const only = summarizeSamples([{ ts: T0, composite: 0.5 }]);
    expect(only?.std).toBeNull();
    expect(only?.sampleCount).toBe(1);
  });

  it('computes the sample standard deviation (n−1)', () => {
    // 0.4 / 0.6 → mean 0.5, ss = 0.02, /(2-1) → std = √0.02
    const two = summarizeSamples([
      { ts: T0, composite: 0.4 },
      { ts: T0 + DAY_MS, composite: 0.6 },
    ]);
    expect(two?.std).toBeCloseTo(Math.sqrt(0.02), 12);
  });

  // 🔴 同一天的多次掃描共用姿勢與光線，不算兩天。
  it('🔴 counts distinct local days, not sample count', () => {
    const summary = summarizeSamples(series(30, { days: 3 }));
    expect(summary?.sampleCount).toBe(30);
    expect(summary?.distinctDays).toBe(3);
  });

  // 🔴 壞掉的一筆不得污染整條序列的平均。
  it('🔴 drops non-finite composites instead of poisoning the mean', () => {
    const summary = summarizeSamples([
      { ts: T0, composite: 0.4 },
      { ts: T0 + DAY_MS, composite: Number.POSITIVE_INFINITY },
      { ts: T0 + 2 * DAY_MS, composite: 0.6 },
    ]);
    expect(summary?.sampleCount).toBe(2);
    expect(summary?.mean).toBeCloseTo(0.5, 12);
  });
});

describe('personalScore', () => {
  // 🔴 50 = 完全是你的常態。這是整個尺度的意義所在，
  // 也是絕對分 0-100 永遠說不出來的一句話。
  it('🔴 returns 50 when today is exactly the personal mean', () => {
    expect(personalScore(0.5, series())).toBe(50);
  });

  it('returns 84 at one standard deviation above', () => {
    expect(personalScore(0.6, series())).toBe(84);
  });

  it('returns 16 at one standard deviation below', () => {
    expect(personalScore(0.4, series())).toBe(16);
  });

  // 🔴 端點守則：不管多極端都不得出現 0 或 100。
  it('🔴 never returns 0 or 100, however extreme the reading', () => {
    const high = personalScore(99, series());
    const low = personalScore(-99, series());
    expect(high).toBe(SCORE_MAX);
    expect(low).toBe(SCORE_MIN);
    expect(high).not.toBe(100);
    expect(low).not.toBe(0);
  });

  it('stays inside 1..99 across a wide sweep', () => {
    for (let v = -3; v <= 3; v += 0.05) {
      const score = personalScore(0.5 + v, series());
      expect(score).not.toBeNull();
      expect(score as number).toBeGreaterThanOrEqual(SCORE_MIN);
      expect(score as number).toBeLessThanOrEqual(SCORE_MAX);
    }
  });

  // 🔴 樣本不足時回 null，不是回一個看起來像真的的數字。
  //
  // ⚠️ 這裡**必須用字面值**。原本寫的是 `MIN_SAMPLES_FOR_SCORE - 1`，
  // 反向驗證時把常數改成 1 —— 整組測試照樣全綠，因為斷言跟著常數一起移動了。
  // 那種斷言守不住任何東西。要釘住的是**意圖**：引擎的 ready(5) 對百分位太少。
  it('🔴 stays silent at the engine\'s ready maturity — 5 samples is too few', () => {
    expect(personalScore(0.5, series(5))).toBeNull();
  });

  it('🔴 stays silent through the first two weeks of daily scans', () => {
    expect(personalScore(0.5, series(13))).toBeNull();
    expect(personalScore(0.5, series(29))).toBeNull();
  });

  it('🔴 the threshold itself must not be weakened', () => {
    expect(MIN_SAMPLES_FOR_SCORE).toBeGreaterThanOrEqual(30);
    expect(MIN_DAYS_FOR_SCORE).toBeGreaterThanOrEqual(7);
  });

  // 🔴 引擎的 BASELINE_THRESHOLDS（READY 5 / MATURE 15 跨 3 天）管的是它自己的
  // BaselineProfile（HR/HRV/RR），是另一個物件。兩套門檻管兩件事沒問題，
  // 兩套門檻管**同一個決定**就是規則悄悄失效的方式（PLAYBOOK §6）。
  // 這一條釘住「分數的門檻嚴格得多」，避免哪天有人拿引擎那組來 gate 分數。
  it('🔴 stays strictly above the engine\'s own maturity thresholds', () => {
    expect(MIN_SAMPLES_FOR_SCORE).toBeGreaterThan(15);
    expect(MIN_DAYS_FOR_SCORE).toBeGreaterThan(3);
  });

  it('starts answering exactly at the minimum sample count', () => {
    expect(personalScore(0.5, series(MIN_SAMPLES_FOR_SCORE))).toBe(50);
  });

  // 🔴 這是本刀的重點之一：30 次全擠在幾天裡描述的是一個時刻，不是一個人的
  // 範圍。分母該量到的是**跨天**變異。
  it('🔴 stays silent when plenty of samples span too few days', () => {
    expect(personalScore(0.5, series(60, { days: 2 }))).toBeNull();
    expect(personalScore(0.5, series(60, { days: 6 }))).toBeNull();
  });

  it('answers once the same samples span enough days', () => {
    expect(personalScore(0.5, series(60, { days: MIN_DAYS_FOR_SCORE }))).toBe(50);
  });

  // 🔴 std = 0 → z 是 ±Infinity。那不是要粉飾的邊界，
  // 它代表「這個人的離散度還不是真的」。
  it('🔴 returns null when the spread is not real yet (std = 0)', () => {
    expect(personalScore(0.9, series(30, { std: 0 }))).toBeNull();
  });

  it('returns null for non-finite inputs rather than NaN', () => {
    expect(personalScore(Number.NaN, series())).toBeNull();
    expect(personalScore(Number.POSITIVE_INFINITY, series())).toBeNull();
  });

  it('returns null for an empty history', () => {
    expect(personalScore(0.5, [])).toBeNull();
  });

  it('is monotonic — a higher reading never scores lower', () => {
    const a = personalScore(0.45, series()) as number;
    const b = personalScore(0.55, series()) as number;
    expect(b).toBeGreaterThan(a);
  });
});

describe('weightedPercentile', () => {
  /**
   * Strictly increasing composites, one per day.
   *
   * ⚠️ The tie-heavy `series()` helper is useless here: with half the samples
   * at one value, *both* formulas land far from the ends, so an assertion built
   * on it would pass no matter which denominator is used. The endpoint
   * behaviour only shows up on distinct values.
   */
  function distinct(count = 30): BaselineSample[] {
    return Array.from({ length: count }, (_, i) => ({
      ts: T0 + i * DAY_MS,
      composite: 0.2 + (i * 0.4) / count,
    }));
  }

  // 🔴 這是選 Weibull（分母 +1）的理由，也是 v2 calculateTeiPr 的病：
  // 用 count/n 時破紀錄的那天 below/total = 1.0 → 夾成 99。
  // 端點於是不是罕見，是必然 —— n 筆歷史約有 2/n 的讀數壓在兩端。
  it('🔴 a brand-new record approaches the top instead of hitting it', () => {
    const history = distinct(30);
    const record = 1;
    const score = weightedPercentile(record, history) as number;
    expect(score).toBeLessThan(SCORE_MAX);
    // 100·n/(n+1) —— 分母那一份多出來的權重就是 Weibull 修正本身。
    expect(score).toBe(Math.round((100 * 30) / 31));
  });

  // 反向驗證用：把分母改回 `total`，這一條會變成 98 而紅。
  it('🔴 the historical maximum does not read as near-certain either', () => {
    const history = distinct(30);
    const max = Math.max(...history.map((s) => s.composite));
    expect(weightedPercentile(max, history) as number).toBeLessThanOrEqual(96);
  });

  it('🔴 the historical minimum stays off the floor', () => {
    const history = distinct(30);
    const min = Math.min(...history.map((s) => s.composite));
    expect(weightedPercentile(min, history) as number).toBeGreaterThan(SCORE_MIN);
  });

  it('puts a mid reading near 50', () => {
    const history = distinct(31);
    const score = weightedPercentile(0.4, history) as number;
    expect(score).toBeGreaterThanOrEqual(45);
    expect(score).toBeLessThanOrEqual(55);
  });

  it('honours the same maturity gates as personalScore', () => {
    expect(weightedPercentile(0.5, distinct(29))).toBeNull();
    expect(weightedPercentile(0.5, series(60, { days: 2 }))).toBeNull();
  });

  it('weights shift the answer', () => {
    const history = distinct(30);
    const unweighted = weightedPercentile(0.4, history) as number;
    // Weigh only the low half → today's reading now sits above almost everything.
    const weighted = weightedPercentile(0.4, history, (s) =>
      s.composite < 0.4 ? 1 : 0.01,
    ) as number;
    expect(weighted).toBeGreaterThan(unweighted);
  });

  it('returns null for non-finite input', () => {
    expect(weightedPercentile(Number.NaN, distinct())).toBeNull();
  });
});

describe('scoreBand', () => {
  it('maps the thresholds', () => {
    expect(scoreBand(SCORE_CLEAR_AT)).toBe('clear');
    expect(scoreBand(SCORE_CLEAR_AT - 1)).toBe('neutral');
    expect(scoreBand(SCORE_NEUTRAL_AT)).toBe('neutral');
    expect(scoreBand(SCORE_NEUTRAL_AT - 1)).toBe('strain');
  });

  it('classifies the endpoints', () => {
    expect(scoreBand(SCORE_MAX)).toBe('clear');
    expect(scoreBand(SCORE_MIN)).toBe('strain');
    expect(scoreBand(50)).toBe('neutral');
  });

  // 🔴 這條把「門檻決定的是講話頻率」這件事釘住。
  // 位置分數對使用者自己是均勻的，所以 20/80 → 各兩成，中間六成。
  // 舊的 70/40 會讓人**永遠有 40% 的日子落在最低帶**，不管他過得多好。
  it('🔴 leaves most days typical — extremes stay rare by construction', () => {
    let clear = 0;
    let neutral = 0;
    let strain = 0;
    for (let s = SCORE_MIN; s <= SCORE_MAX; s += 1) {
      const band = scoreBand(s);
      if (band === 'clear') clear += 1;
      else if (band === 'neutral') neutral += 1;
      else strain += 1;
    }
    const total = SCORE_MAX - SCORE_MIN + 1;
    expect(clear / total).toBeLessThanOrEqual(0.25);
    expect(strain / total).toBeLessThanOrEqual(0.25);
    expect(neutral / total).toBeGreaterThanOrEqual(0.5);
  });
});
