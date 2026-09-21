/**
 * What a Pulse Anchor is, and what a pile of them adds up to.
 *
 * 🔴 The claim under test is a negative one: one capture is not a baseline,
 * three captures on one day are not a baseline, and the word may only appear
 * at the last stage. Most of these tests exist to hold a stronger word back.
 */
import { PPG_FIXTURES, synthesizePpg } from '../ppg/replay';
import { analyzePpgScan } from '../ppg/analyze';
import {
  MIN_PRV_ANCHORS_FOR_COMPARISON,
  MIN_PRV_DATES_FOR_COMPARISON,
  PULSE_BASELINE_THRESHOLDS,
  type PulseAnchor,
  type PulseAnchorContext,
  buildPulseAnchor,
  contextsAreComparable,
  resolvePrvComparison,
  resolvePulseBaselineProgress,
  resolveRestingBand,
} from '../pulse-anchor';

const CONTEXT: PulseAnchorContext = {
  timeOfDay: 'morning',
  posture: 'sitting',
  afterExertion: false,
};

function analyse(overrides: Parameters<typeof synthesizePpg>[0] = {}) {
  const outcome = analyzePpgScan(synthesizePpg({ durationSec: 90, ...overrides }).frames, 'full_scan');
  if (outcome.status !== 'analysed') throw new Error(`rejected: ${outcome.reason}`);
  return outcome.analysis;
}

/** An anchor with a chosen reading and day, built through the real pipeline. */
function anchorOn(localDateKey: string, bpm: number): PulseAnchor {
  const real = buildPulseAnchor(analyse(), { capturedAtMs: 0, localDateKey, context: CONTEXT });
  if (real === null) throw new Error('clean scan produced no anchor');
  return { ...real, restingPulseBpm: bpm };
}

/** `count` anchors spread over `dates` separate days. */
function spread(count: number, dates: number, bpm = 68): PulseAnchor[] {
  return Array.from({ length: count }, (_, i) =>
    anchorOn(`2026-09-${String(10 + (i % dates)).padStart(2, '0')}`, bpm + (i % 5)),
  );
}

describe('an anchor exists only when a reading does', () => {
  it('builds one from a capture that established a pulse', () => {
    const anchor = buildPulseAnchor(analyse(), {
      capturedAtMs: 1_757_000_000_000,
      localDateKey: '2026-09-11',
      context: CONTEXT,
    });
    expect(anchor).not.toBeNull();
    expect(anchor?.restingPulseBpm).toBeGreaterThan(40);
    expect(anchor?.source).toBe('camera_fingertip_ppg');
    expect(anchor?.derivation).toBe('estimated');
    expect(anchor?.quality.accepted).toBe(true);
  });

  it('builds nothing from a capture that established none', () => {
    // 🔴 Not an anchor with a null reading — no anchor. Otherwise every caller
    // gets to decide whether to count it, and one of them decides wrong.
    const anchor = buildPulseAnchor(analyse(PPG_FIXTURES.lowPerfusion), {
      capturedAtMs: 0,
      localDateKey: '2026-09-11',
      context: CONTEXT,
    });
    expect(anchor).toBeNull();
  });

  it('carries no frames, waveform or pixel data anywhere in its shape', () => {
    // Privacy as a property of the type, not a habit: the serialised anchor is
    // the whole of what would be persisted.
    const anchor = buildPulseAnchor(analyse(), {
      capturedAtMs: 0,
      localDateKey: '2026-09-11',
      context: CONTEXT,
    });
    const json = JSON.stringify(anchor);
    for (const forbidden of ['frames', 'red', 'green', 'blue', 'pixels', 'waveform', 'samples']) {
      expect(json).not.toContain(`"${forbidden}"`);
    }
  });
});

describe('one capture is not a baseline', () => {
  it('calls a single anchor a first reference and nothing more', () => {
    const progress = resolvePulseBaselineProgress(spread(1, 1));
    expect(progress.stage).toBe('first_reference');
    expect(progress.nextStage).toBe('emerging_rhythm');
  });

  it('refuses to advance on repetition within one day', () => {
    // 🔴 Five readings on one morning describe one morning. The day count is
    // what makes a stage mean something, so anchors alone must not carry it.
    const progress = resolvePulseBaselineProgress(spread(5, 1));
    expect(progress.stage).toBe('first_reference');
    expect(progress.datesNeeded).toBe(1);
    expect(progress.anchorsNeeded).toBe(0);
  });

  it('reaches an emerging rhythm at three anchors across two days', () => {
    expect(resolvePulseBaselineProgress(spread(3, 2)).stage).toBe('emerging_rhythm');
  });

  it('reaches a personal resting band at seven across three days', () => {
    expect(resolvePulseBaselineProgress(spread(7, 3)).stage).toBe('personal_resting_band');
  });

  it('only calls it a baseline at the last stage', () => {
    const nearly = resolvePulseBaselineProgress(spread(19, 5));
    expect(nearly.stage).toBe('personal_resting_band');
    expect(nearly.anchorsNeeded).toBe(1);

    const there = resolvePulseBaselineProgress(spread(20, 5));
    expect(there.stage).toBe('contextual_baseline');
    expect(there.nextStage).toBeNull();
    expect(there.anchorsNeeded).toBe(0);
  });

  it('has nothing at all before the first capture', () => {
    const progress = resolvePulseBaselineProgress([]);
    expect(progress.stage).toBe('none');
    expect(progress.nextStage).toBe('first_reference');
    expect(progress.anchorsNeeded).toBe(1);
  });

  it('counts only accepted anchors', () => {
    const anchors = spread(3, 2);
    const withRejected = [
      ...anchors,
      { ...anchors[0], quality: { ...anchors[0].quality, accepted: false } },
    ];
    expect(resolvePulseBaselineProgress(withRejected).anchorCount).toBe(3);
  });
});

