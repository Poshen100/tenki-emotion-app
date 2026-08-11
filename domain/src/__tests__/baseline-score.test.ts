import {
  MIN_SAMPLES_FOR_SCORE,
  Z_CLAMP,
  SCORE_CLEAR_AT,
  SCORE_MAX,
  SCORE_MIN,
  SCORE_NEUTRAL_AT,
  type PersonalBaselineStats,
  type ReadinessEvidence,
  normalCdf,
  personSignalComposite,
  personalScore,
  scoreBand,
} from '../index';

/** A baseline with enough history and a real spread. */
function stats(overrides: Partial<PersonalBaselineStats> = {}): PersonalBaselineStats {
  return { mean: 0.5, std: 0.1, sampleCount: 30, ...overrides };
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

describe('personalScore', () => {
  // 🔴 50 = 完全是你的常態。這是整個尺度的意義所在，
  // 也是絕對分 0-100 永遠說不出來的一句話。
  it('🔴 returns 50 when today is exactly the personal mean', () => {
    expect(personalScore(0.5, stats())).toBe(50);
  });

  it('returns 84 at one standard deviation above', () => {
    expect(personalScore(0.6, stats())).toBe(84);
  });

  it('returns 16 at one standard deviation below', () => {
    expect(personalScore(0.4, stats())).toBe(16);
  });

  // 🔴 端點守則：不管多極端都不得出現 0 或 100。
  it('🔴 never returns 0 or 100, however extreme the reading', () => {
    const high = personalScore(99, stats());
    const low = personalScore(-99, stats());
    expect(high).toBe(SCORE_MAX);
    expect(low).toBe(SCORE_MIN);
    expect(high).not.toBe(100);
    expect(low).not.toBe(0);
  });

  it('stays inside 1..99 across a wide sweep', () => {
    for (let v = -3; v <= 3; v += 0.05) {
      const score = personalScore(0.5 + v, stats());
      expect(score).not.toBeNull();
      expect(score as number).toBeGreaterThanOrEqual(SCORE_MIN);
      expect(score as number).toBeLessThanOrEqual(SCORE_MAX);
    }
  });

  // 🔴 樣本不足時回 null，不是回一個看起來像真的的數字。
  it('🔴 returns null below the minimum sample count', () => {
    expect(personalScore(0.5, stats({ sampleCount: MIN_SAMPLES_FOR_SCORE - 1 }))).toBeNull();
  });

  it('starts answering exactly at the minimum sample count', () => {
    expect(personalScore(0.5, stats({ sampleCount: MIN_SAMPLES_FOR_SCORE }))).toBe(50);
  });

  // 🔴 std = 0 → z 是 ±Infinity。那不是要粉飾的邊界，
  // 它代表「這個人的離散度還不是真的」。
  it('🔴 returns null when the spread is not real yet (std = 0)', () => {
    expect(personalScore(0.9, stats({ std: 0 }))).toBeNull();
  });

  it('returns null for non-finite inputs rather than NaN', () => {
    expect(personalScore(Number.NaN, stats())).toBeNull();
    expect(personalScore(0.5, stats({ std: Number.NaN }))).toBeNull();
    expect(personalScore(0.5, stats({ mean: Number.POSITIVE_INFINITY }))).toBeNull();
  });

  it('is monotonic — a higher reading never scores lower', () => {
    const a = personalScore(0.45, stats()) as number;
    const b = personalScore(0.55, stats()) as number;
    expect(b).toBeGreaterThan(a);
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
