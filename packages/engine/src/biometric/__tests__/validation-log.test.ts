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
import { DC_DRIFT_SUSPECT } from '../ppg/exposure-stability';
import {
  type ValidationCapture,
  assessChannels,
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
    channel: 'red',
    channelPeriodicity: { red: 0.93, green: 0.4 },
    channelDcMean: { red: 190, green: 92 },
    exposure: null,
    exposureLock: null,
    scenario: 'resting',
    ...overrides,
  };
}

/** A camera holding still: the slow movement is respiratory wander, not gain. */
const steady = {
  dcMedian: 190,
  dcDriftFraction: 0.004,
  largestStepFraction: 0.002,
  slowDriftDominates: false,
  driftPeriodSec: 4.4,
  framesPerSecond: 29.6,
  longestGapMs: 40,
  frameCount: 2700,
};
/** The device's own 2026-09-17 signature: 28.8% drift on a ~5 s period. */
const hunting = {
  ...steady,
  dcDriftFraction: 0.31,
  largestStepFraction: 0.22,
  slowDriftDominates: true,
  driftPeriodSec: 5.1,
};

describe('🔴 log 是跨版本存下來的 —— 舊紀錄不得讓報告整份炸掉', () => {
  /**
   * 一筆**舊版寫下來的**紀錄：後來才加的欄位根本不存在（不是 null，是
   * undefined）。這是真機上發生過的事，連續三次實走都只看到報告的預設字，
   * 因為 `!== null` 對 undefined 是 true，過了 filter 之後就在下一行炸掉。
   */
  const legacy = (): ValidationCapture => {
    const old: Record<string, unknown> = {
      atMs: 1_757_000_000_000,
      localDateKey: '2026-09-10',
      durationSec: 90,
      qualityScore: 80,
      accepted: true,
      heartRateBpm: 66,
      prvRmssdMs: null,
      beatTemplateCorrelation: null,
      lockEverAchieved: true,
      scenario: 'resting',
      // channel / exposure / exposureLock：那一版還沒有這些欄位。
    };
    return old as unknown as ValidationCapture;
  };

  it('🔴 報告在只有舊紀錄時照樣產得出來', () => {
    expect(() => formatValidationReport([legacy()])).not.toThrow();
    expect(formatValidationReport([legacy()])).toContain('還沒有任何量到曝光的擷取');
  });

  /**
   * 🔴 比上面那筆更難抓的一種舊紀錄：**exposure 物件存在，但缺後來才加的
   * 巢狀欄位**。`driftPeriodSec` 是 2026-09-17 加的，所以之前存下來的每一筆
   * exposure 在那個欄位上都是 `undefined`。
   */
  const legacyExposure = (): ValidationCapture => {
    const old: Record<string, unknown> = {
      dcMedian: 200.95,
      dcDriftFraction: 0.29,
      largestStepFraction: 0.22,
      slowDriftDominates: true,
      framesPerSecond: 59.94,
      longestGapMs: 61,
      frameCount: 3600,
      // driftPeriodSec：那一版還沒有這個欄位。
    };
    return capture({ exposure: old as unknown as typeof steady });
  };

  it('🔴 舊紀錄缺巢狀欄位時說「量不到」，不是印出 NaN', () => {
    // 🔴 實機第五次（10 次擷取）真的印出了「慢速擺動週期中位數 NaN 秒」，
    // 而且後面還接著最樂觀的那句「比一次心搏慢 = 原理上可以除掉」。
    //
    // 兩個錯：① filter 寫成 `v !== null`，而 `undefined !== null` 是 true，
    // 所以 undefined 被當成 number 混進去，八筆取中位數變 NaN ——
    // **這就是 86b39915 同一個 bug，同一個檔案，教訓進 PLAYBOOK 三個 commit 之後。**
    // ② NaN 打敗了 null 檢查，也打敗了兩個 `<` 比較（NaN 的比較全是 false），
    // 於是**靠著失敗**落進最鼓舞人心的那一句。
    const report = formatValidationReport([legacyExposure(), legacyExposure()]);
    expect(report).toContain('慢速擺動週期中位數 — 秒');
    expect(report).toContain('量不到 —— 不代表沒有擺動');
    expect(report).not.toContain('原理上可以除掉');
    // 這批紀錄的其他曝光數字照樣要算得出來 —— 缺的只有週期那一個欄位。
    expect(report).toContain('DC 慢速擺動中位數 0.29');
  });

  it('🔴 新舊混在一起時，週期只由有那個欄位的紀錄算', () => {
    const report = formatValidationReport([
      legacyExposure(),
      capture({ exposure: { ...hunting, driftPeriodSec: 5.1 } }),
    ]);
    expect(report).toContain('慢速擺動週期中位數 5.1 秒');
  });

  it('🔴 報告裡永遠不得出現 NaN 這三個字', () => {
    // 整類的攔網：不管上游哪裡漏了一個欄位，報告都不該把非數字印成數字。
    // founder 是拿這份報告在做決定的。
    const report = formatValidationReport([
      legacy(),
      legacyExposure(),
      capture({ exposure: hunting, exposureLock: { requested: ['exposureMode'], applied: true } }),
    ]);
    expect(report).not.toContain('NaN');
    expect(report).not.toContain('undefined');
  });

  it('🔴 新舊混在一起也產得出來，而且只算得到的那些', () => {
    const fresh = capture({
      exposure: {
        dcMedian: 190,
        dcDriftFraction: 0.31,
        largestStepFraction: 0.22,
        slowDriftDominates: true,
        driftPeriodSec: 5.1,
        framesPerSecond: 30,
        longestGapMs: 40,
        frameCount: 1200,
      },
    });
    const report = formatValidationReport([legacy(), fresh]);
    // 分母是**有量到的**筆數，不是全部筆數 —— 舊紀錄沒有量，不能算進去。
    expect(report).toContain('可疑（擺動 ≥ 門檻）：1/1 次');
  });

  it('🔴 通道那一段也一樣（那是更早加的欄位，同一個坑）', () => {
    expect(() => assessChannels([legacy()])).not.toThrow();
    expect(assessChannels([legacy()]).captureCount).toBe(0);
    expect(formatValidationReport([legacy()])).toContain('還沒有任何量到通道的擷取');
  });
});