describe('a resting band is withheld until it can be stated', () => {
  it('gives no band from a first reference', () => {
    expect(resolveRestingBand(spread(1, 1))).toBeNull();
    expect(resolveRestingBand(spread(3, 2))).toBeNull();
  });

  it('states one once the band stage is reached', () => {
    const band = resolveRestingBand(spread(7, 3, 60));
    expect(band).not.toBeNull();
    expect(band?.anchorCount).toBe(7);
    expect(band?.lowBpm).toBeLessThanOrEqual(band?.medianBpm as number);
    expect(band?.medianBpm).toBeLessThanOrEqual(band?.highBpm as number);
  });

  it('does not let one outlying morning widen the band for good', () => {
    // ⚠️ Interquartile, not min-max. A single 110 bpm reading moves the middle
    // a little and must not move the stated edges to it.
    const normal = spread(11, 4, 60);
    const withOutlier = [...normal.slice(0, 10), { ...normal[10], restingPulseBpm: 110 }];
    const band = resolveRestingBand(withOutlier);
    expect(band?.highBpm).toBeLessThan(80);
  });
});

describe('contexts that are not comparable are not compared', () => {
  it('compares two captures taken the same way', () => {
    expect(contextsAreComparable(CONTEXT, { ...CONTEXT })).toBe(true);
  });

  it('refuses across time of day and posture', () => {
    expect(contextsAreComparable(CONTEXT, { ...CONTEXT, timeOfDay: 'night' })).toBe(false);
    expect(contextsAreComparable(CONTEXT, { ...CONTEXT, posture: 'lying' })).toBe(false);
  });

  it('refuses when one was after exertion and the other was not', () => {
    expect(contextsAreComparable(CONTEXT, { ...CONTEXT, afterExertion: true })).toBe(false);
  });

  it('treats an unasked exertion question as unknown, not as a no', () => {
    // 🔴 `null` means nobody asked. Reading it as "no" would silently compare a
    // post-stairs reading with a resting one.
    expect(contextsAreComparable(CONTEXT, { ...CONTEXT, afterExertion: null })).toBe(true);
    expect(
      contextsAreComparable(
        { ...CONTEXT, afterExertion: null },
        { ...CONTEXT, afterExertion: true },
      ),
    ).toBe(true);
  });
});

describe('the thresholds are the ones the spec names', () => {
  it('keeps the progression at 1 / 3 / 7 / 20 anchors', () => {
    expect(PULSE_BASELINE_THRESHOLDS.first_reference.anchors).toBe(1);
    expect(PULSE_BASELINE_THRESHOLDS.emerging_rhythm.anchors).toBe(3);
    expect(PULSE_BASELINE_THRESHOLDS.personal_resting_band.anchors).toBe(7);
    expect(PULSE_BASELINE_THRESHOLDS.contextual_baseline.anchors).toBe(20);
  });

  it('requires more separate days at every stage', () => {
    const dates = [
      PULSE_BASELINE_THRESHOLDS.first_reference.dates,
      PULSE_BASELINE_THRESHOLDS.emerging_rhythm.dates,
      PULSE_BASELINE_THRESHOLDS.personal_resting_band.dates,
      PULSE_BASELINE_THRESHOLDS.contextual_baseline.dates,
    ];
    for (let i = 1; i < dates.length; i++) expect(dates[i]).toBeGreaterThan(dates[i - 1]);
  });
});

