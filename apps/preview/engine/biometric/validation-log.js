/**
 * ⚠️ GENERATED FILE — DO NOT EDIT.
 *
 * Compiled from packages/engine/src by scripts/build-preview-ppg.mjs so the
 * preview runs the engine's own pipeline instead of a hand-written mirror.
 * Edit the TypeScript, then run: node scripts/build-preview-ppg.mjs
 * The merge gate (scripts/preview-ppg-sync.mjs) fails if the two drift apart.
 */
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
import { DC_DRIFT_SUSPECT, DRIFT_PERIOD_TRUSTWORTHY_SEC, } from './ppg/exposure-stability.js';
/**
 * What the person was doing during a capture.
 *
 * 🔴 Supplied by the user, never inferred. Check #6 is specifically about
 * walking, and a phone cannot tell "walking" from "sitting on a train" — a
 * guess here would make the one check that matters unfalsifiable.
 */
export const VALIDATION_SCENARIOS = ['resting', 'walking', 'cold_hands', 'unspecified'];
/**
 * Whether an optional field is actually there.
 *
 * 🔴 The log is **persisted across app versions**, so every field added after a
 * record was written arrives as `undefined` — not `null`. A `!== null` check
 * passes for `undefined`, so such a record used to slip through the filter and
 * the next line dereferenced it. That is not a hypothetical: the report threw on
 * the real device for three separate runs (2026-09-12 through 09-17) and showed
 * only its placeholder, which is why no exposure numbers ever came back. The
 * harness never saw it because it clears the log before every run.
 *
 * ⚠️ Anything reading this log is reading data written by an older build. Use
 * this, never `!== null`.
 */
function present(value) {
    return value !== null && value !== undefined;
}
/**
 * Summarises which channel the pulse was actually in.
 *
 * 🔴 The first question a real device has to answer. If red's median DC sits
 * near 255 and its periodicity is far below green's, the torch is saturating
 * it and the pipeline was reading a flattened signal — which is exactly what
 * the first iPhone capture looked like.
 *
 * @param log - Every capture attempt.
 * @returns Per-channel summary.
 */
export function assessChannels(log) {
    const measured = log.filter((c) => present(c.channelPeriodicity));
    const summary = (channel) => ({
        chosenCount: log.filter((c) => c.channel === channel).length,
        medianPeriodicity: medianOf(measured.flatMap((c) => (present(c.channelPeriodicity) ? [c.channelPeriodicity[channel]] : []))),
        medianDcMean: medianOf(measured.flatMap((c) => (present(c.channelDcMean) ? [c.channelDcMean[channel]] : []))),
    });
    return { captureCount: measured.length, red: summary('red'), green: summary('green') };
}
/**
 * Counts how often the PRV gate was reachable.
 *
 * @param log - Every capture attempt.
 * @returns The pass rate and the distribution behind it.
 */
export function assessPrvGateReachability(log) {
    // Only captures that produced a pulse: the gate is never evaluated on the
    // others, and counting them would understate the pass rate for a reason that
    // has nothing to do with beat shape.
    const withPulse = log.filter((c) => c.accepted);
    const correlations = withPulse
        .map((c) => c.beatTemplateCorrelation)
        .filter((v) => v !== null);
    return {
        captureCount: withPulse.length,
        passedCount: withPulse.filter((c) => c.prvRmssdMs !== null).length,
        passRate: withPulse.length === 0
            ? null
            : Math.round((withPulse.filter((c) => c.prvRmssdMs !== null).length / withPulse.length) * 100) /
                100,
        templateCorrelation: spreadOf(correlations),
    };
}
/**
 * Checks that the lock never promised a reading the capture did not deliver.
 *
 * @param log - Every capture attempt.
 * @returns The counts, and whether anything contradicted the lock.
 */
