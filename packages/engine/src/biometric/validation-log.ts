/**
 * @module biometric/validation-log
 * @description Turns the device-validation checklist into something the device
 * itself answers.
 *
 * 🔴 `docs/PHONE-PPG.md` §12 is seventeen checks that need a real phone and a
 * real finger. Three of them decide whether this feature is viable at all, and
 * none of them can be answered by looking at a screen once:
 *
 *   - **#15** Is the PRV gate reachable? The 0.97 beat-template threshold was
 *     calibrated on synthetic signals, whose beats are more alike than a real
 *     fingertip's. If real captures rarely clear it, the evidence layer is
 *     empty in practice — which is honest, but it is a product fact someone
 *     has to know before shipping.
 *   - **#6** Does a walking capture ever show a Pulse Lock? A lock that
 *     appears and is then followed by a refusal is the failure mode the lock
 *     was designed against, and it takes one walk to find.
 *   - **#14** How large is real day-to-day variation against the instrument's
 *     own spread? That ratio is the one `docs/PHONE-PPG.md` §10 cannot fill in
 *     from synthetic data, and it decides whether any of this carries
 *     information.
 *
 * All three are counting exercises over captures that already happened. So the
 * capture surface records each attempt — **derived values only**, no frames,
 * no waveform, nothing that was not already computed — and these functions do
 * the counting.
 *
 * ⚠️ This is an instrument, not a feature. Nothing here reaches a reading, a
 * score, or a baseline.
 *
 * @see docs/PHONE-PPG.md §12
 */

/**
 * What the person was doing during a capture.
 *
 * 🔴 Supplied by the user, never inferred. Check #6 is specifically about
 * walking, and a phone cannot tell "walking" from "sitting on a train" — a
 * guess here would make the one check that matters unfalsifiable.
 */
export const VALIDATION_SCENARIOS = ['resting', 'walking', 'cold_hands', 'unspecified'] as const;
export type ValidationScenario = typeof VALIDATION_SCENARIOS[number];

/** One capture attempt, accepted or not. Derived values only. */
export interface ValidationCapture {
  /** When the capture finished, Unix ms. */
  atMs: number;
  /** Local calendar day, `YYYY-MM-DD`, supplied by the device. */
  localDateKey: string;
  /** Seconds of signal analysed. */
  durationSec: number;
  /** Quality score 0-100. */
  qualityScore: number;
  /** True when a pulse was established. */
  accepted: boolean;
  /** The reading, or null. */
  heartRateBpm: number | null;
  /** Pulse Rhythm in ms, or null when its gate did not pass. */
  prvRmssdMs: number | null;
  /** Beat-shape stability, or null when there were too few complete beats. */
  beatTemplateCorrelation: number | null;
  /** Whether a Pulse Lock was shown at any point during the capture. */
  lockEverAchieved: boolean;
  /** What the person said they were doing. */
  scenario: ValidationScenario;
}

// ─────────────────────────────────────────────
// #15 — Is the PRV gate reachable on a real device?
// ─────────────────────────────────────────────

/** Distribution summary, or null when there is nothing to summarise. */
export interface Spread {
  min: number;
  median: number;
  max: number;
}

/** What check #15 asks. */
export interface PrvGateReachability {
  /** Captures that established a pulse — the only ones the gate can apply to. */
  captureCount: number;
  /** Of those, how many cleared the beat-template threshold. */
  passedCount: number;
  /** 0..1, or null when no capture established a pulse. */
  passRate: number | null;
  /** How the beat-template measure was actually distributed. */
  templateCorrelation: Spread | null;
}

/**
 * Counts how often the PRV gate was reachable.
 *
 * @param log - Every capture attempt.
 * @returns The pass rate and the distribution behind it.
 */