describe('Pulse Rhythm is compared only against enough comparable history', () => {
  /** `count` PRV-bearing anchors over `dates` days, with the given values. */
  function prvAnchors(count: number, dates: number, values: number[]): PulseAnchor[] {
    return Array.from({ length: count }, (_, i) => ({
      ...anchorOn(`2026-09-${String(10 + (i % dates)).padStart(2, '0')}`, 66),
      prvRmssdMs: values[i % values.length],
    }));
  }

  it('withholds the comparison until there are enough comparable anchors', () => {
    // 🔴 founder rule: personal comparison only after sufficient comparable
    // high-quality resting anchors. One good capture is not a personal range.
    const result = resolvePrvComparison(prvAnchors(3, 3, [40, 42, 44]), 41);
    expect(result.status).toBe('accumulating');
    expect(result.required).toBe(MIN_PRV_ANCHORS_FOR_COMPARISON);
  });

  it('withholds it when the anchors are all from one day', () => {
    const result = resolvePrvComparison(prvAnchors(10, 1, [40, 42, 44]), 41);
    expect(result.status).toBe('accumulating');
  });

  it('counts only anchors whose PRV gate actually passed', () => {
    // ⚠️ An anchor with a pulse but no PRV says nothing about this person's
    // pulse rhythm, and counting it would reach the threshold on evidence that
    // does not exist.
    const withoutPrv = Array.from({ length: 10 }, (_, i) => ({
      ...anchorOn(`2026-09-${String(10 + (i % 4)).padStart(2, '0')}`, 66),
      prvRmssdMs: null,
    }));
    expect(resolvePrvComparison(withoutPrv, 41).status).toBe('accumulating');
    expect(resolvePrvComparison(withoutPrv, 41).sampleCount).toBe(0);
  });

  it('compares only within a comparable context', () => {
    const morning = prvAnchors(
      MIN_PRV_ANCHORS_FOR_COMPARISON + 2,
      MIN_PRV_DATES_FOR_COMPARISON + 1,
      [40, 42, 44, 46],
    );
    const night = morning.map((a) => ({ ...a, context: { ...a.context, timeOfDay: 'night' as const } }));
    // Plenty of anchors, none of them comparable with a morning capture.
    expect(resolvePrvComparison(night, 41, CONTEXT).status).toBe('accumulating');
  });

  it('places a reading inside the usual range once there is enough', () => {
    const anchors = prvAnchors(
      MIN_PRV_ANCHORS_FOR_COMPARISON + 2,
      MIN_PRV_DATES_FOR_COMPARISON + 1,
      [38, 40, 42, 44, 46],
    );
    const result = resolvePrvComparison(anchors, 42);
    expect(result.status).toBe('established');
    if (result.status === 'established') expect(result.placement).toBe('usual');
  });

  it('places a clearly high and a clearly low reading outside it', () => {
    const anchors = prvAnchors(
      MIN_PRV_ANCHORS_FOR_COMPARISON + 2,
      MIN_PRV_DATES_FOR_COMPARISON + 1,
      [38, 40, 42, 44, 46],
    );
    const high = resolvePrvComparison(anchors, 90);
    const low = resolvePrvComparison(anchors, 5);
    if (high.status === 'established') expect(high.placement).toBe('above_usual');
    if (low.status === 'established') expect(low.placement).toBe('below_usual');
  });

  it('says nothing when this capture produced no PRV at all', () => {
    // 🔴 A failed gate removes the whole result. It does not become a
    // comparison against history with a missing number in it.
    const anchors = prvAnchors(
      MIN_PRV_ANCHORS_FOR_COMPARISON + 2,
      MIN_PRV_DATES_FOR_COMPARISON + 1,
      [38, 40, 42],
    );
    expect(resolvePrvComparison(anchors, null).status).toBe('accumulating');
  });

  it('🔴 offers only neutral placements, never an autonomic reading', () => {
    // The vocabulary is the guard. There is no value this function can return
    // that says stress, recovery, readiness or vagal anything.
    const anchors = prvAnchors(
      MIN_PRV_ANCHORS_FOR_COMPARISON + 2,
      MIN_PRV_DATES_FOR_COMPARISON + 1,
      [38, 40, 42, 44, 46],
    );
    const result = resolvePrvComparison(anchors, 42);
    if (result.status === 'established') {
      expect(['below_usual', 'usual', 'above_usual']).toContain(result.placement);
    }
  });
});

describe('an anchor carries PRV without ever carrying HRV', () => {
  it('stores PRV and the gate it passed, beside the pulse', () => {
    const real = buildPulseAnchor(analyse(), {
      capturedAtMs: 0,
      localDateKey: '2026-09-11',
      context: CONTEXT,
    });
    expect(real?.prvRmssdMs).not.toBeNull();
    expect(real?.beatTemplateCorrelation).not.toBeNull();
  });

  it('🔴 has no field named hrv anywhere in the persisted shape', () => {
    const real = buildPulseAnchor(analyse(), {
      capturedAtMs: 0,
      localDateKey: '2026-09-11',
      context: CONTEXT,
    });
    expect(JSON.stringify(real).toLowerCase()).not.toContain('hrv');
  });
});