export function assessLockHonesty(log) {
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
export function assessDayToDaySpread(log) {
    return {
        pulseBpm: spreadAcrossDays(log, (c) => c.heartRateBpm),
        pulseRhythmMs: spreadAcrossDays(log, (c) => c.prvRmssdMs),
    };
}
function spreadAcrossDays(log, select) {
    const byDay = new Map();
    let valueCount = 0;
    for (const capture of log) {
        const value = select(capture);
        if (value === null)
            continue;
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
        ratio: acrossDaySd === null || withinDaySd === null || withinDaySd === 0
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
export function formatValidationReport(log) {
    const gate = assessPrvGateReachability(log);
    const lock = assessLockHonesty(log);
    const spread = assessDayToDaySpread(log);
    const channels = assessChannels(log);
    const lines = [];
    lines.push(`TENKI 實機驗收 — ${log.length} 次擷取`);
    lines.push('');
    lines.push('通道（脈搏實際在哪個通道）');
    if (channels.captureCount === 0) {
        lines.push('  還沒有任何量到通道的擷取。');
    }
    else {
        lines.push(`  紅：選中 ${channels.red.chosenCount} 次 · 節律中位數 ${fmt(channels.red.medianPeriodicity)} · 亮度中位數 ${fmt(channels.red.medianDcMean)}`);
        lines.push(`  綠：選中 ${channels.green.chosenCount} 次 · 節律中位數 ${fmt(channels.green.medianPeriodicity)} · 亮度中位數 ${fmt(channels.green.medianDcMean)}`);
        // 🔴 The footnote used to print unconditionally, so it asserted the §16
        // saturation diagnosis whatever the numbers said. On 2026-09-17 it printed
        // 「紅的亮度接近 255 且節律遠低於綠」 above a red DC of **201** whose
        // periodicity was **higher** than green's — the report contradicting itself
        // in adjacent lines, and steering the next session's debugging with it.
        lines.push(`  （${channelNote(channels)}）`);
    }
    lines.push('');
    lines.push('曝光（相機有沒有在自己重新決定亮度）');
    const exposures = log.filter((c) => present(c.exposure));
    if (exposures.length === 0) {
        lines.push('  還沒有任何量到曝光的擷取。');
    }
    else {
        const drift = medianOf(exposures.map((c) => c.exposure.dcDriftFraction));
        const step = medianOf(exposures.map((c) => c.exposure.largestStepFraction));
        const fps = medianOf(exposures.map((c) => c.exposure.framesPerSecond));
        const gap = medianOf(exposures.map((c) => c.exposure.longestGapMs));
        const hunting = exposures.filter((c) => c.exposure.slowDriftDominates).length;
        const locks = log.filter((c) => present(c.exposureLock) && Array.isArray(c.exposureLock.requested));
        // ⚠️ 擠在三行裡是刻意的：這份報告是要被**貼回對話**的，長度本身有一條
        // 斷言守著。門檻印在數字旁邊，讀的人不必記得它是多少。
        lines.push(`  DC 慢速擺動中位數 ${fmt(drift)} · 最大單秒跳動 ${fmt(step)} · 門檻 ${DC_DRIFT_SUSPECT} · 可疑（擺動 ≥ 門檻）：${hunting}/${exposures.length} 次`);
        const period = medianOf(
        // 🔴 `present`, not `!== null`. A record written before `driftPeriodSec`
        // existed carries `undefined` there, and `undefined !== null` is **true**
        // — so the filter passed it through as a number and the median came out
        // `NaN`. This is bug `86b39915` a second time, in this same file, three
        // commits after its lesson went into the PLAYBOOK. The helper on line 64
        // was written for exactly this and I did not use it.
        exposures.map((c) => c.exposure.driftPeriodSec).filter(present));
        lines.push(`  慢速擺動週期中位數 ${fmt(period)} 秒${driftPeriodNote(period)}`);
        lines.push(`  時基 fps ${fmt(fps)} · 最長間隔 ${fmt(gap)} ms`);
        lines.push(`  ${exposureLockNote(locks)}`);
        lines.push(`  ${torchSplitNote(exposures)}`);
        lines.push('  （擺動遠大於門檻 = auto-exposure 在擷取中重調增益，會蓋掉心搏起伏）');
    }
    // ⚠️ Outside the exposure branch on purpose: this is about the rescue, and a
    // capture can reach it whether or not exposure was measurable. Nesting it in
    // there meant the line silently vanished on exactly the logs that needed it.
    lines.push(`  ${quietSegmentNote(log)}`);
    lines.push('');
    lines.push('#15 PRV 閘門可達性');
    if (gate.captureCount === 0) {
        lines.push('  還沒有任何立住脈搏的擷取。');
    }
    else {
        lines.push(`  立住脈搏 ${gate.captureCount} 次，其中 ${gate.passedCount} 次過 PRV 閘門`);
        lines.push(`  通過率 ${gate.passRate === null ? '—' : `${Math.round(gate.passRate * 100)}%`}`);
        if (gate.templateCorrelation !== null) {
            const t = gate.templateCorrelation;
            lines.push(t.count === 1
                ? `  拍形穩定度 ${t.median}（只有 1 筆，還不是分布）`
                : `  拍形穩定度 最低 ${t.min} · 中位數 ${t.median} · 最高 ${t.max}（${t.count} 筆）`);
        }
    }
    lines.push('');
    lines.push('#6 Pulse Lock 誠實性');
    lines.push(`  擷取 ${lock.captureCount} 次，其中邊走 ${lock.walkingCount} 次（曾 lock ${lock.walkingLockCount} 次）`);
    lines.push(lock.passed
        ? '  ✓ 沒有任何一次「lock 出現但最終沒有讀數」'
        : `  ✗ ${lock.falseLockCount} 次 lock 出現但最終沒有讀數 —— 這條不過`);
    lines.push('');
    lines.push('#14 跨天變異 vs 當日變異');
    lines.push(`  脈搏：${describeSpread(spread.pulseBpm, 'bpm')}`);
    lines.push(`  脈搏節律：${describeSpread(spread.pulseRhythmMs, 'ms')}`);
    return lines.join('\n');
}
function describeSpread(spread, unit) {
    if (spread.ratio === null) {
        return `資料不足（${spread.dayCount} 天、${spread.valueCount} 個值；需要至少 2 天、且有一天做過 2 次以上）`;
    }
    return `跨天 SD ${spread.acrossDaySd}${unit} / 當日 SD ${spread.withinDaySd}${unit} = ${spread.ratio}（${spread.dayCount} 天、${spread.valueCount} 個值）`;
}
// ─────────────────────────────────────────────
// Small statistics
// ─────────────────────────────────────────────
/**
 * DC level, out of 255, above which the flash really is pushing a channel at
 * the sensor ceiling.
 *
 * ⚠️ Not 255: a channel saturates in its brightest pixels long before its mean
 * gets there. 230 is where the §16 device sat. The device on 2026-09-17 sat at
 * **201**, which is bright and not saturated — and the difference decides which
 * of two completely different repairs is called for.
 */
const CHANNEL_SATURATION_DC = 230;
/**
 * The channel section's footnote, which has to follow the numbers above it.
 *
 * 🔴 Saturation is a **conjunction**: the channel is pinned near the ceiling
 * AND its rhythm is worse than the other channel's. Print the conclusion
 * without checking both and the report argues against its own table.
 *
 * @param channels - The per-channel summary printed immediately above.
 * @returns One line of interpretation, in parentheses in the report.
 */
function channelNote(channels) {
    const red = channels.red;
    const green = channels.green;
    const bothMeasured = red.medianPeriodicity !== null && green.medianPeriodicity !== null;
    const redPinned = red.medianDcMean !== null && red.medianDcMean >= CHANNEL_SATURATION_DC;
    const redWorse = bothMeasured && red.medianPeriodicity < green.medianPeriodicity;
    if (redPinned && redWorse) {
        return '紅的亮度接近上限且節律低於綠 = 補光燈把紅通道打飽和了（§16）';
    }
    if (redPinned) {
        return '紅的亮度接近上限，但節律沒有低於綠 —— 還不足以說是飽和';
    }
    if (bothMeasured && red.medianPeriodicity < 0.35 && green.medianPeriodicity < 0.35) {
        return '兩個通道的節律都低 = 不是選錯通道，兩邊都沒有可用的節律（看曝光那段）';
    }
    return '紅沒有接近上限 = 這一批不是 §16 的飽和情形';
}
/**
 * How to read the drift period, when there is one to read.
 *
 * 🔴 The optimistic reading requires a **positive** test, and that ordering is
 * the point. The first version branched on `period === null` and fell through
 * to its most encouraging sentence otherwise — so when a `NaN` arrived, it
 * defeated the null check and then defeated both `<` comparisons (every
 * comparison with NaN is false) and landed on that sentence by failing every
 * test on the way. An unknown value must never reach a good branch by failing
 * tests; it has to pass one.
 *
 * 🔴 And the encouraging sentence itself is gone. It used to say a period
 * slower than a heartbeat meant the drift could "in principle be divided out".
 * A sweep across drift shapes disproved that twice over (`docs/PHONE-PPG.md`
 * §22): a stepped drift alternating every 2 s has a legitimately slow 4.07 s
 * fundamental and correcting it still produced a **27 bpm error**, because what
 * lands in the cardiac band is its harmonics, not its fundamental. This number
 * describes the drift's shape and licenses nothing.
 *
 * @param period - Median drift period in seconds, or null when unmeasured.
 * @returns The parenthesised reading, including its own leading bracket.
 */
function driftPeriodNote(period) {
    if (period === null || !Number.isFinite(period)) {
        return '（量不到 —— 不代表沒有擺動）';
    }
    if (period < DRIFT_PERIOD_TRUSTWORTHY_SEC) {
        return `（低於 ${DRIFT_PERIOD_TRUSTWORTHY_SEC} 秒 = 也可能是更快的擺動被一秒桶折疊，不能當成「慢」）`;
    }
    return '（只描述形狀 —— 週期慢不代表除得掉，帶內的是諧波不是基頻，§22）';
}
/**
 * Whether the quiet-stretch rescue fired, and when it did not, which refusal.
 *
 * 🔴 Names the refusal rather than reporting a count of failures, because the
 * three causes need three different repairs: too few stretches means the cuts
 * or the minimum length are wrong for this camera; stretches without a usable
 * pulse means the pulse is genuinely not there; disagreement means the
 * stretches are seeing different things.
 *
 * @param log - Every recorded capture.
 * @returns One line summarising the rescue across the log.
 */
function quietSegmentNote(log) {
    const tried = log.filter((c) => present(c.quietSegments));
    if (tried.length === 0)
        return '安靜段讀數 沒有任何擷取走到這一步（節律不是唯一被擋的理由）';
    const rescued = tried.filter((c) => c.quietSegments.bpm !== null).length;
    if (rescued > 0) {
        return `安靜段讀數 救起 ${rescued}/${tried.length} 次`;
    }
    const tooFew = tried.filter((c) => c.quietSegments.foundCount < 3);
    const notPeriodic = tried.filter((c) => c.quietSegments.foundCount >= 3 && c.quietSegments.periodicCount < 3);
    const longest = medianOf(tried.map((c) => c.quietSegments.longestSec));
    const found = medianOf(tried.map((c) => c.quietSegments.foundCount));
    if (tooFew.length >= notPeriodic.length) {
        return `安靜段讀數 0/${tried.length} —— 多數是**切不出夠多段**（找到 ${fmt(found)} 段，最長 ${fmt(longest)} 秒，需要 3 段各 ≥4 秒）`;
    }
    return `安靜段讀數 0/${tried.length} —— 段切得出來（${fmt(found)} 段）但**段裡沒有可用的脈搏**`;
}
/**
 * Drift split by whether the torch was lit — the A/B the device can run itself.
 *
 * 🔴 The browser will not lock exposure (`exposureLockNote`), so the only
 * remaining way to stop auto-exposure hunting is to stop giving it something to
 * hunt. A torch against a fingertip puts red near 200 and green near 37, which
 * is about as hard a scene as an AE loop can be handed. Whether that is what
 * drives the 29% drift is answerable in two captures — but only if the log
 * records which captures had the torch on, and only if the report puts the two
 * medians beside each other.
 *
 * ⚠️ Says "not compared yet" until both sides exist. One side alone is not a
 * comparison, and printing a single median under this heading would read like
 * one.
 *
 * @param exposures - Captures that measured exposure.
 * @returns One line comparing drift with the torch on against off.
 */
function torchSplitNote(exposures) {
    const lit = exposures.filter((c) => c.torchOn === true);
    const dark = exposures.filter((c) => c.torchOn === false);
    const unknown = exposures.length - lit.length - dark.length;
    if (lit.length === 0 && dark.length === 0) {
        return `補光燈對照 還沒有紀錄（${unknown} 筆沒記到補光燈狀態）`;
    }
    if (lit.length === 0 || dark.length === 0) {
        const side = lit.length === 0 ? '關' : '開';
        const missing = lit.length === 0 ? '開' : '關';
        return `補光燈對照 只有「${side}」的資料（${lit.length + dark.length} 筆）—— 再做一次「${missing}」才比得出來`;
    }
    const onDrift = medianOf(lit.map((c) => c.exposure.dcDriftFraction));
    const offDrift = medianOf(dark.map((c) => c.exposure.dcDriftFraction));
    return `補光燈對照 開：擺動 ${fmt(onDrift)}（${lit.length} 筆）· 關：擺動 ${fmt(offDrift)}（${dark.length} 筆）`;
}
/**
 * What the exposure lock actually achieved, as opposed to whether some
 * constraint was accepted.
 *
 * 🔴 `applied` is one boolean for the whole `applyConstraints` call, and the
 * call only ever asks for the modes this browser advertises as manual. On
 * 2026-09-17 that set was `whiteBalanceMode` alone — so the report printed
 * 「曝光鎖 成功 7/7 次」 for seven captures in which **the exposure was never
 * locked at all**, and then explained the remaining drift as "the browser
 * accepted the constraint without really locking". Both halves were wrong, and
 * they pointed the next step at the wrong problem.
 *
 * @param locks - Captures that recorded a lock attempt.
 * @returns One line naming what was and was not locked.
 */
function exposureLockNote(locks) {
    if (locks.length === 0)
        return '曝光鎖 沒有任何紀錄（這個瀏覽器沒有可鎖的項目，或沒試過）';
    const asked = [...new Set(locks.flatMap((c) => c.exposureLock.requested))];
    const exposureAsked = locks.filter((c) => c.exposureLock.requested.includes('exposureMode'));
    const others = asked.filter((mode) => mode !== 'exposureMode');
    const alsoLocked = others.length === 0 ? '' : `；另外鎖到 ${others.join('、')}`;
    if (exposureAsked.length === 0) {
        return `曝光鎖 🔴 **這個瀏覽器根本不給鎖曝光**（exposureMode 沒有 manual 可用）${alsoLocked}`;
    }
    const applied = exposureAsked.filter((c) => c.exposureLock.applied).length;
    return `曝光鎖 exposureMode 成功 ${applied}/${exposureAsked.length} 次${alsoLocked}`;
}
function spreadOf(values) {
    if (values.length === 0)
        return null;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return {
        min: sorted[0],
        median: sorted.length % 2 === 1 ? sorted[mid] : round2((sorted[mid - 1] + sorted[mid]) / 2),
        max: sorted[sorted.length - 1],
        count: sorted.length,
    };
}
/**
 * Prints a number, or a dash when there is no number to print.
 *
 * 🔴 Non-finite counts as "no number". A `NaN` reached this function once and
 * printed as the literal text `NaN 秒` in a report the founder then had to
 * interpret. Anything that is not a real value must render as absent, whatever
 * upstream mistake produced it — this is the last place that can still catch it.
 */
function fmt(value) {
    return value === null || !Number.isFinite(value) ? '—' : String(value);
}
/**
 * Median of the values that are actually values.
 *
 * ⚠️ Filters to finite numbers first, so one `undefined` leaking in from a
 * legacy record cannot turn the whole aggregate into `NaN`. An empty result is
 * null — "nothing measured" — never a number.
 */
function medianOf(values) {
    const finite = values.filter((v) => Number.isFinite(v));
    if (finite.length === 0)
        return null;
    const sorted = [...finite].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 1 ? sorted[mid] : round2((sorted[mid - 1] + sorted[mid]) / 2);
}
function mean(values) {
    return values.reduce((sum, v) => sum + v, 0) / values.length;
}
/** Population SD — this is the whole set of captures, not a sample from it. */
function standardDeviation(values) {
    const m = mean(values);
    return Math.sqrt(values.reduce((sum, v) => sum + (v - m) ** 2, 0) / values.length);
}
function round2(value) {
    return Math.round(value * 100) / 100;
}