export function assessPrvGateReachability(log: readonly ValidationCapture[]): PrvGateReachability {
  // Only captures that produced a pulse: the gate is never evaluated on the
  // others, and counting them would understate the pass rate for a reason that
  // has nothing to do with beat shape.
  const withPulse = log.filter((c) => c.accepted);
  const correlations = withPulse
    .map((c) => c.beatTemplateCorrelation)
    .filter((v): v is number => v !== null);

  return {
    captureCount: withPulse.length,
    passedCount: withPulse.filter((c) => c.prvRmssdMs !== null).length,
    passRate:
      withPulse.length === 0
        ? null
        : Math.round((withPulse.filter((c) => c.prvRmssdMs !== null).length / withPulse.length) * 100) /
          100,
    templateCorrelation: spreadOf(correlations),
  };
}

// ─────────────────────────────────────────────
// #6 — Does a lock ever appear on a capture that is then refused?
// ─────────────────────────────────────────────

/** What check #6 asks. */
export interface LockHonesty {
  captureCount: number;
  /**
   * Captures where a Pulse Lock appeared and the capture still produced no
   * reading. 🔴 This must be zero. It is the exact failure the lock was
   * designed against: forty seconds of "signal holding" followed by nothing.
   */
  falseLockCount: number;
  /** Walking captures — the scenario the check is about. */
  walkingCount: number;
  /** Walking captures that showed a lock at any point. */
  walkingLockCount: number;
  /** True while no capture has contradicted the lock. */
  passed: boolean;
}

/**
 * Checks that the lock never promised a reading the capture did not deliver.
 *
 * @param log - Every capture attempt.
 * @returns The counts, and whether anything contradicted the lock.
 */
export function assessLockHonesty(log: readonly ValidationCapture[]): LockHonesty {
  const falseLocks = log.filter((c) => c.lockEverAchieved && !c.accepted);
  const walking = log.filter((c) => c.scenario === 'walking');

  return {
    captureCount: log.length,
    falseLockCount: falseLocks.length,
    walkingCount: walking.length,
    walkingLockCount: walking.filter((c) => c.lockEverAchieved).length,
    passed: falseLocks.length === 0,
  };
}

// ─────────────────────────────────────────────
// #14 — Real day-to-day variation against the instrument's own spread
// ─────────────────────────────────────────────

/** What check #14 asks, for one metric. */
export interface DayToDaySpread {
  /** Separate days with at least one usable value. */
  dayCount: number;
  /** Usable values counted. */
  valueCount: number;
  /** SD of the per-day means — the day-to-day variation. */
  acrossDaySd: number | null;
  /** Mean of the within-day SDs — the instrument plus the hour. */
  withinDaySd: number | null;
  /**
   * `acrossDaySd / withinDaySd`. 🔴 The number `docs/PHONE-PPG.md` §10 cannot
   * fill in from synthetic data: below about 1 the metric carries almost no
   * information about the person, whatever the screen shows.
   */
  ratio: number | null;
}

/** Both metrics' day-to-day spread. */
export interface DayToDaySpreads {
  pulseBpm: DayToDaySpread;
  pulseRhythmMs: DayToDaySpread;
}

/**
 * Measures day-to-day variation against within-day variation.
 *
 * ⚠️ Needs at least two days with at least two values each before either half
 * of the ratio exists. Below that every field is null rather than a number
 * computed from one point.
 *
 * @param log - Every capture attempt.
 * @returns The spread for resting pulse and for Pulse Rhythm.
 */
export function assessDayToDaySpread(log: readonly ValidationCapture[]): DayToDaySpreads {
  return {
    pulseBpm: spreadAcrossDays(log, (c) => c.heartRateBpm),
    pulseRhythmMs: spreadAcrossDays(log, (c) => c.prvRmssdMs),
  };
}

function spreadAcrossDays(
  log: readonly ValidationCapture[],
  select: (capture: ValidationCapture) => number | null,
): DayToDaySpread {
  const byDay = new Map<string, number[]>();
  let valueCount = 0;

  for (const capture of log) {
    const value = select(capture);
    if (value === null) continue;
    valueCount++;
    const day = byDay.get(capture.localDateKey) ?? [];
    day.push(value);
    byDay.set(capture.localDateKey, day);
  }

  const days = [...byDay.values()];
  const dayMeans = days.map(mean);
  // Within-day spread needs a day with more than one value; days with a single
  // capture say nothing about how much the instrument wobbles within a sitting.
  const withinDays = days.filter((values) => values.length > 1).map(standardDeviation);

  const acrossDaySd = dayMeans.length > 1 ? standardDeviation(dayMeans) : null;
  const withinDaySd = withinDays.length > 0 ? mean(withinDays) : null;

  return {
    dayCount: days.length,
    valueCount,
    acrossDaySd: acrossDaySd === null ? null : round2(acrossDaySd),
    withinDaySd: withinDaySd === null ? null : round2(withinDaySd),
    ratio:
      acrossDaySd === null || withinDaySd === null || withinDaySd === 0
        ? null
        : round2(acrossDaySd / withinDaySd),
  };
}