describe('曝光 — 相機有沒有在自己重新決定亮度', () => {

  it('says nothing about exposure until something measured it', () => {
    // 🔴 Same rule as everywhere else here: "no data" must not render as "fine".
    // The second real-device failure was invisible precisely because nothing
    // was recording this.
    expect(formatValidationReport([capture()])).toContain('還沒有任何量到曝光的擷取');
  });

  it('reports the drift, the threshold, and how many captures look suspect', () => {
    const report = formatValidationReport([
      capture({ exposure: hunting }),
      capture({ exposure: steady }),
    ]);
    expect(report).toContain('可疑（擺動 ≥ 門檻）：1/2 次');
    // The threshold is printed beside the number, so the reader does not have
    // to know it from memory to interpret the value.
    expect(report).toContain(`門檻 ${DC_DRIFT_SUSPECT}`);
    expect(report).toContain('時基');
  });

  it('separates "the lock was accepted" from "the level actually held"', () => {
    // ⚠️ A browser can accept the constraint and keep hunting. Collapsing the
    // two would make a successful-looking lock hide the failure it caused.
    const report = formatValidationReport([
      capture({ exposure: hunting, exposureLock: { requested: ['exposureMode'], applied: true } }),
    ]);
    expect(report).toContain('曝光鎖 exposureMode 成功 1/1 次');
    expect(report).toContain('可疑（擺動 ≥ 門檻）：1/1 次');
  });

  it('🔴 does not call the exposure locked when only white balance was', () => {
    // 🔴 The device on 2026-09-17. `applied` is one boolean for the whole
    // `applyConstraints` call, and the call only asks for the modes the browser
    // advertises as manual — which was `whiteBalanceMode` alone. The report
    // printed 「曝光鎖 成功 7/7 次」 for seven captures whose exposure was never
    // locked, then blamed the remaining 28.8% drift on "the browser accepted the
    // constraint without really locking". Both halves wrong, and they aimed the
    // next step at the wrong problem.
    const report = formatValidationReport([
      capture({
        exposure: hunting,
        exposureLock: { requested: ['whiteBalanceMode'], applied: true },
      }),
    ]);
    expect(report).toContain('這個瀏覽器根本不給鎖曝光');
    expect(report).toContain('另外鎖到 whiteBalanceMode');
    expect(report).not.toContain('曝光鎖 exposureMode 成功');
    // And the old misdiagnosis must be gone from the footnote entirely.
    expect(report).not.toContain('瀏覽器收了約束沒真鎖');
  });

  it('reports the drift period, and refuses to call a fast one slow', () => {
    // The number that decides whether the drift can be divided out at all.
    expect(formatValidationReport([capture({ exposure: hunting })])).toContain(
      '慢速擺動週期中位數 5.1 秒',
    );
    // ⚠️ Below the trustworthy floor it must say so rather than reading as
    // "slow": a 1.4 s drift measures near 3.6 s here, and that error points
    // the wrong way.
    const fast = formatValidationReport([
      capture({ exposure: { ...hunting, driftPeriodSec: 3.6 } }),
    ]);
    expect(fast).toContain('不能當成「慢」');
    expect(fast).not.toContain('原理上可以除掉');
    // And unmeasurable is not steady.
    const none = formatValidationReport([capture({ exposure: { ...hunting, driftPeriodSec: null } })]);
    expect(none).toContain('不代表沒有擺動');
  });

  it('says the browser had nothing to lock rather than implying failure', () => {
    const report = formatValidationReport([capture({ exposure: steady })]);
    expect(report).toContain('沒有可鎖的項目');
  });
});

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
    expect(result.templateCorrelation).toEqual({ min: 0.91, median: 0.94, max: 0.96, count: 3 });
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
  });

  it('stays short enough to paste in one go — measured on the LONGEST form', () => {
    // 🔴 This bound was vacuous for five days. It ran on the default fixture,
    // whose `exposure` is null, so the whole 曝光 section collapsed to a single
    // "nothing measured yet" line and the assertion never saw a real report.
    // Measured: the populated report is **26** lines against a bound of 24 —
    // it had already broken the rule it was supposed to be enforcing.
    //
    // ⚠️ So the fixture is the assertion here. Every section must produce its
    // longest form, or the number below means nothing again.
    const populated = [
      capture({
        exposure: hunting,
        exposureLock: { requested: ['whiteBalanceMode'], applied: true },
      }),
      capture({
        localDateKey: '2026-09-12',
        exposure: steady,
        exposureLock: { requested: ['exposureMode'], applied: true },
      }),
    ];
    const report = formatValidationReport(populated);
    // Every section is present in its long form, not its "no data" form.
    expect(report).not.toContain('還沒有任何');
    expect(report).toContain('慢速擺動週期');
    // 上限的意義是「一次貼得完」，不是一個固定數字。放寬時要重新確認那件事。
    expect(report.split('\n').length).toBeLessThan(30);
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

describe('the interpretation lines must follow the numbers above them', () => {
  it('🔴 does not claim red saturation when red is not near the ceiling', () => {
    // 🔴 The device on 2026-09-17: red DC **201** (bright, not pinned) and red
    // periodicity **higher** than green's. The footnote printed
    // 「紅的亮度接近 255 且節律遠低於綠 = 補光燈把紅通道打飽和了」 anyway,
    // because it printed unconditionally — the report contradicting its own
    // table two lines up, and steering the next session's debugging with it.
    const report = formatValidationReport([
      capture({
        channel: 'red',
        channelPeriodicity: { red: 0.15, green: 0.11 },
        channelDcMean: { red: 201, green: 44.9 },
      }),
    ]);
    expect(report).not.toContain('補光燈把紅通道打飽和');
    // And it should say what the numbers do say: neither channel had rhythm,
    // so the channel is not the problem.
    expect(report).toContain('兩個通道的節律都低');
  });

  it('still names saturation when both halves of the claim hold', () => {
    // The §16 case, which is what the footnote was written for: red pinned at
    // the ceiling AND worse rhythm than green.
    const report = formatValidationReport([
      capture({
        channel: 'green',
        channelPeriodicity: { red: 0.08, green: 0.82 },
        channelDcMean: { red: 248, green: 96 },
      }),
    ]);
    expect(report).toContain('補光燈把紅通道打飽和');
  });

  it('does not let one sample read as a distribution', () => {
    // 🔴 The device printed 「拍形穩定度 最低 0.96 · 中位數 0.96 · 最高 0.96」
    // from a single capture. Three numbers, one measurement — and §12 item 15
    // turns on the distribution, so this is the one place n must not hide.
    const report = formatValidationReport([capture({ beatTemplateCorrelation: 0.96 })]);
    expect(report).toContain('只有 1 筆，還不是分布');
    expect(report).not.toContain('最低 0.96 · 中位數 0.96 · 最高 0.96');
  });
});

describe('channels — where the pulse actually was', () => {
  it('says nothing from captures that never got that far', () => {
    const report = assessChannels([
      capture({ channel: null, channelPeriodicity: null, channelDcMean: null }),
    ]);
    expect(report.captureCount).toBe(0);
    expect(report.red.medianPeriodicity).toBeNull();
  });

  it('counts which channel won and what each looked like', () => {
    const report = assessChannels([
      capture({ channel: 'red', channelPeriodicity: { red: 0.9, green: 0.3 } }),
      capture({ channel: 'red', channelPeriodicity: { red: 0.8, green: 0.4 } }),
      capture({ channel: 'green', channelPeriodicity: { red: 0.2, green: 0.7 } }),
    ]);
    expect(report.red.chosenCount).toBe(2);
    expect(report.green.chosenCount).toBe(1);
    expect(report.red.medianPeriodicity).toBe(0.8);
  });

  it('🔴 makes the torch-saturation case readable at a glance', () => {
    // The shape the first real iPhone run is suspected to have: red pinned
    // near the ceiling with almost no rhythm in it, green carrying the pulse.
    const report = assessChannels([
      capture({
        channel: 'green',
        channelPeriodicity: { red: 0.24, green: 0.81 },
        channelDcMean: { red: 253, green: 140 },
      }),
    ]);
    expect(report.red.medianDcMean as number).toBeGreaterThan(240);
    expect(report.green.medianPeriodicity as number).toBeGreaterThan(
      report.red.medianPeriodicity as number,
    );
  });

  it('prints the channels in the report, above the numbered checks', () => {
    const report = formatValidationReport([capture()]);
    expect(report).toContain('通道');
    expect(report.indexOf('通道')).toBeLessThan(report.indexOf('#15'));
  });
});