// ─────────────────────────────────────────────
// The report
// ─────────────────────────────────────────────

/**
 * Renders the three checks as plain text to hand back.
 *
 * 🔴 Derived statistics only — counts, medians, standard deviations. No
 * timestamps beyond the day, no per-capture rows, and nothing that could
 * reconstruct a waveform. It is meant to be copied out of a phone and pasted
 * into a conversation, which is exactly why it may not carry anything that
 * would be uncomfortable to paste.
 *
 * @param log - Every capture attempt.
 * @returns A short plain-text report.
 */
export function formatValidationReport(log: readonly ValidationCapture[]): string {
  const gate = assessPrvGateReachability(log);
  const lock = assessLockHonesty(log);
  const spread = assessDayToDaySpread(log);

  const lines: string[] = [];
  lines.push(`TENKI 實機驗收 — ${log.length} 次擷取`);
  lines.push('');

  lines.push('#15 PRV 閘門可達性');
  if (gate.captureCount === 0) {
    lines.push('  還沒有任何立住脈搏的擷取。');
  } else {
    lines.push(`  立住脈搏 ${gate.captureCount} 次，其中 ${gate.passedCount} 次過 PRV 閘門`);
    lines.push(`  通過率 ${gate.passRate === null ? '—' : `${Math.round(gate.passRate * 100)}%`}`);
    if (gate.templateCorrelation !== null) {
      const t = gate.templateCorrelation;
      lines.push(`  拍形穩定度 最低 ${t.min} · 中位數 ${t.median} · 最高 ${t.max}`);
    }
  }
  lines.push('');

  lines.push('#6 Pulse Lock 誠實性');
  lines.push(`  擷取 ${lock.captureCount} 次，其中邊走 ${lock.walkingCount} 次（曾 lock ${lock.walkingLockCount} 次）`);
  lines.push(
    lock.passed
      ? '  ✓ 沒有任何一次「lock 出現但最終沒有讀數」'
      : `  ✗ ${lock.falseLockCount} 次 lock 出現但最終沒有讀數 —— 這條不過`,
  );
  lines.push('');

  lines.push('#14 跨天變異 vs 當日變異');
  lines.push(`  脈搏：${describeSpread(spread.pulseBpm, 'bpm')}`);
  lines.push(`  脈搏節律：${describeSpread(spread.pulseRhythmMs, 'ms')}`);

  return lines.join('\n');
}

function describeSpread(spread: DayToDaySpread, unit: string): string {
  if (spread.ratio === null) {
    return `資料不足（${spread.dayCount} 天、${spread.valueCount} 個值；需要至少 2 天、且有一天做過 2 次以上）`;
  }
  return `跨天 SD ${spread.acrossDaySd}${unit} / 當日 SD ${spread.withinDaySd}${unit} = ${spread.ratio}（${spread.dayCount} 天、${spread.valueCount} 個值）`;
}

// ─────────────────────────────────────────────
// Small statistics
// ─────────────────────────────────────────────

function spreadOf(values: readonly number[]): Spread | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return {
    min: sorted[0],
    median:
      sorted.length % 2 === 1 ? sorted[mid] : round2((sorted[mid - 1] + sorted[mid]) / 2),
    max: sorted[sorted.length - 1],
  };
}

function mean(values: readonly number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/** Population SD — this is the whole set of captures, not a sample from it. */
function standardDeviation(values: readonly number[]): number {
  const m = mean(values);
  return Math.sqrt(values.reduce((sum, v) => sum + (v - m) ** 2, 0) / values.length);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
